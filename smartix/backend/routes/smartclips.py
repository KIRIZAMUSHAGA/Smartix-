"""
SmartixClip Routes - Infinite video scroll API
Version 2.0 avec support scraping et optimisation
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Request, Depends
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
import html
import json
import asyncio
import hashlib
from bson import ObjectId
from collections import defaultdict
import redis.asyncio as aioredis
from pydantic import constr, BaseModel, Field

from db import get_collection, get_db
from app.services.smartclips_service import (
    get_user_preferences as service_get_preferences,
    set_user_preferences as service_set_preferences,
    get_user_progress as service_get_progress,
    update_user_progress as service_update_progress,
    mark_video_watched as service_mark_watched,
    get_watched_count,
    get_total_videos_count,
    get_personalized_feed as service_get_feed,
    should_trigger_scraping,
    get_scraping_status as service_get_status,
    check_session_scraping,
    mark_session_scraping_done,
    get_available_tags
)

# ========== CONFIGURATION ==========
router = APIRouter(prefix="/smartclips", tags=["smartclips"])

SMARTCLIPS_UPLOAD_DIR = "uploads/smartclips"
os.makedirs(SMARTCLIPS_UPLOAD_DIR, exist_ok=True)

# ========== REDIS CACHE ==========
redis_client = None

async def get_redis():
    global redis_client
    if redis_client is None:
        redis_client = await aioredis.from_url(
            "redis://localhost", 
            max_connections=10,
            decode_responses=True
        )
    return redis_client

# ========== RATE LIMITING ==========
request_counts = defaultdict(list)

async def rate_limit(request: Request, max_requests: int = 30, window: int = 60):
    """Rate limiting par IP"""
    client_ip = request.client.host
    now = time.time()
    
    # Nettoyer les anciennes requêtes
    request_counts[client_ip] = [t for t in request_counts[client_ip] if now - t < window]
    
    if len(request_counts[client_ip]) >= max_requests:
        raise HTTPException(
            status_code=429, 
            detail={
                "error": "Too many requests",
                "retry_after": window,
                "message": "Trop de requêtes, réessayez dans {window} secondes"
            }
        )
    
    request_counts[client_ip].append(now)
    return True

# ========== MODÈLES Pydantic ==========
class CommentCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    text: constr(max_length=500, strip_whitespace=True)

class CommentResponse(BaseModel):
    id: str
    clip_id: str
    user_id: str
    user_name: str
    user_avatar: str
    text: str
    likes: int
    created_at: datetime

class ClipResponse(BaseModel):
    id: str
    video_url: str
    thumbnail_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    hashtags: List[str] = []
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0
    liked: bool = False
    saved: bool = False
    author: Dict[str, Any]
    sound: Optional[Dict[str, Any]] = None
    created_at: datetime

# ========== ROUTES EXISTANTES AMÉLIORÉES ==========

@router.get("", response_model=List[ClipResponse])
async def get_smartclips(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    source: Optional[str] = None
):
    """Get SmartClips for infinite feed - paginated with cache"""
    try:
        # Rate limiting
        await rate_limit(request)
        
        # Cache Redis
        redis = await get_redis()
        cache_key = f"clips_page_{page}_{limit}_{source}"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        # MongoDB
        clips_col = get_collection('smartclips')
        skip = (page - 1) * limit
        
        query = {}
        if source and source != "all":
            query["source"] = source
        
        # Pipeline d'agrégation optimisé
        pipeline = [
            {"$match": query},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$addFields": {
                    "liked": {"$in": [request.headers.get("x-user-id", ""), "$liked_by"]},
                    "saved": False  # À améliorer avec les saves de l'utilisateur
                }
            }
        ]
        
        clips = await clips_col.aggregate(pipeline).to_list(limit)
        
        # Transformation des données
        formatted_clips = []
        for clip in clips:
            clip['_id'] = str(clip['_id'])
            if 'id' not in clip:
                clip['id'] = clip['_id']
            
            # Author formatting
            if 'author' not in clip:
                clip['author'] = {
                    "id": clip.get('source', 'smartix').lower(),
                    "name": clip.get('author_name', 'Smartix'),
                    "avatar": clip.get('author_avatar', '/smartix-logo.png'),
                    "following": False
                }
            
            formatted_clips.append(clip)
        
        # Fallback si vide
        if not formatted_clips and page == 1:
            formatted_clips = get_demo_clips()
        
        # Mise en cache pour 5 minutes
        await redis.setex(cache_key, 300, json.dumps(formatted_clips, default=str))
        
        return formatted_clips
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting smartclips: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/sources")
async def get_video_sources(request: Request):
    """Get available video sources with cache"""
    try:
        await rate_limit(request)
        
        redis = await get_redis()
        cache_key = "video_sources"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        sources = [
            {"id": "all", "name": "Tous", "icon": "🎬"},
            {"id": "smartix", "name": "Smartix", "icon": "📚"},
            {"id": "pexels", "name": "Pexels", "icon": "🎥"},
            {"id": "pixabay", "name": "Pixabay", "icon": "🎞️"},
            {"id": "mixkit", "name": "Mixkit", "icon": "🎬"},
            {"id": "archiveorg", "name": "Archive.org", "icon": "📼"},
            {"id": "user", "name": "Utilisateurs", "icon": "👤"},
        ]
        
        await redis.setex(cache_key, 3600, json.dumps(sources))
        return sources
        
    except Exception as e:
        print(f"Error getting sources: {e}")
        return get_demo_sources()

@router.get("/{clip_id}", response_model=ClipResponse)
async def get_smartclip_by_id(clip_id: str, request: Request):
    """Get a single SmartClip by ID"""
    try:
        await rate_limit(request)
        
        clips_col = get_collection('smartclips')
        clip = None
        
        # Recherche par différents formats d'ID
        if ObjectId.is_valid(clip_id):
            clip = await clips_col.find_one({"_id": ObjectId(clip_id)})
        
        if not clip:
            clip = await clips_col.find_one({"id": clip_id})
        
        # Fallback démo
        if not clip:
            demo_clips = get_demo_clips()
            for demo in demo_clips:
                if demo.get('id') == clip_id:
                    return demo
            raise HTTPException(status_code=404, detail="Clip not found")
        
        # Incrémenter les vues
        query = {"id": clip_id}
        if ObjectId.is_valid(clip_id):
            query = {"$or": [{"_id": ObjectId(clip_id)}, {"id": clip_id}]}
        
        await clips_col.update_one(query, {"$inc": {"views": 1}})
        
        # Formatage
        clip['_id'] = str(clip['_id'])
        if 'id' not in clip:
            clip['id'] = clip['_id']
        
        return clip
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting clip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("")
async def create_smartclip(
    request: Request,
    user_id: str = Form(..., min_length=1),
    description: constr(max_length=500) = Form(...),
    hashtags: str = Form(""),
    sound_id: Optional[str] = Form(None),
    video: UploadFile = File(...)
):
    """Create a new SmartClip (user upload)"""
    try:
        await rate_limit(request)
        
        # Validation vidéo
        if not video.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="File must be a video")
        
        if video.size > 100 * 1024 * 1024:  # 100MB max
            raise HTTPException(status_code=400, detail="Video too large (max 100MB)")
        
        clips_col = get_collection('smartclips')
        users_col = get_collection('users')
        
        user = await users_col.find_one({"id": user_id})
        if not user:
            user = {"full_name": "Utilisateur", "avatar": "/default-avatar.png"}
        
        # Génération ID et sauvegarde vidéo
        clip_id = str(uuid.uuid4())
        video_filename = f"{clip_id}.mp4"
        video_path = f"{SMARTCLIPS_UPLOAD_DIR}/{video_filename}"
        
        with open(video_path, "wb") as f:
            content = await video.read()
            f.write(content)
        
        # Traitement hashtags
        hashtag_list = []
        if hashtags:
            hashtag_list = [
                h.strip().lower() 
                for h in hashtags.split(",") 
                if h.strip() and len(h.strip()) < 30
            ][:10]  # Max 10 tags
        
        clip_doc = {
            "id": clip_id,
            "user_id": user_id,
            "video_url": f"/uploads/smartclips/{video_filename}",
            "thumbnail_url": None,  # À générer plus tard
            "description": html.escape(description),
            "title": html.escape(description[:50]) if description else "Mon SmartClip",
            "hashtags": hashtag_list,
            "sound_id": sound_id,
            "source": "user",
            "type": "user",
            "author_name": html.escape(user.get("full_name", "Utilisateur")),
            "author_avatar": user.get("avatar", "/default-avatar.png"),
            "author": {
                "id": user_id,
                "name": html.escape(user.get("full_name", "Utilisateur")),
                "avatar": user.get("avatar", "/default-avatar.png"),
                "following": False
            },
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "views": 0,
            "liked_by": [],
            "saved_by": [],
            "created_at": datetime.now(timezone.utc)
        }
        
        await clips_col.insert_one(clip_doc)
        
        # Invalider le cache
        redis = await get_redis()
        keys = await redis.keys("clips_page_*")
        if keys:
            await redis.delete(*keys)
        
        return {"success": True, "clip_id": clip_id, "clip": clip_doc}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating clip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{clip_id}/like")
async def like_clip(
    clip_id: str, 
    request: Request,
    user_id: str = Form(..., min_length=1)
):
    """Like/unlike a SmartClip with transaction support"""
    try:
        await rate_limit(request)
        
        clips_col = get_collection('smartclips')
        db = get_db()
        
        # Trouver le clip
        clip = None
        query = {"id": clip_id}
        
        if ObjectId.is_valid(clip_id):
            clip = await clips_col.find_one({"_id": ObjectId(clip_id)})
            if clip:
                query = {"_id": ObjectId(clip_id)}
        
        if not clip:
            clip = await clips_col.find_one({"id": clip_id})
            query = {"id": clip_id}
        
        if not clip:
            if clip_id.startswith("demo"):
                return {"success": True, "liked": True, "demo": True}
            raise HTTPException(status_code=404, detail="Clip not found")
        
        # Transaction
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                liked_by = clip.get('liked_by', [])
                is_liked = user_id in liked_by
                
                if is_liked:
                    await clips_col.update_one(
                        query, 
                        {
                            "$pull": {"liked_by": user_id},
                            "$inc": {"likes": -1}
                        },
                        session=session
                    )
                else:
                    await clips_col.update_one(
                        query, 
                        {
                            "$addToSet": {"liked_by": user_id},
                            "$inc": {"likes": 1}
                        },
                        session=session
                    )
                    
                    # Notification au créateur
                    creator_id = clip.get("user_id")
                    if creator_id and creator_id != user_id:
                        try:
                            from routes.notifications import create_notification_db
                            await create_notification_db(
                                user_id=creator_id,
                                actor_id=user_id,
                                notification_type="like",
                                content="a aimé votre clip",
                                target_id=clip_id,
                                session=session
                            )
                        except Exception as e:
                            print(f"Notification error: {e}")
        
        return {"success": True, "liked": not is_liked}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error liking clip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{clip_id}/save")
async def save_clip(
    clip_id: str, 
    request: Request,
    user_id: str = Form(..., min_length=1)
):
    """Save a SmartClip to user's collection"""
    try:
        await rate_limit(request)
        
        users_col = get_collection('users')
        
        user = await users_col.find_one({"id": user_id})
        if not user:
            user = await users_col.find_one({"_id": user_id})
        
        if not user:
            # Mode démo
            return {"success": True, "saved": True}
        
        saved_clips = user.get('saved_clips', [])
        is_saved = clip_id in saved_clips
        
        query = {"id": user_id}
        if user.get('_id'):
            query = {"_id": user.get('_id')}
        
        if is_saved:
            await users_col.update_one(query, {"$pull": {"saved_clips": clip_id}})
        else:
            await users_col.update_one(query, {"$addToSet": {"saved_clips": clip_id}})
        
        # Invalider cache utilisateur
        redis = await get_redis()
        await redis.delete(f"user_saved_{user_id}")
        
        return {"success": True, "saved": not is_saved}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving clip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{clip_id}/share")
async def share_clip(clip_id: str, request: Request):
    """Increment share count"""
    try:
        await rate_limit(request)
        
        if clip_id.startswith("demo"):
            return {"success": True, "demo": True}
        
        clips_col = get_collection('smartclips')
        
        query = {"id": clip_id}
        if ObjectId.is_valid(clip_id):
            query = {"$or": [{"_id": ObjectId(clip_id)}, {"id": clip_id}]}
        
        await clips_col.update_one(query, {"$inc": {"shares": 1}})
        
        return {"success": True}
        
    except Exception as e:
        print(f"Error sharing clip: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{clip_id}/comment", response_model=CommentResponse)
async def add_comment(
    clip_id: str, 
    request: Request,
    comment: CommentCreate
):
    """Add a comment to a SmartClip"""
    try:
        await rate_limit(request)
        
        # Validation et échappement
        safe_text = html.escape(comment.text)
        
        comments_col = get_collection('smartclip_comments')
        clips_col = get_collection('smartclips')
        users_col = get_collection('users')
        
        user = await users_col.find_one({"id": comment.user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        comment_doc = {
            "id": str(uuid.uuid4()),
            "clip_id": clip_id,
            "user_id": comment.user_id,
            "user_name": html.escape(user.get("full_name", "Utilisateur")),
            "user_avatar": user.get("avatar", "/default-avatar.png"),
            "text": safe_text,
            "likes": 0,
            "liked_by": [],
            "created_at": datetime.now(timezone.utc)
        }
        
        await comments_col.insert_one(comment_doc)
        
        # Incrémenter compteur
        if not clip_id.startswith("demo"):
            query = {"id": clip_id}
            if ObjectId.is_valid(clip_id):
                query = {"$or": [{"_id": ObjectId(clip_id)}, {"id": clip_id}]}
            await clips_col.update_one(query, {"$inc": {"comments": 1}})
        
        comment_doc['_id'] = str(comment_doc.get('_id', ''))
        return comment_doc
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding comment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{clip_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    clip_id: str, 
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50)
):
    """Get comments for a SmartClip with pagination"""
    try:
        await rate_limit(request)
        
        # Cache Redis
        redis = await get_redis()
        cache_key = f"comments_{clip_id}_{skip}_{limit}"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        comments_col = get_collection('smartclip_comments')
        
        comments = await comments_col.find(
            {"clip_id": clip_id}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        for comment in comments:
            if '_id' in comment:
                comment['_id'] = str(comment['_id'])
        
        # Cache pour 2 minutes
        await redis.setex(cache_key, 120, json.dumps(comments, default=str))
        
        return comments
        
    except Exception as e:
        print(f"Error getting comments: {e}")
        return []

@router.post("/aggregate")
async def trigger_aggregation(request: Request):
    """Manually trigger video aggregation from external sources"""
    try:
        await rate_limit(request, max_requests=5)  # Limite plus stricte
        
        from app.services.video_aggregator import run_video_aggregation
        count = await run_video_aggregation()
        
        # Invalider tout le cache
        redis = await get_redis()
        await redis.flushdb()
        
        return {"success": True, "videos_added": count}
        
    except Exception as e:
        print(f"Aggregation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== NOUVELLES ROUTES V2 ==========

@router.get("/v2/onboarding-required")
async def check_onboarding_required(
    request: Request,
    user_id: str = Query(..., min_length=1)
):
    """Vérifie si l'utilisateur doit faire l'onboarding"""
    try:
        await rate_limit(request)
        
        prefs = await service_get_preferences(user_id)
        return {"required": not prefs or not prefs.get("onboarding_completed", False)}
        
    except Exception as e:
        print(f"Error checking onboarding: {e}")
        return {"required": False}

@router.get("/v2/feed")
async def get_personalized_feed(
    request: Request,
    user_id: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    exclude_watched: bool = Query(False)
):
    """Fil personnalisé avec priorisation"""
    try:
        await rate_limit(request)
        
        # Cache Redis
        redis = await get_redis()
        cache_key = f"feed_v2_{user_id}_{offset}_{limit}_{exclude_watched}"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        clips = await service_get_feed(
            user_id=user_id,
            limit=limit,
            offset=offset,
            exclude_watched=exclude_watched
        )
        
        response = {
            "clips": clips,
            "offset": offset,
            "next_offset": offset + limit,
            "has_more": len(clips) == limit,
            "count": len(clips)
        }
        
        # Cache pour 2 minutes
        await redis.setex(cache_key, 120, json.dumps(response, default=str))
        
        return response
        
    except Exception as e:
        print(f"Error getting feed: {e}")
        # Fallback sur route v1
        page = (offset // limit) + 1
        return await get_smartclips(request, page=page, limit=limit)

@router.post("/v2/trigger-scraping")
async def trigger_scraping(
    request: Request,
    user_id: Optional[str] = Form(None)
):
    """Déclenche le scraping en arrière-plan"""
    try:
        await rate_limit(request, max_requests=3)  # 3 fois par minute max
        
        # Vérifier si déjà fait aujourd'hui
        if user_id:
            already_done = await check_session_scraping(user_id)
            if already_done:
                return {
                    "success": False, 
                    "reason": "already_done_today",
                    "message": "Scraping déjà effectué aujourd'hui"
                }
        
        # Lancer en background
        asyncio.create_task(run_background_scraping(user_id))
        
        return {
            "success": True, 
            "message": "Scraping démarré en arrière-plan",
            "estimated_time": "2-3 minutes"
        }
        
    except Exception as e:
        print(f"Error triggering scraping: {e}")
        return {"success": False, "error": str(e)}

@router.get("/v2/scraping-status")
async def get_scraping_status(request: Request):
    """Récupère le statut du scraping en cours"""
    try:
        await rate_limit(request)
        
        status = await service_get_status()
        
        # Cache Redis pour réduire les appels
        redis = await get_redis()
        cache_key = "scraping_status"
        
        if not status or status.get("status") == "idle":
            cached = await redis.get(cache_key)
            if cached:
                return JSONResponse(content=json.loads(cached))
        
        response = status or {
            "status": "idle",
            "scheduled_batches": 0,
            "completed_batches": 0,
            "videos_added": 0
        }
        
        await redis.setex(cache_key, 30, json.dumps(response, default=str))  # 30s cache
        
        return response
        
    except Exception as e:
        print(f"Error getting status: {e}")
        return {"status": "unknown"}

@router.post("/v2/progress")
async def update_progress(
    request: Request,
    user_id: str = Form(..., min_length=1),
    last_watched_index: int = Form(..., ge=0)
):
    """Met à jour la progression de l'utilisateur"""
    try:
        await rate_limit(request)
        
        success = await service_update_progress(user_id, last_watched_index)
        return {"success": success}
        
    except Exception as e:
        print(f"Error updating progress: {e}")
        return {"success": False}

@router.get("/v2/progress")
async def get_progress(
    request: Request,
    user_id: str = Query(..., min_length=1)
):
    """Récupère la progression de l'utilisateur"""
    try:
        await rate_limit(request)
        
        progress = await service_get_progress(user_id)
        return progress or {"last_watched_index": 0}
        
    except Exception as e:
        print(f"Error getting progress: {e}")
        return {"last_watched_index": 0}

@router.post("/v2/watched")
async def mark_watched(
    request: Request,
    user_id: str = Form(..., min_length=1),
    video_id: str = Form(..., min_length=1)
):
    """Marque une vidéo comme vue"""
    try:
        await rate_limit(request)
        
        success = await service_mark_watched(user_id, video_id)
        
        if success:
            # Invalider le cache du feed
            redis = await get_redis()
            keys = await redis.keys(f"feed_v2_{user_id}_*")
            if keys:
                await redis.delete(*keys)
        
        return {"success": success}
        
    except Exception as e:
        print(f"Error marking watched: {e}")
        return {"success": False}

@router.get("/v2/stats")
async def get_stats(
    request: Request,
    user_id: str = Query(..., min_length=1)
):
    """Récupère les statistiques de l'utilisateur"""
    try:
        await rate_limit(request)
        
        # Cache Redis
        redis = await get_redis()
        cache_key = f"stats_{user_id}"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        watched = await get_watched_count(user_id)
        total = await get_total_videos_count()
        
        response = {
            "watched": watched,
            "total": total,
            "progress": round((watched / total * 100) if total > 0 else 0, 2)
        }
        
        # Cache pour 10 minutes
        await redis.setex(cache_key, 600, json.dumps(response))
        
        return response
        
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {"watched": 0, "total": 0, "progress": 0}

@router.post("/v2/preferences")
async def set_preferences(
    request: Request,
    user_id: str = Form(..., min_length=1),
    favorite_tags: List[str] = Form(...)
):
    """Enregistre les préférences de l'utilisateur"""
    try:
        await rate_limit(request)
        
        # Nettoyer les tags
        clean_tags = [
            tag.strip().lower()
            for tag in favorite_tags
            if tag and len(tag.strip()) < 30
        ][:10]  # Max 10 tags
        
        success = await service_set_preferences(user_id, clean_tags)
        
        if success:
            # Invalider le cache
            redis = await get_redis()
            await redis.delete(f"prefs_{user_id}")
            await redis.delete(f"feed_v2_{user_id}_*")
        
        return {"success": success}
        
    except Exception as e:
        print(f"Error setting preferences: {e}")
        return {"success": False}

@router.get("/v2/preferences")
async def get_preferences(
    request: Request,
    user_id: str = Query(..., min_length=1)
):
    """Récupère les préférences de l'utilisateur"""
    try:
        await rate_limit(request)
        
        # Cache Redis
        redis = await get_redis()
        cache_key = f"prefs_{user_id}"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        prefs = await service_get_preferences(user_id)
        response = prefs or {"favorite_tags": []}
        
        # Cache pour 30 minutes
        await redis.setex(cache_key, 1800, json.dumps(response, default=str))
        
        return response
        
    except Exception as e:
        print(f"Error getting preferences: {e}")
        return {"favorite_tags": []}

@router.get("/v2/available-tags")
async def available_tags(request: Request):
    """Récupère tous les tags disponibles"""
    try:
        await rate_limit(request)
        
        # Cache Redis
        redis = await get_redis()
        cache_key = "available_tags"
        
        cached = await redis.get(cache_key)
        if cached:
            return JSONResponse(content=json.loads(cached))
        
        tags = await get_available_tags()
        
        # Cache pour 1 heure
        await redis.setex(cache_key, 3600, json.dumps(tags))
        
        return {"tags": tags}
        
    except Exception as e:
        print(f"Error getting tags: {e}")
        return {"tags": []}

# ========== FONCTIONS UTILITAIRES ==========

async def run_background_scraping(user_id: Optional[str] = None):
    """Exécute le scraping en arrière-plan"""
    try:
        from app.services.pixabay_scraper import PixabayScraper
        
        scraper = PixabayScraper()
        result = await scraper.scrape_incremental(pages=5, delay=2.0)
        
        if user_id and result.get("videos_added", 0) > 0:
            await mark_session_scraping_done(user_id)
        
        # Mettre à jour le statut
        status_col = get_collection('scraping_status')
        await status_col.update_one(
            {"_id": "current"},
            {
                "$set": {
                    "status": "idle",
                    "last_run": datetime.now(timezone.utc),
                    "videos_added": result.get("videos_added", 0),
                    "updated_at": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        # Invalider le cache
        redis = await get_redis()
        await redis.flushdb()
        
    except Exception as e:
        print(f"Background scraping error: {e}")

def get_demo_clips():
    """Return demo clips when database is empty"""
    return [
        {
            "id": "demo1",
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
            "title": "Bienvenue sur SmartixClip!",
            "description": "Découvrez des vidéos éducatives et divertissantes",
            "hashtags": ["smartclips", "demo", "bienvenue"],
            "likes": 150,
            "comments": 42,
            "shares": 23,
            "views": 1200,
            "liked": False,
            "saved": False,
            "source": "smartix",
            "author": {
                "id": "smartix",
                "name": "Smartix",
                "avatar": "/smartix-logo.png",
                "following": False
            },
            "sound": {"name": "Original Sound - Smartix"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "demo2",
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
            "title": "Apprenez en vous amusant",
            "description": "Vidéos courtes pour un apprentissage rapide",
            "hashtags": ["creation", "edit", "video"],
            "likes": 89,
            "comments": 15,
            "shares": 8,
            "views": 567,
            "liked": False,
            "saved": False,
            "source": "smartix",
            "author": {
                "id": "smartix",
                "name": "Smartix",
                "avatar": "/smartix-logo.png",
                "following": False
            },
            "sound": {"name": "Trending Sound"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "demo3",
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg",
            "title": "Explorez de nouvelles connaissances",
            "description": "Du contenu frais chaque jour",
            "hashtags": ["pro", "editing", "tools"],
            "likes": 234,
            "comments": 67,
            "shares": 45,
            "views": 2100,
            "liked": False,
            "saved": False,
            "source": "smartix",
            "author": {
                "id": "smartix",
                "name": "Smartix",
                "avatar": "/smartix-logo.png",
                "following": False
            },
            "sound": {"name": "Epic Sound"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "demo4",
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg",
            "title": "Partagez vos moments",
            "description": "Créez et partagez vos propres clips",
            "hashtags": ["share", "community", "moments"],
            "likes": 178,
            "comments": 34,
            "shares": 29,
            "views": 1567,
            "liked": False,
            "saved": False,
            "source": "smartix",
            "author": {
                "id": "smartix",
                "name": "Smartix",
                "avatar": "/smartix-logo.png",
                "following": False
            },
            "sound": {"name": "Chill Vibes"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "demo5",
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
            "title": "Big Buck Bunny",
            "description": "Animation open source classique",
            "hashtags": ["animation", "blender", "opensource"],
            "likes": 456,
            "comments": 89,
            "shares": 67,
            "views": 3400,
            "liked": False,
            "saved": False,
            "source": "archiveorg",
            "author": {
                "id": "archiveorg",
                "name": "Internet Archive",
                "avatar": "https://archive.org/images/glogo.png",
                "following": False
            },
            "sound": {"name": "Cinematic"},
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]

def get_demo_sources():
    """Return demo sources"""
    return [
        {"id": "all", "name": "Tous", "icon": "🎬"},
        {"id": "smartix", "name": "Smartix", "icon": "📚"},
        {"id": "archiveorg", "name": "Archive.org", "icon": "📼"},
        ]
