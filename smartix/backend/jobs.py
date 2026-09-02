from datetime import datetime, timezone, timedelta
from typing import Optional
from models.marketplace import PDFJob
from db import get_collection
import uuid

class JobManager:
    """
    Job Manager for Marketplace PDF processing.
    Admission Control is strictly based on the database (no global variables).
    """
    MAX_CONCURRENT_JOBS = 3  # Configurable limit

    @staticmethod
    def _get_control_collection():
        return get_collection("worker_control")

    @classmethod
    async def _init_control(cls):
        """Initialise le document de contrôle global s'il n'existe pas."""
        collection = cls._get_control_collection()
        await collection.update_one(
            {"_id": "global_control"},
            {"$setOnInsert": {"active_jobs": 0}},
            upsert=True
        )

    @classmethod
    async def get_processing_count(cls) -> int:
        """Retourne le nombre actuel de jobs en cours via le document de contrôle."""
        await cls._init_control()
        doc = await cls._get_control_collection().find_one({"_id": "global_control"})
        return doc.get("active_jobs", 0) if doc else 0

    @classmethod
    async def try_admit_job(cls) -> Optional[PDFJob]:
        """
        Attempts to admit a 'queued' job into 'processing' state.
        Respects MAX_CONCURRENT_JOBS via atomic global counter.
        Returns the admitted job or None if limit reached or no jobs queued.
        """
        await cls._init_control()
        collection = cls._get_jobs_collection()
        control_col = cls._get_control_collection()

        # 1. Admission atomique via compteur global
        admission = await control_col.find_one_and_update(
            {"_id": "global_control", "active_jobs": {"$lt": cls.MAX_CONCURRENT_JOBS}},
            {"$inc": {"active_jobs": 1}},
            return_document=True
        )

        if not admission:
            return None

        # 2. Recherche d'un job prêt (queued + (next_retry_at absent ou passé))
        now = datetime.now(timezone.utc)
        queued_job = await collection.find_one(
            {
                "status": "queued",
                "$or": [
                    {"next_retry_at": None},
                    {"next_retry_at": {"$lte": now}}
                ]
            },
            sort=[("created_at", 1)]
        )

        if not queued_job:
            # Relâcher le slot si aucun job n'est trouvé
            await control_col.update_one({"_id": "global_control"}, {"$inc": {"active_jobs": -1}})
            return None

        # 3. Passage en processing atomique avec incrément retry
        result = await collection.find_one_and_update(
            {"_id": queued_job["_id"], "status": "queued"},
            {"$set": {
                "status": "processing",
                "started_at": now,
                "processing_started_at": now
            }, "$inc": {"retries": 1}},
            return_document=True
        )

        if result:
            job = PDFJob(**result)
            if job.retries > job.max_retries:
                # Échec définitif si trop de tentatives
                await cls.update_job_status(job.id, "failed", error_message=f"Max retries exceeded ({job.max_retries})")
                return None
            return job
        
        # Relâcher le slot si l'update du job a échoué (race condition sur le job lui-même)
        await control_col.update_one({"_id": "global_control"}, {"$inc": {"active_jobs": -1}})
        return None

    @classmethod
    async def update_job_status(cls, job_id: str, status: str, error_message: Optional[str] = None, file_size: Optional[int] = None):
        """
        Updates the status of a job (done, failed, etc.)
        Libère aussi le slot dans le compteur global si le job sort de 'processing'.
        """
        collection = cls._get_jobs_collection()
        
        # On récupère le job avant pour savoir s'il était en processing
        job_before = await collection.find_one({"id": job_id})
        was_processing = job_before and job_before.get("status") == "processing"

        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if status in ["done", "failed"]:
            update_data["finished_at"] = datetime.now(timezone.utc)
            # Reset processing_started_at car il n'est plus en cours
            update_data["processing_started_at"] = None
        
        if error_message:
            update_data["error_message"] = error_message
        
        if file_size is not None:
            update_data["file_size"] = file_size

        # Si c'est un échec, on calcule le backoff s'il reste des retries
        if status == "failed" and job_before:
            current_retries = job_before.get("retries", 0)
            max_retries = job_before.get("max_retries", 3)
            if current_retries < max_retries and "timeout" not in (error_message or "").lower():
                # On le remet en queued avec backoff (timeout crash handled by recovery)
                update_data["status"] = "queued"
                backoff_min = 2 ** current_retries
                update_data["next_retry_at"] = datetime.now(timezone.utc) + timedelta(minutes=backoff_min)

        await collection.update_one(
            {"id": job_id},
            {"$set": update_data}
        )

        # Libération du slot si on sort de processing
        if was_processing:
            await cls._get_control_collection().update_one(
                {"_id": "global_control"},
                {"$inc": {"active_jobs": -1}}
            )

    @classmethod
    async def recover_orphaned_jobs(cls) -> int:
        """
        Recherche les jobs bloqués en 'processing'.
        Un job est considéré orphelin si processing_started_at < now - WORKER_TIMEOUT.
        """
        collection = cls._get_jobs_collection()
        # On définit un timeout de sécurité (ex: 5 minutes si timeout worker = 2min)
        TIMEOUT_DELTA = timedelta(minutes=5)
        cutoff = datetime.now(timezone.utc) - TIMEOUT_DELTA
        
        count = 0
        orphans = collection.find({
            "status": "processing",
            "processing_started_at": {"$lt": cutoff}
        })
        
        async for job_doc in orphans:
            job = PDFJob(**job_doc)
            if job.retries >= job.max_retries:
                # Échec définitif
                await cls.update_job_status(job.id, "failed", error_message="System recovery: Max retries exceeded after crash")
            else:
                # Re-queue
                await collection.update_one(
                    {"_id": job_doc["_id"]},
                    {"$set": {
                        "status": "queued",
                        "updated_at": datetime.now(timezone.utc),
                        "processing_started_at": None,
                        "error_message": "Recovered from system crash/timeout"
                    }}
                )
                # Note: On ne décrémente pas active_jobs ici car au redémarrage 
                # on va reset le compteur global de toute façon pour être sûr.
            count += 1
            
        # Reset le compteur global au démarrage pour être cohérent avec l'état réel
        await cls._init_control()
        actual_processing = await collection.count_documents({"status": "processing"})
        await cls._get_control_collection().update_one(
            {"_id": "global_control"},
            {"$set": {"active_jobs": actual_processing}}
        )
        
        return count
