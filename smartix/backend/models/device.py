"""
Modèle MongoDB pour les appareils connectés
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

DEVICE_STATUS = {
    "CONNECTED": "connected",
    "DISCONNECTED": "disconnected",
    "TIMEOUT": "timeout",
    "BLOCKED": "blocked",
    "EXPIRED": "expired"
}

class Device:
    """Modèle d'appareil connecté"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", f"device_{uuid.uuid4().hex[:12]}")
        self.userId = data["userId"]
        self.clientId = data.get("clientId")
        self.sessionId = data.get("sessionId")
        self.platform = data.get("platform", "unknown")  # android, ios, web
        self.version = data.get("version", "unknown")
        self.model = data.get("model", "unknown")
        self.manufacturer = data.get("manufacturer", "unknown")
        self.userAgent = data.get("userAgent", "")
        self.ip = data.get("ip", "")
        self.screen = data.get("screen", "")
        self.status = data.get("status", DEVICE_STATUS["DISCONNECTED"])
        self.blocked = data.get("blocked", False)
        self.blockReason = data.get("blockReason")
        self.blockedAt = data.get("blockedAt")
        self.connections = data.get("connections", 0)
        self.totalTime = data.get("totalTime", 0)  # total connection time in ms
        self.metadata = data.get("metadata", {})
        self.firstSeen = data.get("firstSeen", datetime.now(timezone.utc))
        self.lastSeen = data.get("lastSeen", datetime.now(timezone.utc))
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "userId": self.userId,
            "clientId": self.clientId,
            "sessionId": self.sessionId,
            "platform": self.platform,
            "version": self.version,
            "model": self.model,
            "manufacturer": self.manufacturer,
            "userAgent": self.userAgent,
            "ip": self.ip,
            "screen": self.screen,
            "status": self.status,
            "blocked": self.blocked,
            "blockReason": self.blockReason,
            "blockedAt": self.blockedAt,
            "connections": self.connections,
            "totalTime": self.totalTime,
            "metadata": self.metadata,
            "firstSeen": self.firstSeen,
            "lastSeen": self.lastSeen,
            "createdAt": self.createdAt
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Device':
        """Crée un objet Device à partir d'un dictionnaire"""
        return Device(data)

    def connect(self, clientId: str, sessionId: str = None):
        """Marque l'appareil comme connecté"""
        self.status = DEVICE_STATUS["CONNECTED"]
        self.clientId = clientId
        self.sessionId = sessionId
        self.lastSeen = datetime.now(timezone.utc)
        self.connections += 1

    def disconnect(self):
        """Marque l'appareil comme déconnecté"""
        self.status = DEVICE_STATUS["DISCONNECTED"]
        self.lastSeen = datetime.now(timezone.utc)

    def block(self, reason: str = "manual"):
        """Bloque l'appareil"""
        self.status = DEVICE_STATUS["BLOCKED"]
        self.blocked = True
        self.blockReason = reason
        self.blockedAt = datetime.now(timezone.utc)

    def unblock(self):
        """Débloque l'appareil"""
        self.status = DEVICE_STATUS["DISCONNECTED"]
        self.blocked = False
        self.blockReason = None
        self.blockedAt = None

    def update_activity(self):
        """Met à jour la dernière activité"""
        self.lastSeen = datetime.now(timezone.utc)

    def add_time(self, durationMs: int):
        """Ajoute du temps de connexion"""
        self.totalTime += durationMs

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.devices
        await collection.create_index("userId")
        await collection.create_index("clientId")
        await collection.create_index("sessionId")
        await collection.create_index("status")
        await collection.create_index("blocked")
        await collection.create_index("lastSeen")
        await collection.create_index([("userId", 1), ("status", 1)])
        await collection.create_index([("userId", 1), ("lastSeen", -1)])
