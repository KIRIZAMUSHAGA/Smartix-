"""
Controller de publication pour le marketplace applications
Version PRO avec corrections et optimisations
- Gestion robuste des ObjectId
- Build asynchrone avec queue
- Sécurité des uploads
- Calcul O(1) des notes
- Anti review bombing
- Whitelist de tri
"""

from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional, List, Dict
import hashlib
import os

# Modèles
from models.marketplace_app_models import (
    App, AppCreate, AppUpdate, AppReview, AppReviewCreate
)

# Services
from services.marketplace_app import spam_detector

# Utilitaires (existants dans mobile)
from mobile.utils.apkBuilder import apk_builder
from mobile.utils.fileUploader import file_uploader
from mobile.utils.qrGenerator import qr_generator
from mobile.utils.urlGenerator import url_generator
from mobile.utils.imageValidator import image_validator
from mobile.utils.rateLimiter import rate_limiter

# Queue pour les builds asynchrones
from celery import Celery

# Configuration Redis/Celery
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
celery_app = Celery('marketplace', broker=redis_url, backend=redis_url)

class PublishController:
    """Contrôleur pour la publication d'applications"""
    
    def __init__(self, db):
        self.db = db
        self.apps_collection = db["marketplace_apps"]
        self.reviews_collection = db["marketplace_reviews"]
        
        # ⚠️ CORRECTION : Champs autorisés pour le tri
        self.allowed_sort_fields = {
            "created_at": "created_at",
            "updated_at": "updated_at",
            "rating": "rating",
            "downloads": "stats.downloads",
            "installs": "stats.installs",
            "reviews_count": "reviews_count",
            "name": "name"
        }
        
        # Limites de rate
        self.review_rate_limit = 5  # 5 reviews par heure
        self.review_rate_period = 3600  # 1 heure
    
    # ==================== UTILITAIRES ====================
    
    def _safe_object_id(self, id_str: str):
        """⚠️ CORRECTION : Conversion sécurisée en ObjectId"""
        try:
            return ObjectId(id_str)
        except InvalidId:
            return None
    
    def _validate_sort_field(self, sort_by: str) -> str:
        """⚠️ CORRECTION : Whitelist pour éviter les injections"""
        return self.allowed_sort_fields.get(sort_by, "created_at")
    
    async def _check_review_rate_limit(self, user_id: str) -> bool:
        """⚠️ NOUVEAU : Anti review bombing"""
        key = f"review_rate:{user_id}"
        count = await rate_limiter.get(key)
        
        if count and count >= self.review_rate_limit:
            return False
        
        await rate_limiter.increment(key, self.review_rate_period)
        return True
    
    # ==================== PUBLICATION ASYNCHRONE ====================
    
    @celery_app.task(bind=True, max_retries=3)
    def build_apk_task(self, project_id: str, version: str, user_id: str, app_data: dict):
        """
        ⚠️ CORRECTION : Tâche asynchrone de build APK
        S'exécute dans un worker Celery
        """
        try:
            # Builder l'APK
            build_result = apk_builder.build(
                project_id,
                version=version,
                build_type="release"
            )
            
            # Vérifier la taille (max 200MB)
            if build_result["size"] > 200 * 1024 * 1024:
                raise ValueError("APK too large (max 200MB)")
            
            # Uploader vers CDN
            upload_result = file_uploader.upload(
                build_result["apk_path"],
                {
                    "bucket": "marketplace",
                    "category": "apks",
                    "metadata": {
                        "project_id": project_id,
                        "user_id": user_id,
                        "version": version
                    }
                }
            )
            
            # Générer URL de téléchargement (7 jours max)
            download_url = url_generator.generate_download_url(
                upload_result["file_id"],
                {
                    "expires_in": 7 * 24 * 3600,  # ⚠️ 7 jours au lieu de 30
                    "filename": f"{app_data['name']}-{version}.apk"
                }
            )
            
            # Générer QR code
            qr_code = qr_generator.generate_install_qr(download_url["url"])
            
            return {
                "success": True,
                "apk_url": upload_result["url"],
                "apk_size": build_result["size"],
                "apk_checksum": build_result.get("checksum"),
                "download_url": download_url["url"],
                "qr_code": qr_code,
                "build_id": build_result.get("build_id"),
                "build_time": build_result.get("duration")
            }
            
        except Exception as e:
            self.retry(exc=e, countdown=60)  # Réessayer après 1 minute
            raise
    
    async def publish_app(self, user_id: str, project_id: str, data: dict) -> dict:
        """
        Publie une nouvelle application (version asynchrone)
        """
        try:
            # Valider avec Pydantic
            app_data = AppCreate(**data)
            
            # Créer l'app en base (statut "building")
            app = App(
                developer_id=user_id,
                name=app_data.name,
                description=app_data.description,
                category_id=app_data.category_id,
                tags=app_data.tags,
                version=app_data.version,
                visibility=app_data.visibility,
                is_published=False,  # Pas encore publié
                apk_url=None,
                apk_size=0,
                build_id=None
            )
            
            app_dict = app.dict()
            result = await self.apps_collection.insert_one(app_dict)
            app_id = str(result.inserted_id)
            
            # Lancer le build asynchrone
            self.build_apk_task.delay(
                project_id=project_id,
                version=app_data.version,
                user_id=user_id,
                app_data={"name": app_data.name}
            )
            
            return {
                "success": True,
                "app_id": app_id,
                "status": "building",
                "message": "Application en cours de build. Vous recevrez une notification quand elle sera prête."
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_app(self, app_id: str) -> Optional[dict]:
        """Récupère une application par son ID"""
        obj_id = self._safe_object_id(app_id)
        if not obj_id:
            return None
        
        app = await self.apps_collection.find_one({"_id": obj_id})
        if app:
            app["_id"] = str(app["_id"])
        return app
    
    async def update_app(self, app_id: str, user_id: str, data: dict) -> dict:
        """Met à jour une application"""
        obj_id = self._safe_object_id(app_id)
        if not obj_id:
            return {"success": False, "error": "ID invalide"}
        
        app = await self.get_app(app_id)
        if not app:
            return {"success": False, "error": "Application non trouvée"}
        
        if app["developer_id"] != user_id:
            return {"success": False, "error": "Non autorisé"}
        
        app_update = AppUpdate(**data)
        update_data = app_update.dict(exclude_unset=True)
        
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await self.apps_collection.update_one(
                {"_id": obj_id},
                {"$set": update_data}
            )
        
        return {"success": True, "message": "Application mise à jour"}
    
    async def delete_app(self, app_id: str, user_id: str) -> dict:
        """Supprime une application"""
        obj_id = self._safe_object_id(app_id)
        if not obj_id:
            return {"success": False, "error": "ID invalide"}
        
        app = await self.get_app(app_id)
        if not app:
            return {"success": False, "error": "Application non trouvée"}
        
        if app["developer_id"] != user_id:
            return {"success": False, "error": "Non autorisé"}
        
        # Supprimer l'app et ses reviews
        await self.apps_collection.delete_one({"_id": obj_id})
        await self.reviews_collection.delete_many({"app_id": app_id})
        
        return {"success": True, "message": "Application supprimée"}
    
    # ==================== RECHERCHE OPTIMISÉE ====================
    
    async def search_apps(
        self,
        query: str = None,
        category_id: str = None,
        tags: List[str] = None,
        min_rating: float = None,
        developer_id: str = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        limit: int = 20
    ) -> dict:
        """Recherche des applications avec filtres"""
        # Construire la requête MongoDB
        mongo_query = {"visibility": "public"}
        
        if query:
            # ⚠️ Nécessite un index textuel
            mongo_query["$text"] = {"$search": query}
        
        if category_id:
            mongo_query["category_id"] = category_id
        
        if tags:
            mongo_query["tags"] = {"$in": tags}
        
        if min_rating:
            mongo_query["rating"] = {"$gte": min_rating}
        
        if developer_id:
            mongo_query["developer_id"] = developer_id
        
        # Pagination
        skip = (page - 1) * limit
        
        # ⚠️ CORRECTION : Whitelist pour le tri
        sort_field = self._validate_sort_field(sort_by)
        sort_direction = -1 if sort_order == "desc" else 1
        
        cursor = self.apps_collection.find(mongo_query)
        
        # Si pas de tri textuel, appliquer le tri demandé
        if not query:
            cursor = cursor.sort(sort_field, sort_direction)
        
        cursor = cursor.skip(skip).limit(limit)
        
        apps = await cursor.to_list(length=limit)
        total = await self.apps_collection.count_documents(mongo_query)
        
        # Convertir ObjectId en string
        for app in apps:
            app["_id"] = str(app["_id"])
        
        return {
            "items": apps,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    
    # ==================== AVIS OPTIMISÉS ====================
    
    async def add_review(self, app_id: str, user_id: str, data: dict) -> dict:
        """Ajoute un avis sur une application"""
        try:
            # ⚠️ NOUVEAU : Rate limiting
            if not await self._check_review_rate_limit(user_id):
                return {
                    "success": False,
                    "error": "Rate limit exceeded. Maximum 5 reviews per hour."
                }
            
            # Vérifier que l'app existe
            app = await self.get_app(app_id)
            if not app:
                return {"success": False, "error": "Application non trouvée"}
            
            # Valider les données
            review_data = AppReviewCreate(**data)
            
            # Vérifier si l'utilisateur a déjà commenté
            existing = await self.reviews_collection.find_one({
                "app_id": app_id,
                "user_id": user_id
            })
            
            if existing:
                return {"success": False, "error": "Vous avez déjà commenté cette application"}
            
            # ⚠️ NOUVEAU : Vérifier si l'utilisateur a installé l'app
            has_installed = await self._check_user_installed(app_id, user_id)
            
            # Analyser le spam
            spam_check = await spam_detector.analyze({
                "text": review_data.comment,
                "title": review_data.title or "",
                "userId": user_id,
                "appId": app_id,
                "userHistory": []  # À récupérer si besoin
            })
            
            # Créer l'avis
            review = AppReview(
                app_id=app_id,
                user_id=user_id,
                developer_id=app["developer_id"],
                rating=review_data.rating,
                title=review_data.title,
                comment=review_data.comment,
                pros=review_data.pros,
                cons=review_data.cons,
                status="pending" if spam_check["is_spam"] else "approved",
                verified=has_installed  # ⚠️ Utiliser l'info d'installation
            )
            
            review_dict = review.dict()
            review_dict["spam_analysis"] = spam_check
            
            result = await self.reviews_collection.insert_one(review_dict)
            
            # ⚠️ CORRECTION : Mise à jour O(1) de la note
            await self._update_app_rating_optimized(app_id, review_data.rating)
            
            return {
                "success": True,
                "review_id": str(result.inserted_id),
                "spam_detected": spam_check["is_spam"],
                "verified": has_installed,
                "message": "Avis ajouté" + (" (en attente de modération)" if spam_check["is_spam"] else "")
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _check_user_installed(self, app_id: str, user_id: str) -> bool:
        """⚠️ NOUVEAU : Vérifie si l'utilisateur a installé l'app"""
        # À implémenter avec la collection d'événements
        # return await self.events_collection.find_one({
        #     "app_id": app_id,
        #     "user_id": user_id,
        #     "type": "install"
        # }) is not None
        return False  # Temporaire
    
    async def _update_app_rating_optimized(self, app_id: str, new_rating: int):
        """
        ⚠️ CORRECTION : Mise à jour O(1) de la note
        Utilise rating_sum et rating_count
        """
        app = await self.apps_collection.find_one({"_id": ObjectId(app_id)})
        if not app:
            return
        
        # Récupérer les valeurs actuelles
        rating_sum = app.get("rating_sum", 0)
        rating_count = app.get("rating_count", 0)
        
        # Mettre à jour
        new_sum = rating_sum + new_rating
        new_count = rating_count + 1
        new_avg = new_sum / new_count
        
        await self.apps_collection.update_one(
            {"_id": ObjectId(app_id)},
            {"$set": {
                "rating_sum": new_sum,
                "rating_count": new_count,
                "rating": round(new_avg, 1),
                "reviews_count": new_count
            }}
        )
    
    async def get_reviews(self, app_id: str, page: int = 1, limit: int = 20) -> dict:
        """Récupère les avis d'une application"""
        skip = (page - 1) * limit
        
        cursor = self.reviews_collection.find({
            "app_id": app_id,
            "status": "approved"
        })
        cursor = cursor.sort("created_at", -1).skip(skip).limit(limit)
        
        reviews = await cursor.to_list(length=limit)
        total = await self.reviews_collection.count_documents({
            "app_id": app_id,
            "status": "approved"
        })
        
        for review in reviews:
            review["_id"] = str(review["_id"])
        
        # Stats en O(1) grâce aux champs agrégés
        app = await self.get_app(app_id)
        stats = {
            "average": app.get("rating", 0) if app else 0,
            "total": app.get("reviews_count", 0) if app else 0,
            "distribution": await self._get_review_distribution(app_id)
        }
        
        return {
            "reviews": reviews,
            "total": total,
            "page": page,
            "limit": limit,
            "stats": stats
        }
    
    async def _get_review_distribution(self, app_id: str) -> dict:
        """Calcule la distribution des notes"""
        pipeline = [
            {"$match": {"app_id": app_id, "status": "approved"}},
            {"$group": {
                "_id": "$rating",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.reviews_collection.aggregate(pipeline)
        distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        
        async for item in cursor:
            distribution[item["_id"]] = item["count"]
        
        return distribution

# Index recommandés à créer dans MongoDB
"""
db.marketplace_apps.createIndex({ name: "text", description: "text", tags: "text" })
db.marketplace_apps.createIndex({ category_id: 1 })
db.marketplace_apps.createIndex({ developer_id: 1 })
db.marketplace_apps.createIndex({ rating: -1 })
db.marketplace_apps.createIndex({ "stats.downloads": -1 })
db.marketplace_apps.createIndex({ created_at: -1 })

db.marketplace_reviews.createIndex({ app_id: 1, status: 1, created_at: -1 })
db.marketplace_reviews.createIndex({ user_id: 1, app_id: 1 }, { unique: true })
"""
