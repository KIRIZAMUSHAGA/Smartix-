"""
Routes de publication pour le marketplace applications
Endpoints RESTful avec validation Pydantic
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional, List
from datetime import datetime

# Middleware
from middleware.auth import get_current_user
from middleware.rate_limit import rate_limit

# Contrôleurs
from controllers.marketplace_app import PublishController, create_controllers

# Schémas
from .schemas import (
    PublishAppRequest, UpdateAppRequest, AppResponse,
    AddReviewRequest, ReviewResponse, ReviewStatsResponse,
    SearchFilters, SearchResponse, ErrorResponse
)

router = APIRouter(prefix="/api/marketplace/apps", tags=["Marketplace Apps"])

# ==================== DÉPENDANCES ====================

async def get_publish_controller(request: Request):
    """⚠️ CORRECTION : request injecté"""
    db = request.app.state.db
    ctrls = create_controllers(db)
    return ctrls["publish"]

# ==================== PUBLICATION (RESTful) ====================

@router.post(
    "/", 
    response_model=dict,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}}
)
@rate_limit(limit=5, period=3600)  # 5 publications par heure
async def create_app(
    project_id: str,
    data: PublishAppRequest,  # ⚠️ Utilisation du schéma
    user = Depends(get_current_user),
    controller: PublishController = Depends(get_publish_controller)
):
    """
    Crée une nouvelle application
    - project_id: ID du projet à builder
    """
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.publish_app(user["id"], project_id, data.dict())
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # ⚠️ NOUVEAU : Analytics
    await controller.track_event({
        "type": "publish",
        "app_id": result["app_id"],
        "user_id": user["id"]
    })
    
    return result

@router.get("/{app_id}", response_model=AppResponse)
async def get_app(
    app_id: str,
    request: Request,
    controller: PublishController = Depends(get_publish_controller)
):
    """Récupère les détails d'une application"""
    # ⚠️ NOUVEAU : Cache Redis
    cache_key = f"app:{app_id}"
    cached = await request.app.state.redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    app = await controller.get_app(app_id)
    
    if not app:
        raise HTTPException(status_code=404, detail="Application non trouvée")
    
    # ⚠️ NOUVEAU : Analytics view
    await controller.track_event({
        "type": "view",
        "app_id": app_id
    })
    
    # Mise en cache
    await request.app.state.redis.setex(cache_key, 300, json.dumps(app))  # 5 minutes
    
    return app

@router.put("/{app_id}", response_model=dict)
async def update_app(
    app_id: str,
    data: UpdateAppRequest,
    user = Depends(get_current_user),
    controller: PublishController = Depends(get_publish_controller)
):
    """Met à jour une application"""
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.update_app(app_id, user["id"], data.dict(exclude_unset=True))
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Invalider le cache
    await request.app.state.redis.delete(f"app:{app_id}")
    
    return result

@router.delete("/{app_id}", response_model=dict)
async def delete_app(
    app_id: str,
    user = Depends(get_current_user),
    controller: PublishController = Depends(get_publish_controller)
):
    """Supprime une application"""
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.delete_app(app_id, user["id"])
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ==================== RECHERCHE (GET /) ====================

@router.get("/", response_model=SearchResponse)
async def search_apps(
    filters: SearchFilters = Depends(),  # ⚠️ Filtres validés
    controller: PublishController = Depends(get_publish_controller)
):
    """Recherche des applications avec filtres"""
    result = await controller.search_apps(
        query=filters.q,
        category_id=filters.category_id,
        tags=filters.tags,
        min_rating=filters.min_rating,
        developer_id=filters.developer_id,
        sort_by=filters.sort_by,
        sort_order=filters.sort_order,
        page=filters.page,
        limit=filters.limit
    )
    
    # ⚠️ Ajouter les métadonnées de pagination
    return {
        "items": result["items"],
        "total": result["total"],
        "page": filters.page,
        "limit": filters.limit,
        "pages": (result["total"] + filters.limit - 1) // filters.limit,
        "has_next": filters.page * filters.limit < result["total"],
        "has_prev": filters.page > 1
    }

# ==================== AVIS ====================

@router.post(
    "/{app_id}/reviews",
    response_model=dict,
    responses={400: {"model": ErrorResponse}}
)
@rate_limit(limit=5, period=3600)  # 5 avis par heure
async def add_review(
    app_id: str,
    data: AddReviewRequest,
    user = Depends(get_current_user),
    controller: PublishController = Depends(get_publish_controller)
):
    """Ajoute un avis sur une application"""
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.add_review(app_id, user["id"], data.dict())
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/{app_id}/reviews", response_model=dict)
async def get_reviews(
    app_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    sort_by: Literal["recent", "rating", "helpful"] = "recent",
    controller: PublishController = Depends(get_publish_controller)
):
    """Récupère les avis d'une application"""
    # À implémenter dans le contrôleur
    result = await controller.get_reviews(app_id, page, limit, sort_by)
    return result

@router.post("/reviews/{review_id}/helpful")
async def mark_helpful(
    review_id: str,
    user = Depends(get_current_user),
    controller: PublishController = Depends(get_publish_controller)
):
    """Marque un avis comme utile"""
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.mark_review_helpful(review_id, user["id"])
    return result
