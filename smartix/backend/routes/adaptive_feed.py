from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from db import get_collection
try:
    from utils.redis_cache import get_cached_feed, set_cached_feed
except ImportError:
    async def get_cached_feed(_key): return None
    async def set_cached_feed(_key, _data, ttl=30): pass
import logging

router = APIRouter(prefix="/api/feed", tags=["feed"])
logger = logging.getLogger(__name__)

class PostThumbnail(BaseModel):
    id: str
    user_id: str
    username: str
    avatar_thumbnail: Optional[str] = None
    content_preview: str
    image_thumbnail: Optional[str] = None
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime

class FeedResponse(BaseModel):
    posts: List[PostThumbnail]
    next_cursor_created_at: Optional[datetime] = None
    next_cursor_id: Optional[str] = None
    limit: int

@router.get("/", response_model=FeedResponse)
async def get_adaptive_feed(
    request: Request,
    cursor_created_at: Optional[datetime] = Query(None),
    cursor_id: Optional[str] = Query(None),
    limit: int = Query(5, ge=5, le=20)
):
    cache_key = f"feed_{cursor_created_at}_{cursor_id}_{limit}"
    try:
        cached = await get_cached_feed(cache_key)
        if cached:
            return cached
    except Exception:
        pass

    posts_col = get_collection('posts')
    users_col = get_collection('users')
    query = {}
    
    if cursor_created_at and cursor_id:
        query = {
            "$or": [
                {"created_at": {"$lt": cursor_created_at}},
                {"created_at": cursor_created_at, "id": {"$lt": cursor_id}}
            ]
        }
    
    try:
        cursor = posts_col.find(query).sort([("created_at", -1), ("id", -1)]).limit(limit)
        rows = await cursor.to_list(length=limit)
        
        # Correction Audit : Récupérer les avatars depuis la collection users
        user_ids = list(set(row.get("user_id") for row in rows if row.get("user_id")))
        users = await users_col.find({"id": {"$in": user_ids}}).to_list(len(user_ids))
        users_map = {u["id"]: u.get("avatar") or u.get("avatar_thumbnail") for u in users}
        
        posts = []
        for row in rows:
            u_id = str(row.get("user_id"))
            # Priorité : avatar stocké dans le post > avatar de l'utilisateur > par défaut
            avatar = row.get("avatar_thumbnail") or users_map.get(u_id)
            
            posts.append(PostThumbnail(
                id=str(row.get("id") or row.get("_id")),
                user_id=u_id,
                username=row.get("username", "Utilisateur"),
                avatar_thumbnail=avatar,
                content_preview=(row.get("content") or "")[:100],
                image_thumbnail=row.get("image_thumbnail") or row.get("media_url"),
                like_count=row.get("like_count") or len(row.get("likes", [])),
                comment_count=row.get("comment_count") or 0,
                created_at=row.get("created_at") or datetime.utcnow()
            ))
        
        res = {
            "posts": [p.dict() for p in posts],
            "next_cursor_created_at": posts[-1].created_at if posts else None,
            "next_cursor_id": posts[-1].id if posts else None,
            "limit": limit
        }
        
        try:
            await set_cached_feed(cache_key, res, ttl=20)
        except Exception:
            pass
            
        return res
        
    except Exception as e:
        logger.error(f"Feed error: {e}")
        raise HTTPException(status_code=503, detail="Service Unavailable")
