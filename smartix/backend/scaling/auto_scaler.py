import os
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable, Awaitable

from kubernetes import client as k8s_client, config as k8s_config
from kubernetes.client.exceptions import ApiException, ConfigException

from scaling.metrics_provider import MetricsProvider

logger = logging.getLogger(__name__)


class ScalingPolicy:
    """Définit une politique de scaling avec ses seuils."""

    def __init__(
        self,
        name: str,
        metric: str,
        scale_up_threshold: float,
        scale_down_threshold: float,
        scale_up_by: int = 1,
        scale_down_by: int = 1,
        cooldown_seconds: int = 120,
    ):
        self.name = name
        self.metric = metric
        self.scale_up_threshold = scale_up_threshold
        self.scale_down_threshold = scale_down_threshold
        self.scale_up_by = scale_up_by
        self.scale_down_by = scale_down_by
        self.cooldown_seconds = cooldown_seconds


class AutoScaler:
    """
    Gestionnaire de scaling automatique basé sur les métriques de MetricsProvider.
    Utilise l'API Kubernetes officielle (client-python) pour ajuster les replicas.

    Modes :
        - 'kubernetes' (défaut)  : utilise l'API K8s — config in-cluster ou kubeconfig
        - 'observe'              : observe les métriques et logge les décisions sans agir
                                   (utile pour les environnements sans cluster)
    """

    DEFAULT_POLICIES: List[ScalingPolicy] = [
        ScalingPolicy(
            name='cpu_high', metric='cpu_usage_pct',
            scale_up_threshold=70.0, scale_down_threshold=30.0,
            scale_up_by=2, scale_down_by=1, cooldown_seconds=120,
        ),
        ScalingPolicy(
            name='rps_high', metric='requests_per_second',
            scale_up_threshold=500.0, scale_down_threshold=100.0,
            scale_up_by=2, scale_down_by=1, cooldown_seconds=60,
        ),
        ScalingPolicy(
            name='response_time_degraded', metric='p95_response_time_ms',
            scale_up_threshold=2000.0, scale_down_threshold=500.0,
            scale_up_by=1, scale_down_by=0, cooldown_seconds=180,
        ),
        ScalingPolicy(
            name='error_rate_high', metric='error_rate_pct',
            scale_up_threshold=5.0, scale_down_threshold=1.0,
            scale_up_by=2, scale_down_by=0, cooldown_seconds=300,
        ),
        ScalingPolicy(
            name='active_users', metric='active_users',
            scale_up_threshold=200.0, scale_down_threshold=50.0,
            scale_up_by=1, scale_down_by=1, cooldown_seconds=90,
        ),
    ]

    def __init__(
        self,
        metrics_provider: MetricsProvider,
        deployment: str = 'vibe-coding-api',
        namespace: str = 'vibe-coding',
        min_replicas: int = 3,
        max_replicas: int = 20,
        check_interval: int = 30,
        on_scale_event: Optional[Callable[[Dict], Awaitable[None]]] = None,
        mode: Optional[str] = None,
    ):
        if metrics_provider is None:
            raise ValueError("metrics_provider est requis")

        self.metrics = metrics_provider
        self.deployment = deployment
        self.namespace = namespace
        self.min_replicas = min_replicas
        self.max_replicas = max_replicas
        self.check_interval = check_interval
        self.on_scale_event = on_scale_event
        self.mode = mode or os.getenv('AUTOSCALER_MODE', 'kubernetes')

        if self.mode not in ('kubernetes', 'observe'):
            raise ValueError(f"mode invalide : {self.mode} (attendu 'kubernetes' ou 'observe')")

        self.policies = self.DEFAULT_POLICIES
        self.current_replicas: int = min_replicas
        self._last_scale_at: Dict[str, datetime] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._history: list = []
        self._apps_v1: Optional[k8s_client.AppsV1Api] = None

    # ─────────────────────────────────────────────────────────────────────────
    # Initialisation Kubernetes
    # ─────────────────────────────────────────────────────────────────────────

    def _init_k8s_client(self) -> None:
        """Initialise le client Kubernetes (in-cluster ou kubeconfig)."""
        if self._apps_v1 is not None:
            return

        try:
            k8s_config.load_incluster_config()
            logger.info("✅ K8s : configuration in-cluster chargée")
        except ConfigException:
            try:
                k8s_config.load_kube_config()
                logger.info("✅ K8s : configuration kubeconfig chargée")
            except (ConfigException, FileNotFoundError) as e:
                raise RuntimeError(
                    f"Impossible d'initialiser le client Kubernetes : {e}. "
                    "Démarrez avec AUTOSCALER_MODE=observe pour les environnements sans K8s."
                )

        self._apps_v1 = k8s_client.AppsV1Api()

    # ─────────────────────────────────────────────────────────────────────────
    # Cycle de vie
    # ─────────────────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Démarre la boucle de vérification du scaling."""
        if self.mode == 'kubernetes':
            self._init_k8s_client()
            self.current_replicas = await self._get_current_replicas()
        else:
            logger.warning(
                f"AutoScaler en mode 'observe' — les décisions seront loggées sans action K8s"
            )

        self._running = True
        self._task = asyncio.create_task(self._check_loop())
        logger.info(
            f"✅ AutoScaler démarré [{self.mode}] — {self.deployment} "
            f"({self.min_replicas}–{self.max_replicas} replicas, "
            f"intervalle={self.check_interval}s, courant={self.current_replicas})"
        )

    async def stop(self) -> None:
        """Arrête l'AutoScaler proprement."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        logger.info("AutoScaler arrêté")

    # ─────────────────────────────────────────────────────────────────────────
    # Boucle principale
    # ─────────────────────────────────────────────────────────────────────────

    async def _check_loop(self) -> None:
        while self._running:
            try:
                await self._evaluate_scaling()
            except Exception as e:
                logger.error(f"Erreur AutoScaler : {e}")
            await asyncio.sleep(self.check_interval)

    async def _evaluate_scaling(self) -> None:
        """Évalue les politiques et applique les décisions."""
        snapshot = self.metrics.get_snapshot()
        scale_up_votes = 0
        scale_down_votes = 0
        triggered_policy: Optional[ScalingPolicy] = None
        trigger_value: float = 0.0

        for policy in self.policies:
            value = snapshot.get(policy.metric, 0.0)
            now = datetime.utcnow()
            last = self._last_scale_at.get(policy.name)
            if last and (now - last).total_seconds() < policy.cooldown_seconds:
                continue

            if value >= policy.scale_up_threshold and policy.scale_up_by > 0:
                scale_up_votes += policy.scale_up_by
                triggered_policy = policy
                trigger_value = value
            elif value <= policy.scale_down_threshold and policy.scale_down_by > 0:
                scale_down_votes += policy.scale_down_by

        if scale_up_votes > 0:
            target = min(self.current_replicas + scale_up_votes, self.max_replicas)
            if target > self.current_replicas:
                await self._scale_to(target, triggered_policy, trigger_value)
        elif scale_down_votes > 0:
            target = max(self.current_replicas - scale_down_votes, self.min_replicas)
            if target < self.current_replicas:
                await self._scale_to(target, None, 0.0)

    # ─────────────────────────────────────────────────────────────────────────
    # Exécution du scaling
    # ─────────────────────────────────────────────────────────────────────────

    async def _scale_to(
        self,
        target_replicas: int,
        policy: Optional[ScalingPolicy],
        trigger_value: float,
    ) -> None:
        """Applique le scaling via l'API Kubernetes."""
        from_replicas = self.current_replicas
        direction = 'UP' if target_replicas > from_replicas else 'DOWN'
        policy_name = policy.name if policy else 'manual'

        logger.info(
            f"🔄 Scaling {direction} : {from_replicas} → {target_replicas} replicas "
            f"(policy={policy_name}, trigger_value={trigger_value:.2f}, mode={self.mode})"
        )

        if self.mode == 'observe':
            success = True
        else:
            success = await self._k8s_patch_replicas(target_replicas)

        if success:
            self.current_replicas = target_replicas
            if policy:
                self._last_scale_at[policy.name] = datetime.utcnow()

            event = {
                'timestamp': datetime.utcnow().isoformat(),
                'direction': direction,
                'from': from_replicas,
                'to': target_replicas,
                'policy': policy_name,
                'trigger_metric': policy.metric if policy else '',
                'trigger_value': trigger_value,
                'mode': self.mode,
            }
            self._history.append(event)
            if len(self._history) > 100:
                self._history.pop(0)

            if self.on_scale_event:
                await self.on_scale_event(event)

    async def _k8s_patch_replicas(self, replicas: int) -> bool:
        """Patche le nombre de replicas via l'API Kubernetes."""
        if self._apps_v1 is None:
            self._init_k8s_client()

        body = {'spec': {'replicas': replicas}}
        try:
            await asyncio.to_thread(
                self._apps_v1.patch_namespaced_deployment_scale,
                name=self.deployment,
                namespace=self.namespace,
                body=body,
            )
            logger.info(f"✅ K8s patch_replicas → {replicas} OK")
            return True
        except ApiException as e:
            logger.error(f"❌ K8s API error ({e.status}) : {e.reason}")
            return False

    async def _get_current_replicas(self) -> int:
        """Récupère le nombre actuel de replicas depuis Kubernetes."""
        if self._apps_v1 is None:
            self._init_k8s_client()

        try:
            scale = await asyncio.to_thread(
                self._apps_v1.read_namespaced_deployment_scale,
                name=self.deployment,
                namespace=self.namespace,
            )
            return int(scale.spec.replicas or self.min_replicas)
        except ApiException as e:
            logger.warning(
                f"Impossible de lire les replicas ({e.reason}) — utilisation de min_replicas={self.min_replicas}"
            )
            return self.min_replicas

    # ─────────────────────────────────────────────────────────────────────────
    # Scaling manuel
    # ─────────────────────────────────────────────────────────────────────────

    async def scale_up(self, by: int = 1) -> Dict:
        target = min(self.current_replicas + by, self.max_replicas)
        await self._scale_to(target, None, 0.0)
        return {'replicas': self.current_replicas}

    async def scale_down(self, by: int = 1) -> Dict:
        target = max(self.current_replicas - by, self.min_replicas)
        await self._scale_to(target, None, 0.0)
        return {'replicas': self.current_replicas}

    async def set_replicas(self, replicas: int) -> Dict:
        clamped = max(self.min_replicas, min(replicas, self.max_replicas))
        await self._scale_to(clamped, None, 0.0)
        return {'replicas': self.current_replicas}

    # ─────────────────────────────────────────────────────────────────────────
    # Statut
    # ─────────────────────────────────────────────────────────────────────────

    def get_status(self) -> Dict:
        return {
            'deployment': self.deployment,
            'namespace': self.namespace,
            'mode': self.mode,
            'current_replicas': self.current_replicas,
            'min_replicas': self.min_replicas,
            'max_replicas': self.max_replicas,
            'running': self._running,
            'metrics_snapshot': self.metrics.get_snapshot(),
            'policies': [
                {
                    'name': p.name,
                    'metric': p.metric,
                    'scale_up_at': p.scale_up_threshold,
                    'scale_down_at': p.scale_down_threshold,
                    'last_triggered': self._last_scale_at[p.name].isoformat()
                                      if p.name in self._last_scale_at else None,
                }
                for p in self.policies
            ],
            'recent_events': self._history[-10:],
        }
