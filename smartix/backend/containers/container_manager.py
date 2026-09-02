"""
ContainerManager — Gestion des containers Docker par projet

Fonctionnalités :
- Créer un container isolé par projet utilisateur
- Copier les fichiers du projet dans le container
- Exposer un port HTTP (live preview)
- Exécuter du code et streamer la sortie
- Arrêt + nettoyage automatique (TTL 30 min d'inactivité)
- Mode simulation si Docker indisponible

Limites de ressources :
- Mémoire : 512 MB
- CPU : 0.5 vCPU
- Réseau : bridge isolé
- Filesystem : tmpfs pour /tmp, volume dédié pour /project
"""

import asyncio
import io
import logging
import os
import tarfile
import time
import uuid
from typing import AsyncGenerator, Dict, Optional

from containers.docker_client import (
    get_docker_client,
    get_cmd_for_language,
    get_image_for_language,
    is_docker_available,
    SANDBOX_CPU_QUOTA,
    SANDBOX_MEM_LIMIT,
    SANDBOX_NETWORK,
)
from containers.security import SandboxSecurity

logger = logging.getLogger(__name__)

CONTAINER_TTL_SECONDS = int(os.environ.get("CONTAINER_TTL", "1800"))  # 30 min
MAX_OUTPUT_BYTES      = 1024 * 1024  # 1 MB max de sortie


# ─── Modèle d'une session container ─────────────────────────────────────────

class ContainerSession:
    def __init__(self, project_id: str, container_id: str, port: Optional[int], language: str):
        self.project_id   = project_id
        self.container_id = container_id
        self.port         = port
        self.language     = language
        self.created_at   = time.time()
        self.last_used    = time.time()
        self.url          = f"http://localhost:{port}" if port else None

    def touch(self):
        self.last_used = time.time()

    def is_expired(self) -> bool:
        return (time.time() - self.last_used) > CONTAINER_TTL_SECONDS


# ─── ContainerManager ────────────────────────────────────────────────────────

class ContainerManager:
    """Gestionnaire central des containers sandbox."""

    def __init__(self):
        self._sessions: Dict[str, ContainerSession] = {}
        self._security = SandboxSecurity()
        self._cleanup_task: Optional[asyncio.Task] = None

    def start_cleanup(self):
        """Lance la tâche de nettoyage des containers expirés."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        while True:
            await asyncio.sleep(300)  # vérification toutes les 5 min
            await self._cleanup_expired()

    async def _cleanup_expired(self):
        expired = [pid for pid, s in self._sessions.items() if s.is_expired()]
        for project_id in expired:
            logger.info(f"Container expiré supprimé : {project_id}")
            await self.stop_container(project_id)

    async def _get_project_env_vars(self, project_id: str) -> dict:
        """
        Récupère les variables d'environnement chiffrées du projet
        depuis le EnvManager et les retourne déchiffrées pour injection container.
        Retourne un dict vide si le service est indisponible.
        """
        try:
            from services.env_manager import env_manager
            return await env_manager.get_all_decrypted(project_id)
        except Exception as e:
            logger.warning(f"Impossible de charger les env vars du projet {project_id}: {e}")
            return {}

    # ── Création du container ─────────────────────────────────────────────

    async def create_container(
        self,
        project_id: str,
        files: Dict[str, str],
        language: str = "javascript",
        run_command: Optional[str] = None,
    ) -> dict:
        """
        Crée et démarre un container Docker pour un projet.

        Args:
            project_id: Identifiant unique du projet
            files:      Dict { "chemin/fichier": "contenu" }
            language:   Langage principal du projet
            run_command: Commande de démarrage personnalisée

        Returns:
            { container_id, port, url, status, simulated }
        """
        # Arrêter l'éventuel container précédent
        await self.stop_container(project_id)

        if not is_docker_available():
            return await self._simulate_container(project_id, files, language)

        client = get_docker_client()
        image  = get_image_for_language(language)
        cmd    = run_command.split() if run_command else get_cmd_for_language(language)

        try:
            # Préparer les options de sécurité
            sec_opts = self._security.get_security_options()

            container = client.containers.run(
                image=image,
                command=cmd,
                detach=True,
                auto_remove=False,
                name=f"vibe-{project_id[:8]}-{uuid.uuid4().hex[:4]}",
                mem_limit=SANDBOX_MEM_LIMIT,
                memswap_limit=SANDBOX_MEM_LIMIT,
                cpu_period=100000,
                cpu_quota=SANDBOX_CPU_QUOTA,
                network=SANDBOX_NETWORK,
                read_only=False,
                environment={
                    "PORT":         "3000",
                    "NODE_ENV":     "development",
                    "PYTHONPATH":   "/project",
                    **await self._get_project_env_vars(project_id),
                },
                working_dir="/project",
                ports={"3000/tcp": None},
                security_opt=sec_opts,
                cap_drop=["ALL"],
                cap_add=["CHOWN", "SETUID", "SETGID"],
                tmpfs={"/tmp": "size=64m,exec"},
                labels={
                    "vibe.project_id": project_id,
                    "vibe.language":   language,
                },
            )

            # Copier les fichiers dans le container
            if files:
                await asyncio.to_thread(self._copy_files_to_container, container, files)

            # Récupérer le port exposé
            container.reload()
            port_bindings = container.ports.get("3000/tcp") or []
            port = int(port_bindings[0]["HostPort"]) if port_bindings else None

            session = ContainerSession(project_id, container.id, port, language)
            self._sessions[project_id] = session

            logger.info(f"Container créé : {project_id} → {container.short_id} port={port}")
            return {
                "container_id": container.id,
                "short_id":     container.short_id,
                "port":         port,
                "url":          session.url,
                "status":       "running",
                "simulated":    False,
                "language":     language,
            }

        except Exception as e:
            logger.error(f"Erreur création container {project_id}: {e}")
            return await self._simulate_container(project_id, files, language)

    def _copy_files_to_container(self, container, files: Dict[str, str]):
        """Copie un dict { path: content } dans le container via tar."""
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tar:
            for path, content in files.items():
                if not isinstance(content, str):
                    continue
                encoded = content.encode("utf-8")
                info = tarfile.TarInfo(name=path.lstrip("/"))
                info.size = len(encoded)
                tar.addfile(info, io.BytesIO(encoded))
        buf.seek(0)
        container.put_archive("/project", buf.getvalue())

    # ── Exécution d'une commande ──────────────────────────────────────────

    async def exec_command(
        self,
        project_id: str,
        command: str,
        timeout: int = 30,
    ) -> AsyncGenerator[str, None]:
        """
        Exécute une commande dans le container et streame la sortie.
        Yields: lignes de sortie (stdout + stderr)
        """
        session = self._sessions.get(project_id)

        if not session or not is_docker_available():
            yield f"[SIMULATION] $ {command}\n"
            yield f"[SIMULATION] Sortie simulée — Docker non disponible\n"
            return

        session.touch()
        client = get_docker_client()
        try:
            container = client.containers.get(session.container_id)
            result = container.exec_run(
                cmd=["sh", "-c", command],
                stdout=True,
                stderr=True,
                stream=True,
                demux=False,
                workdir="/project",
            )
            total = 0
            for chunk in result.output:
                if chunk:
                    total += len(chunk)
                    if total > MAX_OUTPUT_BYTES:
                        yield "\n[Sortie tronquée — limite 1 MB atteinte]\n"
                        break
                    yield chunk.decode("utf-8", errors="replace")
                await asyncio.sleep(0)
        except Exception as e:
            yield f"[Erreur exec] {e}\n"

    # ── Statut et infos ───────────────────────────────────────────────────

    async def get_container_status(self, project_id: str) -> str:
        session = self._sessions.get(project_id)
        if not session:
            return "stopped"
        if not is_docker_available():
            return "simulated"
        try:
            client    = get_docker_client()
            container = client.containers.get(session.container_id)
            return container.status
        except Exception:
            return "error"

    def get_container_info(self, project_id: str) -> Optional[dict]:
        session = self._sessions.get(project_id)
        if not session:
            return None
        session.touch()
        return {
            "project_id":   project_id,
            "container_id": session.container_id,
            "port":         session.port,
            "url":          session.url,
            "language":     session.language,
            "created_at":   session.created_at,
            "last_used":    session.last_used,
        }

    def list_containers(self) -> list:
        return [self.get_container_info(pid) for pid in self._sessions]

    # ── Arrêt du container ────────────────────────────────────────────────

    async def stop_container(self, project_id: str):
        """Arrête et supprime le container d'un projet."""
        session = self._sessions.pop(project_id, None)
        if not session or not is_docker_available():
            return
        client = get_docker_client()
        try:
            container = client.containers.get(session.container_id)
            container.stop(timeout=5)
            container.remove(force=True)
            logger.info(f"Container supprimé : {project_id}")
        except Exception as e:
            logger.warning(f"Erreur suppression container {project_id}: {e}")

    async def restart_container(self, project_id: str):
        """Redémarre le container d'un projet."""
        session = self._sessions.get(project_id)
        if not session or not is_docker_available():
            return
        client = get_docker_client()
        try:
            container = client.containers.get(session.container_id)
            container.restart(timeout=5)
            logger.info(f"Container redémarré : {project_id}")
        except Exception as e:
            logger.warning(f"Erreur restart container {project_id}: {e}")

    # ── Mode simulation ───────────────────────────────────────────────────

    async def _simulate_container(self, project_id: str, files: dict, language: str) -> dict:
        """Retourne un container simulé quand Docker est indisponible."""
        sim_id = f"sim-{uuid.uuid4().hex[:8]}"
        session = ContainerSession(project_id, sim_id, None, language)
        self._sessions[project_id] = session
        logger.info(f"Container simulé créé : {project_id}")
        return {
            "container_id": sim_id,
            "short_id":     sim_id[:8],
            "port":         None,
            "url":          None,
            "status":       "simulated",
            "simulated":    True,
            "language":     language,
            "message":      "Docker indisponible — exécution simulée",
        }


# ─── Singleton ────────────────────────────────────────────────────────────────

container_manager = ContainerManager()
