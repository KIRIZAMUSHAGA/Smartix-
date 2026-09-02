from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db_mongo import get_db
from app.services.news_service import list_news, get_news_by_id, add_like, add_comment
from app.schemas import NewsOut, LikeIn
from bson import ObjectId
import json
from datetime import datetime

router = APIRouter()

class NewsOutEncoder:
    @staticmethod
    def encode(doc):
        if doc is None:
            return None
        doc["id"] = str(doc.pop("_id"))
        if doc.get("source_id"):
            doc["source_id"] = str(doc["source_id"])
        return doc

@router.get("/news")
async def get_news(
    limit: int = Query(20, le=100),
    page: int = Query(1, ge=1),
    country: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    try:
        offset = (page - 1) * limit
        # Trié par published_at DESC est géré dans list_news
        items = await list_news(db, limit=limit, offset=offset, country=country, category=category, q=q)
        
        if not items and page == 1:
             try:
                from app.aggregator.aggregator import run_once
                print("📭 News collection empty in router, triggering manual fetch...")
                import asyncio
                from datetime import datetime
                asyncio.create_task(run_once())
                # Return a placeholder if triggering
                placeholder = {
                    "_id": "loading",
                    "title": "Chargement des actualités...",
                    "summary": "Nous récupérons les dernières nouvelles pour vous. Veuillez rafraîchir dans quelques secondes.",
                    "published_at": datetime.utcnow(),
                    "source_name": "Système"
                }
                return {"data": [NewsOutEncoder.encode(placeholder)], "success": True}
             except Exception as e:
                print(f"⚠️ Aggregator fallback error in router: {e}")

        data = [NewsOutEncoder.encode(doc) for doc in items]
        return {"data": data, "success": True}
    except Exception as e:
        print(f"ERROR in get_news: {str(e)}")
        return {"data": [], "success": False, "error": str(e)}

@router.get("/news/{news_id}")
async def get_news_item(news_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        item = await get_news_by_id(db, news_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid news ID")
    
    if not item:
        raise HTTPException(status_code=404, detail="News not found")
    return NewsOutEncoder.encode(item)

@router.post("/news/{news_id}/like")
async def like_news(news_id: str, payload: LikeIn, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        like = await add_like(db, news_id, payload.user_id)
        return {"ok": True, "like_id": str(like["_id"])}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/news/{news_id}/comment")
async def comment_news(news_id: str, payload: Any, db: AsyncIOMotorDatabase = Depends(get_db)):
    try:
        # Simple extraction from payload if CommentIn is missing
        user_id = getattr(payload, 'user_id', None) or payload.get('user_id')
        message = getattr(payload, 'message', None) or payload.get('message')
        comment = await add_comment(db, news_id, user_id, message)
        return {"ok": True, "comment_id": str(comment["_id"])}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
