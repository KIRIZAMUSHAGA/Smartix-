from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson.objectid import ObjectId
import logging

from db import get_db
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["reactions"])


@router.post("/posts/{post_id}/reactions")
async def toggle_post_reaction(
    post_id: str,
    reaction_type: str,
    current_user: dict = Depends(get_current_user),
):
    """Toggle reaction on a post (auth required)."""
    try:
        db = get_db()
        user_id = current_user["id"]

        posts_col = db.posts
        post = await posts_col.find_one({"id": post_id})

        await db.reactions.insert_one({
            "target_type": "post",
            "target_id": ObjectId(post_id) if len(post_id) == 24 else post_id,
            "user_id": user_id,
            "reaction_type": reaction_type,
            "created_at": datetime.utcnow(),
        })

        # Notify post author (never self-notify)
        if post and post.get("user_id") != user_id:
            from routes.notifications import create_notification
            actor = await db.users.find_one({"id": user_id})
            await create_notification(
                user_id=post["user_id"],
                actor_id=user_id,
                actor_name=actor.get("full_name", "Un utilisateur") if actor else "Un utilisateur",
                actor_avatar=actor.get("avatar", "") if actor else "",
                notification_type="like",
                content="a aimé votre publication.",
                target_id=post_id,
            )

        return {"success": True, "reaction_type": reaction_type}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("toggle_post_reaction error")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.get("/posts/{post_id}/reactions")
async def get_post_reactions(
    post_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get reaction counts for a post (auth required)."""
    try:
        db = get_db()
        reactions = await db.reactions.find({
            "target_id": ObjectId(post_id) if len(post_id) == 24 else post_id,
            "target_type": "post",
        }).to_list(None)

        reaction_counts: dict = {}
        for r in reactions or []:
            rtype = r.get("reaction_type")
            reaction_counts[rtype] = reaction_counts.get(rtype, 0) + 1

        return {"success": True, "reactions": reaction_counts}
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_post_reactions error")
        raise HTTPException(status_code=500, detail="Erreur serveur")


# NOTE: POST /api/posts/{post_id}/share has been removed from this module
# to resolve the duplicate route conflict with backend/routes/posts.py:103
# (which is the canonical, authenticated implementation).


@router.get("/posts/{post_id}/shares")
async def get_post_shares(
    post_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get share count for a post (auth required)."""
    try:
        db = get_db()
        shares = await db.shares.find({
            "original_post_id": ObjectId(post_id) if len(post_id) == 24 else post_id,
        }).to_list(None)

        share_types: dict = {}
        for s in shares or []:
            stype = s.get("share_type")
            share_types[stype] = share_types.get(stype, 0) + 1

        return {"success": True, "shares": share_types}
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_post_shares error")
        raise HTTPException(status_code=500, detail="Erreur serveur")
