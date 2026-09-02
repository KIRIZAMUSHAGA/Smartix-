from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.db_mongo import get_db
import logging
import httpx
import os

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY")

class TokenRegistration(BaseModel):
    user_id: str
    token: str
    platform: Optional[str] = "android"

class NotificationSendRequest(BaseModel):
    user_id: str
    title: str
    body: str
    data: Optional[dict] = None

class NotificationItem(BaseModel):
    title: str
    body: str
    data: Optional[dict] = None
    read: bool = False
    created_at: datetime

@router.post("/register-token")
async def register_fcm_token(reg: TokenRegistration):
    try:
        db = await get_db()
        await db["fcm_tokens"].update_one(
            {"user_id": reg.user_id},
            {"$addToSet": {"tokens": {"token": reg.token, "platform": reg.platform}}},
            upsert=True
        )
        return {"status": "success", "message": "Token registered successfully"}
    except Exception as e:
        logging.error(f"Error registering FCM token: {e}")
        raise HTTPException(status_code=500, detail="Failed to register token")

@router.post("/send")
async def send_notification(req: NotificationSendRequest):
    if not FCM_SERVER_KEY:
        raise HTTPException(status_code=500, detail="FCM Server Key not configured")
    
    try:
        db = await get_db()
        fcm_data = await db["fcm_tokens"].find_one({"user_id": req.user_id})
        if not fcm_data or not fcm_data.get("tokens"):
            return {"status": "skipped", "message": "No tokens found for user"}

        tokens_data = fcm_data["tokens"]
        results = []
        
        async with httpx.AsyncClient() as client:
            for entry in tokens_data:
                token = entry["token"] if isinstance(entry, dict) else entry
                
                payload = {
                    "to": token,
                    "notification": {
                        "title": req.title,
                        "body": req.body,
                        "sound": "default"
                    },
                    "data": req.data or {}
                }

                response = await client.post(
                    "https://fcm.googleapis.com/fcm/send",
                    headers={
                        "Authorization": f"key={FCM_SERVER_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                results.append(response.json())

        await db["notifications"].insert_one({
            "user_id": req.user_id,
            "title": req.title,
            "body": req.body,
            "data": req.data,
            "read": False,
            "created_at": datetime.utcnow()
        })

        return {"status": "success", "fcm_responses": results}
    except Exception as e:
        logging.error(f"Error sending FCM notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}", response_model=List[NotificationItem])
async def get_notification_history(user_id: str):
    try:
        db = await get_db()
        cursor = db["notifications"].find({"user_id": user_id}).sort("created_at", -1).limit(50)
        history = await cursor.to_list(length=50)
        return history
    except Exception as e:
        logging.error(f"Error fetching notification history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")

@router.put("/mark-read/{notification_id}")
async def mark_notification_read(notification_id: str):
    try:
        from bson import ObjectId
        db = await get_db()
        result = await db["notifications"].update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification")
