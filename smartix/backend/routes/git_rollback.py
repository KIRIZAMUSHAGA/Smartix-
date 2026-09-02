"""
Routes Git Rollback — Retour à une version précédente

Endpoints :
  GET  /api/projects/{project_id}/commits             — Historique des commits
  POST /api/projects/{project_id}/rollback            — Rollback à un commit
  POST /api/projects/{project_id}/rollback/preview    — Prévisualiser le diff avant rollback
  POST /api/projects/{project_id}/rollback/undo       — Annuler le dernier rollback
  GET  /api/projects/{project_id}/stash               — Liste des stash
"""

import asyncio
import logging
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Git Rollback"])

PROJECTS_DIR = Path("/tmp/vibe-coding-projects")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _project_path(project_id: str, user_id: str) -> Path:
    path = PROJECTS_DIR / user_id / project_id
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    return path


def _run_git(cwd: Path, *args: str, timeout: int = 15) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _ensure_git_repo(path: Path) -> bool:
    """Initialise un dépôt git si nécessaire."""
    if not (path / ".git").exists():
        result = _run_git(path, "init")
        if result.returncode != 0:
            return False
        _run_git(path, "config", "user.email", "vibe@smartix.app")
        _run_git(path, "config", "user.name", "Vibe-Coding")
    return True


async def _run_git_async(cwd: Path, *args: str, timeout: int = 15) -> tuple:
    """Version asyncio de _run_git."""
    return await asyncio.to_thread(_run_git, cwd, *args, timeout=timeout)


# ─── Modèles ─────────────────────────────────────────────────────────────────

class RollbackRequest(BaseModel):
    commit_hash: str


class PreviewRequest(BaseModel):
    commit_hash: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/api/projects/{project_id}/commits")
async def get_commits(
    project_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Retourne l'historique des commits du projet."""
    path = _project_path(project_id, current_user["id"])

    if not _ensure_git_repo(path):
        raise HTTPException(500, detail="Impossible d'initialiser le dépôt git")

    result = await asyncio.to_thread(
        _run_git, path,
        "log",
        f"--max-count={limit}",
        "--pretty=format:%H|%h|%s|%an|%ae|%ai|%P",
        "--no-merges",
    )

    if result.returncode != 0:
        # Pas encore de commits
        return {"commits": [], "total": 0}

    commits = []
    for line in result.stdout.strip().splitlines():
        parts = line.split("|", 6)
        if len(parts) >= 6:
            commits.append({
                "hash":         parts[0],
                "short_hash":   parts[1],
                "message":      parts[2],
                "author":       parts[3],
                "author_email": parts[4],
                "date":         parts[5],
                "parents":      parts[6].split() if len(parts) > 6 else [],
            })

    return {"commits": commits, "total": len(commits)}


@router.post("/api/projects/{project_id}/rollback/preview")
async def preview_rollback(
    project_id: str,
    payload: PreviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """Prévisualise le diff entre l'état actuel et le commit cible."""
    path = _project_path(project_id, current_user["id"])

    if not _ensure_git_repo(path):
        raise HTTPException(500, detail="Dépôt git introuvable")

    # Vérifier que le commit existe
    check = await asyncio.to_thread(_run_git, path, "cat-file", "-t", payload.commit_hash)
    if check.returncode != 0:
        raise HTTPException(404, detail=f"Commit introuvable : {payload.commit_hash}")

    # Diff entre le commit et HEAD
    diff = await asyncio.to_thread(
        _run_git, path, "diff", payload.commit_hash, "HEAD", "--stat"
    )
    diff_detail = await asyncio.to_thread(
        _run_git, path, "diff", payload.commit_hash, "HEAD", "--unified=3"
    )

    # Info sur le commit cible
    info = await asyncio.to_thread(
        _run_git, path, "show", "--no-patch",
        "--pretty=format:%H|%s|%an|%ai",
        payload.commit_hash,
    )
    parts = info.stdout.strip().split("|", 3) if info.returncode == 0 else []

    return {
        "commit": {
            "hash":    parts[0] if parts else payload.commit_hash,
            "message": parts[1] if len(parts) > 1 else "",
            "author":  parts[2] if len(parts) > 2 else "",
            "date":    parts[3] if len(parts) > 3 else "",
        },
        "stat":  diff.stdout,
        "diff":  diff_detail.stdout[:50000],  # Tronquer à 50 KB
        "truncated": len(diff_detail.stdout) > 50000,
    }


@router.post("/api/projects/{project_id}/rollback")
async def rollback_to_commit(
    project_id: str,
    payload: RollbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Restaure le projet à un commit précédent.
    L'état actuel est sauvegardé dans un stash avant le rollback.
    """
    path = _project_path(project_id, current_user["id"])

    if not _ensure_git_repo(path):
        raise HTTPException(500, detail="Dépôt git introuvable")

    # 1. Vérifier que le commit cible existe
    check = await asyncio.to_thread(_run_git, path, "cat-file", "-t", payload.commit_hash)
    if check.returncode != 0:
        raise HTTPException(404, detail=f"Commit introuvable : {payload.commit_hash}")

    # 2. Sauvegarder l'état actuel (stash)
    stash_result = await asyncio.to_thread(
        _run_git, path, "stash", "push", "-m",
        f"pre-rollback-{payload.commit_hash[:7]}"
    )
    stash_saved = "No local changes" not in stash_result.stdout

    # 3. Rollback — reset hard vers le commit cible
    reset = await asyncio.to_thread(
        _run_git, path, "reset", "--hard", payload.commit_hash
    )
    if reset.returncode != 0:
        # Restaurer depuis le stash si le reset a échoué
        if stash_saved:
            await asyncio.to_thread(_run_git, path, "stash", "pop")
        raise HTTPException(500, detail=f"Rollback échoué : {reset.stderr}")

    # 4. Créer un commit de rollback (pour garder l'historique propre)
    await asyncio.to_thread(
        _run_git, path, "add", "-A"
    )
    await asyncio.to_thread(
        _run_git, path,
        "commit", "--allow-empty", "-m",
        f"rollback: retour au commit {payload.commit_hash[:7]}"
    )

    # 5. Redémarrer le container si actif
    try:
        from containers.container_manager import container_manager
        await container_manager.restart_container(project_id)
    except Exception:
        pass

    return {
        "success":        True,
        "rolled_back_to": payload.commit_hash,
        "short_hash":     payload.commit_hash[:7],
        "stash_saved":    stash_saved,
        "message":        f"Projet restauré au commit {payload.commit_hash[:7]}",
    }


@router.post("/api/projects/{project_id}/rollback/undo")
async def undo_rollback(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Annule le dernier rollback en restaurant le stash sauvegardé.
    """
    path = _project_path(project_id, current_user["id"])

    if not _ensure_git_repo(path):
        raise HTTPException(500, detail="Dépôt git introuvable")

    # Lister les stashs
    stash_list = await asyncio.to_thread(_run_git, path, "stash", "list")
    if not stash_list.stdout.strip():
        raise HTTPException(400, detail="Aucun stash à restaurer")

    # Trouver le stash pre-rollback
    pre_rollback = None
    for line in stash_list.stdout.splitlines():
        if "pre-rollback" in line:
            pre_rollback = line.split(":")[0]
            break

    if not pre_rollback:
        raise HTTPException(400, detail="Aucun stash de pre-rollback trouvé")

    pop = await asyncio.to_thread(_run_git, path, "stash", "pop", pre_rollback)
    if pop.returncode != 0:
        raise HTTPException(500, detail=f"Restauration du stash échouée : {pop.stderr}")

    return {
        "success": True,
        "message": "Rollback annulé — état précédent restauré",
    }


@router.get("/api/projects/{project_id}/stash")
async def list_stash(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Liste les stashs du projet."""
    path = _project_path(project_id, current_user["id"])

    if not _ensure_git_repo(path):
        return {"stash": []}

    result = await asyncio.to_thread(_run_git, path, "stash", "list")
    stashes = []
    for line in result.stdout.strip().splitlines():
        parts = line.split(":", 2)
        stashes.append({
            "ref":     parts[0].strip() if parts else line,
            "branch":  parts[1].strip() if len(parts) > 1 else "",
            "message": parts[2].strip() if len(parts) > 2 else "",
        })

    return {"stash": stashes}
