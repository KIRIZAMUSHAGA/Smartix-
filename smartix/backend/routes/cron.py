"""
Routes Sprint 7 — Cron Jobs (tâches planifiées)
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Cron Jobs"])


# ─── Schémas ────────────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    schedule: str
    command: str
    name: Optional[str] = None


# ─── Helper ─────────────────────────────────────────────────────────────────

def _get_cron_manager(request: Request):
    manager = getattr(request.app.state, 'cron_manager', None)
    if not manager:
        raise HTTPException(status_code=503, detail="Service Cron non initialisé")
    return manager


def _validate_cron_expression(expression: str):
    """Validation légère d'une expression cron (5 champs requis)"""
    parts = expression.strip().split()
    if len(parts) != 5:
        raise HTTPException(
            status_code=400,
            detail=f"Expression cron invalide : '{expression}'. Format attendu : 'min heure jour mois semaine'"
        )


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/{project_id}/cron")
async def list_cron_jobs(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Liste toutes les tâches cron d'un projet"""
    manager = _get_cron_manager(request)
    return manager.get_jobs(project_id)


@router.post("/{project_id}/cron")
async def create_cron_job(
    project_id: str,
    payload: CreateJobRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Crée une nouvelle tâche cron pour un projet"""
    manager = _get_cron_manager(request)

    _validate_cron_expression(payload.schedule)

    if not payload.command.strip():
        raise HTTPException(status_code=400, detail="La commande ne peut pas être vide")

    job_id = f"job_{project_id}_{uuid.uuid4().hex[:8]}"

    try:
        job = manager.add_job(
            job_id=job_id,
            project_id=project_id,
            schedule=payload.schedule,
            command=payload.command.strip(),
            name=payload.name
        )
        return job
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur création tâche : {str(e)}")


@router.get("/{project_id}/cron/{job_id}")
async def get_cron_job(
    project_id: str,
    job_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Détails d'une tâche cron"""
    manager = _get_cron_manager(request)
    job = manager.get_job(job_id)

    if not job or job['project_id'] != project_id:
        raise HTTPException(status_code=404, detail="Tâche cron introuvable")

    return job


@router.delete("/{project_id}/cron/{job_id}")
async def delete_cron_job(
    project_id: str,
    job_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Supprime une tâche cron"""
    manager = _get_cron_manager(request)

    job = manager.get_job(job_id)
    if not job or job['project_id'] != project_id:
        raise HTTPException(status_code=404, detail="Tâche cron introuvable")

    success = manager.remove_job(job_id)
    if not success:
        raise HTTPException(status_code=500, detail="Impossible de supprimer la tâche")

    return {"message": f"Tâche '{job_id}' supprimée"}


@router.post("/{project_id}/cron/{job_id}/test")
async def test_cron_job(
    project_id: str,
    job_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Déclenche immédiatement l'exécution d'une tâche (test manuel)"""
    manager = _get_cron_manager(request)

    job = manager.get_job(job_id)
    if not job or job['project_id'] != project_id:
        raise HTTPException(status_code=404, detail="Tâche cron introuvable")

    result = await manager.test_job(job_id)
    return result


@router.get("/{project_id}/cron/{job_id}/logs")
async def get_cron_logs(
    project_id: str,
    job_id: str,
    request: Request,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Retourne les derniers logs d'exécution d'une tâche"""
    manager = _get_cron_manager(request)

    job = manager.get_job(job_id)
    if not job or job['project_id'] != project_id:
        raise HTTPException(status_code=404, detail="Tâche cron introuvable")

    logs = manager.get_logs(job_id, limit=min(limit, 100))
    return logs
