"""
Configuration du module Marketplace
Centralise tous les paramètres de configuration
"""

from pydantic_settings import BaseSettings
import os
from typing import Optional

class MarketplaceSettings(BaseSettings):
    """Configuration centralisée pour le marketplace"""
    
    # Redis
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", "")
    
    # Rate Limiting
    RATE_LIMIT_PREVIEW_PER_USER: int = 3
    RATE_LIMIT_PREVIEW_WINDOW: int = 3600  # 1 heure
    RATE_LIMIT_GLOBAL: int = 10
    RATE_LIMIT_GLOBAL_WINDOW: int = 60  # 1 minute
    
    # Preview Generation
    MAX_CONCURRENT_GENERATIONS: int = 2
    MAX_PENDING_GENERATIONS: int = 5
    MAX_PREVIEW_PAGES: int = 10
    MAX_PDF_PAGES: int = 500
    PREVIEW_GENERATION_TIMEOUT: int = 120  # secondes
    
    # Cache
    STATS_CACHE_TTL: int = 300  # 5 minutes
    PREVIEW_TOKEN_TTL: int = 3600  # 1 heure
    
    # File Upload
    MAX_PDF_SIZE_MB: int = 50
    UPLOAD_DIR: str = "uploads/marketplace"
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 10
    MAX_PAGE_SIZE: int = 100
    
    class Config:
        env_prefix = "MARKETPLACE_"
        case_sensitive = False

# Instance globale pour utilisation dans l'application
settings = MarketplaceSettings()
