"""
Schémas Pydantic pour les avis sur les templates
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ReviewBase(BaseModel):
    rating: int  # 1-5
    title: Optional[str] = None
    comment: Optional[str] = None
    pros: Optional[List[str]] = []
    cons: Optional[List[str]] = []

class ReviewCreate(ReviewBase):
    pass

class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    title: Optional[str] = None
    comment: Optional[str] = None
    pros: Optional[List[str]] = None
    cons: Optional[List[str]] = None

class ReviewOut(ReviewBase):
    id: str
    userId: str
    templateId: str
    verified: bool
    helpful: int = 0
    notHelpful: int = 0
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}

class ReviewListOut(BaseModel):
    reviews: List[ReviewOut]
    total: int
    average: float
    distribution: Dict[int, int]  # {1: count, 2: count, ...}
    offset: int
    limit: int
    hasMore: bool
