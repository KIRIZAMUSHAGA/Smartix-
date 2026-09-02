"""
Routes pour l'upload de fichiers
- Upload d'APK
- Upload de screenshots
- Upload d'assets
- Gestion des chunks pour gros fichiers
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Query
from typing import Optional, List
import uuid
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from middleware.auth_middleware import get_current_user
from db import get_collection
from utils.file_uploader import FileUploader

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

# Note: the standalone /auth/upload-image endpoint lives in routes/auth_uploads.py
# to avoid this module's pre-existing utils.file_uploader import failure.

# Configuration
UPLOAD_DIR = Path("backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Types de fichiers autorisés
ALLOWED_MIME_TYPES = {
    'apk': 'application/vnd.android.package-archive',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'txt': 'text/plain',
    'json': 'application/json',
    'zip': 'application/zip'
}

# Tailles maximales
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_APK_SIZE = 100 * 1024 * 1024    # 100 MB
MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024  # 5 MB

# =============================
# MODÈLES INTERNES
# =============================

class UploadSession:
    """Session d'upload pour les fichiers chunkés"""
    def __init__(self, upload_id, filename, total_chunks, user_id):
        self.id = upload_id
        self.filename = filename
        self.total_chunks = total_chunks
        self.received_chunks = []
        self.user_id = user_id
        self.created_at = datetime.now()
        self.completed = False
        self.file_path = None

# Stockage temporaire des sessions d'upload
upload_sessions = {}

# =============================
# ROUTES D'UPLOAD
# =============================

@router.post("/simple")
async def upload_file_simple(
    file: UploadFile = File(...),
    bucket: str = Form("default"),
    category: str = Form("general"),
    public: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload simple d'un fichier (taille < 10MB)
    """
    # Vérifier la taille
    content = await file.read()
    file_size = len(content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux (max {MAX_FILE_SIZE} bytes)")
    
    # Vérifier le type MIME
    file_ext = file.filename.split('.')[-1].lower()
    expected_mime = ALLOWED_MIME_TYPES.get(file_ext)
    
    if expected_mime and file.content_type != expected_mime:
        raise HTTPException(status_code=400, detail=f"Type MIME invalide. Attendu: {expected_mime}, Reçu: {file.content_type}")
    
    # Vérifier les limites par catégorie
    if category == 'apk' and file_size > MAX_APK_SIZE:
        raise HTTPException(status_code=400, detail=f"APK trop volumineux (max {MAX_APK_SIZE} bytes)")
    
    if category == 'screenshot' and file_size > MAX_SCREENSHOT_SIZE:
        raise HTTPException(status_code=400, detail=f"Screenshot trop volumineux (max {MAX_SCREENSHOT_SIZE} bytes)")
    
    # Générer un ID unique
    file_id = str(uuid.uuid4())
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file_id}_{file.filename}"
    
    # Déterminer le chemin
    category_dir = UPLOAD_DIR / bucket / category
    category_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = category_dir / safe_filename
    
    # Sauvegarder le fichier
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Enregistrer dans la base de données
    files_col = get_collection("uploads")
    
    file_doc = {
        "id": file_id,
        "filename": file.filename,
        "stored_filename": safe_filename,
        "path": str(file_path),
        "size": file_size,
        "mime_type": file.content_type,
        "bucket": bucket,
        "category": category,
        "public": public,
        "user_id": current_user["id"],
        "created_at": datetime.now(),
        "metadata": {}
    }
    
    await files_col.insert_one(file_doc)
    
    return {
        "success": True,
        "file_id": file_id,
        "filename": file.filename,
        "size": file_size,
        "url": f"/uploads/{bucket}/{category}/{safe_filename}" if public else None,
        "download_url": f"/api/uploads/download/{file_id}"
    }

@router.post("/chunk/init")
async def init_chunk_upload(
    filename: str = Body(...),
    total_chunks: int = Body(...),
    file_size: int = Body(...),
    bucket: str = Body("default"),
    category: str = Body("general"),
    current_user: dict = Depends(get_current_user)
):
    """
    Initialise un upload par chunks (pour fichiers volumineux)
    """
    # Vérifier la taille totale
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux (max {MAX_FILE_SIZE} bytes)")
    
    # Créer une session d'upload
    upload_id = str(uuid.uuid4())
    
    upload_sessions[upload_id] = UploadSession(
        upload_id=upload_id,
        filename=filename,
        total_chunks=total_chunks,
        user_id=current_user["id"]
    )
    
    # Créer le dossier temporaire
    temp_dir = UPLOAD_DIR / "temp" / upload_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    return {
        "upload_id": upload_id,
        "chunk_size": 5 * 1024 * 1024,  # 5 MB
        "total_chunks": total_chunks,
        "expires_in": 3600  # 1 heure
    }

@router.post("/chunk/{chunk_index}")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload un chunk de fichier
    """
    # Vérifier la session
    if upload_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Session d'upload introuvable")
    
    session = upload_sessions[upload_id]
    
    if session.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Lire le chunk
    content = await file.read()
    
    # Sauvegarder le chunk
    temp_dir = UPLOAD_DIR / "temp" / upload_id
    chunk_path = temp_dir / f"chunk_{chunk_index:04d}"
    
    with open(chunk_path, "wb") as f:
        f.write(content)
    
    # Enregistrer le chunk reçu
    if chunk_index not in session.received_chunks:
        session.received_chunks.append(chunk_index)
    
    return {
        "received": True,
        "chunk_index": chunk_index,
        "progress": len(session.received_chunks) / session.total_chunks * 100
    }

@router.post("/chunk/complete")
async def complete_chunk_upload(
    upload_id: str = Body(...),
    bucket: str = Body("default"),
    category: str = Body("general"),
    public: bool = Body(False),
    metadata: dict = Body({}),
    current_user: dict = Depends(get_current_user)
):
    """
    Finalise un upload par chunks
    """
    # Vérifier la session
    if upload_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Session d'upload introuvable")
    
    session = upload_sessions[upload_id]
    
    if session.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Vérifier que tous les chunks sont reçus
    if len(session.received_chunks) != session.total_chunks:
        raise HTTPException(
            status_code=400, 
            detail=f"Chunks manquants: reçu {len(session.received_chunks)}/{session.total_chunks}"
        )
    
    # Fusionner les chunks
    temp_dir = UPLOAD_DIR / "temp" / upload_id
    chunks = sorted(temp_dir.glob("chunk_*"))
    
    # Générer le fichier final
    file_id = str(uuid.uuid4())
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file_id}_{session.filename}"
    
    category_dir = UPLOAD_DIR / bucket / category
    category_dir.mkdir(parents=True, exist_ok=True)
    
    final_path = category_dir / safe_filename
    total_size = 0
    
    with open(final_path, "wb") as outfile:
        for chunk_path in chunks:
            with open(chunk_path, "rb") as infile:
                data = infile.read()
                outfile.write(data)
                total_size += len(data)
    
    # Nettoyer les chunks temporaires
    import shutil
    shutil.rmtree(temp_dir)
    
    # Supprimer la session
    del upload_sessions[upload_id]
    
    # Enregistrer dans la base de données
    files_col = get_collection("uploads")
    
    file_doc = {
        "id": file_id,
        "filename": session.filename,
        "stored_filename": safe_filename,
        "path": str(final_path),
        "size": total_size,
        "bucket": bucket,
        "category": category,
        "public": public,
        "user_id": current_user["id"],
        "created_at": datetime.now(),
        "metadata": metadata
    }
    
    await files_col.insert_one(file_doc)
    
    return {
        "success": True,
        "file_id": file_id,
        "filename": session.filename,
        "size": total_size,
        "url": f"/uploads/{bucket}/{category}/{safe_filename}" if public else None,
        "download_url": f"/api/uploads/download/{file_id}"
    }

# =============================
# ROUTES DE TÉLÉCHARGEMENT
# =============================

@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    token: Optional[str] = None,
    current_user: dict = Depends(get_current_user_optional)
):
    """
    Télécharge un fichier (avec vérification des permissions)
    """
    files_col = get_collection("uploads")
    
    file_doc = await files_col.find_one({"id": file_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    
    # Vérifier les permissions
    if not file_doc["public"]:
        if not current_user or current_user["id"] != file_doc["user_id"]:
            raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Vérifier que le fichier existe
    file_path = Path(file_doc["path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le disque")
    
    # Servir le fichier
    from fastapi.responses import FileResponse
    
    return FileResponse(
        path=file_path,
        filename=file_doc["filename"],
        media_type=file_doc.get("mime_type", "application/octet-stream")
    )

@router.get("/info/{file_id}")
async def get_file_info(
    file_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """
    Récupère les informations d'un fichier
    """
    files_col = get_collection("uploads")
    
    file_doc = await files_col.find_one({"id": file_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    
    # Vérifier les permissions
    if not file_doc["public"]:
        if not current_user or current_user["id"] != file_doc["user_id"]:
            raise HTTPException(status_code=403, detail="Non autorisé")
    
    # Retourner les infos (sans le chemin)
    return {
        "id": file_doc["id"],
        "filename": file_doc["filename"],
        "size": file_doc["size"],
        "bucket": file_doc["bucket"],
        "category": file_doc["category"],
        "public": file_doc["public"],
        "created_at": file_doc["created_at"],
        "metadata": file_doc.get("metadata", {})
    }

# =============================
# ROUTES DE GESTION
# =============================

@router.get("/list")
async def list_files(
    bucket: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les fichiers de l'utilisateur
    """
    files_col = get_collection("uploads")
    
    query = {"user_id": current_user["id"]}
    
    if bucket:
        query["bucket"] = bucket
    
    if category:
        query["category"] = category
    
    total = await files_col.count_documents(query)
    
    cursor = files_col.find(query).sort("created_at", -1).skip(offset).limit(limit)
    files = await cursor.to_list(length=limit)
    
    # Nettoyer les réponses
    for file in files:
        file.pop("path", None)
        file.pop("_id", None)
    
    return {
        "files": files,
        "total": total,
        "offset": offset,
        "limit": limit
    }

@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Supprime un fichier
    """
    files_col = get_collection("uploads")
    
    file_doc = await files_col.find_one({
        "id": file_id,
        "user_id": current_user["id"]
    })
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    
    # Supprimer le fichier physique
    file_path = Path(file_doc["path"])
    if file_path.exists():
        file_path.unlink()
    
    # Supprimer l'entrée en base
    await files_col.delete_one({"id": file_id})
    
    return {"success": True}

# =============================
# NETTOYAGE PÉRIODIQUE
# =============================

async def cleanup_old_uploads():
    """
    Nettoie les sessions d'upload expirées (à appeler périodiquement)
    """
    expired_time = datetime.now() - timedelta(hours=1)
    expired_sessions = [
        uid for uid, session in upload_sessions.items()
        if session.created_at < expired_time
    ]
    
    for uid in expired_sessions:
        if uid in upload_sessions:
            # Supprimer les fichiers temporaires
            temp_dir = UPLOAD_DIR / "temp" / uid
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
            del upload_sessions[uid]
    
    return len(expired_sessions)
