"""
Routes Sprint 7 — Base de données PostgreSQL par projet
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Database"])


# ─── Schémas ────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str


# ─── Helpers ────────────────────────────────────────────────────────────────

def _get_provisioner(request: Request):
    provisioner = getattr(request.app.state, 'db_provisioner', None)
    if not provisioner:
        raise HTTPException(status_code=503, detail="Service PostgreSQL non initialisé")
    return provisioner


def _get_db_manager(request: Request):
    manager = getattr(request.app.state, 'db_manager', None)
    if not manager:
        raise HTTPException(status_code=503, detail="Service de base de données non initialisé")
    return manager


def _check_project_ownership(project_id: str, current_user: dict):
    """Placeholder — adapter selon la logique d'autorisation existante"""
    return True


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/{project_id}/database")
async def provision_database(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Crée (ou récupère) la base de données dédiée d'un projet"""
    provisioner = _get_provisioner(request)

    existing = provisioner.get_database_info(project_id)
    if existing:
        return {"message": "Base de données déjà provisionnée", **existing}

    try:
        db_info = await provisioner.create_database(project_id)
        safe_info = {k: v for k, v in db_info.items() if k != 'password'}
        return {"message": "Base de données créée", **safe_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur provisioning : {str(e)}")


@router.get("/{project_id}/database")
async def get_database_info(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Retourne les informations de la base de données d'un projet"""
    provisioner = _get_provisioner(request)
    info = provisioner.get_database_info(project_id)

    if not info:
        raise HTTPException(
            status_code=404,
            detail="Aucune base de données provisionnée pour ce projet. POST /api/projects/{id}/database d'abord."
        )
    return info


@router.delete("/{project_id}/database")
async def delete_database(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Supprime la base de données d'un projet (irréversible)"""
    provisioner = _get_provisioner(request)
    manager = _get_db_manager(request)

    if not provisioner.get_database_info(project_id):
        raise HTTPException(status_code=404, detail="Aucune base de données pour ce projet")

    await manager.close_connection(project_id)
    await provisioner.delete_database(project_id)
    return {"message": "Base de données supprimée"}


@router.post("/{project_id}/database/query")
async def execute_query(
    project_id: str,
    payload: QueryRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Exécute une requête SQL dans la base du projet"""
    provisioner = _get_provisioner(request)
    manager = _get_db_manager(request)

    if not provisioner.get_database_info(project_id):
        raise HTTPException(
            status_code=404,
            detail="Aucune base de données pour ce projet. Provisionnez-en une d'abord."
        )

    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="La requête ne peut pas être vide")

    query_upper = query.upper()
    is_write = any(query_upper.startswith(kw) for kw in
                   ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE'])

    if is_write:
        result = await manager.execute_write(project_id, query)
    else:
        result = await manager.execute_query(project_id, query)

    return result


@router.get("/{project_id}/database/tables")
async def list_tables(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Liste toutes les tables de la base du projet"""
    provisioner = _get_provisioner(request)
    manager = _get_db_manager(request)

    if not provisioner.get_database_info(project_id):
        return []

    tables = await manager.list_tables(project_id)
    return tables


@router.get("/{project_id}/database/tables/{table_name}/schema")
async def get_table_schema(
    project_id: str,
    table_name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Retourne le schéma d'une table (colonnes, types, contraintes)"""
    provisioner = _get_provisioner(request)
    manager = _get_db_manager(request)

    if not provisioner.get_database_info(project_id):
        raise HTTPException(status_code=404, detail="Aucune base de données pour ce projet")

    schema = await manager.get_table_schema(project_id, table_name)
    return schema
