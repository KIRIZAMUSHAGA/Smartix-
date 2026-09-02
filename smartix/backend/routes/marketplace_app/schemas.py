"""
Schémas Pydantic pour les routes du marketplace applications
Validation automatique des entrées
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Literal
from datetime import datetime

# ==================== PUBLICATION ====================

class PublishAppRequest(BaseModel):
    """Schéma pour la publication d'une application"""
    name: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., max_length=2000)
    category_id: str
    tags: List[str] = Field(default=[], max_items=20)
    version: str = Field(default="1.0.0", regex=r"^\d+\.\d+\.\d+$")
    visibility: Literal["public", "private", "unlisted"] = "public"
    
    @validator('name')
    def validate_name(cls, v):
        if v.strip() != v:
            raise ValueError('Name cannot have leading/trailing spaces')
        return v

class UpdateAppRequest(BaseModel):
    """Schéma pour la mise à jour d'une application"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    category_id: Optional[str] = None
    tags: Optional[List[str]] = Field(None, max_items=20)
    version: Optional[str] = Field(None, regex=r"^\d+\.\d+\.\d+$")
    visibility: Optional[Literal["public", "private", "unlisted"]] = None

class AppResponse(BaseModel):
    """Schéma de réponse pour une application"""
    id: str
    name: str
    description: str
    category_id: str
    tags: List[str]
    version: str
    visibility: str
    developer_id: str
    apk_url: Optional[str]
    icon_url: Optional[str]
    screenshots: List[str]
    stats: dict
    created_at: datetime
    updated_at: datetime

# ==================== RECHERCHE ====================

class SearchFilters(BaseModel):
    """Filtres de recherche"""
    q: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    developer_id: Optional[str] = None
    sort_by: Literal["created_at", "rating", "downloads", "installs", "name"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=50)

class SearchResponse(BaseModel):
    """Réponse de recherche paginée"""
    items: List[AppResponse]
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool

# ==================== AVIS ====================

class AddReviewRequest(BaseModel):
    """Schéma pour ajouter un avis"""
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=100)
    comment: str = Field(..., max_length=2000)
    pros: List[str] = Field(default=[], max_items=5)
    cons: List[str] = Field(default=[], max_items=5)

class ReviewResponse(BaseModel):
    """Réponse d'un avis"""
    id: str
    app_id: str
    user_id: str
    rating: int
    title: Optional[str]
    comment: str
    pros: List[str]
    cons: List[str]
    helpful: int
    not_helpful: int
    verified: bool
    created_at: datetime

class ReviewStatsResponse(BaseModel):
    """Statistiques des avis"""
    average: float
    total: int
    distribution: dict

# ==================== ANALYTICS ====================

class TrackEventRequest(BaseModel):
    """Schéma pour tracker un événement"""
    type: Literal["view", "download", "install", "session_start", "session_end", "crash", "rating", "share", "fork", "uninstall", "update"]
    app_id: str
    data: dict = {}
    metadata: dict = {}

class TrackBatchRequest(BaseModel):
    """Schéma pour tracker un lot d'événements"""
    events: List[TrackEventRequest]

# ==================== IA ====================

class AISuggestionResponse(BaseModel):
    """Réponse d'une suggestion IA"""
    id: str
    app_id: str
    type: str
    title: str
    description: str
    confidence: float
    priority_score: float
    impact: str
    effort: str
    status: str
    votes: dict
    created_at: datetime

# ==================== ERREURS ====================

class ErrorResponse(BaseModel):
    """Réponse d'erreur standard"""
    success: bool = False
    error: str
    code: Optional[str] = None
