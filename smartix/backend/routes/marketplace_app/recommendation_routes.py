"""
Routes de recommandations pour le marketplace applications
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import List, Optional

from middleware.auth import get_current_user
from controllers.marketplace_app import RecommendationController, create_controllers

router = APIRouter(prefix="/api/marketplace/recommendations", tags=["Marketplace Recommendations"])

async def get_recommendation_controller(request: Request):
    db = request.app.state.db
    ctrls = create_controllers(db)
    return ctrls["recommendation"]

# ==================== RECOMMANDATIONS ====================

@router.get("/personalized")
async def get_personalized_recommendations(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    exclude_ids: Optional[List[str]] = Query(None),
    user = Depends(get_current_user),
    controller: RecommendationController = Depends(get_recommendation_controller)
):
    """
    Recommandations personnalisées basées sur l'historique
    """
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    # ⚠️ Vérifier le cache
    cache_key = f"recommendations:{user['id']}"
    cached = await request.app.state.redis.get(cache_key)
    if cached:
        recs = json.loads(cached)
        # Filtrer les exclus
        recs = [r for r in recs if r["id"] not in (exclude_ids or [])]
        return {"user_id": user["id"], "count": len(recs), "recommendations": recs[:limit]}
    
    recommendations = await controller.get_recommendations(
        user_id=user["id"],
        limit=limit,
        exclude_ids=exclude_ids or []
    )
    
    # Mettre en cache
    await request.app.state.redis.setex(cache_key, 600, json.dumps(recommendations))  # 10 min
    
    return {
        "user_id": user["id"],
        "count": len(recommendations),
        "recommendations": recommendations
    }

# ==================== APPLICATIONS SIMILAIRES ====================

@router.get("/similar/{app_id}")
async def get_similar_apps(
    app_id: str,
    request: Request,
    limit: int = Query(10, ge=1, le=20),
    controller: RecommendationController = Depends(get_recommendation_controller)
):
    """Trouve des applications similaires"""
    # ⚠️ Cache
    cache_key = f"similar:{app_id}"
    cached = await request.app.state.redis.get(cache_key)
    if cached:
        similar = json.loads(cached)
    else:
        similar = await controller.get_similar_apps(app_id, limit)
        await request.app.state.redis.setex(cache_key, 3600, json.dumps(similar))  # 1h
    
    return {
        "app_id": app_id,
        "count": len(similar),
        "similar_apps": similar
  }
