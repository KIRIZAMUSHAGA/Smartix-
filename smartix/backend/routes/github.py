"""
Routes GitHub — Import (clone) et Export (push)

Endpoints :
  POST /api/github/import  — Clone un dépôt GitHub dans un projet
  POST /api/github/export  — Push un projet vers un dépôt GitHub
  GET  /api/github/repos   — Lister les dépôts de l'utilisateur authentifié
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl
from typing import Optional

from services.git_service import GitHubService, GitServiceError
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/github", tags=["github"])

github_service = GitHubService()

# ─── Modèles de requête ───────────────────────────────────────────────────────

class ImportRequest(BaseModel):
    repo_url: str
    project_name: Optional[str] = None
    branch: str = "main"

class ExportRequest(BaseModel):
    project_id: str
    repo_url: str
    commit_message: str = "Mise à jour via Vibe-Coding"
    branch: str = "main"
    token: str  # Token GitHub de l'utilisateur

class RepoListRequest(BaseModel):
    token: str

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/repos")
async def list_repos(token: str, current_user: dict = Depends(get_current_user)):
    """Lister les dépôts GitHub de l'utilisateur."""
    try:
        repos = await github_service.list_repos(token)
        return {"repos": repos}
    except GitServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur liste repos : {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.post("/import")
async def import_from_github(
    payload: ImportRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Importer un dépôt GitHub dans un nouveau projet Vibe-Coding.
    Retourne l'arborescence des fichiers clonés.
    """
    try:
        result = await github_service.clone_repo(
            repo_url=payload.repo_url,
            user_id=current_user["id"],
            project_name=payload.project_name,
            branch=payload.branch,
        )
        return {
            "success": True,
            "project_id": result["project_id"],
            "files": result["files"],
            "message": f"Dépôt importé avec succès ({len(result['files'])} fichiers)",
        }
    except GitServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur import GitHub : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'import")


@router.post("/export")
async def export_to_github(
    payload: ExportRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Exporter un projet Vibe-Coding vers un dépôt GitHub (push).
    Crée le dépôt s'il n'existe pas encore.
    """
    try:
        result = await github_service.push_project(
            project_id=payload.project_id,
            repo_url=payload.repo_url,
            user_token=payload.token,
            commit_message=payload.commit_message,
            branch=payload.branch,
            user_id=current_user["id"],
        )
        return {
            "success": True,
            "commit_sha": result["commit_sha"],
            "repo_url": result["repo_url"],
            "message": f"Projet exporté avec succès (commit {result['commit_sha'][:7]})",
        }
    except GitServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur export GitHub : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'export")
