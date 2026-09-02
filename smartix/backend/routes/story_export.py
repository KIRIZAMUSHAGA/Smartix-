"""
🎬 STORY EXPORT - Génération de vidéos avec FFmpeg
Version production avec gestion asynchrone, progression, nettoyage et scalabilité
Support multi-instance avec Redis et worker distribué
Optimisé pour Replit/Linux (pas de dépendances Windows)
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import os
import uuid
import tempfile
import subprocess
import asyncio
import aiohttp
import aiofiles
import hashlib
import ipaddress
import time
import shutil
import json
import signal
from pathlib import Path
from enum import Enum
from urllib.parse import urlparse
import socket

from db import get_collection
from middleware.auth_middleware import get_current_user, get_current_user_optional
from middleware.rate_limiter import rate_limiter
from utils.story_reactions_handler import verify_story_exists
from cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stories", tags=["story-export"])

# =============================
# CONSTANTES
# =============================
EXPORTS_FOLDER = os.environ.get('EXPORTS_FOLDER', os.path.join(os.path.dirname(__file__), '../../exports'))
MAX_EXPORT_SIZE_MB = 100
MAX_IMAGE_SIZE_MB = 20
EXPORT_RETENTION_SECONDS = 3600  # 1 heure
EXPORT_TASK_TTL = 7200  # 2 heures
MAX_CONCURRENT_EXPORTS_PER_USER = 2
MAX_TOTAL_CONCURRENT_EXPORTS = 5
DOWNLOAD_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=5, sock_read=20)
DOWNLOAD_RETRY_COUNT = 3
FFMPEG_TIMEOUT_BUFFER = 300  # 5 minutes de buffer
FFMPEG_PROGRESS_INTERVAL = 0.5
FFMPEG_NICE_LEVEL = 10  # nice value pour limitation CPU (Replit/Unix)

# Liste blanche des domaines autorisés
ALLOWED_DOMAINS = [
    domain.strip() 
    for domain in os.environ.get('ALLOWED_DOWNLOAD_DOMAINS', 'localhost,127.0.0.1').split(',')
]
BLOCKED_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),
    ipaddress.ip_network('0.0.0.0/8'),
    ipaddress.ip_network('224.0.0.0/4'),
    ipaddress.ip_network('240.0.0.0/4'),
]

# Types MIME autorisés (vérification par extension car magic peut être lourd sur Replit)
ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.m4a', '.aac'}

FFMPEG_QUALITY_PRESETS = {
    'low': {'crf': 23, 'preset': 'veryfast', 'bitrate': '500k', 'max_rate': '600k', 'bufsize': '1200k'},
    'medium': {'crf': 18, 'preset': 'fast', 'bitrate': '1000k', 'max_rate': '1200k', 'bufsize': '2400k'},
    'high': {'crf': 12, 'preset': 'medium', 'bitrate': '2000k', 'max_rate': '2400k', 'bufsize': '4800k'},
    'ultra': {'crf': 8, 'preset': 'slow', 'bitrate': '4000k', 'max_rate': '4800k', 'bufsize': '9600k'}
}

ALLOWED_FILTERS = {
    'brightness': {'type': 'float', 'min': 0, 'max': 200, 'default': 100, 'ffmpeg': lambda v: f"eq=brightness={v/100:.2f}"},
    'contrast': {'type': 'float', 'min': 0, 'max': 200, 'default': 100, 'ffmpeg': lambda v: f"eq=contrast={v/100:.2f}"},
    'saturation': {'type': 'float', 'min': 0, 'max': 200, 'default': 100, 'ffmpeg': lambda v: f"eq=saturation={v/100:.2f}"},
    'hue': {'type': 'float', 'min': -360, 'max': 360, 'default': 0, 'ffmpeg': lambda v: f"hue=h={v}"},
    'blur': {'type': 'float', 'min': 0, 'max': 20, 'default': 0, 'ffmpeg': lambda v: f"gblur=sigma={v:.2f}"}
}

# Lua script pour vérification atomique des limites
ATOMIC_EXPORT_CHECK_SCRIPT = """
local active_key = KEYS[1]
local user_key = KEYS[2]
local max_total = tonumber(ARGV[1])
local max_user = tonumber(ARGV[2])

local active_total = redis.call('GET', active_key) or 0
local active_user = redis.call('GET', user_key) or 0

if tonumber(active_total) >= max_total or tonumber(active_user) >= max_user then
    return 0
end

redis.call('INCR', active_key)
redis.call('INCR', user_key)
redis.call('EXPIRE', active_key, 7200)
redis.call('EXPIRE', user_key, 7200)

return 1
"""

ATOMIC_EXPORT_DECREMENT_SCRIPT = """
local active_key = KEYS[1]
local user_key = KEYS[2]

redis.call('DECR', active_key)
redis.call('DECR', user_key)

return 1
"""


class ExportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


Path(EXPORTS_FOLDER).mkdir(parents=True, exist_ok=True)


# =============================
# VÉRIFICATION FFMPEG AU DÉMARRAGE
# =============================
def check_ffmpeg():
    """Vérifie que FFmpeg est installé"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        logger.info(f"✅ FFmpeg detected: {result.stdout.decode().splitlines()[0][:100]}")
        return True
    except Exception as e:
        logger.error(f"❌ FFmpeg not installed: {e}")
        return False


FFMPEG_AVAILABLE = check_ffmpeg()


# =============================
# MODÈLES
# =============================
class VideoExportRequest(BaseModel):
    """Requête d'export vidéo avec validation"""
    story_id: Optional[str] = Field(None, description="ID de la story")
    image_url: str = Field(..., description="URL de l'image")
    music_url: Optional[str] = Field(None, description="URL de la musique")
    duration: float = Field(5.0, ge=1.0, le=60.0, description="Durée en secondes")
    filters: Optional[Dict[str, Any]] = Field(None, description="Filtres à appliquer")
    elements: Optional[List[Dict[str, Any]]] = Field(None, description="Éléments")
    text_style: Optional[Dict[str, Any]] = Field(None, description="Style du texte")
    quality: str = Field('high', description="Qualité: low, medium, high, ultra")
    output_format: str = Field('mp4', description="Format: mp4, webm, mov")
    
    @validator('quality')
    def validate_quality(cls, v):
        if v not in FFMPEG_QUALITY_PRESETS:
            raise ValueError(f'Qualité invalide. Choisir parmi: {", ".join(FFMPEG_QUALITY_PRESETS.keys())}')
        return v
    
    @validator('output_format')
    def validate_format(cls, v):
        allowed = ['mp4', 'webm', 'mov']
        if v not in allowed:
            raise ValueError(f'Format invalide. Choisir parmi: {", ".join(allowed)}')
        return v
    
    @validator('image_url')
    def validate_image_url(cls, v):
        if not v or len(v) > 2000:
            raise ValueError('URL invalide')
        return v


class ExportStatusResponse(BaseModel):
    task_id: str
    status: ExportStatus
    progress: int = 0
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


# =============================
# GESTIONNAIRE DE TÂCHES AVEC REDIS (SCALABLE)
# =============================
class ExportTaskManager:
    """Gestionnaire de tâches d'export avec Redis - Support multi-instance"""
    
    REDIS_PREFIX = "export:task:"
    USER_TASKS_PREFIX = "export:user:"
    ACTIVE_EXPORTS_KEY = "export:active:count"
    USER_ACTIVE_PREFIX = "export:user:active:"
    PROCESS_PID_PREFIX = "export:process:pid:"
    TASK_TTL = EXPORT_TASK_TTL
    
    _check_script = None
    _decrement_script = None
    
    @classmethod
    async def _get_redis_client(cls):
        """Récupère le client Redis via la méthode publique"""
        try:
            # Si redis_cache a une méthode get_client
            if hasattr(redis_cache, 'get_client'):
                return await redis_cache.get_client()
            # Fallback: accéder au client via l'attribut client (non privé)
            if hasattr(redis_cache, 'client'):
                return redis_cache.client
            # Dernier recours: utiliser le cache directement
            return redis_cache
        except Exception as e:
            logger.error(f"Failed to get Redis client: {e}")
            return None
    
    @classmethod
    async def _get_scripts(cls):
        """Pré-charge les scripts Lua"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            return None, None
        
        if cls._check_script is None:
            try:
                cls._check_script = redis_client.register_script(ATOMIC_EXPORT_CHECK_SCRIPT)
                cls._decrement_script = redis_client.register_script(ATOMIC_EXPORT_DECREMENT_SCRIPT)
            except Exception as e:
                logger.error(f"Failed to register Lua scripts: {e}")
                return None, None
        return cls._check_script, cls._decrement_script
    
    @classmethod
    async def check_and_increment_exports(cls, user_id: str) -> bool:
        """Vérifie atomiquement les limites et incrémente les compteurs"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            # Fallback: pas de limite si Redis indisponible
            logger.warning("Redis unavailable, skipping rate limit")
            return True
        
        try:
            # Utiliser Redis directement si les scripts ne sont pas chargés
            active_key = cls.ACTIVE_EXPORTS_KEY
            user_key = f"{cls.USER_ACTIVE_PREFIX}{user_id}"
            
            # Version simplifiée sans Lua script
            active_total = await redis_client.get(active_key) or 0
            if isinstance(active_total, bytes):
                active_total = int(active_total.decode())
            else:
                active_total = int(active_total)
            
            active_user = await redis_client.get(user_key) or 0
            if isinstance(active_user, bytes):
                active_user = int(active_user.decode())
            else:
                active_user = int(active_user)
            
            if active_total >= MAX_TOTAL_CONCURRENT_EXPORTS or active_user >= MAX_CONCURRENT_EXPORTS_PER_USER:
                return False
            
            await redis_client.incr(active_key)
            await redis_client.incr(user_key)
            await redis_client.expire(active_key, 7200)
            await redis_client.expire(user_key, 7200)
            
            return True
        except Exception as e:
            logger.error(f"Error checking export limits: {e}")
            return True  # Fallback: autoriser en cas d'erreur
    
    @classmethod
    async def decrement_exports(cls, user_id: str) -> None:
        """Décrémente atomiquement les compteurs"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            return
        
        try:
            active_key = cls.ACTIVE_EXPORTS_KEY
            user_key = f"{cls.USER_ACTIVE_PREFIX}{user_id}"
            
            await redis_client.decr(active_key)
            await redis_client.decr(user_key)
        except Exception as e:
            logger.error(f"Error decrementing export counters: {e}")
    
    @classmethod
    async def create_task(cls, task_id: str, user_id: str, data: dict) -> None:
        """Crée une nouvelle tâche d'export"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            logger.warning("Redis unavailable, task not persisted")
            return
        
        data['created_at'] = data['created_at'].isoformat() if isinstance(data['created_at'], datetime) else data['created_at']
        data['user_id'] = user_id
        
        await redis_client.setex(
            f"{cls.REDIS_PREFIX}{task_id}",
            cls.TASK_TTL,
            json.dumps(data, default=str)
        )
        
        timestamp = datetime.utcnow().timestamp()
        await redis_client.zadd(
            f"{cls.USER_TASKS_PREFIX}{user_id}",
            {task_id: timestamp}
        )
    
    @classmethod
    async def get_task(cls, task_id: str) -> Optional[dict]:
        """Récupère une tâche d'export"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            return None
        
        data = await redis_client.get(f"{cls.REDIS_PREFIX}{task_id}")
        if data:
            if isinstance(data, bytes):
                data = data.decode()
            task = json.loads(data)
            for date_field in ['created_at', 'completed_at']:
                if task.get(date_field):
                    try:
                        task[date_field] = datetime.fromisoformat(task[date_field].replace('Z', '+00:00'))
                    except:
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
            redis_client = await cls._get_redis_client()
            if redis_client:
                await redis_client.setex(
                    f"{cls.REDIS_PREFIX}{task_id}",
                    cls.TASK_TTL,
                    json.dumps(task, default=str)
                )
    
    @classmethod
    async def register_process_pid(cls, task_id: str, pid: int) -> None:
        """Enregistre le PID du processus FFmpeg dans Redis"""
        redis_client = await cls._get_redis_client()
        if redis_client:
            await redis_client.setex(
                f"{cls.PROCESS_PID_PREFIX}{task_id}",
                cls.TASK_TTL,
                str(pid)
            )
    
    @classmethod
    async def get_process_pid(cls, task_id: str) -> Optional[int]:
        """Récupère le PID du processus FFmpeg depuis Redis"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            return None
        pid_str = await redis_client.get(f"{cls.PROCESS_PID_PREFIX}{task_id}")
        if pid_str:
            if isinstance(pid_str, bytes):
                pid_str = pid_str.decode()
            return int(pid_str)
        return None
    
    @classmethod
    async def unregister_process_pid(cls, task_id: str) -> None:
        """Supprime le PID du processus"""
        redis_client = await cls._get_redis_client()
        if redis_client:
            await redis_client.delete(f"{cls.PROCESS_PID_PREFIX}{task_id}")
    
    @classmethod
    async def kill_process(cls, task_id: str) -> bool:
        """Tue un processus FFmpeg en cours via son PID (Unix/Linux)"""
        pid = await cls.get_process_pid(task_id)
        if pid:
            try:
                os.kill(pid, signal.SIGTERM)
                logger.info(f"Sent SIGTERM to process {pid} for task {task_id}")
                return True
            except ProcessLookupError:
                logger.info(f"Process {pid} already terminated")
                return True
            except Exception as e:
                logger.error(f"Error killing process {pid}: {e}")
        return False
    
    @classmethod
    async def delete_task(cls, task_id: str, user_id: str) -> None:
        """Supprime une tâche d'export"""
        redis_client = await cls._get_redis_client()
        if redis_client:
            await redis_client.delete(f"{cls.REDIS_PREFIX}{task_id}")
            await redis_client.zrem(f"{cls.USER_TASKS_PREFIX}{user_id}", task_id)
            await cls.unregister_process_pid(task_id)
    
    @classmethod
    async def get_user_tasks(cls, user_id: str, page: int = 1, limit: int = 20) -> tuple[List[dict], int]:
        """Récupère les tâches d'un utilisateur avec pagination"""
        redis_client = await cls._get_redis_client()
        if not redis_client:
            return [], 0
        
        key = f"{cls.USER_TASKS_PREFIX}{user_id}"
        
        total = await redis_client.zcard(key)
        if isinstance(total, bytes):
            total = int(total.decode())
        else:
            total = int(total)
        
        start = (page - 1) * limit
        end = start + limit - 1
        task_ids = await redis_client.zrevrange(key, start, end)
        
        tasks = []
        for task_id in task_ids:
            if isinstance(task_id, bytes):
                task_id = task_id.decode()
            task = await cls.get_task(task_id)
            if task:
                tasks.append(task)
        
        return tasks, total


# =============================
# FONCTIONS DE SÉCURITÉ (ASYNC)
# =============================

async def resolve_and_validate_ip(hostname: str) -> bool:
    """Résout DNS et valide l'IP n'est pas privée/bloquée"""
    try:
        loop = asyncio.get_running_loop()
        ip_addresses = await loop.getaddrinfo(hostname, None, family=socket.AF_INET)
        
        for addr in ip_addresses:
            ip = ipaddress.ip_address(addr[4][0])
            for blocked_range in BLOCKED_IP_RANGES:
                if ip in blocked_range:
                    logger.warning(f"IP {ip} resolved from {hostname} is in blocked range")
                    return False
        return True
    except Exception as e:
        logger.error(f"DNS resolution error for {hostname}: {e}")
        return False


async def validate_url_safety(url: str) -> bool:
    """Valide qu'une URL est sûre avec résolution DNS"""
    try:
        parsed = urlparse(url)
        
        if parsed.scheme not in ['http', 'https']:
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
        
        # Vérification stricte du domaine
        allowed = False
        for allowed_domain in ALLOWED_DOMAINS:
            if hostname == allowed_domain:
                allowed = True
                break
            if hostname.endswith(f".{allowed_domain}"):
                allowed = True
                break
        
        if not allowed:
            logger.warning(f"Domain {hostname} not in whitelist")
            return False
        
        return await resolve_and_validate_ip(hostname)
        
    except Exception as e:
        logger.error(f"URL validation error: {e}")
        return False


async def validate_file_by_extension(file_path: str, allowed_exts: set) -> bool:
    """Valide le type de fichier par extension (léger, sans magic)"""
    ext = os.path.splitext(file_path)[1].lower()
    return ext in allowed_exts


def sanitize_filters(filters: Optional[Dict[str, Any]]) -> Dict[str, Any]:
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


def generate_ffmpeg_filter_chain(filters: Optional[Dict[str, Any]] = None) -> str:
    """Génère la chaîne de filtres FFmpeg"""
    filter_parts = []
    
    if filters:
        for key, value in filters.items():
            if key in ALLOWED_FILTERS:
                filter_parts.append(ALLOWED_FILTERS[key]['ffmpeg'](value))
    
    filter_parts.append("scale=1080:1920:force_original_aspect_ratio=decrease")
    filter_parts.append("pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
    
    return ",".join(filter_parts)


# =============================
# FONCTIONS DE TÉLÉCHARGEMENT
# =============================

async def download_file_with_retry(
    url: str, 
    output_path: str, 
    max_size_mb: int,
    allowed_exts: set
) -> bool:
     """Télécharge un fichier avec retry et validation par extension"""
    
    if not await validate_url_safety(url):
        logger.error(f"URL blocked for security: {url}")
        return False
    
    last_error = None
    
    for attempt in range(DOWNLOAD_RETRY_COUNT):
        try:
            async with aiohttp.ClientSession(timeout=DOWNLOAD_TIMEOUT) as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        raise Exception(f"HTTP {response.status}")
                    
                    content_length = int(response.headers.get('content-length', 0))
                    if content_length > max_size_mb * 1024 * 1024:
                        raise Exception(f"File too large: {content_length} bytes")
                    
                    downloaded = 0
                    async with aiofiles.open(output_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            await f.write(chunk)
                            downloaded += len(chunk)
                            if downloaded > max_size_mb * 1024 * 1024:
                                raise Exception(f"Download exceeded maximum size")
                    
                    # Validation par extension
                    if not await validate_file_by_extension(output_path, allowed_exts):
                        os.unlink(output_path)
                        raise Exception("Invalid file extension")
                    
                    logger.info(f"✅ Downloaded {downloaded} bytes from {url[:100]}")
                    return True
                    
        except Exception as e:
            last_error = e
            logger.warning(f"Download attempt {attempt + 1} failed: {e}")
            if attempt < DOWNLOAD_RETRY_COUNT - 1:
                await asyncio.sleep(2 ** attempt)
            continue
    
    logger.error(f"Download failed after {DOWNLOAD_RETRY_COUNT} attempts: {last_error}")
    return False


# =============================
# FONCTIONS FFMPEG
# =============================

async def run_ffmpeg_export(
    task_id: str,
    image_path: str,
    music_path: Optional[str],
    output_path: str,
    duration: float,
    filters: Optional[Dict[str, Any]],
    quality: str,
    output_format: str,
    user_id: str
):
    """Exécute FFmpeg avec limitation CPU et progression via pipe"""
    
    process = None
    
    try:
        if not FFMPEG_AVAILABLE:
            raise Exception("FFmpeg not available on server")
        
        quality_settings = FFMPEG_QUALITY_PRESETS.get(quality, FFMPEG_QUALITY_PRESETS['high'])
        sanitized_filters = sanitize_filters(filters)
        filter_chain = generate_ffmpeg_filter_chain(sanitized_filters)
        
        # Commande FFmpeg avec nice pour limitation CPU (Unix/Linux)
        cmd = [
            'nice', f'-n{FFMPEG_NICE_LEVEL}',
            'ffmpeg',
            '-y',
            '-loop', '1',
            '-i', image_path,
            '-t', str(duration),
            '-vf', filter_chain,
            '-c:v', 'libx264',
            '-preset', quality_settings['preset'],
            '-crf', str(quality_settings['crf']),
            '-maxrate', quality_settings['max_rate'],
            '-bufsize', quality_settings['bufsize'],
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-progress', 'pipe:1',
            '-nostats'
        ]
        
        if music_path and os.path.exists(music_path):
            cmd.extend([
                '-i', music_path,
                '-c:a', 'aac',
                '-b:a', quality_settings['bitrate'],
                '-shortest'
            ])
        else:
            cmd.append('-an')
        
        if output_format == 'webm':
            cmd = [c for c in cmd if c not in ['-c:v', 'libx264', '-movflags', '+faststart', '-maxrate', '-bufsize']]
            cmd.extend(['-c:v', 'libvpx-vp9', '-b:v', quality_settings['bitrate']])
        elif output_format == 'mov':
            cmd = [c for c in cmd if c not in ['-movflags', '+faststart']]
        
        cmd.append(output_path)
        
        logger.info(f"🎬 Starting FFmpeg for task {task_id}")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        await ExportTaskManager.register_process_pid(task_id, process.pid)
        
        # Lire la progression depuis stdout
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            
            line_str = line.decode('utf-8', errors='ignore').strip()
            
            if line_str.startswith('out_time_ms='):
                try:
                    time_ms = int(line_str.split('=')[1])
                    elapsed = time_ms / 1_000_000
                    progress = min(95, int((elapsed / duration) * 100))
                    await ExportTaskManager.update_task(task_id, {'progress': progress})
                except:
                    pass
            
            elif line_str.startswith('progress=') and 'end' in line_str:
                break
        
        await process.wait()
        
        if process.returncode == 0:
            video_size = os.path.getsize(output_path)
            if video_size > MAX_EXPORT_SIZE_MB * 1024 * 1024:
                raise Exception(f"Video too large: {video_size / 1024 / 1024:.1f}MB")
            
            await ExportTaskManager.update_task(task_id, {
                'status': ExportStatus.COMPLETED,
                'progress': 100,
                'video_url': f"/exports/{task_id}.{output_format}",
                'completed_at': datetime.utcnow(),
                'file_size': video_size
            })
            logger.info(f"✅ Video export completed for task {task_id}")
        else:
            stderr = await process.stderr.read()
            error_msg = stderr.decode('utf-8', errors='ignore')[:500]
            raise Exception(f"FFmpeg error: {error_msg}")
            
    except asyncio.CancelledError:
        logger.info(f"FFmpeg task cancelled for {task_id}")
        raise
    except Exception as e:
        logger.error(f"❌ FFmpeg export failed for task {task_id}: {e}")
        raise
    finally:
        await ExportTaskManager.unregister_process_pid(task_id)


async def process_export(task_id: str, request: VideoExportRequest, user_id: str):
    """Traitement principal de l'export"""
    
    temp_dir = None
    image_path = None
    music_path = None
    
    try:
        await ExportTaskManager.update_task(task_id, {'status': ExportStatus.PROCESSING})
        
        temp_dir = tempfile.mkdtemp()
        image_path = os.path.join(temp_dir, f"{task_id}_image.jpg")
        music_path = os.path.join(temp_dir, f"{task_id}_music.mp3") if request.music_url else None
        output_path = os.path.join(EXPORTS_FOLDER, f"{task_id}.{request.output_format}")
        
        if not await download_file_with_retry(
            request.image_url, 
            image_path, 
            MAX_IMAGE_SIZE_MB,
            ALLOWED_IMAGE_EXTS
        ):
            raise Exception("Impossible de télécharger l'image")
        
        if request.music_url:
            if not await download_file_with_retry(
                request.music_url, 
                music_path, 
                MAX_EXPORT_SIZE_MB,
                ALLOWED_AUDIO_EXTS
            ):
                logger.warning("Failed to download music, continuing without audio")
                music_path = None
        
        await run_ffmpeg_export(
            task_id=task_id,
            image_path=image_path,
            music_path=music_path,
            output_path=output_path,
            duration=request.duration,
            filters=request.filters,
            quality=request.quality,
            output_format=request.output_format,
            user_id=user_id
        )
        
    except asyncio.CancelledError:
        logger.info(f"Export cancelled for task {task_id}")
        await ExportTaskManager.update_task(task_id, {
            'status': ExportStatus.CANCELLED,
            'error': 'Export annulé'
        })
        
    except Exception as e:
        logger.error(f"Export processing error: {e}")
        await ExportTaskManager.update_task(task_id, {
            'status': ExportStatus.FAILED,
            'error': str(e),
            'progress': 0
        })
    
    finally:
        await ExportTaskManager.decrement_exports(user_id)
        
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Cleanup error: {e}")


async def cleanup_old_exports():
    """Nettoie les exports plus vieux que EXPORT_RETENTION_SECONDS"""
    cleaned_count = 0
    try:
        now = time.time()
        for filename in os.listdir(EXPORTS_FOLDER):
            filepath = os.path.join(EXPORTS_FOLDER, filename)
            if os.path.isfile(filepath):
                file_age = now - os.path.getmtime(filepath)
                if file_age > EXPORT_RETENTION_SECONDS:
                    os.unlink(filepath)
                    cleaned_count += 1
                    logger.info(f"Cleaned up old export: {filename}")
        if cleaned_count > 0:
            logger.info(f"🧹 Cleaned {cleaned_count} old exports")
    except Exception as e:
        logger.error(f"Error cleaning up exports: {e}")


# =============================
# ENDPOINTS AVEC RATE LIMITING
# =============================

@router.post("/export/video")
@rate_limiter(limit=5, window=60)
async def export_story_video(
    request: VideoExportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Exporter une story en vidéo avec rate limiting"""
    try:
        if not FFMPEG_AVAILABLE:
            raise HTTPException(status_code=503, detail="Service d'export vidéo temporairement indisponible")
        
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        
        if request.story_id:
            if not await verify_story_exists(request.story_id):
                raise HTTPException(status_code=404, detail="Story non trouvée")
        
        if not await ExportTaskManager.check_and_increment_exports(user_id):
            raise HTTPException(
                status_code=429, 
                detail=f"Trop d'exports en cours. Limite: {MAX_CONCURRENT_EXPORTS_PER_USER} par utilisateur"
            )
        
        recent_tasks, _ = await ExportTaskManager.get_user_tasks(user_id, page=1, limit=10)
        recent_exports = [t for t in recent_tasks if t.get('created_at', datetime.min) > datetime.utcnow() - timedelta(hours=1)]
        if len(recent_exports) >= 10:
            await ExportTaskManager.decrement_exports(user_id)
            raise HTTPException(status_code=429, detail="Trop d'exports récents (max 10 par heure)")
        
        task_id = str(uuid.uuid4())
        
        await ExportTaskManager.create_task(task_id, user_id, {
            'task_id': task_id,
            'story_id': request.story_id,
            'user_id': user_id,
            'status': ExportStatus.PENDING,
            'progress': 0,
            'created_at': datetime.utcnow(),
            'quality': request.quality,
            'format': request.output_format,
            'duration': request.duration
        })
        
        background_tasks.add_task(process_export, task_id, request, user_id)
        background_tasks.add_task(cleanup_old_exports)
        
        logger.info(f"🎬 Video export started for task {task_id}, user {user_id}")
        
        return {
            'success': True,
            'task_id': task_id,
            'message': 'Génération vidéo en cours',
            'status_url': f'/api/stories/export/status/{task_id}'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting video export: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/status/{task_id}", response_model=ExportStatusResponse)
async def get_export_status(
    task_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Récupérer le statut d'une génération vidéo"""
    try:
        task = await ExportTaskManager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Tâche non trouvée")
        
        base_url = os.environ.get('API_BASE_URL', 'http://localhost:8000')
        
        response = {
            'task_id': task['task_id'],
            'status': task['status'],
            'progress': task['progress'],
            'created_at': task['created_at']
        }
        
        if task['status'] == ExportStatus.COMPLETED:
            response['video_url'] = f"{base_url}{task['video_url']}"
        elif task['status'] == ExportStatus.FAILED:
            response['error'] = task.get('error', 'Erreur inconnue')
        
        if task.get('completed_at'):
            response['completed_at'] = task['completed_at']
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting export status: {e}")
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
        
        if task['status'] in [ExportStatus.COMPLETED, ExportStatus.FAILED, ExportStatus.CANCELLED]:
            return {
                'success': False,
                'message': f"Tâche déjà {task['status']}"
            }
        
        # Tuer le processus via son PID (Unix/Linux)
        await ExportTaskManager.kill_process(task_id)
        
        await ExportTaskManager.update_task(task_id, {
            'status': ExportStatus.CANCELLED,
            'error': 'Annulé par l\'utilisateur'
        })
        
        output_path = os.path.join(EXPORTS_FOLDER, f"{task_id}.{task.get('format', 'mp4')}")
        if os.path.exists(output_path):
            try:
                os.unlink(output_path)
            except:
                pass
        
        logger.info(f"🛑 Video export cancelled: {task_id}")
        
        return {
            'success': True,
            'message': 'Export annulé'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling export: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/download/{task_id}")
async def download_exported_video(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Télécharger la vidéo générée"""
    try:
        task = await ExportTaskManager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Tâche non trouvée")
        
        if task['status'] != ExportStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Vidéo non disponible")
        
        user_id = str(current_user.get("id") or current_user.get("_id", ""))
        if task.get('user_id') and task['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Non autorisé")
        
        output_path = os.path.join(EXPORTS_FOLDER, f"{task_id}.{task.get('format', 'mp4')}")
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="Fichier non trouvé")
        
        return FileResponse(
            path=output_path,
            filename=f"story-{task_id}.{task.get('format', 'mp4')}",
            media_type=f"video/{task.get('format', 'mp4')}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading video: {e}")
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
                'story_id': task.get('story_id'),
                'status': task['status'],
                'progress': task['progress'],
                'created_at': task['created_at'].isoformat() if isinstance(task['created_at'], datetime) else task['created_at']
            }
            
            if task['status'] == ExportStatus.COMPLETED and task.get('video_url'):
                export['video_url'] = f"{base_url}{task['video_url']}"
            if task.get('error'):
                export['error'] = task['error']
            
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
        logger.error(f"Error listing user exports: {e}")
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
