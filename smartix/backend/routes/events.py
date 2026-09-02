from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from bson.objectid import ObjectId
from pydantic import BaseModel

router = APIRouter(prefix="/api/events", tags=["events"])

class EventCreate(BaseModel):
    title: str
    description: str
    start_time: datetime
    location: Optional[str] = None
    category: str = "social"

def get_db():
    from server import db
    return db

@router.post("")
async def create_event(event: EventCreate, user_id: str):
    try:
        db = get_db()
        event_doc = event.dict()
        event_doc["creator_id"] = user_id
        event_doc["created_at"] = datetime.utcnow()
        
        result = await db.events.insert_one(event_doc)
        return {"success": True, "id": str(result.inserted_id)}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("")
async def get_events(limit: int = 10):
    try:
        db = get_db()
        events = await db.events.find().sort("start_time", 1).limit(limit).to_list(None)
        return [{"id": str(e["_id"]), **{k: v for k, v in e.items() if k != "_id"}} for e in events]
    except Exception as e:
        return {"success": False, "error": str(e)}
