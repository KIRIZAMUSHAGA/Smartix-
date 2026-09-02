"""
Controllers pour le marketplace des applications
Point d'entrée unique pour tous les contrôleurs du marketplace apps

Ce module expose les contrôleurs suivants :
- PublishController : Publication, avis, gestion des apps
- AnalyticsController : Métriques, tendances, stats temps réel
- RecommendationController : Recommandations personnalisées, apps similaires
- AIController : Suggestions IA, analyse automatique
"""

from .publish_controller import PublishController
from .analytics_controller import AnalyticsController
from .recommendation_controller import RecommendationController
from .ai_controller import AIController

__all__ = [
    # Contrôleurs principaux
    "PublishController",
    "AnalyticsController", 
    "RecommendationController",
    "AIController",
]

# Version du module controllers
__version__ = "1.0.0"

# Documentation rapide
CONTROLLERS_DOC = {
    "PublishController": "Publication d'apps, gestion des avis, recherche",
    "AnalyticsController": "Métriques temps réel, tendances, rétention, funnel",
    "RecommendationController": "Recommandations personnalisées, apps similaires",
    "AIController": "Suggestions IA, analyse automatique, scoring"
}

def get_controller_info():
    """Retourne les informations sur les contrôleurs disponibles"""
    return {
        "version": __version__,
        "controllers": list(__all__),
        "documentation": CONTROLLERS_DOC,
        "status": "active"
    }

# Fonction utilitaire pour créer une instance de tous les contrôleurs
def create_controllers(db):
    """
    Crée une instance de tous les contrôleurs avec la connexion DB
    
    Args:
        db: Connexion MongoDB
    
    Returns:
        dict: Dictionnaire des contrôleurs instanciés
    """
    return {
        "publish": PublishController(db),
        "analytics": AnalyticsController(db),
        "recommendation": RecommendationController(db),
        "ai": AIController(db)
    }

# Fonction de santé des contrôleurs
async def health_check(db) -> dict:
    """
    Vérifie l'état de santé de tous les contrôleurs
    Utile pour le monitoring
    """
    controllers = create_controllers(db)
    results = {}
    
    # Test PublishController
    try:
        # Vérifier la connexion DB via une simple requête
        await db.command("ping")
        results["publish"] = {
            "status": "ok",
            "message": "Database connection OK"
        }
    except Exception as e:
        results["publish"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Test AnalyticsController (vérifier que Redis est accessible)
    try:
        analytics = controllers["analytics"]
        if analytics.redis:
            await analytics.redis.ping()
            results["analytics"] = {
                "status": "ok",
                "redis": "connected"
            }
        else:
            results["analytics"] = {
                "status": "warning",
                "redis": "not configured"
            }
    except Exception as e:
        results["analytics"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Test RecommendationController
    try:
        results["recommendation"] = {
            "status": "ok",
            "cache_ready": bool(controllers["recommendation"].redis)
        }
    except Exception as e:
        results["recommendation"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Test AIController
    try:
        results["ai"] = {
            "status": "ok",
            "api_key_configured": bool(ai_integration.api_key),
            "cache_ready": bool(controllers["ai"].redis)
        }
    except Exception as e:
        results["ai"] = {
            "status": "error",
            "message": str(e)
        }
    
    # Statut global
    all_ok = all(r.get("status") == "ok" for r in results.values())
    
    return {
        "timestamp": datetime.now().isoformat(),
        "controllers": results,
        "all_ok": all_ok
    }

# Nettoyage des ressources
async def cleanup_controllers(controllers: dict):
    """
    Nettoie les ressources de tous les contrôleurs
    À appeler au shutdown de l'application
    """
    # Fermer les connexions Redis
    for name, controller in controllers.items():
        if hasattr(controller, 'redis') and controller.redis:
            await controller.redis.close()
            print(f"Redis connection closed for {name}")

# Export des fonctions utilitaires
__all__.extend([
    "get_controller_info", 
    "create_controllers", 
    "health_check", 
    "cleanup_controllers"
])
