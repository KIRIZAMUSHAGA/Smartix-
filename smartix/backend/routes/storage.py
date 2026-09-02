"""
Routes Sprint 7 — Asset Storage S3
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Asset Storage"])

ALLOWED_CONTENT_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/pdf',
    'application/zip', 'application/x-tar', 'application/gzip',
    'text/plain', 'text/csv', 'text/html',
    'application/json',
    'application/octet-stream'
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


# ─── Helper ─────────────────────────────────────────────────────────────────

def _get_storage(request: Request):
    storage = getattr(request.app.state, 's3_storage', None)
    if not storage:
        raise HTTPException(status_code=503, detail="Service de stockage non initialisé")
    return storage


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/{project_id}/storage/assets")
async def list_assets(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Liste tous les assets uploadés pour un projet"""
    storage = _get_storage(request)

    try:
        assets = await storage.list_assets(project_id)
        return assets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur listing assets : {str(e)}")


@router.post("/{project_id}/storage/upload")
async def upload_asset(
    project_id: str,
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload un fichier vers le stockage S3 du projet"""
    storage = _get_storage(request)

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Type de fichier non supporté : {file.content_type}"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux. Maximum : {MAX_FILE_SIZE // 1024 // 1024} MB"
        )

    import io
    file_obj = io.BytesIO(content)

    try:
        result = await storage.upload_file(
            project_id=project_id,
            file=file_obj,
            filename=file.filename,
            content_type=file.content_type or 'application/octet-stream'
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload : {str(e)}")


@router.delete("/{project_id}/storage/assets/{file_key:path}")
async def delete_asset(
    project_id: str,
    file_key: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Supprime un asset du stockage S3"""
    storage = _get_storage(request)

    success = await storage.delete_file(project_id, file_key)
    if not success:
        raise HTTPException(status_code=500, detail="Impossible de supprimer le fichier")

    return {"message": "Fichier supprimé"}


@router.get("/{project_id}/storage/assets/{file_key:path}/presigned")
async def get_presigned_url(
    project_id: str,
    file_key: str,
    request: Request,
    expires_in: int = 3600,
    current_user: dict = Depends(get_current_user)
):
    """Génère une URL présignée temporaire pour accéder à un fichier privé"""
    storage = _get_storage(request)

    expires_in = max(60, min(expires_in, 86400))

    try:
        url = await storage.get_presigned_url(file_key, expires_in=expires_in)
        return {"url": url, "expires_in": expires_in}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération URL : {str(e)}")


@router.delete("/{project_id}/storage/assets")
async def delete_all_project_assets(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Supprime tous les assets d'un projet (irréversible)"""
    storage = _get_storage(request)

    try:
        count = await storage.delete_project_assets(project_id)
        return {"message": f"{count} fichier(s) supprimé(s)", "deleted_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur suppression : {str(e)}")
