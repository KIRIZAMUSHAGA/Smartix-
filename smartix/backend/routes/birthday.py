from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import logging

from db import get_db
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["birthday"])


@router.put("/users/{user_id}/birthday-settings")
async def update_birthday_settings(
    user_id: str,
    notify_friends: bool = True,
    show_age: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Update user birthday notification preferences (owner only)."""
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        db = get_db()
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"birthday_settings": {
                "notify_friends": notify_friends,
                "show_age": show_age,
            }}},
        )
        return {"success": True}
    except Exception:
        logger.exception("update_birthday_settings error")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.get("/users/{user_id}/birthday-settings")
async def get_birthday_settings(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get user birthday notification settings (owner only)."""
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        db = get_db()
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        settings = user.get("birthday_settings", {"notify_friends": True, "show_age": False})
        return {"success": True, "settings": settings}
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_birthday_settings error")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.post("/admin/birthday-reminders-trigger")
async def trigger_birthday_reminders(
    current_user: dict = Depends(get_current_user),
):
    """Manual trigger for birthday reminders (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        db = get_db()
        today = datetime.utcnow()
        day_month = today.strftime("%m-%d")  # MM-DD

        users_with_birthday = await db.users.find({
            "date_of_birth": {"$regex": f".*-{day_month}$"}
        }).to_list(None)

        from routes.notifications import create_notification

        for user in users_with_birthday:
            try:
                post_doc = {
                    "user_id": user["id"],
                    "content": (
                        f"🎉 Joyeux Anniversaire à {user.get('full_name', 'notre membre')} ! "
                        f"🎂✨ Que cette journée soit remplie de bonheur et de réussite. "
                        f"N'hésitez pas à lui laisser un message ! 🎈"
                    ),
                    "type": "birthday_automatic",
                    "media_url": user.get("avatar", ""),
                    "created_at": datetime.utcnow(),
                    "likes": [],
                    "comments_count": 0,
                    "shares_count": 0,
                }
                await db.posts.insert_one(post_doc)
            except Exception:
                logger.exception("Birthday post insert failed")

            for friend_id in user.get("friends", []):
                await create_notification(
                    user_id=friend_id,
                    actor_id=user["id"],
                    actor_name=user.get("full_name", "Un ami"),
                    actor_avatar=user.get("avatar", ""),
                    notification_type="birthday",
                    content="fête son anniversaire aujourd'hui ! Souhaitez-lui un joyeux anniversaire 🎂",
                    target_id=user["id"],
                )

        return {"success": True, "count": len(users_with_birthday)}
    except HTTPException:
        raise
    except Exception:
        logger.exception("trigger_birthday_reminders error")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.get("/users/{user_id}/upcoming-birthdays")
async def get_upcoming_birthdays(
    user_id: str,
    days_ahead: int = 7,
    current_user: dict = Depends(get_current_user),
):
    """Get upcoming birthdays of user's friends (owner only)."""
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        db = get_db()
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        upcoming: list = []
        return {"success": True, "upcoming_birthdays": upcoming}
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_upcoming_birthdays error")
        raise HTTPException(status_code=500, detail="Erreur serveur")
