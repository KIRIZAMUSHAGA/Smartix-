import asyncio
import os
import subprocess
from typing import Any, Dict, List, Set

from .node_debugger import NodeDebugger
from .python_debugger import python_debugger


class DAPServer:
    def __init__(self):
        self.processes: Dict[str, subprocess.Popen] = {}
        self.breakpoints: Dict[str, List[Dict[str, Any]]] = {}
        self.node_debugger = NodeDebugger()
        self.python_debugger = python_debugger
        self.clients: Dict[str, Set[Any]] = {}

    async def start_debugger(self, project_id: str, file_path: str, runtime: str = None) -> Dict[str, Any]:
        extension = os.path.splitext(file_path)[1].lower()
        selected_runtime = runtime or ("python" if extension == ".py" else "node")
        if selected_runtime == "python":
            result = await self.python_debugger.start_debugger(project_id, file_path)
        else:
            result = await self.node_debugger.start(project_id, file_path)
            asyncio.create_task(self._forward_node_events(project_id))

        await self.broadcast(project_id, {"type": "started", "runtime": selected_runtime, **result})
        return result

    async def stop_debugger(self, project_id: str) -> Dict[str, Any]:
        result = await self.node_debugger.stop(project_id)
        self.processes.pop(project_id, None)
        await self.broadcast(project_id, {"type": "stopped"})
        return result

    async def set_breakpoints(self, project_id: str, breakpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        self.breakpoints[project_id] = breakpoints
        if breakpoints and str(breakpoints[0].get("file", "")).endswith(".py"):
            result = await self.python_debugger.set_breakpoints(project_id, breakpoints)
        else:
            try:
                result = await self.node_debugger.set_breakpoints(project_id, breakpoints)
            except RuntimeError:
                result = {"breakpoints": breakpoints, "count": len(breakpoints), "pending": True}

        await self.broadcast(project_id, {"type": "breakpoints", **result})
        return result

    async def get_stack_trace(self, project_id: str) -> Dict[str, Any]:
        try:
            return await self.node_debugger.get_stack_trace(project_id)
        except Exception:
            return await self.python_debugger.get_stack_trace(project_id)

    async def get_variables(self, project_id: str) -> Dict[str, Any]:
        try:
            return await self.node_debugger.get_variables(project_id)
        except Exception:
            return await self.python_debugger.get_variables(project_id)

    async def continue_execution(self, project_id: str) -> Dict[str, Any]:
        result = await self.node_debugger.continue_execution(project_id)
        await self.broadcast(project_id, {"type": "continued"})
        return result

    async def step_over(self, project_id: str) -> Dict[str, Any]:
        return await self.node_debugger.step_over(project_id)

    async def step_into(self, project_id: str) -> Dict[str, Any]:
        return await self.node_debugger.step_into(project_id)

    async def step_out(self, project_id: str) -> Dict[str, Any]:
        return await self.node_debugger.step_out(project_id)

    async def register_client(self, project_id: str, websocket: Any) -> None:
        self.clients.setdefault(project_id, set()).add(websocket)

    async def unregister_client(self, project_id: str, websocket: Any) -> None:
        clients = self.clients.get(project_id)
        if clients:
            clients.discard(websocket)

    async def broadcast(self, project_id: str, payload: Dict[str, Any]) -> None:
        clients = list(self.clients.get(project_id, []))
        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception:
                await self.unregister_client(project_id, ws)

    async def _connect_websocket(self, project_id: str) -> None:
        return None

    async def _send_command(self, project_id: str, command: Dict[str, Any]) -> Dict[str, Any]:
        command_name = command.get("command")
        if command_name == "setBreakpoints":
            return await self.set_breakpoints(
                project_id,
                [
                    {
                        "file": command.get("arguments", {}).get("source", {}).get("path"),
                        "line": item.get("line"),
                    }
                    for item in command.get("arguments", {}).get("breakpoints", [])
                ],
            )
        if command_name == "stackTrace":
            return await self.get_stack_trace(project_id)
        if command_name == "continue":
            return await self.continue_execution(project_id)
        return {"ok": False, "message": f"Commande DAP non supportée: {command_name}"}

    async def _forward_node_events(self, project_id: str) -> None:
        session = self.node_debugger.sessions.get(project_id)
        if not session:
            return

        events = session.get("events")
        while project_id in self.node_debugger.sessions:
            payload = await events.get()
            await self.broadcast(project_id, payload)


dap_server = DAPServer()