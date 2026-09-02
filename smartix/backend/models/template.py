"""
Modèle MongoDB pour les templates du marketplace
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

TEMPLATE_STATUS = {
    "DRAFT": "draft",
    "PENDING_REVIEW": "pending_review",
    "APPROVED": "approved",
    "REJECTED": "rejected",
    "ARCHIVED": "archived"
}

TEMPLATE_VISIBILITY = {
    "PUBLIC": "public",
    "PRIVATE": "private",
    "UNLISTED": "unlisted"
}

LICENSE_TYPES = ["personal", "commercial", "extended", "enterprise"]

class Template:
    """Modèle de template marketplace"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", str(uuid.uuid4()))
        self.sellerId = data["sellerId"]
        self.name = data["name"]
        self.description = data["description"]
        self.price = data["price"]
        self.currency = data.get("currency", "USD")
        self.isFree = self.price == 0
        self.category = data["category"]
        self.tags = data.get("tags", [])
        self.images = data.get("images", [])
        self.demo = data.get("demo")
        self.demoType = data.get("demoType", "static")
        self.files = data.get("files", {})
        self.status = data.get("status", TEMPLATE_STATUS["DRAFT"])
        self.visibility = data.get("visibility", TEMPLATE_VISIBILITY["PUBLIC"])
        
        # License
        self.license = {
            "type": data.get("license", {}).get("type", "personal"),
            "seats": data.get("license", {}).get("seats", 1)
        }
        
        # Metadata
        self.metadata = {
            "version": data.get("metadata", {}).get("version"),
            "framework": data.get("metadata", {}).get("framework"),
            "complexity": data.get("metadata", {}).get("complexity", "simple"),
            "features": data.get("metadata", {}).get("features", []),
            "dependencies": data.get("metadata", {}).get("dependencies", {})
        }
        
        # Stats
        self.stats = {
            "views": data.get("stats", {}).get("views", 0),
            "uniqueViews": data.get("stats", {}).get("uniqueViews", 0),
            "favorites": data.get("stats", {}).get("favorites", 0),
            "purchases": data.get("stats", {}).get("purchases", 0),
            "revenue": data.get("stats", {}).get("revenue", 0.0),
            "averageRating": data.get("stats", {}).get("averageRating", 0.0),
            "totalReviews": data.get("stats", {}).get("totalReviews", 0),
            "trendingScore": data.get("stats", {}).get("trendingScore", 0.0)
        }
        
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))
        self.updatedAt = data.get("updatedAt", datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "sellerId": self.sellerId,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "currency": self.currency,
            "isFree": self.isFree,
            "category": self.category,
            "tags": self.tags,
            "images": self.images,
            "demo": self.demo,
            "demoType": self.demoType,
            "files": self.files,
            "status": self.status,
            "visibility": self.visibility,
            "license": self.license,
            "metadata": self.metadata,
            "stats": self.stats,
            "createdAt": self.createdAt,
            "updatedAt": self.updatedAt
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Template':
        """Crée un objet Template à partir d'un dictionnaire"""
        return Template(data)

    def increment_view(self, isUnique: bool = False):
        """Incrémente le compteur de vues"""
        self.stats["views"] += 1
        if isUnique:
            self.stats["uniqueViews"] += 1
        self._update_trending_score()

    def add_purchase(self, amount: float):
        """Ajoute un achat"""
        self.stats["purchases"] += 1
        self.stats["revenue"] += amount
        self._update_trending_score()

    def add_favorite(self):
        """Ajoute un favori"""
        self.stats["favorites"] += 1
        self._update_trending_score()

    def _update_trending_score(self):
        """Calcule le score de tendance"""
        import math
        from datetime import datetime, timezone
        
        # Pondération: achats > favoris > vues
        score = (
            self.stats["purchases"] * 3 +
            self.stats["favorites"] * 2 +
            self.stats["views"] * 0.1 +
            self.stats["uniqueViews"] * 0.5
        )
        
        # Récence (moins de poids pour les vieux templates)
        hours_old = (datetime.now(timezone.utc) - self.createdAt).total_seconds() / 3600
        recency = math.exp(-hours_old / 168)  # 7 jours = 168 heures
        
        self.stats["trendingScore"] = score * (0.5 + recency * 0.5)

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.templates
        await collection.create_index("sellerId")
        await collection.create_index("status")
        await collection.create_index("category")
        await collection.create_index([("status", 1), ("createdAt", -1)])
        await collection.create_index([("stats.trendingScore", -1)])
        await collection.create_index([("name", "text"), ("description", "text"), ("tags", "text")])
