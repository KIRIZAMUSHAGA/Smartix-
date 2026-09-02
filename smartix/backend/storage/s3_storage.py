import os
import uuid
import logging
from typing import BinaryIO, List, Optional
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3Storage:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            endpoint_url=os.getenv('S3_ENDPOINT'),
            aws_access_key_id=os.getenv('S3_ACCESS_KEY'),
            aws_secret_access_key=os.getenv('S3_SECRET_KEY'),
            region_name=os.getenv('S3_REGION', 'us-east-1')
        )
        self.bucket = os.getenv('S3_BUCKET', 'vibe-coding-assets')
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Crée le bucket S3 s'il n'existe pas déjà"""
        try:
            self.s3.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                try:
                    self.s3.create_bucket(Bucket=self.bucket)
                    logger.info(f"Bucket S3 créé : {self.bucket}")
                except ClientError as create_err:
                    logger.error(f"Impossible de créer le bucket : {create_err}")
            else:
                logger.warning(f"Bucket check error: {e}")

    def _build_url(self, key: str) -> str:
        """Construit l'URL publique d'un objet"""
        endpoint = os.getenv('S3_ENDPOINT')
        if endpoint:
            return f"{endpoint}/{self.bucket}/{key}"
        return f"https://{self.bucket}.s3.amazonaws.com/{key}"

    async def upload_file(
        self,
        project_id: str,
        file: BinaryIO,
        filename: str,
        content_type: str = 'application/octet-stream'
    ) -> dict:
        """
        Upload un fichier vers S3.

        Returns:
            dict avec 'url', 'key', 'filename', 'size'
        """
        unique_id = uuid.uuid4().hex
        key = f"projects/{project_id}/assets/{unique_id}/{filename}"

        try:
            self.s3.upload_fileobj(
                file,
                self.bucket,
                key,
                ExtraArgs={
                    'ACL': 'public-read',
                    'ContentType': content_type
                }
            )

            url = self._build_url(key)
            logger.info(f"Fichier uploadé : {key}")

            return {
                'url': url,
                'key': key,
                'filename': filename,
                'project_id': project_id,
                'uploaded_at': datetime.utcnow().isoformat()
            }
        except ClientError as e:
            logger.error(f"Erreur upload S3 : {e}")
            raise

    async def list_assets(self, project_id: str) -> List[dict]:
        """Liste tous les assets d'un projet"""
        prefix = f"projects/{project_id}/assets/"

        try:
            response = self.s3.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix
            )

            assets = []
            for obj in response.get('Contents', []):
                filename = obj['Key'].split('/')[-1]
                assets.append({
                    'key': obj['Key'],
                    'filename': filename,
                    'size': obj['Size'],
                    'size_human': self._human_size(obj['Size']),
                    'last_modified': obj['LastModified'].isoformat(),
                    'url': self._build_url(obj['Key'])
                })
            return assets
        except ClientError as e:
            logger.error(f"Erreur listing S3 : {e}")
            return []

    async def delete_file(self, project_id: str, file_key: str) -> bool:
        """Supprime un fichier du bucket"""
        full_key = file_key if file_key.startswith(f"projects/{project_id}") else \
            f"projects/{project_id}/assets/{file_key}"

        try:
            self.s3.delete_object(Bucket=self.bucket, Key=full_key)
            logger.info(f"Fichier supprimé : {full_key}")
            return True
        except ClientError as e:
            logger.error(f"Erreur suppression S3 : {e}")
            return False

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Génère une URL présignée pour un accès temporaire privé"""
        try:
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            logger.error(f"Erreur génération URL présignée : {e}")
            raise

    async def delete_project_assets(self, project_id: str) -> int:
        """Supprime tous les assets d'un projet. Retourne le nombre de fichiers supprimés."""
        assets = await self.list_assets(project_id)
        count = 0

        for asset in assets:
            try:
                self.s3.delete_object(Bucket=self.bucket, Key=asset['key'])
                count += 1
            except ClientError:
                pass

        logger.info(f"Supprimé {count} assets du projet {project_id}")
        return count

    @staticmethod
    def _human_size(size_bytes: int) -> str:
        """Formate la taille en unité lisible"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"
