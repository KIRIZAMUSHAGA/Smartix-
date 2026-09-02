"""
Routes pour le marketplace des applications
Point d'entrée unique avec validation
"""

from fastapi import APIRouter

from .publish_routes import router as publish_router
from .analytics_routes import router as analytics_router
from .recommendation_routes import router as recommendation_router
from .ai_routes import router as ai_router

router = APIRouter()

# Inclusion des sous-routers
router.include_router(publish_router)
router.include_router(analytics_router)
router.include_router(recommendation_router)
router.include_router(ai_router)

__all__ = ["router"]
