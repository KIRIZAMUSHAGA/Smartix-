"""
VercelClient — Client pour l'API Vercel

Fonctionnalités :
- Créer un déploiement en uploadant les fichiers
- Suivre le statut du déploiement
- Récupérer les logs de production
- Annuler / supprimer un déploiement

Documentation : https://vercel.com/docs/rest-api
"""

import os
import logging
import base64
import hashlib
from typing import Dict, Any, List, Optional

import httpx

logger = logging.getLogger(__name__)

VERCEL_API = "https://api.vercel.com"
NETLIFY_API = "https://api.netlify.com/api/v1"


class VercelError(Exception):
    pass


class NetlifyError(Exception):
    pass


# ─── VercelClient ─────────────────────────────────────────────────────────────

class VercelClient:
    """Client pour l'API Vercel REST v13."""

    def __init__(self, token: str, team_id: Optional[str] = None):
        self.token   = token
        self.team_id = team_id

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type":  "application/json",
        }

    def _params(self, extra: dict = None) -> dict:
        p = {}
        if self.team_id:
            p["teamId"] = self.team_id
        if extra:
            p.update(extra)
        return p

    # ── Déploiement ────────────────────────────────────────────────────────

    async def deploy(
        self,
        project_name: str,
        files: List[Dict[str, str]],  # [{ "file": "path", "data": "content" }]
        framework: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Crée un nouveau déploiement Vercel.
        
        files : liste de { "file": chemin_relatif, "data": contenu_texte }
        """
        # Préparer les fichiers pour l'API Vercel
        vercel_files = []
        for f in files:
            content = f["data"]
            encoded = content.encode("utf-8")
            sha1    = hashlib.sha1(encoded).hexdigest()
            vercel_files.append({
                "file":     f["file"],
                "data":     content,
                "encoding": "utf-8",
            })

        payload = {
            "name":    project_name,
            "files":   vercel_files,
            "target":  "production",
        }
        if framework:
            payload["projectSettings"] = {"framework": framework}

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{VERCEL_API}/v13/deployments",
                headers=self._headers(),
                params=self._params(),
                json=payload,
                timeout=60,
            )
            _check_response(resp, "Déploiement Vercel", VercelError)
            data = resp.json()
            return {
                "deployment_id": data.get("id"),
                "url":           f"https://{data.get('url', '')}",
                "status":        data.get("readyState", "QUEUED"),
                "created_at":    data.get("createdAt"),
            }

    async def get_deployment(self, deployment_id: str) -> Dict[str, Any]:
        """Récupère le statut d'un déploiement."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{VERCEL_API}/v13/deployments/{deployment_id}",
                headers=self._headers(),
                params=self._params(),
                timeout=15,
            )
            _check_response(resp, "Statut déploiement", VercelError)
            data = resp.json()
            return {
                "deployment_id": data.get("id"),
                "url":           f"https://{data.get('url', '')}",
                "status":        data.get("readyState"),
                "error":         data.get("errorMessage"),
            }

    async def get_logs(self, deployment_id: str) -> List[Dict[str, Any]]:
        """Récupère les logs de build/runtime d'un déploiement."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{VERCEL_API}/v2/deployments/{deployment_id}/events",
                headers=self._headers(),
                params=self._params(),
                timeout=20,
            )
            _check_response(resp, "Logs déploiement", VercelError)
            events = resp.json()
            return [
                {
                    "type":      e.get("type"),
                    "text":      e.get("text", ""),
                    "created":   e.get("created"),
                    "level":     e.get("level", "info"),
                }
                for e in events
                if e.get("text")
            ]

    async def list_deployments(self, project_name: str, limit: int = 10) -> List[Dict]:
        """Liste les déploiements récents d'un projet."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{VERCEL_API}/v6/deployments",
                headers=self._headers(),
                params=self._params({"app": project_name, "limit": limit}),
                timeout=15,
            )
            _check_response(resp, "Liste déploiements", VercelError)
            return resp.json().get("deployments", [])

    async def cancel_deployment(self, deployment_id: str) -> bool:
        """Annule un déploiement en cours."""
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{VERCEL_API}/v12/deployments/{deployment_id}/cancel",
                headers=self._headers(),
                params=self._params(),
                timeout=10,
            )
            return resp.status_code in (200, 204)


# ─── NetlifyClient ────────────────────────────────────────────────────────────

class NetlifyClient:
    """Client pour l'API Netlify."""

    def __init__(self, token: str):
        self.token = token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type":  "application/json",
        }

    async def deploy(
        self,
        site_name: str,
        files: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Crée ou met à jour un site Netlify et déploie les fichiers."""
        async with httpx.AsyncClient() as client:
            # 1. Créer/récupérer le site
            site = await self._ensure_site(client, site_name)
            site_id = site["id"]

            # 2. Créer un déploiement avec les hash SHA1 des fichiers
            file_map = {}
            for f in files:
                sha1 = hashlib.sha1(f["data"].encode()).hexdigest()
                file_map[f"/{f['file']}"] = sha1

            deploy_resp = await client.post(
                f"{NETLIFY_API}/sites/{site_id}/deploys",
                headers=self._headers(),
                json={"files": file_map},
                timeout=30,
            )
            _check_response(deploy_resp, "Création deploy Netlify", NetlifyError)
            deploy_data = deploy_resp.json()
            deploy_id   = deploy_data["id"]
            required    = deploy_data.get("required", [])

            # 3. Uploader les fichiers requis
            for sha1 in required:
                matching = [f for f in files if hashlib.sha1(f["data"].encode()).hexdigest() == sha1]
                for f in matching:
                    await client.put(
                        f"{NETLIFY_API}/deploys/{deploy_id}/files/{f['file']}",
                        headers={
                            "Authorization":  f"Bearer {self.token}",
                            "Content-Type":   "application/octet-stream",
                        },
                        content=f["data"].encode(),
                        timeout=30,
                    )

            return {
                "deployment_id": deploy_id,
                "url":           f"https://{deploy_data.get('deploy_ssl_url') or site.get('ssl_url', '')}",
                "status":        deploy_data.get("state", "processing"),
            }

    async def _ensure_site(self, client: httpx.AsyncClient, site_name: str) -> dict:
        """Récupère ou crée un site Netlify."""
        resp = await client.get(
            f"{NETLIFY_API}/sites",
            headers=self._headers(),
            params={"name": site_name},
            timeout=15,
        )
        _check_response(resp, "Liste sites Netlify", NetlifyError)
        sites = resp.json()
        for site in sites:
            if site.get("name") == site_name:
                return site

        create_resp = await client.post(
            f"{NETLIFY_API}/sites",
            headers=self._headers(),
            json={"name": site_name},
            timeout=15,
        )
        _check_response(create_resp, "Création site Netlify", NetlifyError)
        return create_resp.json()

    async def get_deployment(self, deploy_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{NETLIFY_API}/deploys/{deploy_id}",
                headers=self._headers(),
                timeout=15,
            )
            _check_response(resp, "Statut deploy Netlify", NetlifyError)
            data = resp.json()
            return {
                "deployment_id": data.get("id"),
                "url":           data.get("deploy_ssl_url", ""),
                "status":        data.get("state"),
                "error":         data.get("error_message"),
            }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _check_response(resp: httpx.Response, context: str, exc_class):
    if resp.status_code >= 400:
        try:
            detail = resp.json()
            msg = detail.get("error", {}).get("message") or detail.get("message") or resp.text
        except Exception:
            msg = resp.text
        raise exc_class(f"{context} : {msg} (HTTP {resp.status_code})")
