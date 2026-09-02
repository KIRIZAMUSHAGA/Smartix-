"""
RedisClient — Client Redis centralisé pour Vibe-Coding

Responsabilités Sprint 5 :
- Rate limiting distribué (compteurs partagés entre workers)
- Cache des sessions de container (port, URL, statut)
- Cache des résultats LSP (diagnostics, completions)
- TTL automatique pour les données éphémères

Utilise redis.asyncio pour être compatible avec FastAPI.
Fallback gracieux : si Redis est down, les opérations retournent None/False.
"""

import json
import logging
import os
from typing import Any, Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

# ─── Clés Redis ───────────────────────────────────────────────────────────────

KEY_CONTAINER   = "vibe:container:{project_id}"
KEY_RATE_LIMIT  = "vibe:rl:{client_id}:{endpoint}"
KEY_LSP_DIAG    = "vibe:lsp:diag:{project_id}:{uri}"
KEY_DNS_RECORD  = "vibe:dns:{subdomain}"
KEY_SSL_CERT    = "vibe:ssl:{domain}"
KEY_PROJECT_TTL = 1800      # 30 min pour les containers
KEY_LSP_TTL     = 30        # 30s pour les diagnostics LSP
KEY_DNS_TTL     = 3600      # 1h pour les enregistrements DNS


class VibeCodingRedis:
    """Client Redis haute disponibilité pour Vibe-Coding."""

    def __init__(self):
        self._client: Optional[aioredis.Redis] = None
        self._available = False

    async def connect(self):
        """Initialise la connexion Redis."""
        try:
            self._client = aioredis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )
            await self._client.ping()
            self._available = True
            logger.info(f"Redis connecté : {REDIS_URL}")
        except Exception as e:
            self._available = False
            logger.warning(f"Redis indisponible : {e} — mode in-memory activé")

    async def close(self):
        if self._client:
            await self._client.aclose()

    # ── Opérations génériques ─────────────────────────────────────────────

    async def get(self, key: str) -> Optional[str]:
        if not self._available or not self._client:
            return None
        try:
            return await self._client.get(key)
        except Exception:
            return None

    async def set(self, key: str, value: str, ttl: int = 0) -> bool:
        if not self._available or not self._client:
            return False
        try:
            if ttl > 0:
                await self._client.setex(key, ttl, value)
            else:
                await self._client.set(key, value)
            return True
        except Exception:
            return False

    async def delete(self, key: str) -> bool:
        if not self._available or not self._client:
            return False
        try:
            await self._client.delete(key)
            return True
        except Exception:
            return False

    async def get_json(self, key: str) -> Optional[Any]:
        raw = await self.get(key)
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
        return None

    async def set_json(self, key: str, value: Any, ttl: int = 0) -> bool:
        return await self.set(key, json.dumps(value), ttl=ttl)

    # ── Listes (historiques de conversation et d'actions) ─────────────────

    async def lpush(self, key: str, value: str, ttl: int = 0, max_length: int = 0) -> int:
        """Pousse une valeur en tête de liste, avec trim et TTL optionnels."""
        if not self._available or not self._client:
            return 0
        try:
            pipe = self._client.pipeline()
            pipe.lpush(key, value)
            if max_length > 0:
                pipe.ltrim(key, 0, max_length - 1)
            if ttl > 0:
                pipe.expire(key, ttl)
            results = await pipe.execute()
            return int(results[0] or 0)
        except Exception:
            return 0

    async def lrange(self, key: str, start: int = 0, end: int = -1) -> list:
        """Retourne une portion de liste (par défaut tout)."""
        if not self._available or not self._client:
            return []
        try:
            return await self._client.lrange(key, start, end)
        except Exception:
            return []

    async def llen(self, key: str) -> int:
        if not self._available or not self._client:
            return 0
        try:
            return int(await self._client.llen(key) or 0)
        except Exception:
            return 0

    # ── Rate limiting distribué ───────────────────────────────────────────

    async def rl_increment(self, key: str, window: int) -> int:
        """
        Incrémente le compteur pour le rate limiting (INCR + EXPIRE).
        Retourne le nombre de requêtes dans la fenêtre.
        """
        if not self._available or not self._client:
            return 0  # Pas de blocage si Redis down
        try:
            pipe = self._client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window)
            results = await pipe.execute()
            return results[0]
        except Exception:
            return 0

    # ── Cache des containers ──────────────────────────────────────────────

    async def save_container(self, project_id: str, info: dict):
        key = KEY_CONTAINER.format(project_id=project_id)
        await self.set_json(key, info, ttl=KEY_PROJECT_TTL)

    async def get_container(self, project_id: str) -> Optional[dict]:
        key = KEY_CONTAINER.format(project_id=project_id)
        return await self.get_json(key)

    async def delete_container(self, project_id: str):
        key = KEY_CONTAINER.format(project_id=project_id)
        await self.delete(key)

    async def refresh_container_ttl(self, project_id: str):
        if not self._available or not self._client:
            return
        key = KEY_CONTAINER.format(project_id=project_id)
        try:
            await self._client.expire(key, KEY_PROJECT_TTL)
        except Exception:
            pass

    # ── Cache LSP diagnostics ─────────────────────────────────────────────

    async def save_diagnostics(self, project_id: str, uri: str, diagnostics: list):
        key = KEY_LSP_DIAG.format(project_id=project_id, uri=uri.replace("/", "_"))
        await self.set_json(key, diagnostics, ttl=KEY_LSP_TTL)

    async def get_diagnostics(self, project_id: str, uri: str) -> Optional[list]:
        key = KEY_LSP_DIAG.format(project_id=project_id, uri=uri.replace("/", "_"))
        return await self.get_json(key)

    # ── Cache DNS ─────────────────────────────────────────────────────────

    async def save_dns_record(self, subdomain: str, record_id: str):
        key = KEY_DNS_RECORD.format(subdomain=subdomain)
        await self.set(key, record_id, ttl=KEY_DNS_TTL)

    async def get_dns_record(self, subdomain: str) -> Optional[str]:
        key = KEY_DNS_RECORD.format(subdomain=subdomain)
        return await self.get(key)

    # ── Cache SSL ─────────────────────────────────────────────────────────

    async def mark_cert_issued(self, domain: str):
        key = KEY_SSL_CERT.format(domain=domain)
        await self.set(key, "1", ttl=86400 * 89)  # 89 jours (avant renouvellement à 90j)

    async def is_cert_issued(self, domain: str) -> bool:
        key = KEY_SSL_CERT.format(domain=domain)
        return await self.get(key) == "1"

    @property
    def available(self) -> bool:
        return self._available


# ─── Singleton ────────────────────────────────────────────────────────────────

redis_vibe = VibeCodingRedis()
