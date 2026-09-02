import os
import asyncio
import logging
from typing import Dict, Optional, Tuple

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Métriques Prometheus
# ─────────────────────────────────────────────────────────────────────────────

requests_total = Counter(
    'http_requests_total',
    'Total de requêtes HTTP',
    ['method', 'endpoint', 'status'],
)
request_duration = Histogram(
    'http_request_duration_seconds',
    'Durée des requêtes HTTP en secondes',
    ['endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
)
active_sandbox_containers = Gauge(
    'sandbox_containers_active',
    'Nombre de containers sandbox actifs',
)
build_queue_length = Gauge(
    'build_queue_length',
    "Longueur de la file d'attente de build",
)
active_websocket_connections = Gauge(
    'websocket_connections_active',
    'Connexions WebSocket actives',
)
active_users_gauge = Gauge(
    'active_users',
    'Utilisateurs actifs en ce moment',
)
requests_per_second_gauge = Gauge(
    'http_requests_per_second',
    'Requêtes HTTP par seconde (5 minutes glissantes)',
)
response_time_avg_gauge = Gauge(
    'http_response_time_avg_ms',
    'Temps de réponse moyen en millisecondes',
)
response_time_p95_gauge = Gauge(
    'http_response_time_p95_ms',
    'Temps de réponse P95 en millisecondes',
)
error_rate_gauge = Gauge(
    'http_error_rate_pct',
    "Taux d'erreur HTTP en pourcentage",
)


class MetricsProvider:
    """
    Collecte, agrège et expose les métriques pour le scaling automatique.
    Les métriques sont lues depuis ClickHouse et exposées via Prometheus.
    """

    def __init__(self, clickhouse_client):
        if clickhouse_client is None:
            raise ValueError("clickhouse_client est requis (architecture sans fallback)")
        self.clickhouse = clickhouse_client
        self._running = False
        self._update_task: Optional[asyncio.Task] = None
        self._update_interval = float(os.getenv('METRICS_UPDATE_INTERVAL', '15'))

        # Snapshot courant (mis à jour périodiquement)
        self.current: Dict[str, float] = {
            'requests_per_second': 0.0,
            'avg_response_time_ms': 0.0,
            'p95_response_time_ms': 0.0,
            'error_rate_pct': 0.0,
            'active_users': 0.0,
            'queue_size': 0.0,
            'active_containers': 0.0,
            'websocket_connections': 0.0,
            'cpu_usage_pct': 0.0,
            'memory_usage_pct': 0.0,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Cycle de vie
    # ─────────────────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Démarre la mise à jour périodique des métriques."""
        self._running = True
        self._update_task = asyncio.create_task(self._update_loop())
        logger.info(f"✅ MetricsProvider démarré (interval={self._update_interval}s)")

    async def stop(self) -> None:
        """Arrête le provider."""
        self._running = False
        if self._update_task:
            self._update_task.cancel()
            try:
                await self._update_task
            except (asyncio.CancelledError, Exception):
                pass
        logger.info("MetricsProvider arrêté")

    async def _update_loop(self) -> None:
        """Boucle principale de mise à jour des métriques."""
        while self._running:
            try:
                await self._update_metrics()
            except Exception as e:
                logger.error(f"Erreur mise à jour métriques : {e}")
            await asyncio.sleep(self._update_interval)

    # ─────────────────────────────────────────────────────────────────────────
    # Mise à jour des métriques
    # ─────────────────────────────────────────────────────────────────────────

    async def _update_metrics(self) -> None:
        """Collecte toutes les métriques depuis ClickHouse et met à jour Prometheus."""
        results = await asyncio.gather(
            self._get_rps(),
            self._get_avg_response_time(),
            self._get_p95_response_time(),
            self._get_error_rate(),
            self._get_active_users(),
            return_exceptions=True,
        )

        keys = [
            'requests_per_second', 'avg_response_time_ms', 'p95_response_time_ms',
            'error_rate_pct', 'active_users',
        ]
        for key, result in zip(keys, results):
            if isinstance(result, Exception):
                logger.warning(f"Métrique {key} indisponible : {result}")
                continue
            self.current[key] = float(result or 0)

        # Sync Prometheus
        active_users_gauge.set(self.current['active_users'])
        requests_per_second_gauge.set(self.current['requests_per_second'])
        response_time_avg_gauge.set(self.current['avg_response_time_ms'])
        response_time_p95_gauge.set(self.current['p95_response_time_ms'])
        error_rate_gauge.set(self.current['error_rate_pct'])

    # ─────────────────────────────────────────────────────────────────────────
    # Requêtes ClickHouse
    # ─────────────────────────────────────────────────────────────────────────

    async def _get_rps(self) -> float:
        result = await self.clickhouse.query_scalar("""
            SELECT count(*) / (5 * 60.0) AS rps
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL 5 MINUTE
        """)
        return float(result or 0)

    async def _get_avg_response_time(self) -> float:
        result = await self.clickhouse.query_scalar("""
            SELECT avg(response_time_ms)
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL 5 MINUTE
        """)
        return float(result or 0)

    async def _get_p95_response_time(self) -> float:
        result = await self.clickhouse.query_scalar("""
            SELECT quantile(0.95)(response_time_ms)
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL 5 MINUTE
        """)
        return float(result or 0)

    async def _get_error_rate(self) -> float:
        result = await self.clickhouse.query_scalar("""
            SELECT countIf(status_code >= 400) * 100.0 / nullIf(count(*), 0)
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL 5 MINUTE
        """)
        return float(result or 0)

    async def _get_active_users(self) -> float:
        result = await self.clickhouse.query_scalar("""
            SELECT count(DISTINCT user_id)
            FROM vibe_metrics
            WHERE timestamp >= now() - INTERVAL 5 MINUTE
        """)
        return float(result or 0)

    # ─────────────────────────────────────────────────────────────────────────
    # Mise à jour manuelle des gauges
    # ─────────────────────────────────────────────────────────────────────────

    def set_active_containers(self, count: int) -> None:
        self.current['active_containers'] = float(count)
        active_sandbox_containers.set(count)

    def set_queue_size(self, size: int) -> None:
        self.current['queue_size'] = float(size)
        build_queue_length.set(size)

    def set_websocket_connections(self, count: int) -> None:
        self.current['websocket_connections'] = float(count)
        active_websocket_connections.set(count)

    def record_request(self, method: str, endpoint: str, status: int, duration_s: float) -> None:
        requests_total.labels(method=method, endpoint=endpoint, status=str(status)).inc()
        request_duration.labels(endpoint=endpoint).observe(duration_s)

    # ─────────────────────────────────────────────────────────────────────────
    # Exposition Prometheus
    # ─────────────────────────────────────────────────────────────────────────

    def get_prometheus_output(self) -> Tuple[bytes, str]:
        """Retourne les métriques au format Prometheus texte."""
        return generate_latest(), CONTENT_TYPE_LATEST

    def get_snapshot(self) -> Dict[str, float]:
        """Retourne une copie du snapshot courant des métriques."""
        return dict(self.current)
