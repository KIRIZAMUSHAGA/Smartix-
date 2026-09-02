"""
DNSManager — Gestion des sous-domaines *.vibe.app

Fonctionnalités :
- Crée un enregistrement CNAME via l'API Cloudflare
- Supprime les enregistrements à la fin d'un déploiement
- Cache local des enregistrements actifs
- Fallback : domaine local (localhost) si Cloudflare non configuré
"""

import asyncio
import logging
import os
import re
import time
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)

CLOUDFLARE_API = "https://api.cloudflare.com/client/v4"
BASE_DOMAIN    = os.environ.get("VIBE_BASE_DOMAIN", "vibe.app")


class DNSManager:
    """Gère les sous-domaines dynamiques pour les projets déployés."""

    def __init__(self):
        self.api_key  = os.environ.get("CLOUDFLARE_API_KEY", "")
        self.zone_id  = os.environ.get("CLOUDFLARE_ZONE_ID", "")
        self._records: Dict[str, str] = {}  # subdomain → record_id

    # ── Validation ────────────────────────────────────────────────────────

    @staticmethod
    def sanitize_subdomain(raw: str) -> str:
        """Normalise un nom de projet en sous-domaine valide."""
        slug = re.sub(r"[^a-z0-9-]", "-", raw.lower())
        slug = re.sub(r"-+", "-", slug).strip("-")
        return slug[:50] or "project"

    # ── Création de sous-domaine ──────────────────────────────────────────

    async def create_subdomain(self, subdomain: str, target_ip: str) -> str:
        """
        Crée un enregistrement DNS pour <subdomain>.<BASE_DOMAIN>.

        Args:
            subdomain: ex. "mon-projet-abc123"
            target_ip: Adresse IP ou CNAME destination

        Returns:
            Le nom de domaine complet (ex. "mon-projet-abc123.vibe.app")
        """
        full_domain = f"{subdomain}.{BASE_DOMAIN}"

        if not self._is_configured():
            logger.info(f"Cloudflare non configuré — domaine simulé : {full_domain}")
            return full_domain

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{CLOUDFLARE_API}/zones/{self.zone_id}/dns_records",
                    headers=self._headers(),
                    json={
                        "type":    "A" if self._looks_like_ip(target_ip) else "CNAME",
                        "name":    full_domain,
                        "content": target_ip,
                        "ttl":     120,
                        "proxied": True,
                    },
                )
                data = resp.json()
                if data.get("success"):
                    record_id = data["result"]["id"]
                    self._records[subdomain] = record_id
                    logger.info(f"Sous-domaine créé : {full_domain} → {target_ip}")
                    return full_domain
                else:
                    errors = data.get("errors", [])
                    logger.error(f"Cloudflare erreur : {errors}")
        except Exception as e:
            logger.error(f"Erreur création sous-domaine {subdomain}: {e}")

        return full_domain

    # ── Suppression de sous-domaine ───────────────────────────────────────

    async def delete_subdomain(self, subdomain: str):
        """Supprime l'enregistrement DNS d'un sous-domaine."""
        record_id = self._records.pop(subdomain, None)
        if not record_id or not self._is_configured():
            return

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.delete(
                    f"{CLOUDFLARE_API}/zones/{self.zone_id}/dns_records/{record_id}",
                    headers=self._headers(),
                )
                if resp.json().get("success"):
                    logger.info(f"Sous-domaine supprimé : {subdomain}.{BASE_DOMAIN}")
        except Exception as e:
            logger.error(f"Erreur suppression sous-domaine {subdomain}: {e}")

    async def list_records(self) -> list:
        """Retourne les enregistrements DNS actifs."""
        if not self._is_configured():
            return [{"subdomain": k, "domain": f"{k}.{BASE_DOMAIN}"} for k in self._records]
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{CLOUDFLARE_API}/zones/{self.zone_id}/dns_records",
                    headers=self._headers(),
                    params={"per_page": 100},
                )
                data = resp.json()
                if data.get("success"):
                    return data.get("result", [])
        except Exception as e:
            logger.error(f"Erreur liste DNS : {e}")
        return []

    # ── Helpers ───────────────────────────────────────────────────────────

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.zone_id)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type":  "application/json",
        }

    @staticmethod
    def _looks_like_ip(s: str) -> bool:
        return bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", s))

    def get_public_url(self, subdomain: str) -> str:
        return f"https://{subdomain}.{BASE_DOMAIN}"


dns_manager = DNSManager()
