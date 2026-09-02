import multiprocessing
import time
import logging
import asyncio
import os
import shutil
from datetime import datetime, timezone
from typing import Optional
from backend.jobs import JobManager
from backend.db import init_mongodb

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("WorkerPDF")

SAFE_THRESHOLD = 500 * 1024 * 1024  # 500MB

def check_disk_space():
    """Vérifie l'espace disque disponible."""
    try:
        free_space = shutil.disk_usage("/").free
        if free_space < SAFE_THRESHOLD:
            logger.error(f"Espace disque insuffisant: {free_space // (1024*1024)}MB libres (requis: {SAFE_THRESHOLD // (1024*1024)}MB)")
            return False
        return True
    except Exception as e:
        logger.error(f"Erreur lors de la vérification de l'espace disque: {e}")
        return False

def process_pdf_task(product_id: str, job_id: str):
    """
    Fonction exécutée dans un processus séparé pour le traitement PDF.
    """
    # On crée une nouvelle boucle d'événement pour le processus séparé
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        return loop.run_until_complete(_async_process_pdf_task(product_id, job_id))
    finally:
        loop.close()

async def _async_process_pdf_task(product_id: str, job_id: str):
    try:
        logger.info(f"[Job {job_id}] Début du traitement pour le produit {product_id}")
        
        # Importation différée
        from backend.utils.pdf_handler import generate_pdf_preview_and_thumbnails, get_pdf_info
        from backend.repositories.marketplace_repository import MarketplaceRepository
        from backend.db import init_mongodb
        
        # Initialisation de la DB dans le nouveau processus
        await init_mongodb()
        
        repo = MarketplaceRepository()
        product = await repo.get_product_by_id(product_id)
        
        if not product or not product.get("pdf_file"):
            logger.error(f"[Job {job_id}] Produit ou fichier PDF introuvable")
            return False

        selected_pages = product.get("preview_pages_indices", [1, 2, 3])
        pdf_path = product["pdf_file"].lstrip("/")
        
        logger.info(f"[Job {job_id}] Traitement réel du PDF: {pdf_path}")
        
        # Exécution du traitement (synchrone dans le worker car pdf_handler l'est)
        preview_url, thumb_urls = generate_pdf_preview_and_thumbnails(
            pdf_path, 
            selected_pages, 
            product_id
        )
        
        if preview_url:
            pdf_info = get_pdf_info(pdf_path)
            total_pages = pdf_info.get("total_pages", 0)
            
            update_data = {
                "preview_file": preview_url,
                "preview_thumbs": thumb_urls,
                "total_pages": total_pages,
                "status": "preview_ready",
                "preview_ready": True,  # Cohérence produit
                "updated_at": datetime.now(timezone.utc)
            }
            await repo.update_product(product_id, update_data)
            logger.info(f"[Job {job_id}] Traitement PDF terminé avec succès et produit synchronisé")
            return True
        else:
            logger.error(f"[Job {job_id}] Échec de la génération de la preview")
            # Cohérence produit en cas d'échec
            from backend.repositories.marketplace_repository import MarketplaceRepository
            repo = MarketplaceRepository()
            await repo.update_product(product_id, {"preview_ready": False, "updated_at": datetime.now(timezone.utc)})
            return False
    except Exception as e:
        logger.error(f"[Job {job_id}] Erreur critique: {str(e)}")
        # Cohérence produit en cas d'exception
        try:
            from backend.repositories.marketplace_repository import MarketplaceRepository
            repo = MarketplaceRepository()
            await repo.update_product(product_id, {"preview_ready": False, "updated_at": datetime.now(timezone.utc)})
        except:
            pass
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        # 4. Nettoyage systématique des fichiers temporaires (Logique à implémenter dans pdf_handler si possible, 
        # mais ici on s'assure que le process enfant finit proprement)
        pass

async def run_worker_loop():
    """
    Boucle principale du worker.
    Récupère les jobs queued, les admet, et les lance dans des processus isolés.
    """
    logger.info("Démarrage du Worker PDF...")
    await init_mongodb()
    
    # 1. Recovery post-crash
    recovered = await JobManager.recover_orphaned_jobs()
    if recovered > 0:
        logger.info(f"Recovery: {recovered} jobs orphelins remis en file d'attente.")

    while True:
        try:
            # 2. Protection disque proactive
            if not check_disk_space():
                await asyncio.sleep(60) # Attendre plus longtemps si disque plein
                continue

            # Tenter d'admettre un job (Contrôle d'admission via DB + atomique)
            job = await JobManager.try_admit_job()
            
            if job:
                # Re-vérification critique de l'espace disque juste avant le fork
                if not check_disk_space():
                    logger.warning(f"Admission annulée pour le job {job.id} : espace disque devenu insuffisant.")
                    await JobManager.update_job_status(job.id, "failed", error_message="Insufficient disk space before processing")
                    continue

                logger.info(f"Job {job.id} admis (Tentative {job.retries}/{job.max_retries}). Lancement du processus isolé...")
                
                # Création du processus multiprocessing
                p = multiprocessing.Process(
                    target=process_pdf_task, 
                    args=(job.product_id, job.id)
                )
                p.start()
                
                # Surveillance du processus avec timeout (hard limit)
                # On utilise un thread de surveillance ou on attend de manière non-bloquante
                # Ici on fait une attente asynchrone pour ne pas bloquer la boucle du worker
                timeout = getattr(backend.worker, 'timeout', 60) # Utilise la globale si elle existe pour les tests
                start_time = time.time()
                
                while p.is_alive():
                    if time.time() - start_time > timeout:
                        logger.warning(f"[Job {job.id}] Timeout dépassé ({timeout}s). Termination du processus.")
                        p.terminate()
                        p.join(timeout=2)
                        
                        if p.is_alive():
                            logger.warning(f"[Job {job.id}] Processus toujours en vie après terminate(). Force kill (SIGKILL).")
                            p.kill()
                            p.join(timeout=1)
                            logger.info(f"[Job {job.id}] Process force killed (SIGKILL)")
                        else:
                            logger.info(f"[Job {job.id}] Process terminated")

                        await JobManager.update_job_status(
                            job.id, 
                            "failed", 
                            error_message=f"Timeout de traitement dépassé ({timeout}s)"
                        )
                        break
                    await asyncio.sleep(1)
                
                if not p.is_alive() and p.exitcode is not None:
                    if p.exitcode == 0:
                        await JobManager.update_job_status(job.id, "done")
                        logger.info(f"[Job {job.id}] Statut mis à jour: done")
                    else:
                        await JobManager.update_job_status(
                            job.id, 
                            "failed", 
                            error_message=f"Le processus s'est terminé avec le code {p.exitcode}"
                        )
                        logger.error(f"[Job {job.id}] Statut mis à jour: failed (Exit code: {p.exitcode})")
                
            else:
                # Pas de job ou limite atteinte, on attend un peu
                await asyncio.sleep(5)
                
        except Exception as e:
            logger.error(f"Erreur dans la boucle du worker: {str(e)}")
            await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(run_worker_loop())
