"""
Routes de partage — URL publique read-only

Endpoints :
  POST /api/share/create   — Crée un lien de partage read-only pour un projet
  GET  /api/share/{token}  — Récupère les métadonnées d'un projet partagé
  DELETE /api/share/{token} — Révoque un lien de partage
"""

import os
import logging
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/share", tags=["share"])

# ─── Stockage en mémoire (à remplacer par Redis/DB en production) ─────────────

_shares: dict = {}  # share_token -> share_data


# ─── Modèles ─────────────────────────────────────────────────────────────────

class CreateShareRequest(BaseModel):
    project_id:   str
    project_name: str
    expires_in:   Optional[int] = None  # secondes, None = permanent


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/create")
async def create_share_link(
    payload: CreateShareRequest,
    current_user: dict = Depends(get_current_user),
):
    """Crée un lien de partage read-only pour un projet."""
    share_token = secrets.token_urlsafe(24)
    expires_at  = int(time.time()) + payload.expires_in if payload.expires_in else None

    _shares[share_token] = {
        "token":        share_token,
        "project_id":   payload.project_id,
        "project_name": payload.project_name,
        "owner_id":     current_user["id"],
        "owner_name":   current_user.get("username", "Utilisateur"),
        "created_at":   int(time.time()),
        "expires_at":   expires_at,
        "views":        0,
    }

    base_url   = os.environ.get("FRONTEND_URL", "https://smartix.app")
    share_url  = f"{base_url}/preview/{share_token}"

    logger.info(f"Lien partagé créé : {share_token} pour projet {payload.project_id}")

    return {
        "success":     True,
        "share_token": share_token,
        "share_url":   share_url,
        "expires_at":  expires_at,
    }


@router.get("/{share_token}")
async def get_shared_project(share_token: str):
    """
    Récupère les métadonnées d'un projet partagé (accès public, sans auth).
    Incrément le compteur de vues.
    """
    share = _shares.get(share_token)

    if not share:
        raise HTTPException(status_code=404, detail="Lien de partage introuvable")

    # Vérifier l'expiration
    if share["expires_at"] and int(time.time()) > share["expires_at"]:
        del _shares[share_token]
        raise HTTPException(status_code=410, detail="Lien de partage expiré")

    share["views"] += 1

    return {
        "project_id":   share["project_id"],
        "project_name": share["project_name"],
        "owner_name":   share["owner_name"],
        "created_at":   share["created_at"],
        "views":        share["views"],
        "read_only":    True,
    }


@router.delete("/{share_token}")
async def revoke_share_link(
    share_token: str,
    current_user: dict = Depends(get_current_user),
):
    """Révoque un lien de partage (propriétaire uniquement)."""
    share = _shares.get(share_token)

    if not share:
        raise HTTPException(status_code=404, detail="Lien de partage introuvable")

    if share["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le propriétaire de ce projet")

    del _shares[share_token]
    return {"success": True, "message": "Lien de partage révoqué"}


@router.get("/list/mine")
async def list_my_shares(current_user: dict = Depends(get_current_user)):
    """Liste tous les liens de partage créés par l'utilisateur."""
    user_shares = [
        s for s in _shares.values()
        if s["owner_id"] == current_user["id"]
    ]
    return {"shares": user_shares}
