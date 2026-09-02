"""
Modèle MongoDB pour les builds et prévisualisations
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

BUILD_STATUS = {
    "PENDING": "pending",
    "BUILDING": "building",
    "SUCCESS": "success",
    "FAILED": "failed",
    "CANCELLED": "cancelled"
}

class Build:
    """Modèle de build de projet"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", f"build_{uuid.uuid4().hex[:12]}")
        self.projectId = data["projectId"]
        self.userId = data["userId"]
        self.type = data.get("type", "production")  # development, production, analyze
        self.target = data.get("target", "web")  # web, android, ios, etc.
        self.status = data.get("status", BUILD_STATUS["PENDING"])
        self.progress = data.get("progress", 0)
        self.errors = data.get("errors", [])
        self.warnings = data.get("warnings", [])
        self.logs = data.get("logs", [])
        self.output = data.get("output", {})
        self.size = data.get("size", 0)
        self.fileCount = data.get("fileCount", 0)
        self.startTime = data.get("startTime")
        self.endTime = data.get("endTime")
        self.duration = data.get("duration")
        self.metadata = data.get("metadata", {})
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "projectId": self.projectId,
            "userId": self.userId,
            "type": self.type,
            "target": self.target,
            "status": self.status,
            "progress": self.progress,
            "errors": self.errors,
            "warnings": self.warnings,
            "logs": self.logs,
            "output": self.output,
            "size": self.size,
            "fileCount": self.fileCount,
            "startTime": self.startTime,
            "endTime": self.endTime,
            "duration": self.duration,
            "metadata": self.metadata,
            "createdAt": self.createdAt
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Build':
        """Crée un objet Build à partir d'un dictionnaire"""
        return Build(data)

    def start(self):
        """Démarre le build"""
        self.status = BUILD_STATUS["BUILDING"]
        self.startTime = datetime.now(timezone.utc)
        self.add_log("info", "Build démarré")

    def complete(self, output: Dict[str, Any]):
        """Termine le build avec succès"""
        self.status = BUILD_STATUS["SUCCESS"]
        self.endTime = datetime.now(timezone.utc)
        self.duration = int((self.endTime - self.startTime).total_seconds() * 1000)
        self.output = output
        self.progress = 100
        self.add_log("success", "Build terminé")

    def fail(self, error: str):
        """Marque le build comme échoué"""
        self.status = BUILD_STATUS["FAILED"]
        self.endTime = datetime.now(timezone.utc)
        self.duration = int((self.endTime - self.startTime).total_seconds() * 1000) if self.startTime else 0
        self.errors.append(error)
        self.add_log("error", f"Build échoué: {error}")

    def cancel(self):
        """Annule le build"""
        self.status = BUILD_STATUS["CANCELLED"]
        self.endTime = datetime.now(timezone.utc)
        self.add_log("warning", "Build annulé")

    def add_log(self, level: str, message: str):
        """Ajoute un log"""
        self.logs.append({
            "level": level,
            "message": message,
            "timestamp": datetime.now(timezone.utc)
        })
        # Garder seulement les 100 derniers logs
        if len(self.logs) > 100:
            self.logs = self.logs[-100:]

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.builds
        await collection.create_index("projectId")
        await collection.create_index("userId")
        await collection.create_index("status")
        await collection.create_index("createdAt")
        await collection.create_index([("projectId", 1), ("createdAt", -1)])
