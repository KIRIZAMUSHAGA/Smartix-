"""
RateLimitMiddleware — Rate limiting multi-bucket (Sprint Audit RL).

Améliorations vs version précédente :
  1. Multi-bucket : chaque endpoint peut imposer plusieurs fenêtres simultanées
     (ex: 5/min ET 100/jour). Si l'une dépasse → 429.
  2. Backend Redis (sliding window via ZSET) avec fallback in-memory si Redis
     est indisponible — les compteurs sont alors partagés entre workers.
  3. Identification par JWT vérifié (PyJWT) → fallback X-User-ID header
     (posé par auth_middleware) → fallback IP.
  4. Pattern matching wildcard (`/api/smartclips/*/like`) via fnmatch.
  5. Compteur Prometheus + log warning sur chaque 429.
  6. Headers complets : X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset,
     Retry-After (basés sur le bucket le plus restrictif).

Configuration : voir `backend/config/rate_limits.py`.
"""

import logging
import os
import time
from collections import defaultdict
from fnmatch import fnmatchcase
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

try:
    import jwt as pyjwt  # PyJWT
    _JWT_AVAILABLE = True
except ImportError:  # pragma: no cover
    pyjwt = None
    _JWT_AVAILABLE = False

try:
    from prometheus_client import Counter as _PromCounter
    rate_limit_exceeded_total = _PromCounter(
        "rate_limit_exceeded_total",
        "Nombre total de requêtes bloquées par rate limit",
        ["endpoint", "bucket"],
    )
    _PROM_AVAILABLE = True
except Exception:  # pragma: no cover
    rate_limit_exceeded_total = None
    _PROM_AVAILABLE = False

from middleware.rate_limits_config import (
    BUCKET_WINDOWS,
    RATE_LIMITS_CONFIG,
    WHITELIST_PATHS,
    WHITELIST_PREFIXES,
)

logger = logging.getLogger(__name__)

# ─── Singleton Redis (réutilise le client async existant) ────────────────────
try:
    from redis_client import redis_vibe  # singleton VibeCodingRedis
    _REDIS_CLIENT = redis_vibe
except Exception:  # pragma: no cover
    _REDIS_CLIENT = None

JWT_SECRET = os.environ.get("JWT_SECRET") or os.environ.get("SECRET_KEY")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")


# ─── Backend in-memory (fallback si Redis down) ──────────────────────────────

class _SlidingWindowMemory:
    """Sliding window in-memory pour fallback si Redis indisponible."""

    def __init__(self):
        self._windows: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def check_and_increment(self, key: str, limit: int, window: int) -> Tuple[bool, int, float]:
        now = time.time()
        cutoff = now - window

        if now - self._last_cleanup > 60:
            self._cleanup(now)
            self._last_cleanup = now

        timestamps = self._windows[key]
        while timestamps and timestamps[0] < cutoff:
            timestamps.pop(0)

        count = len(timestamps)
        if count >= limit:
            reset_at = timestamps[0] + window if timestamps else now + window
            return False, 0, reset_at

        timestamps.append(now)
        remaining = limit - count - 1
        return True, remaining, now + window

    def _cleanup(self, now: float):
        # On laisse tomber tous les buckets dont la dernière entrée est très ancienne
        oldest_relevant = now - max(BUCKET_WINDOWS.values())
        to_delete = [
            k for k, v in self._windows.items()
            if not v or v[-1] < oldest_relevant
        ]
        for k in to_delete:
            del self._windows[k]


_memory_counter = _SlidingWindowMemory()


# ─── Backend Redis (sliding window via ZSET) ─────────────────────────────────

async def _redis_check_and_increment(
    key: str, limit: int, window: int
) -> Optional[Tuple[bool, int, float]]:
    """
    Sliding window via ZSET Redis :
        - ZREMRANGEBYSCORE key 0 (now-window)
        - ZADD key now now
        - ZCARD key
        - EXPIRE key window

    Retourne (allowed, remaining, reset_at) si Redis disponible, sinon None
    pour signaler au caller qu'il faut faire un fallback.
    """
    if not _REDIS_CLIENT or not getattr(_REDIS_CLIENT, "available", False):
        return None

    client = getattr(_REDIS_CLIENT, "_client", None)
    if client is None:
        return None

    now = time.time()
    cutoff = now - window
    member = f"{now}:{os.getpid()}:{id(object())}"

    try:
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, cutoff)
        pipe.zadd(key, {member: now})
        pipe.zcard(key)
        pipe.expire(key, window + 5)
        results = await pipe.execute()
        count = int(results[2] or 0)

        if count > limit:
            # Récupérer le plus ancien timestamp pour calculer reset_at exact
            try:
                oldest = await client.zrange(key, 0, 0, withscores=True)
                if oldest:
                    oldest_ts = float(oldest[0][1])
                    reset_at = oldest_ts + window
                else:
                    reset_at = now + window
            except Exception:
                reset_at = now + window
            return False, 0, reset_at

        remaining = max(0, limit - count)
        return True, remaining, now + window

    except Exception as e:
        logger.debug(f"Redis rate-limit error ({key}): {e} — fallback in-memory")
        return None


async def _check_and_increment(key: str, limit: int, window: int) -> Tuple[bool, int, float]:
    """Wrapper Redis-first avec fallback in-memory."""
    redis_result = await _redis_check_and_increment(key, limit, window)
    if redis_result is not None:
        return redis_result
    return _memory_counter.check_and_increment(key, limit, window)


# ─── Pattern matching ─────────────────────────────────────────────────────────

# Cache de l'ordre des patterns (les patterns sans wildcard d'abord, puis longueur DESC)
_PATTERN_ORDER = sorted(
    RATE_LIMITS_CONFIG.keys(),
    key=lambda p: (("*" in p), -len(p)),
)


def _match_pattern(path: str) -> Optional[str]:
    """Retourne le premier pattern qui matche le path, ou None."""
    for pattern in _PATTERN_ORDER:
        if "*" in pattern:
            if fnmatchcase(path, pattern) or fnmatchcase(path, pattern + "/*"):
                return pattern
        else:
            if path == pattern or path.startswith(pattern + "/"):
                return pattern
    return None


def _is_whitelisted(path: str) -> bool:
    if path in WHITELIST_PATHS:
        return True
    return any(path.startswith(p) for p in WHITELIST_PREFIXES)


# ─── Identification du client ────────────────────────────────────────────────

def _verify_jwt(token: str) -> Optional[str]:
    """Décode et vérifie un JWT. Retourne user_id ou None."""
    if not _JWT_AVAILABLE or not JWT_SECRET:
        return None
    try:
        payload = pyjwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": True},
        )
        return payload.get("sub") or payload.get("user_id") or payload.get("id")
    except Exception:
        return None


def _get_client_id(request: Request) -> str:
    """
    Identifie le client par (priorité décroissante) :
      1. JWT vérifié (Authorization: Bearer ...)
      2. Header X-User-ID (posé par auth_middleware en amont)
      3. IP (X-Forwarded-For ou client direct)
    """
    # 1. JWT vérifié
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        user_id = _verify_jwt(token)
        if user_id:
            return f"user:{user_id}"

    # 2. Header X-User-ID
    user_id_header = request.headers.get("X-User-ID")
    if user_id_header:
        return f"user:{user_id_header}"

    # 3. Fallback IP
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


# ─── Vérification multi-bucket ───────────────────────────────────────────────

async def _check_multi_bucket(
    client_id: str, pattern: str, limits: Dict[str, int]
) -> Tuple[bool, Optional[str], int, int, float]:
    """
    Vérifie tous les buckets définis pour un endpoint.

    Returns:
        (allowed, blocking_bucket, limit, remaining, reset_at)
        Si allowed=True : limit/remaining/reset_at = bucket le plus restrictif
        Si allowed=False : limit/remaining/reset_at = bucket bloquant
    """
    most_restrictive: Tuple[str, int, int, float] = ("", 10**9, 10**9, time.time() + 60)

    for bucket_name, limit in limits.items():
        window = BUCKET_WINDOWS.get(bucket_name)
        if not window or limit <= 0:
            continue

        key = f"rl:{client_id}:{pattern}:{bucket_name}"
        allowed, remaining, reset_at = await _check_and_increment(key, limit, window)

        if not allowed:
            return False, bucket_name, limit, 0, reset_at

        # Garder le bucket avec le moins de "remaining" pour les headers
        if remaining < most_restrictive[2]:
            most_restrictive = (bucket_name, limit, remaining, reset_at)

    return True, None, most_restrictive[1], most_restrictive[2], most_restrictive[3]


# ─── Middleware FastAPI ───────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware de rate limiting. À monter APRÈS l'auth middleware."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if _is_whitelisted(path):
            return await call_next(request)

        pattern = _match_pattern(path)
        if pattern is None:
            return await call_next(request)

        limits = RATE_LIMITS_CONFIG[pattern]
        client_id = _get_client_id(request)

        allowed, blocking_bucket, limit, remaining, reset_at = await _check_multi_bucket(
            client_id, pattern, limits
        )

        if not allowed:
            retry_after = max(1, int(reset_at - time.time()) + 1)
            logger.warning(
                f"⛔ Rate limit 429 — path={path} pattern={pattern} "
                f"bucket={blocking_bucket} limit={limit} client={client_id}"
            )
            if _PROM_AVAILABLE and rate_limit_exceeded_total:
                try:
                    rate_limit_exceeded_total.labels(
                        endpoint=pattern, bucket=blocking_bucket or "unknown"
                    ).inc()
                except Exception:
                    pass

            return JSONResponse(
                status_code=429,
                content={
                    "error":       "Too Many Requests",
                    "message":     f"Limite dépassée ({limit}/{blocking_bucket}). "
                                   f"Réessayez dans {retry_after}s.",
                    "retry_after": retry_after,
                    "limit":       limit,
                    "bucket":      blocking_bucket,
                    "endpoint":    pattern,
                },
                headers={
                    "Retry-After":           str(retry_after),
                    "X-RateLimit-Limit":     str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset":     str(int(reset_at)),
                    "X-RateLimit-Bucket":    blocking_bucket or "unknown",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"]     = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"]     = str(int(reset_at))
        return response


# ─── Helper backward-compat pour les routes ──────────────────────────────────

async def check_rate_limit(
    request: Request,
    limit: int = 60,
    window: int = 60,
    key_suffix: str = "",
) -> bool:
    """
    Helper conservé pour compatibilité ascendante avec les routes existantes
    qui veulent vérifier la limite manuellement. Lève HTTP 429 si dépassé.
    """
    client_id = _get_client_id(request)
    key = f"rl:manual:{client_id}:{request.url.path}{key_suffix}"
    allowed, remaining, reset_at = await _check_and_increment(key, limit, window)

    if not allowed:
        retry_after = max(1, int(reset_at - time.time()) + 1)
        raise HTTPException(
            status_code=429,
            detail=f"Trop de requêtes. Réessayez dans {retry_after} secondes.",
            headers={
                "Retry-After":           str(retry_after),
                "X-RateLimit-Limit":     str(limit),
                "X-RateLimit-Remaining": "0",
            },
        )
    return True
