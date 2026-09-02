"""
Modèle MongoDB pour les transactions d'achat
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid

TRANSACTION_STATUS = {
    "PENDING": "pending",
    "PROCESSING": "processing",
    "COMPLETED": "completed",
    "FAILED": "failed",
    "REFUNDED": "refunded"
}

PAYMENT_METHODS = ["stripe", "mpesa", "airtel", "orange", "card_africa"]

class Transaction:
    """Modèle de transaction d'achat"""
    
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", f"tx_{uuid.uuid4().hex[:16]}")
        self.userId = data["userId"]
        self.templateId = data["templateId"]
        self.sellerId = data["sellerId"]
        self.amount = data["amount"]
        self.currency = data.get("currency", "USD")
        self.paymentMethod = data["paymentMethod"]
        self.status = data.get("status", TRANSACTION_STATUS["PENDING"])
        self.commissionRate = data.get("commissionRate", 0.1)
        self.commission = self.amount * self.commissionRate
        self.sellerAmount = self.amount - self.commission
        self.paymentId = data.get("paymentId")
        self.metadata = data.get("metadata", {})
        self.createdAt = data.get("createdAt", datetime.now(timezone.utc))
        self.completedAt = data.get("completedAt")
        self.refundedAt = data.get("refundedAt")
        self.refundReason = data.get("refundReason")

    def to_dict(self) -> Dict[str, Any]:
        """Convertit l'objet en dictionnaire pour MongoDB"""
        return {
            "id": self.id,
            "userId": self.userId,
            "templateId": self.templateId,
            "sellerId": self.sellerId,
            "amount": self.amount,
            "currency": self.currency,
            "paymentMethod": self.paymentMethod,
            "status": self.status,
            "commissionRate": self.commissionRate,
            "commission": self.commission,
            "sellerAmount": self.sellerAmount,
            "paymentId": self.paymentId,
            "metadata": self.metadata,
            "createdAt": self.createdAt,
            "completedAt": self.completedAt,
            "refundedAt": self.refundedAt,
            "refundReason": self.refundReason
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Transaction':
        """Crée un objet Transaction à partir d'un dictionnaire"""
        return Transaction(data)

    def complete(self, paymentId: str):
        """Marque la transaction comme complétée"""
        self.status = TRANSACTION_STATUS["COMPLETED"]
        self.paymentId = paymentId
        self.completedAt = datetime.now(timezone.utc)

    def fail(self, error: str):
        """Marque la transaction comme échouée"""
        self.status = TRANSACTION_STATUS["FAILED"]
        self.metadata["error"] = error

    def refund(self, reason: str = None):
        """Marque la transaction comme remboursée"""
        self.status = TRANSACTION_STATUS["REFUNDED"]
        self.refundedAt = datetime.now(timezone.utc)
        self.refundReason = reason

    @staticmethod
    async def create_indexes(db):
        """Crée les index MongoDB"""
        collection = db.transactions
        await collection.create_index("userId")
        await collection.create_index("sellerId")
        await collection.create_index("templateId")
        await collection.create_index("status")
        await collection.create_index("createdAt")
        await collection.create_index([("userId", 1), ("createdAt", -1)])
        await collection.create_index([("sellerId", 1), ("status", 1)])
