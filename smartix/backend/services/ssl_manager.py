"""
SSLManager — Certificats TLS automatiques (Let's Encrypt via Certbot)

Fonctionnalités :
- Émet des certificats pour les sous-domaines *.vibe.app
- Renouvellement automatique (tous les 60 jours)
- Vérification de l'état des certificats
- Rechargement nginx après émission
- Mode simulation si certbot indisponible
"""

import asyncio
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

CERTBOT_EMAIL   = os.environ.get("CERTBOT_EMAIL",  "admin@vibe.app")
CERTS_DIR       = Path(os.environ.get("CERTS_DIR", "/etc/letsencrypt/live"))
WEBROOT_PATH    = os.environ.get("WEBROOT_PATH",   "/var/www/certbot")
NGINX_RELOAD_CMD = ["nginx", "-s", "reload"]


class SSLManager:
    """Gestionnaire de certificats TLS pour les sous-domaines Vibe-Coding."""

    def __init__(self):
        self._certs: Dict[str, float] = {}  # domain → issued_at (timestamp)
        self._certbot_available = self._check_certbot()
        self._renew_task: Optional[asyncio.Task] = None

    def _check_certbot(self) -> bool:
        result = subprocess.run(["which", "certbot"], capture_output=True)
        available = result.returncode == 0
        if not available:
            logger.warning("certbot non disponible — mode simulation SSL activé")
        return available

    # ── Émission d'un certificat ──────────────────────────────────────────

    async def issue_certificate(self, domain: str) -> bool:
        """
        Émet un certificat Let's Encrypt pour un domaine.

        Args:
            domain: ex. "mon-projet.vibe.app"

        Returns:
            True si le certificat a été émis (ou existe déjà)
        """
        if self._cert_exists(domain):
            logger.info(f"Certificat déjà existant : {domain}")
            return True

        if not self._certbot_available:
            logger.info(f"[Simulation SSL] Certificat simulé pour {domain}")
            self._certs[domain] = time.time()
            return True

        logger.info(f"Émission certificat Let's Encrypt : {domain}")
        try:
            proc = await asyncio.create_subprocess_exec(
                "certbot", "certonly",
                "--webroot",
                "--webroot-path", WEBROOT_PATH,
                "--non-interactive",
                "--agree-tos",
                "--email", CERTBOT_EMAIL,
                "--domains", domain,
                "--quiet",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)

            if proc.returncode == 0:
                self._certs[domain] = time.time()
                logger.info(f"Certificat émis : {domain}")
                await self._reload_nginx()
                return True
            else:
                logger.error(f"Certbot erreur pour {domain}: {stderr.decode()}")
                return False
        except asyncio.TimeoutError:
            logger.error(f"Timeout certbot pour {domain}")
            return False
        except Exception as e:
            logger.error(f"Erreur émission SSL {domain}: {e}")
            return False

    # ── Renouvellement ────────────────────────────────────────────────────

    async def renew_all(self) -> dict:
        """Renouvelle tous les certificats (à appeler périodiquement)."""
        if not self._certbot_available:
            logger.info("[Simulation SSL] Renouvellement simulé")
            return {"status": "simulated", "renewed": 0}

        try:
            proc = await asyncio.create_subprocess_exec(
                "certbot", "renew",
                "--webroot",
                "--webroot-path", WEBROOT_PATH,
                "--non-interactive",
                "--quiet",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
            if proc.returncode == 0:
                await self._reload_nginx()
                logger.info("Certificats renouvelés")
                return {"status": "success", "output": stdout.decode()}
            else:
                return {"status": "error", "error": stderr.decode()}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def start_auto_renew(self, interval_hours: int = 12):
        """Lance une tâche asyncio de renouvellement automatique."""
        if self._renew_task and not self._renew_task.done():
            return

        async def _loop():
            while True:
                await asyncio.sleep(interval_hours * 3600)
                await self.renew_all()

        self._renew_task = asyncio.create_task(_loop())
        logger.info(f"Renouvellement SSL automatique toutes les {interval_hours}h")

    # ── Statut ────────────────────────────────────────────────────────────

    def get_cert_status(self, domain: str) -> dict:
        exists     = self._cert_exists(domain)
        issued_at  = self._certs.get(domain)
        days_left  = None
        if exists and issued_at:
            days_left = 90 - int((time.time() - issued_at) / 86400)
        return {
            "domain":    domain,
            "valid":     exists,
            "days_left": days_left,
            "simulated": not self._certbot_available,
        }

    def _cert_exists(self, domain: str) -> bool:
        if domain in self._certs:
            return True
        cert_path = CERTS_DIR / domain / "fullchain.pem"
        return cert_path.is_file()

    async def _reload_nginx(self):
        """Recharge nginx pour qu'il prenne les nouveaux certificats."""
        try:
            proc = await asyncio.create_subprocess_exec(
                *NGINX_RELOAD_CMD,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=5)
        except Exception:
            pass


ssl_manager = SSLManager()
