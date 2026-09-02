"""
Routes pour la génération d'URLs signées
- URLs de téléchargement
- URLs de preview
- URLs de partage
- URLs temporaires avec expiration
- Version avec JWT et signatures HMAC
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Query, Request
from typing import Optional, List, Dict, Any
import hashlib
import hmac
import time
import os
import uuid
from datetime import datetime, timedelta
import secrets
import json
import jwt
from pydantic import BaseModel, Field

from slowapi import Limiter
from slowapi.util import get_remote_address

from middleware.auth_middleware import get_current_user, get_current_user_optional
from db import get_collection

router = APIRouter(prefix="/api/urls", tags=["URLs"])
limiter = Limiter(key_func=get_remote_address)

# =============================
# CONFIGURATION SÉCURISÉE
# =============================

# ⚠️ CRITIQUE: Vérifier que la clé secrète est définie
SECRET_KEY = os.getenv("URL_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError(
        "URL_SECRET_KEY must be set in environment variables. "
        "Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )

BASE_URL = os.getenv("BASE_URL", "https://api.smartix.com")
CDN_URL = os.getenv("CDN_URL", "https://cdn.smartix.com")
PREVIEW_URL = os.getenv("PREVIEW_URL", "https://preview.smartix.com")

# Durées par défaut (en secondes)
DEFAULT_EXPIRY = 86400  # 24 heures
SHORT_EXPIRY = 3600      # 1 heure
LONG_EXPIRY = 604800     # 7 jours
MAX_URLS_PER_USER = 100  # Limite d'URLs actives par utilisateur

# =============================
# MODÈLES PYDANTIC
# =============================
class DownloadURLRequest(BaseModel):
    file_id: str = Field(..., min_length=1, max_length=100)
    filename: Optional[str] = Field(None, max_length=255)
    expires_in: int = Field(DEFAULT_EXPIRY, ge=60, le=7*24*3600)  # entre 1min et 7 jours
    single_use: bool = False

class PreviewURLRequest(BaseModel):
    project_id: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    expires_in: int = Field(SHORT_EXPIRY, ge=60, le=24*3600)

class ShareURLRequest(BaseModel):
    content: str = Field(..., max_length=10000)
    expires_in: int = Field(LONG_EXPIRY, ge=60, le=30*24*3600)  # max 30 jours
    password: Optional[str] = Field(None, min_length=4, max_length=100)
    max_uses: Optional[int] = Field(None, ge=1, le=1000)

# =============================
# JWT UTILS
# =============================
def create_signed_token(data: dict, expires_in: int) -> str:
    """
    Crée un token JWT signé et sécurisé
    """
    payload = {
        **data,
        "exp": datetime.utcnow() + timedelta(seconds=expires_in),
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4()),
        "iss": "smartix-api",
        "aud": "smartix-urls"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_and_decode_token(token: str) -> Optional[dict]:
    """
    Vérifie et décode un token JWT
    Vérifie aussi la signature et l'expiration
    """
    try:
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=["HS256"],
            audience="smartix-urls",
            issuer="smartix-api"
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# =============================
# SIGNATURE HMAC (pour les URLs)
# =============================
def generate_signature(payload: dict, expires_at: int) -> str:
    """
    Génère une signature HMAC pour sécuriser l'URL
    Utilisée en complément du JWT pour les paramètres d'URL
    """
    # Créer un message unique
    message = f"{payload['type']}:{payload.get('file_id', '')}:{payload.get('project_id', '')}:{expires_at}"
    signature = hmac.new(
        SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature[:16]  # Premiers 16 caractères pour l'URL

def verify_signature(signature: str, payload: dict, expires_at: int) -> bool:
    """
    Vérifie la signature HMAC
    """
    expected = generate_signature(payload, expires_at)
    return hmac.compare_digest(expected, signature)

# =============================
# BASE DE DONNÉES
# =============================
class URLRecord:
    """Enregistrement d'URL en base de données"""
    collection = "urls"
    
    @staticmethod
    async def create(data: dict):
        collection = get_collection(URLRecord.collection)
        data["created_at"] = datetime.utcnow()
        data["access_count"] = 0
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data
    
    @staticmethod
    async def get(token: str):
        collection = get_collection(URLRecord.collection)
        return await collection.find_one({"token": token})
    
    @staticmethod
    async def get_by_file_id(file_id: str, user_id: str):
        collection = get_collection(URLRecord.collection)
        return await collection.find_one({
            "file_id": file_id,
            "user_id": user_id,
            "expires_at": {"$gt": datetime.utcnow()}
        })
    
    @staticmethod
    async def increment_access(token: str):
        collection = get_collection(URLRecord.collection)
        await collection.update_one(
            {"token": token},
            {"$inc": {"access_count": 1}, "$set": {"last_access": datetime.utcnow()}}
        )
    
    @staticmethod
    async def mark_used(token: str):
        collection = get_collection(URLRecord.collection)
        await collection.update_one(
            {"token": token},
            {"$set": {"used": True}}
        )
    
    @staticmethod
    async def count_by_user(user_id: str):
        collection = get_collection(URLRecord.collection)
        return await collection.count_documents({
            "user_id": user_id,
            "expires_at": {"$gt": datetime.utcnow()}
        })

# =============================
# NETTOYAGE AUTOMATIQUE
# =============================
async def cleanup_expired_urls():
    """Supprime les URLs expirées toutes les heures"""
    collection = get_collection(URLRecord.collection)
    result = await collection.delete_many({
        "expires_at": {"$lt": datetime.utcnow()}
    })
    if result.deleted_count > 0:
        print(f"🧹 Nettoyage: {result.deleted_count} URLs expirées supprimées")
    
    # Nettoyer les shares expirés
    shares_col = get_collection("shares")
    shares_result = await shares_col.delete_many({
        "expires_at": {"$lt": datetime.utcnow()}
    })
    if shares_result.deleted_count > 0:
        print(f"🧹 Nettoyage: {shares_result.deleted_count} shares expirés supprimés")

# =============================
# ROUTES
# =============================

@router.post("/download")
@limiter.limit("10/minute")
async def create_download_url(
    request: Request,
    data: DownloadURLRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Crée une URL de téléchargement signée pour un fichier
    """
    # Vérifier la limite d'URLs par utilisateur
    url_count = await URLRecord.count_by_user(current_user["id"])
    if url_count >= MAX_URLS_PER_USER:
        raise HTTPException(
            status_code=429,
            detail=f"Limite de {MAX_URLS_PER_USER} URLs actives atteinte"
        )
    
    # Vérifier que le fichier existe
    files_col = get_collection("uploads")
    file_doc = await files_col.find_one({"id": data.file_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    
    # Vérifier les permissions
    if not file_doc.get("public") and file_doc["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Vérifier qu'il n'y a pas déjà une URL active pour ce fichier
    existing = await URLRecord.get_by_file_id(data.file_id, current_user["id"])
    if existing:
        raise HTTPException(
            status_code=409, 
            detail="Une URL active existe déjà pour ce fichier. Utilisez /revoke pour la supprimer."
        )
    
    # Créer le payload
    expires_at = datetime.utcnow() + timedelta(seconds=data.expires_in)
    expires_timestamp = int(expires_at.timestamp())
    
    payload = {
        "type": "download",
        "file_id": data.file_id,
        "user_id": current_user["id"],
        "filename": data.filename or file_doc.get("filename", "download")
    }
    
    # Générer la signature HMAC
    signature = generate_signature(payload, expires_timestamp)
    
    # Créer le token JWT
    token = create_signed_token(payload, data.expires_in)
    
    # Construire l'URL avec signature
    url = f"{BASE_URL}/api/urls/access/{token}?sig={signature}"
    
    # Enregistrer en base
    await URLRecord.create({
        "token": token,
        "type": "download",
        "file_id": data.file_id,
        "user_id": current_user["id"],
        "expires_at": expires_at,
        "single_use": data.single_use,
        "used": False,
        "signature": signature
    })
    
    return {
        "url": url,
        "token": token,
        "signature": signature,
        "expires_at": expires_at.isoformat(),
        "expires_in": data.expires_in,
        "single_use": data.single_use
    }

@router.post("/preview")
@limiter.limit("20/minute")
async def create_preview_url(
    request: Request,
    data: PreviewURLRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Crée une URL de preview pour un projet
    """
    # Vérifier que le projet existe
    projects_col = get_collection("projects")
    project = await projects_col.find_one({
        "id": data.project_id,
        "userId": current_user["id"]
    })
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Créer le payload
    expires_at = datetime.utcnow() + timedelta(seconds=data.expires_in)
    expires_timestamp = int(expires_at.timestamp())
    session = data.session_id or str(uuid.uuid4())
    
    payload = {
        "type": "preview",
        "project_id": data.project_id,
        "session_id": session,
        "user_id": current_user["id"]
    }
    
    # Générer la signature
    signature = generate_signature(payload, expires_timestamp)
    
    # Créer le token
    token = create_signed_token(payload, data.expires_in)
    
    # Construire l'URL
    url = f"{PREVIEW_URL}/preview/{session}?token={token}&sig={signature}"
    embed_url = f"{PREVIEW_URL}/embed/{session}?token={token}&sig={signature}"
    
    # Enregistrer en base
    await URLRecord.create({
        "token": token,
        "type": "preview",
        "project_id": data.project_id,
        "session_id": session,
        "user_id": current_user["id"],
        "expires_at": expires_at,
        "signature": signature
    })
    
    return {
        "url": url,
        "embed_url": embed_url,
        "token": token,
        "signature": signature,
        "session_id": session,
        "expires_at": expires_at.isoformat(),
        "expires_in": data.expires_in
    }

@router.post("/share")
@limiter.limit("10/minute")
async def create_share_url(
    request: Request,
    data: ShareURLRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Crée une URL de partage pour du contenu texte
    """
    # Créer le payload
    expires_at = datetime.utcnow() + timedelta(seconds=data.expires_in)
    expires_timestamp = int(expires_at.timestamp())
    
    payload = {
        "type": "share",
        "content_hash": hashlib.sha256(data.content.encode()).hexdigest()[:16],
        "user_id": current_user["id"]
    }
    
    # Générer la signature
    signature = generate_signature(payload, expires_timestamp)
    
    # Créer le token
    token = create_signed_token(payload, data.expires_in)
    
    # Stocker le contenu
    shares_col = get_collection("shares")
    
    share_doc = {
        "token": token,
        "content": data.content,
        "has_password": data.password is not None,
        "password_hash": hashlib.sha256(data.password.encode()).hexdigest() if data.password else None,
        "max_uses": data.max_uses,
        "uses": 0,
        "user_id": current_user["id"],
        "expires_at": expires_at,
        "created_at": datetime.utcnow(),
        "signature": signature
    }
    
    await shares_col.insert_one(share_doc)
    
    # Construire l'URL
    url = f"{BASE_URL}/share/{token}?sig={signature}"
    
    return {
        "url": url,
        "token": token,
        "signature": signature,
        "expires_at": expires_at.isoformat(),
        "expires_in": data.expires_in,
        "has_password": data.password is not None,
        "max_uses": data.max_uses
    }

@router.get("/access/{token}")
@limiter.limit("30/minute")
async def access_url(
    request: Request,
    token: str,
    sig: Optional[str] = Query(None),
    password: Optional[str] = Query(None)
):
    """
    Accède à une URL protégée (redirection ou contenu)
    Vérifie la signature JWT + HMAC
    """
    # 1. Vérifier le token JWT
    payload = verify_and_decode_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    # 2. Vérifier la signature HMAC
    expires_timestamp = int(payload["exp"].timestamp())
    if not verify_signature(sig, payload, expires_timestamp):
        raise HTTPException(status_code=401, detail="Signature invalide")
    
    # 3. Récupérer l'enregistrement
    url_record = await URLRecord.get(token)
    
    if not url_record:
        raise HTTPException(status_code=404, detail="URL non trouvée")
    
    # 4. Vérifier l'usage unique
    if url_record.get("single_use") and url_record.get("used"):
        raise HTTPException(status_code=401, detail="URL déjà utilisée")
    
    # 5. Incrémenter le compteur
    await URLRecord.increment_access(token)
    
    # 6. Marquer comme utilisé si single_use
    if url_record.get("single_use"):
        await URLRecord.mark_used(token)
    
    # 7. Rediriger selon le type
    if payload["type"] == "download":
        return {
            "type": "download",
            "file_id": payload["file_id"],
            "filename": payload.get("filename"),
            "url": f"/api/uploads/download/{payload['file_id']}"
        }
    
    elif payload["type"] == "preview":
        return {
            "type": "preview",
            "project_id": payload["project_id"],
            "session_id": payload["session_id"],
            "url": f"{PREVIEW_URL}/preview/{payload['session_id']}"
        }
    
    elif payload["type"] == "share":
        # Récupérer le contenu partagé
        shares_col = get_collection("shares")
        share = await shares_col.find_one({"token": token})
        
        if not share:
            raise HTTPException(status_code=404, detail="Contenu partagé non trouvé")
        
        # Vérifier le mot de passe
        if share.get("has_password"):
            if not password:
                return {"needs_password": True}
            
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            if password_hash != share.get("password_hash"):
                raise HTTPException(status_code=401, detail="Mot de passe incorrect")
        
        # Vérifier le nombre d'utilisations
        if share.get("max_uses") and share.get("uses", 0) >= share["max_uses"]:
            raise HTTPException(status_code=401, detail="Nombre maximum d'utilisations atteint")
        
        # Incrémenter le compteur
        await shares_col.update_one(
            {"token": token},
            {"$inc": {"uses": 1}}
        )
        
        return {
            "type": "share",
            "content": share["content"],
            "uses": share.get("uses", 0) + 1,
            "max_uses": share.get("max_uses")
        }
    
    raise HTTPException(status_code=400, detail="Type d'URL inconnu")

@router.post("/verify")
async def verify_url(
    token: str = Body(...),
    sig: Optional[str] = Body(None)
):
    """
    Vérifie la validité d'une URL sans l'utiliser
    """
    # Vérifier le token JWT
    payload = verify_and_decode_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    
    # Vérifier la signature si fournie
    if sig:
        expires_timestamp = int(payload["exp"].timestamp())
        if not verify_signature(sig, payload, expires_timestamp):
            raise HTTPException(status_code=401, detail="Signature invalide")
    
    return {
        "valid": True,
        "type": payload["type"],
        "expires_at": payload["exp"],
        "payload": {k: v for k, v in payload.items() if k not in ["exp", "iat", "jti", "iss", "aud"]}
    }

@router.delete("/revoke/{token}")
async def revoke_url(
    token: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Révoque une URL (la rend invalide)
    """
    collection = get_collection(URLRecord.collection)
    
    url_record = await collection.find_one({"token": token})
    
    if not url_record:
        raise HTTPException(status_code=404, detail="URL non trouvée")
    
    # Vérifier les permissions
    if url_record.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Supprimer
    await collection.delete_one({"token": token})
    
    # Supprimer aussi les shares associés
    shares_col = get_collection("shares")
    await shares_col.delete_one({"token": token})
    
    return {"success": True}

@router.get("/list")
async def list_urls(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les URLs créées par l'utilisateur
    """
    collection = get_collection(URLRecord.collection)
    
    query = {"user_id": current_user["id"]}
    total = await collection.count_documents(query)
    
    cursor = collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
    urls = await cursor.to_list(length=limit)
    
    # Nettoyer les réponses
    for url in urls:
        url.pop("_id", None)
        if "_id" in url:
            url["id"] = str(url.pop("_id"))
    
    return {
        "urls": urls,
        "total": total,
        "offset": offset,
        "limit": limit
}
