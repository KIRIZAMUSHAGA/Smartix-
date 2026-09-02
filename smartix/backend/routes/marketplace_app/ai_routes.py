"""
Routes IA pour le marketplace applications
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Optional

from middleware.auth import get_current_user
from controllers.marketplace_app import AIController, create_controllers

router = APIRouter(prefix="/api/marketplace/ai", tags=["Marketplace AI"])

async def get_ai_controller(request: Request):
    db = request.app.state.db
    ctrls = create_controllers(db)
    return ctrls["ai"]

# ==================== ANALYSE ====================

@router.post("/analyze/{app_id}")
async def analyze_app(
    app_id: str,
    request: Request,
    force: bool = Query(False, description="Forcer une nouvelle analyse"),
    user = Depends(get_current_user),
    controller: AIController = Depends(get_ai_controller)
):
    """
    Analyse une application et génère des suggestions d'amélioration
    """
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.analyze_app(app_id, user["id"], force)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

# ==================== SUGGESTIONS ====================

@router.get("/suggestions/{app_id}")
async def get_app_suggestions(
    app_id: str,
    status: Optional[str] = Query(None, regex="^(pending|accepted|in_progress|applied|rejected)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    controller: AIController = Depends(get_ai_controller)
):
    """Récupère les suggestions pour une application"""
    return await controller.get_app_suggestions(app_id, status, page, limit)

@router.post("/suggestions/{suggestion_id}/vote")
async def vote_suggestion(
    suggestion_id: str,
    vote_type: str = Query(..., regex="^(up|down)$"),
    user = Depends(get_current_user),
    controller: AIController = Depends(get_ai_controller)
):
    """Vote pour une suggestion"""
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    result = await controller.vote_suggestion(suggestion_id, user["id"], vote_type)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result
