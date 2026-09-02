import asyncpg
import os
from typing import Optional
from .postgres_provisioner import PostgresProvisioner


class DatabaseManager:
    """
    Gère les opérations SQL sur les bases de données de projets.
    Fait le lien entre le provisioner et les routes API.
    """

    def __init__(self, provisioner: PostgresProvisioner):
        self.provisioner = provisioner
        self._connections: dict = {}

    async def get_connection(self, project_id: str) -> Optional[asyncpg.Connection]:
        """Retourne (ou crée) une connexion vers la DB du projet"""
        if project_id in self._connections:
            return self._connections[project_id]

        conn_str = self.provisioner.get_connection_string(project_id)
        if not conn_str:
            return None

        conn = await asyncpg.connect(conn_str)
        self._connections[project_id] = conn
        return conn

    async def execute_query(self, project_id: str, query: str) -> dict:
        """
        Exécute une requête SQL dans la base du projet.
        Retourne un dict avec 'columns' et 'rows', ou 'error'.
        """
        conn = await self.get_connection(project_id)
        if not conn:
            return {'error': f"Aucune base de données trouvée pour le projet {project_id}"}

        try:
            result = await conn.fetch(query)

            if not result:
                return {'columns': [], 'rows': [], 'rowCount': 0}

            columns = list(result[0].keys())
            rows = [dict(row) for row in result]

            return {
                'columns': columns,
                'rows': rows,
                'rowCount': len(rows)
            }
        except Exception as e:
            return {'error': str(e)}

    async def execute_write(self, project_id: str, query: str) -> dict:
        """Exécute une requête d'écriture (INSERT, UPDATE, DELETE, CREATE)"""
        conn = await self.get_connection(project_id)
        if not conn:
            return {'error': f"Aucune base de données trouvée pour le projet {project_id}"}

        try:
            status = await conn.execute(query)
            return {'status': status, 'success': True}
        except Exception as e:
            return {'error': str(e), 'success': False}

    async def list_tables(self, project_id: str) -> list:
        """Liste toutes les tables de la base du projet avec le nombre de lignes"""
        conn = await self.get_connection(project_id)
        if not conn:
            return []

        try:
            tables = await conn.fetch(
                """
                SELECT
                    t.table_name AS name,
                    (SELECT COUNT(*) FROM information_schema.columns c
                     WHERE c.table_name = t.table_name) AS column_count
                FROM information_schema.tables t
                WHERE t.table_schema = 'public'
                  AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name
                """
            )

            result = []
            for table in tables:
                row_count_result = await conn.fetchval(
                    f'SELECT COUNT(*) FROM "{table["name"]}"'
                )
                result.append({
                    'name': table['name'],
                    'columnCount': table['column_count'],
                    'rowCount': row_count_result or 0
                })
            return result
        except Exception as e:
            return []

    async def get_table_schema(self, project_id: str, table_name: str) -> list:
        """Retourne le schéma d'une table (colonnes, types, contraintes)"""
        conn = await self.get_connection(project_id)
        if not conn:
            return []

        try:
            columns = await conn.fetch(
                """
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = $1
                ORDER BY ordinal_position
                """,
                table_name
            )
            return [dict(col) for col in columns]
        except Exception as e:
            return []

    async def close_connection(self, project_id: str):
        """Ferme la connexion d'un projet"""
        conn = self._connections.pop(project_id, None)
        if conn:
            await conn.close()

    async def close_all(self):
        """Ferme toutes les connexions ouvertes"""
        for project_id in list(self._connections.keys()):
            await self.close_connection(project_id)
