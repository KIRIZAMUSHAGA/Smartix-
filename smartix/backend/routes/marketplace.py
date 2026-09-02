"""Marketplace API Routes for Smartix Store - Version Finale Scalable"""
from jobs import JobManager
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Body, status, BackgroundTasks, Request
from datetime import datetime, timezone, timedelta
import uuid
import json
import logging
import asyncio
from typing import List, Optional, Dict, Any
from collections import defaultdict
from bson.objectid import ObjectId
import os
import pathlib
from models.marketplace import *
from repositories.marketplace_repository import MarketplaceRepository
from services.marketplace_service import MarketplaceService
from motor.motor_asyncio import AsyncIOMotorClient
from db import get_db_client, get_collection
from marketplace_config import settings
from utils.api_response import APIResponse
from routes.marketplace_secured import (
    validate_seller_ownership, validate_product_ownership,
    validate_buyer_ownership, validate_product_data,
    validate_payment_data, validate_review_data
)
from utils.error_handler import (
    SmartixException, ValidationError, AuthorizationError, NotFoundError
)
from utils.api_response import APIResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["marketplace"])
repo = MarketplaceRepository()


def get_marketplace_service() -> MarketplaceService:
    """Dependency provider pour MarketplaceService."""
    return MarketplaceService(db_client=get_db_client())


def serialize_doc(doc):
    """Convertit un document MongoDB en dict JSON-sérialisable."""
    if not isinstance(doc, dict):
        return doc
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
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result

# ============= CONFIGURATION =============
from marketplace_config import settings

# ============= TOKEN SERVICE AVEC REDIS =============
try:
    import redis
    REDIS_AVAILABLE = bool(settings.REDIS_URL)
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, using memory cache (not for production)")

class TokenService:
    """Service de gestion des tokens avec Redis ou cache mémoire"""
    
    def __init__(self):
        self.redis_client = None
        self.memory_cache = {}
        self._cleanup_task = None
        
        if REDIS_AVAILABLE and settings.REDIS_URL:
            try:
                self.redis_client = redis.Redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True
                )
                logger.info("Token service using Redis")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}, using memory cache")
                self.redis_client = None
        
        if not self.redis_client:
            logger.warning("Token service using memory cache (not for production)")
            self._schedule_cleanup()

    def _schedule_cleanup(self):
        """Démarre la tâche de nettoyage si un event loop est disponible."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self._cleanup_loop())
        except RuntimeError:
            pass  # Pas d'event loop au moment de l'import — nettoyage ignoré

    async def _cleanup_loop(self):
        """Boucle de nettoyage des tokens expirés."""
        while True:
            await asyncio.sleep(300)
            now = datetime.now(timezone.utc)
            expired = [
                token for token, data in list(self.memory_cache.items())
                if datetime.fromisoformat(data["expires_at"]) < now
            ]
            for token in expired:
                del self.memory_cache[token]
            if expired:
                logger.debug(f"Cleaned up {len(expired)} expired tokens")
    
    async def create_preview_token(self, product_id: str) -> dict:
        """Crée un token de preview avec expiration"""
        token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.PREVIEW_TOKEN_TTL)
        token_data = {
            "product_id": product_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        }
        
        if self.redis_client:
            self.redis_client.setex(
                f"preview_token:{token}",
                settings.PREVIEW_TOKEN_TTL,
                json.dumps(token_data)
            )
        else:
            self.memory_cache[token] = token_data
        
        return {
            "token": token,
            "expires_in": settings.PREVIEW_TOKEN_TTL,
            "expires_at": expires_at.isoformat()
        }
    
    async def get_preview_token_data(self, token: str) -> Optional[Dict]:
        """Récupère les données d'un token"""
        if self.redis_client:
            data = self.redis_client.get(f"preview_token:{token}")
            if data:
                return json.loads(data)
        else:
            data = self.memory_cache.get(token)
            if data and datetime.fromisoformat(data["expires_at"]) > datetime.now(timezone.utc):
                return data
        return None
    
    async def invalidate_token(self, token: str):
        """Invalide un token"""
        if self.redis_client:
            self.redis_client.delete(f"preview_token:{token}")
        else:
            self.memory_cache.pop(token, None)

preview_token_service = TokenService()

# ============= STATS SERVICE AVEC CACHE =============
class SellerStatsService:
    """Service de gestion des statistiques vendeur avec cache"""
    
    def __init__(self):
        self.redis_client = None
        self.memory_cache = {}
        
        if REDIS_AVAILABLE and settings.REDIS_URL:
            try:
                self.redis_client = redis.Redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True
                )
            except Exception:
                self.redis_client = None
    
    async def get_seller_stats(self, seller_id: str) -> Dict:
        """Récupère les stats avec cache"""
        cache_key = f"seller_stats:{seller_id}"
        
        # Tentative de récupération depuis le cache
        if self.redis_client:
            cached = self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        else:
            cached = self.memory_cache.get(cache_key)
            if cached:
                return cached
        
        # Calcul des stats via aggregation MongoDB
        stats = await self._compute_seller_stats(seller_id)
        
        # Mise en cache
        if self.redis_client:
            self.redis_client.setex(
                cache_key,
                settings.STATS_CACHE_TTL,
                json.dumps(stats)
            )
        else:
            self.memory_cache[cache_key] = stats
        
        return stats
    
    async def _compute_seller_stats(self, seller_id: str) -> Dict:
        """Calcule les stats via aggregation MongoDB"""
        try:
            # Aggrégation des produits
            products_pipeline = [
                {"$match": {"seller_id": seller_id}},
                {"$group": {
                    "_id": None,
                    "total_products": {"$sum": 1},
                    "total_revenue": {"$sum": "$price"},
                    "total_quantity_sold": {"$sum": "$quantity_sold"}
                }}
            ]
            products_result = await repo.products.aggregate(products_pipeline).to_list(1)
            products_stats = products_result[0] if products_result else {}
            
            # Aggrégation des commandes complétées
            orders_pipeline = [
                {"$match": {"seller_id": seller_id, "status": "completed"}},
                {"$group": {
                    "_id": None,
                    "total_sales": {"$sum": 1},
                    "total_revenue_orders": {"$sum": "$total_amount"}
                }}
            ]
            orders_result = await repo.orders.aggregate(orders_pipeline).to_list(1)
            orders_stats = orders_result[0] if orders_result else {}
            
            # Récupération du wallet
            wallet = await repo.wallets.find_one({"seller_id": seller_id})
            
            # Aggrégation des reviews
            reviews_pipeline = [
                {"$match": {"seller_id": seller_id}},
                {"$group": {
                    "_id": None,
                    "average_rating": {"$avg": "$rating"},
                    "total_reviews": {"$sum": 1}
                }}
            ]
            reviews_result = await repo.reviews.aggregate(reviews_pipeline).to_list(1)
            reviews_stats = reviews_result[0] if reviews_result else {}
            
            return {
                "total_products": products_stats.get("total_products", 0),
                "total_sales": orders_stats.get("total_sales", 0),
                "total_revenue": orders_stats.get("total_revenue_orders", 0),
                "wallet_balance": wallet.get("balance", 0) if wallet else 0,
                "average_rating": round(reviews_stats.get("average_rating", 0), 1),
                "total_reviews": reviews_stats.get("total_reviews", 0),
                "total_quantity_sold": products_stats.get("total_quantity_sold", 0),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Error computing seller stats: {e}")
            return {
                "total_products": 0,
                "total_sales": 0,
                "total_revenue": 0,
                "wallet_balance": 0,
                "average_rating": 0,
                "total_reviews": 0,
                "total_quantity_sold": 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
    
    async def invalidate_cache(self, seller_id: str):
        """Invalide le cache quand les données changent"""
        cache_key = f"seller_stats:{seller_id}"
        if self.redis_client:
            self.redis_client.delete(cache_key)
        else:
            self.memory_cache.pop(cache_key, None)

seller_stats_service = SellerStatsService()

# ============= REVIEW SERVICE AVEC MISE À JOUR INCRÉMENTALE =============
class ReviewService:
    """Service de gestion des reviews avec mise à jour incrémentale"""
    
    async def create_review(
        self, 
        product_id: str, 
        buyer_id: str, 
        rating: int, 
        comment: str,
        buyer_name: str,
        buyer_avatar: Optional[str] = None
    ) -> Dict:
        """Crée une review avec mise à jour incrémentale du rating"""
        
        # Insérer la review
        review = {
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "buyer_id": buyer_id,
            "rating": rating,
            "comment": comment,
            "reviewer_name": buyer_name,
            "reviewer_avatar": buyer_avatar,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await repo.reviews.insert_one(review)
        
        # Mise à jour incrémentale du rating
        product = await repo.get_product_by_id(product_id)
        if product:
            old_rating = product.get("average_rating", 0)
            old_count = product.get("total_reviews", 0)
            
            new_count = old_count + 1
            new_rating = ((old_rating * old_count) + rating) / new_count
            
            await repo.products.update_one(
                {"id": product_id},
                {
                    "$set": {
                        "average_rating": round(new_rating, 1),
                        "total_reviews": new_count
                    },
                    "$setOnInsert": {
                        "rating": round(new_rating, 1),
                        "total_ratings": new_count
                    }
                }
            )
            
            # Invalider le cache des stats vendeur
            seller_id = product.get("seller_id")
            if seller_id:
                await seller_stats_service.invalidate_cache(seller_id)
        
        return review

review_service = ReviewService()

# ============= RATE LIMITING AMÉLIORÉ =============
class RateLimiter:
    """Rate limiter avec support Redis et mémoire"""
    
    def __init__(self):
        self.redis_client = None
        self.memory_cache = defaultdict(list)
        
        if REDIS_AVAILABLE and settings.REDIS_URL:
            try:
                self.redis_client = redis.Redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True
                )
            except Exception:
                self.redis_client = None
    
    async def is_allowed(self, key: str, limit: int, window_seconds: int) -> bool:
        """Vérifie si la requête est autorisée"""
        now = datetime.now(timezone.utc).timestamp()
        window_start = now - window_seconds
        
        if self.redis_client:
            # Utilisation de Redis avec Lua script pour atomicité
            lua_script = """
                local key = KEYS[1]
                local now = tonumber(ARGV[1])
                local window = tonumber(ARGV[2])
                local limit = tonumber(ARGV[3])
                
                redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
                local count = redis.call('ZCARD', key)
                
                if count < limit then
                    redis.call('ZADD', key, now, now)
                    redis.call('EXPIRE', key, window)
                    return 1
                end
                return 0
            """
            result = self.redis_client.eval(lua_script, 1, key, now, window_seconds, limit)
            return bool(result)
        else:
            # Cache mémoire
            self.memory_cache[key] = [
                t for t in self.memory_cache[key] 
                if t > window_start
            ]
            if len(self.memory_cache[key]) >= limit:
                return False
            self.memory_cache[key].append(now)
            return True
    
    async def is_allowed_for_user(self, user_id: str, limit: int, window_seconds: int) -> bool:
        """Rate limiting par utilisateur"""
        return await self.is_allowed(f"user_rate:{user_id}", limit, window_seconds)
    
    async def is_global_allowed(self, limit: int, window_seconds: int) -> bool:
        """Rate limiting global"""
        return await self.is_allowed("global_rate", limit, window_seconds)

rate_limiter = RateLimiter()

# ============= CONSTANTES =============
MAX_CONCURRENT_GENERATIONS = settings.MAX_CONCURRENT_GENERATIONS
MAX_PENDING_GENERATIONS = settings.MAX_PENDING_GENERATIONS
generation_semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)
pending_generations = 0
pending_lock = asyncio.Lock()

# ============= AUTHENTICATION DEPENDENCY =============
async def get_current_user(request: Request) -> str:
    """Extrait l'ID de l'utilisateur courant depuis le token d'authentification"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # TODO: Implémenter la vérification du token JWT
    # Pour le développement, utiliser un header X-User-ID
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found")
    
    return user_id

# ============= STORAGE SETUP =============
PRODUCTS_UPLOAD_DIR = pathlib.Path(settings.UPLOAD_DIR) / "products"
COVERS_UPLOAD_DIR = pathlib.Path(settings.UPLOAD_DIR) / "covers"
PREVIEWS_UPLOAD_DIR = pathlib.Path(settings.UPLOAD_DIR) / "previews"

for dir_path in [PRODUCTS_UPLOAD_DIR, COVERS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# ============= HELPER FUNCTIONS =============
async def run_preview_generation(product_id: str, pdf_fs_path: str, selected_pages: list):
    """Background task to generate preview and thumbnails with validations"""
    global pending_generations
    try:
        async with generation_semaphore:
            from utils.pdf_handler import (
                generate_pdf_preview_and_thumbnails, 
                get_pdf_info, 
                cleanup_product_files
            )
            
            await repo.update_product(product_id, {
                "status": "processing", 
                "preview_generation_status": "processing"
            })
            
            product = await repo.get_product_by_id(product_id)
            if not product:
                logger.error(f"Background preview failed: Product {product_id} not found")
                return

            try:
                def process_pdf():
                    if len(selected_pages) > settings.MAX_PREVIEW_PAGES:
                        return {"error": "too_many_pages"}

                    pdf_info = get_pdf_info(pdf_fs_path)
                    if "error" in pdf_info:
                        return {"error": "pdf_read_error"}
                    
                    total_pages = int(pdf_info.get("total_pages", 0))
                    if total_pages > settings.MAX_PDF_PAGES:
                        return {"error": "pdf_too_large"}

                    invalid_indices = [p for p in selected_pages if p < 1 or p > total_pages]
                    if invalid_indices:
                        return {"error": "invalid_indices"}

                    preview_url, thumb_urls = generate_pdf_preview_and_thumbnails(
                        pdf_fs_path, 
                        selected_pages, 
                        product_id
                    )
                    
                    if not preview_url:
                        return {"error": "generation_failed"}
                        
                    return {
                        "preview_file": preview_url,
                        "preview_thumbs": thumb_urls,
                        "total_pages": total_pages
                    }

                result = await asyncio.wait_for(
                    asyncio.to_thread(process_pdf),
                    timeout=settings.PREVIEW_GENERATION_TIMEOUT
                )

                if "error" in result:
                    logger.warning(f"Rejet preview {product_id}: {result['error']}")
                    cleanup_product_files(product)
                    await repo.update_product(product_id, {
                        "status": "failed", 
                        "preview_generation_status": "failed"
                    })
                    return

                update_data = {
                    "preview_file": result["preview_file"],
                    "preview_thumbs": result["preview_thumbs"],
                    "free_preview_pages": len(selected_pages),
                    "preview_pages_indices": selected_pages,
                    "total_pages": result["total_pages"],
                    "status": "preview_ready",
                    "preview_generation_status": "completed",
                    "updated_at": datetime.now(timezone.utc)
                }
                
                await repo.update_product(product_id, update_data)
                logger.info(f"Background preview completed for product {product_id}")

            except asyncio.TimeoutError:
                logger.error(f"Timeout generating preview for {product_id}")
                cleanup_product_files(product)
                await repo.update_product(product_id, {
                    "status": "failed", 
                    "preview_generation_status": "failed"
                })
                
    except Exception as e:
        logger.exception(f"Error in background preview generation for {product_id}: {str(e)}")
        product = await repo.get_product_by_id(product_id)
        if product:
            from utils.pdf_handler import cleanup_product_files
            cleanup_product_files(product)
        await repo.update_product(product_id, {
            "status": "failed", 
            "preview_generation_status": "failed"
        })
    finally:
        async with pending_lock:
            pending_generations = max(0, pending_generations - 1)

# ============= ENDPOINTS =============

# ============= CATEGORIES =============
@router.get("/categories")
async def get_categories():
    """Get all product categories"""
    try:
        categories = await repo.get_all_categories()
        if not categories:
            return APIResponse.ok(
                data=[{"id": "ebooks", "name": "E-books"}, {"id": "courses", "name": "Cours"}],
                message="Default categories"
            ).to_response()
        return APIResponse.ok(data=categories).to_response()
    except Exception as e:
        logger.error(f"Error fetching categories: {str(e)}")
        return APIResponse.error(message="Failed to fetch categories").to_response(status_code=500)

# ============= ORDERS =============
@router.get("/orders/buyer")
async def get_buyer_orders(
    current_user_id: str = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None)
):
    """Get all orders for the authenticated buyer with pagination"""
    try:
        skip = (page - 1) * limit
        
        filter_query = {"buyer_id": current_user_id}
        if status and status != 'all':
            filter_query["status"] = status
        
        orders = await repo.get_buyer_orders_paginated(
            current_user_id, 
            skip=skip, 
            limit=limit,
            status=status if status and status != 'all' else None
        )
        
        total = await repo.count_orders(filter_query)
        
        # Compteurs par statut
        status_counts = {}
        for s in ['completed', 'pending', 'failed', 'refunded']:
            status_counts[s] = await repo.count_orders({
                "buyer_id": current_user_id,
                "status": s
            })
        
        # Enrichir les commandes
        enriched_orders = []
        for order in orders:
            order_dict = serialize_doc(order)
            order_dict["download_available"] = (
                order.get("status") == "completed" and 
                order.get("product_id") is not None
            )
            enriched_orders.append(order_dict)
        
        return APIResponse.paginated(
            data=enriched_orders,
            total=total,
            page=page,
            limit=limit,
            extra_meta={"by_status": status_counts}
        ).to_response()
        
    except Exception as e:
        logger.error(f"Error fetching buyer orders: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to fetch orders").to_response(status_code=500)

@router.get("/orders/{order_identifier}")
async def get_order(
    order_identifier: str,
    current_user_id: str = Depends(get_current_user)
):
    """Get order details by ID or order number"""
    try:
        order = await repo.get_order_by_number(order_identifier)
        if not order:
            order = await repo.get_order_by_id(order_identifier)
        
        if not order:
            return APIResponse.error(message="Order not found").to_response(status_code=404)
        
        if order["buyer_id"] != current_user_id and order["seller_id"] != current_user_id:
            return APIResponse.error(message="Unauthorized").to_response(status_code=403)
        
        order_dict = serialize_doc(order)
        order_dict["download_available"] = (
            order.get("status") == "completed" and 
            order.get("product_id") is not None
        )
        
        if order.get("product_id"):
            product = await repo.get_product_by_id(order["product_id"])
            if product:
                order_dict["product_name"] = product.get("title")
                order_dict["product_cover"] = product.get("cover_image")
        
        return APIResponse.ok(data=order_dict).to_response()
        
    except Exception as e:
        logger.error(f"Error fetching order: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to fetch order").to_response(status_code=500)

@router.get("/orders/{order_id}/pdf")
async def get_ordered_pdf(
    order_id: str,
    current_user_id: str = Depends(get_current_user)
):
    """Get full PDF for a completed order (inline view)"""
    try:
        from utils.pdf_handler import add_watermark_to_pdf
        from fastapi.responses import FileResponse
        
        order = await repo.get_order_by_id(order_id)
        if not order:
            return APIResponse.error(message="Order not found").to_response(status_code=404)
        
        if order["buyer_id"] != current_user_id:
            return APIResponse.error(message="Unauthorized").to_response(status_code=403)
        
        if order["status"] != "completed":
            return APIResponse.error(message="Order not completed").to_response(status_code=400)
        
        order_item = await repo.get_order_item_by_order_id(order_id)
        if not order_item:
            return APIResponse.error(message="Order item not found").to_response(status_code=404)
        
        product = await repo.get_product_by_id(order_item["product_id"])
        if not product:
            return APIResponse.error(message="Product not found").to_response(status_code=404)
        
        buyer = await repo.get_user_by_id(current_user_id)
        buyer_name = buyer.get("full_name", "Client") if buyer else "Client"
        
        original_pdf_path = product["pdf_file"].lstrip("/")
        watermarked_pdf = add_watermark_to_pdf(
            original_pdf_path,
            buyer_name,
            order.get("order_number", order_id),
            order.get("phone_number", "")
        )
        
        return FileResponse(
            watermarked_pdf,
            media_type="application/pdf",
            filename=f"{product['title']}.pdf",
            headers={"Cache-Control": "private, max-age=3600"}
        )
        
    except Exception as e:
        logger.error(f"Error serving ordered PDF: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to serve PDF").to_response(status_code=500)

@router.get("/orders/{order_id}/download")
async def download_purchased_pdf(
    order_id: str,
    current_user_id: str = Depends(get_current_user)
):
    """Download purchased PDF with automatic watermark"""
    try:
        from utils.pdf_handler import add_watermark_to_pdf
        from fastapi.responses import FileResponse
        
        order = await repo.get_order_by_id(order_id)
        if not order:
            return APIResponse.error(message="Order not found").to_response(status_code=404)
        
        if order["buyer_id"] != current_user_id:
            return APIResponse.error(message="Unauthorized").to_response(status_code=403)
        
        if order["status"] != "completed":
            return APIResponse.error(message="Order not completed").to_response(status_code=400)
        
        order_item = await repo.get_order_item_by_order_id(order_id)
        if not order_item:
            return APIResponse.error(message="Order item not found").to_response(status_code=404)
        
        product = await repo.get_product_by_id(order_item["product_id"])
        if not product:
            return APIResponse.error(message="Product not found").to_response(status_code=404)
        
        buyer = await repo.get_user_by_id(current_user_id)
        buyer_name = buyer.get("full_name", "Client") if buyer else "Client"
        
        original_pdf_path = product["pdf_file"].lstrip("/")
        watermarked_pdf = add_watermark_to_pdf(
            original_pdf_path,
            buyer_name,
            order.get("order_number", order_id),
            order.get("phone_number", "")
        )
        
        return FileResponse(
            watermarked_pdf,
            media_type="application/pdf",
            filename=f"{product['title']}.pdf",
            headers={"Content-Disposition": "attachment"}
        )
        
    except Exception as e:
        logger.error(f"Error downloading PDF: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to download PDF").to_response(status_code=500)
        
# ============= PREVIEW ENDPOINTS =============
@router.get("/products/{product_id}/preview/token")
async def get_preview_token(product_id: str):
    """Generate a temporary token for PDF preview"""
    try:
        product = await repo.get_product_by_id(product_id)
        if not product:
            return APIResponse.error(message="Product not found").to_response(status_code=404)
        
        if product.get("status") != "preview_ready" and product.get("preview_generation_status") != "completed":
            return APIResponse.error(
                message="Preview not ready yet",
                details={"status": product.get("preview_generation_status", "idle")}
            ).to_response(status_code=400)
        
        token_data = await preview_token_service.create_preview_token(product_id)
        
        return APIResponse.ok(
            data=token_data,
            message="Preview token generated"
        ).to_response()
        
    except Exception as e:
        logger.error(f"Error generating preview token: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to generate preview token").to_response(status_code=500)

@router.get("/products/preview/content")
async def get_preview_content(token: str = Query(...)):
    """Serve preview PDF with token validation"""
    try:
        from utils.pdf_handler import extract_pdf_preview
        from fastapi.responses import FileResponse
        
        token_data = await preview_token_service.get_preview_token_data(token)
        if not token_data:
            return APIResponse.error(message="Invalid or expired token").to_response(status_code=403)
        
        product_id = token_data["product_id"]
        product = await repo.get_product_by_id(product_id)
        
        if not product:
            return APIResponse.error(message="Product not found").to_response(status_code=404)
        
        pdf_relative_path = product.get("pdf_file")
        if not pdf_relative_path:
            return APIResponse.error(message="PDF file not found").to_response(status_code=404)
        
        pdf_fs_path = pdf_relative_path.lstrip("/")
        
        if not os.path.exists(pdf_fs_path):
            logger.error(f"PDF file not found on disk: {pdf_fs_path}")
            return APIResponse.error(message="PDF file missing").to_response(status_code=404)
        
        num_pages = product.get("free_preview_pages", 3)
        preview_pdf_path = extract_pdf_preview(pdf_fs_path, num_pages)
        
        if not preview_pdf_path or not os.path.exists(preview_pdf_path):
            return APIResponse.error(message="Failed to generate preview").to_response(status_code=500)
        
        return FileResponse(
            preview_pdf_path,
            media_type="application/pdf",
            filename=f"preview_{product['title']}.pdf",
            headers={"Cache-Control": "public, max-age=3600"}
        )
        
    except Exception as e:
        logger.error(f"Error serving preview content: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to serve preview").to_response(status_code=500)

# ============= PRODUCT PREVIEW GENERATION =============
@router.post("/products/{product_id}/generate-preview")
async def generate_product_preview(
    product_id: str, 
    request: Request,
    data: dict = Body(...),
    current_user_id: str = Depends(get_current_user)
):
    """Start background task for PDF preview and thumbnails generation"""
    global pending_generations
    try:
        # Rate Limiting
        if not await rate_limiter.is_allowed_for_user(current_user_id, 3, 3600):
            return APIResponse.error(
                message="Preview generation limit reached (3/hour)"
            ).to_response(status_code=429)
        
        if not await rate_limiter.is_global_allowed(10, 60):
            return APIResponse.error(
                message="Server overloaded, please retry in a minute"
            ).to_response(status_code=429)

        # Vérification saturation
        async with pending_lock:
            if pending_generations >= (MAX_CONCURRENT_GENERATIONS + MAX_PENDING_GENERATIONS):
                logger.warning(f"Saturé: {pending_generations} tâches actives/pending")
                return APIResponse.error(
                    message="Generation system saturated, please retry later"
                ).to_response(status_code=503)
            pending_generations += 1
        
        # Vérification produit
        product = await repo.get_product_by_id(product_id)
        if not product:
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(message="Product not found").to_response(status_code=404)
        
        if product["seller_id"] != current_user_id:
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(message="Unauthorized").to_response(status_code=403)

        pdf_relative_path = product.get("pdf_file")
        if not pdf_relative_path:
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(message="PDF file missing").to_response(status_code=404)
        
        pdf_fs_path = pdf_relative_path.lstrip("/")
        selected_pages = data.get("selected_pages", [])

        # Validation des pages
        if not selected_pages:
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(message="Please select at least one page").to_response(status_code=400)
        
        if not isinstance(selected_pages, list):
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(message="selected_pages must be a list").to_response(status_code=400)
        
        if len(selected_pages) > settings.MAX_PREVIEW_PAGES:
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(
                message=f"Maximum {settings.MAX_PREVIEW_PAGES} pages allowed"
            ).to_response(status_code=400)
        
        if len(set(selected_pages)) != len(selected_pages):
            async with pending_lock:
                pending_generations -= 1
            return APIResponse.error(
                message="Duplicate page indices not allowed"
            ).to_response(status_code=400)

        # Lancement de la tâche
        asyncio.create_task(run_preview_generation(product_id, pdf_fs_path, selected_pages))

        return APIResponse.ok(
            data={
                "status": "processing",
                "preview_generation_status": "processing",
                "message": "Preview generation started in background"
            },
            message="Preview generation started"
        ).to_response(status_code=202)
        
    except Exception as e:
        logger.error(f"Error starting preview generation: {str(e)}", exc_info=True)
        async with pending_lock:
            pending_generations = max(0, pending_generations - 1)
        await repo.update_product(product_id, {
            "status": "failed", 
            "preview_generation_status": "failed"
        })
        return APIResponse.error(message="Failed to start generation").to_response(status_code=500)

# ============= PRODUCTS =============
@router.get("/products")
async def get_products(
    category: Optional[str] = None,
    seller_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("newest"),
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
):
    """Get marketplace products with pagination and filters"""
    try:
        skip = (page - 1) * limit

        query: dict = {"is_published": True}
        if category:
            query["category_id"] = category
        if seller_id:
            query["seller_id"] = seller_id
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        if min_price is not None or max_price is not None:
            price_filter: dict = {}
            if min_price is not None:
                price_filter["$gte"] = min_price
            if max_price is not None:
                price_filter["$lte"] = max_price
            query["price"] = price_filter

        total = await repo.count_products(query)

        sort_map = {
            "newest": [("created_at", -1)],
            "popular": [("quantity_sold", -1)],
            "top_rated": [("average_rating", -1)],
            "price_low": [("price", 1)],
            "price_high": [("price", -1)]
        }
        sort_order = sort_map.get(sort_by, [("created_at", -1)])

        products = await repo.get_products(query, sort_order, skip, limit)

        enriched_products = []
        for p in products:
            p_dict = serialize_doc(p)
            if not isinstance(p_dict, dict):
                continue

            seller_id_val = p.get("seller_id")
            if seller_id_val:
                seller = await repo.get_user_by_id(seller_id_val)
                if seller:
                    p_dict["seller_name"] = seller.get("full_name", seller.get("username", "Smartix Seller"))
                    avatar = seller.get("avatar")
                    if avatar and isinstance(avatar, str) and not avatar.startswith("/") and not avatar.startswith("http"):
                        avatar = f"/uploads/avatars/{avatar}" if not avatar.startswith("uploads/") else f"/{avatar}"
                    p_dict["seller_avatar"] = avatar

            p_dict["preview_ready"] = p.get("status") == "preview_ready"
            p_dict["preview_generation_status"] = p.get("preview_generation_status", "idle")

            enriched_products.append(p_dict)

        return APIResponse.paginated(
            data=enriched_products,
            total=total,
            page=page,
            limit=limit
        ).to_response()

    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to fetch products").to_response(status_code=500)

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get product details"""
    try:
        product = await repo.get_product_by_id(product_id)
        if not product:
            return APIResponse.error(message="Product not found").to_response(status_code=404)
        
        p_dict = serialize_doc(product)
        
        if isinstance(p_dict, dict):
            seller_id_val = product.get("seller_id")
            if seller_id_val:
                seller = await repo.get_user_by_id(seller_id_val)
                if seller:
                    p_dict["seller_name"] = seller.get("full_name", seller.get("username", "Smartix Seller"))
                    avatar = seller.get("avatar")
                    if avatar and isinstance(avatar, str) and not avatar.startswith("/") and not avatar.startswith("http"):
                        avatar = f"/uploads/avatars/{avatar}" if not avatar.startswith("uploads/") else f"/{avatar}"
                    p_dict["seller_avatar"] = avatar
            
            p_dict["preview_ready"] = product.get("status") == "preview_ready"
            p_dict["preview_generation_status"] = product.get("preview_generation_status", "idle")
            p_dict["download_available"] = product.get("status") == "preview_ready"
        
        return APIResponse.ok(data=p_dict).to_response()
        
    except Exception as e:
        logger.error(f"Error fetching product: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to fetch product").to_response(status_code=500)


# ============= ORDER CREATION =============
@router.post("/orders/create")
async def create_order(
    order_data: OrderCreate, 
    current_user_id: str = Depends(get_current_user),
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Create new order using transaction"""
    try:
        order = await service.create_order_transaction(
            buyer_id=current_user_id,
            product_id=order_data.product_id,
            quantity=order_data.quantity,
            payment_method=order_data.payment_method,
            phone_number=order_data.phone_number
        )
        logger.info(f"Order created via transaction: {order['order_number']}")
        return APIResponse.ok(data=order, message="Order created successfully").to_response(status_code=201)
        
    except (ValidationError, NotFoundError) as e:
        logger.warning(f"Error creating order: {e.message}")
        return APIResponse.error(message=e.message).to_response(status_code=e.status_code)
    except Exception as e:
        logger.error(f"Transaction failed: {str(e)}")
        return APIResponse.error(message="Order creation failed").to_response(status_code=500)

# ============= PAYMENTS =============
@router.post("/payments/process")
async def process_payment(
    payment: PaymentCreate, 
    current_user_id: str = Depends(get_current_user),
    service: MarketplaceService = Depends(get_marketplace_service)
):
    """Simulated payment processing using transaction"""
    try:
        actual_service = service
        if callable(service) and not isinstance(service, MarketplaceService):
            actual_service = get_marketplace_service()

        result = await actual_service.process_payment_transaction(
            order_id=payment.order_id,
            amount=payment.amount,
            payment_method=payment.payment_method,
            phone_number=payment.phone_number,
            buyer_id=current_user_id
        )
        return APIResponse.ok(
            data=result,
            message="Payment processed successfully"
        ).to_response()
        
    except (ValidationError, NotFoundError) as e:
        logger.warning(f"Payment error: {e.message}")
        return APIResponse.error(message=e.message).to_response(status_code=e.status_code)
    except Exception as e:
        logger.error(f"Payment transaction failed: {str(e)}")
        return APIResponse.error(message="Payment processing failed").to_response(status_code=500)

# ============= REVIEWS =============
@router.post("/reviews")
async def create_review(
    review: ReviewCreate, 
    current_user_id: str = Depends(get_current_user)
):
    """Create product review with incremental rating update"""
    try:
        await validate_review_data(review.rating, review.comment)
        
        buyer = await repo.get_user_by_id(current_user_id)
        if not buyer:
            return APIResponse.error(message="User not found").to_response(status_code=404)
        
        buyer_name = buyer.get("full_name", "Anonymous")
        buyer_avatar = buyer.get("avatar")
        
        result = await review_service.create_review(
            product_id=review.product_id,
            buyer_id=current_user_id,
            rating=review.rating,
            comment=review.comment,
            buyer_name=buyer_name,
            buyer_avatar=buyer_avatar
        )
        
        logger.info(f"Review created for product {review.product_id} by buyer {current_user_id}")
        return APIResponse.ok(data=result, message="Review created successfully").to_response(status_code=201)
        
    except (ValidationError, NotFoundError) as e:
        logger.warning(f"Error creating review: {e.message}")
        return APIResponse.error(message=e.message).to_response(status_code=e.status_code)
    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        return APIResponse.error(message="Failed to create review").to_response(status_code=500)

@router.get("/reviews/product/{product_id}")
async def get_product_reviews(product_id: str):
    """Get all reviews for product"""
    try:
        reviews = await repo.reviews.find({"product_id": product_id}).to_list(None)
        reviews_list = []
        for r in reviews:
            reviews_list.append({
                "id": str(r.get("_id", r.get("id"))),
                "product_id": r.get("product_id"),
                "buyer_id": r.get("buyer_id"),
                "rating": r.get("rating"),
                "comment": r.get("comment"),
                "reviewer_name": r.get("reviewer_name", "Anonymous"),
                "reviewer_avatar": r.get("reviewer_avatar"),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at")
            })
        return APIResponse.ok(data=reviews_list).to_response()
    except Exception as e:
        logger.error(f"Error fetching reviews: {str(e)}")
        return APIResponse.error(message="Failed to fetch reviews").to_response(status_code=500)

# ============= SELLER STATS =============
@router.get("/sellers/stats/{seller_id}")
async def get_seller_stats(
    seller_id: str, 
    current_user_id: str = Depends(get_current_user)
):
    """Get seller dashboard statistics with caching"""
    try:
        validate_seller_ownership(current_user_id, seller_id)
        
        if not seller_id or seller_id == "undefined" or seller_id == "null":
            return APIResponse.ok(data={
                "total_products": 0,
                "total_sales": 0,
                "total_revenue": 0,
                "wallet_balance": 0,
                "average_rating": 0,
                "total_reviews": 0,
                "total_quantity_sold": 0
            }).to_response()
        
        stats = await seller_stats_service.get_seller_stats(seller_id)
        return APIResponse.ok(data=stats).to_response()
        
    except (AuthorizationError, NotFoundError) as e:
        logger.warning(f"Error getting seller stats: {e.message}")
        return APIResponse.error(message=e.message).to_response(status_code=e.status_code)
    except Exception as e:
        logger.error(f"Error fetching seller stats: {str(e)}")
        return APIResponse.ok(data={
            "total_products": 0,
            "total_sales": 0,
            "total_revenue": 0,
            "wallet_balance": 0,
            "average_rating": 0,
            "total_reviews": 0,
            "total_quantity_sold": 0
        }).to_response()

# ============= ENDPOINTS CONSERVÉS =============
# Les endpoints suivants sont conservés avec leur implémentation existante
# en utilisant le nouveau format de réponse APIResponse

@router.get("/sellers/profile/{user_id}")
async def get_seller_profile(user_id: str):
    """Get seller profile"""
    try:
        seller = await repo.get_seller_profile(user_id)
        if not seller:
            return APIResponse.error(message="Seller profile not found").to_response(status_code=404)
        return APIResponse.ok(data=serialize_doc(seller)).to_response()
    except Exception as e:
        logger.error(f"Error fetching seller profile: {str(e)}")
        return APIResponse.error(message="Failed to fetch seller profile").to_response(status_code=500)

@router.post("/sellers/profile")
async def create_seller_profile(profile: SellerProfile):
    """Create seller profile"""
    try:
        existing = await repo.get_seller_profile(profile.user_id)
        if existing:
            return APIResponse.error(message="Seller profile already exists").to_response(status_code=400)
        
        profile_dict = profile.dict()
        profile_id = await repo.create_seller_profile(profile_dict)
        profile_dict["id"] = profile_id
        return APIResponse.ok(data=profile_dict, message="Seller profile created").to_response(status_code=201)
    except Exception as e:
        logger.error(f"Error creating seller profile: {str(e)}")
        return APIResponse.error(message="Failed to create seller profile").to_response(status_code=500)

@router.put("/sellers/profile/{user_id}")
async def update_seller_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    profile_update: dict = Body(...),
):
    """Update seller profile (owner only)"""
    try:
        validate_seller_ownership(current_user["id"], user_id)
        
        update_dict = {k: v for k, v in profile_update.items() if v is not None}
        update_dict["updated_at"] = datetime.now(timezone.utc)
        
        success = await repo.update_seller_profile(user_id, update_dict)
        if not success:
            return APIResponse.error(message="Seller profile not found").to_response(status_code=404)
        
        logger.info(f"Seller profile updated: {user_id}")
        return APIResponse.ok(message="Profile updated").to_response()
        
    except (AuthorizationError, NotFoundError) as e:
        logger.warning(f"Error updating seller profile: {e.message}")
        return APIResponse.error(message=e.message).to_response(status_code=e.status_code)
    except Exception as e:
        logger.error(f"Error updating seller profile: {str(e)}")
        return APIResponse.error(message="Failed to update profile").to_response(status_code=500)
        
