"""
Schémas Pydantic pour les portefeuilles des vendeurs
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class WalletBase(BaseModel):
    sellerId: str
    balance: float = 0
    pending: float = 0
    paid: float = 0

class WalletOut(WalletBase):
    id: str
    history: List[Dict[str, Any]] = []
    updatedAt: datetime

    model_config = {"from_attributes": True}

class WalletHistoryEntry(BaseModel):
    type: str  # earning, payout, refund
    amount: float
    transactionId: Optional[str] = None
    description: Optional[str] = None
    timestamp: datetime

class WithdrawalRequest(BaseModel):
    amount: float
    method: str  # bank, paypal, mobile_money
    accountDetails: Dict[str, Any]
