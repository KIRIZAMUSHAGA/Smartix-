"""
Routes pour la gestion des utilisateurs bloqués
================================================

Version canonique - supprime correctement les relations d'amitié
en utilisant la structure (user_low_id, user_high_id).
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Tuple
from datetime import datetime, timezone
import logging
from middleware.auth_middleware import get_current_user
from db import get_db

router = APIRouter(prefix="/api/blocked-users", tags=["blocked-users"])
logger = logging.getLogger(__name__)


def get_canonical_pair(id_a: str, id_b: str) -> Tuple[str, str]:
    """Retourne la paire canonique (user_low_id, user_high_id)"""
    if id_a < id_b:
        return (id_a, id_b)
    return (id_b, id_a)


@router.get("")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """Get list of blocked users"""
    db = get_db()
    user_id = current_user["id"]
    
    blocked_entries = await db.user_blocks.find({"user_id": user_id, "status": "blocked"}).to_list(100)
    
    results = []
    for entry in blocked_entries:
        target = await db.users.find_one({"id": entry["blocked_id"]})
        if target:
            results.append({
                "id": target["id"],
                "username": target.get("username"),
                "avatar": target.get("avatar"),
                "full_name": target.get("full_name"),
                "blocked_at": entry.get("created_at")
            })
    
    results.sort(key=lambda x: x["blocked_at"] or datetime.min, reverse=True)
    return results


@router.post("/unblock/{blocked_id}")
async def unblock_user(blocked_id: str, current_user: dict = Depends(get_current_user)):
    """Unblock a user"""
    db = get_db()
    user_id = current_user["id"]
    
    await db.user_blocks.delete_one({"user_id": user_id, "blocked_id": blocked_id})
    await db.users.update_one(
        {"id": user_id},
        {"$pull": {"blocked_users": blocked_id}}
    )
    return {"status": "unblocked"}


@router.post("/{blocked_user_id}")
async def block_user(blocked_user_id: str, current_user: dict = Depends(get_current_user)):
    """Block a user - supprime également toute relation d'amitié canonique"""
    db = get_db()
    user_id = current_user["id"]
    
    if user_id == blocked_user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous bloquer vous-même")
        
    now = datetime.now(timezone.utc)
    
    await db.user_blocks.update_one(
        {"user_id": user_id, "blocked_id": blocked_user_id},
        {"$set": {"status": "blocked", "created_at": now}},
        upsert=True
    )
    
    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"blocked_users": blocked_user_id}}
    )
    
    await db.users.update_one(
        {"id": user_id}, 
        {"$pull": {
            "friends": blocked_user_id, 
            "friend_requests_sent": blocked_user_id, 
            "friend_requests_received": blocked_user_id
        }}
    )
    await db.users.update_one(
        {"id": blocked_user_id}, 
        {"$pull": {
            "friends": user_id, 
            "friend_requests_sent": user_id, 
            "friend_requests_received": user_id
        }}
    )
    
    low_id, high_id = get_canonical_pair(user_id, blocked_user_id)
    await db.friend_requests.delete_one({
        "user_low_id": low_id,
        "user_high_id": high_id
    })
    
    return {"status": "blocked"}
