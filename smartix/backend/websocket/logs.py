"""
Serveur WebSocket de streaming de logs production

Fonctionnalités :
- Connexion WebSocket pour recevoir les logs en temps réel
- Streaming des logs Vercel via polling (SSE → WebSocket bridge)
- Filtrage par niveau (info, warn, error)
- Historique des 500 dernières lignes
"""

import asyncio
import json
import logging
import os
from typing import Dict, Set, List
from collections import deque

import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

import httpx

logger = logging.getLogger(__name__)

VERCEL_API  = "https://api.vercel.com"
MAX_HISTORY = 500

# ─── LogRoom : salle de diffusion de logs ────────────────────────────────────

class LogRoom:
    """Gère un flux de logs pour un déploiement donné."""

    def __init__(self, deployment_id: str):
        self.deployment_id = deployment_id
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.history: deque = deque(maxlen=MAX_HISTORY)
        self._poller_task: asyncio.Task = None
        self._running      = False

    def add_client(self, ws):
        self.clients.add(ws)

    def remove_client(self, ws):
        self.clients.discard(ws)

    def is_empty(self) -> bool:
        return len(self.clients) == 0

    async def broadcast(self, entry: dict, exclude=None):
        dead = set()
        for client in list(self.clients):
            if client is exclude:
                continue
            try:
                await client.send(json.dumps(entry))
            except (ConnectionClosedError, ConnectionClosedOK):
                dead.add(client)
        for c in dead:
            self.clients.discard(c)

    async def send_history(self, ws):
        """Envoie l'historique des logs au nouveau client."""
        for entry in self.history:
            try:
                await ws.send(json.dumps(entry))
            except Exception:
                break

    async def start_polling(self, token: str, provider: str = "vercel"):
        """Démarre le polling des logs depuis le provider."""
        if self._running:
            return
        self._running = True
        self._poller_task = asyncio.create_task(
            self._poll_vercel_logs(token) if provider == "vercel"
            else self._poll_generic_logs()
        )

    def stop_polling(self):
        self._running = False
        if self._poller_task:
            self._poller_task.cancel()

    # ── Polling Vercel ───────────────────────────────────────────────────

    async def _poll_vercel_logs(self, token: str):
        """Interroge l'API Vercel /v2/deployments/{id}/events toutes les 3s."""
        seen_ids = set()
        while self._running and not self.is_empty():
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        f"{VERCEL_API}/v2/deployments/{self.deployment_id}/events",
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                        timeout=10,
                    )
                    if resp.status_code == 200:
                        events = resp.json() if isinstance(resp.json(), list) else resp.json().get("events", [])
                        for ev in events:
                            ev_id = ev.get("id", "")
                            if ev_id in seen_ids:
                                continue
                            seen_ids.add(ev_id)
                            entry = {
                                "id":      ev_id,
                                "type":    ev.get("type", "log"),
                                "text":    ev.get("text", ""),
                                "level":   ev.get("level", "info"),
                                "created": ev.get("created"),
                            }
                            self.history.append(entry)
                            await self.broadcast(entry)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Erreur polling logs Vercel {self.deployment_id}: {e}")

            await asyncio.sleep(3)

    async def _poll_generic_logs(self):
        """Générateur de logs de démo pour tests sans provider réel."""
        import time
        import random
        messages = [
            ("info",  "Déploiement démarré"),
            ("info",  "Installation des dépendances…"),
            ("info",  "npm install terminé"),
            ("info",  "Build en cours…"),
            ("warn",  "Avertissement : variable NODE_ENV non définie"),
            ("info",  "Build terminé en 12.4s"),
            ("info",  "Upload des assets… (1/3)"),
            ("info",  "Upload des assets… (2/3)"),
            ("info",  "Upload des assets… (3/3)"),
            ("info",  "Déploiement actif : https://mon-projet.vercel.app"),
        ]
        for level, text in messages:
            if not self._running or self.is_empty():
                break
            entry = {"type": "log", "text": text, "level": level, "created": int(time.time() * 1000)}
            self.history.append(entry)
            await self.broadcast(entry)
            await asyncio.sleep(random.uniform(0.8, 2.0))


# ─── LogsServer ───────────────────────────────────────────────────────────────

class LogsServer:
    """Serveur WebSocket de streaming de logs."""

    def __init__(self):
        self.rooms: Dict[str, LogRoom] = {}

    def get_or_create_room(self, deployment_id: str) -> LogRoom:
        if deployment_id not in self.rooms:
            self.rooms[deployment_id] = LogRoom(deployment_id)
        return self.rooms[deployment_id]

    def cleanup_room(self, deployment_id: str):
        room = self.rooms.get(deployment_id)
        if room and room.is_empty():
            room.stop_polling()
            del self.rooms[deployment_id]

    async def handle_connection(self, websocket, path: str):
        """
        Path attendu : /logs/<deployment_id>?token=<vercel_token>&provider=vercel
        """
        parts     = path.split("?")
        dep_id    = parts[0].lstrip("/logs/").strip("/")
        query     = parts[1] if len(parts) > 1 else ""

        token    = ""
        provider = "vercel"
        for param in query.split("&"):
            if param.startswith("token="):
                token = param[6:]
            elif param.startswith("provider="):
                provider = param[9:]

        if not dep_id:
            await websocket.close(1008, "deployment_id manquant")
            return

        room = self.get_or_create_room(dep_id)
        room.add_client(websocket)

        # Envoyer l'historique au nouveau client
        await room.send_history(websocket)

        # Démarrer le polling si pas encore lancé
        if token:
            await room.start_polling(token, provider)

        logger.info(f"Client connecté aux logs {dep_id} ({len(room.clients)} clients)")

        try:
            # Maintenir la connexion ouverte et traiter les messages entrants
            async for message in websocket:
                try:
                    data = json.loads(message)
                    if data.get("cmd") == "ping":
                        await websocket.send(json.dumps({"cmd": "pong"}))
                    elif data.get("cmd") == "clear":
                        room.history.clear()
                except Exception:
                    pass
        except (ConnectionClosedError, ConnectionClosedOK):
            pass
        finally:
            room.remove_client(websocket)
            self.cleanup_room(dep_id)
            logger.info(f"Client déconnecté des logs {dep_id}")


# ─── Singleton & point d'entrée ───────────────────────────────────────────────

logs_server = LogsServer()


async def start_logs_server(host: str = "0.0.0.0", port: int = 1235):
    """Démarre le serveur WebSocket de logs."""
    logger.info(f"Serveur de logs démarré sur ws://{host}:{port}")
    async with websockets.serve(
        logs_server.handle_connection,
        host,
        port,
        ping_interval=20,
        ping_timeout=10,
    ):
        await asyncio.Future()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_logs_server())
