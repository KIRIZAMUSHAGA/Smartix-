"""
Services pour le marketplace des applications
Point d'entrée unique pour tous les services du marketplace apps

Ce module expose les services suivants :
- spam_detector : Détection de spam pour les avis
- trending_calculator : Calcul des tendances et scores
- recommendation_engine : Moteur de recommandations personnalisées
- ai_integration : Suggestions d'amélioration par IA
"""

from .spam_detector import spam_detector
from .trending_calculator import trending_calculator
from .recommendation_engine import recommendation_engine
from .ai_integration import ai_integration

__all__ = [
    # Services principaux
    "spam_detector",
    "trending_calculator", 
    "recommendation_engine",
    "ai_integration",
]

# Version du module services
__version__ = "1.0.0"

# Documentation rapide
SERVICES_DOC = {
    "spam_detector": "Détection de spam pour les avis (basé sur contenu + comportement)",
    "trending_calculator": "Calcul des tendances avec score logarithmique et vélocité",
    "recommendation_engine": "Recommandations personnalisées (content-based + collaboratif)",
    "ai_integration": "Suggestions d'amélioration par IA avec cache et scoring"
}

def get_service_info():
    """Retourne les informations sur les services disponibles"""
    return {
        "version": __version__,
        "services": list(__all__),
        "documentation": SERVICES_DOC,
        "status": "active"
    }

# Fonction utilitaire pour tester la connexion aux services
async def health_check() -> dict:
    """
    Vérifie l'état de santé de tous les services
    Utile pour le monitoring
    """
    results = {}
    
    # Vérifier spam_detector
    try:
        test_result = await spam_detector.analyze({
            "text": "Test message",
            "title": "Test",
            "userId": "test_user"
        })
        results["spam_detector"] = {
            "status": "ok",
            "message": "Service responsive"
        }
    except Exception as e:
        results["spam_detector"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Vérifier trending_calculator
    try:
        # Juste vérifier que le cache fonctionne
        trending_calculator.clear_cache()
        results["trending_calculator"] = {
            "status": "ok",
            "cache_size": len(trending_calculator.trending_cache)
        }
    except Exception as e:
        results["trending_calculator"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Vérifier recommendation_engine
    try:
        results["recommendation_engine"] = {
            "status": "ok",
            "collaborative_matrix_size": len(recommendation_engine.collaborative_matrix)
        }
    except Exception as e:
        results["recommendation_engine"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Vérifier ai_integration
    try:
        results["ai_integration"] = {
            "status": "ok",
            "api_key_configured": bool(ai_integration.api_key),
            "cache_type": "redis" if ai_integration.redis_client else "memory"
        }
    except Exception as e:
        results["ai_integration"] = {
            "status": "error",
            "message": str(e)
        }
    
    return {
        "timestamp": datetime.now().isoformat(),
        "services": results,
        "all_ok": all(r.get("status") == "ok" for r in results.values())
    }

# Nettoyage des ressources à la fermeture
async def cleanup():
    """Nettoie les ressources (sessions, connexions)"""
    await ai_integration.close()
    # Autres nettoyages si nécessaire

# Export des fonctions utilitaires
__all__.extend(["get_service_info", "health_check", "cleanup"])
