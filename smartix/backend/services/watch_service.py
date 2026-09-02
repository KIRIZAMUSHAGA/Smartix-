import asyncio
import os
import time
from typing import Any, Dict, Set

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except Exception:
    FileSystemEventHandler = None
    Observer = None


class WatchService:
    def __init__(self):
        self.observers: Dict[str, Any] = {}
        self.watch_tasks: Dict[str, asyncio.Task] = {}
        self.clients: Dict[str, Set[Any]] = {}
        self.project_paths: Dict[str, str] = {}

    async def start_watching(self, project_id: str, project_path: str) -> Dict[str, Any]:
        resolved_path = os.path.abspath(project_path)
        if not os.path.isdir(resolved_path):
            raise FileNotFoundError(f"Dossier introuvable: {project_path}")

        await self.stop_watching(project_id)
        self.project_paths[project_id] = resolved_path
        self.loop = asyncio.get_running_loop()

        if Observer and FileSystemEventHandler:
            event_handler = self._create_handler(project_id)
            observer = Observer()
            observer.schedule(event_handler, resolved_path, recursive=True)
            observer.start()
            self.observers[project_id] = observer
            mode = "watchdog"
        else:
            self.watch_tasks[project_id] = asyncio.create_task(self._poll_changes(project_id, resolved_path))
            mode = "polling"

        return {"watching": True, "project_id": project_id, "path": resolved_path, "mode": mode}

    async def stop_watching(self, project_id: str) -> Dict[str, Any]:
        if project_id in self.observers:
            observer = self.observers.pop(project_id)
            observer.stop()
            observer.join(timeout=3)

        task = self.watch_tasks.pop(project_id, None)
        if task:
            task.cancel()

        self.project_paths.pop(project_id, None)
        return {"watching": False, "project_id": project_id}

    async def register_client(self, project_id: str, websocket: Any) -> None:
        self.clients.setdefault(project_id, set()).add(websocket)

    async def unregister_client(self, project_id: str, websocket: Any) -> None:
        clients = self.clients.get(project_id)
        if clients:
            clients.discard(websocket)

    def _create_handler(self, project_id: str):
        service = self
        loop = getattr(self, "loop", None)

        class Handler(FileSystemEventHandler):
            def on_modified(self, event):
                if not event.is_directory and loop:
                    asyncio.run_coroutine_threadsafe(
                        service._notify_restart(project_id, event.src_path),
                        loop,
                    )

            def on_created(self, event):
                if not event.is_directory and loop:
                    asyncio.run_coroutine_threadsafe(
                        service._notify_restart(project_id, event.src_path),
                        loop,
                    )

        return Handler()

    async def _poll_changes(self, project_id: str, project_path: str) -> None:
        snapshot = self._snapshot(project_path)
        while True:
            await asyncio.sleep(1)
            next_snapshot = self._snapshot(project_path)
            changed = [
                path for path, mtime in next_snapshot.items()
                if snapshot.get(path) and snapshot[path] != mtime
            ]
            created = [path for path in next_snapshot if path not in snapshot]
            snapshot = next_snapshot
            for path in changed + created:
                await self._notify_restart(project_id, path)

    def _snapshot(self, project_path: str) -> Dict[str, float]:
        snapshot = {}
        for root, dirs, files in os.walk(project_path):
            dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__", ".venv"}]
            for name in files:
                path = os.path.join(root, name)
                try:
                    snapshot[path] = os.path.getmtime(path)
                except OSError:
                    continue
        return snapshot

    async def _notify_restart(self, project_id: str, file_changed: str) -> None:
        payload = {
            "type": "restart_required",
            "project_id": project_id,
            "file_changed": file_changed,
            "timestamp": time.time(),
        }
        for ws in list(self.clients.get(project_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                await self.unregister_client(project_id, ws)


watch_service = WatchService()