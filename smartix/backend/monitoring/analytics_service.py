import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

from monitoring.clickhouse_client import ClickHouseClient

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Service d'analyse des métriques collectées dans ClickHouse.
    Fournit des méthodes pour interroger les KPIs clés de Vibe-Coding.
    """

    def __init__(self, clickhouse: ClickHouseClient):
        self.clickhouse = clickhouse

    # ─────────────────────────────────────────────────────────────────────────
    # Utilisateurs actifs
    # ─────────────────────────────────────────────────────────────────────────

    async def get_daily_active_users(self, days: int = 7) -> List[Dict]:
        """Nombre d'utilisateurs actifs distincts par jour."""
        query = f"""
            SELECT
                toDate(timestamp)               AS date,
                count(DISTINCT user_id)         AS dau,
                count(*)                        AS total_events
            FROM vibe_metrics
            WHERE timestamp >= now() - INTERVAL {days} DAY
            GROUP BY date
            ORDER BY date ASC
        """
        return await self.clickhouse.query(query)

    async def get_monthly_active_users(self) -> int:
        """Nombre d'utilisateurs actifs sur les 30 derniers jours."""
        result = await self.clickhouse.query_scalar("""
            SELECT count(DISTINCT user_id) AS mau
            FROM vibe_metrics
            WHERE timestamp >= now() - INTERVAL 30 DAY
        """)
        return int(result or 0)

    async def get_new_users(self, days: int = 7) -> List[Dict]:
        """Nouveaux utilisateurs (première connexion) par jour."""
        query = f"""
            SELECT
                toDate(min_ts)           AS date,
                count(*)                 AS new_users
            FROM (
                SELECT
                    user_id,
                    min(timestamp) AS min_ts
                FROM vibe_metrics
                GROUP BY user_id
            )
            WHERE min_ts >= now() - INTERVAL {days} DAY
            GROUP BY date
            ORDER BY date ASC
        """
        return await self.clickhouse.query(query)

    # ─────────────────────────────────────────────────────────────────────────
    # Performance API
    # ─────────────────────────────────────────────────────────────────────────

    async def get_api_performance(self, endpoint: Optional[str] = None) -> Dict:
        """
        Métriques de performance des endpoints sur la dernière heure.
        Si endpoint est précisé, filtre sur cet endpoint uniquement.
        """
        where = "WHERE timestamp >= now() - INTERVAL 1 HOUR"
        if endpoint:
            safe_endpoint = endpoint.replace("'", "''")
            where += f" AND endpoint = '{safe_endpoint}'"

        query = f"""
            SELECT
                avg(response_time_ms)                         AS avg_response_time,
                quantile(0.50)(response_time_ms)              AS p50_response_time,
                quantile(0.95)(response_time_ms)              AS p95_response_time,
                quantile(0.99)(response_time_ms)              AS p99_response_time,
                max(response_time_ms)                         AS max_response_time,
                count(*)                                      AS total_requests,
                countIf(status_code >= 400)                   AS error_requests
            FROM performance_metrics
            {where}
        """
        results = await self.clickhouse.query(query)
        return results[0] if results else {
            'avg_response_time': 0, 'p50_response_time': 0,
            'p95_response_time': 0, 'p99_response_time': 0,
            'max_response_time': 0, 'total_requests': 0, 'error_requests': 0,
        }

    async def get_top_endpoints(self, limit: int = 10) -> List[Dict]:
        """Endpoints les plus sollicités sur les 24 dernières heures."""
        query = f"""
            SELECT
                endpoint,
                method,
                count(*)                          AS requests,
                avg(response_time_ms)             AS avg_time,
                quantile(0.95)(response_time_ms)  AS p95_time,
                countIf(status_code >= 400) * 100.0 / count(*) AS error_rate_pct
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL 24 HOUR
            GROUP BY endpoint, method
            ORDER BY requests DESC
            LIMIT {limit}
        """
        return await self.clickhouse.query(query)

    async def get_requests_per_second(self, window_minutes: int = 5) -> float:
        """Taux de requêtes par seconde sur la fenêtre glissante donnée."""
        result = await self.clickhouse.query_scalar(f"""
            SELECT count(*) / ({window_minutes} * 60.0) AS rps
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL {window_minutes} MINUTE
        """)
        return float(result or 0)

    # ─────────────────────────────────────────────────────────────────────────
    # Taux d'erreurs
    # ─────────────────────────────────────────────────────────────────────────

    async def get_error_rate(self, window_minutes: int = 60) -> float:
        """Pourcentage de requêtes en erreur (status >= 400)."""
        result = await self.clickhouse.query_scalar(f"""
            SELECT
                countIf(status_code >= 400) * 100.0 / count(*) AS error_rate
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL {window_minutes} MINUTE
        """)
        return float(result or 0)

    async def get_error_breakdown(self, hours: int = 24) -> List[Dict]:
        """Détail des erreurs par type sur les N dernières heures."""
        query = f"""
            SELECT
                error_type,
                count(*)         AS occurrences,
                max(timestamp)   AS last_seen,
                any(error_message) AS sample_message
            FROM errors
            WHERE timestamp >= now() - INTERVAL {hours} HOUR
            GROUP BY error_type
            ORDER BY occurrences DESC
        """
        return await self.clickhouse.query(query)

    # ─────────────────────────────────────────────────────────────────────────
    # Engagement utilisateur
    # ─────────────────────────────────────────────────────────────────────────

    async def get_user_engagement(self, user_id: str) -> Dict:
        """Statistiques d'engagement pour un utilisateur spécifique."""
        safe_uid = user_id.replace("'", "''")
        query = f"""
            SELECT
                count(*)                    AS total_actions,
                count(DISTINCT project_id)  AS projects_used,
                count(DISTINCT toDate(timestamp)) AS active_days,
                avg(duration_ms)            AS avg_action_duration_ms,
                min(timestamp)              AS first_seen,
                max(timestamp)              AS last_seen
            FROM vibe_metrics
            WHERE user_id = '{safe_uid}'
            AND timestamp >= now() - INTERVAL 30 DAY
        """
        results = await self.clickhouse.query(query)
        return results[0] if results else {}

    async def get_top_users(self, limit: int = 10) -> List[Dict]:
        """Utilisateurs les plus actifs sur les 30 derniers jours."""
        query = f"""
            SELECT
                user_id,
                count(*)                    AS total_actions,
                count(DISTINCT project_id)  AS projects,
                count(DISTINCT toDate(timestamp)) AS active_days,
                max(timestamp)              AS last_active
            FROM vibe_metrics
            WHERE timestamp >= now() - INTERVAL 30 DAY
            GROUP BY user_id
            ORDER BY total_actions DESC
            LIMIT {limit}
        """
        return await self.clickhouse.query(query)

    async def get_popular_features(self, days: int = 7) -> List[Dict]:
        """Fonctionnalités les plus utilisées par event_type."""
        query = f"""
            SELECT
                event_type,
                count(*)                    AS uses,
                count(DISTINCT user_id)     AS unique_users
            FROM vibe_metrics
            WHERE timestamp >= now() - INTERVAL {days} DAY
            GROUP BY event_type
            ORDER BY uses DESC
            LIMIT 20
        """
        return await self.clickhouse.query(query)

    # ─────────────────────────────────────────────────────────────────────────
    # Distribution géographique
    # ─────────────────────────────────────────────────────────────────────────

    async def get_users_by_region(self) -> List[Dict]:
        """Répartition des utilisateurs par région."""
        query = """
            SELECT
                region,
                count(DISTINCT user_id)  AS users,
                count(*)                 AS events
            FROM vibe_metrics
            WHERE timestamp >= now() - INTERVAL 30 DAY
            GROUP BY region
            ORDER BY users DESC
        """
        return await self.clickhouse.query(query)

    async def get_latency_by_region(self) -> List[Dict]:
        """Latence moyenne par région."""
        query = """
            SELECT
                region,
                avg(response_time_ms)             AS avg_latency,
                quantile(0.95)(response_time_ms)  AS p95_latency,
                count(*)                          AS requests
            FROM performance_metrics
            WHERE timestamp >= now() - INTERVAL 24 HOUR
            GROUP BY region
            ORDER BY avg_latency ASC
        """
        return await self.clickhouse.query(query)

    # ─────────────────────────────────────────────────────────────────────────
    # Scaling
    # ─────────────────────────────────────────────────────────────────────────

    async def get_scaling_history(self, days: int = 7) -> List[Dict]:
        """Historique des événements de scaling."""
        query = f"""
            SELECT
                timestamp,
                event_type,
                deployment,
                from_replicas,
                to_replicas,
                trigger_metric,
                trigger_value,
                region
            FROM scaling_events
            WHERE timestamp >= now() - INTERVAL {days} DAY
            ORDER BY timestamp DESC
            LIMIT 100
        """
        return await self.clickhouse.query(query)

    # ─────────────────────────────────────────────────────────────────────────
    # Dashboard synthèse
    # ─────────────────────────────────────────────────────────────────────────

    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """
        Retourne un résumé global pour le dashboard Grafana / UI admin.
        Toutes les requêtes sont lancées en parallèle.
        """
        (
            mau,
            perf,
            error_rate,
            rps,
            regions,
        ) = await asyncio.gather(
            self.get_monthly_active_users(),
            self.get_api_performance(),
            self.get_error_rate(),
            self.get_requests_per_second(),
            self.get_users_by_region(),
            return_exceptions=True,
        )

        return {
            'monthly_active_users': mau if not isinstance(mau, Exception) else 0,
            'api_performance': perf if not isinstance(perf, Exception) else {},
            'error_rate_pct': error_rate if not isinstance(error_rate, Exception) else 0,
            'requests_per_second': rps if not isinstance(rps, Exception) else 0,
            'users_by_region': regions if not isinstance(regions, Exception) else [],
            'generated_at': datetime.utcnow().isoformat(),
        }


import asyncio
