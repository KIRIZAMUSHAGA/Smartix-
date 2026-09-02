from typing import Any, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from debugger.dap_server import dap_server
from services.watch_service import watch_service


router = APIRouter()


class StartDebuggerRequest(BaseModel):
    file_path: str
    runtime: str = None


class BreakpointsRequest(BaseModel):
    breakpoints: List[Dict[str, Any]]


class WatchRequest(BaseModel):
    project_path: str


@router.post("/api/debugger/{project_id}/start")
async def start_debugger(project_id: str, payload: StartDebuggerRequest):
    return await dap_server.start_debugger(project_id, payload.file_path, payload.runtime)


@router.post("/api/debugger/{project_id}/stop")
async def stop_debugger(project_id: str):
    return await dap_server.stop_debugger(project_id)


@router.post("/api/debugger/{project_id}/breakpoints")
async def set_breakpoints(project_id: str, payload: BreakpointsRequest):
    return await dap_server.set_breakpoints(project_id, payload.breakpoints)


@router.get("/api/debugger/{project_id}/stack")
async def get_stack(project_id: str):
    return await dap_server.get_stack_trace(project_id)


@router.get("/api/debugger/{project_id}/variables")
async def get_variables(project_id: str):
    return await dap_server.get_variables(project_id)


@router.post("/api/debugger/{project_id}/continue")
async def continue_execution(project_id: str):
    return await dap_server.continue_execution(project_id)


@router.post("/api/debugger/{project_id}/step-over")
async def step_over(project_id: str):
    return await dap_server.step_over(project_id)


@router.post("/api/debugger/{project_id}/step-into")
async def step_into(project_id: str):
    return await dap_server.step_into(project_id)


@router.post("/api/debugger/{project_id}/step-out")
async def step_out(project_id: str):
    return await dap_server.step_out(project_id)


@router.websocket("/ws/debugger/{project_id}")
async def debugger_websocket(websocket: WebSocket, project_id: str):
    await websocket.accept()
    await dap_server.register_client(project_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            if action == "continue":
                await dap_server.continue_execution(project_id)
            elif action == "stepOver":
                await dap_server.step_over(project_id)
            elif action == "stepInto":
                await dap_server.step_into(project_id)
            elif action == "stepOut":
                await dap_server.step_out(project_id)
            elif action == "stop":
                await dap_server.stop_debugger(project_id)
    except WebSocketDisconnect:
        await dap_server.unregister_client(project_id, websocket)


@router.post("/api/watch/{project_id}/start")
async def start_watch(project_id: str, payload: WatchRequest):
    return await watch_service.start_watching(project_id, payload.project_path)


@router.post("/api/watch/{project_id}/stop")
async def stop_watch(project_id: str):
    return await watch_service.stop_watching(project_id)


@router.websocket("/ws/watch/{project_id}")
async def watch_websocket(websocket: WebSocket, project_id: str):
    await websocket.accept()
    await watch_service.register_client(project_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await watch_service.unregister_client(project_id, websocket)