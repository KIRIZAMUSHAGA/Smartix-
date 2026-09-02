"""
Modèle MongoDB pour les portefeuilles des vendeurs
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid

class Wallet:
    """Modèle de portefeuille vendeur"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", f"wallet_{uuid.uuid4().hex[:12]}")
        self.sellerId = data["sellerId"]
        self.balance = data.get("balance", 0.0)
        self.pending = data.get("pending", 0.0)
        self.paid = data.get("paid", 0.0)
        self.history = data.get("history", [])
        self.updatedAt = data.get("updatedAt", datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "sellerId": self.sellerId,
            "balance": self.balance,
            "pending": self.pending,
            "paid": self.paid,
            "history": self.history,
            "updatedAt": self.updatedAt
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Wallet':
        """Crée un objet Wallet à partir d'un dictionnaire"""
        return Wallet(data)

    def add_earning(self, amount: float, transactionId: str, description: str = ""):
        """Ajoute des gains en attente"""
        self.pending += amount
        self.history.append({
            "type": "earning",
            "amount": amount,
            "transactionId": transactionId,
            "description": description,
            "timestamp": datetime.now(timezone.utc)
        })
        self.updatedAt = datetime.now(timezone.utc)

    def process_payout(self, amount: float, method: str, payoutId: str):
        """Traite un paiement"""
        self.pending -= amount
        self.paid += amount
        self.balance -= amount
        self.history.append({
            "type": "payout",
            "amount": amount,
            "method": method,
            "payoutId": payoutId,
            "timestamp": datetime.now(timezone.utc)
        })
        self.updatedAt = datetime.now(timezone.utc)

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.wallets
        await collection.create_index("sellerId", unique=True)
