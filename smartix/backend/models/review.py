"""
Modèle MongoDB pour les avis sur les templates
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

class Review:
    """Modèle d'avis sur template"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", f"review_{uuid.uuid4().hex[:12]}")
        self.userId = data["userId"]
        self.templateId = data["templateId"]
        self.rating = data["rating"]  # 1-5
        self.title = data.get("title", "")
        self.comment = data.get("comment", "")
        self.pros = data.get("pros", [])
        self.cons = data.get("cons", [])
        self.verified = data.get("verified", False)
        self.helpful = data.get("helpful", 0)
        self.notHelpful = data.get("notHelpful", 0)
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))
        self.updatedAt = data.get("updatedAt", datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "userId": self.userId,
            "templateId": self.templateId,
            "rating": self.rating,
            "title": self.title,
            "comment": self.comment,
            "pros": self.pros,
            "cons": self.cons,
            "verified": self.verified,
            "helpful": self.helpful,
            "notHelpful": self.notHelpful,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Review':
        """Crée un objet Review à partir d'un dictionnaire"""
        return Review(data)

    def mark_helpful(self):
        """Marque comme utile"""
        self.helpful += 1

    def mark_not_helpful(self):
        """Marque comme pas utile"""
        self.notHelpful += 1

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.reviews
        await collection.create_index("userId")
        await collection.create_index("templateId")
        await collection.create_index([("templateId", 1), ("createdAt", -1)])
        await collection.create_index([("templateId", 1), ("rating", -1)])
