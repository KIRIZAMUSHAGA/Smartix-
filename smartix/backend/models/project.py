"""
Modèle MongoDB pour les projets utilisateur
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

PROJECT_STATUS = {
    "DRAFT": "draft",
    "GENERATED": "generated",
    "EDITING": "editing",
    "RUNNING": "running",
    "PUBLISHED": "published",
    "ARCHIVED": "archived"
}

PROJECT_TYPES = ["react", "react-native", "node", "html", "vue", "angular"]

class Project:
    """Modèle de projet utilisateur"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", str(uuid.uuid4()))
        self.userId = data["userId"]
        self.name = data["name"]
        self.description = data.get("description", "")
        self.type = data["type"]
        self.status = data.get("status", PROJECT_STATUS["DRAFT"])
        self.files = data.get("files", {})
        self.config = data.get("config", {})
        self.tags = data.get("tags", [])
        self.metadata = data.get("metadata", {})
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))
        self.updatedAt = data.get("updatedAt", datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "userId": self.userId,
            "name": self.name,
            "description": self.description,
            "type": self.type,
            "status": self.status,
            "files": self.files,
            "config": self.config,
            "tags": self.tags,
            "metadata": self.metadata,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Project':
        """Crée un objet Project à partir d'un dictionnaire"""
        return Project(data)

    def update(self, updates: Dict[str, Any]):
        """Met à jour les champs du projet"""
        for key, value in updates.items():
            if hasattr(self, key) and value is not None:
                setattr(self, key, value)
        self.updatedAt = datetime.now(timezone.utc)

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.projects
        await collection.create_index("userId")
        await collection.create_index("status")
        await collection.create_index("createdAt")
        await collection.create_index([("userId", 1), ("updatedAt", -1)])
