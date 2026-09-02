"""Marketplace Models for Applications (APK) Store"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid

# ============= APP CATEGORIES =============
class AppCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= DEVELOPER PROFILES =============
class DeveloperProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Reference to users collection
    developer_name: str
    bio: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    logo: Optional[str] = None
    is_verified: bool = False
    rating: float = 0.0
    total_apps: int = 0
    total_downloads: int = 0
    total_installs: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= APPS (PUBLISHED) =============
class App(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    developer_id: str
    name: str
    description: str
    category_id: str
    tags: List[str] = []
    version: str = "1.0.0"
    
    # Fichiers APK
    apk_url: str  # URL vers l'APK sur CDN
    apk_size: int  # Taille en bytes
    apk_checksum: Optional[str] = None  # Pour vérification
    
    # Ressources
    icon_url: Optional[str] = None
    screenshots: List[str] = []  # URLs des screenshots
    qr_code: Optional[str] = None  # QR code pour installation directe
    
    # Visibilité
    visibility: str = "public"  # public, private, unlisted
    is_published: bool = True
    
    # Build info
    build_id: Optional[str] = None
    build_time: Optional[int] = None  # Durée du build en ms
    
    # Statistiques
    views: int = 0
    downloads: int = 0
    installs: int = 0
    forks: int = 0
    rating: float = 0.0
    reviews_count: int = 0
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppCreate(BaseModel):
    name: str
    description: str
    category_id: str
    tags: List[str] = []
    version: str = "1.0.0"
    visibility: str = "public"

class AppUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    version: Optional[str] = None
    visibility: Optional[str] = None
    is_published: Optional[bool] = None

# ============= APP REVIEWS =============
class AppReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    app_id: str
    user_id: str
    developer_id: str
    rating: int  # 1-5
    title: Optional[str] = None
    comment: str
    pros: List[str] = []  # Points positifs
    cons: List[str] = []  # Points négatifs
    helpful: int = 0
    not_helpful: int = 0
    status: str = "approved"  # pending, approved, rejected, flagged
    verified_install: bool = False  # A vérifié que l'utilisateur a installé
    voters: List[str] = []  # IDs des utilisateurs qui ont voté
    flags: List[dict] = []  # Signalements
    developer_reply: Optional[dict] = None  # Réponse du développeur
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppReviewCreate(BaseModel):
    app_id: str
    rating: int
    title: Optional[str] = None
    comment: str
    pros: List[str] = []
    cons: List[str] = []

# ============= FORKS =============
class AppFork(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_app_id: str
    original_developer_id: str
    forked_by: str  # User ID
    forked_project_id: str  # ID du projet cloné
    new_app_id: Optional[str] = None  # Si publié
    status: str = "completed"  # pending, copying, completed, failed
    options: dict = {}  # Options du fork (nom, description, etc.)
    metadata: dict = {
        "fork_duration": None,  # Durée en ms
        "original_app_name": None,
        "original_version": None
    }
    forked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class AppForkCreate(BaseModel):
    original_app_id: str
    new_name: Optional[str] = None
    new_description: Optional[str] = None
    publish: bool = True
    visibility: str = "public"

# ============= ANALYTICS EVENTS =============
class AnalyticsEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # view, download, install, session, fork, review, rating, uninstall
    app_id: str
    user_id: Optional[str] = None
    data: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {
        "ip": None,
        "userAgent": None,
        "device": None,
        "platform": None,
        "version": None
    }
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnalyticsEventBatch(BaseModel):
    events: List[AnalyticsEvent]

# ============= DAILY METRICS (pré-agrégées) =============
class AppDailyMetric(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    app_id: str
    date: str  # Format: YYYY-MM-DD
    views: int = 0
    downloads: int = 0
    installs: int = 0
    sessions: int = 0
    uninstalls: int = 0
    reviews: int = 0
    forks: int = 0
    unique_users: int = 0
    avg_session_duration: float = 0.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= AI SUGGESTIONS =============
class AISuggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    app_id: str
    type: str  # ui, performance, feature, security, bug_fix, optimization
    title: str
    description: str
    confidence: float = 0.0  # 0-1
    reason: Optional[str] = None  # low_retention, high_crash, etc.
    changes: Dict[str, Any] = {}  # Modifications proposées
    files: List[str] = []  # Fichiers concernés
    status: str = "pending"  # pending, applied, rejected
    votes: Dict[str, int] = {"up": 0, "down": 0}
    comments: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    applied_at: Optional[datetime] = None
    applied_by: Optional[str] = None

# ============= APP STATS (temps réel) =============
class AppRealtimeStats(BaseModel):
    app_id: str
    views_today: int = 0
    downloads_today: int = 0
    installs_today: int = 0
    active_users: int = 0
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= SEARCH FILTERS =============
class AppSearchFilters(BaseModel):
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    min_rating: Optional[float] = None
    developer_id: Optional[str] = None
    sort_by: str = "created_at"  # created_at, downloads, rating, name
    sort_order: str = "desc"  # asc, desc
    page: int = 1
    limit: int = 20
