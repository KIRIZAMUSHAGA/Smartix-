"""
GitHubService — Service d'intégration GitHub

Fonctionnalités :
- Cloner un dépôt public ou privé (via token)
- Lister les dépôts d'un utilisateur
- Pousser les fichiers d'un projet vers GitHub via l'API REST
  (sans git binaire requis sur le serveur)
"""

import os
import base64
import logging
import hashlib
import uuid
from typing import Optional, Dict, Any, List

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"

# Répertoire temporaire pour les projets importés
PROJECTS_DIR = os.environ.get("PROJECTS_DIR", "/tmp/vibe-coding-projects")

os.makedirs(PROJECTS_DIR, exist_ok=True)


# ─── Exception personnalisée ──────────────────────────────────────────────────

class GitServiceError(Exception):
    pass


# ─── GitHubService ────────────────────────────────────────────────────────────

class GitHubService:
    """Service d'intégration avec l'API GitHub REST v3."""

    # ── Lister les dépôts ─────────────────────────────────────────────────

    async def list_repos(self, token: str) -> List[Dict[str, Any]]:
        """Retourne la liste des dépôts de l'utilisateur authentifié."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API}/user/repos",
                headers=self._headers(token),
                params={"per_page": 100, "sort": "updated"},
                timeout=15,
            )
            _check_github_response(resp, "Liste des dépôts")
            repos = resp.json()
            return [
                {
                    "id":          r["id"],
                    "name":        r["name"],
                    "full_name":   r["full_name"],
                    "url":         r["html_url"],
                    "clone_url":   r["clone_url"],
                    "private":     r["private"],
                    "description": r.get("description", ""),
                    "updated_at":  r["updated_at"],
                }
                for r in repos
            ]

    # ── Cloner un dépôt ───────────────────────────────────────────────────

    async def clone_repo(
        self,
        repo_url: str,
        user_id: str,
        project_name: Optional[str] = None,
        branch: str = "main",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Clone un dépôt GitHub en téléchargeant les fichiers via l'API.
        Retourne project_id et la liste des fichiers.
        """
        owner, repo = _parse_github_url(repo_url)
        project_id  = str(uuid.uuid4())
        name        = project_name or repo

        files = await self._fetch_tree(owner, repo, branch, token)

        project_dir = os.path.join(PROJECTS_DIR, user_id, project_id)
        os.makedirs(project_dir, exist_ok=True)

        file_list = []
        async with httpx.AsyncClient() as client:
            for file_info in files:
                if file_info["type"] != "blob":
                    continue
                content = await self._fetch_file_content(
                    client, owner, repo, file_info["path"], token
                )
                full_path = os.path.join(project_dir, file_info["path"])
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w", encoding="utf-8", errors="replace") as f:
                    f.write(content)
                file_list.append({"path": file_info["path"], "content": content})

        logger.info(f"Dépôt {owner}/{repo} cloné : {len(file_list)} fichiers")
        return {
            "project_id": project_id,
            "name":       name,
            "files":      file_list,
        }

    async def _fetch_tree(
        self,
        owner: str,
        repo: str,
        branch: str,
        token: Optional[str],
    ) -> List[Dict]:
        """Récupère l'arbre complet du dépôt via l'API GitHub Trees."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}",
                headers=self._headers(token),
                params={"recursive": "1"},
                timeout=30,
            )
            _check_github_response(resp, "Arbre du dépôt")
            return resp.json().get("tree", [])

    async def _fetch_file_content(
        self,
        client: httpx.AsyncClient,
        owner: str,
        repo: str,
        path: str,
        token: Optional[str],
    ) -> str:
        """Télécharge le contenu d'un fichier depuis GitHub."""
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
            headers=self._headers(token),
            timeout=15,
        )
        if resp.status_code != 200:
            return ""
        data = resp.json()
        if data.get("encoding") == "base64":
            raw = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return raw
        return data.get("content", "")

    # ── Pousser vers GitHub ───────────────────────────────────────────────

    async def push_project(
        self,
        project_id: str,
        repo_url: str,
        user_token: str,
        commit_message: str,
        branch: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Pousse les fichiers d'un projet vers GitHub via l'API.
        Crée le dépôt s'il n'existe pas, puis crée/met à jour les fichiers.
        """
        owner, repo = _parse_github_url(repo_url)
        project_dir = os.path.join(PROJECTS_DIR, user_id, project_id)

        if not os.path.exists(project_dir):
            raise GitServiceError(f"Projet {project_id} introuvable sur le serveur")

        async with httpx.AsyncClient() as client:
            # Vérifier/créer le dépôt
            await self._ensure_repo(client, owner, repo, user_token)

            # Récupérer les fichiers du projet
            file_paths = _collect_files(project_dir)
            if not file_paths:
                raise GitServiceError("Le projet ne contient aucun fichier à exporter")

            # Obtenir le SHA de la branche actuelle
            head_sha = await self._get_branch_sha(client, owner, repo, branch, user_token)

            # Créer les blobs et l'arbre
            tree_items = []
            for rel_path, abs_path in file_paths:
                with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                blob_sha = await self._create_blob(client, owner, repo, content, user_token)
                tree_items.append({
                    "path":    rel_path.replace(os.sep, "/"),
                    "mode":    "100644",
                    "type":    "blob",
                    "sha":     blob_sha,
                })

            tree_sha = await self._create_tree(client, owner, repo, tree_items, head_sha, user_token)
            commit_sha = await self._create_commit(
                client, owner, repo, commit_message, tree_sha, head_sha, user_token
            )
            await self._update_ref(client, owner, repo, branch, commit_sha, user_token)

            logger.info(f"Projet {project_id} poussé sur {owner}/{repo} : {commit_sha[:7]}")
            return {
                "commit_sha": commit_sha,
                "repo_url":   f"https://github.com/{owner}/{repo}",
            }

    async def _ensure_repo(self, client, owner, repo, token):
        """Crée le dépôt s'il n'existe pas encore."""
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers=self._headers(token),
            timeout=10,
        )
        if resp.status_code == 404:
            resp2 = await client.post(
                f"{GITHUB_API}/user/repos",
                headers=self._headers(token),
                json={"name": repo, "private": False, "auto_init": True},
                timeout=15,
            )
            _check_github_response(resp2, "Création du dépôt")

    async def _get_branch_sha(self, client, owner, repo, branch, token) -> str:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}",
            headers=self._headers(token),
            timeout=10,
        )
        if resp.status_code == 404:
            # Branche n'existe pas encore — utiliser main ou créer
            resp2 = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/main",
                headers=self._headers(token),
                timeout=10,
            )
            if resp2.status_code == 200:
                return resp2.json()["object"]["sha"]
            return ""
        _check_github_response(resp, "SHA de la branche")
        return resp.json()["object"]["sha"]

    async def _create_blob(self, client, owner, repo, content, token) -> str:
        resp = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/blobs",
            headers=self._headers(token),
            json={"content": content, "encoding": "utf-8"},
            timeout=15,
        )
        _check_github_response(resp, "Création blob")
        return resp.json()["sha"]

    async def _create_tree(self, client, owner, repo, items, base_sha, token) -> str:
        payload = {"tree": items}
        if base_sha:
            payload["base_tree"] = base_sha
        resp = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees",
            headers=self._headers(token),
            json=payload,
            timeout=30,
        )
        _check_github_response(resp, "Création arbre")
        return resp.json()["sha"]

    async def _create_commit(self, client, owner, repo, message, tree_sha, parent_sha, token) -> str:
        payload = {"message": message, "tree": tree_sha}
        if parent_sha:
            payload["parents"] = [parent_sha]
        resp = await client.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/commits",
            headers=self._headers(token),
            json=payload,
            timeout=15,
        )
        _check_github_response(resp, "Création commit")
        return resp.json()["sha"]

    async def _update_ref(self, client, owner, repo, branch, commit_sha, token):
        resp = await client.patch(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/refs/heads/{branch}",
            headers=self._headers(token),
            json={"sha": commit_sha, "force": True},
            timeout=10,
        )
        if resp.status_code == 422:
            # La ref n'existe pas — la créer
            await client.post(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/refs",
                headers=self._headers(token),
                json={"ref": f"refs/heads/{branch}", "sha": commit_sha},
                timeout=10,
            )
        else:
            _check_github_response(resp, "Mise à jour ref")

    # ── Helpers ───────────────────────────────────────────────────────────

    def _headers(self, token: Optional[str]) -> dict:
        h = {
            "Accept":     "application/vnd.github+json",
            "User-Agent": "Vibe-Coding/1.0",
        }
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h


# ─── Utilitaires ─────────────────────────────────────────────────────────────

def _parse_github_url(url: str):
    """Extrait (owner, repo) depuis une URL GitHub."""
    clean = url.rstrip("/").replace("https://github.com/", "").replace(".git", "")
    parts = clean.split("/")
    if len(parts) < 2:
        raise GitServiceError(f"URL GitHub invalide : {url}")
    return parts[-2], parts[-1]


def _collect_files(project_dir: str):
    """Retourne la liste (chemin_relatif, chemin_absolu) de tous les fichiers."""
    results = []
    for root, dirs, files in os.walk(project_dir):
        # Ignorer les répertoires cachés et node_modules
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules' and d != '__pycache__']
        for fname in files:
            if fname.startswith('.'):
                continue
            abs_path = os.path.join(root, fname)
            rel_path = os.path.relpath(abs_path, project_dir)
            results.append((rel_path, abs_path))
    return results


def _check_github_response(resp: httpx.Response, context: str):
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("message", resp.text)
        except Exception:
            detail = resp.text
        raise GitServiceError(f"{context} : {detail} (HTTP {resp.status_code})")
