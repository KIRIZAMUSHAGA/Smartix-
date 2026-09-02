"""
Routes Sandbox — Container Docker par projet

Endpoints :
  POST /api/sandbox/create              — Créer/démarrer un container
  POST /api/sandbox/{project_id}/exec   — Exécuter une commande (streaming)
  GET  /api/sandbox/{project_id}/status — Statut du container
  GET  /api/sandbox/{project_id}/info   — Infos URL/port
  POST /api/sandbox/{project_id}/stop   — Arrêter le container
  POST /api/sandbox/{project_id}/restart — Redémarrer le container
  GET  /api/sandbox/list                — Lister tous les containers actifs
  WS   /ws/sandbox/{project_id}/output  — Streaming de la sortie (WebSocket)
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, Optional

from middleware.auth_middleware import get_current_user
from containers.container_manager import container_manager
from containers.security import SandboxSecurity

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Sandbox"])

_security = SandboxSecurity()

# ─── Modèles ─────────────────────────────────────────────────────────────────

class CreateContainerRequest(BaseModel):
    project_id:  str
    files:       Dict[str, str] = Field(default_factory=dict, description="{ chemin: contenu }")
    language:    str = "javascript"
    run_command: Optional[str] = None

class ExecRequest(BaseModel):
    command: str
    timeout: int = 30

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/sandbox/create")
async def create_container(
    payload: CreateContainerRequest,
    current_user: dict = Depends(get_current_user),
):
    """Crée un container Docker isolé pour un projet."""
    safe_files = _security.validate_files(payload.files)

    result = await container_manager.create_container(
        project_id=payload.project_id,
        files=safe_files,
        language=payload.language,
        run_command=payload.run_command,
    )
    return result


@router.post("/api/sandbox/{project_id}/exec")
async def exec_command(
    project_id: str,
    payload: ExecRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Exécute une commande dans le container et retourne la sortie en streaming.
    Content-Type: text/plain (SSE-like)
    """
    async def _stream():
        async for line in container_manager.exec_command(
            project_id=project_id,
            command=payload.command,
            timeout=payload.timeout,
        ):
            yield line

    return StreamingResponse(_stream(), media_type="text/plain")


@router.get("/api/sandbox/{project_id}/status")
async def get_status(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retourne le statut du container (running / stopped / simulated / error)."""
    status = await container_manager.get_container_status(project_id)
    return {"project_id": project_id, "status": status}


@router.get("/api/sandbox/{project_id}/info")
async def get_info(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retourne les informations du container (port, URL)."""
    info = container_manager.get_container_info(project_id)
    if not info:
        raise HTTPException(404, detail="Container non trouvé")
    return info


@router.post("/api/sandbox/{project_id}/stop")
async def stop_container(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Arrête et supprime le container d'un projet."""
    await container_manager.stop_container(project_id)
    return {"success": True, "project_id": project_id}


@router.post("/api/sandbox/{project_id}/restart")
async def restart_container(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Redémarre le container d'un projet."""
    await container_manager.restart_container(project_id)
    return {"success": True, "project_id": project_id}


@router.get("/api/sandbox/list")
async def list_containers(current_user: dict = Depends(get_current_user)):
    """Liste tous les containers actifs (admin)."""
    return {"containers": container_manager.list_containers()}


# ─── WebSocket — Streaming output ─────────────────────────────────────────────

@router.websocket("/ws/sandbox/{project_id}/output")
async def sandbox_output_ws(websocket: WebSocket, project_id: str):
    """
    WebSocket pour streamer la sortie d'une commande exec.
    
    Message entrant : { "command": "npm run dev" }
    Messages sortants : lignes de texte brut
    """
    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
        data = json.loads(raw)
        command = data.get("command", "ls -la")

        async for line in container_manager.exec_command(project_id, command):
            await websocket.send_text(line)

        await websocket.send_text("\n[Exécution terminée]\n")
    except asyncio.TimeoutError:
        await websocket.send_text("[Timeout — aucune commande reçue]\n")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_text(f"[Erreur] {e}\n")
    finally:
        await websocket.close()
