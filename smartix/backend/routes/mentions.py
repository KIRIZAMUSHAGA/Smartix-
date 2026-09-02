from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pymongo import DESCENDING
import time

router = APIRouter(prefix="/api", tags=["mentions"])

# Simple in-memory cache for trending hashtags
_hashtags_cache = {"data": None, "timestamp": 0, "ttl": 300}

def get_db():
    from server import db
    return db

@router.get("/autocomplete")
async def autocomplete(
    query: str = Query(..., min_length=1),
    trigger: str = Query("@"),
    limit: int = Query(6, ge=1, le=20)
):
    """Autocomplete mentions (@users/@groups) et hashtags (#tags)"""
    try:
        db = get_db()
        results = []
        
        if trigger == "@":
            users = await db.users.find(
                {"$or": [
                    {"name": {"$regex": query, "$options": "i"}},
                    {"username": {"$regex": query, "$options": "i"}}
                ]}
            ).to_list(limit)
            
            for user in users or []:
                results.append({
                    "id": str(user.get("_id", user.get("id"))),
                    "name": user.get("name", ""),
                    "username": user.get("username", ""),
                    "avatar": user.get("avatar_url", ""),
                    "type": "user"
                })
        
        elif trigger == "#":
            hashtags = await db.hashtags.find(
                {"name": {"$regex": query, "$options": "i"}}
            ).sort("count", DESCENDING).to_list(limit)
            
            for tag in hashtags or []:
                results.append({
                    "id": str(tag.get("_id")),
                    "name": tag.get("name", ""),
                    "count": tag.get("count", 0),
                    "type": "hashtag"
                })
        
        return {
            "success": True,
            "query": query,
            "trigger": trigger,
            "results": results[:limit]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/trending/hashtags")
async def trending_hashtags(limit: int = Query(10, ge=1, le=50)):
    """Récupère les hashtags tendance (avec caching 5 min)"""
    try:
        current_time = time.time()
        
        # Check cache
        if _hashtags_cache["data"] and (current_time - _hashtags_cache["timestamp"]) < _hashtags_cache["ttl"]:
            return {"success": True, "hashtags": _hashtags_cache["data"], "source": "cache"}
        
        db = get_db()
        hashtags = await db.hashtags.find().sort("count", DESCENDING).to_list(limit)
        
        results = [{"name": h.get("name", ""), "count": h.get("count", 0)} for h in hashtags or []]
        
        # Update cache
        _hashtags_cache["data"] = results
        _hashtags_cache["timestamp"] = current_time
        
        return {"success": True, "hashtags": results, "source": "fresh"}
    except Exception as e:
        return {"success": False, "error": str(e)}
