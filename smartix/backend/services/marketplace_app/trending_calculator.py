"""
Service de calcul des tendances pour le marketplace applications
Version PRO avec corrections et optimisations
- Utilisation des DailyMetrics pré-agrégées
- Score logarithmique
- Velocity (tendance horaire)
- Anti-gaming
- Cache intelligent
"""

import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from collections import defaultdict
import time

class TrendingCalculator:
    """Calcule les applications tendances du marketplace"""
    
    def __init__(self):
        self.trending_cache = {}
        self.cache_ttl = 300  # 5 minutes
        self.last_cache_update = {}
        
        # Types d'événements autorisés
        self.allowed_metrics = {
            "views", "downloads", "installs", "sessions", 
            "reviews", "forks", "unique_users"
        }
        
        # Poids pour le score (avec log scale)
        self.weights = {
            "views": 0.1,
            "downloads": 0.5,      # Log scale
            "installs": 1.0,        # Log scale
            "sessions": 0.3,        # Log scale
            "forks": 0.4,           # Log scale
            "rating": 1.5,
            "reviews": 0.3,         # Log scale
            "velocity": 2.0,         # Tendance récente
            "conversion": 1.2,       # installs/downloads
            "uniqueness": 0.8        # unique_users / total
        }
    
    # ==================== UTILITAIRES ====================
    
    def _get_cache_key(self, prefix: str, *parts) -> str:
        """Génère une clé de cache"""
        return f"{prefix}:{':'.join(str(p) for p in parts)}"
    
    def _log_scale(self, value: float, base: float = 10) -> float:
        """Applique une échelle logarithmique pour éviter l'écrasement"""
        return math.log1p(value) / math.log1p(base)
    
    # ==================== MÉTRIQUES DE BASE ====================
    
    def _calculate_base_score(self, app: Dict, metrics: Dict) -> float:
        """
        Calcule le score de base à partir des métriques agrégées
        Utilise l'échelle logarithmique
        """
        score = 0.0
        
        # Métriques avec log scale
        views = metrics.get("views", 0)
        downloads = metrics.get("downloads", 0)
        installs = metrics.get("installs", 0)
        sessions = metrics.get("sessions", 0)
        forks = metrics.get("forks", 0)
        reviews = metrics.get("reviews", 0)
        
        score += self._log_scale(views) * self.weights["views"]
        score += self._log_scale(downloads) * self.weights["downloads"]
        score += self._log_scale(installs) * self.weights["installs"]
        score += self._log_scale(sessions) * self.weights["sessions"]
        score += self._log_scale(forks) * self.weights["forks"]
        score += self._log_scale(reviews) * self.weights["reviews"]
        
        return score
    
    def _calculate_rating_score(self, app: Dict) -> float:
        """
        Calcule le score basé sur les notes (Bayesian rating)
        Évite le biais des apps avec peu de reviews mais 5 étoiles
        """
        app_stats = app.get("stats", {})
        rating = app_stats.get("rating", 0)
        reviews_count = app_stats.get("reviewsCount", 0)
        
        if reviews_count == 0:
            return 0
        
        # Bayesian rating: (v/(v+m))*R + (m/(v+m))*C
        # v = nombre de reviews
        # R = rating moyen
        # m = seuil minimum (5)
        # C = rating moyen global (4.0)
        v = reviews_count
        R = rating
        m = 5
        C = 4.0
        
        bayesian_rating = (v/(v+m))*R + (m/(v+m))*C
        
        return bayesian_rating * self.weights["rating"]
    
    def _calculate_conversion_score(self, metrics: Dict) -> float:
        """
        Calcule le score basé sur le taux de conversion
        installs / downloads = qualité de l'app
        """
        downloads = metrics.get("downloads", 0)
        installs = metrics.get("installs", 0)
        
        if downloads == 0:
            return 0
        
        conversion_rate = installs / downloads
        
        # Bonus si bon taux de conversion, malus si mauvais
        return (conversion_rate - 0.5) * self.weights["conversion"]
    
    def _calculate_uniqueness_score(self, metrics: Dict) -> float:
        """
        Calcule le score basé sur l'unicité des utilisateurs
        unique_users / installs = qualité réelle
        Anti-gaming : si beaucoup d'installs mais peu d'utilisateurs uniques
        """
        installs = metrics.get("installs", 0)
        unique_users = metrics.get("unique_users", 0)
        
        if installs == 0:
            return 0
        
        uniqueness_ratio = unique_users / installs
        return uniqueness_ratio * self.weights["uniqueness"]
    
    # ==================== VELOCITY (TENDANCE) ====================
    
    def _calculate_velocity(self, daily_metrics: List[Dict]) -> float:
        """
        Calcule la vélocité (tendance sur les dernières 24h)
        Compare les dernières 24h avec les 7 jours précédents
        """
        if len(daily_metrics) < 2:
            return 0
        
        now = datetime.now()
        one_day_ago = now - timedelta(days=1)
        seven_days_ago = now - timedelta(days=7)
        
        # Dernières 24h
        last_24h_installs = 0
        for day in daily_metrics:
            day_date = datetime.strptime(day.get("date", ""), "%Y-%m-%d")
            if day_date >= one_day_ago:
                last_24h_installs += day.get("installs", 0)
        
        # 7 derniers jours (sans les dernières 24h)
        prev_7d_installs = 0
        days_count = 0
        for day in daily_metrics:
            day_date = datetime.strptime(day.get("date", ""), "%Y-%m-%d")
            if seven_days_ago <= day_date < one_day_ago:
                prev_7d_installs += day.get("installs", 0)
                days_count += 1
        
        if days_count == 0 or prev_7d_installs == 0:
            return 0
        
        # Moyenne des 7 jours précédents
        avg_prev = prev_7d_installs / days_count
        
        if avg_prev == 0:
            return 0
        
        # Ratio de croissance
        growth_ratio = last_24h_installs / avg_prev
        
        # Normaliser (max 3x)
        return min(growth_ratio, 3.0) * self.weights["velocity"]
    
    # ==================== CALCUL PRINCIPAL ====================
    
    async def calculate_trending_scores(self, apps: List[Dict], daily_metrics: List[Dict]) -> List[Dict]:
        """
        Calcule les scores de tendance à partir des métriques quotidiennes
        Version optimisée : utilise les données pré-agrégées
        """
        # Vérifier le cache
        cache_key = self._get_cache_key("trending", "global")
        cached = self.trending_cache.get(cache_key)
        
        if cached:
            cache_time = self.last_cache_update.get(cache_key, 0)
            if time.time() - cache_time < self.cache_ttl:
                return cached
        
        # Organiser les métriques par app
        metrics_by_app = defaultdict(lambda: {
            "views": 0,
            "downloads": 0,
            "installs": 0,
            "sessions": 0,
            "reviews": 0,
            "forks": 0,
            "unique_users": 0,
            "daily": []
        })
        
        for metric in daily_metrics:
            app_id = metric.get("appId")
            if not app_id:
                continue
            
            # Agréger les totaux
            metrics_by_app[app_id]["views"] += metric.get("views", 0)
            metrics_by_app[app_id]["downloads"] += metric.get("downloads", 0)
            metrics_by_app[app_id]["installs"] += metric.get("installs", 0)
            metrics_by_app[app_id]["sessions"] += metric.get("sessions", 0)
            metrics_by_app[app_id]["reviews"] += metric.get("reviews", 0)
            metrics_by_app[app_id]["forks"] += metric.get("forks", 0)
            metrics_by_app[app_id]["unique_users"] += metric.get("unique_users", 0)
            
            # Garder les données journalières pour la vélocité
            metrics_by_app[app_id]["daily"].append({
                "date": metric.get("date"),
                "installs": metric.get("installs", 0),
                "downloads": metric.get("downloads", 0),
                "views": metric.get("views", 0)
            })
        
        # Calculer les scores
        scored_apps = []
        for app in apps:
            app_id = app.get("id")
            metrics = metrics_by_app.get(app_id, {})
            
            if not metrics:
                # App sans métriques récentes
                scored_apps.append({
                    **app,
                    "trending_score": 0,
                    "trending_metrics": {}
                })
                continue
            
            # Calculer les différentes composantes
            base_score = self._calculate_base_score(app, metrics)
            rating_score = self._calculate_rating_score(app)
            conversion_score = self._calculate_conversion_score(metrics)
            uniqueness_score = self._calculate_uniqueness_score(metrics)
            velocity_score = self._calculate_velocity(metrics.get("daily", []))
            
            # Score total
            total_score = base_score + rating_score + conversion_score + uniqueness_score + velocity_score
            
            # Appliquer un facteur de récence
            created_at = app.get("createdAt")
            if created_at:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
                age_days = (datetime.now() - created_at).days
                if age_days > 30:
                    decay = math.exp(-age_days / 90)  # Decay exponentiel sur 90 jours
                    total_score *= decay
            
            scored_apps.append({
                **app,
                "trending_score": round(total_score, 2),
                "trending_metrics": {
                    "views": metrics.get("views", 0),
                    "downloads": metrics.get("downloads", 0),
                    "installs": metrics.get("installs", 0),
                    "sessions": metrics.get("sessions", 0),
                    "unique_users": metrics.get("unique_users", 0),
                    "velocity": round(velocity_score, 2),
                    "conversion_rate": round(metrics.get("installs", 0) / max(metrics.get("downloads", 0), 1), 2)
                }
            })
        
        # Trier par score
        scored_apps.sort(key=lambda x: x["trending_score"], reverse=True)
        
        # Mettre en cache
        self.trending_cache[cache_key] = scored_apps
        self.last_cache_update[cache_key] = time.time()
        
        return scored_apps
    
    # ==================== CATÉGORIES SPÉCIFIQUES ====================
    
    async def get_trending_by_category(self, scored_apps: List[Dict]) -> Dict:
        """Regroupe les tendances par catégorie"""
        by_category = defaultdict(list)
        
        for app in scored_apps:
            category = app.get("category", "other")
            by_category[category].append(app)
        
        # Trier chaque catégorie
        for category in by_category:
            by_category[category].sort(key=lambda x: x["trending_score"], reverse=True)
            by_category[category] = by_category[category][:20]  # Top 20 par catégorie
        
        return dict(by_category)
    
    async def get_rising_apps(self, scored_apps: List[Dict]) -> List[Dict]:
        """
        Récupère les apps en forte croissance (rising)
        Basé sur la vélocité (installs récents)
        """
        rising_apps = []
        
        for app in scored_apps:
            velocity = app.get("trending_metrics", {}).get("velocity", 0)
            
            if velocity > 1.5:  # Croissance > 50%
                rising_apps.append({
                    **app,
                    "rising_score": velocity
                })
        
        # Trier par vélocité
        rising_apps.sort(key=lambda x: x["rising_score"], reverse=True)
        
        return rising_apps[:20]  # Top 20 rising
    
    async def get_top_rated_apps(self, scored_apps: List[Dict], min_reviews: int = 10) -> List[Dict]:
        """
        Récupère les apps les mieux notées
        Avec minimum de reviews
        """
        top_rated = []
        
        for app in scored_apps:
            reviews_count = app.get("stats", {}).get("reviewsCount", 0)
            if reviews_count >= min_reviews:
                top_rated.append(app)
        
        # Trier par note
        top_rated.sort(key=lambda x: x.get("stats", {}).get("rating", 0), reverse=True)
        
        return top_rated[:20]
    
    async def get_new_apps(self, apps: List[Dict], max_days: int = 7) -> List[Dict]:
        """
        Récupère les apps récentes (moins de 7 jours)
        """
        cutoff = datetime.now() - timedelta(days=max_days)
        new_apps = []
        
        for app in apps:
            created_at = app.get("createdAt")
            if created_at:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
                if created_at > cutoff:
                    new_apps.append(app)
        
        # Trier par date
        new_apps.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        
        return new_apps[:20]
    
    # ==================== MAINTENANCE ====================
    
    def clear_cache(self):
        """Vide le cache"""
        self.trending_cache.clear()
        self.last_cache_update.clear()
    
    def get_cache_stats(self) -> Dict:
        """Retourne les statistiques du cache"""
        return {
            "size": len(self.trending_cache),
            "keys": list(self.trending_cache.keys()),
            "oldest": min(self.last_cache_update.values()) if self.last_cache_update else None
        }

# Instance unique
trending_calculator = TrendingCalculator()
