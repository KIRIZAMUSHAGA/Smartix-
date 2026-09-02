"""
Modèle MongoDB pour les uploads de fichiers
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

UPLOAD_STATUS = {
    "PENDING": "pending",
    "UPLOADING": "uploading",
    "PAUSED": "paused",
    "COMPLETED": "completed",
    "FAILED": "failed",
    "CANCELLED": "cancelled"
}

class Upload:
    """Modèle d'upload de fichier"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", f"upload_{uuid.uuid4().hex[:12]}")
        self.userId = data["userId"]
        self.filename = data["filename"]
        self.storedFilename = data.get("storedFilename")
        self.filePath = data.get("filePath")
        self.fileSize = data.get("fileSize", 0)
        self.mimeType = data.get("mimeType")
        self.bucket = data.get("bucket", "default")
        self.category = data.get("category", "general")  # apk, screenshot, asset
        self.public = data.get("public", False)
        self.status = data.get("status", UPLOAD_STATUS["PENDING"])
        self.progress = data.get("progress", 0)
        self.uploadedBytes = data.get("uploadedBytes", 0)
        self.chunks = data.get("chunks", [])
        self.totalChunks = data.get("totalChunks", 1)
        self.checksum = data.get("checksum")
        self.metadata = data.get("metadata", {})
        self.errors = data.get("errors", [])
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))
        self.completedAt = data.get("completedAt")
        self.duration = data.get("duration")

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "userId": self.userId,
            "filename": self.filename,
            "storedFilename": self.storedFilename,
            "filePath": self.filePath,
            "fileSize": self.fileSize,
            "mimeType": self.mimeType,
            "bucket": self.bucket,
            "category": self.category,
            "public": self.public,
            "status": self.status,
            "progress": self.progress,
            "uploadedBytes": self.uploadedBytes,
            "chunks": self.chunks,
            "totalChunks": self.totalChunks,
            "checksum": self.checksum,
            "metadata": self.metadata,
            "errors": self.errors,
            "createdAt": self.createdAt,
            "completedAt": self.completedAt,
            "duration": self.duration
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Upload':
        """Crée un objet Upload à partir d'un dictionnaire"""
        return Upload(data)

    def start(self):
        """Démarre l'upload"""
        self.status = UPLOAD_STATUS["UPLOADING"]
        self.createdAt = datetime.now(timezone.utc)

    def update_progress(self, uploadedBytes: int, progress: int):
        """Met à jour la progression"""
        self.uploadedBytes = uploadedBytes
        self.progress = progress

    def complete(self, filePath: str, storedFilename: str):
        """Marque l'upload comme terminé"""
        self.status = UPLOAD_STATUS["COMPLETED"]
        self.filePath = filePath
        self.storedFilename = storedFilename
        self.completedAt = datetime.now(timezone.utc)
        self.duration = int((self.completedAt - self.createdAt).total_seconds() * 1000)
        self.progress = 100
        self.uploadedBytes = self.fileSize

    def fail(self, error: str):
        """Marque l'upload comme échoué"""
        self.status = UPLOAD_STATUS["FAILED"]
        self.errors.append(error)
        self.completedAt = datetime.now(timezone.utc)

    def pause(self):
        """Met en pause l'upload"""
        self.status = UPLOAD_STATUS["PAUSED"]

    def resume(self):
        """Reprend l'upload"""
        self.status = UPLOAD_STATUS["UPLOADING"]

    def cancel(self):
        """Annule l'upload"""
        self.status = UPLOAD_STATUS["CANCELLED"]
        self.completedAt = datetime.now(timezone.utc)

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.uploads
        await collection.create_index("userId")
        await collection.create_index("status")
        await collection.create_index("bucket")
        await collection.create_index("category")
        await collection.create_index("createdAt")
        await collection.create_index([("userId", 1), ("status", 1)])
