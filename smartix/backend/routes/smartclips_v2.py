"""
SmartixClips Routes V2 - Nouvelle architecture optimisée
- Chargement instantané depuis cache/DB
- Scraping en arrière-plan uniquement
- Pagination et scroll infini
- Onboarding conditionnel
- STUDIO: Édition et export vidéo
Version 2.2 avec support studio vidéo et export timeline
"""
from fastapi import APIRouter, HTTPException, Query, Form, BackgroundTasks, Request, UploadFile, File, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, constr, validator
import asyncio
import time
import json
import redis.asyncio as aioredis
import os
import uuid
import shutil
import subprocess
from collections import defaultdict
from fastapi.responses import JSONResponse, FileResponse
from middleware.auth_middleware import get_current_user_optional, get_current_user_required

# ========== CONFIGURATION ==========
router = APIRouter(prefix="/smartclips/v2", tags=["smartclips-v2"])
REDIS_URL = "redis://localhost"

# Configuration des dossiers pour le studio
SMARTCLIPS_STUDIO_DIR = os.path.join(os.getcwd(), "uploads", "smartclips_studio")
UPLOAD_DIR = os.path.join(SMARTCLIPS_STUDIO_DIR, "uploads")
PROCESSED_DIR = os.path.join(SMARTCLIPS_STUDIO_DIR, "processed")
TEMP_DIR = os.path.join(SMARTCLIPS_STUDIO_DIR, "temp")

# Créer les dossiers
for directory in [SMARTCLIPS_STUDIO_DIR, UPLOAD_DIR, PROCESSED_DIR, TEMP_DIR]:
    os.makedirs(directory, exist_ok=True)

# Rate limiting
request_counts = defaultdict(list)
RATE_LIMITS = {
    "feed": 30,
    "preferences": 20,
    "progress": 30,
    "watched": 20,
    "stats": 15,
    "studio_upload": 5,      # Limite: 5 uploads/minute
    "studio_process": 3,     # Limite: 3 traitements/minute
    "studio_export": 2       # Limite: 2 exports/minute
}

# Cache TTL
CACHE_TTL = {
    "feed": 120,
    "preferences": 300,
    "stats": 300,
    "tags": 3600,
    "studio_projects": 300   # 5 minutes
}

# ========== MODÈLES PYDANTIC ==========
class PreferencesRequest(BaseModel):
    user_id: constr(min_length=1, max_length=100, regex="^[a-zA-Z0-9_-]+$")
    favorite_tags: List[constr(max_length=30)]
    
    @validator('favorite_tags')
    def validate_tags(cls, v):
        if len(v) > 10:
            raise ValueError('Maximum 10 tags')
        return list(set(v))

class ProgressRequest(BaseModel):
    user_id: constr(min_length=1, max_length=100)
    last_watched_index: int = 0
    
    @validator('last_watched_index')
    def validate_index(cls, v):
        if v < 0:
            return 0
        if v > 10000:
            return 10000
        return v

class WatchedRequest(BaseModel):
    user_id: constr(min_length=1, max_length=100)
    video_id: constr(min_length=1, max_length=100)

# ========== MODÈLES STUDIO ==========
class ElementData(BaseModel):
    type: str  # text, sticker, filter
    content: str
    x: float = 50
    y: float = 50
    rotation: int = 0
    fontSize: Optional[int] = None
    color: Optional[str] = None
    size: Optional[int] = None

class ProjectData(BaseModel):
    elements: List[ElementData] = []
    filter: Optional[str] = None
    audio_url: Optional[str] = None
    volume: float = 0.8

class ExportResponse(BaseModel):
    success: bool
    video_url: Optional[str] = None
    job_id: Optional[str] = None
    message: str

# ========== REDIS CLIENT ==========
_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        try:
            _redis = await aioredis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2
            )
            await _redis.ping()
        except Exception as e:
            print(f"⚠️ Redis non disponible: {e}")
            _redis = None
    return _redis

# ========== RATE LIMITING ==========
async def rate_limit(request: Request, endpoint: str, user_id: str = "anonymous"):
    """Rate limiting par IP + user_id"""
    limits = RATE_LIMITS.get(endpoint, 30)
    client_key = f"{endpoint}:{request.client.host}:{user_id}"
    now = time.time()
    
    request_counts[client_key] = [t for t in request_counts[client_key] if now - t < 60]
    
    if len(request_counts[client_key]) >= limits:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Trop de requêtes",
                "retry_after": 60,
                "endpoint": endpoint,
                "limit": limits
            }
        )
    
    request_counts[client_key].append(now)
    return True

# ========== CACHE UTILS ==========
async def get_cached(key: str, fetch_func, ttl: int = 120):
    """Pattern cache-aside"""
    redis = await get_redis()
    if not redis:
        return await fetch_func()
    
    try:
        cached = await redis.get(key)
        if cached:
            return json.loads(cached)
        
        result = await fetch_func()
        if result:
            await redis.setex(key, ttl, json.dumps(result, default=str))
        return result
    except Exception as e:
        print(f"⚠️ Cache error: {e}")
        return await fetch_func()

# ========== STUDIO ROUTES ==========

@router.post("/studio/upload")
async def studio_upload_video(
    request: Request,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user = Depends(get_current_user_optional)
):
    """
    Upload une vidéo pour le studio
    - Format: MP4, QuickTime, WebM
    - Taille max: 100MB
    """
    await rate_limit(request, "studio_upload", current_user.id if current_user else "anonymous")
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentification requise")
    
    # Vérifier le type de fichier
    if not file.content_type.startswith('video/'):
        raise HTTPException(400, "Format vidéo non supporté")
    
    # Vérifier la taille
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > 100 * 1024 * 1024:  # 100MB
        raise HTTPException(400, "Vidéo trop lourde (max 100MB)")
    
    try:
        # Générer un ID unique
        video_id = str(uuid.uuid4())
        filename = f"{video_id}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Sauvegarder le fichier
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Créer l'entrée en base
        from app.services.smartclips_service import save_studio_project
        
        project = await save_studio_project(
            user_id=current_user.id,
            video_id=video_id,
            original_filename=file.filename,
            original_path=file_path,
            status="uploaded"
        )
        
        return {
            "success": True,
            "video_id": video_id,
            "url": f"/uploads/smartclips_studio/uploads/{filename}"
        }
        
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(500, f"Erreur upload: {str(e)}")

@router.post("/studio/{video_id}/process")
async def studio_process_video(
    video_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    elements: str = Form(...),
    filter_type: str = Form(None),
    current_user = Depends(get_current_user_required)
):
    """
    Traite la vidéo avec les éléments ajoutés (texte, stickers, filtres)
    """
    await rate_limit(request, "studio_process", current_user.id)
    
    try:
        # Récupérer le projet
        from app.services.smartclips_service import get_studio_project, update_studio_project_status
        
        project = await get_studio_project(video_id, current_user.id)
        if not project:
            raise HTTPException(404, "Projet non trouvé")
        
        # Mettre à jour le statut
        await update_studio_project_status(video_id, "processing")
        
        # Lancer le traitement en arrière-plan
        background_tasks.add_task(
            process_video_background,
            video_id,
            current_user.id,
            elements,
            filter_type
        )
        
        return {
            "success": True,
            "message": "Traitement lancé",
            "job_id": video_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Process error: {e}")
        raise HTTPException(500, str(e))

@router.get("/studio/job/{job_id}/status")
async def studio_get_job_status(
    job_id: str,
    request: Request,
    current_user = Depends(get_current_user_required)
):
    """
    Récupère le statut d'un job d'export
    """
    await rate_limit(request, "stats", current_user.id)
    
    try:
        from app.services.smartclips_service import get_studio_project
        
        project = await get_studio_project(job_id, current_user.id)
        if not project:
            raise HTTPException(404, "Job non trouvé")
        
        return {
            "success": True,
            "status": project.get("status", "unknown"),
            "progress": project.get("progress", 0),
            "error": project.get("error"),
            "video_url": project.get("processed_url") if project.get("status") == "completed" else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Status error: {e}")
        raise HTTPException(500, str(e))

@router.post("/studio/{video_id}/export", response_model=ExportResponse)
async def export_video(
    video_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user_required)
):
    """
    Exporte la vidéo avec la timeline (montage complet)
    - Génère la vidéo finale avec tous les éléments appliqués
    - Utilise les données de projet existantes
    """
    await rate_limit(request, "studio_export", current_user.id)
    
    try:
        from app.services.smartclips_service import get_studio_project, update_studio_project_status
        
        # Récupérer le projet existant
        project = await get_studio_project(video_id, current_user.id)
        if not project:
            raise HTTPException(404, "Projet non trouvé")
        
        # Vérifier que la vidéo originale existe
        original_path = project.get("original_path")
        if not original_path or not os.path.exists(original_path):
            raise HTTPException(400, "Vidéo source introuvable")
        
        # Mettre à jour le statut
        await update_studio_project_status(video_id, "exporting")
        
        # Générer un job ID unique
        export_job_id = f"{video_id}_{uuid.uuid4().hex[:8]}"
        
        # Lancer l'export en arrière-plan
        background_tasks.add_task(
            export_video_background,
            video_id,
            current_user.id,
            export_job_id
        )
        
        return ExportResponse(
            success=True,
            job_id=export_job_id,
            message="Export lancé en arrière-plan"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Export error: {e}")
        raise HTTPException(500, f"Erreur d'export: {str(e)}")

@router.post("/studio/{video_id}/publish")
async def studio_publish_smartclip(
    video_id: str,
    request: Request,
    title: str = Form(..., min_length=3, max_length=100),
    description: str = Form(None),
    tags: str = Form(None),
    current_user = Depends(get_current_user_required)
):
    """
    Publie la vidéo traitée dans SmartClips
    """
    await rate_limit(request, "studio_export", current_user.id)
    
    try:
        from app.services.smartclips_service import get_studio_project, publish_to_smartclips
        
        # Récupérer le projet
        project = await get_studio_project(video_id, current_user.id)
        if not project:
            raise HTTPException(404, "Projet non trouvé")
        
        if project.get("status") != "completed":
            raise HTTPException(400, "Vidéo non disponible, traitement en cours")
        
        # Publier
        clip = await publish_to_smartclips(
            user_id=current_user.id,
            video_url=project.get("processed_url"),
            title=title,
            description=description,
            tags=tags.split(",") if tags else []
        )
        
        return {
            "success": True,
            "clip_id": clip.get("id")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Publish error: {e}")
        raise HTTPException(500, str(e))

# ========== FONCTIONS DE TRAITEMENT ==========

async def process_video_background(video_id: str, user_id: str, elements_json: str, filter_type: str):
    """Tâche de traitement vidéo en arrière-plan"""
    try:
        from app.services.smartclips_service import update_studio_project_status, update_studio_project_progress
        
        elements = json.loads(elements_json)
        
        # 1. Récupérer le chemin du fichier
        project = await get_studio_project(video_id, user_id)
        if not project:
            return
        
        input_path = project.get("original_path")
        if not input_path or not os.path.exists(input_path):
            await update_studio_project_status(video_id, "error", "Fichier vidéo introuvable")
            return
        
        # 2. Redimensionnement (10%)
        await update_studio_project_progress(video_id, 10)
        resized_path = os.path.join(TEMP_DIR, f"{video_id}_resized.mp4")
        
        # Utiliser ffmpeg pour redimensionner
        try:
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
                '-c:a', 'copy',
                '-y',
                resized_path
            ]
            subprocess.run(cmd, capture_output=True, check=True)
        except Exception as e:
            print(f"Resize error: {e}")
            await update_studio_project_status(video_id, "error", f"Redimensionnement échoué: {e}")
            return
        
        # 3. Application du filtre (30%)
        await update_studio_project_progress(video_id, 30)
        filtered_path = resized_path
        
        if filter_type and filter_type != 'normal':
            filtered_path = os.path.join(TEMP_DIR, f"{video_id}_filtered.mp4")
            
            filter_map = {
                'grayscale': 'hue=s=0',
                'sepia': 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
                'brightness-125': 'eq=brightness=0.125',
                'contrast-150': 'eq=contrast=1.5',
                'blur-sm': 'boxblur=5:1'
            }
            
            filter_expr = filter_map.get(filter_type)
            if filter_expr:
                cmd = [
                    'ffmpeg',
                    '-i', resized_path,
                    '-vf', filter_expr,
                    '-c:a', 'copy',
                    '-y',
                    filtered_path
                ]
                subprocess.run(cmd, capture_output=True, check=True)
        
        # 4. Ajout des éléments (50%)
        await update_studio_project_progress(video_id, 50)
        
        # Pour l'instant, copie simple - dans une version avancée, on utiliserait drawtext
        final_path = filtered_path
        
        # 5. Génération du fichier final (70%)
        await update_studio_project_progress(video_id, 70)
        output_filename = f"{video_id}_processed.mp4"
        output_path = os.path.join(PROCESSED_DIR, output_filename)
        
        shutil.copy2(final_path, output_path)
        
        # 6. Nettoyage (90%)
        await update_studio_project_progress(video_id, 90)
        
        # Nettoyer les fichiers temporaires
        for temp_file in [resized_path]:
            if os.path.exists(temp_file) and temp_file != final_path:
                os.remove(temp_file)
        if filtered_path != resized_path and os.path.exists(filtered_path):
            os.remove(filtered_path)
        
        # 7. Terminé (100%)
        await update_studio_project_status(video_id, "completed", processed_url=f"/uploads/smartclips_studio/processed/{output_filename}")
        
    except Exception as e:
        print(f"Background processing error: {e}")
        await update_studio_project_status(video_id, "error", str(e))

async def export_video_background(video_id: str, user_id: str, export_job_id: str):
    """Tâche d'export vidéo en arrière-plan avec la timeline complète"""
    try:
        from app.services.smartclips_service import (
            get_studio_project, 
            update_studio_project_status,
            update_studio_project_progress,
            save_export_job
        )
        
        # Récupérer le projet
        project = await get_studio_project(video_id, user_id)
        if not project:
            print(f"Projet {video_id} non trouvé")
            return
        
        input_path = project.get("original_path")
        if not input_path or not os.path.exists(input_path):
            await update_studio_project_status(video_id, "error", "Fichier vidéo introuvable")
            return
        
        # Récupérer les données d'édition
        elements = project.get("elements", [])
        filter_type = project.get("filter")
        audio_url = project.get("audio_url")
        volume = project.get("volume", 0.8)
        
        # Sauvegarder le job d'export
        await save_export_job(export_job_id, video_id, user_id, "pending")
        
        # 1. Préparation (10%)
        await update_studio_project_progress(video_id, 10)
        
        # Créer un dossier temporaire pour cet export
        export_temp_dir = os.path.join(TEMP_DIR, export_job_id)
        os.makedirs(export_temp_dir, exist_ok=True)
        
        # 2. Redimensionnement au format vertical (25%)
        await update_studio_project_progress(video_id, 25)
        resized_path = os.path.join(export_temp_dir, "resized.mp4")
        
        try:
            cmd_resize = [
                'ffmpeg',
                '-i', input_path,
                '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
                '-c:a', 'copy',
                '-y',
                resized_path
            ]
            subprocess.run(cmd_resize, capture_output=True, check=True)
        except Exception as e:
            print(f"Resize error: {e}")
            await update_studio_project_status(video_id, "error", f"Redimensionnement échoué: {e}")
            return
        
        current_path = resized_path
        
        # 3. Application du filtre (40%)
        await update_studio_project_progress(video_id, 40)
        
        if filter_type and filter_type != 'normal':
            filtered_path = os.path.join(export_temp_dir, "filtered.mp4")
            
            filter_map = {
                'grayscale': 'hue=s=0',
                'sepia': 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
                'brightness-125': 'eq=brightness=0.125',
                'contrast-150': 'eq=contrast=1.5',
                'blur-sm': 'boxblur=5:1'
            }
            
            filter_expr = filter_map.get(filter_type)
            if filter_expr:
                cmd_filter = [
                    'ffmpeg',
                    '-i', current_path,
                    '-vf', filter_expr,
                    '-c:a', 'copy',
                    '-y',
                    filtered_path
                ]
                subprocess.run(cmd_filter, capture_output=True, check=True)
                current_path = filtered_path
        
        # 4. Ajout des éléments texte/stickers (60%)
        await update_studio_project_progress(video_id, 60)
        
         # Construire la chaîne de filtres pour les éléments
        if elements:
            drawtext_filters = []
            for i, element in enumerate(elements):
                if element.get("type") == "text":
                    content = element.get("content", "")
                    x = element.get("x", 50)
                    y = element.get("y", 50)
                    font_size = element.get("fontSize", 24)
                    color = element.get("color", "white")
                    
                    # Échapper le texte pour ffmpeg
                    escaped_text = content.replace("'", "\\'").replace(":", "\\:")
                    
                    drawtext_filter = (
                        f"drawtext=text='{escaped_text}':"
                        f"fontcolor={color}:"
                        f"fontsize={font_size}:"
                        f"x=(w-text_w)*{x/100}:"
                        f"y=(h-text_h)*{y/100}:"
                        f"enable='between(t,0,100)'"
                    )
                    drawtext_filters.append(drawtext_filter)
            
            if drawtext_filters:
                text_path = os.path.join(export_temp_dir, "with_text.mp4")
                vf_filter = ",".join(drawtext_filters)
                
                cmd_text = [
                    'ffmpeg',
                    '-i', current_path,
                    '-vf', vf_filter,
                    '-c:a', 'copy',
                    '-y',
                    text_path
                ]
                subprocess.run(cmd_text, capture_output=True, check=True)
                current_path = text_path
        
        # 5. Ajout de l'audio personnalisé (80%)
        await update_studio_project_progress(video_id, 80)
        
        final_path = os.path.join(PROCESSED_DIR, f"{video_id}_exported.mp4")
        
        if audio_url and audio_url.startswith("http"):
            # Télécharger l'audio personnalisé
            import aiohttp
            audio_path = os.path.join(export_temp_dir, "custom_audio.mp3")
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(audio_url) as resp:
                        if resp.status == 200:
                            with open(audio_path, "wb") as f:
                                f.write(await resp.read())
                            
                            # Mixer l'audio
                            cmd_audio = [
                                'ffmpeg',
                                '-i', current_path,
                                '-i', audio_path,
                                '-filter_complex', f'[1:a]volume={volume}[a1];[0:a]volume=0.2[a2];[a2][a1]amix=inputs=2:duration=first',
                                '-c:v', 'copy',
                                '-y',
                                final_path
                            ]
                            subprocess.run(cmd_audio, capture_output=True, check=True)
                        else:
                            # Fallback: garder l'audio original
                            shutil.copy2(current_path, final_path)
            except Exception as e:
                print(f"Audio processing error: {e}")
                shutil.copy2(current_path, final_path)
        else:
            # Pas d'audio personnalisé, garder l'audio original
            shutil.copy2(current_path, final_path)
        
        # 6. Nettoyage (95%)
        await update_studio_project_progress(video_id, 95)
        
        # Supprimer le dossier temporaire
        if os.path.exists(export_temp_dir):
            shutil.rmtree(export_temp_dir)
        
        # 7. Terminé (100%)
        await update_studio_project_status(
            video_id, 
            "completed",
            processed_url=f"/uploads/smartclips_studio/processed/{video_id}_exported.mp4"
        )
        
        await save_export_job(export_job_id, video_id, user_id, "completed", final_path)
        
        print(f"✅ Export {export_job_id} terminé avec succès")
        
    except Exception as e:
        print(f"Background export error: {e}")
        await update_studio_project_status(video_id, "error", str(e))
        await save_export_job(export_job_id, video_id, user_id, "error", error=str(e))

# ========== ROUTES EXISTANTES (FEED, SCRAPING, ETC.) ==========

# ========== FEED ==========
@router.get("/feed")
async def get_personalized_feed(
    request: Request,
    user_id: Optional[str] = Query(None, min_length=1, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    exclude_watched: bool = Query(False)
):
    """Récupérer le fil personnalisé - INSTANTANÉ"""
    await rate_limit(request, "feed", user_id or "anonymous")
    
    async def _fetch_feed():
        try:
            from app.services.smartclips_service import get_personalized_feed, get_user_progress
            
            actual_offset = offset
            if user_id and offset == 0:
                progress = await get_user_progress(user_id)
                if progress and progress.get("last_watched_index", 0) > 0:
                    actual_offset = progress["last_watched_index"]
            
            clips = await get_personalized_feed(
                user_id=user_id or "anonymous",
                limit=limit,
                offset=actual_offset,
                exclude_watched=exclude_watched
            )
            
            if not clips and actual_offset == 0:
                from routes.smartclips import get_demo_clips
                clips = get_demo_clips()
            
            next_offset = actual_offset + len(clips) if clips else actual_offset
            
            return {
                "clips": clips,
                "offset": actual_offset,
                "next_offset": next_offset,
                "has_more": len(clips) == limit,
                "count": len(clips)
            }
        except Exception as e:
            print(f"Error getting feed: {e}")
            raise HTTPException(status_code=500, detail="Erreur chargement feed")
    
    if offset == 0 and user_id:
        cache_key = f"feed_v2:{user_id}:{limit}:{exclude_watched}"
        return await get_cached(cache_key, _fetch_feed, CACHE_TTL["feed"])
    else:
        return await _fetch_feed()

# ========== SCRAPING ==========
@router.post("/trigger-scraping")
async def trigger_background_scraping(
    request: Request,
    user_id: Optional[str] = Form(None, min_length=1, max_length=100),
    background_tasks: BackgroundTasks = None
):
    """Déclencher le scraping en arrière-plan"""
    await rate_limit(request, "preferences", user_id or "anonymous")
    
    try:
        from app.services.scraper_sources import fetch_all_sources_async
        from app.services.smartclips_service import (
            update_scraping_status,
            get_collection,
            check_session_scraping,
            mark_session_scraping_done
        )
        
        target_user_id = user_id or "anonymous"
        
        if target_user_id != "anonymous":
            already_done = await check_session_scraping(target_user_id)
            if already_done:
                return {
                    "success": False,
                    "message": "Scraping déjà effectué aujourd'hui",
                    "user_id": target_user_id
                }
        
        async def run_scraping():
            try:
                print(f"🚀 Démarrage scraping pour {target_user_id}")
                
                await update_scraping_status({
                    "status": "running",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "triggered_by": target_user_id
                })
                
                videos = await fetch_all_sources_async(
                    queries=["nature", "technology", "education", "music", "sports"],
                    max_videos_per_source=30,
                    include_sample=False
                )
                
                if videos:
                    clips_col = await get_collection('smartclips')
                    saved = 0
                    for video in videos:
                        result = await clips_col.update_one(
                            {"id": video["id"]},
                            {"$set": video},
                            upsert=True
                        )
                        if result.upserted_id:
                            saved += 1
                    
                    print(f"✅ {saved} nouvelles vidéos ajoutées")
                    
                    if target_user_id != "anonymous" and saved > 0:
                        await mark_session_scraping_done(target_user_id)
                    
                    await update_scraping_status({
                        "status": "completed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "videos_found": len(videos),
                        "videos_added": saved
                    })
                    
                    redis = await get_redis()
                    if redis:
                        keys = await redis.keys("feed_v2:*")
                        if keys:
                            await redis.delete(*keys)
                
            except Exception as e:
                print(f"❌ Erreur scraping: {e}")
                await update_scraping_status({
                    "status": "error",
                    "error": str(e),
                    "failed_at": datetime.now(timezone.utc).isoformat()
                })
        
        if background_tasks:
            background_tasks.add_task(lambda: asyncio.create_task(run_scraping()))
        else:
            asyncio.create_task(run_scraping())
        
        return {
            "success": True,
            "message": "Scraping lancé en arrière-plan",
            "user_id": target_user_id,
            "estimated_time": "30-60 secondes"
        }
        
    except Exception as e:
        print(f"Error triggering scraping: {e}")
        return {"success": False, "error": str(e)}

@router.get("/scraping-status")
async def get_scraping_status(request: Request):
    """Récupérer le statut du scraping en cours"""
    await rate_limit(request, "stats")
    
    try:
        from app.services.smartclips_service import get_scraping_status
        status = await get_scraping_status()
        if '_id' in status:
            status['_id'] = str(status['_id'])
        return status
    except Exception as e:
        print(f"Error getting scraping status: {e}")
        return {"status": "unknown", "error": str(e)}

# ========== ONBOARDING ==========
@router.get("/onboarding-required")
async def check_onboarding_required(
    request: Request,
    user_id: str = Query(..., min_length=1, max_length=100)
):
    """Vérifier si l'onboarding est requis pour cet utilisateur"""
    await rate_limit(request, "preferences", user_id)
    
    try:
        from app.services.smartclips_service import get_user_preferences
        prefs = await get_user_preferences(user_id)
        
        onboarding_completed = prefs is not None and prefs.get("onboarding_completed", False)
        
        return {
            "required": not onboarding_completed,
            "user_id": user_id
        }
    except Exception as e:
        print(f"Error checking onboarding: {e}")
        return {"required": True, "user_id": user_id}

@router.get("/available-tags")
async def get_available_tags(request: Request):
    """Récupérer les tags disponibles pour l'onboarding"""
    await rate_limit(request, "tags")
    
    async def _fetch_tags():
        try:
            from app.services.smartclips_service import get_available_tags
            return {"tags": await get_available_tags()}
        except Exception as e:
            print(f"Error getting tags: {e}")
            return {"tags": ["education", "science", "technology", "nature", "art"]}
    
    return await get_cached("available_tags_v2", _fetch_tags, CACHE_TTL["tags"])

# ========== PRÉFÉRENCES ==========
@router.post("/preferences")
async def set_preferences(
    request: Request,
    preferences: PreferencesRequest
):
    """Définir les préférences utilisateur (onboarding)"""
    await rate_limit(request, "preferences", preferences.user_id)
    
    try:
        from app.services.smartclips_service import set_user_preferences
        
        success = await set_user_preferences(
            preferences.user_id,
            preferences.favorite_tags
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Erreur sauvegarde préférences")
        
        redis = await get_redis()
        if redis:
            await redis.delete(f"prefs:{preferences.user_id}")
            keys = await redis.keys(f"feed_v2:{preferences.user_id}:*")
            if keys:
                await redis.delete(*keys)
        
        return {
            "success": True,
            "user_id": preferences.user_id,
            "favorite_tags": preferences.favorite_tags
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error setting preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preferences")
async def get_preferences(
    request: Request,
    user_id: str = Query(..., min_length=1, max_length=100)
):
    """Récupérer les préférences utilisateur"""
    await rate_limit(request, "preferences", user_id)
    
    async def _fetch_prefs():
        try:
            from app.services.smartclips_service import get_user_preferences
            prefs = await get_user_preferences(user_id)
            
            if not prefs:
                return {"user_id": user_id, "favorite_tags": [], "onboarding_completed": False}
            
            if '_id' in prefs:
                del prefs['_id']
            
            return prefs
        except Exception as e:
            print(f"Error getting preferences: {e}")
            return {"user_id": user_id, "favorite_tags": [], "onboarding_completed": False}
    
    return await get_cached(f"prefs:{user_id}", _fetch_prefs, CACHE_TTL["preferences"])

# ========== PROGRESSION ==========
@router.post("/progress")
async def update_progress(
    request: Request,
    progress: ProgressRequest
):
    """Mettre à jour la progression de l'utilisateur"""
    await rate_limit(request, "progress", progress.user_id)
    
    try:
        from app.services.smartclips_service import update_user_progress
        
        success = await update_user_progress(progress.user_id, progress.last_watched_index)
        
        return {
            "success": success,
            "user_id": progress.user_id,
            "last_watched_index": progress.last_watched_index
        }
    except Exception as e:
        print(f"Error updating progress: {e}")
        return {"success": False, "error": str(e)}

@router.get("/progress")
async def get_progress(
    request: Request,
    user_id: str = Query(..., min_length=1, max_length=100)
):
    """Récupérer la progression utilisateur"""
    await rate_limit(request, "progress", user_id)
    
    try:
        from app.services.smartclips_service import get_user_progress
        progress = await get_user_progress(user_id)
        
        if not progress:
            return {"user_id": user_id, "last_watched_index": 0}
        
        if '_id' in progress:
            del progress['_id']
        
        return progress
    except Exception as e:
        print(f"Error getting progress: {e}")
        return {"user_id": user_id, "last_watched_index": 0}

# ========== VIDÉOS VUES ==========
@router.post("/watched")
async def mark_watched(
    request: Request,
    watched: WatchedRequest
):
    """Marquer une vidéo comme vue"""
    await rate_limit(request, "watched", watched.user_id)
    
    try:
        from app.services.smartclips_service import mark_video_watched, get_watched_count
        
        success = await mark_video_watched(watched.user_id, watched.video_id)
        
        watched_count = await get_watched_count(watched.user_id)
        
        return {
            "success": success,
            "user_id": watched.user_id,
            "video_id": watched.video_id,
            "total_watched": watched_count
        }
    except Exception as e:
        print(f"Error marking watched: {e}")
        return {"success": False, "error": str(e)}

# ========== STATISTIQUES ==========
@router.get("/stats")
async def get_user_stats(
    request: Request,
    user_id: str = Query(..., min_length=1, max_length=100)
):
    """Récupérer les statistiques utilisateur"""
    await rate_limit(request, "stats", user_id)
    
    async def _fetch_stats():
        try:
            from app.services.smartclips_service import (
                get_watched_count,
                get_total_videos_count,
                should_trigger_scraping
            )
            
            watched_task = get_watched_count(user_id)
            total_task = get_total_videos_count()
            scrape_task = should_trigger_scraping(user_id)
            
            watched = await watched_task
            total = await total_task
            should_scrape = await scrape_task
            
            return {
                "user_id": user_id,
                "videos_watched": watched,
                "total_videos": total,
                "remaining": max(0, total - watched),
                "progress_percentage": round((watched / total * 100) if total > 0 else 0, 2),
                "scraping_needed": should_scrape,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {
                "user_id": user_id,
                "videos_watched": 0,
                "total_videos": 0,
                "remaining": 0,
                "progress_percentage": 0,
                "scraping_needed": False
            }
    
    return await get_cached(f"stats:{user_id}", _fetch_stats, CACHE_TTL["stats"])
