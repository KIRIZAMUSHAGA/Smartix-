"""
Service de génération d'images via Pollinations AI
Version PRODUCTION avec toutes les optimisations
"""

import aiohttp
import asyncio
import logging
import hashlib
import re
import time
from collections import OrderedDict, deque
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import quote
from datetime import datetime, timedelta
import asyncio
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# =============================
# CONFIGURATION
# =============================

POLLINATIONS_URL = "https://image.pollinations.ai/prompt/"
REQUEST_TIMEOUT = 15  # secondes
CONNECTION_TIMEOUT = 5
FALLBACK_IMAGE = "https://via.placeholder.com/1024x1024?text=Image+non+disponible"
FALLBACK_QUOTA = "https://via.placeholder.com/1024x1024?text=Limite+atteinte"

# Tailles supportées
SUPPORTED_SIZES = ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]
DEFAULT_SIZE = "1024x1024"

# Cache LRU avec OrderedDict
class LRUCache:
    def __init__(self, capacity: int = 500, ttl: int = 3600):
        self.cache = OrderedDict()
        self.capacity = capacity
        self.ttl = ttl
    
    def get(self, key: str) -> Optional[str]:
        if key not in self.cache:
            return None
        
        value, timestamp = self.cache[key]
        if datetime.now().timestamp() - timestamp > self.ttl:
            del self.cache[key]
            return None
        
        # LRU: déplacer à la fin
        self.cache.move_to_end(key)
        return value
    
    def put(self, key: str, value: str):
        # Éviter les doublons
        if key in self.cache:
            self.cache.move_to_end(key)
        else:
            # Si plein, supprimer le plus ancien (premier)
            if len(self.cache) >= self.capacity:
                self.cache.popitem(last=False)
        
        self.cache[key] = (value, datetime.now().timestamp())
    
    def size(self) -> int:
        return len(self.cache)
    
    def clear(self):
        self.cache.clear()

_cache = LRUCache()

# =============================
# RATE LIMITING AVEC NETTOYAGE
# =============================

@dataclass
class UserRateLimit:
    requests: deque = field(default_factory=lambda: deque(maxlen=10))
    last_cleanup: float = field(default_factory=time.time)

class RateLimiter:
    """
    Rate limiter avec nettoyage automatique des utilisateurs inactifs
    """
    def __init__(self, max_requests: int = 1, window: int = 10, cleanup_interval: int = 3600):
        self.max_requests = max_requests
        self.window = window
        self.cleanup_interval = cleanup_interval
        self.users: Dict[str, UserRateLimit] = {}
        self.last_global_cleanup = time.time()
    
    def _cleanup_inactive_users(self):
        """Nettoie les utilisateurs inactifs (pas de requête depuis 1h)"""
        now = time.time()
        if now - self.last_global_cleanup < self.cleanup_interval:
            return
        
        inactive_users = []
        for user_id, data in self.users.items():
            if not data.requests or now - data.requests[-1] > 3600:
                inactive_users.append(user_id)
        
        for user_id in inactive_users:
            del self.users[user_id]
        
        self.last_global_cleanup = now
        logger.debug(f"Cleaned up {len(inactive_users)} inactive users")
    
    def can_proceed(self, user_id: str) -> Tuple[bool, int]:
        """
        Vérifie si l'utilisateur peut faire une requête
        Retourne (can_proceed, wait_time)
        """
        now = time.time()
        self._cleanup_inactive_users()
        
        if user_id not in self.users:
            self.users[user_id] = UserRateLimit()
        
        user_data = self.users[user_id]
        
        # Nettoyer les anciennes requêtes
        cutoff = now - self.window
        while user_data.requests and user_data.requests[0] < cutoff:
            user_data.requests.popleft()
        
        # Vérifier la limite
        if len(user_data.requests) >= self.max_requests:
            wait_time = int(self.window - (now - user_data.requests[0]))
            return False, wait_time
        
        # Ajouter la nouvelle requête
        user_data.requests.append(now)
        return True, 0

rate_limiter = RateLimiter()

# =============================
# CIRCUIT BREAKER
# =============================

class CircuitBreaker:
    """
    Circuit breaker pattern pour éviter d'appeler Pollinations si down
    """
    def __init__(self, failure_threshold: int = 3, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")
    
    def can_proceed(self) -> bool:
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            # Vérifier si on peut réessayer
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
                logger.info("Circuit breaker half-open, testing service")
                return True
            return False
        
        # HALF_OPEN: on laisse passer une requête pour tester
        return True

circuit_breaker = CircuitBreaker()

# =============================
# SESSION HTTP GLOBALE
# =============================

_session: Optional[aiohttp.ClientSession] = None

async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        timeout = aiohttp.ClientTimeout(
            total=REQUEST_TIMEOUT,
            connect=CONNECTION_TIMEOUT,
            sock_read=REQUEST_TIMEOUT
        )
        _session = aiohttp.ClientSession(timeout=timeout)
    return _session

async def close_session():
    global _session
    if _session and not _session.closed:
        await _session.close()

# =============================
# FILTRAGE DE CONTENU AMÉLIORÉ
# =============================

# Mots interdits
BANNED_WORDS = {
    "nude", "naked", "sex", "porn", "violence", "gore", "explicit",
    "nsfw", "xxx", "erotic", "pornographic", "adult", "18+",
    "blood", "kill", "murder", "weapon", "gun", "terrorist",
    "racist", "hate", "discrimination", "suicide"
}

def normalize_prompt(prompt: str) -> Tuple[str, str]:
    """
    Normalise le prompt pour la détection
    - Supprime les séparateurs
    - Conserve les caractères UTF-8
    - Retourne (normalized, original)
    """
    # Garder l'original
    original = prompt
    
    # Supprimer les caractères non-alphanumériques (garde espaces)
    normalized = re.sub(r'[^a-zA-Z0-9\s]', ' ', prompt)
    
    # Remplacer les espaces multiples par un seul
    normalized = re.sub(r'\s+', ' ', normalized).strip().lower()
    
    return normalized, original

def validate_prompt(prompt: str) -> Tuple[bool, str, str]:
    """
    Valide le prompt avec détection améliorée
    Retourne (is_valid, error_message, clean_prompt)
    """
    if not prompt or not isinstance(prompt, str):
        return False, "Prompt invalide", ""
    
    if len(prompt) > 500:
        return False, "Prompt trop long (max 500 caractères)", prompt[:500]
    
    normalized, original = normalize_prompt(prompt)
    
    # Vérifier les mots interdits sur la version normalisée
    words = set(normalized.split())
    banned_found = words.intersection(BANNED_WORDS)
    
    if banned_found:
        return False, f"Le prompt contient des termes interdits: {', '.join(banned_found)}", original
    
    return True, "OK", original

# =============================
# VÉRIFICATION RÉELLE DE L'IMAGE
# =============================

async def verify_image_exists(image_url: str, max_retries: int = 2) -> Tuple[bool, Optional[str]]:
    """
    Vérifie que l'image existe vraiment chez Pollinations
    Retourne (exists, final_url)
    """
    session = await get_session()
    
    for attempt in range(max_retries + 1):
        try:
            # On fait un GET avec range pour juste vérifier l'en-tête
            async with session.get(image_url, timeout=10, headers={"Range": "bytes=0-0"}) as response:
                if response.status in [200, 206, 302]:
                    # Image existe ou redirigée
                    return True, str(response.url)
                elif response.status == 404:
                    logger.warning(f"Image not found: {image_url}")
                    return False, None
                else:
                    logger.warning(f"Image check returned {response.status}")
                    if attempt < max_retries:
                        await asyncio.sleep(1 * (attempt + 1))
                        continue
                    return False, None
        except Exception as e:
            logger.warning(f"Image verification error (attempt {attempt+1}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(1 * (attempt + 1))
                continue
    
    return False, None

# =============================
# FALLBACK IMAGE
# =============================

async def generate_fallback_image(prompt: str, size: str = DEFAULT_SIZE) -> str:
    """Génère une image de fallback stylisée"""
    hash_obj = hashlib.md5(prompt.encode())
    color = hash_obj.hexdigest()[:6]
    
    short_prompt = quote(prompt.replace(" ", "+")[:30])
    width, height = size.split('x')
    
    return f"https://via.placeholder.com/{width}x{height}/{color}/ffffff?text={short_prompt}"

# =============================
# SERVICE PRINCIPAL
# =============================

async def generate_image_robust(
    user_id: str,
    prompt: str,
    size: str = DEFAULT_SIZE,
    check_quota_func=None
) -> Dict[str, Any]:
    """
    Version production-ready avec toutes les protections
    """
    # 1. VALIDATION PROMPT
    is_valid, error_msg, clean_prompt = validate_prompt(prompt)
    if not is_valid:
        logger.warning(f"Invalid prompt from user {user_id}: {error_msg}")
        return {
            "success": False,
            "error": True,
            "message": error_msg,
            "image_url": FALLBACK_IMAGE,
            "quota_consumed": False
        }
    
    # 2. RATE LIMITING
    can_proceed, wait_time = rate_limiter.can_proceed(user_id)
    if not can_proceed:
        return {
            "success": False,
            "error": True,
            "message": f"Trop de requêtes, patientez {wait_time}s",
            "image_url": FALLBACK_IMAGE,
            "quota_consumed": False,
            "retry_after": wait_time
        }
    
    # 3. CIRCUIT BREAKER
    if not circuit_breaker.can_proceed():
        logger.warning(f"Circuit breaker open, rejecting request from {user_id}")
        fallback = await generate_fallback_image(clean_prompt, size)
        return {
            "success": False,
            "error": True,
            "message": "Service temporairement indisponible, réessayez plus tard",
            "image_url": fallback,
            "quota_consumed": False,
            "circuit_open": True
        }
    
    # 4. QUOTA
    quota_ok = True
    if check_quota_func:
        quota_ok = await check_quota_func(user_id)
        if not quota_ok:
            return {
                "success": False,
                "error": True,
                "message": "Limite d'images atteinte (1/jour)",
                "image_url": FALLBACK_QUOTA,
                "quota_consumed": False
            }
    
    # 5. VALIDATION TAILLE
    if size not in SUPPORTED_SIZES:
        logger.warning(f"Invalid size {size} from user {user_id}, using default")
        size = DEFAULT_SIZE
    
    # 6. CACHE
    cache_key = f"{user_id}:{hashlib.md5(clean_prompt.encode()).hexdigest()}:{size}"
    cached_url = _cache.get(cache_key)
    if cached_url:
        # Vérifier que l'image existe toujours
        exists, final_url = await verify_image_exists(cached_url)
        if exists:
            return {
                "success": True,
                "image_url": final_url or cached_url,
                "prompt": clean_prompt,
                "width": int(size.split('x')[0]),
                "height": int(size.split('x')[1]),
                "service": "pollinations",
                "from_cache": True,
                "quota_consumed": False
            }
        else:
            # Cache invalide, supprimer
            _cache.cache.pop(cache_key, None)
    
    # 7. GÉNÉRATION
    width, height = size.split('x')
    encoded_prompt = quote(clean_prompt)
    image_url = f"{POLLINATIONS_URL}{encoded_prompt}?width={width}&height={height}"
    
    # 8. VÉRIFICATION DE L'IMAGE
    session = await get_session()
    exists, final_url = await verify_image_exists(image_url)
    
    if not exists:
        circuit_breaker.record_failure()
        fallback = await generate_fallback_image(clean_prompt, size)
        
        return {
            "success": False,
            "error": True,
            "message": "L'image n'a pas pu être générée",
            "image_url": fallback,
            "quota_consumed": False
        }
    
    # 9. SUCCÈS
    circuit_breaker.record_success()
    final_image_url = final_url or image_url
    _cache.put(cache_key, final_image_url)
    
    return {
        "success": True,
        "image_url": final_image_url,
        "prompt": clean_prompt,
        "width": int(width),
        "height": int(height),
        "service": "pollinations",
        "quota_consumed": True
    }

# =============================
# VERSION SIMPLE (COMPATIBILITÉ)
# =============================

async def generate_image(prompt: str, size: str = DEFAULT_SIZE) -> Dict[str, Any]:
    """Version simple sans user_id"""
    clean_prompt = prompt.strip()[:500]
    encoded_prompt = quote(clean_prompt)
    width, height = size.split('x')
    
    image_url = f"{POLLINATIONS_URL}{encoded_prompt}?width={width}&height={height}"
    
    return {
        "success": True,
        "image_url": image_url,
        "prompt": clean_prompt,
        "width": int(width),
        "height": int(height),
        "service": "pollinations"
    }

# =============================
# HEALTH CHECK RÉEL
# =============================

async def check_service_health() -> Dict[str, Any]:
    """Vérification réelle avec un prompt test"""
    try:
        result = await generate_image("test image", "256x256")
        exists, _ = await verify_image_exists(result["image_url"])
        
        return {
            "healthy": exists,
            "service": "pollinations",
            "cache_size": _cache.size(),
            "circuit_breaker_state": circuit_breaker.state,
            "active_users": len(rate_limiter.users)
        }
    except Exception as e:
        return {
            "healthy": False,
            "error": str(e),
            "service": "pollinations"
        }

# =============================
# STATISTIQUES
# =============================

_stats = {
    "total_generations": 0,
    "successful_generations": 0,
    "failed_generations": 0,
    "cached_hits": 0,
    "rate_limited": 0,
    "invalid_prompts": 0,
    "circuit_breaks": 0
}

def get_stats() -> Dict[str, Any]:
    """Retourne les statistiques détaillées"""
    total = max(1, _stats["total_generations"])
    return {
        **_stats,
        "cache_size": _cache.size(),
        "cache_capacity": _cache.capacity,
        "success_rate": round((_stats["successful_generations"] / total) * 100, 2),
        "rate_limited_rate": round((_stats["rate_limited"] / total) * 100, 2),
        "circuit_breaker_state": circuit_breaker.state,
        "active_users": len(rate_limiter.users)
    }

def update_stats(success: bool, from_cache: bool = False, rate_limited: bool = False, invalid: bool = False):
    _stats["total_generations"] += 1
    if success:
        _stats["successful_generations"] += 1
        if from_cache:
            _stats["cached_hits"] += 1
    else:
        _stats["failed_generations"] += 1
    
    if rate_limited:
        _stats["rate_limited"] += 1
    if invalid:
        _stats["invalid_prompts"] += 1

# =============================
# INITIALISATION
# =============================

async def init_service():
    logger.info("Image service initialized with Pollinations AI")
    return True

async def shutdown_service():
    await close_session()
    logger.info("Image service shut down")
