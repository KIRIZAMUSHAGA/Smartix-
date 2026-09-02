"""
Routes de déploiement — Vercel & Netlify

Endpoints :
  POST /api/deploy/vercel   — Déployer sur Vercel
  POST /api/deploy/netlify  — Déployer sur Netlify
  GET  /api/deploy/status   — Statut d'un déploiement
  GET  /api/deploy/logs     — Logs d'un déploiement (Vercel)
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from services.vercel_client import VercelClient, NetlifyClient, VercelError, NetlifyError
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/deploy", tags=["deploy"])

# ─── Modèles ─────────────────────────────────────────────────────────────────

class FileEntry(BaseModel):
    file: str
    data: str

class VercelDeployRequest(BaseModel):
    project_name: str
    files: List[FileEntry]
    token: str
    team_id: Optional[str] = None
    framework: Optional[str] = None

class NetlifyDeployRequest(BaseModel):
    site_name: str
    files: List[FileEntry]
    token: str

class StatusRequest(BaseModel):
    deployment_id: str
    provider: str  # "vercel" | "netlify"
    token: str
    team_id: Optional[str] = None

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/vercel")
async def deploy_to_vercel(
    payload: VercelDeployRequest,
    current_user: dict = Depends(get_current_user),
):
    """Déploie un projet sur Vercel."""
    try:
        client = VercelClient(token=payload.token, team_id=payload.team_id)
        files  = [{"file": f.file, "data": f.data} for f in payload.files]
        result = await client.deploy(payload.project_name, files, payload.framework)
        return {"success": True, **result}
    except VercelError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur déploiement Vercel : {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors du déploiement")


@router.post("/netlify")
async def deploy_to_netlify(
    payload: NetlifyDeployRequest,
    current_user: dict = Depends(get_current_user),
):
    """Déploie un projet sur Netlify."""
    try:
        client = NetlifyClient(token=payload.token)
        files  = [{"file": f.file, "data": f.data} for f in payload.files]
        result = await client.deploy(payload.site_name, files)
        return {"success": True, **result}
    except NetlifyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur déploiement Netlify : {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur lors du déploiement")


@router.get("/status")
async def get_deploy_status(
    deployment_id: str,
    provider: str,
    token: str,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Récupère le statut d'un déploiement."""
    try:
        if provider == "vercel":
            client = VercelClient(token=token, team_id=team_id)
            return await client.get_deployment(deployment_id)
        elif provider == "netlify":
            client = NetlifyClient(token=token)
            return await client.get_deployment(deployment_id)
        else:
            raise HTTPException(status_code=400, detail=f"Provider inconnu : {provider}")
    except (VercelError, NetlifyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur statut déploiement : {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.get("/logs")
async def get_deploy_logs(
    deployment_id: str,
    token: str,
    team_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Récupère les logs d'un déploiement Vercel."""
    try:
        client = VercelClient(token=token, team_id=team_id)
        logs   = await client.get_logs(deployment_id)
        return {"logs": logs}
    except VercelError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur logs déploiement : {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur")
