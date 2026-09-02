"""
Routes Sprint 7+ — Variables d'environnement par projet (secrets .env)

Toutes les valeurs sont chiffrées côté serveur (Fernet/AES-128)
avant persistance en base de données.
"""

from typing import Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, validator

from middleware.auth_middleware import get_current_user
from services.env_manager import env_manager

router = APIRouter(prefix="/api/projects", tags=["Env Variables"])

ENV_KEY_PATTERN = r'^[A-Z_][A-Z0-9_]*$'


# ─── Schémas ────────────────────────────────────────────────────────────────

class EnvVarRequest(BaseModel):
    key: str
    value: str

    @validator('key')
    def key_format(cls, v):
        import re
        v = v.strip().upper()
        if not re.match(r'^[A-Z_][A-Z0-9_]*$', v):
            raise ValueError("La clé doit être en majuscules (ex: DATABASE_URL)")
        return v


class BulkEnvRequest(BaseModel):
    vars: Dict[str, str]


class DotEnvImportRequest(BaseModel):
    content: str


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/{project_id}/env")
async def list_env_vars(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste toutes les clés de variables d'environnement du projet.
    Les valeurs ne sont PAS retournées (sécurité).
    """
    try:
        keys = await env_manager.list_keys(project_id)
        return {"project_id": project_id, "vars": keys, "count": len(keys)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/env")
async def set_env_var(
    project_id: str,
    payload: EnvVarRequest,
    current_user: dict = Depends(get_current_user)
):
    """Crée ou met à jour une variable d'environnement (valeur chiffrée côté serveur)."""
    try:
        result = await env_manager.set_var(project_id, payload.key, payload.value)
        return {"message": f"Variable '{payload.key}' enregistrée", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/env/bulk")
async def set_env_vars_bulk(
    project_id: str,
    payload: BulkEnvRequest,
    current_user: dict = Depends(get_current_user)
):
    """Crée ou met à jour plusieurs variables en une seule requête."""
    if not payload.vars:
        raise HTTPException(status_code=400, detail="Aucune variable fournie")

    try:
        count = await env_manager.set_many(project_id, payload.vars)
        return {"message": f"{count} variable(s) enregistrée(s)", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}/env/{key}")
async def delete_env_var(
    project_id: str,
    key: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprime une variable d'environnement."""
    deleted = await env_manager.delete_var(project_id, key.upper())
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Variable '{key.upper()}' introuvable pour ce projet"
        )
    return {"message": f"Variable '{key.upper()}' supprimée"}


@router.delete("/{project_id}/env")
async def delete_all_env_vars(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprime toutes les variables d'environnement d'un projet (irréversible)."""
    count = await env_manager.delete_all(project_id)
    return {"message": f"{count} variable(s) supprimée(s)", "deleted_count": count}


@router.get("/{project_id}/env/export")
async def export_dotenv(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Exporte toutes les variables sous forme de fichier .env (valeurs déchiffrées).
    Réponse en texte brut pour téléchargement direct.
    """
    from fastapi.responses import PlainTextResponse
    content = await env_manager.export_dotenv(project_id)
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f"attachment; filename=.env"}
    )


@router.post("/{project_id}/env/import")
async def import_dotenv(
    project_id: str,
    payload: DotEnvImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Importe des variables depuis le contenu d'un fichier .env."""
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Contenu vide")

    try:
        count = await env_manager.import_dotenv(project_id, payload.content)
        return {"message": f"{count} variable(s) importée(s)", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
