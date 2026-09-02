from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from bson.objectid import ObjectId

router = APIRouter(prefix="/api", tags=["comments"])

def get_db():
    from server import db
    return db

@router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    user_id: str,
    comment_type: str,
    content: str,
    parent_comment_id: Optional[str] = None
):
    """Créer un commentaire avec support réactions éducatives"""
    try:
        db = get_db()
        
        # Obtenir les informations du post pour savoir qui notifier
        posts_col = db.posts
        post = await posts_col.find_one({"id": post_id})
        
        comment_doc = {
            "post_id": ObjectId(post_id) if len(post_id) == 24 else post_id,
            "user_id": user_id,
            "type": comment_type,
            "content": content,
            "parent_comment_id": ObjectId(parent_comment_id) if parent_comment_id and len(parent_comment_id) == 24 else parent_comment_id,
            "reactions": {
                "utile": [],
                "pertinent": [],
                "scolaire": [],
                "solidaire": [],
                "expert": []
            },
            "saved_by": [],
            "edited": False,
            "deleted": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db.comments.insert_one(comment_doc)
        
        # Détecter les tags (@username) dans le commentaire
        import re
        mentions = re.findall(r"@(\w+)", content)
        for username in mentions:
            tagged_user = await db.users.find_one({"username": username})
            if tagged_user and tagged_user["id"] != user_id:
                from routes.notifications import create_notification
                actor = await db.users.find_one({"id": user_id})
                await create_notification(
                    user_id=tagged_user["id"],
                    actor_id=user_id,
                    actor_name=actor.get("full_name", "Un utilisateur") if actor else "Un utilisateur",
                    actor_avatar=actor.get("avatar", "") if actor else "",
                    notification_type="mention",
                    content=f"vous a identifié dans un commentaire.",
                    target_id=post_id,
                    priority="high"
                )

        # Notifier l'auteur du post
        if post and post.get("user_id") != user_id:
            from routes.notifications import create_notification
            actor = await db.users.find_one({"id": user_id})
            await create_notification(
                user_id=post["user_id"],
                actor_id=user_id,
                actor_name=actor.get("full_name", "Un utilisateur") if actor else "Un utilisateur",
                actor_avatar=actor.get("avatar", "") if actor else "",
                notification_type="comment",
                content=f"a commenté votre publication : \"{content[:30]}...\"",
                target_id=post_id
            )
        
        return {"success": True, "id": str(result.inserted_id)}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/posts/{post_id}/comments")
async def get_comments(
    post_id: str,
    limit: int = Query(3, ge=1, le=100)
):
    """Récupérer les commentaires d'un post"""
    try:
        db = get_db()
        
        comments = await db.comments.find({
            "post_id": ObjectId(post_id) if len(post_id) == 24 else post_id,
            "deleted": False
        }).sort("created_at", -1).to_list(limit)
        
        result = []
        for comment in comments or []:
            result.append({
                "id": str(comment.get("_id")),
                "user_id": comment.get("user_id"),
                "type": comment.get("type", "text"),
                "content": comment.get("content", ""),
                "reactions": comment.get("reactions", {}),
                "created_at": comment.get("created_at")
            })
        
        return {"success": True, "comments": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/comments/{comment_id}/react")
async def react_to_comment(
    comment_id: str,
    user_id: str,
    reaction_type: str
):
    """Ajouter/retirer une réaction éducative"""
    try:
        db = get_db()
        
        valid_reactions = ["utile", "pertinent", "scolaire", "solidaire", "expert"]
        if reaction_type not in valid_reactions:
            return {"success": False, "error": "Type de réaction invalide"}
        
        comment = db.comments.find_one({"_id": ObjectId(comment_id)})
        if not comment:
            return {"success": False, "error": "Commentaire introuvable"}
        
        reactions = comment.get("reactions", {})
        user_reactions = reactions.get(reaction_type, [])
        
        if user_id in user_reactions:
            # Retirer la réaction
            db.comments.update_one(
                {"_id": ObjectId(comment_id)},
                {"$pull": {f"reactions.{reaction_type}": user_id}}
            )
            action = "removed"
        else:
            # Retirer des autres réactions d'abord
            for rtype in valid_reactions:
                db.comments.update_one(
                    {"_id": ObjectId(comment_id)},
                    {"$pull": {f"reactions.{rtype}": user_id}}
                )
            # Ajouter la nouvelle réaction
            db.comments.update_one(
                {"_id": ObjectId(comment_id)},
                {"$push": {f"reactions.{reaction_type}": user_id}}
            )
            action = "added"
        
        return {"success": True, "action": action}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/comments/{comment_id}/save")
async def save_comment(comment_id: str, user_id: str):
    """Sauvegarder/retirer un commentaire des favoris"""
    try:
        db = get_db()
        
        comment = db.comments.find_one({"_id": ObjectId(comment_id)})
        if not comment:
            return {"success": False, "error": "Commentaire introuvable"}
        
        saved_by = comment.get("saved_by", [])
        
        if user_id in saved_by:
            db.comments.update_one(
                {"_id": ObjectId(comment_id)},
                {"$pull": {"saved_by": user_id}}
            )
            action = "unsaved"
        else:
            db.comments.update_one(
                {"_id": ObjectId(comment_id)},
                {"$push": {"saved_by": user_id}}
            )
            action = "saved"
        
        return {"success": True, "action": action}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/comments/{comment_id}/translate")
async def translate_comment(comment_id: str, target_lang: str = "en"):
    """Traduire un commentaire (simulé pour l'instant)"""
    try:
        db = get_db()
        
        comment = db.comments.find_one({"_id": ObjectId(comment_id)})
        if not comment:
            return {"success": False, "error": "Commentaire introuvable"}
        
        # TODO: Intégrer API de traduction (Google Translate, DeepL, etc.)
        translated = f"[Traduction {target_lang}] {comment.get('content', '')}"
        
        return {
            "success": True, 
            "original": comment.get("content"),
            "translated": translated,
            "lang": target_lang
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.put("/comments/{comment_id}")
async def update_comment(comment_id: str, user_id: str, content: str):
    """Modifier un commentaire"""
    try:
        db = get_db()
        
        db.comments.update_one(
            {"_id": ObjectId(comment_id) if len(comment_id) == 24 else comment_id},
            {"$set": {"content": content, "edited": True}}
        )
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user_id: str):
    """Supprimer un commentaire"""
    try:
        db = get_db()
        
        db.comments.update_one(
            {"_id": ObjectId(comment_id) if len(comment_id) == 24 else comment_id},
            {"$set": {"deleted": True, "content": "[Commentaire supprimé]"}}
        )
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
