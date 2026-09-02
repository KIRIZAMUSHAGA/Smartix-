import os
import asyncio
import logging
from typing import List, Dict, Any, Optional

from clickhouse_driver import Client
from clickhouse_driver.errors import Error as ClickHouseError

logger = logging.getLogger(__name__)


class ClickHouseClient:
    """
    Client ClickHouse asynchrone pour stocker et analyser les métriques en temps réel.

    Utilise clickhouse-driver wrappé dans asyncio.to_thread pour les appels async.
    Le client est strict : toute erreur de connexion ou de requête est propagée.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        database: Optional[str] = None,
    ):
        self._host = host or os.getenv('CLICKHOUSE_HOST', 'localhost')
        self._port = port or int(os.getenv('CLICKHOUSE_PORT', '9000'))
        self._user = user or os.getenv('CLICKHOUSE_USER', 'default')
        self._password = password or os.getenv('CLICKHOUSE_PASSWORD', '')
        self._database = database or os.getenv('CLICKHOUSE_DATABASE', 'vibe_coding')
        self._client: Optional[Client] = None
        self._lock = asyncio.Lock()

    # ─────────────────────────────────────────────────────────────────────────
    # Connexion
    # ─────────────────────────────────────────────────────────────────────────

    def _build_client(self) -> Client:
        return Client(
            host=self._host,
            port=self._port,
            user=self._user,
            password=self._password,
            database=self._database,
            connect_timeout=10,
            send_receive_timeout=30,
            settings={'use_numpy': False},
        )

    async def connect(self) -> None:
        """Établit la connexion ClickHouse et vérifie qu'elle est fonctionnelle."""
        async with self._lock:
            if self._client is None:
                self._client = self._build_client()
            await asyncio.to_thread(self._client.execute, "SELECT 1")
            logger.info(f"✅ ClickHouse connecté : {self._host}:{self._port}/{self._database}")

    def _ensure_client(self) -> Client:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    async def disconnect(self) -> None:
        """Ferme la connexion ClickHouse proprement."""
        if self._client is not None:
            await asyncio.to_thread(self._client.disconnect)
            self._client = None

    # ─────────────────────────────────────────────────────────────────────────
    # Initialisation des tables
    # ─────────────────────────────────────────────────────────────────────────

    async def create_tables(self) -> None:
        """Crée la base et les tables ClickHouse si elles n'existent pas."""
        client = self._ensure_client()

        await asyncio.to_thread(
            client.execute,
            f"CREATE DATABASE IF NOT EXISTS {self._database}"
        )

        table_queries = [
            """
            CREATE TABLE IF NOT EXISTS vibe_metrics (
                timestamp   DateTime DEFAULT now(),
                user_id     String,
                project_id  String DEFAULT '',
                event_type  String,
                duration_ms UInt32 DEFAULT 0,
                metadata    String DEFAULT '',
                region      String DEFAULT 'eu-west'
            ) ENGINE = MergeTree()
            PARTITION BY toYYYYMM(timestamp)
            ORDER BY (timestamp, user_id)
            TTL timestamp + INTERVAL 1 YEAR
            """,
            """
            CREATE TABLE IF NOT EXISTS performance_metrics (
                timestamp        DateTime DEFAULT now(),
                endpoint         String,
                method           String DEFAULT 'GET',
                response_time_ms UInt32,
                status_code      UInt16,
                user_id          String DEFAULT 'anonymous',
                region           String DEFAULT 'eu-west',
                bytes_sent       UInt32 DEFAULT 0
            ) ENGINE = MergeTree()
            PARTITION BY toYYYYMM(timestamp)
            ORDER BY (timestamp, endpoint)
            TTL timestamp + INTERVAL 90 DAY
            """,
            """
            CREATE TABLE IF NOT EXISTS errors (
                timestamp     DateTime DEFAULT now(),
                error_type    String,
                error_message String,
                stack_trace   String DEFAULT '',
                user_id       String DEFAULT 'anonymous',
                project_id    String DEFAULT '',
                endpoint      String DEFAULT '',
                region        String DEFAULT 'eu-west'
            ) ENGINE = MergeTree()
            PARTITION BY toYYYYMM(timestamp)
            ORDER BY (timestamp, error_type)
            TTL timestamp + INTERVAL 6 MONTH
            """,
            """
            CREATE TABLE IF NOT EXISTS scaling_events (
                timestamp      DateTime DEFAULT now(),
                event_type     String,
                deployment     String,
                from_replicas  UInt8,
                to_replicas    UInt8,
                trigger_metric String DEFAULT '',
                trigger_value  Float64 DEFAULT 0,
                region         String DEFAULT 'eu-west'
            ) ENGINE = MergeTree()
            ORDER BY (timestamp, deployment)
            TTL timestamp + INTERVAL 1 YEAR
            """,
        ]

        for query in table_queries:
            await asyncio.to_thread(client.execute, query.strip())

        logger.info(f"✅ ClickHouse — {len(table_queries)} tables créées dans {self._database}")

    # ─────────────────────────────────────────────────────────────────────────
    # Écriture
    # ─────────────────────────────────────────────────────────────────────────

    async def insert_metric(self, table: str, data: Dict[str, Any]) -> None:
        """Insère une ligne dans une table ClickHouse."""
        client = self._ensure_client()
        keys = ', '.join(data.keys())
        query = f"INSERT INTO {table} ({keys}) VALUES"
        await asyncio.to_thread(client.execute, query, [list(data.values())])

    async def insert_batch(self, table: str, rows: List[Dict[str, Any]]) -> int:
        """Insère un lot de lignes dans une table. Retourne le nombre de lignes insérées."""
        if not rows:
            return 0
        client = self._ensure_client()
        keys = list(rows[0].keys())
        values = [list(row.values()) for row in rows]
        query = f"INSERT INTO {table} ({', '.join(keys)}) VALUES"
        await asyncio.to_thread(client.execute, query, values)
        return len(rows)

    # ─────────────────────────────────────────────────────────────────────────
    # Lecture
    # ─────────────────────────────────────────────────────────────────────────

    async def query(self, sql: str, params: Optional[Dict] = None) -> List[Dict]:
        """Exécute une requête SELECT et retourne les résultats sous forme de liste de dicts."""
        client = self._ensure_client()
        result = await asyncio.to_thread(
            client.execute, sql, params or {}, with_column_types=True
        )
        rows, columns = result
        col_names = [col[0] for col in columns]
        return [dict(zip(col_names, row)) for row in rows]

    async def query_scalar(self, sql: str) -> Any:
        """Retourne une seule valeur scalaire."""
        results = await self.query(sql)
        if results and results[0]:
            return list(results[0].values())[0]
        return None

    # ─────────────────────────────────────────────────────────────────────────
    # Santé
    # ─────────────────────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        """Vérifie la connexion à ClickHouse. Retourne True/False sans propager."""
        try:
            client = self._ensure_client()
            result = await asyncio.to_thread(client.execute, "SELECT 1")
            return result == [(1,)]
        except (ClickHouseError, OSError, ConnectionError):
            return False
