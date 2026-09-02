"""
Video service for SmartixClip - handles database operations for videos
Includes advanced caching with TTL and MongoDB persistent cache
"""
import time
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from bson import ObjectId

_db = None
_memory_cache = {}

CACHE_TTL_SECONDS = int(os.getenv("VIDEO_CACHE_TTL", 3600))
FETCH_INTERVAL_MINUTES = int(os.getenv("VIDEO_FETCH_INTERVAL", 360))


def set_db(database):
    global _db
    _db = database


def cache_get(key: str) -> Optional[Dict]:
    """Get value from in-memory cache with TTL check"""
    v = _memory_cache.get(key)
    if not v:
        return None
    payload, expires = v
    if expires < time.time():
        del _memory_cache[key]
        return None
    return payload


def cache_set(key: str, payload: Dict, ttl: int = None):
    """Set value in in-memory cache with TTL"""
    if ttl is None:
        ttl = CACHE_TTL_SECONDS
    _memory_cache[key] = (payload, time.time() + ttl)


def cache_clear():
    """Clear all in-memory cache"""
    global _memory_cache
    _memory_cache = {}
    print("✅ Memory cache cleared")


async def get_videos_collection():
    if _db is None:
        from db import get_collection
        return get_collection('smartclips')
    return _db['smartclips']


async def store_video(video: Dict) -> bool:
    """
    Store a single video with upsert based on provider + provider_video_id.
    Returns True if inserted/updated, False on error.
    """
    try:
        collection = await get_videos_collection()
        
        video['fetched_at'] = datetime.now(timezone.utc)
        if 'created_at' not in video:
            video['created_at'] = datetime.now(timezone.utc)
        if 'id' not in video:
            video['id'] = str(ObjectId())
        
        provider = video.get("provider", video.get("source", "unknown").lower())
        provider_video_id = video.get("provider_video_id", video.get("video_url"))
        
        result = await collection.update_one(
            {
                "provider": provider,
                "provider_video_id": provider_video_id
            },
            {
                "$setOnInsert": video
            },
            upsert=True
        )
        
        return result.upserted_id is not None or result.modified_count > 0
    except Exception as e:
        print(f"VIDEO INSERT ERROR: {e}")
        return False


async def get_cache_collection():
    """Get the video cache metadata collection"""
    try:
        if _db is None:
            from db import get_collection
            return get_collection('video_cache_meta')
        return _db['video_cache_meta']
    except Exception as e:
        print(f"⚠️ Cannot get cache collection: {e}")
        return None


async def check_cache_validity(source: str) -> bool:
    """
    Check if cached data for a source is still valid.
    Returns True if cache is valid, False if refresh needed.
    """
    try:
        cache_coll = await get_cache_collection()
        if cache_coll is None:
            return False
            
        cache_meta = await cache_coll.find_one({"source": source})
        
        if not cache_meta:
            return False
        
        expires_at = cache_meta.get("expires_at")
        if not expires_at:
            return False
        
        return datetime.now(timezone.utc) < expires_at
    except Exception as e:
        print(f"⚠️ Cache check error for {source}: {e}")
        return False


async def update_cache_metadata(source: str, count: int, ttl_hours: int = 6):
    """Update cache metadata after fetching from a source. Fails gracefully if DB unavailable."""
    try:
        cache_coll = await get_cache_collection()
        if cache_coll is None:
            return
        
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=ttl_hours)
        
        await cache_coll.update_one(
            {"source": source},
            {
                "$set": {
                    "source": source,
                    "last_fetched": now,
                    "expires_at": expires_at,
                    "video_count": count,
                    "status": "success"
                }
            },
            upsert=True
        )
        print(f"✅ Cache metadata updated for {source}: {count} videos, expires in {ttl_hours}h")
    except Exception as e:
        print(f"⚠️ Cache metadata update error (non-fatal): {e}")


async def get_cache_status() -> Dict:
    """Get status of all cached sources"""
    try:
        cache_coll = await get_cache_collection()
        if cache_coll is None:
            return {}
            
        cursor = cache_coll.find({})
        sources = await cursor.to_list(length=100)
        
        now = datetime.now(timezone.utc)
        status = {}
        
        for s in sources:
            source_name = s.get("source", "unknown")
            expires_at = s.get("expires_at")
            is_valid = expires_at and now < expires_at if expires_at else False
            
            status[source_name] = {
                "last_fetched": s.get("last_fetched"),
                "expires_at": expires_at,
                "video_count": s.get("video_count", 0),
                "is_valid": is_valid,
                "status": s.get("status", "unknown")
            }
        
        return status
    except Exception as e:
        print(f"⚠️ Get cache status error: {e}")
        return {}


async def bulk_insert(items: List[Dict]) -> int:
    """
    Insert videos into database with upsert based on video_url (unique index).
    Updates cache metadata for each source.
    """
    if not items:
        return 0
    
    collection = await get_videos_collection()
    inserted = 0
    source_counts = {}
    
    for item in items:
        try:
            item['fetched_at'] = datetime.now(timezone.utc)
            if 'created_at' not in item:
                item['created_at'] = datetime.now(timezone.utc)
            if 'id' not in item:
                item['id'] = str(ObjectId())
            
            video_url = item.get("video_url")
            if not video_url:
                continue
            
            result = await collection.update_one(
                {"video_url": video_url},
                {"$setOnInsert": item},
                upsert=True
            )
            
            if result.upserted_id is not None:
                inserted += 1
                source = item.get("source", "unknown")
                source_counts[source] = source_counts.get(source, 0) + 1
                
        except Exception as e:
            continue
    
    for source, count in source_counts.items():
        ttl = 6 if source in ["Pexels", "Pixabay"] else 24
        await update_cache_metadata(source, count, ttl_hours=ttl)
        print(f"📊 {source}: {count} vidéos stockées")
    
    print(f"✅ Inserted {inserted} new videos from aggregator")
    return inserted


async def get_paginated_videos(
    page: int = 1, 
    limit: int = 10, 
    source: Optional[str] = None,
    tags: Optional[List[str]] = None,
    use_cache: bool = True
) -> List[Dict]:
    """
    Get paginated videos with optional filtering and caching.
    """
    cache_key = f"videos:{page}:{limit}:{source}:{','.join(tags or [])}"
    
    if use_cache:
        cached = cache_get(cache_key)
        if cached:
            return cached
    
    collection = await get_videos_collection()
    skip = (page - 1) * limit
    
    query = {}
    if source:
        query["source"] = source
    if tags:
        query["tags"] = {"$in": tags}
    
    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    videos = await cursor.to_list(length=limit)
    
    for video in videos:
        if '_id' in video:
            video['_id'] = str(video['_id'])
        if 'id' not in video:
            video['id'] = video.get('_id', str(ObjectId()))
    
    if use_cache and videos:
        cache_set(cache_key, videos, ttl=300)
    
    return videos


async def get_videos_count(source: Optional[str] = None) -> int:
    """Get total count of videos, optionally filtered by source"""
    collection = await get_videos_collection()
    query = {}
    if source:
        query["source"] = source
    return await collection.count_documents(query)


async def get_video_by_id(video_id: str) -> Optional[Dict]:
    """Get a single video by ID"""
    cache_key = f"video:{video_id}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    
    collection = await get_videos_collection()
    
    try:
        video = await collection.find_one({"_id": ObjectId(video_id)})
    except:
        video = await collection.find_one({"id": video_id})
    
    if video and '_id' in video:
        video['_id'] = str(video['_id'])
    
    if video:
        cache_set(cache_key, video, ttl=600)
    
    return video


async def increment_view(video_id: str):
    """Increment view count for a video"""
    collection = await get_videos_collection()
    try:
        await collection.update_one(
            {"$or": [{"_id": ObjectId(video_id)}, {"id": video_id}]},
            {"$inc": {"views": 1}}
        )
    except:
        pass


async def toggle_like(video_id: str, user_id: str) -> bool:
    """Toggle like status for a video by a user"""
    collection = await get_videos_collection()
    try:
        video = await collection.find_one({"$or": [{"_id": ObjectId(video_id)}, {"id": video_id}]})
        if not video:
            return False
        
        likes = video.get('liked_by', [])
        if user_id in likes:
            await collection.update_one(
                {"$or": [{"_id": ObjectId(video_id)}, {"id": video_id}]},
                {"$pull": {"liked_by": user_id}, "$inc": {"likes": -1}}
            )
            return False
        else:
            await collection.update_one(
                {"$or": [{"_id": ObjectId(video_id)}, {"id": video_id}]},
                {"$addToSet": {"liked_by": user_id}, "$inc": {"likes": 1}}
            )
            return True
    except Exception as e:
        print(f"Error toggling like: {e}")
        return False


async def get_sources_stats() -> Dict:
    """Get statistics about videos by source"""
    collection = await get_videos_collection()
    
    pipeline = [
        {"$group": {
            "_id": "$source",
            "count": {"$sum": 1},
            "total_views": {"$sum": "$views"},
            "total_likes": {"$sum": "$likes"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    cursor = collection.aggregate(pipeline)
    results = await cursor.to_list(length=50)
    
    stats = {}
    for r in results:
        stats[r["_id"]] = {
            "count": r["count"],
            "total_views": r.get("total_views", 0),
            "total_likes": r.get("total_likes", 0)
        }
    
    return stats


async def search_videos(
    query: str, 
    page: int = 1, 
    limit: int = 10
) -> List[Dict]:
    """Search videos by title or tags"""
    collection = await get_videos_collection()
    skip = (page - 1) * limit
    
    search_query = {
        "$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"tags": {"$in": [query.lower()]}},
            {"description": {"$regex": query, "$options": "i"}}
        ]
    }
    
    cursor = collection.find(search_query).sort("created_at", -1).skip(skip).limit(limit)
    videos = await cursor.to_list(length=limit)
    
    for video in videos:
        if '_id' in video:
            video['_id'] = str(video['_id'])
        if 'id' not in video:
            video['id'] = video.get('_id', str(ObjectId()))
    
    return videos
