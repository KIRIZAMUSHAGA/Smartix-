from fastapi import APIRouter, HTTPException, Query, Depends, Body, BackgroundTasks
from datetime import datetime, timedelta
import os
import json
import asyncio
from typing import Optional, List
from bson.objectid import ObjectId
from middleware.auth_middleware import get_current_user, get_current_user_optional

# Configuration Web Push
try:
    from pywebpush import webpush, WebPushException
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False
    print("⚠️ pywebpush not installed. Run: pip install pywebpush")

router = APIRouter(tags=["notifications"])

# Configuration VAPID (à mettre dans .env)
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS = {
    "sub": "mailto:kirizamushaga01@gmail.com"
}

# =============================
# CONNEXION DB (singleton)
# =============================
_db_instance = None

def get_db():
    global _db_instance
    if _db_instance is None:
        from db import get_db as gdb
        _db_instance = gdb()
    return _db_instance

# =============================
# FONCTION D'ENVOI DE NOTIFICATION PUSH (ASYNC + PARALLÈLE)
# =============================
async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Envoie une notification push à un utilisateur via Web Push (parallélisé)"""
    if not WEBPUSH_AVAILABLE:
        print("⚠️ WebPush not available")
        return False
    
    db = get_db()
    
    # Récupérer tous les tokens de l'utilisateur
    tokens = await db.push_tokens.find({"user_id": user_id}).to_list(length=100)
    
    if not tokens:
        return False
    
    payload = {
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/badge-72.png",
        "data": data or {},
        "vibrate": [200, 100, 200],
        "actions": [
            {"action": "open", "title": "Ouvrir"}
        ]
    }
    
    async def send_one(token_doc):
        """Envoie une notification push à un token spécifique"""
        try:
            subscription_info = token_doc.get("subscription")
            if not subscription_info:
                return False
            
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            return True
        except WebPushException as e:
            # Si le token est expiré (410), le supprimer
            if e.response and e.response.status_code == 410:
                await db.push_tokens.delete_one({"_id": token_doc["_id"]})
                print(f"Removed expired push token for user {user_id}")
            else:
                print(f"WebPush error: {e}")
            return False
    
    # Parallélisation des envois
    results = await asyncio.gather(*[send_one(t) for t in tokens])
    return any(results)

# =============================
# NOTIFICATIONS PUSH
# =============================
@router.post("/notifications/register-token")
async def register_push_token(
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Enregistre un token de notification push pour l'utilisateur"""
    try:
        db = get_db()
        user_id = str(current_user.get("id") or current_user.get("_id"))
        
        subscription = data.get("subscription")
        platform = data.get("platform", "web")
        
        if not subscription:
            raise HTTPException(status_code=400, detail="Subscription data missing")
        
        # Valider la structure de la subscription
        required_fields = ["endpoint", "keys"]
        for field in required_fields:
            if field not in subscription:
                raise HTTPException(status_code=400, detail=f"Missing {field} in subscription")
        
        # Mise à jour avec $setOnInsert pour préserver created_at
        await db.push_tokens.update_one(
            {"user_id": user_id, "endpoint": subscription["endpoint"]},
            {
                "$set": {
                    "subscription": subscription,
                    "platform": platform,
                    "updated_at": datetime.utcnow()
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # Envoyer une notification de test en arrière-plan
        if background_tasks:
            background_tasks.add_task(
                send_push_notification,
                user_id,
                "Notifications activées !",
                "Vous recevrez désormais les alertes importantes.",
                {"type": "welcome"}
            )
        
        return {"success": True, "message": "Token enregistré"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error registering push token: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notifications/unregister-token")
async def unregister_push_token(
    data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Supprime un token de notification push"""
    try:
        db = get_db()
        user_id = str(current_user.get("id") or current_user.get("_id"))
        
        endpoint = data.get("endpoint")
        if not endpoint:
            raise HTTPException(status_code=400, detail="Endpoint missing")
        
        result = await db.push_tokens.delete_one({
            "user_id": user_id,
            "endpoint": endpoint
        })
        
        return {"success": True, "deleted": result.deleted_count}
        
    except Exception as e:
        print(f"Error unregistering push token: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================
# NOTIFICATIONS STANDARD
# =============================
@router.get("/notifications/counts")
async def get_notification_counts(current_user: dict = Depends(get_current_user)):
    """Récupère les compteurs de notifications non lues"""
    try:
        db = get_db()
        user_id = str(current_user.get("id") or current_user.get("_id"))
        unread_count = await db.notifications.count_documents({
            "user_id": user_id, 
            "read": False
        })
        return {"success": True, "unread_count": unread_count}
    except Exception as e:
        print(f"Error getting counts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notifications")
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filter_type: str = Query("all", pattern="^(all|unread|mentions)$"),
    current_user: dict = Depends(get_current_user)
):
    """Récupère les notifications de l'utilisateur avec groupage intelligent"""
    try:
        db = get_db()
        user_id = str(current_user.get("id") or current_user.get("_id"))
        
        query: dict = {"user_id": user_id}
        if filter_type == "unread":
            query["read"] = False
        elif filter_type == "mentions":
            query["priority"] = "high"
        
        # Pipeline d'agrégation optimisé (une seule requête)
        pipeline = [
            {"$match": query},
            {"$sort": {"created_at": -1}},
            {"$facet": {
                "data": [{"$skip": offset}, {"$limit": limit}],
                "total": [{"$count": "count"}]
            }}
        ]
        
        result = await db.notifications.aggregate(pipeline).to_list(length=1)
        notifications = result[0]["data"] if result else []
        total = result[0]["total"][0]["count"] if result and result[0]["total"] else 0
        
        # Groupage des notifications
        grouped = {}
        for notif in notifications:
            key = notif.get("grouping_key", str(notif["_id"]))
            if key not in grouped:
                grouped[key] = {
                    "id": str(notif["_id"]),
                    "user_id": notif["user_id"],
                    "actor_id": notif.get("actor_id"),
                    "actor_name": notif.get("actor_name", ""),
                    "actor_avatar": notif.get("actor_avatar", ""),
                    "type": notif.get("type"),
                    "content": notif.get("content"),
                    "target_id": notif.get("target_id"),
                    "priority": notif.get("priority", "normal"),
                    "read": notif.get("read", False),
                    "created_at": notif.get("created_at"),
                    "actors": [{
                        "id": notif.get("actor_id"),
                        "name": notif.get("actor_name"),
                        "avatar": notif.get("actor_avatar")
                    }] if notif.get("actor_id") else [],
                    "count": 1
                }
            else:
                grouped[key]["count"] += 1
                actor = {
                    "id": notif.get("actor_id"),
                    "name": notif.get("actor_name"),
                    "avatar": notif.get("actor_avatar")
                }
                if actor["id"] and actor["id"] not in [a["id"] for a in grouped[key]["actors"]]:
                    grouped[key]["actors"].append(actor)
        
        return {
            "success": True,
            "notifications": list(grouped.values()),
            "total": total,
            "has_more": offset + limit < total
        }
    except Exception as e:
        print(f"Error getting notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notifications/mark-read")
async def mark_notifications_read(
    ids: List[str] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Marquer des notifications comme lues"""
    try:
        db = get_db()
        user_id = str(current_user.get("id") or current_user.get("_id"))
        
        # Convertir les IDs en ObjectId
        object_ids = []
        for id_str in ids:
            try:
                object_ids.append(ObjectId(id_str))
            except:
                pass
        
        if not object_ids:
            return {"success": True, "modified": 0}
        
        result = await db.notifications.update_many(
            {
                "_id": {"$in": object_ids},
                "user_id": user_id
            },
            {"$set": {"read": True}}
        )
        
        return {"success": True, "modified": result.modified_count}
    except Exception as e:
        print(f"Error marking notifications read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notifications/create")
async def create_notification(
    user_id: str,
    actor_id: str,
    actor_name: str,
    actor_avatar: str,
    notification_type: str,
    content: str,
    target_id: Optional[str] = None,
    priority: str = "normal",
    grouping_key: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Crée une nouvelle notification (authentifié uniquement)"""
    # ✅ SECURITY: Vérifier que l'utilisateur est authentifié
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # ✅ SECURITY: Vérifier que l'utilisateur n'usurpe pas d'identité
    current_user_id = str(current_user.get("id") or current_user.get("_id"))
    if current_user_id != actor_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create notification for another user")
    
    try:
        db = get_db()
        
        # Grouping key amélioré avec date pour regrouper par jour
        today = datetime.utcnow().date()
        final_grouping_key = grouping_key or f"{notification_type}_{target_id}_{today}"
        
        # ✅ Anti-spam: Vérifier les notifications non lues similaires
        existing = await db.notifications.find_one({
            "user_id": user_id,
            "grouping_key": final_grouping_key,
            "read": False
        })
        
        if existing:
            # Incrémenter le compteur au lieu de créer une nouvelle
            await db.notifications.update_one(
                {"_id": existing["_id"]},
                {"$inc": {"count": 1}}
            )
            return {
                "success": True, 
                "id": str(existing["_id"]),
                "updated": True,
                "count": existing.get("count", 1) + 1
            }
        
        # Créer une nouvelle notification
        notification = {
            "user_id": user_id,
            "actor_id": actor_id,
            "actor_name": actor_name,
            "actor_avatar": actor_avatar,
            "type": notification_type,
            "content": content,
            "target_id": target_id,
            "priority": priority,
            "grouping_key": final_grouping_key,
            "read": False,
            "count": 1,
            "created_at": datetime.utcnow()
        }
        
        result = await db.notifications.insert_one(notification)
        
        # Envoyer une notification push en arrière-plan si priorité haute
        if priority == "high":
            # Push ciblé avec nom de l'acteur
            push_title = actor_name
            push_body = content
            background_tasks = BackgroundTasks()
            background_tasks.add_task(
                send_push_notification,
                user_id,
                push_title,
                push_body,
                {"type": notification_type, "target_id": target_id}
            )
            # Note: Les background tasks doivent être gérées par l'appelant
        
        return {"success": True, "id": str(result.inserted_id), "new": True}
    except Exception as e:
        print(f"Error creating notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================
# INDEX À CRÉER EN BASE
# =============================
async def create_notification_indexes():
    """Crée les index nécessaires pour les notifications"""
    db = get_db()
    
    # Index pour les notifications
    await db.notifications.create_index([
        ("user_id", 1),
        ("created_at", -1)
    ])
    
    await db.notifications.create_index([
        ("user_id", 1),
        ("read", 1)
    ])
    
    await db.notifications.create_index([
        ("user_id", 1),
        ("grouping_key", 1)
    ])
    
    await db.notifications.create_index("grouping_key")
    
    # Index pour les tokens push
    await db.push_tokens.create_index([
        ("user_id", 1),
        ("endpoint", 1)
    ], unique=True)
    
    await db.push_tokens.create_index("updated_at", expireAfterSeconds=2592000)  # 30 jours
