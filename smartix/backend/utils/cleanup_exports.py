"""
🧹 CLEANUP EXPORTS - Nettoyage automatique des fichiers d'export
Version production avec scheduler distribué, lock atomique et gestion de quota
Support Redis avec fallback, dry-run, et détection des orphelins
"""

import os
import time
import logging
import asyncio
import uuid
import shutil
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from enum import Enum

from cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class CleanupTrigger(str, Enum):
    """Type de déclenchement du nettoyage"""
    SCHEDULED = "scheduled"
    DISK_PRESSURE = "disk_pressure"
    MANUAL = "manual"
    STARTUP = "startup"
    ORPHAN = "orphan"


class ExportCleanup:
    """
    Nettoie les exports expirés automatiquement
    Conçu pour être appelé par un scheduler externe (cron, k8s CronJob)
    Support multi-instance avec lock atomique Redis
    """
    
    # Clés Redis
    LOCK_KEY = "export:cleanup:lock"
    LAST_RUN_KEY = "export:cleanup:last_run"
    STATS_KEY = "export:cleanup:stats"
    TASK_INDEX_PREFIX = "export:task:file:"
    ORPHAN_SCAN_KEY = "export:cleanup:orphan_scan"
    
    def __init__(
        self, 
        exports_folder: str, 
        retention_seconds: int = 3600,
        max_disk_usage_mb: int = 10240,  # 10GB max
        disk_pressure_threshold_mb: int = 8192,  # 8GB = nettoyage agressif
        max_files_per_scan: int = 10000,
        enable_orphan_detection: bool = True,
        webhook_url: Optional[str] = None
    ):
        """
        Initialise le nettoyeur
        
        Args:
            exports_folder: Chemin du dossier des exports
            retention_seconds: Durée de rétention en secondes (défaut: 1 heure)
            max_disk_usage_mb: Usage disque maximum avant nettoyage forcé
            disk_pressure_threshold_mb: Seuil de pression disque pour nettoyage agressif
            max_files_per_scan: Nombre max de fichiers à scanner par cycle
            enable_orphan_detection: Activer la détection des fichiers orphelins
            webhook_url: URL de notification pour les nettoyages importants
        """
        self.exports_folder = Path(exports_folder)
        self.retention_seconds = retention_seconds
        self.max_disk_usage_mb = max_disk_usage_mb
        self.disk_pressure_threshold_mb = disk_pressure_threshold_mb
        self.max_files_per_scan = max_files_per_scan
        self.enable_orphan_detection = enable_orphan_detection
        self.webhook_url = webhook_url
        
        # Assurer que le dossier existe
        self.exports_folder.mkdir(parents=True, exist_ok=True)
        
        logger.info(
            f"🧹 ExportCleanup initialized "
            f"(folder: {exports_folder}, retention: {retention_seconds}s, "
            f"max_disk: {max_disk_usage_mb}MB, threshold: {disk_pressure_threshold_mb}MB, "
            f"orphan_detection: {enable_orphan_detection})"
        )
    
    async def _get_redis_client(self):
        """Récupère le client Redis brut pour les opérations avancées"""
        try:
            # Essayer différentes méthodes d'accès
            if hasattr(redis_cache, 'get_client'):
                return await redis_cache.get_client()
            if hasattr(redis_cache, '_client'):
                return redis_cache._client
            if hasattr(redis_cache, 'client'):
                return redis_cache.client
            # Fallback: retourner redis_cache lui-même
            return redis_cache
        except Exception as e:
            logger.error(f"Failed to get Redis client: {e}")
            return None
    
    async def _acquire_lock(self, ttl_seconds: int = 300) -> Optional[str]:
        """
        Acquiert un lock Redis atomique
        
        Returns:
            Token du lock si acquis, None sinon
        """
        redis_client = await self._get_redis_client()
        if not redis_client:
            logger.warning("Redis unavailable, skipping lock")
            return str(uuid.uuid4())  # Fallback: token local
        
        lock_token = str(uuid.uuid4())
        
        try:
            # SET NX EX atomique
            acquired = await redis_client.set(
                self.LOCK_KEY,
                lock_token,
                nx=True,
                ex=ttl_seconds
            )
            
            if acquired:
                logger.debug(f"Cleanup lock acquired (token: {lock_token[:8]})")
                return lock_token
            else:
                logger.debug("Cleanup lock already held by another instance")
                return None
        except Exception as e:
            logger.error(f"Error acquiring lock: {e}")
            return None
    
    async def _release_lock(self, lock_token: str) -> bool:
        """
        Libère le lock Redis avec vérification du token (Lua script atomique)
        
        Returns:
            True si le lock a été libéré, False sinon
        """
        redis_client = await self._get_redis_client()
        if not redis_client:
            logger.warning("Redis unavailable, cannot release lock")
            return True  # Fallback: considérer comme libéré
        
        lua_script = """
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        else
            return 0
        end
        """
        
        try:
            result = await redis_client.eval(lua_script, 1, self.LOCK_KEY, lock_token)
            if result:
                logger.debug(f"Cleanup lock released (token: {lock_token[:8]})")
            else:
                logger.warning("Lock token mismatch, not releasing")
            return bool(result)
        except Exception as e:
            logger.error(f"Error releasing lock: {e}")
            return False
    
    async def _get_disk_usage(self) -> Tuple[int, int]:
        """
        Calcule l'utilisation disque du dossier d'exports
        
        Returns:
            Tuple (total_bytes, total_files)
        """
        total_bytes = 0
        total_files = 0
        
        try:
            # Parcourir les fichiers
            for item in self.exports_folder.iterdir():
                if item.is_file():
                    total_files += 1
                    try:
                        total_bytes += item.stat().st_size
                    except OSError:
                        continue
                elif item.is_dir() and self.enable_orphan_detection:
                    # Parcourir les sous-dossiers (un niveau uniquement)
                    for subitem in item.iterdir():
                        if subitem.is_file():
                            total_files += 1
                            try:
                                total_bytes += subitem.stat().st_size
                            except OSError:
                                continue
            
            logger.debug(f"Disk usage: {total_bytes / (1024*1024):.1f}MB / {total_files} files")
            
        except Exception as e:
            logger.error(f"Error calculating disk usage: {e}")
        
        return total_bytes, total_files
    
    async def _get_files_to_delete(self, aggressive: bool = False) -> List[Tuple[Path, float, Optional[str]]]:
        """
        Récupère la liste des fichiers à supprimer
        Utilise une approche partitionnée pour scalabilité
        
        Args:
            aggressive: Mode agressif (supprime plus de fichiers)
        
        Returns:
            Liste de tuples (filepath, file_age_seconds, task_id)
        """
        files_to_delete = []
        now = time.time()
        scanned = 0
        
        # Ajuster la rétention en mode agressif
        effective_retention = self.retention_seconds / 2 if aggressive else self.retention_seconds
        
        try:
            # Parcourir les fichiers
            for item in self.exports_folder.iterdir():
                if scanned >= self.max_files_per_scan:
                    logger.warning(f"Scan limit reached ({self.max_files_per_scan}), stopping")
                    break
                
                if item.is_file():
                    scanned += 1
                    try:
                        mtime = item.stat().st_mtime
                        file_age = now - mtime
                        task_id = item.stem  # Nom du fichier sans extension
                        
                        if file_age > effective_retention:
                            files_to_delete.append((item, file_age, task_id))
                            
                    except OSError as e:
                        logger.warning(f"Cannot get stats for {item}: {e}")
                        continue
                        
                elif item.is_dir() and self.enable_orphan_detection:
                    # Support des dossiers partitionnés (un niveau uniquement)
                    for subitem in item.iterdir():
                        if scanned >= self.max_files_per_scan:
                            break
                        if subitem.is_file():
                            scanned += 1
                            try:
                                mtime = subitem.stat().st_mtime
                                file_age = now - mtime
                                task_id = subitem.stem
                                if file_age > effective_retention:
                                    files_to_delete.append((subitem, file_age, task_id))
                            except OSError:
                                continue
                            
        except Exception as e:
            logger.error(f"Error scanning files: {e}")
        
        # Trier par âge (plus vieux d'abord)
        files_to_delete.sort(key=lambda x: x[1], reverse=True)
        
        logger.info(f"Found {len(files_to_delete)} files to delete (scanned: {scanned})")
        return files_to_delete
    
    async def _find_orphan_files(self) -> List[Path]:
        """
        Trouve les fichiers sans tâche associée dans Redis
        
        Returns:
            Liste des fichiers orphelins
        """
        orphans = []
        redis_client = await self._get_redis_client()
        
        if not redis_client:
            logger.warning("Redis unavailable, cannot detect orphans")
            return []
        
        try:
            for item in self.exports_folder.iterdir():
                if item.is_file():
                    task_id = item.stem
                    task_key = f"{self.TASK_INDEX_PREFIX}{task_id}"
                    exists = await redis_client.get(task_key)
                    
                    if not exists:
                        orphans.append(item)
                        logger.debug(f"Orphan file detected: {item}")
                        
        except Exception as e:
            logger.error(f"Error finding orphans: {e}")
        
        return orphans
    
    async def _delete_file_with_tracking(self, filepath: Path, task_id: Optional[str] = None) -> bool:
        """
        Supprime un fichier et met à jour l'index Redis
        """
        try:
            # Si task_id fourni, vérifier l'existence dans Redis
            if task_id:
                redis_client = await self._get_redis_client()
                if redis_client:
                    task_key = f"{self.TASK_INDEX_PREFIX}{task_id}"
                    expected_path = await redis_client.get(task_key)
                    if expected_path:
                        if isinstance(expected_path, bytes):
                            expected_path = expected_path.decode()
                        if expected_path != str(filepath):
                            logger.warning(f"Task {task_id} path mismatch: {expected_path} vs {filepath}")
            
            # Supprimer le fichier
            filepath.unlink()
            
            # Supprimer l'index Redis si existant
            if task_id:
                redis_client = await self._get_redis_client()
                if redis_client:
                    await redis_client.delete(f"{self.TASK_INDEX_PREFIX}{task_id}")
            
            logger.debug(f"Deleted: {filepath}")
            return True
            
        except PermissionError:
            logger.error(f"Permission denied: {filepath}")
            return False
        except OSError as e:
            logger.error(f"Failed to delete {filepath}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting {filepath}: {e}")
            return False
    
    async def _send_notification(self, result: Dict[str, Any]):
        """Envoie une notification webhook pour les nettoyages importants"""
        if not self.webhook_url:
            return
        
        if result.get('deleted_files', 0) == 0:
            return
        
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                await session.post(self.webhook_url, json=result, timeout=aiohttp.ClientTimeout(total=5))
                logger.debug(f"Notification sent to {self.webhook_url}")
        except Exception as e:
            logger.warning(f"Failed to send notification: {e}")
    
    async def _update_stats(self, deleted_count: int, deleted_bytes: int, trigger: CleanupTrigger):
        """
        Met à jour les statistiques dans Redis
        """
        redis_client = await self._get_redis_client()
        if not redis_client:
            return
        
        stats = {
            'last_cleanup_time': datetime.utcnow().isoformat(),
            'last_cleanup_trigger': trigger.value,
            'last_cleanup_files': deleted_count,
            'last_cleanup_bytes': deleted_bytes,
            'total_cleanups': 0,
            'total_files_deleted': 0,
            'total_bytes_deleted': 0
        }
        
        # Récupérer les stats existantes
        existing = await redis_client.get(self.STATS_KEY)
        if existing:
            if isinstance(existing, bytes):
                existing = existing.decode()
            try:
                existing_stats = json.loads(existing)
                stats['total_cleanups'] = existing_stats.get('total_cleanups', 0) + 1
                stats['total_files_deleted'] = existing_stats.get('total_files_deleted', 0) + deleted_count
                stats['total_bytes_deleted'] = existing_stats.get('total_bytes_deleted', 0) + deleted_bytes
            except (json.JSONDecodeError, TypeError):
                pass
        
        try:
            await redis_client.setex(self.STATS_KEY, 86400 * 7, json.dumps(stats, default=str))
            await redis_client.set(self.LAST_RUN_KEY, datetime.utcnow().isoformat())
        except Exception as e:
            logger.error(f"Error updating stats: {e}")
    
    async def run_cleanup(
        self, 
        trigger: CleanupTrigger = CleanupTrigger.SCHEDULED,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Exécute le nettoyage avec lock atomique Redis
        
        Args:
            trigger: Type de déclenchement
            dry_run: Simuler sans supprimer
        
        Returns:
            Statistiques du nettoyage
        """
        start_time = time.time()
        
        # Acquérir le lock
        lock_token = await self._acquire_lock()
        if not lock_token:
            return {
                'success': False,
                'error': 'Cleanup already running on another instance',
                'trigger': trigger.value,
                'dry_run': dry_run
            }
        
        try:
            # Vérifier l'utilisation disque
            total_bytes, total_files = await self._get_disk_usage()
            total_mb = total_bytes / (1024 * 1024)
            
            # Déterminer le mode
            is_critical = total_mb > self.max_disk_usage_mb
            is_disk_pressure = total_mb > self.disk_pressure_threshold_mb
            aggressive = is_critical or is_disk_pressure
            
            if is_critical:
                logger.warning(f"CRITICAL: Disk usage {total_mb:.1f}MB > {self.max_disk_usage_mb}MB")
            elif is_disk_pressure:
                logger.warning(f"Disk pressure: {total_mb:.1f}MB > {self.disk_pressure_threshold_mb}MB")
            
            # Récupérer les fichiers à supprimer
            files_to_delete = await self._get_files_to_delete(aggressive)
            
            # Détecter les orphelins si activé
            orphans = []
            if self.enable_orphan_detection and not aggressive:
                orphans = await self._find_orphan_files()
                if orphans:
                    logger.info(f"Found {len(orphans)} orphan files")
                    for orphan in orphans:
                        # Vérifier si l'orphan n'est pas déjà dans la liste
                        if not any(f[0] == orphan for f in files_to_delete):
                            file_age = time.time() - orphan.stat().st_mtime
                            files_to_delete.append((orphan, file_age, orphan.stem))
            
            deleted_count = 0
            deleted_bytes = 0
            deleted_paths = []
            errors = []
            
            # Supprimer les fichiers
            for filepath, file_age, task_id in files_to_delete:
                file_size = filepath.stat().st_size  # Avant suppression
                
                if dry_run:
                    logger.info(f"DRY RUN: Would delete {filepath} ({file_size / 1024:.1f}KB, age: {file_age:.0f}s)")
                    deleted_count += 1
                    deleted_bytes += file_size
                    deleted_paths.append(str(filepath))
                else:
                    success = await self._delete_file_with_tracking(filepath, task_id)
                    if success:
                        deleted_count += 1
                        deleted_bytes += file_size
                        deleted_paths.append(str(filepath))
                    else:
                        errors.append(str(filepath))
            
            # Mettre à jour les statistiques (sauf en dry-run)
            if not dry_run:
                await self._update_stats(deleted_count, deleted_bytes, trigger)
            
            # Envoyer notification pour les nettoyages importants
            if not dry_run and (deleted_count > 100 or deleted_bytes > 100 * 1024 * 1024):
                result_data = {
                    'success': True,
                    'trigger': trigger.value,
                    'deleted_files': deleted_count,
                    'deleted_bytes': deleted_bytes,
                    'deleted_mb': round(deleted_bytes / (1024 * 1024), 2),
                    'disk_usage_mb': round(total_mb, 2)
                }
                await self._send_notification(result_data)
            
            duration = time.time() - start_time
            
            result = {
                'success': True,
                'trigger': trigger.value,
                'dry_run': dry_run,
                'duration_seconds': round(duration, 2),
                'deleted_files': deleted_count,
                'deleted_bytes': deleted_bytes,
                'deleted_mb': round(deleted_bytes / (1024 * 1024), 2),
                'deleted_paths': deleted_paths[:10],  # Limiter pour la réponse
                'errors': errors[:10],
                'disk_usage_mb': round(total_mb, 2),
                'disk_total_files': total_files,
                'aggressive_mode': aggressive,
                'critical_mode': is_critical,
                'orphans_found': len(orphans)
            }
            
            logger.info(
                f"🧹 Cleanup completed{' (DRY RUN)' if dry_run else ''}: "
                f"{deleted_count} files ({result['deleted_mb']}MB) "
                f"in {duration:.2f}s | Disk: {total_mb:.1f}MB / {total_files} files"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Cleanup error: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'trigger': trigger.value,
                'dry_run': dry_run
            }
        finally:
            await self._release_lock(lock_token)
    
    async def register_task_file(self, task_id: str, filepath: str) -> None:
        """
        Enregistre l'association entre une tâche et son fichier dans Redis
        
        Permet un nettoyage plus précis et la détection des orphelins
        """
        redis_client = await self._get_redis_client()
        if not redis_client:
            return
        
        key = f"{self.TASK_INDEX_PREFIX}{task_id}"
        # Utiliser une TTL fixe pour éviter les fichiers orphelins
        ttl = max(self.retention_seconds * 2, 86400)  # Au moins 24h
        await redis_client.setex(key, ttl, str(filepath))
        logger.debug(f"Registered task file: {task_id} -> {filepath}")
    
    async def unregister_task_file(self, task_id: str) -> None:
        """Supprime l'association d'une tâche"""
        redis_client = await self._get_redis_client()
        if redis_client:
            await redis_client.delete(f"{self.TASK_INDEX_PREFIX}{task_id}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques du nettoyage"""
        redis_client = await self._get_redis_client()
        
        # Récupérer les stats Redis
        stats_data = {}
        if redis_client:
            stats = await redis_client.get(self.STATS_KEY)
            if stats:
                if isinstance(stats, bytes):
                    stats = stats.decode()
                try:
                    stats_data = json.loads(stats)
                except (json.JSONDecodeError, TypeError):
                    pass
            
            last_run = await redis_client.get(self.LAST_RUN_KEY)
            if last_run and isinstance(last_run, bytes):
                last_run = last_run.decode()
        else:
            last_run = None
        
        # Statistiques du dossier
        total_bytes, total_files = await self._get_disk_usage()
        
        return {
            'cleanup_stats': stats_data,
            'last_run': last_run,
            'current_disk': {
                'total_files': total_files,
                'total_bytes': total_bytes,
                'total_mb': round(total_bytes / (1024 * 1024), 2),
                'max_allowed_mb': self.max_disk_usage_mb,
                'pressure_threshold_mb': self.disk_pressure_threshold_mb
            },
            'config': {
                'exports_folder': str(self.exports_folder),
                'retention_seconds': self.retention_seconds,
                'max_files_per_scan': self.max_files_per_scan,
                'enable_orphan_detection': self.enable_orphan_detection
            }
        }


# =============================
# INSTANCE GLOBALE
# =============================

_cleanup_instance: Optional[ExportCleanup] = None


def init_cleanup(
    exports_folder: Optional[str] = None,
    retention_seconds: int = 3600,
    max_disk_usage_mb: int = 10240,
    disk_pressure_threshold_mb: int = 8192,
    max_files_per_scan: int = 10000,
    enable_orphan_detection: bool = True,
    webhook_url: Optional[str] = None
) -> ExportCleanup:
    """
    Initialise l'instance globale de nettoyage
    
    Cette instance est conçue pour être appelée par un scheduler externe
    (cron, k8s CronJob), pas par un thread interne.
    """
    global _cleanup_instance
    
    if exports_folder is None:
        exports_folder = os.environ.get('EXPORTS_FOLDER', os.path.join(os.path.dirname(__file__), '../../exports'))
    
    if webhook_url is None:
        webhook_url = os.environ.get('CLEANUP_WEBHOOK_URL')
    
    _cleanup_instance = ExportCleanup(
        exports_folder=exports_folder,
        retention_seconds=retention_seconds,
        max_disk_usage_mb=max_disk_usage_mb,
        disk_pressure_threshold_mb=disk_pressure_threshold_mb,
        max_files_per_scan=max_files_per_scan,
        enable_orphan_detection=enable_orphan_detection,
        webhook_url=webhook_url
    )
    
    return _cleanup_instance


async def run_scheduled_cleanup(dry_run: bool = False) -> Dict[str, Any]:
    """
    Exécute un nettoyage programmé (appelé par cron/k8s)
    """
    if not _cleanup_instance:
        init_cleanup()
    
    return await _cleanup_instance.run_cleanup(CleanupTrigger.SCHEDULED, dry_run=dry_run)


async def run_disk_pressure_cleanup(dry_run: bool = False) -> Dict[str, Any]:
    """
    Exécute un nettoyage d'urgence en cas de pression disque
    """
    if not _cleanup_instance:
        init_cleanup()
    
    return await _cleanup_instance.run_cleanup(CleanupTrigger.DISK_PRESSURE, dry_run=dry_run)


async def run_orphan_cleanup(dry_run: bool = False) -> Dict[str, Any]:
    """
    Exécute un nettoyage spécifique pour les fichiers orphelins
    """
    if not _cleanup_instance:
        init_cleanup()
    
    return await _cleanup_instance.run_cleanup(CleanupTrigger.ORPHAN, dry_run=dry_run)


async def register_export_file(task_id: str, filepath: str) -> None:
    """
    Enregistre un fichier d'export pour tracking
    """
    if _cleanup_instance:
        await _cleanup_instance.register_task_file(task_id, filepath)


async def unregister_export_file(task_id: str) -> None:
    """
    Supprime l'enregistrement d'un fichier d'export
    """
    if _cleanup_instance:
        await _cleanup_instance.unregister_task_file(task_id)


async def get_cleanup_stats() -> Dict[str, Any]:
    """
    Retourne les statistiques du nettoyage
    """
    if not _cleanup_instance:
        init_cleanup()
    
    return await _cleanup_instance.get_stats()


# =============================
# INTÉGRATION AVEC L'APPLICATION
# =============================

async def startup_cleanup():
    """Initialise le cleanup au démarrage (sans démarrer de thread)"""
    init_cleanup()
    logger.info("🧹 Export cleanup initialized (external scheduler required)")


# =============================
# COMMAND LINE INTERFACE
# =============================

if __name__ == "__main__":
    """
    Point d'entrée pour l'exécution en tant que script indépendant
    Usage: python cleanup_exports.py [--run] [--dry-run] [--stats] [--orphan]
    """
    import argparse
    import asyncio
    
    parser = argparse.ArgumentParser(description="Export cleanup tool")
    parser.add_argument("--run", action="store_true", help="Run cleanup now")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without deleting")
    parser.add_argument("--stats", action="store_true", help="Show cleanup stats")
    parser.add_argument("--orphan", action="store_true", help="Run orphan file cleanup")
    parser.add_argument("--folder", type=str, help="Exports folder path")
    parser.add_argument("--retention", type=int, default=3600, help="Retention seconds")
    parser.add_argument("--webhook", type=str, help="Webhook URL for notifications")
    
    args = parser.parse_args()
    
    async def main():
        init_cleanup(
            exports_folder=args.folder,
            retention_seconds=args.retention,
            webhook_url=args.webhook
        )
        
        if args.stats:
            stats = await get_cleanup_stats()
            print(json.dumps(stats, indent=2, default=str))
        
        if args.orphan:
            result = await run_orphan_cleanup(dry_run=args.dry_run)
            print(f"Orphan cleanup result: {result}")
        
        if args.run:
            result = await run_scheduled_cleanup(dry_run=args.dry_run)
            print(f"Cleanup result: {result}")
    
    asyncio.run(main())
