"""
Serveur WebSocket de collaboration temps réel (Yjs / CRDT)

Fonctionnalités :
- Synchronisation des documents Yjs entre plusieurs clients
- Gestion des salles (roomId = projectId)
- Authentification JWT sur la connexion WebSocket
- Broadcast des mises à jour Awareness (curseurs)
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from typing import Dict, Set

import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

logger = logging.getLogger(__name__)

# ─── Utilitaire JWT minimal ────────────────────────────────────────────────────

def _verify_jwt(token: str) -> dict | None:
    """Vérifie un token JWT et retourne le payload, ou None si invalide."""
    try:
        import jwt as pyjwt
        secret = os.environ.get("JWT_SECRET", "dev-secret")
        payload = pyjwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except Exception:
        return None


# ─── État global des salles ────────────────────────────────────────────────────

class RoomState:
    """Représente l'état d'une salle de collaboration."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        # État Yjs encodé (bytes) pour les nouveaux entrants
        self.doc_state: bytes = b""
        # Awareness state par client id
        self.awareness: Dict[str, dict] = {}

    def add_client(self, ws: websockets.WebSocketServerProtocol):
        self.clients.add(ws)

    def remove_client(self, ws: websockets.WebSocketServerProtocol):
        self.clients.discard(ws)

    async def broadcast(self, data: bytes, exclude=None):
        """Envoie des données binaires à tous les clients sauf l'émetteur."""
        dead = set()
        for client in list(self.clients):
            if client is exclude:
                continue
            try:
                await client.send(data)
            except (ConnectionClosedError, ConnectionClosedOK):
                dead.add(client)
        for c in dead:
            self.clients.discard(c)

    def is_empty(self) -> bool:
        return len(self.clients) == 0


class CollaborationServer:
    """Serveur WebSocket de collaboration Yjs."""

    # Types de messages (protocole y-websocket)
    MSG_SYNC = 0
    MSG_AWARENESS = 1
    MSG_AUTH = 2
    MSG_QUERY_AWARENESS = 3

    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}

    # ── Gestion des salles ──────────────────────────────────────────────────

    def get_or_create_room(self, room_id: str) -> RoomState:
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomState(room_id)
        return self.rooms[room_id]

    def cleanup_room(self, room_id: str):
        room = self.rooms.get(room_id)
        if room and room.is_empty():
            del self.rooms[room_id]
            logger.info(f"Salle supprimée : {room_id}")

    # ── Connexion entrante ──────────────────────────────────────────────────

    async def handle_connection(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Gère une connexion WebSocket entrante."""
        # Extraire room_id depuis le path : /collab/<room_id>?token=...
        parts = path.split("?")
        room_id = parts[0].lstrip("/collab/").strip("/")
        query = parts[1] if len(parts) > 1 else ""

        # Authentification JWT
        token = ""
        for param in query.split("&"):
            if param.startswith("token="):
                token = param[6:]
        
        user = _verify_jwt(token)
        if user is None:
            # En développement, on accepte quand même avec un utilisateur anonyme
            user = {"id": "anon", "username": "Anonyme"}
            logger.warning(f"Connexion sans JWT valide sur la salle {room_id} — mode dev")

        if not room_id:
            await websocket.close(1008, "room_id manquant")
            return

        room = self.get_or_create_room(room_id)
        room.add_client(websocket)
        logger.info(f"Client {user.get('username')} rejoint la salle {room_id} ({len(room.clients)} connectés)")

        try:
            # Envoyer l'état actuel du document au nouveau client
            if room.doc_state:
                # Message de type SYNC step 1 : on envoie l'état
                sync_msg = bytes([self.MSG_SYNC]) + room.doc_state
                await websocket.send(sync_msg)

            async for message in websocket:
                await self._process_message(websocket, room, message, user)

        except (ConnectionClosedError, ConnectionClosedOK):
            pass
        except Exception as e:
            logger.error(f"Erreur dans la salle {room_id} : {e}")
        finally:
            room.remove_client(websocket)
            self.cleanup_room(room_id)
            logger.info(f"Client {user.get('username')} a quitté la salle {room_id}")

    # ── Traitement des messages ─────────────────────────────────────────────

    async def _process_message(
        self,
        websocket: websockets.WebSocketServerProtocol,
        room: RoomState,
        message,
        user: dict,
    ):
        if isinstance(message, bytes) and len(message) > 0:
            msg_type = message[0]
            payload = message[1:]

            if msg_type == self.MSG_SYNC:
                # Mise à jour du document — stocker et broadcaster
                room.doc_state = payload
                await room.broadcast(message, exclude=websocket)

            elif msg_type == self.MSG_AWARENESS:
                # Mise à jour du curseur / awareness
                try:
                    awareness_data = json.loads(payload.decode("utf-8"))
                    client_id = str(id(websocket))
                    awareness_data["clientId"] = client_id
                    awareness_data["user"] = {
                        "name": user.get("username", "Anonyme"),
                        "color": _color_for_id(client_id),
                    }
                    room.awareness[client_id] = awareness_data
                    # Re-encoder et broadcaster
                    updated = bytes([self.MSG_AWARENESS]) + json.dumps(awareness_data).encode("utf-8")
                    await room.broadcast(updated, exclude=websocket)
                except Exception as e:
                    logger.warning(f"Awareness invalide : {e}")

            elif msg_type == self.MSG_QUERY_AWARENESS:
                # Envoyer tous les états awareness actuels
                if room.awareness:
                    all_awareness = {
                        "type": "awareness_states",
                        "states": list(room.awareness.values()),
                    }
                    response = bytes([self.MSG_AWARENESS]) + json.dumps(all_awareness).encode("utf-8")
                    await websocket.send(response)

        elif isinstance(message, str):
            # Messages JSON texte (commandes custom)
            try:
                data = json.loads(message)
                cmd = data.get("cmd")
                if cmd == "ping":
                    await websocket.send(json.dumps({"cmd": "pong"}))
            except json.JSONDecodeError:
                pass


# ─── Couleur déterministe par client ──────────────────────────────────────────

PALETTE = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    "#BB8FCE", "#82E0AA", "#F1948A", "#85C1E9",
]

def _color_for_id(client_id: str) -> str:
    h = sum(ord(c) for c in client_id) % len(PALETTE)
    return PALETTE[h]


# ─── Point d'entrée ───────────────────────────────────────────────────────────

collaboration_server = CollaborationServer()


async def start_collaboration_server(host: str = "0.0.0.0", port: int = 1234):
    """Démarre le serveur WebSocket de collaboration."""
    logger.info(f"Serveur de collaboration démarré sur ws://{host}:{port}")
    async with websockets.serve(
        collaboration_server.handle_connection,
        host,
        port,
        ping_interval=30,
        ping_timeout=10,
    ):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_collaboration_server())
