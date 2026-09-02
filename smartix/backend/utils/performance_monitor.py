"""
Moniteur de performance pour détection auto-disable du système réactions
Détecte FPS bas, charge CPU, etc.
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Dict

logger = logging.getLogger(__name__)


class PerformanceMonitor:
    """Monitor les performances du système réactions"""
    
    def __init__(self, 
                 min_fps_threshold: int = 20,
                 check_interval_seconds: int = 5,
                 alert_threshold: int = 3):
        self.min_fps_threshold = min_fps_threshold
        self.check_interval_seconds = check_interval_seconds
        self.alert_threshold = alert_threshold
        
        # Tracking
        self.frame_times: Dict[str, list] = {}  # device_id -> [timestamps]
        self.last_check: Dict[str, datetime] = {}  # device_id -> last check time
        self.performance_alerts: Dict[str, int] = {}  # device_id -> alert count
        self.disabled_devices: set = set()  # devices where reactions are disabled
    
    def record_frame(self, device_id: str):
        """Enregistrer un frame rendu"""
        now = time.time()
        
        if device_id not in self.frame_times:
            self.frame_times[device_id] = []
        
        self.frame_times[device_id].append(now)
        
        # Garder seulement les 60 dernières frames (1 seconde à 60fps)
        if len(self.frame_times[device_id]) > 60:
            self.frame_times[device_id].pop(0)
    
    def get_fps(self, device_id: str) -> float:
        """Calculer le FPS actuel"""
        if device_id not in self.frame_times or len(self.frame_times[device_id]) < 2:
            return 60.0  # Défaut
        
        times = self.frame_times[device_id]
        elapsed = times[-1] - times[0]
        
        if elapsed == 0:
            return 60.0
        
        fps = (len(times) - 1) / elapsed
        return fps
    
    def check_performance(self, device_id: str) -> bool:
        """Vérifier si le système réactions doit être désactivé
        
        Returns:
            True si actif, False si doit être désactivé
        """
        # Si déjà désactivé, ne pas réactiver
        if device_id in self.disabled_devices:
            return False
        
        # Check interval
        now = datetime.now()
        last = self.last_check.get(device_id)
        
        if last and (now - last).total_seconds() < self.check_interval_seconds:
            return True
        
        self.last_check[device_id] = now
        
        # Get FPS
        fps = self.get_fps(device_id)
        
        # Si FPS < threshold, alerter
        if fps < self.min_fps_threshold:
            alerts = self.performance_alerts.get(device_id, 0) + 1
            self.performance_alerts[device_id] = alerts
            
            logger.warning(f"⚠️ Low FPS detected on {device_id}: {fps:.1f} FPS (alert #{alerts})")
            
            # Si trop d'alertes, désactiver
            if alerts >= self.alert_threshold:
                self.disabled_devices.add(device_id)
                logger.error(f"🔴 Reactions disabled on {device_id} - FPS too low")
                return False
        else:
            # Reset alerts si FPS redevient bon
            self.performance_alerts[device_id] = 0
        
        return True
    
    def should_disable_reactions(self, device_id: str) -> bool:
        """Vérifier si les réactions doivent être désactivées"""
        return device_id in self.disabled_devices
    
    def enable_reactions(self, device_id: str):
        """Réactiver les réactions (après diagnostic)"""
        self.disabled_devices.discard(device_id)
        self.performance_alerts[device_id] = 0
        self.frame_times[device_id] = []
        logger.info(f"✅ Reactions re-enabled on {device_id}")


# Instance globale
perf_monitor = PerformanceMonitor(
    min_fps_threshold=20,
    check_interval_seconds=5,
    alert_threshold=3
)
