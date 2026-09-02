"""
Routes LSP — Language Server Protocol

Endpoints HTTP :
  POST /api/lsp/open        — Ouvrir un fichier dans le LSP
  POST /api/lsp/completion  — Autocomplétion
  POST /api/lsp/hover       — Info au survol
  POST /api/lsp/definition  — Go to Definition
  POST /api/lsp/references  — Find References
  GET  /api/lsp/diagnostics — Diagnostics d'un fichier

WebSocket :
  WS /ws/terminal/{session_id} — PTY réel
  WS /ws/lsp/{language}        — Proxy LSP WebSocket (diagnostics push)
"""

import logging
import os
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket
from pydantic import BaseModel

from middleware.auth_middleware import get_current_user
from lsp.typescript_server import get_ts_lsp
from lsp.python_server     import get_python_lsp
from websocket.terminal     import handle_terminal_websocket

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LSP & Terminal"])

PROJECTS_DIR = os.environ.get("PROJECTS_DIR", "/tmp/vibe-coding-projects")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _project_root(project_id: str, user_id: str) -> str:
    path = os.path.join(PROJECTS_DIR, user_id, project_id)
    os.makedirs(path, exist_ok=True)
    return path

def _language_from_uri(uri: str) -> str:
    if uri.endswith((".ts", ".tsx")):
        return "typescript"
    if uri.endswith((".js", ".jsx", ".mjs")):
        return "javascript"
    if uri.endswith(".py"):
        return "python"
    return "plaintext"

# ─── Modèles ─────────────────────────────────────────────────────────────────

class FileOpenRequest(BaseModel):
    project_id: str
    uri:        str
    text:       str

class LSPPositionRequest(BaseModel):
    project_id: str
    uri:        str
    line:       int
    column:     int

class RenameRequest(BaseModel):
    project_id: str
    uri:        str
    line:       int
    column:     int
    new_name:   str

# ─── Endpoints LSP ────────────────────────────────────────────────────────────

@router.post("/api/lsp/open")
async def lsp_open(payload: FileOpenRequest, current_user: dict = Depends(get_current_user)):
    """Ouvrir un fichier dans le serveur LSP approprié."""
    root = _project_root(payload.project_id, current_user["id"])
    lang = _language_from_uri(payload.uri)
    try:
        if lang in ("typescript", "javascript"):
            lsp = await get_ts_lsp(payload.project_id, root)
            if lsp:
                lsp.did_open(payload.uri, payload.text, lang)
        elif lang == "python":
            lsp = await get_python_lsp(payload.project_id, root)
            if lsp:
                lsp.did_open(payload.uri, payload.text)
        return {"success": True, "language": lang}
    except Exception as e:
        logger.error(f"LSP open erreur : {e}")
        return {"success": False, "error": str(e)}


@router.post("/api/lsp/completion")
async def lsp_completion(payload: LSPPositionRequest, current_user: dict = Depends(get_current_user)):
    """Obtenir des suggestions d'autocomplétion."""
    root = _project_root(payload.project_id, current_user["id"])
    lang = _language_from_uri(payload.uri)
    try:
        if lang in ("typescript", "javascript"):
            lsp = await get_ts_lsp(payload.project_id, root)
            if lsp:
                items = await lsp.completion(payload.uri, payload.line, payload.column)
                return {"items": items}
        elif lang == "python":
            lsp = await get_python_lsp(payload.project_id, root)
            if lsp:
                items = await lsp.completion(payload.uri, payload.line, payload.column)
                return {"items": items}
        return {"items": []}
    except Exception as e:
        logger.error(f"LSP completion erreur : {e}")
        return {"items": [], "error": str(e)}


@router.post("/api/lsp/hover")
async def lsp_hover(payload: LSPPositionRequest, current_user: dict = Depends(get_current_user)):
    """Obtenir les informations de survol (hover)."""
    root = _project_root(payload.project_id, current_user["id"])
    lang = _language_from_uri(payload.uri)
    try:
        if lang in ("typescript", "javascript"):
            lsp = await get_ts_lsp(payload.project_id, root)
            if lsp:
                text = await lsp.hover(payload.uri, payload.line, payload.column)
                return {"text": text}
        elif lang == "python":
            lsp = await get_python_lsp(payload.project_id, root)
            if lsp:
                text = await lsp.hover(payload.uri, payload.line, payload.column)
                return {"text": text}
        return {"text": None}
    except Exception as e:
        logger.error(f"LSP hover erreur : {e}")
        return {"text": None}


@router.post("/api/lsp/definition")
async def lsp_definition(payload: LSPPositionRequest, current_user: dict = Depends(get_current_user)):
    """Go to Definition — retourne l'URI et la range de la définition."""
    root = _project_root(payload.project_id, current_user["id"])
    lang = _language_from_uri(payload.uri)
    try:
        if lang in ("typescript", "javascript"):
            lsp = await get_ts_lsp(payload.project_id, root)
            if lsp:
                return await lsp.definition(payload.uri, payload.line, payload.column) or {}
        elif lang == "python":
            lsp = await get_python_lsp(payload.project_id, root)
            if lsp:
                return await lsp.definition(payload.uri, payload.line, payload.column) or {}
        return {}
    except Exception as e:
        logger.error(f"LSP definition erreur : {e}")
        return {}


@router.post("/api/lsp/references")
async def lsp_references(payload: LSPPositionRequest, current_user: dict = Depends(get_current_user)):
    """Find All References — retourne la liste des usages."""
    root = _project_root(payload.project_id, current_user["id"])
    lang = _language_from_uri(payload.uri)
    try:
        if lang in ("typescript", "javascript"):
            lsp = await get_ts_lsp(payload.project_id, root)
            if lsp:
                return {"references": await lsp.references(payload.uri, payload.line, payload.column)}
        elif lang == "python":
            lsp = await get_python_lsp(payload.project_id, root)
            if lsp:
                return {"references": await lsp.references(payload.uri, payload.line, payload.column)}
        return {"references": []}
    except Exception as e:
        logger.error(f"LSP references erreur : {e}")
        return {"references": []}


@router.get("/api/lsp/diagnostics")
async def lsp_diagnostics(
    project_id: str,
    uri:        str,
    current_user: dict = Depends(get_current_user),
):
    """Récupère les diagnostics actuels d'un fichier."""
    root = _project_root(project_id, current_user["id"])
    lang = _language_from_uri(uri)
    try:
        if lang in ("typescript", "javascript"):
            lsp = await get_ts_lsp(project_id, root)
            if lsp:
                return {"diagnostics": lsp.get_diagnostics(uri)}
        elif lang == "python":
            lsp = await get_python_lsp(project_id, root)
            if lsp:
                return {"diagnostics": lsp.get_diagnostics(uri)}
        return {"diagnostics": []}
    except Exception as e:
        return {"diagnostics": [], "error": str(e)}


# ─── WebSocket — Terminal PTY ─────────────────────────────────────────────────

@router.websocket("/ws/terminal/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket PTY réel.
    
    Connexion : ws://host/ws/terminal/<session_id>?dir=/chemin/projet
    """
    await handle_terminal_websocket(websocket, session_id)


# ─── WebSocket — LSP diagnostics push ────────────────────────────────────────

@router.websocket("/ws/lsp/{language}")
async def lsp_websocket(websocket: WebSocket, language: str):
    """
    WebSocket pour recevoir les diagnostics LSP en temps réel (push).
    
    Protocole entrant (JSON) :
      { "type": "open",   "project_id": "...", "uri": "...", "text": "...", "user_id": "..." }
      { "type": "change", "project_id": "...", "uri": "...", "text": "...", "version": 2 }
    
    Protocole sortant (JSON) :
      { "type": "diagnostics", "uri": "...", "diagnostics": [...] }
    """
    import json as _json
    from fastapi import WebSocketDisconnect

    await websocket.accept()

    async def on_diagnostics(event_type: str, uri: str, diagnostics: list):
        try:
            await websocket.send_text(_json.dumps({
                "type":        "diagnostics",
                "uri":         uri,
                "diagnostics": diagnostics,
            }))
        except Exception:
            pass

    lsp_ref = {"lsp": None}

    try:
        async for msg in websocket.iter_text():
            try:
                data = _json.loads(msg)
                t = data.get("type")
                project_id = data.get("project_id", "default")
                user_id    = data.get("user_id", "anon")
                uri        = data.get("uri", "")
                text       = data.get("text", "")
                root       = _project_root(project_id, user_id)

                if language in ("typescript", "javascript"):
                    lsp = await get_ts_lsp(project_id, root)
                elif language == "python":
                    lsp = await get_python_lsp(project_id, root)
                else:
                    lsp = None

                if lsp:
                    lsp.set_notify_callback(on_diagnostics)
                    lsp_ref["lsp"] = lsp
                    if t == "open":
                        lsp.did_open(uri, text, language)
                    elif t == "change":
                        lsp.did_change(uri, text, int(data.get("version", 2)))
            except Exception as e:
                logger.warning(f"LSP WS erreur : {e}")
    except Exception:
        pass
