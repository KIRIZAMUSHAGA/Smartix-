"""
DockerClient — Abstraction du client Docker SDK

Fournit un singleton Docker client avec gestion des erreurs,
health check de la connexion, et helpers pour les images sandbox.
"""

import docker
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Singleton client ─────────────────────────────────────────────────────────

_docker_client: Optional[docker.DockerClient] = None
_docker_available: bool = False


def get_docker_client() -> Optional[docker.DockerClient]:
    """Retourne le client Docker singleton (None si Docker indisponible)."""
    global _docker_client, _docker_available
    if _docker_client is not None:
        return _docker_client
    try:
        client = docker.from_env(timeout=10)
        client.ping()
        _docker_client    = client
        _docker_available = True
        logger.info("Docker disponible — client initialisé")
        return _docker_client
    except Exception as e:
        _docker_available = False
        logger.warning(f"Docker indisponible : {e} — mode simulation activé")
        return None


def is_docker_available() -> bool:
    """Vérifie si Docker est accessible."""
    if _docker_available:
        return True
    get_docker_client()
    return _docker_available


# ─── Noms d'images ────────────────────────────────────────────────────────────

SANDBOX_IMAGES = {
    "javascript": "node:20-alpine",
    "typescript": "node:20-alpine",
    "python":     "python:3.11-slim",
    "go":         "golang:1.21-alpine",
    "rust":       "rust:1.75-slim",
    "java":       "eclipse-temurin:21-jre-alpine",
    "default":    "node:20-alpine",
}

SANDBOX_CMDS = {
    "javascript": ["node", "index.js"],
    "typescript": ["sh", "-c", "npx ts-node index.ts 2>/dev/null || node index.js"],
    "python":     ["python3", "main.py"],
    "go":         ["sh", "-c", "go run . 2>/dev/null || go run main.go"],
    "rust":       ["sh", "-c", "cargo run --quiet 2>/dev/null"],
    "java":       ["sh", "-c", "javac Main.java && java Main"],
    "default":    ["sh", "-c", "ls && echo 'Prêt'"],
}

SANDBOX_NETWORK = os.environ.get("SANDBOX_NETWORK", "bridge")
SANDBOX_MEM_LIMIT = os.environ.get("SANDBOX_MEM_LIMIT", "512m")
SANDBOX_CPU_QUOTA = int(os.environ.get("SANDBOX_CPU_QUOTA", "50000"))


def get_image_for_language(language: str) -> str:
    return SANDBOX_IMAGES.get(language.lower(), SANDBOX_IMAGES["default"])


def get_cmd_for_language(language: str) -> list:
    return SANDBOX_CMDS.get(language.lower(), SANDBOX_CMDS["default"])
