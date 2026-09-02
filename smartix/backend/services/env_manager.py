"""
EnvManager — Gestion sécurisée des variables d'environnement par projet.

Chaque variable est chiffrée avec Fernet (AES-128-CBC + HMAC-SHA256)
avant d'être stockée en base de données MongoDB.
La clé de chiffrement est lue depuis PG_PASSWORD ou ENV_SECRET_KEY.
"""

import base64
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# ─── Clé Fernet ─────────────────────────────────────────────────────────────

def _build_fernet_key() -> bytes:
    """Dérive une clé Fernet valide (32 bytes base64-url) depuis la config."""
    raw = os.getenv('ENV_SECRET_KEY') or os.getenv('PG_PASSWORD') or 'vibe-coding-default-secret-key-32'
    raw_bytes = raw.encode()
    padded = (raw_bytes * ((32 // len(raw_bytes)) + 1))[:32]
    return base64.urlsafe_b64encode(padded)


_fernet = Fernet(_build_fernet_key())


def encrypt_value(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        return ''


# ─── EnvManager ─────────────────────────────────────────────────────────────

class EnvManager:
    """
    Gère les variables d'environnement par projet.
    Chaque variable est stockée chiffrée dans MongoDB (collection `project_env_vars`).
    """

    COLLECTION = 'project_env_vars'

    def __init__(self, db=None):
        self._db = db

    def set_db(self, db):
        self._db = db

    def _col(self):
        if self._db is None:
            raise RuntimeError("EnvManager: base de données non initialisée")
        return self._db[self.COLLECTION]

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def set_var(self, project_id: str, key: str, value: str) -> dict:
        """Crée ou met à jour une variable (la valeur est chiffrée)."""
        key = key.strip().upper()
        if not key:
            raise ValueError("La clé ne peut pas être vide")

        encrypted = encrypt_value(value)

        col = self._col()
        existing = await col.find_one({'project_id': project_id, 'key': key})

        now = datetime.utcnow()
        if existing:
            await col.update_one(
                {'project_id': project_id, 'key': key},
                {'$set': {'encrypted_value': encrypted, 'updated_at': now}}
            )
        else:
            await col.insert_one({
                'project_id': project_id,
                'key': key,
                'encrypted_value': encrypted,
                'created_at': now,
                'updated_at': now
            })

        return {'key': key, 'is_secret': True}

    async def set_many(self, project_id: str, vars_dict: Dict[str, str]) -> int:
        """Crée ou met à jour plusieurs variables d'un coup."""
        count = 0
        for key, value in vars_dict.items():
            await self.set_var(project_id, key, value)
            count += 1
        return count

    async def delete_var(self, project_id: str, key: str) -> bool:
        """Supprime une variable."""
        result = await self._col().delete_one({'project_id': project_id, 'key': key.upper()})
        return result.deleted_count > 0

    async def delete_all(self, project_id: str) -> int:
        """Supprime toutes les variables d'un projet."""
        result = await self._col().delete_many({'project_id': project_id})
        return result.deleted_count

    async def list_keys(self, project_id: str) -> List[dict]:
        """
        Liste toutes les variables d'un projet.
        Retourne les clés et les métadonnées SANS les valeurs déchiffrées.
        """
        cursor = self._col().find(
            {'project_id': project_id},
            {'_id': 0, 'encrypted_value': 0}
        ).sort('key', 1)

        results = []
        async for doc in cursor:
            results.append({
                'key': doc['key'],
                'created_at': doc.get('created_at', '').isoformat() if doc.get('created_at') else None,
                'updated_at': doc.get('updated_at', '').isoformat() if doc.get('updated_at') else None
            })
        return results

    async def get_decrypted(self, project_id: str, key: str) -> Optional[str]:
        """Retourne la valeur déchiffrée d'une variable (usage interne)."""
        doc = await self._col().find_one({'project_id': project_id, 'key': key.upper()})
        if not doc:
            return None
        return decrypt_value(doc['encrypted_value'])

    async def get_all_decrypted(self, project_id: str) -> Dict[str, str]:
        """
        Retourne toutes les variables déchiffrées sous forme de dict.
        Utilisé uniquement en interne pour injecter dans les containers.
        """
        cursor = self._col().find({'project_id': project_id})
        result = {}
        async for doc in cursor:
            result[doc['key']] = decrypt_value(doc['encrypted_value'])
        return result

    async def export_dotenv(self, project_id: str) -> str:
        """Génère le contenu d'un fichier .env pour le projet."""
        all_vars = await self.get_all_decrypted(project_id)
        lines = [f'{k}={v}' for k, v in sorted(all_vars.items())]
        return '\n'.join(lines)

    async def import_dotenv(self, project_id: str, content: str) -> int:
        """Importe les variables depuis le contenu d'un fichier .env."""
        count = 0
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key:
                    await self.set_var(project_id, key, value)
                    count += 1
        return count


env_manager = EnvManager()
