"""
Gestionnaire WebSocket pour temps réel story reactions
Gère les connexions clients, les rooms par story, et les broadcasts
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Gère les connexions WebSocket et les broadcasts par story"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set] = {}  # story_id -> {websocket connections}
        self.user_stories: Dict[str, str] = {}  # str(id(websocket)) -> story_id (pour cleanup)
        
    async def connect(self, websocket, story_id: str, user_id: str):
        """Ajouter une connexion WebSocket à une story"""
        await websocket.accept()
        
        if story_id not in self.active_connections:
            self.active_connections[story_id] = set()
        
        self.active_connections[story_id].add(websocket)
        self.user_stories[str(id(websocket))] = story_id
        
        logger.info(f"✅ User {user_id} connected to story {story_id} - Total: {len(self.active_connections[story_id])}")
        
    async def disconnect(self, websocket, story_id: str):
        """Retirer une connexion WebSocket"""
        if story_id in self.active_connections:
            self.active_connections[story_id].discard(websocket)
            
            if not self.active_connections[story_id]:
                del self.active_connections[story_id]
        
        self.user_stories.pop(str(id(websocket)), None)
        logger.info(f"❌ User disconnected from story {story_id}")
        
    async def broadcast_to_story(self, story_id: str, message: dict, exclude_websocket=None):
        """Envoyer un message à tous les clients d'une story"""
        if story_id not in self.active_connections:
            return
        
        message['timestamp'] = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(message)
        
        disconnected = set()
        for connection in self.active_connections[story_id]:
            if exclude_websocket and connection == exclude_websocket:
                continue
            
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.add(connection)
        
        # Cleanup disconnected
        for conn in disconnected:
            await self.disconnect(conn, story_id)
    
    async def send_to_client(self, websocket, message: dict):
        """Envoyer un message à un client spécifique"""
        message['timestamp'] = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(message)
        
        try:
            await websocket.send_text(payload)
        except Exception as e:
            logger.error(f"Error sending to client: {e}")
    
    def get_active_viewers(self, story_id: str) -> int:
        """Obtenir le nombre de spectateurs actifs"""
        return len(self.active_connections.get(story_id, []))


# Instance globale
ws_manager = WebSocketManager()
