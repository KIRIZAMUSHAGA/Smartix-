"""
SmartClips Service - Gestion intelligente des vidéos avec scraping incrémental
Version 2.1 avec support studio d'édition vidéo
"""
import asyncio
import json
import time
import hashlib
import os
import uuid
import shutil
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Callable
from bson import ObjectId
import redis.asyncio as aioredis
from collections import defaultdict

# ========== CONFIGURATION ==========
REDIS_URL = "redis://localhost"
CACHE_TTL = {
    "preferences": 600,      # 10 minutes
    "watched": 300,          # 5 minutes
    "feed": 120,             # 2 minutes
    "tags": 3600,            # 1 heure
    "stats": 600,            # 10 minutes
    "studio_projects": 300   # 5 minutes
}

# Configuration des dossiers studio
STUDIO_UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "smartclips_studio", "uploads")
STUDIO_PROCESSED_DIR = os.path.join(os.getcwd(), "uploads", "smartclips_studio", "processed")
STUDIO_TEMP_DIR = os.path.join(os.getcwd(), "uploads", "smartclips_studio", "temp")

# Créer les dossiers
for directory in [STUDIO_UPLOAD_DIR, STUDIO_PROCESSED_DIR, STUDIO_TEMP_DIR]:
    os.makedirs(directory, exist_ok=True)

_db = None
_redis = None

# ========== CONNEXIONS ==========
async def get_db():
    """Récupère la connexion MongoDB"""
    global _db
    if _db is None:
        from db import get_db as db_get_db
        db_res = db_get_db()
        if asyncio.iscoroutine(db_res):
            _db = await db_res
        else:
            _db = db_res
    return _db

async def get_redis():
    """Récupère la connexion Redis"""
    global _redis
    if _redis is None:
        try:
            _redis = await aioredis.from_url(
                REDIS_URL,
                max_connections=10,
                decode_responses=True,
                socket_connect_timeout=2
            )
            await _redis.ping()
            print("✅ Redis connecté")
        except Exception as e:
            print(f"⚠️ Redis non disponible: {e}")
            _redis = None
    return _redis

async def get_collection(name: str):
    db = await get_db()
    return db[name]

# ========== CACHE UTILS ==========
async def get_cached(key: str, fetch_func: Callable, ttl: int = 300) -> Any:
    """Pattern cache-aside avec fallback"""
    redis = await get_redis()
    if not redis:
        return await fetch_func()
    
    try:
        cached = await redis.get(key)
        if cached:
            return json.loads(cached)
        
        result = await fetch_func() if asyncio.iscoroutinefunction(fetch_func) else fetch_func()
        
        if result:
            await redis.setex(key, ttl, json.dumps(result, default=str))
        
        return result
    except Exception as e:
        print(f"⚠️ Cache error for {key}: {e}")
        return await fetch_func() if asyncio.iscoroutinefunction(fetch_func) else fetch_func()

async def invalidate_cache(pattern: str):
    """Invalide toutes les clés correspondant au pattern"""
    redis = await get_redis()
    if not redis:
        return
    
    try:
        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)
            print(f"🧹 Cache invalidé: {len(keys)} clés pour {pattern}")
    except Exception as e:
        print(f"⚠️ Cache invalidation error: {e}")

# ========== STUDIO PROJECT MANAGEMENT ==========

async def save_studio_project(
    user_id: str,
    video_id: str,
    original_filename: str,
    original_path: str,
    status: str = "uploaded"
) -> Optional[Dict]:
    """Sauvegarde un projet studio"""
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        project = {
            "_id": video_id,
            "user_id": user_id,
            "original_filename": original_filename,
            "original_path": original_path,
            "processed_url": None,
            "status": status,
            "progress": 0,
            "error": None,
            "elements": [],
            "filter": None,
            "audio": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "completed_at": None
        }
        
        await projects_col.insert_one(project)
        
        # Invalider le cache
        await invalidate_cache(f"studio_project:{user_id}:*")
        
        return project
        
    except Exception as e:
        print(f"Error saving studio project: {e}")
        return None

async def get_studio_project(video_id: str, user_id: str) -> Optional[Dict]:
    """Récupère un projet studio"""
    async def _fetch():
        try:
            projects_col = await get_collection('smartclips_studio_projects')
            project = await projects_col.find_one({"_id": video_id, "user_id": user_id})
            
            if project:
                project['id'] = str(project['_id'])
                del project['_id']
            
            return project
        except Exception as e:
            print(f"Error getting studio project: {e}")
            return None
    
    return await get_cached(
        f"studio_project:{user_id}:{video_id}",
        _fetch,
        CACHE_TTL["studio_projects"]
    )

async def update_studio_project_status(
    video_id: str,
    status: str,
    error: Optional[str] = None,
    processed_url: Optional[str] = None
) -> bool:
    """Met à jour le statut d'un projet studio"""
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if error:
            update_data["error"] = error
        
        if processed_url:
            update_data["processed_url"] = processed_url
        
        if status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc)
            update_data["progress"] = 100
        
        result = await projects_col.update_one(
            {"_id": video_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            # Invalider le cache
            project = await projects_col.find_one({"_id": video_id})
            if project:
                await invalidate_cache(f"studio_project:{project['user_id']}:{video_id}")
            return True
        
        return False
        
    except Exception as e:
        print(f"Error updating studio project status: {e}")
        return False

async def update_studio_project_progress(video_id: str, progress: int) -> bool:
    """Met à jour la progression d'un projet studio"""
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        result = await projects_col.update_one(
            {"_id": video_id},
            {
                "$set": {
                    "progress": progress,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return result.modified_count > 0
        
    except Exception as e:
        print(f"Error updating studio project progress: {e}")
        return False

async def update_studio_project_elements(video_id: str, elements: List[Dict]) -> bool:
    """Met à jour les éléments d'un projet studio"""
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        result = await projects_col.update_one(
            {"_id": video_id},
            {
                "$set": {
                    "elements": elements,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return result.modified_count > 0
        
    except Exception as e:
        print(f"Error updating studio project elements: {e}")
        return False

async def publish_to_smartclips(
    user_id: str,
    video_url: str,
    title: str,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None
) -> Optional[Dict]:
    """Publie une vidéo traitée dans SmartClips"""
    try:
        clips_col = await get_collection('smartclips')
        
        clip_id = str(uuid.uuid4())
        
        clip = {
            "id": clip_id,
            "video_url": video_url,
            "thumbnail_url": None,
            "title": title,
            "description": description,
            "duration": 0,  # À calculer
            "tags": tags or [],
            "source": "user",
            "user_id": user_id,
            "author_name": "Utilisateur Smartix",
            "author_avatar": None,
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "views": 0,
            "liked_by": [],
            "saved_by": [],
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
            "type": "smartclip"
        }
        
        await clips_col.insert_one(clip)
        
        # Invalider les caches
        await invalidate_cache("feed:*")
        await invalidate_cache(f"stats:{user_id}")
        
        return clip
        
    except Exception as e:
        print(f"Error publishing to smartclips: {e}")
        return None

# ========== USER PREFERENCES ==========
async def get_user_preferences(user_id: str) -> Optional[Dict]:
    """Récupérer les préférences utilisateur avec cache"""
    async def _fetch():
        try:
            prefs_col = await get_collection('user_preferences')
            return await prefs_col.find_one({"user_id": user_id})
        except Exception as e:
            print(f"Error getting user preferences: {e}")
            return None
    
    return await get_cached(
        f"prefs:{user_id}",
        _fetch,
        CACHE_TTL["preferences"]
    )

async def set_user_preferences(user_id: str, favorite_tags: List[str]) -> bool:
    """Créer ou mettre à jour les préférences utilisateur"""
    try:
        prefs_col = await get_collection('user_preferences')
        
        clean_tags = [
            tag.strip().lower()
            for tag in favorite_tags
            if tag and len(tag.strip()) < 30
        ][:10]
        
        doc = {
            "user_id": user_id,
            "favorite_tags": clean_tags,
            "last_updated": datetime.now(timezone.utc),
            "onboarding_completed": True
        }
        
        await prefs_col.update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True
        )
        
        await invalidate_cache(f"prefs:{user_id}")
        await invalidate_cache(f"feed:{user_id}:*")
        
        return True
    except Exception as e:
        print(f"Error setting user preferences: {e}")
        return False

# ========== USER PROGRESS ==========
async def get_user_progress(user_id: str) -> Optional[Dict]:
    """Récupérer la progression de l'utilisateur"""
    try:
        progress_col = await get_collection('user_progress')
        return await progress_col.find_one({"user_id": user_id})
    except Exception as e:
        print(f"Error getting user progress: {e}")
        return None

async def update_user_progress(user_id: str, last_watched_index: int) -> bool:
    """Mettre à jour la progression de l'utilisateur"""
    try:
        progress_col = await get_collection('user_progress')
        doc = {
            "user_id": user_id,
            "last_watched_index": last_watched_index,
            "last_watched_timestamp": datetime.now(timezone.utc)
        }
        await progress_col.update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True
        )
        return True
    except Exception as e:
        print(f"Error updating user progress: {e}")
        return False

# ========== WATCHED VIDEOS ==========
async def mark_video_watched(user_id: str, video_id: str) -> bool:
    """Marquer une vidéo comme vue avec transaction"""
    db = await get_db()
    
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                watched_col = await get_collection('watched_videos')
                
                doc = {
                    "user_id": user_id,
                    "video_id": video_id,
                    "watched_at": datetime.now(timezone.utc)
                }
                
                await watched_col.update_one(
                    {"user_id": user_id, "video_id": video_id},
                    {"$set": doc},
                    upsert=True,
                    session=session
                )
                
                progress_col = await get_collection('user_progress')
                await progress_col.update_one(
                    {"user_id": user_id},
                    {
                        "$inc": {"total_watched": 1},
                        "$set": {"last_watched_at": datetime.now(timezone.utc)}
                    },
                    upsert=True,
                    session=session
                )
        
        await invalidate_cache(f"watched:{user_id}")
        await invalidate_cache(f"feed:{user_id}:*")
        await invalidate_cache(f"stats:{user_id}")
        
        return True
    except Exception as e:
        print(f"Error marking video watched: {e}")
        return False

async def get_watched_count(user_id: str) -> int:
    """Compter les vidéos vues par l'utilisateur"""
    async def _fetch():
        try:
            watched_col = await get_collection('watched_videos')
            return await watched_col.count_documents({"user_id": user_id})
        except Exception as e:
            print(f"Error counting watched videos: {e}")
            return 0
    
    return await get_cached(
        f"watched_count:{user_id}",
        _fetch,
        CACHE_TTL["stats"]
    )

async def get_watched_video_ids(user_id: str) -> List[str]:
    """Récupérer les IDs des vidéos vues avec cache"""
    async def _fetch():
        try:
            watched_col = await get_collection('watched_videos')
            watched_docs = await watched_col.find(
                {"user_id": user_id},
                {"video_id": 1}
            ).to_list(10000)
            return [doc["video_id"] for doc in watched_docs]
        except Exception as e:
            print(f"Error getting watched video IDs: {e}")
            return []
    
    return await get_cached(
        f"watched:{user_id}",
        _fetch,
        CACHE_TTL["watched"]
    )

# ========== TAGS ==========
async def get_available_tags() -> List[str]:
    """Récupérer tous les tags disponibles dans la base"""
    async def _fetch():
        try:
            clips_col = await get_collection('smartclips')
            pipeline = [
                {"$unwind": "$tags"},
                {"$group": {"_id": "$tags"}},
                {"$sort": {"_id": 1}},
                {"$limit": 50}
            ]
            result = await clips_col.aggregate(pipeline).to_list(50)
            tags = [doc["_id"] for doc in result if doc["_id"]]
            
            if not tags:
                tags = [
                    "education", "science", "technology", "nature", "art",
                    "music", "sport", "travel", "food", "fashion",
                    "gaming", "news", "business", "health", "comedy"
                ]
            return tags
        except Exception as e:
            print(f"Error getting available tags: {e}")
            return ["education", "science", "technology", "nature", "art"]
    
    return await get_cached(
        "available_tags",
        _fetch,
        CACHE_TTL["tags"]
    )

# ========== VIDEO COUNTS ==========
async def get_total_videos_count() -> int:
    """Compter le nombre total de vidéos en base"""
    async def _fetch():
        try:
            clips_col = await get_collection('smartclips')
            return await clips_col.count_documents({})
        except Exception as e:
            print(f"Error counting videos: {e}")
            return 0
    
    return await get_cached(
        "total_videos_count",
        _fetch,
        CACHE_TTL["stats"]
    )

# ========== PERSONALIZED FEED ==========
async def get_personalized_feed(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    exclude_watched: bool = False
) -> List[Dict]:
    """
    Récupérer le fil personnalisé pour un utilisateur
    """
    cache_key = f"feed:{user_id}:{offset}:{limit}:{exclude_watched}"
    
    async def _fetch_feed():
        try:
            clips_col = await get_collection('smartclips')
            
            prefs_task = get_user_preferences(user_id)
            watched_task = get_watched_video_ids(user_id) if exclude_watched else asyncio.sleep(0)
            
            prefs = await prefs_task
            watched_ids = await watched_task if exclude_watched else []
            
            favorite_tags = prefs.get("favorite_tags", []) if prefs else []
            
            query = {}
            if watched_ids:
                query["id"] = {"$nin": watched_ids}
            
            pipeline = []
            
            if query:
                pipeline.append({"$match": query})
            
            pipeline.append({
                "$addFields": {
                    "priority_score": {
                        "$switch": {
                            "branches": [
                                {"case": {"$eq": ["$source", "user"]}, "then": 0},
                                {"case": {"$eq": ["$user_id", user_id]}, "then": 0},
                                {
                                    "case": {
                                        "$and": [
                                            {"$isArray": "$tags"},
                                            {"$gt": [{"$size": {"$setIntersection": ["$tags", favorite_tags]}}, 0]}
                                        ]
                                    },
                                    "then": {"$ifNull": ["$priority", 1]}
                                }
                            ],
                            "default": {"$ifNull": ["$priority", 10]}
                        }
                    }
                }
            })
            
            pipeline.extend([
                {"$sort": {"priority_score": 1, "created_at": -1}},
                {"$skip": offset},
                {"$limit": limit}
            ])
            
            clips = await clips_col.aggregate(pipeline).to_list(limit)
            
            for clip in clips:
                if '_id' in clip:
                    clip['_id'] = str(clip['_id'])
                if 'id' not in clip:
                    clip['id'] = clip.get('_id', str(uuid.uuid4()))
                if 'liked' not in clip:
                    clip['liked'] = False
                if 'saved' not in clip:
                    clip['saved'] = False
                if 'priority_score' in clip:
                    del clip['priority_score']
            
            return clips
            
        except Exception as e:
            print(f"Error getting personalized feed: {e}")
            return []
    
    if offset == 0:
        return await get_cached(cache_key, _fetch_feed, CACHE_TTL["feed"])
    else:
        return await _fetch_feed()

# ========== SCRAPING MANAGEMENT ==========
async def should_trigger_scraping(user_id: str) -> bool:
    """Vérifier si le scraping doit être déclenché"""
    try:
        total_task = get_total_videos_count()
        watched_task = get_watched_count(user_id)
        
        total_videos = await total_task
        watched_count = await watched_task
        
        if total_videos == 0:
            return True
        
        threshold = min(500, int(total_videos * 0.83))
        
        return watched_count >= threshold
    except Exception as e:
        print(f"Error checking scraping trigger: {e}")
        return False

async def get_scraping_status() -> Dict:
    """Récupérer le statut du scraping en cours"""
    async def _fetch():
        try:
            status_col = await get_collection('scraping_status')
            status = await status_col.find_one({"_id": "current"})
            return status or {
                "status": "idle",
                "scheduled_batches": 0,
                "completed_batches": 0,
                "videos_added": 0,
                "last_run": None
            }
        except Exception as e:
            print(f"Error getting scraping status: {e}")
            return {"status": "idle"}
    
    return await get_cached(
        "scraping_status",
        _fetch,
        30
    )

async def update_scraping_status(status: Dict) -> bool:
    """Mettre à jour le statut du scraping"""
    try:
        status_col = await get_collection('scraping_status')
        status["_id"] = "current"
        status["updated_at"] = datetime.now(timezone.utc)
        await status_col.replace_one({"_id": "current"}, status, upsert=True)
        
        await invalidate_cache("scraping_status")
        
        return True
    except Exception as e:
        print(f"Error updating scraping status: {e}")
        return False

async def check_session_scraping(user_id: str) -> bool:
    """Vérifier si le scraping a déjà été fait dans cette session"""
    try:
        sessions_col = await get_collection('scraping_sessions')
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        session = await sessions_col.find_one({
            "user_id": user_id,
            "date": {"$gte": today}
        })
        return session is not None
    except Exception as e:
        print(f"Error checking session scraping: {e}")
        return False

async def mark_session_scraping_done(user_id: str) -> bool:
    """Marquer le scraping comme fait pour cette session"""
    try:
        sessions_col = await get_collection('scraping_sessions')
        await sessions_col.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "date": datetime.now(timezone.utc),
                    "completed": True
                }
            },
            upsert=True
        )
        return True
    except Exception as e:
        print(f"Error marking session scraping done: {e}")
        return False

# ========== MAINTENANCE ==========
async def precompute_video_scores():
    """Job background pour pré-calculer les scores"""
    try:
        clips_col = await get_collection('smartclips')
        
        result = await clips_col.update_many(
            {},
            [{
                "$set": {
                    "base_score": {
                        "$switch": {
                            "branches": [
                                {"case": {"$eq": ["$source", "user"]}, "then": 0},
                                {"case": {"$eq": ["$source", "pixabay"]}, "then": 5},
                                {"case": {"$eq": ["$source", "pexels"]}, "then": 5},
                                {"case": {"$eq": ["$source", "archiveorg"]}, "then": 8}
                            ],
                            "default": 10
                        }
                    }
                }
            }]
        )
        
        print(f"✅ Scores pré-calculés pour {result.modified_count} vidéos")
        
    except Exception as e:
        print(f"Error precomputing scores: {e}")

async def cleanup_old_data(days: int = 30):
    """Nettoie les données anciennes"""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        sessions_col = await get_collection('scraping_sessions')
        sessions_result = await sessions_col.delete_many({"date": {"$lt": cutoff}})
        
        watched_col = await get_collection('watched_videos')
        watched_result = await watched_col.delete_many({"watched_at": {"$lt": cutoff}})
        
        print(f"🧹 Nettoyage: {sessions_result.deleted_count} sessions, {watched_result.deleted_count} logs")
        
    except Exception as e:
        print(f"Error cleaning up: {e}")

# ========== EXPORT JOB MANAGEMENT ==========

async def save_export_job(
    job_id: str,
    video_id: str,
    user_id: str,
    status: str,
    file_path: Optional[str] = None,
    error: Optional[str] = None
) -> bool:
    """
    Sauvegarde un job d'export vidéo
    """
    try:
        exports_col = await get_collection('smartclips_exports')
        
        export_job = {
            "_id": job_id,
            "video_id": video_id,
            "user_id": user_id,
            "status": status,
            "file_path": file_path,
            "error": error,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await exports_col.update_one(
            {"_id": job_id},
            {"$set": export_job},
            upsert=True
        )
        
        # Invalider le cache
        await invalidate_cache(f"export_job:{user_id}:{job_id}")
        await invalidate_cache(f"export_jobs:{user_id}:*")
        
        return True
        
    except Exception as e:
        print(f"Error saving export job: {e}")
        return False

async def get_export_job(job_id: str, user_id: str) -> Optional[Dict]:
    """
    Récupère un job d'export vidéo
    """
    async def _fetch():
        try:
            exports_col = await get_collection('smartclips_exports')
            job = await exports_col.find_one({"_id": job_id, "user_id": user_id})
            
            if job:
                job['id'] = str(job['_id'])
                del job['_id']
            
            return job
        except Exception as e:
            print(f"Error getting export job: {e}")
            return None
    
    return await get_cached(
        f"export_job:{user_id}:{job_id}",
        _fetch,
        CACHE_TTL["studio_projects"]
    )

async def update_export_job_status(
    job_id: str,
    status: str,
    error: Optional[str] = None,
    file_path: Optional[str] = None
) -> bool:
    """
    Met à jour le statut d'un job d'export
    """
    try:
        exports_col = await get_collection('smartclips_exports')
        
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if error:
            update_data["error"] = error
        
        if file_path:
            update_data["file_path"] = file_path
        
        if status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc)
        
        result = await exports_col.update_one(
            {"_id": job_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            # Invalider le cache
            job = await exports_col.find_one({"_id": job_id})
            if job:
                await invalidate_cache(f"export_job:{job['user_id']}:{job_id}")
            return True
        
        return False
        
    except Exception as e:
        print(f"Error updating export job status: {e}")
        return False

async def get_user_exports(
    user_id: str,
    limit: int = 20,
    offset: int = 0
) -> List[Dict]:
    """
    Récupère la liste des exports d'un utilisateur
    """
    async def _fetch():
        try:
            exports_col = await get_collection('smartclips_exports')
            
            cursor = exports_col.find(
                {"user_id": user_id}
            ).sort("created_at", -1).skip(offset).limit(limit)
            
            exports = await cursor.to_list(limit)
            
            for export in exports:
                export['id'] = str(export['_id'])
                del export['_id']
            
            return exports
            
        except Exception as e:
            print(f"Error getting user exports: {e}")
            return []
    
    if offset == 0:
        return await get_cached(
            f"export_jobs:{user_id}:{limit}:{offset}",
            _fetch,
            CACHE_TTL["studio_projects"]
        )
    else:
        return await _fetch()

# ========== STUDIO PROJECT ELEMENTS UPDATE ==========

async def update_studio_project_audio(
    video_id: str,
    audio_url: Optional[str] = None,
    volume: float = 0.8
) -> bool:
    """
    Met à jour l'audio d'un projet studio
    """
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        update_data = {
            "audio_url": audio_url,
            "volume": volume,
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await projects_col.update_one(
            {"_id": video_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            # Invalider le cache
            project = await projects_col.find_one({"_id": video_id})
            if project:
                await invalidate_cache(f"studio_project:{project['user_id']}:{video_id}")
            return True
        
        return False
        
    except Exception as e:
        print(f"Error updating studio project audio: {e}")
        return False

async def update_studio_project_filter(
    video_id: str,
    filter_type: Optional[str] = None
) -> bool:
    """
    Met à jour le filtre d'un projet studio
    """
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        result = await projects_col.update_one(
            {"_id": video_id},
            {
                "$set": {
                    "filter": filter_type,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.modified_count > 0:
            # Invalider le cache
            project = await projects_col.find_one({"_id": video_id})
            if project:
                await invalidate_cache(f"studio_project:{project['user_id']}:{video_id}")
            return True
        
        return False
        
    except Exception as e:
        print(f"Error updating studio project filter: {e}")
        return False

# ========== CLEANUP FUNCTIONS ==========

async def cleanup_old_exports(days: int = 7) -> int:
    """
    Nettoie les anciens exports et leurs fichiers
    """
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        exports_col = await get_collection('smartclips_exports')
        
        # Récupérer les anciens exports
        old_exports = await exports_col.find({
            "created_at": {"$lt": cutoff},
            "status": {"$in": ["completed", "error"]}
        }).to_list(None)
        
        deleted_count = 0
        
        for export in old_exports:
            # Supprimer le fichier physique s'il existe
            if export.get("file_path") and os.path.exists(export.get("file_path")):
                try:
                    os.remove(export["file_path"])
                except Exception as e:
                    print(f"Error deleting file {export['file_path']}: {e}")
            
            # Supprimer l'entrée en base
            result = await exports_col.delete_one({"_id": export["_id"]})
            if result.deleted_count > 0:
                deleted_count += 1
        
        print(f"🧹 Nettoyage exports: {deleted_count} exports supprimés")
        return deleted_count
        
    except Exception as e:
        print(f"Error cleaning up old exports: {e}")
        return 0

async def cleanup_orphaned_studio_files() -> int:
    """
    Nettoie les fichiers studio orphelins (sans projet associé)
    """
    try:
        projects_col = await get_collection('smartclips_studio_projects')
        
        # Récupérer tous les IDs de projets
        projects = await projects_col.find({}, {"_id": 1}).to_list(None)
        project_ids = set(p["_id"] for p in projects)
        
        deleted_count = 0
        
        # Nettoyer les fichiers uploadés
        for filename in os.listdir(STUDIO_UPLOAD_DIR):
            # Extraire l'ID du projet du nom de fichier
            if '_' in filename:
                video_id = filename.split('_')[0]
                if video_id not in project_ids:
                    file_path = os.path.join(STUDIO_UPLOAD_DIR, filename)
                    try:
                        os.remove(file_path)
                        deleted_count += 1
                        print(f"🗑️ Fichier orphelin supprimé: {filename}")
                    except Exception as e:
                        print(f"Error deleting {filename}: {e}")
        
        # Nettoyer les fichiers traités
        for filename in os.listdir(STUDIO_PROCESSED_DIR):
            if filename.endswith('.mp4'):
                video_id = filename.replace('_processed.mp4', '').replace('_exported.mp4', '')
                if video_id not in project_ids:
                    file_path = os.path.join(STUDIO_PROCESSED_DIR, filename)
                    try:
                        os.remove(file_path)
                        deleted_count += 1
                        print(f"🗑️ Fichier traité orphelin supprimé: {filename}")
                    except Exception as e:
                        print(f"Error deleting {filename}: {e}")
        
        return deleted_count
        
    except Exception as e:
        print(f"Error cleaning orphaned files: {e}")
        return 0

# ========== STATISTIQUES ==========
async def get_user_stats(user_id: str) -> Dict:
    """Récupère les statistiques complètes d'un utilisateur"""
    async def _fetch():
        try:
            watched = await get_watched_count(user_id)
            total = await get_total_videos_count()
            
            prefs = await get_user_preferences(user_id)
            
            return {
                "watched": watched,
                "total": total,
                "progress": round((watched / total * 100) if total > 0 else 0, 2),
                "favorite_tags": prefs.get("favorite_tags", []) if prefs else [],
                "onboarding_completed": prefs.get("onboarding_completed", False) if prefs else False,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            print(f"Error getting user stats: {e}")
            return {
                "watched": 0,
                "total": 0,
                "progress": 0,
                "favorite_tags": [],
                "onboarding_completed": False
            }
    
    return await get_cached(
        f"stats:{user_id}",
        _fetch,
        CACHE_TTL["stats"]
                                    )
