"""
Controller IA pour le marketplace applications
Version PRO avec corrections et améliorations
- Cache des analyses
- Vrai calcul de rétention
- Scoring des suggestions (impact/effort/confidence)
- Détection automatique
- Clustering des reviews
- Vote system avec déduplication
"""

from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
from typing import List, Optional, Dict, Set
import hashlib
import json
import math
from collections import defaultdict

# Redis pour cache
import redis.asyncio as redis
import os

# Services
from services.marketplace_app import ai_integration

class AIController:
    """Contrôleur pour les fonctionnalités IA optimisé"""
    
    def __init__(self, db):
        self.db = db
        self.apps_collection = db["marketplace_apps"]
        self.suggestions_collection = db["ai_suggestions"]
        self.events_collection = db["analytics_events"]
        self.reviews_collection = db["marketplace_reviews"]
        self.votes_collection = db["suggestion_votes"]  # ⚠️ NOUVEAU
        
        # Redis pour cache
        self.redis = None
        self._init_redis()
        
        # Configuration
        self.analysis_cache_ttl = 43200  # 12h
        self.auto_analysis_thresholds = {
            "crash_rate": 5.0,      # > 5%
            "retention_day7": 20.0,  # < 20%
            "negative_reviews": 10,   # > 10 mauvaises reviews
            "rating_drop": 0.5       # Baisse de note > 0.5
        }
    
    def _init_redis(self):
        """Initialise Redis pour cache"""
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            self.redis = redis.from_url(redis_url, decode_responses=True)
        except:
            print("Redis not available, using memory cache")
            self.redis = None
    
    # ==================== UTILITAIRES ====================
    
    def _safe_object_id(self, id_str: str):
        """⚠️ CORRECTION : Conversion sécurisée en ObjectId"""
        try:
            return ObjectId(id_str)
        except InvalidId:
            return None
    
    def _get_cache_key(self, prefix: str, app_id: str) -> str:
        """Génère une clé Redis"""
        return f"ai:{prefix}:{app_id}"
    
    # ==================== ANALYSE AVEC CACHE ====================
    
    async def analyze_app(self, app_id: str, user_id: str = None, force: bool = False) -> dict:
        """
        Analyse une application et génère des suggestions d'amélioration
        ⚠️ CORRECTION : Avec cache pour éviter les appels IA inutiles
        """
        try:
            obj_id = self._safe_object_id(app_id)
            if not obj_id:
                return {"success": False, "error": "ID invalide"}
            
            # 1. Vérifier le cache (sauf si force=True)
            if not force and self.redis:
                cache_key = self._get_cache_key("analysis", app_id)
                cached = await self.redis.get(cache_key)
                if cached:
                    return {
                        "success": True,
                        "cached": True,
                        "suggestions": json.loads(cached)
                    }
            
            # 2. Récupérer l'app
            app = await self.apps_collection.find_one({"_id": obj_id})
            if not app:
                return {"success": False, "error": "Application non trouvée"}
            
            # 3. Récupérer les analytics enrichis
            analytics = await self._get_app_analytics(app_id)
            
            # 4. Récupérer le contexte enrichi
            context = await self._get_analysis_context(app_id)
            
            # 5. Générer les suggestions
            suggestions = await ai_integration.analyze_app(
                app_data=app,
                analytics=analytics,
                context=context
            )
            
            # 6. Sauvegarder les suggestions
            saved_ids = []
            for sugg in suggestions:
                # Calculer le score de priorité
                sugg["priority_score"] = self._calculate_priority_score(sugg)
                sugg["app_id"] = app_id
                sugg["generated_by"] = user_id
                
                result = await self.suggestions_collection.insert_one(sugg)
                saved_ids.append(str(result.inserted_id))
            
            # 7. Mettre en cache
            if self.redis and suggestions:
                await self.redis.setex(
                    cache_key,
                    self.analysis_cache_ttl,
                    json.dumps(suggestions)
                )
            
            return {
                "success": True,
                "cached": False,
                "suggestions": suggestions,
                "saved_ids": saved_ids,
                "count": len(suggestions)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _calculate_priority_score(self, suggestion: dict) -> float:
        """
        ⚠️ NOUVEAU : Calcule le score de priorité
        priority = impact * confidence / effort
        """
        impact_map = {"high": 3, "medium": 2, "low": 1}
        effort_map = {"high": 1, "medium": 2, "low": 3}
        
        impact = impact_map.get(suggestion.get("impact", "medium"), 2)
        effort = effort_map.get(suggestion.get("effort", "medium"), 2)
        confidence = suggestion.get("confidence", 0.5)
        
        if effort == 0:
            return 0
        
        return round((impact * confidence) / effort, 2)
    
    # ==================== ANALYTICS ENRICHIS ====================
    
    async def _get_app_analytics(self, app_id: str) -> dict:
        """Récupère les analytics enrichis pour l'analyse IA"""
        now = datetime.now()
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)
        
        # ⚠️ CORRECTION : Pipeline unique pour toutes les métriques
        pipeline = [
            {"$match": {
                "app_id": app_id,
                "timestamp": {"$gte": thirty_days_ago}
            }},
            {"$facet": {
                "by_type": [
                    {"$group": {
                        "_id": "$type",
                        "count": {"$sum": 1},
                        "users": {"$addToSet": "$user_id"}
                    }}
                ],
                "daily": [
                    {"$group": {
                        "_id": {
                            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                            "type": "$type"
                        },
                        "count": {"$sum": 1}
                    }},
                    {"$sort": {"_id.date": -1}}
                ],
                "install_cohort": [
                    {"$match": {"type": "install"}},
                    {"$group": {
                        "_id": {
                            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}}
                        },
                        "users": {"$addToSet": "$user_id"}
                    }}
                ]
            }}
        ]
        
        cursor = self.events_collection.aggregate(pipeline)
        result = await cursor.to_list(length=1)
        result = result[0] if result else {}
        
        # Organiser les résultats
        analytics = {
            "views": 0,
            "downloads": 0,
            "installs": 0,
            "sessions": 0,
            "crashes": 0,
            "unique_users": set(),
            "daily_trend": {}
        }
        
        # Traiter by_type
        for item in result.get("by_type", []):
            event_type = item["_id"]
            if event_type in analytics:
                analytics[event_type] = item["count"]
            for user in item.get("users", []):
                if user:
                    analytics["unique_users"].add(user)
        
        # Traiter daily
        for item in result.get("daily", []):
            date = item["_id"]["date"]
            if date not in analytics["daily_trend"]:
                analytics["daily_trend"][date] = {}
            analytics["daily_trend"][date][item["_id"]["type"]] = item["count"]
        
        # ⚠️ CORRECTION : Vrai calcul de rétention
        retention = await self._calculate_true_retention(app_id)
        analytics["retention"] = retention
        
        # Détecter les problèmes
        issues = []
        
        # Crash rate
        sessions = analytics.get("sessions", 0)
        crashes = analytics.get("crashes", 0)
        if sessions > 0:
            crash_rate = (crashes / sessions) * 100
            analytics["crash_rate"] = round(crash_rate, 1)
            if crash_rate > self.auto_analysis_thresholds["crash_rate"]:
                issues.append({
                    "type": "crash",
                    "severity": "high",
                    "value": crash_rate,
                    "description": f"High crash rate: {crash_rate:.1f}%"
                })
        
        # Retention
        if retention.get("day7", 0) < self.auto_analysis_thresholds["retention_day7"]:
            issues.append({
                "type": "retention",
                "severity": "high",
                "value": retention["day7"],
                "description": f"Low retention: {retention['day7']}% at day 7"
            })
        
        analytics["issues"] = issues
        analytics["unique_users"] = len(analytics["unique_users"])
        
        return analytics
    
    async def _calculate_true_retention(self, app_id: str) -> dict:
        """
        ⚠️ CORRECTION : Vrai calcul de rétention (cohort analysis)
        """
        now = datetime.now()
        retention = {"day1": 0, "day7": 0, "day30": 0}
        
        # Pour chaque période, trouver une cohort d'installations
        for days, key in [(1, "day1"), (7, "day7"), (30, "day30")]:
            cohort_start = now - timedelta(days=days + 1)
            cohort_end = now - timedelta(days=days)
            
            # Compter les installations dans la cohort
            installs = await self.events_collection.count_documents({
                "app_id": app_id,
                "type": "install",
                "timestamp": {"$gte": cohort_start, "$lt": cohort_end}
            })
            
            if installs == 0:
                continue
            
            # Compter les utilisateurs actifs aujourd'hui
            active_users = await self.events_collection.count_documents({
                "app_id": app_id,
                "type": "session_start",
                "user_id": {"$ne": None},
                "timestamp": {"$gte": now - timedelta(days=1)}
            })
            
            # Récupérer les utilisateurs uniques de la cohort
            pipeline = [
                {"$match": {
                    "app_id": app_id,
                    "type": "install",
                    "timestamp": {"$gte": cohort_start, "$lt": cohort_end}
                }},
                {"$group": {"_id": "$user_id"}}
            ]
            
            cursor = self.events_collection.aggregate(pipeline)
            cohort_users = await cursor.to_list(length=10000)
            cohort_count = len(cohort_users)
            
            if cohort_count > 0:
                # Compter combien sont revenus
                returned = await self.events_collection.count_documents({
                    "app_id": app_id,
                    "user_id": {"$in": [u["_id"] for u in cohort_users]},
                    "timestamp": {"$gte": now - timedelta(days=1)}
                })
                
                retention[key] = round((returned / cohort_count) * 100, 1)
        
        return retention
    
    async def _get_analysis_context(self, app_id: str) -> dict:
        """
        Récupère le contexte pour l'analyse IA
        ⚠️ OPTIMISÉ : Pipeline unique
        """
        context = {}
        
        # Pipeline pour les reviews et les crashes
        pipeline = [
            {"$facet": {
                "negative_reviews": [
                    {"$match": {
                        "app_id": app_id,
                        "rating": {"$lte": 2},
                        "status": "approved"
                    }},
                    {"$sort": {"created_at": -1}},
                    {"$limit": 10},
                    {"$project": {
                        "rating": 1,
                        "comment": {"$substr": ["$comment", 0, 200]},
                        "created_at": 1
                    }}
                ],
                "recent_crashes": [
                    {"$match": {
                        "app_id": app_id,
                        "type": "crash",
                        "timestamp": {"$gte": datetime.now() - timedelta(days=3)}
                    }},
                    {"$sort": {"timestamp": -1}},
                    {"$limit": 10},
                    {"$project": {
                        "message": {"$substr": ["$data.message", 0, 100]},
                        "timestamp": 1
                    }}
                ]
            }}
        ]
        
        cursor = self.events_collection.aggregate(pipeline)
        result = await cursor.to_list(length=1)
        
        if result:
            context["negative_reviews"] = result[0].get("negative_reviews", [])
            context["recent_crashes"] = result[0].get("recent_crashes", [])
        
        # ⚠️ NOUVEAU : Clustering simple des reviews
        if context["negative_reviews"]:
            context["review_clusters"] = self._cluster_reviews(context["negative_reviews"])
        
        return context
    
    def _cluster_reviews(self, reviews: List[dict]) -> dict:
        """
        ⚠️ NOUVEAU : Clustering simple des reviews par mots-clés
        """
        clusters = defaultdict(list)
        keywords = {
            "login": ["login", "sign in", "authenticate", "account"],
            "performance": ["slow", "lag", "freeze", "crash", "loading"],
            "ui": ["ui", "design", "interface", "layout", "button"],
            "bug": ["bug", "error", "issue", "problem", "broken"],
            "feature": ["feature", "missing", "add", "need"]
        }
        
        for review in reviews:
            comment = review.get("comment", "").lower()
            assigned = False
            
            for cluster, words in keywords.items():
                if any(word in comment for word in words):
                    clusters[cluster].append(review)
                    assigned = True
                    break
            
            if not assigned:
                clusters["other"].append(review)
        
        # Compter par cluster
        return {
            cluster: {
                "count": len(items),
                "examples": [r["comment"] for r in items[:2]]
            }
            for cluster, items in clusters.items()
            if items
        }
    
    # ==================== AUTO-ANALYSIS ====================
    
    async def check_auto_analysis(self, app_id: str) -> dict:
        """
        ⚠️ NOUVEAU : Vérifie si une analyse automatique est nécessaire
        """
        analytics = await self._get_app_analytics(app_id)
        
        reasons = []
        
        # Vérifier les seuils
        if analytics.get("crash_rate", 0) > self.auto_analysis_thresholds["crash_rate"]:
            reasons.append("high_crash_rate")
        
        if analytics.get("retention", {}).get("day7", 100) < self.auto_analysis_thresholds["retention_day7"]:
            reasons.append("low_retention")
        
        # Vérifier les reviews négatives
        negative_count = await self.reviews_collection.count_documents({
            "app_id": app_id,
            "rating": {"$lte": 2},
            "created_at": {"$gte": datetime.now() - timedelta(days=7)}
        })
        
        if negative_count > self.auto_analysis_thresholds["negative_reviews"]:
            reasons.append("negative_reviews_surge")
        
        return {
            "needs_analysis": len(reasons) > 0,
            "reasons": reasons,
            "analytics": {
                "crash_rate": analytics.get("crash_rate", 0),
                "retention_day7": analytics.get("retention", {}).get("day7", 0),
                "negative_reviews_7d": negative_count
            }
        }
    
    # ==================== GESTION DES SUGGESTIONS ====================
    
    async def get_app_suggestions(
        self, 
        app_id: str, 
        status: str = None,
        page: int = 1,
        limit: int = 20
    ) -> dict:
        """Récupère les suggestions pour une application"""
        obj_id = self._safe_object_id(app_id)
        if not obj_id:
            return {"success": False, "error": "ID invalide"}
        
        query = {"app_id": app_id}
        if status:
            query["status"] = status
        
        skip = (page - 1) * limit
        cursor = self.suggestions_collection.find(query)
        cursor = cursor.sort("priority_score", -1).skip(skip).limit(limit)
        
        suggestions = await cursor.to_list(length=limit)
        total = await self.suggestions_collection.count_documents(query)
        
        # Ajouter les votes
        for s in suggestions:
            s["_id"] = str(s["_id"])
            s["votes"] = await self._get_suggestion_votes(str(s["_id"]))
        
        return {
            "suggestions": suggestions,
            "total": total,
            "page": page,
            "limit": limit
        }
    
    async def _get_suggestion_votes(self, suggestion_id: str) -> dict:
        """Récupère les votes pour une suggestion"""
        up = await self.votes_collection.count_documents({
            "suggestion_id": suggestion_id,
            "vote_type": "up"
        })
        down = await self.votes_collection.count_documents({
            "suggestion_id": suggestion_id,
            "vote_type": "down"
        })
        
        return {"up": up, "down": down}
    
    async def vote_suggestion(self, suggestion_id: str, user_id: str, vote_type: str) -> dict:
        """
        ⚠️ CORRECTION : Vote avec déduplication
        """
        if vote_type not in ["up", "down"]:
            return {"success": False, "error": "Type de vote invalide"}
        
        obj_id = self._safe_object_id(suggestion_id)
        if not obj_id:
            return {"success": False, "error": "ID invalide"}
        
        # Vérifier si l'utilisateur a déjà voté
        existing = await self.votes_collection.find_one({
            "suggestion_id": suggestion_id,
            "user_id": user_id
        })
        
        if existing:
            if existing["vote_type"] == vote_type:
                # Annuler le vote
                await self.votes_collection.delete_one({"_id": existing["_id"]})
                return {"success": True, "message": "Vote removed"}
            else:
                # Changer le vote
                await self.votes_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"vote_type": vote_type}}
                )
                return {"success": True, "message": "Vote changed"}
        
        # Nouveau vote
        await self.votes_collection.insert_one({
            "suggestion_id": suggestion_id,
            "user_id": user_id,
            "vote_type": vote_type,
            "created_at": datetime.utcnow()
        })
        
        return {"success": True, "message": f"Vote {vote_type} enregistré"}
    
    async def update_suggestion_status(self, suggestion_id: str, status: str, user_id: str = None) -> dict:
           """
        Met à jour le statut d'une suggestion
        """
        obj_id = self._safe_object_id(suggestion_id)
        if not obj_id:
            return {"success": False, "error": "ID invalide"}
        
        allowed_status = ["accepted", "in_progress", "applied", "rejected"]
        if status not in allowed_status:
            return {"success": False, "error": "Statut invalide"}
        
        update = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if status == "applied":
            update["applied_at"] = datetime.utcnow()
            update["applied_by"] = user_id
        
        result = await self.suggestions_collection.update_one(
            {"_id": obj_id},
            {"$set": update}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Suggestion non trouvée"}
        
        return {"success": True, "message": f"Suggestion {status}"}
    
    # ==================== STATISTIQUES ====================
    
    async def get_ai_stats(self, app_id: str = None) -> dict:
        """Récupère les statistiques de l'IA"""
        query = {}
        if app_id:
            query["app_id"] = app_id
        
        # Compter par statut
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.suggestions_collection.aggregate(pipeline)
        stats = await cursor.to_list(length=10)
        
        status_counts = {s["_id"]: s["count"] for s in stats}
        
        # Score moyen par type
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$type",
                "avg_priority": {"$avg": "$priority_score"},
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.suggestions_collection.aggregate(pipeline)
        type_stats = await cursor.to_list(length=10)
        
        return {
            "total": sum(status_counts.values()),
            "by_status": status_counts,
            "by_type": {
                t["_id"]: {
                    "count": t["count"],
                    "avg_priority": round(t["avg_priority"], 2)
                }
                for t in type_stats
            }
        }

# Worker pour analyse automatique
"""
@celery.task
def auto_analyze_apps():
    controller = AIController(db)
    
    # Récupérer les apps récentes
    apps = await controller.apps_collection.find({
        "created_at": {"$gte": datetime.now() - timedelta(days=7)}
    }).to_list(length=100)
    
    for app in apps:
        check = await controller.check_auto_analysis(str(app["_id"]))
        if check["needs_analysis"]:
            await controller.analyze_app(str(app["_id"]), auto=True)
    
# Exécuter toutes les 6 heures
"""
