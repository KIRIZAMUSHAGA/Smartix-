import time
import json
import logging
import asyncio
from datetime import datetime
from typing import Callable, Dict, Any, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from monitoring.clickhouse_client import ClickHouseClient

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Collecte les métriques de performance et d'usage et les envoie vers ClickHouse.
    Peut être utilisé comme middleware FastAPI ou appelé directement.
    """

    def __init__(self, clickhouse: ClickHouseClient, region: str = 'eu-west'):
        self.clickhouse = clickhouse
        self.region = region

        # Buffer pour les inserts en batch (réduire les aller-retours réseau)
        self._perf_buffer: list = []
        self._metrics_buffer: list = []
        self._buffer_size = 50
        self._flush_interval = 10.0  # secondes

        self._flush_task: Optional[asyncio.Task] = None

    # ─────────────────────────────────────────────────────────────────────────
    # Démarrage / arrêt du flush automatique
    # ─────────────────────────────────────────────────────────────────────────

    async def start(self):
        """Démarre la tâche de flush périodique."""
        self._flush_task = asyncio.create_task(self._auto_flush())
        logger.info("✅ MetricsCollector démarré")

    async def stop(self):
        """Arrête proprement le collector et flush les données restantes."""
        if self._flush_task:
            self._flush_task.cancel()
        await self._flush_all()
        logger.info("MetricsCollector arrêté")

    async def _auto_flush(self):
        """Tâche de fond : flush les buffers toutes les N secondes."""
        while True:
            await asyncio.sleep(self._flush_interval)
            await self._flush_all()

    async def _flush_all(self):
        """Vide les buffers vers ClickHouse."""
        if self._perf_buffer:
            batch = self._perf_buffer[:]
            self._perf_buffer.clear()
            await self.clickhouse.insert_batch('performance_metrics', batch)

        if self._metrics_buffer:
            batch = self._metrics_buffer[:]
            self._metrics_buffer.clear()
            await self.clickhouse.insert_batch('vibe_metrics', batch)

    # ─────────────────────────────────────────────────────────────────────────
    # Middleware FastAPI
    # ─────────────────────────────────────────────────────────────────────────

    async def collect_request_metrics(self, request: Request, call_next: Callable) -> Response:
        """
        Middleware FastAPI qui mesure la durée de chaque requête
        et l'enregistre dans ClickHouse.
        """
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        record = {
            'timestamp': datetime.utcnow(),
            'endpoint': request.url.path,
            'method': request.method,
            'response_time_ms': duration_ms,
            'status_code': response.status_code,
            'user_id': request.headers.get('X-User-ID', 'anonymous'),
            'region': request.headers.get('CF-IPCountry', self.region),
            'bytes_sent': int(response.headers.get('content-length', 0)),
        }

        self._perf_buffer.append(record)
        if len(self._perf_buffer) >= self._buffer_size:
            asyncio.create_task(self._flush_all())

        return response

    # ─────────────────────────────────────────────────────────────────────────
    # Tracking d'actions utilisateur
    # ─────────────────────────────────────────────────────────────────────────

    async def track_user_action(
        self,
        user_id: str,
        project_id: str,
        action: str,
        duration_ms: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Enregistre une action utilisateur dans ClickHouse."""
        record = {
            'timestamp': datetime.utcnow(),
            'user_id': user_id,
            'project_id': project_id,
            'event_type': action,
            'duration_ms': duration_ms,
            'metadata': json.dumps(metadata) if metadata else '',
            'region': self.region,
        }

        self._metrics_buffer.append(record)
        if len(self._metrics_buffer) >= self._buffer_size:
            asyncio.create_task(self._flush_all())

    async def track_error(
        self,
        error_type: str,
        error_message: str,
        stack_trace: str = '',
        user_id: str = 'anonymous',
        project_id: str = '',
        endpoint: str = '',
    ) -> None:
        """Enregistre une erreur dans ClickHouse."""
        await self.clickhouse.insert_metric('errors', {
            'timestamp': datetime.utcnow(),
            'error_type': error_type,
            'error_message': error_message[:2000],
            'stack_trace': stack_trace[:5000],
            'user_id': user_id,
            'project_id': project_id,
            'endpoint': endpoint,
            'region': self.region,
        })

    async def track_scaling_event(
        self,
        deployment: str,
        from_replicas: int,
        to_replicas: int,
        trigger_metric: str,
        trigger_value: float,
    ) -> None:
        """Enregistre un événement de scaling."""
        event_type = 'scale_up' if to_replicas > from_replicas else 'scale_down'
        await self.clickhouse.insert_metric('scaling_events', {
            'timestamp': datetime.utcnow(),
            'event_type': event_type,
            'deployment': deployment,
            'from_replicas': from_replicas,
            'to_replicas': to_replicas,
            'trigger_metric': trigger_metric,
            'trigger_value': trigger_value,
            'region': self.region,
        })

    # ─────────────────────────────────────────────────────────────────────────
    # Région automatique
    # ─────────────────────────────────────────────────────────────────────────

    async def get_user_region(self, user_id: str) -> str:
        """Retourne la région d'un utilisateur (depuis les métriques récentes)."""
        try:
            result = await self.clickhouse.query(
                f"SELECT region FROM vibe_metrics WHERE user_id = '{user_id}' "
                "ORDER BY timestamp DESC LIMIT 1"
            )
            return result[0]['region'] if result else self.region
        except Exception:
            return self.region


# ─────────────────────────────────────────────────────────────────────────────
# Middleware Starlette intégré
# ─────────────────────────────────────────────────────────────────────────────

class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware Starlette/FastAPI pour la collecte automatique des métriques."""

    def __init__(self, app, collector: MetricsCollector, exclude_paths: list = None):
        super().__init__(app)
        self.collector = collector
        self.exclude_paths = exclude_paths or ['/health', '/ready', '/metrics']

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in self.exclude_paths:
            return await call_next(request)
        return await self.collector.collect_request_metrics(request, call_next)
