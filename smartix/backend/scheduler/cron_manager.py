import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class CronManager:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.jobs: Dict[str, dict] = {}
        self.execution_logs: Dict[str, list] = {}
        self.container_manager = None

    def start(self, container_manager=None):
        """Démarre le planificateur (appeler après l'initialisation de l'app)"""
        self.container_manager = container_manager
        if not self.scheduler.running:
            self.scheduler.start()
        logger.info("CronManager démarré")

    def stop(self):
        """Arrête le planificateur proprement"""
        if self.scheduler.running:
            self.scheduler.shutdown()

    def add_job(
        self,
        job_id: str,
        project_id: str,
        schedule: str,
        command: str,
        name: Optional[str] = None
    ) -> dict:
        """
        Ajoute ou remplace une tâche cron.

        Args:
            job_id: Identifiant unique de la tâche
            project_id: Identifiant du projet propriétaire
            schedule: Expression cron "min heure jour mois jour_semaine"
            command: Commande shell à exécuter
            name: Nom lisible de la tâche (optionnel)
        """
        trigger = CronTrigger.from_crontab(schedule)

        apscheduler_job = self.scheduler.add_job(
            self._execute_job,
            trigger=trigger,
            args=[job_id, project_id, command],
            id=job_id,
            replace_existing=True,
            name=name or job_id
        )

        self.jobs[job_id] = {
            'id': job_id,
            'project_id': project_id,
            'schedule': schedule,
            'command': command,
            'name': name or command[:50],
            'next_run': apscheduler_job.next_run_time.isoformat() if apscheduler_job.next_run_time else None,
            'last_run': None,
            'last_status': None,
            'created_at': datetime.utcnow().isoformat()
        }

        self.execution_logs.setdefault(job_id, [])

        logger.info(f"Tâche cron ajoutée : {job_id} — {schedule} — {command}")
        return self.jobs[job_id]

    async def _execute_job(self, job_id: str, project_id: str, command: str):
        """Exécute la commande dans le container du projet et journalise le résultat"""
        started_at = datetime.utcnow()
        result_output = ""
        success = False

        try:
            if self.container_manager:
                result_output = await self.container_manager.exec_command(project_id, command)
            else:
                proc = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()
                result_output = stdout.decode() + stderr.decode()

            success = True
        except Exception as e:
            result_output = str(e)
            logger.error(f"Erreur exécution cron {job_id}: {e}")

        finished_at = datetime.utcnow()

        log_entry = {
            'started_at': started_at.isoformat(),
            'finished_at': finished_at.isoformat(),
            'duration_ms': int((finished_at - started_at).total_seconds() * 1000),
            'output': result_output[:4096],
            'success': success
        }

        logs = self.execution_logs.setdefault(job_id, [])
        logs.append(log_entry)
        if len(logs) > 100:
            logs.pop(0)

        if job_id in self.jobs:
            job = self.jobs[job_id]
            job['last_run'] = started_at.isoformat()
            job['last_status'] = 'success' if success else 'error'

            apscheduler_job = self.scheduler.get_job(job_id)
            if apscheduler_job and apscheduler_job.next_run_time:
                job['next_run'] = apscheduler_job.next_run_time.isoformat()

        logger.info(f"Cron {job_id} exécuté en {log_entry['duration_ms']}ms — {'OK' if success else 'ERREUR'}")

    async def test_job(self, job_id: str) -> dict:
        """Déclenche immédiatement l'exécution d'une tâche (test manuel)"""
        job = self.jobs.get(job_id)
        if not job:
            return {'error': f"Tâche {job_id} introuvable"}

        await self._execute_job(job_id, job['project_id'], job['command'])

        logs = self.execution_logs.get(job_id, [])
        return logs[-1] if logs else {'error': "Aucun log disponible"}

    def remove_job(self, job_id: str) -> bool:
        """Supprime une tâche cron"""
        if job_id not in self.jobs:
            return False

        try:
            self.scheduler.remove_job(job_id)
        except Exception:
            pass

        del self.jobs[job_id]
        self.execution_logs.pop(job_id, None)

        logger.info(f"Tâche cron supprimée : {job_id}")
        return True

    def get_jobs(self, project_id: str) -> List[dict]:
        """Liste toutes les tâches d'un projet"""
        return [job for job in self.jobs.values() if job['project_id'] == project_id]

    def get_job(self, job_id: str) -> Optional[dict]:
        """Retourne les détails d'une tâche"""
        return self.jobs.get(job_id)

    def get_logs(self, job_id: str, limit: int = 20) -> list:
        """Retourne les derniers logs d'exécution d'une tâche"""
        logs = self.execution_logs.get(job_id, [])
        return logs[-limit:]
