from fastapi import APIRouter, Depends, Query, HTTPException, Request
from typing import Optional, Dict, Any, List
from db import get_collection
from bson import ObjectId
from datetime import datetime
import asyncio
import time
import re
import redis.asyncio as aioredis
import json
from collections import defaultdict
from middleware.auth_middleware import get_current_user_optional, get_current_user_required

# Import du scheduler et de ses fonctions de monitoring
try:
    from app.news.scheduler import (
        get_scheduler_status as get_sched_status,
        run_once_now,
        update_scheduler_interval,
        pause_scheduler,
        resume_scheduler,
        start_scheduler
    )
    _scheduler_available = True
except ImportError as e:
    print(f"⚠️ [news_routes] Scheduler indisponible — news_router chargé sans scheduler : {e}")
    _scheduler_available = False
    def get_sched_status(): return {"error": "Scheduler non disponible", "scheduler_running": False}
    def run_once_now(): return False
    def update_scheduler_interval(m): return False
    def pause_scheduler(): return False
    def resume_scheduler(): return False
    def start_scheduler(**kwargs): return None

router = APIRouter()

# ========== CONFIG ==========
RATE_LIMIT = {"max_requests": 30, "window": 60}
request_counts = defaultdict(list)
aggregator_lock = asyncio.Lock()
aggregator_running = False
redis_client = None

# ========== REDIS ==========
async def get_redis():
    """Retourne un client Redis ou None si Redis n'est pas disponible (cache désactivé)."""
    global redis_client
    if redis_client is False:
        return None
    if redis_client is None:
        try:
            client = await aioredis.from_url(
                "redis://localhost",
                decode_responses=True,
                socket_connect_timeout=2
            )
            await client.ping()
            redis_client = client
        except Exception as e:
            print(f"⚠️ Redis indisponible, cache désactivé: {e}")
            redis_client = False
            return None
    return redis_client

# ========== RATE LIMITING ==========
async def rate_limit(request: Request, user_id: Optional[str] = None):
    client_key = f"{request.client.host}:{user_id or 'anonymous'}"
    now = time.time()
    
    request_counts[client_key] = [t for t in request_counts[client_key] if now - t < RATE_LIMIT["window"]]
    
    if len(request_counts[client_key]) >= RATE_LIMIT["max_requests"]:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Trop de requêtes",
                "retry_after": RATE_LIMIT["window"],
                "message": f"Limite de {RATE_LIMIT['max_requests']} requêtes par {RATE_LIMIT['window']}s"
            }
        )
    
    request_counts[client_key].append(now)

# ========== UTILS ==========
def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict"""
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
        else:
            result[key] = value
    return result

def sanitize_search_term(term: str) -> str:
    """Échappe les caractères spéciaux regex"""
    if not term or len(term) > 100:
        raise HTTPException(status_code=400, detail="Terme de recherche invalide")
    return re.escape(term)

# ========== ADMIN ==========
@router.post("/admin/fetch_all")
async def manual_fetch_all(current_user: dict = Depends(get_current_user_required)):
    """Manually trigger news fetch (admin only)"""
    # Vérifier admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from app.aggregator.aggregator import run_once
        asyncio.create_task(run_once())
        return {"ok": True, "message": "News fetch started"}
    except Exception as e:
        print(f"❌ Error in manual fetch: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du déclenchement")

# ========== SCHEDULER MONITORING ==========

@router.get("/scheduler/status")
async def get_scheduler_status(
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Récupère le statut complet du scheduler d'agrégation
    - Public: informations basiques
    - Admin: informations détaillées
    """
    await rate_limit(request, current_user.get("id") if current_user else None)
    
    status = get_sched_status()
    
    # Si utilisateur non admin, masquer certaines infos sensibles
    if not current_user or not current_user.get("is_admin"):
        # Garder seulement les infos publiques
        status = {
            "is_running": status.get("scheduler_running", False),
            "last_run": status.get("last_run"),
            "last_success": status.get("last_success"),
            "success_rate": status.get("success_rate", 0),
            "total_runs": status.get("total_runs", 0),
            "timestamp": status.get("timestamp")
        }
    
    return status

@router.post("/scheduler/run-now")
async def scheduler_run_now(
    request: Request,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Déclenche une exécution immédiate du scheduler
    Réservé aux administrateurs
    """
    # Vérifier admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await rate_limit(request, current_user["id"])
    
    try:
        success = run_once_now()
        if success:
            return {
                "ok": True,
                "message": "Scheduler execution triggered",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to trigger scheduler")
    except Exception as e:
        print(f"❌ Error triggering scheduler: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scheduler/interval/{minutes}")
async def scheduler_set_interval(
    minutes: int,
    request: Request,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Modifie l'intervalle d'exécution du scheduler
    Réservé aux administrateurs
    - minutes: entre 1 et 1440 (24h)
    """
    # Vérifier admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await rate_limit(request, current_user["id"])
    
    # Valider l'intervalle
    if minutes < 1 or minutes > 1440:
        raise HTTPException(
            status_code=400,
            detail="Intervalle invalide. Doit être entre 1 et 1440 minutes (24h)"
        )
    
    try:
        success = update_scheduler_interval(minutes)
        if success:
            return {
                "ok": True,
                "message": f"Scheduler interval updated to {minutes} minutes",
                "new_interval": minutes
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update interval")
    except Exception as e:
        print(f"❌ Error updating interval: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scheduler/pause")
async def scheduler_pause(
    request: Request,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Met en pause le scheduler
    Réservé aux administrateurs
    """
    # Vérifier admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await rate_limit(request, current_user["id"])
    
    try:
        success = pause_scheduler()
        if success:
            return {
                "ok": True,
                "message": "Scheduler paused",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to pause scheduler")
    except Exception as e:
        print(f"❌ Error pausing scheduler: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scheduler/resume")
async def scheduler_resume(
    request: Request,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Reprend le scheduler après une pause
    Réservé aux administrateurs
    """
    # Vérifier admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await rate_limit(request, current_user["id"])
    
    try:
        success = resume_scheduler()
        if success:
            return {
                "ok": True,
                "message": "Scheduler resumed",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to resume scheduler")
    except Exception as e:
        print(f"❌ Error resuming scheduler: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scheduler/start")
async def scheduler_start(
    request: Request,
    persistent: bool = Query(True, description="Utiliser la persistance MongoDB"),
    current_user: dict = Depends(get_current_user_required)
):
    """
    Démarre le scheduler (si pas déjà démarré)
    Réservé aux administrateurs
    """
    # Vérifier admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await rate_limit(request, current_user["id"])
    
    try:
        scheduler = start_scheduler(persistent=persistent)
        if scheduler:
            return {
                "ok": True,
                "message": "Scheduler started",
                "persistent": persistent,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to start scheduler (maybe already running?)")
    except Exception as e:
        print(f"❌ Error starting scheduler: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== NEWS LIST ==========
@router.get("/list")
@router.get("/")
async def get_news(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    language: Optional[str] = None,
    country: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get aggregated news with filters and cache"""
    # Rate limiting
    await rate_limit(request, current_user.get("id") if current_user else None)
    
    # Cache key
    cache_key = f"news:list:{page}:{limit}:{language}:{country}:{category}:{q}"
    redis = await get_redis()
    
    # Try cache
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return {"data": json.loads(cached), "success": True, "from_cache": True}
        except Exception as e:
            print(f"⚠️ Cache read failed: {e}")
    
    # Build query
    news_col = get_collection("news")
    offset = (page - 1) * limit
    
    query: Dict[str, Any] = {}
    
    # Language filter — normalise 'fr-FR' → 'fr'
    if language and language != 'all':
        query["language"] = language.split('-')[0].lower()

    # Country filter
    if country and country != 'all':
        c_val = country.lower()
        if c_val in ['france', 'fr']:
            query["country"] = 'fr'
        else:
            query["country"] = c_val
    
    # Category filter
    if category and category != 'all':
        query["category"] = category
    
    # Search filter
    if q:
        safe_q = sanitize_search_term(q)
        query["$or"] = [
            {"title": {"$regex": safe_q, "$options": "i"}},
            {"summary": {"$regex": safe_q, "$options": "i"}}
        ]
    
    # Execute query
    print(f"🔍 News Query: {query}")
    items = await news_col.find(query).sort("published_at", -1).skip(offset).limit(limit).to_list(limit)
    print(f"✅ Found {len(items)} items")
    
    # Fallback if empty
    if not items and query:
        print("⚠️ No items with filter, trying without filter...")
        items = await news_col.find({}).sort("published_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Trigger aggregator if truly empty (with lock)
    if not items and page == 1:
        async with aggregator_lock:
            global aggregator_running
            if not aggregator_running:
                aggregator_running = True
                asyncio.create_task(run_aggregator_once())
        
        # Return loading message
        return {
            "data": [{
                "id": "loading",
                "title": "Chargement des actualités...",
                "summary": "Nous récupérons les dernières nouvelles pour vous. Veuillez rafraîchir dans quelques secondes.",
                "published_at": datetime.utcnow().isoformat(),
                "is_loading": True
            }],
            "success": True
        }
    
    # Serialize and cache
    serialized = [serialize_doc(item) for item in items]
    if redis is not None:
        try:
            await redis.setex(cache_key, 120, json.dumps(serialized))  # Cache 2 minutes
        except Exception as e:
            print(f"⚠️ Cache write failed: {e}")
    
    return {"data": serialized, "success": True}

async def run_aggregator_once():
    """Wrapper avec cleanup"""
    global aggregator_running
    try:
        from app.aggregator.aggregator import run_once
        await run_once()
    except Exception as e:
        print(f"❌ Aggregator error: {e}")
    finally:
        aggregator_running = False

# ========== NEWS DETAIL ==========
@router.get("/{news_id}")
async def get_news_item(
    news_id: str,
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get single news item"""
    await rate_limit(request, current_user.get("id") if current_user else None)
    
    news_col = get_collection("news")
    
    # Validate ID
    try:
        obj_id = ObjectId(news_id)
    except:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid ID format", "news_id": news_id}
        )
    
    # Get from cache or DB
    redis = await get_redis()
    cache_key = f"news:detail:{news_id}"
    
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"⚠️ Cache read failed: {e}")
    
    # Get from DB
    item = await news_col.find_one({"_id": obj_id})
    
    if not item:
        raise HTTPException(
            status_code=404,
            detail={"error": "Article not found", "news_id": news_id}
        )
    
    serialized = serialize_doc(item)
    
    # Ensure content exists
    if not serialized.get('content_html') or len(str(serialized.get('content_html', '')).strip()) < 50:
        if serialized.get('summary'):
            serialized['content_html'] = f"<div class='article-content'><p>{serialized['summary']}</p><p><em>Contenu complet non disponible.</em></p></div>"
        else:
            serialized['content_html'] = "<div class='article-content'><p>Contenu non disponible.</p></div>"
    
    # Cache for 10 minutes
    if redis is not None:
        try:
            await redis.setex(cache_key, 600, json.dumps(serialized))
        except Exception as e:
            print(f"⚠️ Cache write failed: {e}")
    
    return serialized

# ========== INTERACTIONS ==========
@router.post("/{news_id}/like")
async def like_news(
    news_id: str,
    request: Request,
    user_id: str = Query(..., min_length=1, max_length=100),
    current_user: dict = Depends(get_current_user_required)
):
    """Like a news article"""
    # Verify user
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await rate_limit(request, user_id)
    
    # Validate ID
    try:
        news_id_obj = ObjectId(news_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    likes_col = get_collection("news_likes")
    news_col = get_collection("news")
    
    # Check if already liked
    existing = await likes_col.find_one({"news_id": news_id_obj, "user_id": user_id})
    if existing:
        # Unlike instead of error
        await likes_col.delete_one({"_id": existing["_id"]})
        await news_col.update_one({"_id": news_id_obj}, {"$inc": {"likes_count": -1}})
        
        # Invalidate cache
        redis = await get_redis()
        await redis.delete(f"news:detail:{news_id}")
        
        return {"ok": True, "liked": False}
    
    # Add like
    result = await likes_col.insert_one({
        "news_id": news_id_obj,
        "user_id": user_id,
        "created_at": datetime.utcnow()
    })
    
    await news_col.update_one({"_id": news_id_obj}, {"$inc": {"likes_count": 1}})
    
    # Invalidate cache
    redis = await get_redis()
    await redis.delete(f"news:detail:{news_id}")
    
    return {"ok": True, "like_id": str(result.inserted_id), "liked": True}

@router.post("/{news_id}/comment")
async def comment_news(
    news_id: str,
    request: Request,
    user_id: str = Query(..., min_length=1, max_length=100),
    message: str = Query(..., min_length=1, max_length=500),
    current_user: dict = Depends(get_current_user_required)
):
    """Add comment to news"""
    # Verify user
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await rate_limit(request, user_id)
    
    # Validate ID
    try:
        news_id_obj = ObjectId(news_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    # Sanitize message
    import html
    safe_message = html.escape(message)
    
    comments_col = get_collection("news_comments")
    news_col = get_collection("news")
    
    # Add comment
    result = await comments_col.insert_one({
        "news_id": news_id_obj,
        "user_id": user_id,
        "message": safe_message,
        "created_at": datetime.utcnow()
    })
    
    await news_col.update_one({"_id": news_id_obj}, {"$inc": {"comments_count": 1}})
    
    # Invalidate cache
    redis = await get_redis()
    await redis.delete(f"news:detail:{news_id}")
    
    return {
        "ok": True,
        "comment_id": str(result.inserted_id),
        "comment": {
            "id": str(result.inserted_id),
            "user_id": user_id,
            "message": safe_message,
            "created_at": datetime.utcnow().isoformat()
        }
    }

# ========== STATISTIQUES ==========
@router.get("/stats/overview")
async def get_news_stats(
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get overview statistics about news system"""
    await rate_limit(request, current_user.get("id") if current_user else None)
    
    redis = await get_redis()
    cache_key = "news:stats:overview"
    
    # Try cache
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    news_col = get_collection("news")
    sources_col = get_collection("news_sources")
    
    # Récupérer les stats
    total_articles = await news_col.count_documents({})
    articles_today = await news_col.count_documents({
        "published_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)}
    })
    
    total_sources = await sources_col.count_documents({})
    active_sources = await sources_col.count_documents({"disabled": {"$ne": True}})
    
    # Dernier article
    last_article = await news_col.find_one(sort=[("published_at", -1)])
    
    stats = {
        "articles": {
            "total": total_articles,
            "today": articles_today,
            "last_published": serialize_doc(last_article) if last_article else None
        },
        "sources": {
            "total": total_sources,
            "active": active_sources,
            "inactive": total_sources - active_sources
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Cache for 5 minutes
    await redis.setex(cache_key, 300, json.dumps(stats))
    
    return stats

@router.get("/stats/sources")
async def get_sources_stats(
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user_required)
):
    """Get detailed statistics about news sources (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await rate_limit(request, current_user["id"])
    
    sources_col = get_collection("news_sources")
    
    sources = await sources_col.find().to_list(length=100)
    
    result = []
    for source in sources:
        # Compter les articles par source
        articles_count = await get_collection("news").count_documents({
            "source_id": source["_id"]
        })
        
        source_stats = serialize_doc(source)
        source_stats["articles_count"] = articles_count
        result.append(source_stats)
    
    return {"sources": result}
