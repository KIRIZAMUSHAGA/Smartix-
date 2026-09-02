import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import os
import redis.asyncio as redis

# =============================
# IMPORTS EXISTANTS
# =============================
from app.db_mongo import init_indexes
from app.news.router import router as news_router
from app.news.router_admin import router as admin_router
from app.news.scheduler import start_scheduler
from routes.fcm_notifications import router as fcm_router

# =============================
# IMPORTS COURSES EXISTANTS
# =============================
from routes.courses import router as courses_router

# =============================
# IMPORTS MARKETPLACE APPLICATIONS
# =============================
from routes.marketplace_app import router as marketplace_app_router
from middleware.rate_limit import RateLimitMiddleware
from services.marketplace_app import ai_integration

# =============================
# 🆕 NOUVEAUX IMPORTS POUR L'EXPORT VIDÉO
# =============================
from routes.story_export import router as story_export_router
from utils.cleanup_exports import init_cleanup, get_cleanup_stats, run_scheduled_cleanup
from cache.redis_cache import redis_cache

# =============================
# 🆕 SPRINT 7 — Base de données, Cron, Storage, Env Vars
# =============================
from routes.database import router as database_router
from routes.cron import router as cron_router
from routes.storage import router as storage_router
from routes.env_vars import router as env_vars_router
from routes.logs import router as logs_router
from middleware.sandbox_log_middleware import SandboxLogMiddleware

# =============================
# CONFIGURATION
# =============================
app = FastAPI(
    title="SmartOHADA API",
    description="API complète incluant News, Courses, Marketplace Applications et Export Vidéo",
    version="2.1.0"
)

# Créer les dossiers nécessaires
os.makedirs("backend/uploads/courses", exist_ok=True)
os.makedirs("backend/uploads/apks", exist_ok=True)
os.makedirs("backend/uploads/temp", exist_ok=True)
os.makedirs("backend/exports", exist_ok=True)  # 🆕 Dossier pour les exports vidéo

# =============================
# FICHIERS STATIQUES
# =============================
app.mount("/uploads/courses", StaticFiles(directory="backend/uploads/courses"), name="course_covers")
app.mount("/uploads/apks", StaticFiles(directory="backend/uploads/apks"), name="apk_files")
app.mount("/exports", StaticFiles(directory="backend/exports"), name="video_exports")  # 🆕 Serveur les vidéos exportées

# =============================
# CORS
# =============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================
# RATE LIMITING MIDDLEWARE
# =============================
app.add_middleware(RateLimitMiddleware)

# =============================
# 🆕 SPRINT 7 — Logs d'accès sandbox
# =============================
app.add_middleware(SandboxLogMiddleware)

# =============================
# INITIALISATION DES RESSOURCES
# =============================
@app.on_event("startup")
async def startup():
    """Initialisation au démarrage"""
    print("🚀 Démarrage de l'application...")
    
    # 1. Initialiser MongoDB (existant)
    await init_indexes()
    print("✅ MongoDB initialisé")
    
    # 2. Démarrer le scheduler news (existant)
    start_scheduler()
    print("✅ News scheduler démarré")
    
    # 3. Initialiser Redis pour cache et rate limiting
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        app.state.redis = await redis.from_url(redis_url, decode_responses=True)
        await app.state.redis.ping()
        
        # 🆕 Initialiser le cache Redis pour l'application
        redis_cache._client = app.state.redis
        print("✅ Redis connecté")
    except Exception as e:
        print(f"⚠️ Redis non disponible: {e}")
        app.state.redis = None
        redis_cache._client = None
    
    # 4. Vérifier la clé API IA
    if os.getenv('OPENAI_API_KEY'):
        print("✅ Clé API OpenAI configurée")
    else:
        print("⚠️ Clé API OpenAI non configurée (mode simulation)")
    
    # 5. Attacher la DB à l'état de l'application
    from app.db_mongo import get_db
    app.state.db = get_db()
    
    # 6. 🆕 Initialiser le nettoyage des exports
    try:
        exports_folder = os.getenv('EXPORTS_FOLDER', 'backend/exports')
        retention_seconds = int(os.getenv('EXPORT_RETENTION_SECONDS', 3600))
        max_disk_usage_mb = int(os.getenv('MAX_DISK_USAGE_MB', 10240))
        webhook_url = os.getenv('CLEANUP_WEBHOOK_URL')
        
        init_cleanup(
            exports_folder=exports_folder,
            retention_seconds=retention_seconds,
            max_disk_usage_mb=max_disk_usage_mb,
            webhook_url=webhook_url
        )
        print(f"✅ Export cleanup initialisé (rétention: {retention_seconds}s, disque max: {max_disk_usage_mb}MB)")
    except Exception as e:
        print(f"⚠️ Erreur initialisation cleanup: {e}")
    
    # 7. 🆕 Vérifier FFmpeg
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        version_line = result.stdout.decode().splitlines()[0][:100]
        print(f"✅ FFmpeg disponible: {version_line}")
    except Exception as e:
        print(f"⚠️ FFmpeg non disponible: {e}")

    # 8. 🆕 Sprint 7 — EnvManager (variables d'environnement par projet)
    try:
        from services.env_manager import env_manager
        env_manager.set_db(app.state.db)
        print("✅ EnvManager initialisé")
    except Exception as e:
        print(f"⚠️ EnvManager non disponible: {e}")

    # 8b. 🆕 Sprint 7 — RequestLogger (logs d'accès par projet)
    try:
        from services.request_logger import request_logger
        request_logger.set_db(app.state.db)
        request_logger.start()
        await request_logger.ensure_index()
        print("✅ RequestLogger démarré")
    except Exception as e:
        print(f"⚠️ RequestLogger non disponible: {e}")

    # 10. 🆕 Sprint 7 — PostgreSQL Provisioner
    try:
        from database.postgres_provisioner import PostgresProvisioner
        from database.db_manager import DatabaseManager
        provisioner = PostgresProvisioner()
        await provisioner.initialize()
        app.state.db_provisioner = provisioner
        app.state.db_manager = DatabaseManager(provisioner)
        print("✅ PostgreSQL Provisioner initialisé")
    except Exception as e:
        print(f"⚠️ PostgreSQL Provisioner non disponible: {e}")
        app.state.db_provisioner = None
        app.state.db_manager = None

    # 11. 🆕 Sprint 7 — Cron Manager
    try:
        from scheduler.cron_manager import CronManager
        cron_manager = CronManager()
        container_mgr = getattr(app.state, 'container_manager', None)
        cron_manager.start(container_manager=container_mgr)
        app.state.cron_manager = cron_manager
        print("✅ Cron Manager démarré")
    except Exception as e:
        print(f"⚠️ Cron Manager non disponible: {e}")
        app.state.cron_manager = None

    # 12. 🆕 Sprint 7 — S3 Storage
    try:
        from storage.s3_storage import S3Storage
        app.state.s3_storage = S3Storage()
        print("✅ S3 Storage initialisé")
    except Exception as e:
        print(f"⚠️ S3 Storage non disponible: {e}")
        app.state.s3_storage = None

    print("✅ Application prête!")

@app.on_event("shutdown")
async def shutdown():
    """Nettoyage à l'arrêt"""
    print("🛑 Arrêt de l'application...")

    # Fermer Redis
    if hasattr(app.state, 'redis') and app.state.redis:
        await app.state.redis.close()
        print("✅ Redis déconnecté")

    # Fermer la session IA
    await ai_integration.close()
    print("✅ Session IA fermée")

    # 🆕 Sprint 7 — Fermer les connexions PostgreSQL
    if hasattr(app.state, 'db_manager') and app.state.db_manager:
        await app.state.db_manager.close_all()
        print("✅ Connexions PostgreSQL fermées")

    # 🆕 Sprint 7 — Arrêter le Cron Manager
    if hasattr(app.state, 'cron_manager') and app.state.cron_manager:
        app.state.cron_manager.stop()
        print("✅ Cron Manager arrêté")

    # 🆕 Sprint 7 — Flush final des logs d'accès
    try:
        from services.request_logger import request_logger
        request_logger.stop()
        await request_logger._flush()
        print("✅ RequestLogger arrêté et flush final effectué")
    except Exception:
        pass

# =============================
# ROUTES EXISTANTES
# =============================
app.include_router(news_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(fcm_router)

# =============================
# ROUTES MARKETPLACE APPLICATIONS
# =============================
app.include_router(
    marketplace_app_router,
    prefix="/api",
    tags=["Marketplace Applications"]
)

# =============================
# 🆕 ROUTES D'EXPORT VIDÉO
# =============================
app.include_router(
    story_export_router,
    prefix="/api",
    tags=["Story Export"]
)

# =============================
# 🆕 SPRINT 7 — Base de données, Cron, Storage
# =============================
app.include_router(database_router, tags=["Database"])
app.include_router(cron_router, tags=["Cron Jobs"])
app.include_router(storage_router, tags=["Asset Storage"])
app.include_router(env_vars_router, tags=["Env Variables"])
app.include_router(logs_router, tags=["Access Logs"])

# =============================
# HEALTH CHECK
# =============================
@app.get("/health")
async def health_check():
    """Endpoint de santé de l'API"""
    # 🆕 Vérifier FFmpeg
    ffmpeg_available = False
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        ffmpeg_available = result.returncode == 0
    except:
        pass
    
    # 🆕 Vérifier le dossier d'exports
    exports_folder = os.getenv('EXPORTS_FOLDER', 'backend/exports')
    exports_writable = os.access(exports_folder, os.W_OK) if os.path.exists(exports_folder) else False
    
    status = {
        "status": "healthy",
        "version": "2.1.0",
        "services": {
            "mongodb": "connected" if hasattr(app.state, 'db') else "pending",
            "redis": "connected" if hasattr(app.state, 'redis') and app.state.redis else "disconnected",
            "ai": "configured" if os.getenv('OPENAI_API_KEY') else "simulation",
            "ffmpeg": "available" if ffmpeg_available else "unavailable",
            "exports": {
                "folder": exports_folder,
                "writable": exports_writable
            },
            "postgresql": "ready" if getattr(app.state, 'db_provisioner', None) else "unavailable",
            "cron": "running" if getattr(app.state, 'cron_manager', None) else "unavailable",
            "s3_storage": "ready" if getattr(app.state, 's3_storage', None) else "unavailable",
            "request_logger": "running"
        }
    }
    return status

# =============================
# STATISTIQUES GLOBALES
# =============================
@app.get("/api/stats")
async def get_global_stats():
    """Statistiques globales de la plateforme"""
    from controllers.marketplace_app import AnalyticsController
    
    db = app.state.db
    controller = AnalyticsController(db)
    
    # Stats marketplace
    marketplace_stats = await controller.get_global_stats()
    
    # Stats courses (existant)
    courses_col = db['courses']
    total_courses = await courses_col.count_documents({})
    
    # Stats news (existant)
    news_col = db['news']
    total_news = await news_col.count_documents({})
    
    # 🆕 Stats exports vidéo
    exports_stats = {}
    try:
        exports_stats = await get_cleanup_stats()
    except Exception as e:
        exports_stats = {"error": str(e)}
    
    return {
        "platform": {
            "total_courses": total_courses,
            "total_news": total_news,
            **marketplace_stats
        },
        "video_exports": exports_stats
    }

# =============================
# 🆕 ENDPOINT DE NETTOYAGE MANUEL (ADMIN)
# =============================
@app.post("/api/admin/cleanup-exports")
async def admin_cleanup_exports(
    dry_run: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Endpoint admin pour déclencher le nettoyage des exports"""
    # Vérifier que l'utilisateur est admin
    if not current_user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    
    result = await run_scheduled_cleanup(dry_run=dry_run)
    return result

# =============================
# POINT D'ENTRÉE
# =============================
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
)
