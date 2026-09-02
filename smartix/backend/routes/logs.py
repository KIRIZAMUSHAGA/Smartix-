"""
Routes — Logs d'accès HTTP par projet (Sprint 7+)

Tous les accès aux containers sandbox sont journalisés
par SandboxLogMiddleware et accessibles ici.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from middleware.auth_middleware import get_current_user
from services.request_logger import request_logger

router = APIRouter(prefix="/api/projects", tags=["Access Logs"])


@router.get("/{project_id}/logs")
async def get_access_logs(
    project_id: str,
    limit: int = Query(200, ge=1, le=500),
    method: Optional[str] = Query(None, description="Filtrer par méthode HTTP (GET, POST...)"),
    level: Optional[str] = Query(None, description="Filtrer par niveau: success, info, warn, error"),
    status_gte: Optional[int] = Query(None, description="Statut HTTP >="),
    status_lte: Optional[int] = Query(None, description="Statut HTTP <="),
    path_contains: Optional[str] = Query(None, description="Filtrer par chemin (contient)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Retourne les logs d'accès HTTP d'un projet, du plus récent au plus ancien.
    Les logs sont conservés 7 jours (TTL MongoDB).
    """
    logs = await request_logger.get_logs(
        project_id=project_id,
        limit=limit,
        method=method,
        status_gte=status_gte,
        status_lte=status_lte,
        path_contains=path_contains,
        level=level,
    )
    return {
        'project_id': project_id,
        'logs': logs,
        'count': len(logs),
        'filters': {
            'method': method,
            'level': level,
            'status_gte': status_gte,
            'status_lte': status_lte,
            'path_contains': path_contains,
        }
    }


@router.get("/{project_id}/logs/stats")
async def get_log_stats(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retourne les statistiques agrégées des logs d'accès d'un projet."""
    stats = await request_logger.get_stats(project_id)
    return {'project_id': project_id, **stats}


@router.delete("/{project_id}/logs")
async def clear_access_logs(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprime tous les logs d'accès d'un projet."""
    count = await request_logger.clear_logs(project_id)
    return {'message': f'{count} log(s) supprimé(s)', 'deleted_count': count}


@router.get("/{project_id}/logs/export")
async def export_logs_as_text(
    project_id: str,
    limit: int = Query(500, ge=1, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Exporte les logs au format texte (CLF-like) pour téléchargement."""
    logs = await request_logger.get_logs(project_id=project_id, limit=limit)

    lines = [
        f"[{log.get('timestamp', '')}] {log.get('client_ip', '-')} "
        f"{log.get('method', '-')} {log.get('path', '-')}"
        f"{'?' + log['query_string'] if log.get('query_string') else ''} "
        f"{log.get('status_code', '-')} {log.get('duration_ms', 0):.1f}ms"
        for log in logs
    ]

    content = '\n'.join(lines)
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f"attachment; filename=access-{project_id}.log"}
    )
