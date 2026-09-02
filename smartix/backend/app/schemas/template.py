"""
Schémas Pydantic pour les templates du marketplace
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class TemplateLicense(BaseModel):
    type: str = "personal"  # personal, commercial, extended, enterprise
    seats: int = 1

class TemplateStats(BaseModel):
    views: int = 0
    uniqueViews: int = 0
    favorites: int = 0
    purchases: int = 0
    revenue: float = 0
    averageRating: float = 0
    totalReviews: int = 0
    trendingScore: float = 0

class TemplateMetadata(BaseModel):
    version: Optional[str] = None
    framework: Optional[str] = None
    complexity: Optional[str] = None  # simple, medium, hard
    features: Optional[List[str]] = []
    dependencies: Optional[Dict[str, str]] = {}

class TemplateBase(BaseModel):
    name: str
    description: str
    price: float
    currency: str = "USD"
    category: str
    tags: Optional[List[str]] = []
    images: Optional[List[str]] = []
    demo: Optional[str] = None
    demoType: Optional[str] = "static"  # static, sandbox, external
    license: TemplateLicense = TemplateLicense()
    metadata: TemplateMetadata = TemplateMetadata()

class TemplateCreate(TemplateBase):
    files: Optional[Dict[str, Any]] = {}

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None
    demo: Optional[str] = None
    status: Optional[str] = None  # draft, pending_review, approved, rejected
    visibility: Optional[str] = None  # public, private, unlisted

class TemplateOut(TemplateBase):
    id: str
    sellerId: str
    isFree: bool
    status: str
    visibility: str
    stats: TemplateStats
    files: Optional[Dict[str, Any]] = {}
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}

class TemplateSearchResult(BaseModel):
    templates: List[TemplateOut]
    total: int
    offset: int
    limit: int
    hasMore: bool
    facets: Optional[Dict[str, Any]] = None
