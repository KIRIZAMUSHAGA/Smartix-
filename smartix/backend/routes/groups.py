from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging
from middleware.auth_middleware import get_current_user
from db import get_db as get_db_instance

router = APIRouter(tags=["groups"])
logger = logging.getLogger(__name__)

class Group(BaseModel):
    id: str = None
    name: str
    description: Optional[str] = ""
    image: Optional[str] = None
    owner_id: str
    members: List[str] = []
    created_at: datetime = None
    visibility: str = "public"

@router.get("/groups")
async def get_groups(current_user: dict = Depends(get_current_user)):
    """Get user's groups"""
    db = get_db_instance()
    user_id = current_user["id"]
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    groups = await db.groups.find({"id": {"$in": user.get("groups", [])}}).to_list(50)
    return groups

@router.post("/groups")
async def create_group(group: Group, current_user: dict = Depends(get_current_user)):
    """Create a new group"""
    db = get_db_instance()
    user_id = current_user["id"]

    # Validate name length
    name = (group.name or "").strip()
    if len(name) < 3:
        raise HTTPException(status_code=400, detail="Group name too short (min 3 characters)")
    if len(name) > 100:
        raise HTTPException(status_code=400, detail="Group name too long (max 100 characters)")

    # Per-user quota: max 50 owned groups
    user_groups_count = await db.groups.count_documents({"owner_id": user_id})
    if user_groups_count >= 50:
        raise HTTPException(status_code=400, detail="Too many groups (max 50 per user)")

    group_id = str(uuid.uuid4())
    group_data = {
        "id": group_id,
        "name": name,
        "description": group.description,
        "owner_id": user_id,
        "members": [user_id],
        "image": group.image,
        "created_at": datetime.now(timezone.utc),
        "visibility": group.visibility
    }
    await db.groups.insert_one(group_data)
    await db.users.update_one({"id": user_id}, {"$addToSet": {"groups": group_id}})
    return group_data

@router.post("/groups/{group_id}/join")
async def join_group(group_id: str, current_user: dict = Depends(get_current_user)):
    """Join a group (public groups only, or private groups via accepted invitation)."""
    db = get_db_instance()
    user_id = current_user["id"]
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = group.get("members") or []

    # Already a member → 409
    if user_id in members:
        raise HTTPException(status_code=409, detail="Already a member")

    # Group capacity → max 1000 members
    if len(members) >= 1000:
        raise HTTPException(status_code=400, detail="Group is full (max 1000 members)")

    visibility = group.get("visibility", "public")
    if visibility != "public":
        invitation = await db.group_invitations.find_one({
            "group_id": group_id,
            "recipient_id": user_id,
            "status": "pending",
        })
        if not invitation:
            raise HTTPException(
                status_code=403,
                detail="Ce groupe n'est pas public. Une invitation est requise.",
            )

    await db.groups.update_one({"id": group_id}, {"$addToSet": {"members": user_id}})
    await db.users.update_one({"id": user_id}, {"$addToSet": {"groups": group_id}})
    
    # Notifier le propriétaire du groupe
    owner_id = group.get("owner_id")
    if owner_id and owner_id != user_id:
        try:
            from routes.notifications import create_notification
            actor = await db.users.find_one({"id": user_id})
            await create_notification(
                user_id=owner_id,
                actor_id=user_id,
                actor_name=actor.get("full_name", "Un utilisateur") if actor else "Un utilisateur",
                actor_avatar=actor.get("avatar", "") if actor else "",
                notification_type="group_join",
                content=f"a rejoint votre groupe : {group.get('name', '')}.",
                target_id=group_id
            )
        except Exception as e:
            logger.error(f"Error creating notification for group join: {e}")
            
    return {"status": "joined"}

@router.get("/groups/discover")
async def discover_groups(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    """Discover popular public groups (auth required)."""
    limit = max(1, min(limit, 100))
    db = get_db_instance()
    groups = await db.groups.find({"visibility": "public"}).limit(limit).to_list(limit)
    # Don't leak member rosters in discovery list
    for g in groups:
        g.pop("members", None)
    return groups

@router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get group details (auth required; members hidden for non-public groups unless caller is a member)."""
    db = get_db_instance()
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    user_id = current_user["id"]
    is_public = group.get("visibility") == "public"
    is_member = user_id in (group.get("members") or [])
    is_owner = group.get("owner_id") == user_id

    if not (is_public or is_member or is_owner):
        # Hide member roster from outsiders for private/secret groups
        group.pop("members", None)

    return group

@router.get("/groups/invitations/received")
async def get_group_invitations(current_user: dict = Depends(get_current_user)):
    """Get pending group invitations"""
    db = get_db_instance()
    user_id = current_user["id"]
    invitations = await db.group_invitations.find({"recipient_id": user_id, "status": "pending"}).to_list(50)
    return invitations
