from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)

@router.get("")
async def get_notifications(user_id: str, db, skip: int = 0, limit: int = 50):
    """Get user's notifications"""
    notifications = await db.notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return notifications

@router.delete("/{notification_id}")
async def delete_notification(user_id: str, notification_id: str, db):
    """Delete a notification"""
    notif = await db.notifications.find_one({"id": notification_id})
    if not notif or notif.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.notifications.delete_one({"id": notification_id})
    return {"status": "deleted"}

@router.post("/{notification_id}/click")
async def click_notification(user_id: str, notification_id: str, db):
    """Mark notification as clicked"""
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"clicked": True, "clicked_at": datetime.now(timezone.utc)}}
    )
    return {"status": "clicked"}

@router.get("/{notification_id}")
async def get_notification(user_id: str, notification_id: str, db):
    """Get a specific notification"""
    notif = await db.notifications.find_one({"id": notification_id})
    if not notif or notif.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif
