"""
Moteur de recommandation pour le marketplace applications
Version PRO avec corrections et optimisations
- Cold start handling
- Collaborative filtering
- Diversification
- Exploration vs exploitation
- Vector similarity (embeddings ready)
"""

import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
from collections import defaultdict
import numpy as np

class RecommendationEngine:
    """Génère des recommandations personnalisées"""
    
    def __init__(self):
        self.user_preferences_cache = {}
        self.similarity_cache = {}
        self.collaborative_matrix = {}  # user_id -> {app_id -> score}
        
        # Poids pour le scoring
        self.weights = {
            "category": 3.0,
            "tags": 2.0,
            "popularity": 1.5,
            "recency": 1.0,
            "rating": 2.0,
            "collaborative": 2.5,
            "diversity": 0.8
        }
        
        # Seuils
        self.exploration_rate = 0.1  # 10% d'exploration
        self.max_per_category = 3     # Max 3 apps par catégorie
    
    # ==================== UTILITAIRES ====================
    
    def _normalize_preferences(self, preferences: Dict) -> Dict:
        """⚠️ CORRECTION : Normalisation par somme totale"""
        result = preferences.copy()
        
        # Normaliser les catégories
        if preferences["categories"]:
            total = sum(preferences["categories"].values())
            if total > 0:
                result["categories"] = {
                    cat: val / total 
                    for cat, val in preferences["categories"].items()
                }
        
        # Normaliser les tags
        if preferences["tags"]:
            total = sum(preferences["tags"].values())
            if total > 0:
                result["tags"] = {
                    tag: val / total 
                    for tag, val in preferences["tags"].items()
                }
        
        return result
    
    def _get_candidate_pool(self, all_apps: List[Dict], limit: int = 500) -> List[Dict]:
        """
        ⚠️ CORRECTION : Filtrage pour performance
        Garde seulement les apps candidates pour le scoring
        """
        # Trier par popularité
        scored = []
        for app in all_apps:
            stats = app.get("stats", {})
            score = stats.get("downloads", 0) + stats.get("installs", 0) * 2
            scored.append((app, score))
        
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Garder le top N
        return [app for app, _ in scored[:limit]]
    
    # ==================== ANALYSE DES PRÉFÉRENCES ====================
    
    def _analyze_preferences(self, history: Dict) -> Dict:
        """Analyse les préférences d'un utilisateur"""
        preferences = {
            "categories": defaultdict(float),
            "tags": defaultdict(float),
            "average_rating": 0.0,
            "total_interactions": 0,
            "interacted_apps": set(),
            "installed_apps": set(),
            "downloaded_apps": set()
        }
        
        # Poids selon le type d'interaction
        weights = {
            "download": 3.0,
            "install": 4.0,
            "view": 1.0,
            "fork": 2.5,
            "review": 2.0,
            "rating": 2.0
        }
        
        # Analyser les installations (poids très fort)
        for item in history.get("installs", []):
            category = item.get("category")
            tags = item.get("tags", [])
            
            if category:
                preferences["categories"][category] += weights["install"]
            
            for tag in tags:
                preferences["tags"][tag] += weights["install"]
            
            preferences["interacted_apps"].add(item.get("id"))
            preferences["installed_apps"].add(item.get("id"))
            preferences["total_interactions"] += 1
        
        # Analyser les téléchargements
        for item in history.get("downloads", []):
            category = item.get("category")
            tags = item.get("tags", [])
            
            if category and category not in preferences["installed_apps"]:
                preferences["categories"][category] += weights["download"]
            
            for tag in tags:
                preferences["tags"][tag] += weights["download"]
            
            preferences["interacted_apps"].add(item.get("id"))
            preferences["downloaded_apps"].add(item.get("id"))
            preferences["total_interactions"] += 1
        
        # Analyser les vues
        for item in history.get("views", []):
            category = item.get("category")
            
            if category and category not in preferences["interacted_apps"]:
                preferences["categories"][category] += weights["view"] * 0.5
            
            preferences["interacted_apps"].add(item.get("id"))
            preferences["total_interactions"] += 1
        
        # Analyser les forks
        for item in history.get("forks", []):
            category = item.get("category")
            
            if category:
                preferences["categories"][category] += weights["fork"]
            
            preferences["interacted_apps"].add(item.get("id"))
            preferences["total_interactions"] += 1
        
        # Analyser les reviews/ratings
        ratings_sum = 0
        ratings_count = 0
        
        for item in history.get("reviews", []):
            rating = item.get("rating", 0)
            if rating > 0:
                ratings_sum += rating
                ratings_count += 1
                
                category = item.get("category")
                if category:
                    preferences["categories"][category] += weights["review"] * (rating / 5)
        
        if ratings_count > 0:
            preferences["average_rating"] = ratings_sum / ratings_count
        
        return self._normalize_preferences(preferences)
    
    # ==================== COLLABORATIVE FILTERING ====================
    
    def _build_collaborative_matrix(self, all_users_history: List[Dict]):
        """
        Construit la matrice collaborative
        users who installed X also installed Y
        """
        self.collaborative_matrix = {}
        
        # Compter les co-installations
        co_install = defaultdict(lambda: defaultdict(int))
        
        for user_history in all_users_history:
            installed = set(user_history.get("installs", []))
            
            for app1 in installed:
                for app2 in installed:
                    if app1 != app2:
                        co_install[app1][app2] += 1
        
        # Normaliser
        for app1 in co_install:
            total = sum(co_install[app1].values())
            if total > 0:
                self.collaborative_matrix[app1] = {
                    app2: count / total
                    for app2, count in co_install[app1].items()
                }
    
    def _get_collaborative_score(self, app_id: str, user_history: Dict) -> float:
        """
        Calcule le score collaboratif basé sur les installations similaires
        """
        if not self.collaborative_matrix:
            return 0
        
        installed = user_history.get("installs", [])
        if not installed:
            return 0
        
        score = 0
        count = 0
        
        for installed_app in installed:
            if installed_app in self.collaborative_matrix:
                if app_id in self.collaborative_matrix[installed_app]:
                    score += self.collaborative_matrix[installed_app][app_id]
                    count += 1
        
        if count == 0:
            return 0
        
        return score / count
    
    # ==================== CONTENT-BASED SCORING ====================
    
    def _calculate_recommendation_score(
        self, 
        app: Dict, 
        preferences: Dict, 
        user_history: Dict,
        already_recommended: Set[str]
    ) -> float:
        """Calcule le score de recommandation pour une app"""
        app_id = app.get("id")
        
        # Ne pas recommander les apps déjà interagies
        if app_id in preferences["interacted_apps"]:
            return 0
        
        # Limite par catégorie
        category = app.get("category", "other")
        category_count = sum(1 for a in already_recommended if a.get("category") == category)
        if category_count >= self.max_per_category:
            return 0
        
        score = 0.0
        
        # Similarité de catégorie
        app_category = app.get("category")
        if app_category in preferences["categories"]:
            score += preferences["categories"][app_category] * self.weights["category"]
        
        # Similarité de tags
        app_tags = app.get("tags", [])
        tag_score = 0
        for tag in app_tags:
            if tag in preferences["tags"]:
                tag_score += preferences["tags"][tag]
        
        if app_tags:
            tag_score /= len(app_tags)  # Normaliser
            score += tag_score * self.weights["tags"]
        
        # Popularité
        stats = app.get("stats", {})
        downloads = stats.get("downloads", 0)
        installs = stats.get("installs", 0)
        
        popularity = math.log1p(downloads + installs * 2)
        score += popularity * self.weights["popularity"] * 0.1
        
        # Récence
        created_at = app.get("createdAt")
        if created_at:
            if isinstance(created_at, str):
                # ⚠️ CORRECTION : Import datetime
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            age_days = (datetime.now() - created_at).days
            recency = math.exp(-age_days / 60)  # Decay sur 60 jours
            score += recency * self.weights["recency"]
        
        # Note
        rating = stats.get("rating", 0)
        reviews = stats.get("reviewsCount", 0)
        
        if reviews > 0:
            # Bayesian rating
            bayesian_rating = (reviews * rating + 5 * 4.0) / (reviews + 5)
            score += bayesian_rating * self.weights["rating"] * 0.5
        
        # ⚠️ NOUVEAU : Score collaboratif
        collab_score = self._get_collaborative_score(app_id, user_history)
        score += collab_score * self.weights["collaborative"]
        
        # Bonus si note élevée
        if rating >= 4.5 and reviews >= 10:
            score += 5
        
        return round(score, 2)
    
    # ==================== API PUBLIQUE ====================
    
    async def get_recommendations(
        self, 
        user_id: str, 
        apps: List[Dict], 
        user_history: Dict,
        trending_apps: List[Dict] = None,
        all_users_history: List[Dict] = None
    ) -> List[Dict]:
        """
        Génère des recommandations personnalisées
        Gère le cold start et l'exploration
        """
        # ⚠️ CORRECTION : Cold start
        if not user_history or user_history.get("total_interactions", 0) == 0:
            # Fallback sur les tendances
            return (trending_apps or [])[:20]
        
        # Construire la matrice collaborative si disponible
        if all_users_history and not self.collaborative_matrix:
            self._build_collaborative_matrix(all_users_history)
        
        # Analyser les préférences
        preferences = self._analyze_preferences(user_history)
        
        # ⚠️ CORRECTION : Filtrer pour performance
        candidate_apps = self._get_candidate_pool(apps, limit=500)
        
        # Calculer les scores
        scored_apps = []
        already_recommended = set()
        
        for app in candidate_apps:
            score = self._calculate_recommendation_score(
                app, preferences, user_history, already_recommended
            )
            
            if score > 0:
                scored_apps.append({
                    **app,
                    "recommendation_score": score
                })
                already_recommended.add(app.get("id"))
        
        # Trier par score
        scored_apps.sort(key=lambda x: x["recommendation_score"], reverse=True)
        
        # ⚠️ NOUVEAU : Exploration vs exploitation
        final_recommendations = []
        exploration_count = int(len(scored_apps) * self.exploration_rate)
        
        # Exploitation (top scores)
        exploitation = scored_apps[:len(scored_apps) - exploration_count]
        final_recommendations.extend(exploitation)
        
        # Exploration (random parmi les moins bien notés)
        if exploration_count > 0 and trending_apps:
            exploration = random.sample(
                trending_apps[:50], 
                min(exploration_count, len(trending_apps))
            )
            final_recommendations.extend(exploration)
        
        return final_recommendations[:20]  # Top 20 final
    
    async def get_similar_apps(
        self, 
        target_app: Dict, 
        all_apps: List[Dict], 
        limit: int = 10
    ) -> List[Dict]:
        """Trouve des applications similaires"""
        similar = []
        
        for app in all_apps:
            if app.get("id") == target_app.get("id"):
                continue
            
            similarity = self._calculate_similarity(target_app, app)
            if similarity > 0.3:
                similar.append({
                    **app,
                    "similarity_score": similarity
                })
        
        # Trier par similarité
        similar.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        return similar[:limit]
    
    def _calculate_similarity(self, app1: Dict, app2: Dict) -> float:
        """Calcule la similarité entre deux apps"""
        score = 0.0
        
        # Même catégorie
        if app1.get("category") == app2.get("category"):
            score += 0.4
        
        # Tags communs
        tags1 = set(app1.get("tags", []))
        tags2 = set(app2.get("tags", []))
        
        if tags1 and tags2:
            intersection = len(tags1.intersection(tags2))
            union = len(tags1.union(tags2))
            
            if union > 0:
                jaccard = intersection / union
                score += jaccard * 0.3
        
        # Popularité similaire
        stats1 = app1.get("stats", {})
        stats2 = app2.get("stats", {})
        
        pop1 = stats1.get("downloads", 0) + stats1.get("installs", 0) * 2
        pop2 = stats2.get("downloads", 0) + stats2.get("installs", 0) * 2
        
        if pop1 > 0 and pop2 > 0:
            ratio = min(pop1, pop2) / max(pop1, pop2)
            score += ratio * 0.2
        
        # ⚠️ NOUVEAU : Similarité de note
        rating1 = stats1.get("rating", 0)
        rating2 = stats2.get("rating", 0)
        
        if rating1 > 0 and rating2 > 0:
            rating_diff = abs(rating1 - rating2) / 5
            score += (1 - rating_diff) * 0.1
        
        return round(score, 2)

# Instance unique
recommendation_engine = RecommendationEngine()
