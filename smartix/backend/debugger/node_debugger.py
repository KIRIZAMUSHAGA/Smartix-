import asyncio
import json
import os
import re
import subprocess
from typing import Any, Dict, List, Optional

try:
    import websockets
except Exception:
    websockets = None


class NodeDebugger:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self._sequence = 1

    async def start(self, project_id: str, file_path: str) -> Dict[str, Any]:
        resolved_path = os.path.abspath(file_path)
        if not os.path.exists(resolved_path):
            raise FileNotFoundError(f"Fichier introuvable: {file_path}")

        await self.stop(project_id)

        process = subprocess.Popen(
            ["node", "--inspect-brk=127.0.0.1:0", resolved_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        session = {
            "process": process,
            "file_path": resolved_path,
            "ws": None,
            "connected": False,
            "breakpoints": [],
            "stderr_task": None,
            "stdout_task": None,
            "events": asyncio.Queue(),
        }
        self.sessions[project_id] = session

        ws_url = await self._read_inspector_url(process)
        session["inspector_url"] = ws_url

        if ws_url and websockets is not None:
            ws = await websockets.connect(ws_url)
            session["ws"] = ws
            session["connected"] = True
            await self._send(project_id, "Debugger.enable")
            await self._send(project_id, "Runtime.enable")
            session["reader_task"] = asyncio.create_task(self._read_events(project_id))

        return {
            "project_id": project_id,
            "file_path": resolved_path,
            "connected": session["connected"],
            "inspector_url": ws_url,
            "pid": process.pid,
        }

    async def stop(self, project_id: str) -> Dict[str, Any]:
        session = self.sessions.pop(project_id, None)
        if not session:
            return {"stopped": False}

        ws = session.get("ws")
        if ws:
            await ws.close()

        process = session.get("process")
        if process and process.poll() is None:
            process.terminate()
            try:
                await asyncio.wait_for(asyncio.to_thread(process.wait), timeout=3)
            except asyncio.TimeoutError:
                process.kill()

        reader_task = session.get("reader_task")
        if reader_task:
            reader_task.cancel()

        return {"stopped": True}

    async def set_breakpoints(self, project_id: str, breakpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        session = self._get_session(project_id)
        normalized = [
            {"file": os.path.abspath(bp.get("file") or session["file_path"]), "line": int(bp["line"])}
            for bp in breakpoints
            if bp.get("line")
        ]
        session["breakpoints"] = normalized

        if session.get("ws"):
            await self._send(project_id, "Debugger.removeBreakpoint", {}, ignore_errors=True)
            for bp in normalized:
                await self._send(
                    project_id,
                    "Debugger.setBreakpointByUrl",
                    {
                        "lineNumber": max(0, bp["line"] - 1),
                        "urlRegex": re.escape(bp["file"]),
                    },
                    ignore_errors=True,
                )

        return {"breakpoints": normalized, "count": len(normalized)}

    async def continue_execution(self, project_id: str) -> Dict[str, Any]:
        await self._send(project_id, "Debugger.resume", {}, ignore_errors=True)
        return {"continued": True}

    async def step_over(self, project_id: str) -> Dict[str, Any]:
        await self._send(project_id, "Debugger.stepOver", {}, ignore_errors=True)
        return {"step": "over"}

    async def step_into(self, project_id: str) -> Dict[str, Any]:
        await self._send(project_id, "Debugger.stepInto", {}, ignore_errors=True)
        return {"step": "into"}

    async def step_out(self, project_id: str) -> Dict[str, Any]:
        await self._send(project_id, "Debugger.stepOut", {}, ignore_errors=True)
        return {"step": "out"}

    async def get_stack_trace(self, project_id: str) -> Dict[str, Any]:
        session = self._get_session(project_id)
        return {"callStack": session.get("last_call_stack", [])}

    async def get_variables(self, project_id: str) -> Dict[str, Any]:
        session = self._get_session(project_id)
        return {"variables": session.get("last_variables", [])}

    async def _read_inspector_url(self, process: subprocess.Popen) -> Optional[str]:
        if not process.stderr:
            return None

        deadline = asyncio.get_event_loop().time() + 5
        while asyncio.get_event_loop().time() < deadline:
            line = await asyncio.to_thread(process.stderr.readline)
            match = re.search(r"(ws://[^\s]+)", line or "")
            if match:
                return match.group(1)
            if process.poll() is not None:
                return None
        return None

    async def _send(self, project_id: str, method: str, params: Optional[Dict[str, Any]] = None, ignore_errors: bool = False) -> Dict[str, Any]:
        session = self._get_session(project_id)
        ws = session.get("ws")
        if not ws:
            if ignore_errors:
                return {}
            raise RuntimeError("Inspecteur Node.js non connecté")

        message_id = self._sequence
        self._sequence += 1
        await ws.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        return {"id": message_id, "method": method}

    async def _read_events(self, project_id: str) -> None:
        session = self.sessions.get(project_id)
        if not session or not session.get("ws"):
            return

        ws = session["ws"]
        async for raw in ws:
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if event.get("method") == "Debugger.paused":
                frames = event.get("params", {}).get("callFrames", [])
                session["last_call_stack"] = self._normalize_call_stack(frames)
                session["last_variables"] = self._normalize_variables(frames[:1])
                await session["events"].put({
                    "type": "paused",
                    "variables": session["last_variables"],
                    "callStack": session["last_call_stack"],
                })
            elif event.get("method") == "Debugger.resumed":
                await session["events"].put({"type": "continued"})

    def _normalize_call_stack(self, frames: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        call_stack = []
        for frame in frames:
            location = frame.get("location", {})
            call_stack.append({
                "function": frame.get("functionName") or "(anonymous)",
                "file": frame.get("url") or "",
                "line": int(location.get("lineNumber", 0)) + 1,
                "column": int(location.get("columnNumber", 0)) + 1,
            })
        return call_stack

    def _normalize_variables(self, frames: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not frames:
            return []

        variables = []
        for scope in frames[0].get("scopeChain", []):
            variables.append({
                "name": scope.get("name") or scope.get("type", "scope"),
                "value": scope.get("object", {}).get("description", ""),
                "type": scope.get("type", "object"),
            })
        return variables

    def _get_session(self, project_id: str) -> Dict[str, Any]:
        session = self.sessions.get(project_id)
        if not session:
            raise RuntimeError(f"Aucune session Node.js active pour {project_id}")
        return session