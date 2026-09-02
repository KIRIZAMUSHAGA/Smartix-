"""
API endpoints temps réel pour les réactions story
Géré avec throttling, cache Redis, pagination et agrégation côté backend
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request, Query, BackgroundTasks
from fastapi.websockets import WebSocketState
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import json
import asyncio
import hashlib
import os
import uuid
import tempfile
import subprocess
import httpx
import time
import re
import ipaddress
from pathlib import Path
from enum import Enum
from urllib.parse import urlparse

from db import get_collection
from middleware.auth_middleware import get_current_user, get_current_user_optional
from middleware.rate_limiter import rate_limiter
from utils.story_reactions_handler import process_story_reaction, stream_manager
from utils.websocket_manager import ws_manager
from cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stories", tags=["story-reactions"])

# =============================
# CONSTANTES
# =============================
CACHE_TTL_LIKES = 60  # 1 minute
CACHE_TTL_COMMENTS = 300  # 5 minutes
MAX_COMMENTS_PER_REQUEST = 50
MAX_REPLIES_PER_COMMENT = 20
MAX_COMMENT_LENGTH = 40
MAX_REPLY_LENGTH = 25
HEARTBEAT_INTERVAL = 30  # secondes
HEARTBEAT_TIMEOUT = 90  # secondes (3x heartbeat interval)

# Constantes pour l'export vidéo
EXPORTS_FOLDER = os.environ.get('EXPORTS_FOLDER', os.path.join(os.path.dirname(__file__), '../../exports'))
EXPORT_RETENTION_SECONDS = 3600  # 1 heure
MAX_EXPORT_SIZE_MB = 100
MAX_IMAGE_SIZE_MB = 20
MAX_DOWNLOAD_TIMEOUT = 30
DOWNLOAD_RETRY_COUNT = 3
EXPORT_TASK_TTL = 7200  # 2 heures

# Liste blanche des domaines autorisés pour les téléchargements
ALLOWED_DOMAINS = os.environ.get('ALLOWED_DOWNLOAD_DOMAINS', 'localhost,127.0.0.1,cdn.example.com').split(',')
BLOCKED_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),
]

FFMPEG_QUALITY_PRESETS = {
    'low': {'crf': 23, 'preset': 'veryfast', 'bitrate': '500k'},
    'medium': {'crf': 18, 'preset': 'fast', 'bitrate': '1000k'},
    'high': {'crf': 12, 'preset': 'medium', 'bitrate': '2000k'},
    'ultra': {'crf': 8, 'preset': 'slow', 'bitrate': '4000k'}
}

# Liste blanche des filtres FFmpeg autorisés
ALLOWED_FILTERS = {
    'brightness': {'type': 'float', 'min': 0, 'max': 200, 'default': 100},
    'contrast': {'type': 'float', 'min': 0, 'max': 200, 'default': 100},
    'saturation': {'type': 'float', 'min': 0, 'max': 200, 'default': 100},
    'hue': {'type': 'float', 'min': -360, 'max': 360, 'default': 0},
    'blur': {'type': 'float', 'min': 0, 'max': 20, 'default': 0},
}

# Assurer l'existence du dossier d'exports
Path(EXPORTS_FOLDER).mkdir(parents=True, exist_ok=True)


# =============================
# MODÈLES
# =============================
class ReactionCreate(BaseModel):
    """Modèle pour créer une réaction"""
    type: str = Field(..., description="Type de réaction: like, comment")
    content: Optional[str] = Field(None, description="Contenu pour les commentaires")
    comment_id: Optional[str] = Field(None, description="ID du commentaire parent pour les réponses")


class CommentCreate(BaseModel):
    """Modèle pour créer un commentaire - user data from JWT"""
    text: str = Field(..., max_length=MAX_COMMENT_LENGTH, description="Texte du commentaire")


class ReplyCreate(BaseModel):
    """Modèle pour créer une réponse - user data from JWT"""
    text: str = Field(..., max_length=MAX_REPLY_LENGTH, description="Texte de la réponse")


class VideoExportRequest(BaseModel):
    """Requête d'export vidéo"""
    image_url: Optional[str] = Field(None, description="URL de l'image de la story")
    music_url: Optional[str] = Field(None, description="URL de la musique (optionnel)")
    duration: float = Field(5.0, ge=1.0, le=60.0, description="Durée en secondes")
    filters: Optional[dict] = Field(None, description="Filtres à appliquer")
    elements: Optional[List[dict]] = Field(None, description="Éléments (textes, stickers)")
    text_style: Optional[dict] = Field(None, description="Style du texte")
    quality: str = Field('high', description="Qualité vidéo: low, medium, high, ultra")
    output_format: str = Field('mp4', description="Format de sortie")


class ExportTaskStatus(str, Enum):
    """Statuts possibles pour une tâche d'export"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# =============================
# GESTIONNAIRE DE TÂCHES D'EXPORT AVEC REDIS
# =============================
class ExportTaskManager:
    """Gestionnaire de tâches d'export avec Redis pour persistance et scaling"""
    
    REDIS_PREFIX = "export:task:"
    USER_TASKS_PREFIX = "export:user:"
    TASK_TTL = EXPORT_TASK_TTL
    
    @classmethod
    async def create_task(cls, task_id: str, user_id: str, data: dict) -> None:
        """Crée une nouvelle tâche d'export et l'associe à l'utilisateur"""
        data['created_at'] = data['created_at'].isoformat() if isinstance(data['created_at'], datetime) else data['created_at']
        
        await redis_cache.setex(
            f"{cls.REDIS_PREFIX}{task_id}",
            cls.TASK_TTL,
            json.dumps(data, default=str)
        )
        
        await redis_cache.zadd(
            f"{cls.USER_TASKS_PREFIX}{user_id}",
            {task_id: data['created_at']}
        )
    
    @classmethod
    async def get_task(cls, task_id: str) -> Optional[dict]:
        """Récupère une tâche d'export"""
        data = await redis_cache.get(f"{cls.REDIS_PREFIX}{task_id}")
        if data:
            task = json.loads(data)
            for date_field in ['created_at', 'completed_at']:
                if task.get(date_field):
                    try:
                        task[date_field] = datetime.fromisoformat(task[date_field].replace('Z', '+00:00'))
                    except (ValueError, AttributeError):
                        pass
            return task
        return None
    
    @classmethod
    async def update_task(cls, task_id: str, updates: dict) -> None:
        """Met à jour une tâche d'export"""
        task = await cls.get_task(task_id)
        if task:
            for key, value in updates.items():
                if isinstance(value, datetime):
                    updates[key] = value.isoformat()
            task.update(updates)
            await cls.create_task(task_id, task.get('user_id'), task)
    
    @classmethod
    async def delete_task(cls, task_id: str, user_id: str) -> None:
        """Supprime une tâche d'export"""
        await redis_cache.delete(f"{cls.REDIS_PREFIX}{task_id}")
        await redis_cache.zrem(f"{cls.USER_TASKS_PREFIX}{user_id}", task_id)
    
    @classmethod
    async def get_user_tasks(cls, user_id: str, page: int = 1, limit: int = 20) -> tuple[List[dict], int]:
        """Récupère les tâches d'un utilisateur avec pagination"""
        key = f"{cls.USER_TASKS_PREFIX}{user_id}"
        
        total = await redis_cache.zcard(key)
        
        start = (page - 1) * limit
        end = start + limit - 1
        task_ids = await redis_cache.zrevrange(key, start, end)
        
        tasks = []
        for task_id in task_ids:
            task = await cls.get_task(task_id)
            if task:
                tasks.append(task)
        
        return tasks, total


# =============================
# UTILITAIRES (déplacés en haut pour disponibilité)
# =============================

def sanitize_story_id(story_id: str) -> Optional[str]:
    """Valide et nettoie un ID de story"""
    if not story_id or len(story_id) > 100:
        return None
    if ObjectId.is_valid(story_id):
        return story_id
    if re.match(r'^[a-zA-Z0-9_-]+$', story_id):
        return story_id
    return None


async def invalidate_comments_cache(story_id: str):
    """Invalider le cache des commentaires"""
    cache_key = generate_cache_key(story_id, prefix="comments")
    await redis_cache.delete(cache_key)


def sanitize_filters(filters: Optional[dict]) -> dict:
    """Sanitize les filtres avec whitelist stricte"""
    if not filters:
        return {}
    
    sanitized = {}
    for key, value in filters.items():
        if key in ALLOWED_FILTERS:
            config = ALLOWED_FILTERS[key]
            try:
                if config['type'] == 'float':
                    val = float(value)
                else:
                    val = int(value)
                val = max(config['min'], min(config['max'], val))
                sanitized[key] = val
            except (ValueError, TypeError):
                sanitized[key] = config['default']
    return sanitized


def generate_ffmpeg_filter_chain(filters: Optional[dict] = None) -> str:
    """Génère la chaîne de filtres FFmpeg avec whitelist stricte"""
    filter_parts = []
    
    filter_mapping = {
        'brightness': lambda v: f"eq=brightness={v/100:.2f}",
        'contrast': lambda v: f"eq=contrast={v/100:.2f}",
        'saturation': lambda v: f"eq=saturation={v/100:.2f}",
        'hue': lambda v: f"hue=h={v}",
        'blur': lambda v: f"gblur=sigma={v:.2f}"
    }
    
    if filters:
        for key, mapper in filter_mapping.items():
            if key in filters:
                value = filters[key]
                config = ALLOWED_FILTERS[key]
                if config['min'] <= value <= config['max']:
                    filter_parts.append(mapper(value))
    
    filter_parts.append("scale=1080:1920:force_original_aspect_ratio=decrease")
    filter_parts.append("pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
    
    return ",".join(filter_parts)


def validate_url_safety(url: str) -> bool:
    """Valide qu'une URL est sûre (pas de SSRF)"""
    try:
        parsed = urlparse(url)
        
        if parsed.scheme not in ['http', 'https']:
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
        
        allowed = False
        for allowed_domain in ALLOWED_DOMAINS:
            if hostname == allowed_domain or hostname.endswith(f'.{allowed_domain}'):
                allowed = True
                break
        
        if not allowed:
            logger.warning(f"Domain {hostname} not in whitelist")
            return False
        
        try:
            ip = ipaddress.ip_address(hostname)
            for blocked_range in BLOCKED_IP_RANGES:
                if ip in blocked_range:
                    logger.warning(f"IP {hostname} in blocked range")
                    return False
        except ValueError:
            pass
        
        return True
        
    except Exception as e:
        logger.error(f"URL validation error: {e}")
        return False


async def validate_story_id(story_id: str) -> str:
    """Dependency pour valider et sanitizer les IDs de story"""
    if not story_id or len(story_id) > 100:
        raise HTTPException(status_code=400, detail="ID de story invalide")
    
    if ObjectId.is_valid(story_id):
        return story_id
    
    if re.match(r'^[a-zA-Z0-9_-]+$', story_id):
        return story_id
    
    raise HTTPException(status_code=400, detail="Format d'ID de story invalide")


# =============================
# FONCTIONS DE BASE (après les utilitaires)
# =============================

async def verify_story_exists(story_id: str) -> bool:
    """Vérifier que la story existe en DB"""
    try:
        stories_col = get_collection('stories')
        
        query = {}
        if ObjectId.is_valid(story_id):
            query = {'$or': [{'id': story_id}, {'_id': ObjectId(story_id)}]}
        else:
            query = {'id': story_id}
        
        story = await stories_col.find_one(query)
        return story is not None
        
    except Exception as e:
        logger.error(f"❌ Error verifying story {story_id}: {e}")
        return False


def generate_cache_key(story_id: str, user_id: Optional[str] = None, prefix: str = "") -> str:
    """Générer une clé de cache unique"""
    key = f"story:{story_id}:{prefix}"
    if user_id:
        key += f":{user_id}"
    return key


async def get_cached_likes_count(story_id: str) -> int:
    """Récupérer le nombre de likes avec cache"""
    cache_key = generate_cache_key(story_id, prefix="likes")
    
    cached = await redis_cache.get(cache_key)
    if cached is not None:
        return int(cached)
    
    reactions_col = get_collection('story_reactions')
    count = await reactions_col.count_documents({
        'story_id': story_id,
        'type': 'like'
    })
    
    await redis_cache.setex(cache_key, CACHE_TTL_LIKES, count)
    return count


async def increment_likes_counter(story_id: str) -> int:
    """Incrémente le compteur de likes dénormalisé"""
    stories_col = get_collection('stories')
    await stories_col.update_one(
        {'_id': ObjectId(story_id) if ObjectId.is_valid(story_id) else story_id},
        {'$inc': {'likes_count': 1}},
        upsert=False
    )
    
    cache_key = generate_cache_key(story_id, prefix="likes")
    await redis_cache.delete(cache_key)
    
    return await get_cached_likes_count(story_id)


async def get_story_likes_count(story_id: str) -> int:
    """Récupère le compteur dénormalisé ou le calcule"""
    stories_col = get_collection('stories')
    story = await stories_col.find_one(
        {'_id': ObjectId(story_id) if ObjectId.is_valid(story_id) else story_id},
        {'likes_count': 1}
    )
    
    if story and 'likes_count' in story:
        return story['likes_count']
    
    return await get_cached_likes_count(story_id)


async def get_story_for_export(story_id: str) -> Optional[dict]:
    """Récupère les données d'une story pour l'export"""
    try:
        stories_col = get_collection('stories')
        
        query = {}
        if ObjectId.is_valid(story_id):
            query = {'$or': [{'id': story_id}, {'_id': ObjectId(story_id)}]}
        else:
            query = {'id': story_id}
        
        return await stories_col.find_one(query)
    except Exception as e:
        logger.error(f"Error fetching story for export: {e}")
        return None


async def download_file_with_retry(url: str, max_size_mb: int, timeout: tuple = (5, 30)) -> bytes:
    """Téléchargement avec retry, timeout et limitation de taille"""
    
    if not validate_url_safety(url):
        raise HTTPException(status_code=400, detail="URL non autorisée")
    
    last_error = None
    
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout[0], read=timeout[1])) as client:
        for attempt in range(DOWNLOAD_RETRY_COUNT):
            try:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                
                content_length = int(response.headers.get('content-length', 0))
                if content_length > max_size_mb * 1024 * 1024:
                    raise ValueError(f"File too large: {content_length} bytes (max {max_size_mb}MB)")
                
                content = response.content
                
                if len(content) > max_size_mb * 1024 * 1024:
                    raise ValueError(f"Download exceeded maximum size of {max_size_mb}MB")
                
                logger.info(f"✅ Downloaded {len(content)} bytes from {url[:100]}")
                return content
                
            except httpx.RequestError as e:
                last_error = e
                logger.warning(f"Download attempt {attempt + 1}/{DOWNLOAD_RETRY_COUNT} failed for {url[:100]}: {e}")
                if attempt < DOWNLOAD_RETRY_COUNT - 1:
                    await asyncio.sleep(2 ** attempt)
                continue
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
    
    raise HTTPException(status_code=400, detail=f"Failed to download after {DOWNLOAD_RETRY_COUNT} attempts: {last_error}")


async def run_ffmpeg_export(
    task_id: str,
    image_path: str,
    music_path: Optional[str],
    duration: float,
    output_path: str,
    filters: Optional[dict] = None,
    quality: str = 'high'
):
    """Exécute l'export FFmpeg avec timeout et gestion propre"""
    try:
        quality_settings = FFMPEG_QUALITY_PRESETS.get(quality, FFMPEG_QUALITY_PRESETS['high'])
        filter_chain = generate_ffmpeg_filter_chain(filters)
        
        cmd = [
            'ffmpeg', '-y',
            '-loop', '1', '-i', image_path,
            '-t', str(duration),
            '-vf', filter_chain,
            '-c:v', 'libx264',
            '-preset', quality_settings['preset'],
            '-crf', str(quality_settings['crf']),
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart'
        ]
        
        if music_path and os.path.exists(music_path):
            cmd.extend(['-i', music_path, '-c:a', 'aac', '-b:a', quality_settings['bitrate'], '-shortest'])
        else:
            cmd.append('-an')
        
        cmd.append(output_path)
        
        await ExportTaskManager.update_task(task_id, {'status': ExportTaskStatus.PROCESSING})
        
        logger.info(f"🎬 Starting FFmpeg export for task {task_id}")
        
        timeout_seconds = duration + 300
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
            
            if process.returncode == 0:
                await ExportTaskManager.update_task(task_id, {
                    'status': ExportTaskStatus.COMPLETED,
                    'progress': 100,
                    'video_url': f"/exports/{task_id}.mp4",
                    'completed_at': datetime.utcnow()
                })
                logger.info(f"✅ Video export completed for task {task_id}")
            else:
                error_msg = f"FFmpeg error (code {process.returncode}): {stderr.decode()}"
                raise Exception(error_msg)
                
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise Exception(f"FFmpeg timeout after {timeout_seconds} seconds")
            
    except Exception as e:
        logger.error(f"❌ FFmpeg export failed for task {task_id}: {e}")
        await ExportTaskManager.update_task(task_id, {
            'status': ExportTaskStatus.FAILED,
            'error': str(e),
            'progress': 0
        })


async def start_video_export_async(
    task_id: str,
    user_id: str,
    image_url: str,
    music_url: Optional[str],
    duration: float,
    output_path: str,
    filters: Optional[dict] = None,
    quality: str = 'high'
):
    """Lance l'export FFmpeg avec gestion des ressources"""
    
    image_path = None
    music_path = None
    
    try:
        image_data = await download_file_with_retry(image_url, MAX_IMAGE_SIZE_MB, (5, 30))
        image_path = os.path.join(tempfile.gettempdir(), f"{task_id}_image.jpg")
        with open(image_path, 'wb') as f:
            f.write(image_data)
        
        if music_url:
            try:
                music_data = await download_file_with_retry(music_url, MAX_EXPORT_SIZE_MB, (5, 30))
                music_path = os.path.join(tempfile.gettempdir(), f"{task_id}_music.mp3")
                with open(music_path, 'wb') as f:
                    f.write(music_data)
            except Exception as e:
                logger.warning(f"Could not download music: {e}")
                music_path = None
        
        await run_ffmpeg_export(
            task_id, image_path, music_path, duration, output_path, filters, quality
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in video export: {e}")
        await ExportTaskManager.update_task(task_id, {
            'status': ExportTaskStatus.FAILED,
            'error': str(e),
            'progress': 0
        })
    finally:
        for path in [image_path, music_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception as e:
                    logger.warning(f"Could not delete temp file {path}: {e}")


async def cleanup_old_exports():
    """Nettoie les exports plus vieux que EXPORT_RETENTION_SECONDS"""
    try:
        now = time.time()
        for filename in os.listdir(EXPORTS_FOLDER):
            filepath = os.path.join(EXPORTS_FOLDER, filename)
            if os.path.isfile(filepath):
                file_age = now - os.path.getmtime(filepath)
                if file_age > EXPORT_RETENTION_SECONDS:
                    os.unlink(filepath)
                    logger.info(f"Cleaned up old export: {filename}")
    except Exception as e:
        logger.error(f"Error cleaning up exports: {e}")


# =============================
# ENDPOINTS
# =============================

@router.post("/{story_id}/reactions")
@rate_limiter(limit=10, window=60)
async def add_story_reaction(
    story_id: str = Depends(validate_story_id),
    reaction: ReactionCreate = None,
    request: Request = None,
    current_user: dict = Depends(get_current_user_optional)
):
    """Ajouter une réaction à une story avec throttling et cache invalidation"""
    try:
        if not await verify_story_exists(story_id):
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        user_id = None
        username = None
        avatar = None
        
        if current_user:
            user_id = str(current_user.get("id") or current_user.get("_id", ""))
            username = current_user.get('full_name') or current_user.get('username', 'User')
            avatar = current_user.get('avatar')
        else:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
                try:
                    import jwt
                    import os
                    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
                    payload = jwt.decode(
                        token, 
                        SECRET_KEY, 
                        algorithms=["HS256"],
                        options={"verify_exp": True}
                    )
                    user_id = payload.get("user_id") or payload.get("sub")
                except jwt.ExpiredSignatureError:
                    raise HTTPException(status_code=401, detail="Token expiré")
                except jwt.InvalidTokenError as e:
                    logger.warning(f"Invalid token: {e}")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        reactions_col = get_collection('story_reactions')
        
        if reaction.type == 'like':
            try:
                inserted = await reactions_col.insert_one({
                    'story_id': story_id,
                    'user_id': user_id,
                    'type': reaction.type,
                    'content': reaction.content,
                    'created_at': datetime.utcnow(),
                    'comment_id': reaction.comment_id
                })
                
                likes_count = await increment_likes_counter(story_id)
                
                logger.info(f"✅ Like saved: story={story_id}, user={user_id}")
                
                return {
                    'success': True,
                    'saved': True,
                    'reaction_id': str(inserted.inserted_id),
                    'persistent_like_count': likes_count
                }
                
            except Exception as e:
                if 'duplicate key' in str(e).lower():
                    logger.info(f"User {user_id} already liked story {story_id}")
                    return {
                        'success': True,
                        'already_liked': True,
                        'message': 'Already liked'
                    }
                raise
        
        inserted = await reactions_col.insert_one({
            'story_id': story_id,
            'user_id': user_id,
            'type': reaction.type,
            'content': reaction.content,
            'created_at': datetime.utcnow(),
            'comment_id': reaction.comment_id
        })
        
        return {
            'success': True,
            'saved': True,
            'reaction_id': str(inserted.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error adding story reaction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{story_id}/interactions")
async def get_story_interactions(
    story_id: str = Depends(validate_story_id),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(MAX_COMMENTS_PER_REQUEST, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user_optional)
):
    """Récupérer l'état PERSISTANT complet d'une story avec PAGINATION"""
    try:
        user_id = None
        if current_user:
            user_id = str(current_user.get("id") or current_user.get("_id", ""))
        
        likes_count = await get_story_likes_count(story_id)
        
        user_has_liked = False
        if user_id:
            reactions_col = get_collection('story_reactions')
            has_liked = await reactions_col.find_one({
                'story_id': story_id,
                'type': 'like',
                'user_id': user_id
            })
            user_has_liked = has_liked is not None
        
        skip = (page - 1) * limit
        comments_col = get_collection('story_comments')
        
        total_comments = await comments_col.count_documents({'story_id': story_id})
        
        comments_cursor = await comments_col.find({
            'story_id': story_id
        }).sort('created_at', -1).skip(skip).limit(limit).to_list(length=limit)
        
        comments = []
        for comment in comments_cursor:
            replies_col = get_collection('story_replies')
            replies_cursor = await replies_col.find({
                'comment_id': str(comment['_id'])
            }).sort('created_at', 1).limit(MAX_REPLIES_PER_COMMENT).to_list(length=MAX_REPLIES_PER_COMMENT)
            
            replies = []
            for reply in replies_cursor:
                replies.append({
                    'id': str(reply['_id']),
                    'user_id': reply.get('user_id'),
                    'username': reply.get('username', 'User'),
                    'avatar': reply.get('avatar'),
                    'text': reply.get('text'),
                    'created_at': reply.get('created_at').isoformat() if hasattr(reply.get('created_at'), 'isoformat') else str(reply.get('created_at', ''))
                })
            
            comments.append({
                'id': str(comment.get('_id', '')),
                'user_id': comment.get('user_id'),
                'username': comment.get('username', 'User'),
                'avatar': comment.get('avatar'),
                'text': comment.get('text'),
                'likes': comment.get('likes', 0),
                'replies': replies,
                'reply_count': await replies_col.count_documents({'comment_id': str(comment['_id'])}),
                'created_at': comment.get('created_at', '').isoformat() if hasattr(comment.get('created_at'), 'isoformat') else str(comment.get('created_at', ''))
            })
        
        return {
            'success': True,
            'story_id': story_id,
            'likesCount': likes_count,
            'userHasLiked': user_has_liked,
            'comments': comments,
            'pagination': {
                'total': total_comments,
                'page': page,
                'limit': limit,
                'has_next': skip + limit < total_comments,
                'has_prev': page > 1
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting story interactions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{story_id}/reactions")
async def get_story_reactions(
    story_id: str = Depends(validate_story_id),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page")
):
    """Récupérer les réactions persistantes avec pagination"""
    try:
        reactions_col = get_collection('story_reactions')
        
        total = await reactions_col.count_documents({
            'story_id': story_id,
            'type': 'like'
        })
        
        skip = (page - 1) * limit
        reactions_cursor = await reactions_col.find({
            'story_id': story_id,
            'type': 'like'
        }).sort('created_at', -1).skip(skip).limit(limit).to_list(length=limit)
        
        reactions = []
        for reaction in reactions_cursor:
            reactions.append({
                'id': str(reaction.get('_id', '')),
                'user_id': reaction.get('user_id'),
                'username': reaction.get('username', 'User'),
                'avatar': reaction.get('avatar'),
                'created_at': reaction.get('created_at', '').isoformat() if hasattr(reaction.get('created_at'), 'isoformat') else str(reaction.get('created_at', ''))
            })
        
        return {
            'success': True,
            'reactions': reactions,
            'total': total,
            'page': page,
            'limit': limit,
            'has_next': skip + limit < total,
            'has_prev': page > 1
        }
        
    except Exception as e:
        logger.error(f"Error getting story reactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{story_id}/comments")
@rate_limiter(limit=5, window=60)
async def add_story_comment(
    story_id: str = Depends(validate_story_id),
    comment: CommentCreate = None,
    current_user: dict = Depends(get_current_user)
):
    """Ajouter un commentaire court sur une story avec validation"""
    try:
        if not await verify_story_exists(story_id):
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        if len(comment.text) > MAX_COMMENT_LENGTH:
            raise HTTPException(
                status_code=400, 
                detail=f"Commentaire trop long (max {MAX_COMMENT_LENGTH} caractères)"
            )
        
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        username = current_user.get('full_name') or current_user.get('username', 'User')
        avatar = current_user.get('avatar')
        
        comments_col = get_collection('story_comments')
        comment_doc = {
            'story_id': story_id,
            'user_id': user_id,
            'username': username,
            'avatar': avatar,
            'text': comment.text,
            'likes': 0,
            'created_at': datetime.utcnow()
        }
        
        result = await comments_col.insert_one(comment_doc)
        
        await invalidate_comments_cache(story_id)
        
        logger.info(f"✅ Comment saved: {result.inserted_id}")
        
        return {
            'success': True,
            'comment_id': str(result.inserted_id),
            'saved': True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding story comment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{story_id}/comments/{comment_id}/reply")
@rate_limiter(limit=5, window=60)
async def add_story_reply(
    story_id: str = Depends(validate_story_id),
    comment_id: str = None,
    reply: ReplyCreate = None,
    current_user: dict = Depends(get_current_user)
):
    """Ajouter une réponse courte à un commentaire - stockée dans collection séparée"""
    try:
        if not await verify_story_exists(story_id):
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=400, detail="Format de commentaire invalide")
        
        if len(reply.text) > MAX_REPLY_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Réponse trop longue (max {MAX_REPLY_LENGTH} caractères)"
            )
        
        comments_col = get_collection('story_comments')
        comment = await comments_col.find_one({'_id': ObjectId(comment_id)})
        if not comment:
            raise HTTPException(status_code=404, detail="Commentaire non trouvé")
        
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        username = current_user.get('full_name') or current_user.get('username', 'User')
        avatar = current_user.get('avatar')
        
        replies_col = get_collection('story_replies')
        reply_doc = {
            'comment_id': comment_id,
            'story_id': story_id,
            'user_id': user_id,
            'username': username,
            'avatar': avatar,
            'text': reply.text,
            'created_at': datetime.utcnow()
        }
        
        result = await replies_col.insert_one(reply_doc)
        
        await invalidate_comments_cache(story_id)
        
        logger.info(f"✅ Reply saved: {result.inserted_id}")
        
        return {
            'success': True,
            'reply_id': str(result.inserted_id),
            'saved': True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding story reply: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{story_id}/comments/{comment_id}/like")
@rate_limiter(limit=10, window=60)
async def like_story_comment(
    story_id: str = Depends(validate_story_id),
    comment_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Aimer un commentaire story"""
    try:
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=400, detail="Format de commentaire invalide")
        
        comments_col = get_collection('story_comments')
        
        comment = await comments_col.find_one({'_id': ObjectId(comment_id)})
        if not comment:
            raise HTTPException(status_code=404, detail="Commentaire non trouvé")
        
        await comments_col.update_one(
            {'_id': ObjectId(comment_id)},
            {'$inc': {'likes': 1}}
        )
        
        return {'success': True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error liking story comment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/{story_id}/reactions/ws")
async def websocket_reactions(websocket: WebSocket, story_id: str):
    """WebSocket endpoint pour temps réel reactions avec heartbeat robuste"""
    sanitized_id = sanitize_story_id(story_id) or story_id
    
    await ws_manager.connect(websocket, sanitized_id, "anonymous")
    
    last_pong = time.time()
    heartbeat_task = None
    timeout_task = None
    
    async def send_heartbeat():
        nonlocal last_pong
        while True:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({'type': 'ping', 'timestamp': time.time()})
            except Exception as e:
                logger.warning(f"Heartbeat send failed: {e}")
                break
    
    async def check_heartbeat_timeout():
        nonlocal last_pong
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if time.time() - last_pong > HEARTBEAT_TIMEOUT:
                logger.info(f"WebSocket heartbeat timeout")
                try:
                    await websocket.close(code=1000, reason="Heartbeat timeout")
                except:
                    pass
                break
    
    try:
        heartbeat_task = asyncio.create_task(send_heartbeat())
        timeout_task = asyncio.create_task(check_heartbeat_timeout())
        
        while True:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=HEARTBEAT_INTERVAL + 5)
            message = json.loads(data)
            
            msg_type = message.get('type')
            
            if msg_type == 'reaction':
                await ws_manager.send_to_client(websocket, {
                    'type': 'reaction_ack',
                    'success': True,
                    'timestamp': datetime.utcnow().isoformat()
                })
                
                await ws_manager.broadcast_to_story(
                    sanitized_id,
                    {
                        'type': 'reaction_update',
                        'reaction': message.get('reaction'),
                        'viewer_count': ws_manager.get_active_viewers(sanitized_id),
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                
            elif msg_type == 'pong':
                last_pong = time.time()
                
            elif msg_type == 'comment':
                await ws_manager.broadcast_to_story(
                    sanitized_id,
                    {
                        'type': 'comment_update',
                        'comment': message.get('comment'),
                        'viewer_count': ws_manager.get_active_viewers(sanitized_id),
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                
    except asyncio.TimeoutError:
        logger.info(f"WebSocket timeout")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if heartbeat_task:
            heartbeat_task.cancel()
        if timeout_task:
            timeout_task.cancel()
        await ws_manager.disconnect(websocket, sanitized_id)

# =============================
# ENDPOINTS EXPORT VIDÉO
# =============================

@router.post("/{story_id}/export/video")
@rate_limiter(limit=3, window=3600)
async def export_story_video(
    story_id: str = Depends(validate_story_id),
    export_request: Optional[VideoExportRequest] = None,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """Exporter une story en vidéo (image + audio) - Rate limité à 3/heure"""
    try:
        if not await verify_story_exists(story_id):
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        story = await get_story_for_export(story_id)
        if not story:
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        
        user_tasks, _ = await ExportTaskManager.get_user_tasks(user_id, page=1, limit=10)
        recent_exports = [t for t in user_tasks if t.get('created_at', datetime.min) > datetime.utcnow() - timedelta(hours=1)]
        if len(recent_exports) >= 5:
            raise HTTPException(status_code=429, detail="Trop d'exports récents")
        
        task_id = str(uuid.uuid4())
        
        image_url = story.get('media_url') or story.get('backgroundImage')
        if not image_url:
            raise HTTPException(status_code=400, detail="Cette story n'a pas d'image")
        
        music_url = story.get('music', {}).get('url') if story.get('music') else None
        duration = float(story.get('duration', 5.0))
        filters = story.get('filters', {})
        
        if export_request:
            image_url = export_request.image_url or image_url
            music_url = export_request.music_url or music_url
            duration = export_request.duration or duration
            if export_request.filters:
                filters.update(export_request.filters)
            quality = export_request.quality
        else:
            quality = 'high'
        
        filters = sanitize_filters(filters)
        
        if quality not in FFMPEG_QUALITY_PRESETS:
            quality = 'high'
        
        output_filename = f"{task_id}.mp4"
        output_path = os.path.join(EXPORTS_FOLDER, output_filename)
        
        await ExportTaskManager.create_task(task_id, user_id, {
            'task_id': task_id,
            'story_id': story_id,
            'user_id': user_id,
            'status': ExportTaskStatus.PENDING,
            'progress': 0,
            'created_at': datetime.utcnow(),
            'quality': quality,
            'duration': duration
        })
        
        background_tasks.add_task(
            start_video_export_async,
            task_id,
            user_id,
            image_url,
            music_url,
            duration,
            output_path,
            filters,
            quality
        )
        
        background_tasks.add_task(cleanup_old_exports)
        
        logger.info(f"🎬 Video export started for story {story_id}, task {task_id}, user {user_id}")
        
        return {
            'success': True,
            'task_id': task_id,
            'message': 'Génération vidéo en cours',
            'status_url': f'/api/stories/export/status/{task_id}'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting story video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/status/{task_id}")
async def get_export_status(
    task_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Récupérer le statut d'une génération vidéo"""
    try:
        task = await ExportTaskManager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Tâche non trouvée")
        
        response = {
            'task_id': task['task_id'],
            'status': task['status'],
            'progress': task['progress'],
            'created_at': task['created_at'].isoformat() if isinstance(task['created_at'], datetime) else task['created_at']
        }
        
        if task['status'] == ExportTaskStatus.COMPLETED:
            base_url = os.environ.get('API_BASE_URL', 'http://localhost:8000')
            response['video_url'] = f"{base_url}{task['video_url']}"
        elif task['status'] == ExportTaskStatus.FAILED:
            response['error'] = task.get('error', 'Erreur inconnue')
        
        if task.get('completed_at'):
            response['completed_at'] = task['completed_at'].isoformat() if isinstance(task['completed_at'], datetime) else task['completed_at']
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting export status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/export/{task_id}")
async def cancel_export(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Annuler une tâche d'export vidéo en cours"""
    try:
        task = await ExportTaskManager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Tâche non trouvée")
        
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        if task.get('user_id') and task['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Non autorisé")
        
        if task['status'] in [ExportTaskStatus.COMPLETED, ExportTaskStatus.FAILED, ExportTaskStatus.CANCELLED]:
            return {
                'success': False,
                'message': f"Tâche déjà {task['status']}"
            }
        
        await ExportTaskManager.update_task(task_id, {
            'status': ExportTaskStatus.CANCELLED,
            'error': 'Annulé par l\'utilisateur'
        })
        
        output_path = os.path.join(EXPORTS_FOLDER, f"{task_id}.mp4")
        if os.path.exists(output_path):
            try:
                os.unlink(output_path)
            except Exception as e:
                logger.warning(f"Could not delete partial export file: {e}")
        
        logger.info(f"🛑 Video export cancelled: {task_id}")
        
        return {
            'success': True,
            'message': 'Export annulé'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling export: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/list")
async def list_user_exports(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user)
):
    """Lister les exports vidéo de l'utilisateur courant"""
    try:
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        
        tasks, total = await ExportTaskManager.get_user_tasks(user_id, page, limit)
        
        exports = []
        base_url = os.environ.get('API_BASE_URL', 'http://localhost:8000')
        for task in tasks:
            export = {
                'task_id': task['task_id'],
                'story_id': task['story_id'],
                'status': task['status'],
                'progress': task['progress'],
                'created_at': task['created_at'].isoformat() if isinstance(task['created_at'], datetime) else task['created_at']
            }
            if task['status'] == ExportTaskStatus.COMPLETED and task.get('video_url'):
                export['video_url'] = f"{base_url}{task['video_url']}"
            if task.get('error'):
                export['error'] = task.get('error')
            exports.append(export)
        
        return {
            'success': True,
            'exports': exports,
            'pagination': {
                'total': total,
                'page': page,
                'limit': limit,
                'has_next': page * limit < total
            }
        }
        
    except Exception as e:
        logger.error(f"Error listing user exports: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/cleanup")
async def manual_cleanup_exports(
    current_user: dict = Depends(get_current_user)
):
    """Déclencher manuellement le nettoyage des exports (admin uniquement)"""
    if not current_user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    await cleanup_old_exports()
    
    return {
        'success': True,
        'message': 'Nettoyage des exports déclenché'
    }
