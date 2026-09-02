import asyncpg
import uuid
import os
from typing import Optional, Dict


class PostgresProvisioner:
    def __init__(self):
        self.admin_conn = None
        self.databases: Dict[str, dict] = {}

    async def initialize(self):
        """Connexion au serveur PostgreSQL admin"""
        self.admin_conn = await asyncpg.connect(
            host=os.getenv('PG_HOST', 'localhost'),
            user=os.getenv('PG_USER', 'postgres'),
            password=os.getenv('PG_PASSWORD'),
            database='postgres'
        )

    async def create_database(self, project_id: str) -> dict:
        """Crée une base de données dédiée pour un projet"""
        db_name = f"project_{project_id}_{uuid.uuid4().hex[:8]}"
        db_user = f"user_{project_id}_{uuid.uuid4().hex[:8]}"
        db_password = uuid.uuid4().hex

        await self.admin_conn.execute(
            f"CREATE USER {db_user} WITH PASSWORD '{db_password}'"
        )
        await self.admin_conn.execute(
            f"CREATE DATABASE {db_name} OWNER {db_user}"
        )
        await self.admin_conn.execute(
            f"GRANT ALL PRIVILEGES ON DATABASE {db_name} TO {db_user}"
        )

        self.databases[project_id] = {
            'name': db_name,
            'user': db_user,
            'password': db_password,
            'host': os.getenv('PG_HOST', 'localhost'),
            'port': int(os.getenv('PG_PORT', 5432))
        }

        return self.databases[project_id]

    async def delete_database(self, project_id: str):
        """Supprime la base de données d'un projet"""
        db_info = self.databases.get(project_id)
        if db_info:
            await self.admin_conn.execute(
                f"DROP DATABASE IF EXISTS {db_info['name']}"
            )
            await self.admin_conn.execute(
                f"DROP USER IF EXISTS {db_info['user']}"
            )
            del self.databases[project_id]

    def get_connection_string(self, project_id: str) -> Optional[str]:
        """Retourne la chaîne de connexion pour le projet"""
        db = self.databases.get(project_id)
        if db:
            return (
                f"postgresql://{db['user']}:{db['password']}"
                f"@{db['host']}:{db['port']}/{db['name']}"
            )
        return None

    def get_database_info(self, project_id: str) -> Optional[dict]:
        """Retourne les infos de la base de données d'un projet (sans password)"""
        db = self.databases.get(project_id)
        if db:
            return {
                'name': db['name'],
                'user': db['user'],
                'host': db['host'],
                'port': db['port']
            }
        return None

    def list_all(self) -> list:
        """Liste toutes les bases de données provisionnées"""
        return [
            {'project_id': pid, **{k: v for k, v in info.items() if k != 'password'}}
            for pid, info in self.databases.items()
        ]
