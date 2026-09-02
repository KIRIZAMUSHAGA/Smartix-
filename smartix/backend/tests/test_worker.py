import asyncio
import unittest
import multiprocessing
import time
from backend.jobs import JobManager
from backend.db import init_mongodb, get_collection
from backend.worker import process_pdf_task, run_worker_loop

class TestWorker(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await init_mongodb()
        col = get_collection("marketplace_pdf_jobs")
        await col.delete_many({})
        JobManager.MAX_CONCURRENT_JOBS = 1

    async def test_worker_success(self):
        # 1. Créer un job
        job = await JobManager.create_job("test_prod_success")
        
        # 2. Lancer une version courte de la boucle ou simuler l'exécution
        # Pour le test on va mocker le temps de traitement ou appeler directement
        # mais on veut valider l'isolation.
        
        # On lance le worker en tâche de fond et on l'arrête après un moment
        worker_task = asyncio.create_task(run_worker_loop())
        
        # Attendre que le job soit traité (simulé à 5s dans worker.py)
        max_wait = 15
        start = time.time()
        success = False
        while time.time() - start < max_wait:
            col = get_collection("marketplace_pdf_jobs")
            updated_job = await col.find_one({"id": job.id})
            if updated_job and updated_job["status"] == "done":
                success = True
                break
            await asyncio.sleep(1)
        
        worker_task.cancel()
        self.assertTrue(success, "Le job devrait être marqué comme 'done'")

    async def test_worker_timeout_real(self):
        """
        Test de timeout réel :
        1. On simule un job long
        2. On réduit le timeout du worker à 1s
        3. On vérifie que le process est tué et le statut mis à jour en DB
        """
        from unittest.mock import patch
        import backend.worker
        
        # 1. Créer un job
        job = await JobManager.create_job("test_prod_timeout_real")
        
        # On définit une fonction qui simule un délai long
        def slow_gen(*args, **kwargs):
            import time
            time.sleep(10)
            return "preview.pdf", ["thumb.jpg"]
        
        # On mocke le timeout et le handler de PDF
        # On injecte la variable timeout directement dans le module worker
        with patch.object(backend.worker, 'timeout', 1, create=True), \
             patch("backend.utils.pdf_handler.generate_pdf_preview_and_thumbnails", side_effect=slow_gen):
            
            # Lancer le worker
            worker_task = asyncio.create_task(run_worker_loop())
            
            # Attendre la détection du timeout
            max_wait = 15
            start = time.time()
            timeout_detected = False
            
            while time.time() - start < max_wait:
                col = get_collection("marketplace_pdf_jobs")
                updated_job = await col.find_one({"id": job.id})
                if updated_job and updated_job["status"] == "failed":
                    if "timeout" in updated_job.get("error_message", "").lower():
                        timeout_detected = True
                        break
                await asyncio.sleep(1)
            
            worker_task.cancel()
            try:
                await worker_task
            except:
                pass
                
            self.assertTrue(timeout_detected, f"Le job devrait être marqué 'failed' avec une erreur de timeout.")

    async def test_retry_limited(self):
        """Vérifie que le job échoue définitivement après max_retries."""
        job = await JobManager.create_job("test_retry")
        col = get_collection("marketplace_pdf_jobs")
        
        # Simuler 3 tentatives échouées
        for i in range(3):
            admitted = await JobManager.try_admit_job()
            self.assertIsNotNone(admitted)
            await JobManager.update_job_status(job.id, "failed", error_message="Simulated failure")
        
        # 4ème tentative
        admitted = await JobManager.try_admit_job()
        self.assertIsNone(admitted, "Le job ne devrait pas être admis après avoir dépassé max_retries")
        
        updated_job = await col.find_one({"id": job.id})
        self.assertEqual(updated_job["status"], "failed")
        self.assertIn("Max retries exceeded", updated_job["error_message"])

    async def test_admission_atomic_concurrency(self):
        """Vérifie que active_jobs ne dépasse jamais la limite sous concurrence."""
        JobManager.MAX_CONCURRENT_JOBS = 2
        # Reset control doc
        control_col = get_collection("worker_control")
        await control_col.update_one({"_id": "global_control"}, {"$set": {"active_jobs": 0}})
        
        # Créer 5 jobs
        for i in range(5):
            await JobManager.create_job(f"prod_{i}")
        
        # Tenter 10 admissions en parallèle
        tasks = [JobManager.try_admit_job() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        
        admitted_jobs = [r for r in results if r is not None]
        self.assertLessEqual(len(admitted_jobs), 2, "Pas plus de 2 jobs ne devraient être admis")
        
        # Vérifier le compteur global
        doc = await control_col.find_one({"_id": "global_control"})
        self.assertEqual(doc["active_jobs"], len(admitted_jobs))

    async def test_recovery_timeout_real(self):
        """Vérifie que le recovery ne reprend que les jobs réellement bloqués."""
        col = get_collection("marketplace_pdf_jobs")
        from datetime import timedelta
        
        # 1. Job récent (ne pas recovery)
        job_recent = await JobManager.create_job("recent")
        await col.update_one({"id": job_recent.id}, {"$set": {
            "status": "processing", 
            "processing_started_at": datetime.now(timezone.utc),
            "retries": 1
        }})
        
        # 2. Job ancien (à recovery)
        job_old = await JobManager.create_job("old")
        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        await col.update_one({"id": job_old.id}, {"$set": {
            "status": "processing", 
            "processing_started_at": old_time,
            "retries": 1
        }})
        
        recovered = await JobManager.recover_orphaned_jobs()
        self.assertEqual(recovered, 1)
        
        # Vérifier statuts
        status_recent = await col.find_one({"id": job_recent.id})
        self.assertEqual(status_recent["status"], "processing")
        
        status_old = await col.find_one({"id": job_old.id})
        self.assertEqual(status_old["status"], "queued")
        self.assertIn("Recovered", status_old["error_message"])

    async def test_backoff_exponential(self):
        """Vérifie que le backoff est appliqué lors d'un échec."""
        job = await JobManager.create_job("backoff_test")
        
        # Admettre et faire échouer
        admitted = await JobManager.try_admit_job()
        await JobManager.update_job_status(job.id, "failed", error_message="Fail 1")
        
        col = get_collection("marketplace_pdf_jobs")
        updated_job = await col.find_one({"id": job.id})
        
        self.assertEqual(updated_job["status"], "queued")
        self.assertIsNotNone(updated_job.get("next_retry_at"))
        
        # Tenter admission immédiate (doit échouer car next_retry_at est dans le futur)
        admitted_again = await JobManager.try_admit_job()
        self.assertIsNone(admitted_again, "Le job ne devrait pas être réadmis avant le délai de backoff")

    async def test_recovery_max_retries(self):
        """Vérifie qu'un job orphelin avec retries max passe en failed."""
        col = get_collection("marketplace_pdf_jobs")
        job = await JobManager.create_job("orphan_max")
        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        await col.update_one({"id": job.id}, {"$set": {
            "status": "processing", 
            "processing_started_at": old_time,
            "retries": 3,
            "max_retries": 3
        }})
        
        await JobManager.recover_orphaned_jobs()
        updated_job = await col.find_one({"id": job.id})
        self.assertEqual(updated_job["status"], "failed")
        self.assertIn("Max retries exceeded", updated_job["error_message"])

    async def test_disk_protection(self):
        from unittest.mock import patch
        import backend.worker
        
        # Simuler espace faible
        with patch("shutil.disk_usage") as mock_usage:
            from collections import namedtuple
            usage = namedtuple('usage', 'total used free')
            mock_usage.return_value = usage(1000, 900, 100) # 100 bytes free
            
            self.assertFalse(backend.worker.check_disk_space())

    async def test_product_consistency_done(self):
        from unittest.mock import patch, MagicMock
        from backend.worker import _async_process_pdf_task
        
        product_id = "prod_sync_test"
        job_id = "job_sync_test"
        
        # Mock repo and pdf_handler
        with patch("backend.repositories.marketplace_repository.MarketplaceRepository") as mock_repo_cls, \
             patch("backend.utils.pdf_handler.generate_pdf_preview_and_thumbnails") as mock_gen, \
             patch("backend.utils.pdf_handler.get_pdf_info") as mock_info:
            
            mock_repo = mock_repo_cls.return_value
            mock_repo.get_product_by_id.return_value = {"pdf_file": "/test.pdf"}
            mock_gen.return_value = ("url", ["thumb"])
            mock_info.return_value = {"total_pages": 10}
            
            await _async_process_pdf_task(product_id, job_id)
            
            # Vérifier que preview_ready est True
            args, kwargs = mock_repo.update_product.call_args
            self.assertTrue(args[1]["preview_ready"])

    async def test_product_consistency_failed(self):
        from unittest.mock import patch, MagicMock
        from backend.worker import _async_process_pdf_task
        
        product_id = "prod_fail_test"
        job_id = "job_fail_test"
        
        with patch("backend.repositories.marketplace_repository.MarketplaceRepository") as mock_repo_cls, \
             patch("backend.utils.pdf_handler.generate_pdf_preview_and_thumbnails") as mock_gen:
            
            mock_repo = mock_repo_cls.return_value
            mock_repo.get_product_by_id.return_value = {"pdf_file": "/test.pdf"}
            mock_gen.return_value = (None, []) # Fail
            
            await _async_process_pdf_task(product_id, job_id)
            
            # Vérifier que preview_ready est False
            args, kwargs = mock_repo.update_product.call_args
            self.assertFalse(args[1]["preview_ready"])

    async def test_worker_cleanup_finally(self):
        """Vérifie que le process enfant se termine sans erreur bloquante."""
        from unittest.mock import patch
        from backend.worker import process_pdf_task
        
        # Ce test vérifie principalement que la structure try/finally ne crash pas
        with patch("backend.worker._async_process_pdf_task") as mock_task:
            mock_task.return_value = True
            process_pdf_task("prod_id", "job_id")
            self.assertTrue(mock_task.called)

if __name__ == "__main__":
    unittest.main()
