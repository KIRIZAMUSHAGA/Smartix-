"""
PythonLSP — Bridge JSON-RPC vers pyright-langserver (ou pylsp)

Fonctionnalités :
- Lance pyright-langserver --stdio ou python-lsp-server
- Diagnostics Python en temps réel
- Autocomplétion (fonctions, classes, modules)
- Go to Definition + Find References
- Hover info (docstrings, types)
- Fallback : pylsp si pyright indisponible
"""

import asyncio
import json
import logging
import os
import re
import subprocess
from typing import Any, Dict, List, Optional, Callable

logger = logging.getLogger(__name__)

CONTENT_LENGTH_RE = re.compile(rb"Content-Length: (\d+)\r\n")


def _encode_lsp(payload: dict) -> bytes:
    body   = json.dumps(payload).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    return header + body


async def _read_lsp_message(reader: asyncio.StreamReader) -> Optional[dict]:
    try:
        header_lines = b""
        while True:
            line = await reader.readline()
            if line == b"\r\n":
                break
            header_lines += line
        m = CONTENT_LENGTH_RE.search(header_lines)
        if not m:
            return None
        length = int(m.group(1))
        body = await reader.readexactly(length)
        return json.loads(body.decode("utf-8"))
    except Exception:
        return None


# ─── PythonLSP ────────────────────────────────────────────────────────────────

class PythonLSP:
    """
    Client LSP pour pyright-langserver ou python-lsp-server (pylsp).
    
    Ordre de préférence : pyright > pylsp > basedpyright
    """

    BINARIES = [
        "pyright-langserver",
        "pylsp",
        "python-language-server",
        "basedpyright-langserver",
    ]
    BINARY_FLAGS = {
        "pyright-langserver": ["--stdio"],
        "pylsp": [],
        "python-language-server": [],
        "basedpyright-langserver": ["--stdio"],
    }

    def __init__(self, root_path: str):
        self.root_path   = root_path
        self.root_uri    = f"file://{root_path}"
        self._proc       = None
        self._reader     = None
        self._writer     = None
        self._req_id     = 0
        self._pending: Dict[int, asyncio.Future] = {}
        self._diagnostics: Dict[str, List] = {}
        self._notify_cb: Optional[Callable] = None
        self._read_task  = None
        self.initialized = False
        self.available   = False
        self._binary     = None

    async def start(self) -> bool:
        self._binary = self._find_binary()
        if not self._binary:
            logger.warning("Aucun serveur LSP Python trouvé (pyright, pylsp) — désactivé")
            return False

        flags = self.BINARY_FLAGS.get(os.path.basename(self._binary), ["--stdio"])
        cmd   = [self._binary] + flags

        try:
            self._proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                cwd=self.root_path,
            )
            self._reader = self._proc.stdout
            self._writer = self._proc.stdin
            self._read_task = asyncio.create_task(self._read_loop())
            await self._initialize()
            self.available = True
            logger.info(f"Python LSP ({self._binary}) démarré (PID {self._proc.pid})")
            return True
        except Exception as e:
            logger.error(f"Erreur démarrage Python LSP : {e}")
            return False

    def _find_binary(self) -> Optional[str]:
        for b in self.BINARIES:
            result = subprocess.run(["which", b], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        return None

    async def _read_loop(self):
        while self._proc and self._proc.returncode is None:
            msg = await _read_lsp_message(self._reader)
            if msg is None:
                break
            self._dispatch(msg)

    def _dispatch(self, msg: dict):
        msg_id = msg.get("id")
        method = msg.get("method")

        if msg_id is not None and msg_id in self._pending:
            fut = self._pending.pop(msg_id)
            if not fut.done():
                if "error" in msg:
                    fut.set_exception(Exception(msg["error"].get("message", "LSP error")))
                else:
                    fut.set_result(msg.get("result"))

        elif method == "textDocument/publishDiagnostics":
            params = msg.get("params", {})
            uri    = params.get("uri", "")
            self._diagnostics[uri] = params.get("diagnostics", [])
            if self._notify_cb:
                asyncio.create_task(self._notify_cb("diagnostics", uri, self._diagnostics[uri]))

    async def _request(self, method: str, params: dict = None, timeout: float = 5.0) -> Any:
        if not self._writer:
            raise RuntimeError("LSP non démarré")
        self._req_id += 1
        req_id = self._req_id
        payload = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}}
        fut = asyncio.get_event_loop().create_future()
        self._pending[req_id] = fut
        self._writer.write(_encode_lsp(payload))
        await self._writer.drain()
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            logger.warning(f"Python LSP timeout sur {method}")
            return None

    def _notify(self, method: str, params: dict = None):
        if not self._writer:
            return
        payload = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        self._writer.write(_encode_lsp(payload))

    async def _initialize(self):
        result = await self._request("initialize", {
            "processId": os.getpid(),
            "rootUri":   self.root_uri,
            "rootPath":  self.root_path,
            "capabilities": {
                "textDocument": {
                    "completion":   {"completionItem": {"snippetSupport": True}},
                    "hover":        {"contentFormat": ["plaintext", "markdown"]},
                    "definition":   {},
                    "references":   {},
                    "publishDiagnostics": {"relatedInformation": True},
                },
            },
            "initializationOptions": {},
        })
        self._notify("initialized", {})
        self.initialized = bool(result)

    # ── API LSP ───────────────────────────────────────────────────────────

    def did_open(self, uri: str, text: str):
        self._notify("textDocument/didOpen", {
            "textDocument": {
                "uri":        uri,
                "languageId": "python",
                "version":    1,
                "text":       text,
            }
        })

    def did_change(self, uri: str, text: str, version: int = 2):
        self._notify("textDocument/didChange", {
            "textDocument": {"uri": uri, "version": version},
            "contentChanges": [{"text": text}],
        })

    def did_close(self, uri: str):
        self._notify("textDocument/didClose", {"textDocument": {"uri": uri}})

    async def completion(self, uri: str, line: int, character: int) -> List[dict]:
        result = await self._request("textDocument/completion", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        })
        if result is None:
            return []
        items = result.get("items", result) if isinstance(result, dict) else result
        return items if isinstance(items, list) else []

    async def hover(self, uri: str, line: int, character: int) -> Optional[str]:
        result = await self._request("textDocument/hover", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        })
        if not result:
            return None
        contents = result.get("contents", {})
        if isinstance(contents, dict):
            return contents.get("value", "")
        if isinstance(contents, list):
            return "\n".join(c.get("value", "") if isinstance(c, dict) else str(c) for c in contents)
        return str(contents)

    async def definition(self, uri: str, line: int, character: int) -> Optional[dict]:
        result = await self._request("textDocument/definition", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        })
        if not result:
            return None
        locations = result if isinstance(result, list) else [result]
        if locations:
            loc = locations[0]
            return {"uri": loc.get("uri", ""), "range": loc.get("range", {})}
        return None

    async def references(self, uri: str, line: int, character: int) -> List[dict]:
        result = await self._request("textDocument/references", {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
            "context": {"includeDeclaration": True},
        }, timeout=8.0)
        if not result:
            return []
        return [{"uri": r.get("uri"), "range": r.get("range")} for r in result]

    def get_diagnostics(self, uri: str) -> List[dict]:
        return self._diagnostics.get(uri, [])

    def set_notify_callback(self, cb: Callable):
        self._notify_cb = cb

    async def stop(self):
        self.available = False
        if self._read_task:
            self._read_task.cancel()
        try:
            await self._request("shutdown", {}, timeout=2.0)
            self._notify("exit")
        except Exception:
            pass
        if self._proc:
            try:
                self._proc.terminate()
                await asyncio.wait_for(self._proc.wait(), timeout=3.0)
            except Exception:
                self._proc.kill()


# ─── Pool de serveurs LSP ─────────────────────────────────────────────────────

_lsp_pool: Dict[str, PythonLSP] = {}


async def get_python_lsp(project_id: str, root_path: str) -> Optional[PythonLSP]:
    if project_id in _lsp_pool:
        lsp = _lsp_pool[project_id]
        if lsp.available:
            return lsp
    lsp = PythonLSP(root_path)
    started = await lsp.start()
    if started:
        _lsp_pool[project_id] = lsp
        return lsp
    return None


async def shutdown_python_lsp(project_id: str):
    lsp = _lsp_pool.pop(project_id, None)
    if lsp:
        await lsp.stop()
