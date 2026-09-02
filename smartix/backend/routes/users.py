"""User profile routes: GET / PUT / follow.

Mounted at root in server.py (routes already start with /api/users/...).
"""
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from db import get_db
from middleware.auth_middleware import get_current_user
from utils.audit_log import get_client_ip, log_action
from utils.validators import validate_id_string

router = APIRouter(tags=["users"])

# Whitelist of fields a user may update on their own profile.
_EDITABLE_FIELDS = {"full_name", "bio", "avatar", "username", "cover_image", "location", "website"}


def _public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Return only public-safe fields for a user document."""
    return {
        "id": user.get("id"),
        "full_name": user.get("full_name"),
        "username": user.get("username"),
        "avatar": user.get("avatar"),
        "bio": user.get("bio"),
        "cover_image": user.get("cover_image"),
        "location": user.get("location"),
        "website": user.get("website"),
        "created_at": user.get("created_at"),
    }


@router.get("/api/users/{user_id}")
async def get_user_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = validate_id_string(user_id)
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})

    profile = _public_user(user)
    profile["followers_count"] = followers_count
    profile["following_count"] = following_count
    return profile


@router.put("/api/users/{user_id}")
async def update_user_profile(
    user_id: str,
    data: Dict[str, Any],
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    user_id = validate_id_string(user_id)

    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Filter to whitelisted fields only.
    update = {k: v for k, v in (data or {}).items() if k in _EDITABLE_FIELDS}

    # Field-level validation.
    if "full_name" in update:
        name = (update["full_name"] or "").strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name too short (min 2 characters)")
        if len(name) > 100:
            raise HTTPException(status_code=400, detail="Name too long (max 100 characters)")
        update["full_name"] = name

    if "bio" in update and update["bio"] is not None:
        if len(update["bio"]) > 500:
            raise HTTPException(status_code=400, detail="Bio too long (max 500 characters)")

    if "username" in update:
        uname = (update["username"] or "").strip()
        if len(uname) < 3 or len(uname) > 30:
            raise HTTPException(status_code=400, detail="Username must be 3-30 characters")
        existing = await db.users.find_one({"username": uname, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        update["username"] = uname

    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    update["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"id": user_id}, {"$set": update})

    await log_action(
        user_id=current_user["id"],
        action="user.update",
        target_id=user_id,
        ip=get_client_ip(request),
        details={"fields": list(update.keys())},
    )

    return {"success": True}


@router.post("/api/users/{user_id}/follow")
async def follow_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    user_id = validate_id_string(user_id)

    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    db = get_db()
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id,
    })

    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        await log_action(
            user_id=current_user["id"],
            action="user.unfollow",
            target_id=user_id,
            ip=get_client_ip(request),
        )
        return {"followed": False}

    await db.follows.insert_one({
        "follower_id": current_user["id"],
        "following_id": user_id,
        "created_at": datetime.now(timezone.utc),
    })
    await log_action(
        user_id=current_user["id"],
        action="user.follow",
        target_id=user_id,
        ip=get_client_ip(request),
    )
    return {"followed": True}
