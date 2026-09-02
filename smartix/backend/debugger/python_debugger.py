import asyncio
import os
import sys
from bdb import Bdb
from typing import Any, Dict, List, Optional

try:
    import debugpy
except Exception:
    debugpy = None


class PythonDebugger:
    def __init__(self):
        self.debug_ports: Dict[str, int] = {}
        self.breakpoints: Dict[str, List[Dict[str, Any]]] = {}
        self.sessions: Dict[str, Dict[str, Any]] = {}

    async def start_debugger(self, project_id: str, file_path: str, port: int = 5678) -> Dict[str, Any]:
        resolved_path = os.path.abspath(file_path)
        if not os.path.exists(resolved_path):
            raise FileNotFoundError(f"Fichier introuvable: {file_path}")

        self.debug_ports[project_id] = port
        self.sessions[project_id] = {
            "file_path": resolved_path,
            "port": port,
            "connected": debugpy is not None,
            "variables": [],
            "callStack": [],
        }

        if debugpy is not None:
            try:
                debugpy.listen(("127.0.0.1", port))
            except RuntimeError:
                pass

        return {
            "project_id": project_id,
            "file_path": resolved_path,
            "port": port,
            "debugpy_available": debugpy is not None,
        }

    async def set_breakpoint(self, project_id: str, file_path: str, line: int) -> Dict[str, Any]:
        resolved_path = os.path.abspath(file_path)
        breakpoint = {"file": resolved_path, "line": int(line), "verified": os.path.exists(resolved_path)}
        self.breakpoints.setdefault(project_id, [])
        self.breakpoints[project_id] = [
            bp for bp in self.breakpoints[project_id]
            if not (bp["file"] == resolved_path and bp["line"] == int(line))
        ] + [breakpoint]

        if debugpy is not None:
            try:
                debugpy.breakpoint()
            except Exception:
                breakpoint["verified"] = False

        return breakpoint

    async def set_breakpoints(self, project_id: str, breakpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = []
        for bp in breakpoints:
            if bp.get("line"):
                results.append(await self.set_breakpoint(project_id, bp.get("file", ""), int(bp["line"])))
        return {"breakpoints": results, "count": len(results)}

    async def get_variables(self, project_id: str) -> Dict[str, Any]:
        frame = sys._getframe()
        variables = []
        for name, value in frame.f_locals.items():
            if name.startswith("_"):
                continue
            variables.append({
                "name": name,
                "value": repr(value)[:300],
                "type": type(value).__name__,
            })
        self.sessions.setdefault(project_id, {})["variables"] = variables
        return {"variables": variables}

    async def get_stack_trace(self, project_id: str) -> Dict[str, Any]:
        frame = sys._getframe()
        call_stack = []
        while frame:
            call_stack.append({
                "function": frame.f_code.co_name,
                "file": frame.f_code.co_filename,
                "line": frame.f_lineno,
            })
            frame = frame.f_back
        self.sessions.setdefault(project_id, {})["callStack"] = call_stack
        return {"callStack": call_stack}


python_debugger = PythonDebugger()