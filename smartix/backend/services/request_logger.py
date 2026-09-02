"""
RequestLogger — Journalisation des requêtes HTTP par projet sandbox.

Chaque requête vers /api/sandbox/{project_id}/... ou /api/projects/{project_id}/...
est enregistrée en base (collection `project_request_logs`) avec :
  - méthode, chemin, query string
  - code statut HTTP
  - durée (ms)
  - user_id
  - timestamp
  - adresse IP source

Le service utilise un buffer en mémoire pour écrire en batch
et limiter la pression sur MongoDB.
"""

import asyncio
import logging
import os
import re
from collections import deque
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

COLLECTION = 'project_request_logs'
MAX_LOGS_PER_PROJECT = int(os.getenv('MAX_REQUEST_LOGS', '2000'))
FLUSH_INTERVAL = float(os.getenv('LOG_FLUSH_INTERVAL', '5.0'))
BUFFER_MAX = 500

_PROJECT_ID_RE = re.compile(
    r'^/api/(?:sandbox|projects)/([^/]+)',
    re.IGNORECASE
)


def _extract_project_id(path: str) -> Optional[str]:
    """Extrait le project_id depuis une URL de type /api/sandbox/{id}/... ou /api/projects/{id}/..."""
    m = _PROJECT_ID_RE.match(path)
    return m.group(1) if m else None


class RequestLogger:
    def __init__(self):
        self._db = None
        self._buffer: deque = deque(maxlen=BUFFER_MAX)
        self._flush_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    def set_db(self, db):
        self._db = db

    def start(self):
        """Démarre la tâche de flush périodique."""
        if self._flush_task is None or self._flush_task.done():
            self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info("RequestLogger démarré")

    def stop(self):
        if self._flush_task:
            self._flush_task.cancel()

    async def _flush_loop(self):
        while True:
            await asyncio.sleep(FLUSH_INTERVAL)
            await self._flush()

    async def _flush(self):
        if not self._buffer or self._db is None:
            return

        async with self._lock:
            entries = list(self._buffer)
            self._buffer.clear()

        if not entries:
            return

        try:
            col = self._db[COLLECTION]
            await col.insert_many(entries, ordered=False)
        except Exception as e:
            logger.warning(f"RequestLogger flush error: {e}")

    def log(
        self,
        project_id: str,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        client_ip: Optional[str] = None,
        query_string: Optional[str] = None,
    ):
        """Ajoute une entrée de log dans le buffer (non-bloquant)."""
        entry = {
            'project_id': project_id,
            'method': method.upper(),
            'path': path,
            'query_string': query_string or '',
            'status_code': status_code,
            'duration_ms': round(duration_ms, 2),
            'user_id': user_id,
            'client_ip': client_ip or 'unknown',
            'level': _status_to_level(status_code),
            'timestamp': datetime.now(timezone.utc),
        }
        self._buffer.append(entry)

    async def get_logs(
        self,
        project_id: str,
        limit: int = 200,
        method: Optional[str] = None,
        status_gte: Optional[int] = None,
        status_lte: Optional[int] = None,
        path_contains: Optional[str] = None,
        level: Optional[str] = None,
    ) -> list:
        """Récupère les logs d'un projet avec filtres optionnels."""
        if self._db is None:
            return []

        await self._flush()

        query = {'project_id': project_id}
        if method:
            query['method'] = method.upper()
        if level:
            query['level'] = level
        if status_gte or status_lte:
            status_filter = {}
            if status_gte:
                status_filter['$gte'] = status_gte
            if status_lte:
                status_filter['$lte'] = status_lte
            query['status_code'] = status_filter
        if path_contains:
            query['path'] = {'$regex': re.escape(path_contains), '$options': 'i'}

        col = self._db[COLLECTION]
        cursor = col.find(
            query,
            {'_id': 0}
        ).sort('timestamp', -1).limit(min(limit, 500))

        return [_serialize_log(doc) async for doc in cursor]

    async def get_stats(self, project_id: str) -> dict:
        """Retourne des statistiques agrégées pour un projet."""
        if self._db is None:
            return {}

        await self._flush()

        col = self._db[COLLECTION]
        pipeline = [
            {'$match': {'project_id': project_id}},
            {'$group': {
                '_id': None,
                'total': {'$sum': 1},
                'errors': {'$sum': {'$cond': [{'$gte': ['$status_code', 400]}, 1, 0]}},
                'avg_duration_ms': {'$avg': '$duration_ms'},
                'max_duration_ms': {'$max': '$duration_ms'},
                'methods': {'$push': '$method'},
            }}
        ]

        result = await col.aggregate(pipeline).to_list(1)
        if not result:
            return {'total': 0, 'errors': 0, 'avg_duration_ms': 0, 'max_duration_ms': 0}

        stats = result[0]
        from collections import Counter
        method_counts = dict(Counter(stats.get('methods', [])))

        return {
            'total': stats['total'],
            'errors': stats['errors'],
            'error_rate': round(stats['errors'] / max(stats['total'], 1) * 100, 1),
            'avg_duration_ms': round(stats.get('avg_duration_ms') or 0, 1),
            'max_duration_ms': round(stats.get('max_duration_ms') or 0, 1),
            'method_counts': method_counts,
        }

    async def clear_logs(self, project_id: str) -> int:
        """Supprime tous les logs d'un projet."""
        if self._db is None:
            return 0
        col = self._db[COLLECTION]
        result = await col.delete_many({'project_id': project_id})
        return result.deleted_count

    async def ensure_index(self):
        """Crée les index MongoDB nécessaires."""
        if self._db is None:
            return
        col = self._db[COLLECTION]
        await col.create_index([('project_id', 1), ('timestamp', -1)])
        await col.create_index([('project_id', 1), ('status_code', 1)])
        await col.create_index('timestamp', expireAfterSeconds=604800)  # TTL 7 jours


def _status_to_level(status: int) -> str:
    if status >= 500:
        return 'error'
    if status >= 400:
        return 'warn'
    if status >= 300:
        return 'info'
    return 'success'


def _serialize_log(doc: dict) -> dict:
    ts = doc.get('timestamp')
    if ts:
        doc['timestamp'] = ts.isoformat() if hasattr(ts, 'isoformat') else str(ts)
    return doc


request_logger = RequestLogger()
