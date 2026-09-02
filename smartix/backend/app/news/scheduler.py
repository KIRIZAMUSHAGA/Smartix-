from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_MISSED
from apscheduler.jobstores.mongodb import MongoDBJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from app.aggregator.aggregator import run_once_sync
from app.config import FETCH_INTERVAL_MINUTES, update_config
from app.db_mongo import client
import logging
import sys
import atexit
from datetime import datetime, timedelta
from typing import Dict, Optional
import time

logger = logging.getLogger(__name__)
_scheduler = None

# ========== MONITORING ==========
class SchedulerMonitor:
    """Monitor pour suivre l'état du scheduler"""
    
    def __init__(self):
        self.last_run: Optional[datetime] = None
        self.last_success: Optional[datetime] = None
        self.last_error: Optional[datetime] = None
        self.error_count = 0
        self.success_count = 0
        self.total_runs = 0
        self.last_duration: Optional[float] = None
        self.current_start: Optional[float] = None
        self.history = []  # Garder un historique des dernières exécutions
        
    def job_started(self):
        self.total_runs += 1
        self.last_run = datetime.utcnow()
        self.current_start = time.time()
        logger.info(f"📊 Job #{self.total_runs} démarré")
        
    def job_completed(self, articles_added: int):
        self.last_success = datetime.utcnow()
        self.success_count += 1
        if self.current_start:
            self.last_duration = time.time() - self.current_start
        
        # Ajouter à l'historique
        self.history.append({
            "timestamp": self.last_success,
            "duration": self.last_duration,
            "articles": articles_added,
            "success": True
        })
        
        # Garder seulement les 100 dernières entrées
        if len(self.history) > 100:
            self.history = self.history[-100:]
        
        logger.info(f"✅ Job #{self.total_runs} terminé: {articles_added} articles, {self.last_duration:.1f}s")
        
    def job_failed(self, error: str):
        self.last_error = datetime.utcnow()
        self.error_count += 1
        
        self.history.append({
            "timestamp": self.last_error,
            "error": error,
            "success": False
        })
        
        if len(self.history) > 100:
            self.history = self.history[-100:]
        
        logger.error(f"❌ Job #{self.total_runs} échoué: {error}")
        
    def get_status(self) -> Dict:
        success_rate = (self.success_count / self.total_runs * 100) if self.total_runs > 0 else 0
        
        # Calculer moyenne des durées
        durations = [h.get("duration") for h in self.history if h.get("duration")]
        avg_duration = sum(durations) / len(durations) if durations else None
        
        return {
            "is_running": self.current_start is not None,
            "total_runs": self.total_runs,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "success_rate": round(success_rate, 2),
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "last_error": self.last_error.isoformat() if self.last_error else None,
            "last_duration": self.last_duration,
            "avg_duration": avg_duration,
            "recent_history": self.history[-10:]  # 10 dernières exécutions
        }

monitor = SchedulerMonitor()

# ========== JOB AVEC GESTION D'ERREURS ==========
def job_with_error_handling():
    """Wrapper avec gestion d'erreurs pour le job"""
    monitor.job_started()
    try:
        logger.info("🚀 Démarrage du job d'agrégation")
        result = run_once_sync()
        monitor.job_completed(result if result else 0)
        return result
    except Exception as e:
        monitor.job_failed(str(e))
        # On pourrait envoyer une alerte ici
        logger.critical(f"🔥 Échec critique du job: {e}", exc_info=True)
        raise

# ========== LISTENER D'ÉVÉNEMENTS ==========
def job_listener(event):
    """Écoute les événements du scheduler"""
    if event.exception:
        logger.error(f"❌ Job {event.job_id} a échoué: {event.exception}")
        monitor.job_failed(str(event.exception))
    elif event.code == EVENT_JOB_MISSED:
        logger.warning(f"⚠️ Job {event.job_id} manqué (surcharge possible)")

# ========== CRÉATION DU SCHEDULER ==========
def create_scheduler(persistent: bool = True) -> BackgroundScheduler:
    """Crée un scheduler avec ou sans persistance"""
    
    if persistent:
        # Configuration avec persistance MongoDB
        jobstores = {
            'default': MongoDBJobStore(
                database='smartclips',
                collection='scheduler_jobs',
                client=client
            )
        }
        logger.info("📦 Scheduler avec persistance MongoDB")
    else:
        jobstores = {}  # APScheduler utilise le store mémoire par défaut
        logger.info("💾 Scheduler en mémoire")
    
    executors = {
        'default': ThreadPoolExecutor(20)
    }
    
    job_defaults = {
        'coalesce': True,          # Fusionner les jobs manqués
        'max_instances': 1,        # Une seule instance à la fois
        'misfire_grace_time': 60,  # Tolérance de 60 secondes
        'replace_existing': True    # Remplacer si existe déjà
    }
    
    scheduler = BackgroundScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone='UTC'
    )
    
    # Ajouter listener
    scheduler.add_listener(job_listener, EVENT_JOB_ERROR | EVENT_JOB_MISSED)
    
    return scheduler

# ========== DÉMARRAGE ==========
def start_scheduler(persistent: bool = True):
    """Démarre le scheduler avec gestion complète"""
    
    global _scheduler
    if _scheduler and _scheduler.running:
        logger.info("Scheduler déjà en cours d'exécution")
        return _scheduler
    
    try:
        # Créer le scheduler
        scheduler = create_scheduler(persistent)
        
        # Intervalle par défaut: 10 minutes
        interval = FETCH_INTERVAL_MINUTES if FETCH_INTERVAL_MINUTES else 10
        
        # Ajouter le job périodique
        scheduler.add_job(
            job_with_error_handling,
            'interval',
            minutes=interval,
            id="news_fetcher",
            max_instances=1,
            replace_existing=True,
            next_run_time=datetime.now()  # Démarrer immédiatement
        )
        
        # Démarrer
        scheduler.start()
        logger.info(f"✅ Scheduler démarré, intervalle: {interval} minutes")
        
        # Enregistrer l'arrêt automatique
        atexit.register(shutdown_scheduler)
        
        _scheduler = scheduler
        return scheduler
        
    except Exception as e:
        logger.error(f"❌ Erreur démarrage scheduler: {e}")
        return None

# ========== ARRÊT ==========
def shutdown_scheduler(wait: bool = True):
    """Arrête le scheduler proprement"""
    
    global _scheduler
    if not _scheduler:
        logger.info("Aucun scheduler à arrêter")
        return
    
    try:
        logger.info("🛑 Arrêt du scheduler...")
        _scheduler.shutdown(wait=wait)
        logger.info("✅ Scheduler arrêté")
    except Exception as e:
        logger.error(f"❌ Erreur arrêt scheduler: {e}")
    finally:
        _scheduler = None

# ========== GESTION DYNAMIQUE ==========
def update_scheduler_interval(minutes: int) -> bool:
    """Change l'intervalle d'exécution dynamiquement"""
    
    global _scheduler
    if not _scheduler or not _scheduler.running:
        logger.error("Scheduler non démarré")
        return False
    
    try:
        # Valider l'entrée
        if minutes < 1 or minutes > 1440:  # Entre 1 minute et 24 heures
            logger.error(f"Intervalle invalide: {minutes}")
            return False
        
        # Rescheduler le job
        _scheduler.reschedule_job(
            "news_fetcher",
            trigger='interval',
            minutes=minutes
        )
        
        # Mettre à jour la config
        update_config("FETCH_INTERVAL_MINUTES", minutes)
        
        logger.info(f"✅ Intervalle mis à jour: {minutes} minutes")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur mise à jour intervalle: {e}")
        return False

def pause_scheduler() -> bool:
    """Pause le scheduler"""
    
    global _scheduler
    if not _scheduler:
        return False
    
    try:
        _scheduler.pause_job("news_fetcher")
        logger.info("⏸️ Scheduler en pause")
        return True
    except Exception as e:
        logger.error(f"❌ Erreur pause: {e}")
        return False

def resume_scheduler() -> bool:
    """Reprend le scheduler"""
    
    global _scheduler
    if not _scheduler:
        return False
    
    try:
        _scheduler.resume_job("news_fetcher")
        logger.info("▶️ Scheduler repris")
        return True
    except Exception as e:
        logger.error(f"❌ Erreur reprise: {e}")
        return False

def run_once_now() -> bool:
    """Exécute le job immédiatement (une fois)"""
    
    global _scheduler
    if not _scheduler:
        return False
    
    try:
        _scheduler.add_job(
            job_with_error_handling,
            'date',  # Maintenant
            id="news_fetcher_manual",
            replace_existing=True
        )
        logger.info("⚡ Job manuel déclenché")
        return True
    except Exception as e:
        logger.error(f"❌ Erreur déclenchement manuel: {e}")
        return False

# ========== STATUT ==========
def get_scheduler_status() -> Dict:
    """Retourne le statut complet du scheduler"""
    
    global _scheduler
    
    status = monitor.get_status()
    status.update({
        "scheduler_running": _scheduler.running if _scheduler else False,
        "scheduler_persistent": isinstance(_scheduler.jobstores.get('default'), MongoDBJobStore) if _scheduler else False,
        "current_interval": FETCH_INTERVAL_MINUTES,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    if _scheduler:
        # Récupérer les jobs
        jobs = _scheduler.get_jobs()
        status["jobs"] = [
            {
                "id": job.id,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "pending": job.pending
            }
            for job in jobs
        ]
    
    return status

# ========== INITIALISATION ==========
# Si ce fichier est exécuté directement
if __name__ == "__main__":
    # Configuration du logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Démarrer le scheduler
    scheduler = start_scheduler(persistent=True)
    
    # Garder le script en vie
    try:
        import time
        while True:
            time.sleep(60)
            # Afficher le statut toutes les minutes
            status = get_scheduler_status()
            logger.info(f"📊 Statut: {status['total_runs']} exécutions, {status['success_rate']}% succès")
    except KeyboardInterrupt:
        shutdown_scheduler()
