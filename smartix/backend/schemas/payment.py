"""
Schémas Pydantic pour les paiements et transactions
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class PaymentIntentCreate(BaseModel):
    amount: float
    currency: str = "USD"
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class PaymentIntentResponse(BaseModel):
    clientSecret: str
    id: str

class MobileMoneyPayment(BaseModel):
    amount: float
    currency: str = "KES"
    phone: str
    email: str
    name: Optional[str] = None

class TransactionBase(BaseModel):
    amount: float
    currency: str
    paymentMethod: str
    status: str

class TransactionCreate(TransactionBase):
    userId: str
    templateId: str
    sellerId: str

class TransactionOut(TransactionBase):
    id: str
    userId: str
    templateId: str
    sellerId: str
    paymentId: Optional[str] = None
    commission: float = 0
    sellerAmount: float = 0
    createdAt: datetime
    completedAt: Optional[datetime] = None
    refundedAt: Optional[datetime] = None
    refundReason: Optional[str] = None

    model_config = {"from_attributes": True}

class RefundRequest(BaseModel):
    transactionId: str
    reason: Optional[str] = None

class PayoutRequest(BaseModel):
    amount: float
    method: str = "bank"
