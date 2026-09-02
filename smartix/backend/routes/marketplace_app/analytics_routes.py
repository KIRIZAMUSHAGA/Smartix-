"""
Routes d'analytics pour le marketplace applications
Avec validation Pydantic
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional, List

from middleware.auth import get_current_user_optional
from controllers.marketplace_app import AnalyticsController, create_controllers
from .schemas import TrackEventRequest, TrackBatchRequest

router = APIRouter(prefix="/api/marketplace/analytics", tags=["Marketplace Analytics"])

async def get_analytics_controller(request: Request):
    db = request.app.state.db
    ctrls = create_controllers(db)
    return ctrls["analytics"]

# ==================== TRACKING ====================

@router.post("/track")
async def track_event(
    event: TrackEventRequest,
    request: Request,
    user = Depends(get_current_user_optional),
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Enregistre un événement analytics"""
    event_dict = event.dict()
    if user:
        event_dict["user_id"] = user["id"]
    
    result = await controller.track_event(event_dict)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/track/batch")
async def track_batch(
    batch: TrackBatchRequest,
    request: Request,
    user = Depends(get_current_user_optional),
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Enregistre un lot d'événements (optimisé)"""
    batch_dict = batch.dict()
    if user and "events" in batch_dict:
        for event in batch_dict["events"]:
            event["user_id"] = user["id"]
    
    result = await controller.track_batch(batch_dict)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ==================== TENDANCES ====================

@router.get("/trending")
async def get_trending(
    limit: int = Query(20, ge=1, le=100),
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Récupère les applications tendances"""
    return await controller.get_trending_apps(limit)

@router.get("/trending/by-category")
async def get_trending_by_category(
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Récupère les tendances par catégorie"""
    return await controller.get_trending_by_category()

# ==================== MÉTRIQUES ====================

@router.get("/app/{app_id}/metrics")
async def get_app_metrics(
    app_id: str,
    period: Literal["24h", "7d", "30d", "90d"] = Query("30d"),
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Récupère les métriques d'une application"""
    return await controller.get_app_metrics(app_id, period)

@router.get("/app/{app_id}/realtime")
async def get_realtime_stats(
    app_id: str,
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Récupère les stats en temps réel"""
    return await controller.get_realtime_stats(app_id)

# ==================== STATISTIQUES GLOBALES ====================

@router.get("/global")
async def get_global_stats(
    controller: AnalyticsController = Depends(get_analytics_controller)
):
    """Récupère les statistiques globales du marketplace"""
    return await controller.get_global_stats()
