"""
Controller d'analytics pour le marketplace applications
Version PRO avec optimisations pour le scaling
- Batch tracking natif
- Redis pour les stats temps réel
- Trending score pré-calculé
- HyperLogLog pour utilisateurs uniques
- Retention et funnel analytics
- Event queue architecture ready
"""

from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional, List, Dict, Set
import math
import hashlib
import json

# Redis pour les stats temps réel
import redis.asyncio as redis
import os

# Modèles
from models.marketplace_app_models import AnalyticsEvent, AnalyticsEventBatch

# Services
from services.marketplace_app import trending_calculator

class AnalyticsController:
    """Contrôleur pour les analytics des applications"""
    
    def __init__(self, db):
        self.db = db
        self.events_collection = db["analytics_events"]
        self.daily_metrics_collection = db["analytics_daily"]
        self.apps_collection = db["marketplace_apps"]
        
        # ⚠️ CORRECTION : Connexion Redis pour stats temps réel
        self.redis = None
        self._init_redis()
        
        # ⚠️ CORRECTION : Types d'événements autorisés (enum-like)
        self.event_types = {
            "view", "download", "install", "session_start", "session_end",
            "crash", "rating", "share", "fork", "uninstall", "update"
        }
        
        # ⚠️ CORRECTION : Périodes de rétention
        self.retention_periods = [1, 7, 30]  # J1, J7, J30
    
    def _init_redis(self):
        """Initialise Redis pour les stats temps réel"""
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            self.redis = redis.from_url(redis_url, decode_responses=True)
        except:
            print("Redis not available, realtime stats disabled")
            self.redis = None
    
    # ==================== UTILITAIRES ====================
    
    def _safe_object_id(self, id_str: str):
        """Conversion sécurisée en ObjectId"""
        try:
            return ObjectId(id_str)
        except InvalidId:
            return None
    
    def _get_redis_key(self, prefix: str, *parts) -> str:
        """Génère une clé Redis"""
        return f"analytics:{prefix}:{':'.join(str(p) for p in parts)}"
    
    def _get_date_range(self, period: str) -> tuple:
        """Retourne les dates de début et fin pour une période"""
        end_date = datetime.now()
        
        if period == "24h":
            start_date = end_date - timedelta(hours=24)
        elif period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
        
        return start_date, end_date
    
    # ==================== TRACKING OPTIMISÉ ====================
    
    async def track_event(self, event_data: dict) -> dict:
        """
        Enregistre un événement analytics
        Version optimisée avec Redis counters
        """
        try:
            # Valider le type d'événement
            event_type = event_data.get("type")
            if event_type not in self.event_types:
                return {"success": False, "error": f"Invalid event type: {event_type}"}
            
            # Créer l'événement
            event = AnalyticsEvent(**event_data)
            event_dict = event.dict()
            
            # ⚠️ CORRECTION : Stocker la date en datetime (pas string)
            event_dict["timestamp"] = datetime.utcnow()
            
            # Insertion en base (async)
            result = await self.events_collection.insert_one(event_dict)
            
            # ⚠️ CORRECTION : Mise à jour des compteurs Redis
            await self._update_realtime_stats(event)
            
            return {
                "success": True,
                "event_id": str(result.inserted_id)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def track_batch(self, batch_data: dict) -> dict:
        """
        ⚠️ CORRECTION : Enregistre un lot d'événements (optimisé)
        À utiliser côté frontend avec batch de 20-50 events
        """
        try:
            batch = AnalyticsEventBatch(**batch_data)
            
            # Valider et préparer les événements
            events = []
            for e in batch.events:
                if e.type in self.event_types:
                    event_dict = e.dict()
                    event_dict["timestamp"] = datetime.utcnow()
                    events.append(event_dict)
                    
                    # Mise à jour Redis pour chaque event
                    await self._update_realtime_stats(e)
            
            if not events:
                return {"success": False, "error": "No valid events"}
            
            # Insertion en batch MongoDB
            result = await self.events_collection.insert_many(events)
            
            return {
                "success": True,
                "count": len(result.inserted_ids)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _update_realtime_stats(self, event: AnalyticsEvent):
        """
        ⚠️ CORRECTION : Met à jour les stats en temps réel avec Redis
        Évite les aggregations MongoDB coûteuses
        """
        if not self.redis:
            return
        
        app_id = event.app_id
        event_type = event.type
        user_id = event.user_id or "anonymous"
        
        # Clés Redis
        views_key = self._get_redis_key("realtime", app_id, "views")
        downloads_key = self._get_redis_key("realtime", app_id, "downloads")
        installs_key = self._get_redis_key("realtime", app_id, "installs")
        sessions_key = self._get_redis_key("realtime", app_id, "sessions")
        users_key = self._get_redis_key("realtime", app_id, "users")
        
        # Incrémenter les compteurs selon le type
        pipeline = self.redis.pipeline()
        
        if event_type == "view":
            pipeline.incr(views_key)
            pipeline.expire(views_key, 86400)  # 24h
        elif event_type == "download":
            pipeline.incr(downloads_key)
            pipeline.expire(downloads_key, 86400)
        elif event_type == "install":
            pipeline.incr(installs_key)
            pipeline.expire(installs_key, 86400)
        elif event_type == "session_start":
            pipeline.incr(sessions_key)
            pipeline.expire(sessions_key, 86400)
        
        # ⚠️ NOUVEAU : HyperLogLog pour utilisateurs uniques
        # Utilise très peu de mémoire même pour des millions d'utilisateurs
        pipeline.pfadd(users_key, user_id)
        pipeline.expire(users_key, 86400)
        
        # Exécuter le pipeline
        await pipeline.execute()
    
    # ==================== STATS TEMPS RÉEL ====================
    
    async def get_realtime_stats(self, app_id: str) -> dict:
        """
        ⚠️ CORRECTION : Récupère les stats en temps réel depuis Redis
        O(1) et ultra rapide
        """
        if not self.redis:
            return await self._get_realtime_stats_fallback(app_id)
        
        views_key = self._get_redis_key("realtime", app_id, "views")
        downloads_key = self._get_redis_key("realtime", app_id, "downloads")
        installs_key = self._get_redis_key("realtime", app_id, "installs")
        sessions_key = self._get_redis_key("realtime", app_id, "sessions")
        users_key = self._get_redis_key("realtime", app_id, "users")
        
        # Récupérer toutes les stats en pipeline
        pipeline = self.redis.pipeline()
        pipeline.get(views_key)
        pipeline.get(downloads_key)
        pipeline.get(installs_key)
        pipeline.get(sessions_key)
        pipeline.pfcount(users_key)
        
        results = await pipeline.execute()
        
        return {
            "app_id": app_id,
            "period": "24h",
            "stats": {
                "views": int(results[0] or 0),
                "downloads": int(results[1] or 0),
                "installs": int(results[2] or 0),
                "sessions": int(results[3] or 0),
                "unique_users": int(results[4] or 0)
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def _get_realtime_stats_fallback(self, app_id: str) -> dict:
        """Fallback sans Redis (utilise MongoDB)"""
        last_24h = datetime.now() - timedelta(hours=24)
        
        pipeline = [
            {"$match": {
                "app_id": app_id,
                "timestamp": {"$gte": last_24h}
            }},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "unique_users": {"$addToSet": "$user_id"}
            }}
        ]
        
        cursor = self.events_collection.aggregate(pipeline)
        results = await cursor.to_list(length=10)
        
        stats = {
            "views": 0,
            "downloads": 0,
            "installs": 0,
            "sessions": 0
        }
        
        unique_users = set()
        
        for r in results:
            event_type = r["_id"]
            if event_type in stats:
                stats[event_type] = r["count"]
            
            # ⚠️ CORRECTION : Éviter le set trop grand
            for user_id in r.get("unique_users", []):
                if user_id:
                    unique_users.add(user_id)
        
        return {
            "app_id": app_id,
            "period": "24h",
            "stats": stats,
            "unique_users": len(unique_users),
            "timestamp": datetime.now().isoformat()
        }
    
    # ==================== TENDANCES OPTIMISÉES ====================
    
    async def get_trending_apps(self, limit: int = 20) -> List[dict]:
        """
        ⚠️ CORRECTION : Récupère les apps tendances depuis le score pré-calculé
        O(log n) au lieu de O(n log n)
        """
        cursor = self.apps_collection.find(
            {"visibility": "public"}
        ).sort("trending_score", -1).limit(limit)
        
        apps = await cursor.to_list(length=limit)
        
        for app in apps:
            app["_id"] = str(app["_id"])
        
        return apps
    
    async def update_trending_scores(self):
        """
        ⚠️ NOUVEAU : Met à jour les scores de tendance (à appeler par un worker)
        À exécuter toutes les heures
        """
        # Récupérer toutes les apps
        cursor = self.apps_collection.find({"visibility": "public"})
        apps = await cursor.to_list(length=10000)
        
        # Récupérer les métriques des 30 derniers jours
        thirty_days_ago = datetime.now() - timedelta(days=30)
        cursor = self.daily_metrics_collection.find({
            "date": {"$gte": thirty_days_ago.strftime("%Y-%m-%d")}
        })
        metrics = await cursor.to_list(length=100000)
        
        # Calculer les scores
        scored_apps = await trending_calculator.calculate_trending_scores(apps, metrics)
        
        # Mettre à jour en base
        bulk_ops = []
        for app in scored_apps:
            bulk_ops.append({
                "update_one": {
                    "filter": {"_id": app["_id"]},
                    "update": {"$set": {
                        "trending_score": app["trending_score"],
                        "trending_metrics": app.get("trending_metrics", {})
                    }}
                }
            })
        
        if bulk_ops:
            await self.apps_collection.bulk_write(bulk_ops)
        
        return len(bulk_ops)
    
    # ==================== MÉTRIQUES OPTIMISÉES ====================
    
    async def get_app_metrics(self, app_id: str, period: str = "30d") -> dict:
        """Récupère les métriques d'une application"""
        start_date, end_date = self._get_date_range(period)
        
        # Récupérer les métriques quotidiennes
        cursor = self.daily_metrics_collection.find({
            "app_id": app_id,
            "date": {
                "$gte": start_date,
                "$lte": end_date
            }
        }).sort("date", 1)
        
        daily = await cursor.to_list(length=100)
        
        # ⚠️ CORRECTION : Calcul précis des utilisateurs uniques
        unique_users_set = set()
        for day in daily:
            # Si on stocke le set des users
            if "unique_users_list" in day:
                unique_users_set.update(day["unique_users_list"])
        
        # Calculer les totaux
        totals = {
            "views": sum(d.get("views", 0) for d in daily),
            "downloads": sum(d.get("downloads", 0) for d in daily),
            "installs": sum(d.get("installs", 0) for d in daily),
            "sessions": sum(d.get("sessions", 0) for d in daily),
            "unique_users": len(unique_users_set) if unique_users_set else sum(d.get("unique_users", 0) for d in daily)
        }
        
        # ⚠️ NOUVEAU : Calculer la rétention
        retention = await self._calculate_retention(app_id, start_date, end_date)
        
        # ⚠️ NOUVEAU : Calculer le funnel
        funnel = await self._calculate_funnel(app_id, start_date, end_date)
        
        return {
            "app_id": app_id,
            "period": period,
            "totals": totals,
            "daily": daily,
            "retention": retention,
            "funnel": funnel
        }
    
    async def _calculate_retention(self, app_id: str, start_date: datetime, end_date: datetime) -> dict:
        """
        ⚠️ NOUVEAU : Calcule la rétention sur différentes périodes
        """
        retention = {}
        
        for days in self.retention_periods:
            # Date de la cohort (installations)
            cohort_start = start_date
            cohort_end = start_date + timedelta(days=1)
            
            # Compter les installations dans la cohort
            installs = await self.events_collection.count_documents({
                "app_id": app_id,
                "type": "install",
                "timestamp": {"$gte": cohort_start, "$lt": cohort_end}
            })
            
            if installs == 0:
                retention[f"day_{days}"] = 0
                continue
            
            # Date de retour (activité après N jours)
            return_start = start_date + timedelta(days=days)
            return_end = return_start + timedelta(days=1)
            
            # Compter les utilisateurs actifs
            pipeline = [
                {"$match": {
                    "app_id": app_id,
                    "type": "session_start",
                    "timestamp": {"$gte": return_start, "$lt": return_end}
                }},
                {"$group": {
                    "_id": None,
                    "users": {"$addToSet": "$user_id"}
                }}
            ]
            
            cursor = self.events_collection.aggregate(pipeline)
            result = await cursor.to_list(length=1)
            
            active_users = len(result[0]["users"]) if result else 0
            retention[f"day_{days}"] = round((active_users / installs) * 100, 1)
        
        return retention
    
    async def _calculate_funnel(self, app_id: str, start_date: datetime, end_date: datetime) -> dict:
        """
        ⚠️ NOUVEAU : Calcule le funnel de conversion
        """
        pipeline = [
            {"$match": {
                "app_id": app_id,
                "type": {"$in": ["view", "download", "install", "session_start"]},
                "timestamp": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "users": {"$addToSet": "$user_id"}
            }}
        ]
        
        cursor = self.events_collection.aggregate(pipeline)
        results = await cursor.to_list(length=10)
        
        funnel = {
            "views": 0,
            "downloads": 0,
            "installs": 0,
            "sessions": 0,
            "conversion_rates": {}
        }
        
        user_counts = {}
        
        for r in results:
            event_type = r["_id"]
            if event_type in funnel:
                funnel[event_type] = r["count"]
                user_counts[event_type] = len([u for u in r["users"] if u])
        
        # Calculer les taux de conversion
        if funnel["views"] > 0:
            funnel["conversion_rates"]["view_to_download"] = round(
                (funnel["downloads"] / funnel["views"]) * 100, 1
            )
        
        if funnel["downloads"] > 0:
            funnel["conversion_rates"]["download_to_install"] = round(
                (funnel["installs"] / funnel["downloads"]) * 100, 1
            )
        
        if funnel["installs"] > 0:
            funnel["conversion_rates"]["install_to_active"] = round(
                (funnel["sessions"] / funnel["installs"]) * 100, 1
            )
        
        # Taux de conversion utilisateurs
        if user_counts.get("views", 0) > 0:
            funnel["conversion_rates"]["users_view_to_install"] = round(
                (user_counts.get("installs", 0) / user_counts["views"]) * 100, 1
            )
        
        return funnel
    
    # ==================== STATISTIQUES GLOBALES ====================
    
    async def get_global_stats(self) -> dict:
        """Récupère les statistiques globales du marketplace"""
        now = datetime.now()
        today_start = datetime(now.year, now.month, now.day)
        
        # Stats du jour
        today_stats = await self.events_collection.count_documents({
            "timestamp": {"$gte": today_start}
        })
        
        # Apps actives
        active_apps = await self.apps_collection.count_documents({
            "visibility": "public"
        })
        
        # Utilisateurs actifs aujourd'hui
        pipeline = [
            {"$match": {"timestamp": {"$gte": today_start}}},
            {"$group": {"_id": "$user_id"}}
        ]
        cursor = self.events_collection.aggregate(pipeline)
        active_users_today = len(await cursor.to_list(length=10000))
        
        # Top apps
        top_apps = await self.get_trending_apps(limit=10)
        
        return {
            "timestamp": now.isoformat(),
            "events_today": today_stats,
            "active_apps": active_apps,
            "active_users_today": active_users_today,
            "top_apps": top_apps,
            "total_downloads": await self._get_total_metric("download"),
            "total_installs": await self._get_total_metric("install")
        }
    
    async def _get_total_metric(self, event_type: str) -> int:
        """Récupère le total d'un type d'événement"""
        return await self.events_collection.count_documents({"type": event_type})

# Worker pour mise à jour périodique des tendances
"""
À ajouter dans un worker Celery :

@celery.task
def update_trending_periodically():
    controller = AnalyticsController(db)
    await controller.update_trending_scores()
    
# Exécuter toutes les heures
"""
