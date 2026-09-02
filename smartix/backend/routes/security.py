from fastapi import APIRouter, Depends, HTTPException, Body, Request, BackgroundTasks
from db import get_db, get_collection, get_db_client as get_mongo_client
from middleware.auth_middleware import get_current_user
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field, validator
import bcrypt
import re
import uuid
import asyncio
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/security", tags=["Security"])
limiter = Limiter(key_func=get_remote_address)

# =============================
# MODELS AVEC VALIDATION
# =============================
class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Le mot de passe doit faire au moins 8 caractères')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Le mot de passe doit contenir une majuscule')
        if not re.search(r"[0-9]", v):
            raise ValueError('Le mot de passe doit contenir un chiffre')
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError('Le mot de passe doit contenir un caractère spécial (!@#$%^&*)')
        return v

class EmailChange(BaseModel):
    new_email: str
    password: str

class DeletionRequest(BaseModel):
    password: str = Field(..., min_length=1)
    confirm: bool = Field(..., description="Confirmation de suppression")

class Session(BaseModel):
    device: str
    location: Optional[str] = None
    user_agent: Optional[str] = None

# =============================
# UTILS
# =============================
async def get_user_by_id(user_id: str):
    users_col = get_collection('users')
    return await users_col.find_one({"id": user_id})

async def update_user_password(user_id: str, new_password: str):
    users_col = get_collection('users')
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await users_col.update_one(
        {"id": user_id},
        {"$set": {"hashed_password": hashed, "updated_at": datetime.utcnow()}}
    )

async def log_security_event(user_id: str, event_type: str, details: dict, ip: str = None):
    logs_col = get_collection('security_logs')
    await logs_col.insert_one({
        "user_id": user_id,
        "event_type": event_type,
        "details": details,
        "ip_address": ip,
        "created_at": datetime.utcnow()
    })

async def delete_user_data_transactionally(user_id: str, session):
    """Supprime toutes les données de l'utilisateur de manière transactionnelle"""
    
    collections_to_clean = [
        ("users", {"id": user_id}),
        ("sessions", {"user_id": user_id}),
        ("posts", {"user_id": user_id}),
        ("comments", {"user_id": user_id}),
        ("likes", {"user_id": user_id}),
        ("saves", {"user_id": user_id}),
        ("followers", {"follower_id": user_id}),
        ("following", {"following_id": user_id}),
        ("notifications", {"user_id": user_id}),
        ("messages", {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]}),
        ("stories", {"user_id": user_id}),
        ("groups_members", {"user_id": user_id}),
        ("group_requests", {"user_id": user_id}),
        ("courses", {"author_id": user_id}),
        ("drafts", {"author_id": user_id}),
        ("marketplace_products", {"seller_id": user_id}),
        ("marketplace_orders", {"$or": [{"buyer_id": user_id}, {"seller_id": user_id}]}),
        ("friend_requests", {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]}),
        ("blocked_users", {"$or": [{"user_id": user_id}, {"blocked_id": user_id}]}),
        ("user_activities", {"user_id": user_id}),
        ("user_preferences", {"user_id": user_id}),
        ("user_progress", {"user_id": user_id}),
        ("watched_videos", {"user_id": user_id}),
        ("video_likes", {"user_id": user_id}),
        ("video_comments", {"user_id": user_id}),
        ("video_saves", {"user_id": user_id}),
        ("news_likes", {"user_id": user_id}),
        ("news_comments", {"user_id": user_id}),
        ("scraping_sessions", {"user_id": user_id}),
        ("favorites", {"user_id": user_id})
    ]
    
    deleted_counts = {}
    
    for collection_name, query in collections_to_clean:
        collection = get_collection(collection_name)
        result = await collection.delete_many(query, session=session)
        if result.deleted_count > 0:
            deleted_counts[collection_name] = result.deleted_count
    
    # Supprimer les fichiers physiques (images, vidéos)
    await delete_user_files(user_id)
    
    return deleted_counts

async def delete_user_files(user_id: str):
    """Supprime les fichiers physiques de l'utilisateur"""
    import os
    import shutil
    
    uploads_dir = f"uploads/users/{user_id}"
    if os.path.exists(uploads_dir):
        try:
            shutil.rmtree(uploads_dir)
        except Exception as e:
            print(f"Error deleting files for user {user_id}: {e}")

# =============================
# ROUTES
# =============================
@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    data: PasswordChange,
    current_user=Depends(get_current_user)
):
    """Change le mot de passe de l'utilisateur"""
    user = await get_user_by_id(current_user["id"])
    
    if not user or not bcrypt.checkpw(
        data.current_password.encode('utf-8'),
        user["hashed_password"].encode('utf-8')
    ):
        await log_security_event(
            current_user["id"],
            "failed_password_change",
            {"reason": "invalid_current_password"},
            ip=request.client.host
        )
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    # Éviter de réutiliser le même mot de passe
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit être différent")
    
    await update_user_password(current_user["id"], data.new_password)
    
    await log_security_event(
        current_user["id"],
        "password_changed",
        {},
        ip=request.client.host
    )
    
    # Invalider toutes les autres sessions
    sessions_col = get_collection('sessions')
    await sessions_col.update_many(
        {"user_id": current_user["id"], "is_current": False},
        {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
    )
    
    return {"message": "Mot de passe mis à jour avec succès"}

def _extract_jti_from_request(request: Request) -> Optional[str]:
    """Décode le JWT du header Authorization et renvoie le `jti`. None si rien."""
    try:
        import jwt as _jwt
        from utils.token_manager import SECRET_KEY, ALGORITHM
        auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
        if not auth.lower().startswith("bearer "):
            return None
        token = auth.split(" ", 1)[1].strip()
        payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("jti")
    except Exception:
        return None


@router.get("/sessions")
async def get_active_sessions(request: Request, current_user=Depends(get_current_user)):
    """Récupère les sessions actives de l'utilisateur.

    `is_current` est calculé dynamiquement en comparant le `jti` du JWT de la
    requête courante avec celui stocké dans chaque doc de session.
    """
    sessions_col = get_collection('sessions')
    current_jti = _extract_jti_from_request(request)

    sessions = await sessions_col.find({
        "user_id": current_user["id"],
        "expires_at": {"$gt": datetime.utcnow()},
        "is_active": {"$ne": False}
    }).sort("last_activity", -1).to_list(100)

    items = [
        {
            "id": str(s["_id"]),
            "device": s.get("device", "Appareil inconnu"),
            "location": s.get("location") or "Localisation inconnue",
            "ip": s.get("ip"),
            "user_agent": s.get("user_agent"),
            "last_activity": s.get("last_activity", s.get("created_at")),
            "created_at": s.get("created_at"),
            "expires_at": s.get("expires_at"),
            "is_current": bool(current_jti and s.get("jti") == current_jti),
        }
        for s in sessions
    ]
    # Session courante en premier
    items.sort(key=lambda x: (not x["is_current"], x["last_activity"] or datetime.min), reverse=False)
    items.sort(key=lambda x: x["is_current"], reverse=True)
    return items

@router.post("/sessions/revoke/{session_id}")
async def revoke_session(
    session_id: str,
    request: Request,
    current_user=Depends(get_current_user)
):
    """Déconnecte une session spécifique (refuse de déconnecter la session courante)."""
    try:
        obj_id = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de session invalide")

    sessions_col = get_collection('sessions')
    session = await sessions_col.find_one({"_id": obj_id, "user_id": current_user["id"]})

    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    current_jti = _extract_jti_from_request(request)
    if current_jti and session.get("jti") == current_jti:
        raise HTTPException(status_code=400, detail="Impossible de déconnecter la session actuelle")

    await sessions_col.update_one(
        {"_id": obj_id},
        {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
    )

    await log_security_event(
        current_user["id"],
        "session_revoked",
        {"session_id": session_id},
        ip=request.client.host
    )

    return {"message": "Session déconnectée"}

@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    request: Request,
    current_user=Depends(get_current_user)
):
    """Déconnecte toutes les sessions sauf celle en cours (identifiée via JWT jti)."""
    sessions_col = get_collection('sessions')
    current_jti = _extract_jti_from_request(request)

    query = {"user_id": current_user["id"], "is_active": {"$ne": False}}
    if current_jti:
        query["jti"] = {"$ne": current_jti}

    result = await sessions_col.update_many(
        query,
        {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
    )
    
    await log_security_event(
        current_user["id"],
        "all_sessions_revoked",
        {"revoked_count": result.modified_count},
        ip=request.client.host
    )
    
    return {"message": f"{result.modified_count} sessions déconnectées"}

@router.post("/account/request-deletion")
@limiter.limit("2/hour")
async def request_account_deletion(
    request: Request,
    data: DeletionRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Demande de suppression de compte avec confirmation email"""
    user = await get_user_by_id(current_user["id"])
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if not bcrypt.checkpw(
        data.password.encode('utf-8'),
        user["hashed_password"].encode('utf-8')
    ):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect")
    
    if not data.confirm:
        raise HTTPException(status_code=400, detail="Veuillez confirmer la suppression")
    
    # Générer token de confirmation
    token = str(uuid.uuid4())
    redis = await get_redis()
    await redis.setex(f"deletion_token:{token}", 86400, current_user["id"])  # 24h
    
    # Envoyer email de confirmation en arrière-plan
    background_tasks.add_task(
        send_deletion_email,
        user["email"],
        token,
        user.get("full_name", "Utilisateur")
    )
    
    await log_security_event(
        current_user["id"],
        "deletion_requested",
        {},
        ip=request.client.host
    )
    
    return {
        "message": "Un email de confirmation a été envoyé",
        "expires_in": 86400,
        "email": user["email"]
    }

@router.delete("/account/confirm/{token}")
async def confirm_account_deletion(
    token: str,
    background_tasks: BackgroundTasks
):
    """Confirme la suppression du compte avec suppression transactionnelle"""
    redis = await get_redis()
    user_id = await redis.get(f"deletion_token:{token}")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    
    # Récupérer l'utilisateur pour l'email de confirmation
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    user_email = user.get("email")
    user_name = user.get("full_name", "Utilisateur")
    
    # Utiliser une transaction pour la suppression
    client = get_mongo_client()
    async with await client.start_session() as session:
        async with session.start_transaction():
            try:
                # Supprimer toutes les données de l'utilisateur
                deleted_counts = await delete_user_data_transactionally(user_id, session)
                
                # Log de suppression
                await log_security_event(user_id, "account_deleted", {
                    "deleted_counts": deleted_counts,
                    "deleted_at": datetime.utcnow().isoformat()
                }, session=session)
                
            except Exception as e:
                print(f"Error during account deletion: {e}")
                raise HTTPException(status_code=500, detail="Erreur lors de la suppression du compte")
    
    # Supprimer le token
    await redis.delete(f"deletion_token:{token}")
    
    # Envoyer email de confirmation de suppression en arrière-plan
    background_tasks.add_task(
        send_deletion_confirmation_email,
        user_email,
        user_name
    )
    
    return {
        "message": "Compte supprimé définitivement",
        "deleted_data": deleted_counts
    }

@router.post("/change-email")
@limiter.limit("3/hour")
async def change_email(
    request: Request,
    data: EmailChange,
    current_user=Depends(get_current_user)
):
    """Change l'email de l'utilisateur"""
    user = await get_user_by_id(current_user["id"])
    
    if not user or not bcrypt.checkpw(
        data.password.encode('utf-8'),
        user["hashed_password"].encode('utf-8')
    ):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect")
    
    users_col = get_collection('users')
    
    # Vérifier si l'email n'est pas déjà utilisé
    existing = await users_col.find_one({"email": data.new_email})
    if existing and existing["id"] != current_user["id"]:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Envoyer email de confirmation
    token = str(uuid.uuid4())
    redis = await get_redis()
    await redis.setex(f"email_change_token:{token}", 3600, {
        "user_id": current_user["id"],
        "new_email": data.new_email
    })
    
    # Envoyer email de confirmation
    await send_email_change_confirmation(user["email"], token, data.new_email)
    
    await log_security_event(
        current_user["id"],
        "email_change_requested",
        {"new_email": data.new_email},
        ip=request.client.host
    )
    
    return {
        "message": "Un email de confirmation a été envoyé à votre nouvelle adresse",
        "expires_in": 3600
    }

@router.post("/email/confirm/{token}")
async def confirm_email_change(token: str):
    """Confirme le changement d'email"""
    redis = await get_redis()
    data = await redis.get(f"email_change_token:{token}")
    
    if not data:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    
    import json
    token_data = json.loads(data)
    user_id = token_data["user_id"]
    new_email = token_data["new_email"]
    
    users_col = get_collection('users')
    
    # Vérifier que l'email n'a pas été pris entre temps
    existing = await users_col.find_one({"email": new_email})
    if existing and existing["id"] != user_id:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    await users_col.update_one(
        {"id": user_id},
        {"$set": {"email": new_email, "email_verified": False, "updated_at": datetime.utcnow()}}
    )
    
    await redis.delete(f"email_change_token:{token}")
    
    await log_security_event(user_id, "email_changed", {"new_email": new_email})
    
    return {"message": "Email mis à jour avec succès"}

# =============================
# FONCTIONS D'ENVOI D'EMAIL (à implémenter)
# =============================
async def send_deletion_email(email: str, token: str, name: str):
    """Envoie un email de confirmation de suppression"""
    # À implémenter avec votre service d'email
    print(f"📧 Envoi email à {email} - Token: {token}")
    # Exemple avec SendGrid, Mailgun, etc.

async def send_deletion_confirmation_email(email: str, name: str):
    """Envoie un email de confirmation de suppression"""
    print(f"📧 Envoi email de confirmation à {email}")
    # À implémenter

async def send_email_change_confirmation(email: str, token: str, new_email: str):
    """Envoie un email de confirmation de changement d'email"""
    print(f"📧 Envoi email de changement d'email à {email} - Token: {token}")
    # À implémenter
