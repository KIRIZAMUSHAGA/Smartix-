"""
Gestionnaire temps réel des réactions story - ANIMATIONS VISUELLES ÉPHÉMÈRES UNIQUEMENT
⚠️ IMPORTANT: Ce gestionnaire est UNIQUEMENT pour les animations visuelles temporaires (7s TTL)
⚠️ LES COMMENTAIRES/LIKES PERSISTANTS VIENNENT EXCLUSIVEMENT DE LA DB

Architecture:
- Throttling par utilisateur (300ms min entre événements)
- Agrégation automatique ("+8 réactions" au lieu de 8 individuelles)
- TTL cleanup: Job scheduler global (évite 1000+ tasks par réaction)
- Limitation: max 5 animations visuelles simultanées par story
- Durée: 7 secondes max - puis expiration automatique
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from collections import defaultdict
import logging
import time

logger = logging.getLogger(__name__)


class StoryReactionThrottler:
    """Throttle et agrège les événements de réactions story temps réel"""
    
    def __init__(self, throttle_ms: int = 300, max_queue_size: int = 50):
        self.throttle_ms = throttle_ms
        self.max_queue_size = max_queue_size
        # Track last event time per story per user
        self.last_event_time: Dict[str, Dict[str, float]] = defaultdict(dict)  # story_id -> user_id -> timestamp
        # Pending events to batch
        self.pending_events: Dict[str, List[dict]] = defaultdict(list)  # story_id -> events
        # Batching tasks
        self.batch_tasks: Dict[str, asyncio.Task] = {}  # story_id -> task
        
    def should_throttle(self, story_id: str, user_id: str) -> bool:
        """Vérifier si l'événement doit être throttlé"""
        if story_id not in self.last_event_time:
            return False
        if user_id not in self.last_event_time[story_id]:
            return False
        
        last_time = self.last_event_time[story_id][user_id]
        now = datetime.now().timestamp()
        elapsed_ms = (now - last_time) * 1000
        
        return elapsed_ms < self.throttle_ms
    
    def queue_event(self, story_id: str, user_id: str, event: dict) -> bool:
        """Ajouter un événement à la file d'attente
        
        Returns:
            True si l'événement doit être traité immédiatement
            False si throttlé
        """
        if self.should_throttle(story_id, user_id):
            # Ajouter à la queue si pas pleine
            if len(self.pending_events[story_id]) < self.max_queue_size:
                self.pending_events[story_id].append(event)
            else:
                # Queue pleine: ignorer l'événement
                logger.warning(f"⚠️ Queue pleine pour story {story_id}, événement ignoré")
            return False
        
        # Pas de throttle - mettre à jour le timestamp
        self.last_event_time[story_id][user_id] = datetime.now().timestamp()
        return True
    
    async def batch_and_flush(self, story_id: str) -> Optional[dict]:
        """Attendre et envoyer les événements batch après throttle_ms"""
        await asyncio.sleep(self.throttle_ms / 1000)
        
        events = self.pending_events.get(story_id, [])
        if not events:
            return None
        
        # Vider la queue
        self.pending_events[story_id] = []
        
        # Aggréger les événements
        aggregated = self._aggregate_events(events)
        return aggregated
    
    def _aggregate_events(self, events: List[dict]) -> dict:
        """Aggréger les événements par type
        
        Combine multiple like events into "+N reactions"
        """
        likes_count = 0
        comments = []
        replies = []
        interactions = []
        
        # Priorisation (interactions > réponses > commentaires > likes)
        for event in events:
            event_type = event.get('type')
            
            if event_type == 'interaction':  # tap, long press
                interactions.append(event)
            elif event_type == 'reply':
                replies.append(event)
            elif event_type == 'comment':
                comments.append(event)
            elif event_type == 'like':
                likes_count += 1
        
        # Construire l'agrégation
        result = {'type': 'batch', 'events': []}
        
        # Ajouter les interactions (limite 3)
        result['events'].extend(interactions[:3])
        
        # Ajouter les réponses (limite 2)
        result['events'].extend(replies[:2])
        
        # Ajouter les commentaires (limite 2)
        result['events'].extend(comments[:2])
        
        # Ajouter les likes agrégés
        if likes_count > 0:
            result['events'].append({
                'type': 'aggregated_likes',
                'count': likes_count,
                'label': f"+{likes_count} réactions" if likes_count > 1 else "1 réaction"
            })
        
        return result if result['events'] else {'type': 'batch', 'events': []}


class StoryReactionStreamManager:
    """Gère le flux de réactions pour une story avec limitation de visibilité"""
    
    def __init__(self, max_visible: int = 5, ttl_seconds: int = 7):
        self.max_visible = max_visible
        self.ttl_seconds = ttl_seconds
        self.active_reactions: Dict[str, List[dict]] = defaultdict(list)  # story_id -> reactions
        self.last_cleanup: Dict[str, float] = defaultdict(float)  # story_id -> last cleanup timestamp
        self._lock = asyncio.Lock()  # Synchroniser accès concurrent à active_reactions
        
    async def add_reaction(self, story_id: str, reaction: dict, ttl_seconds: int = 7) -> List[dict]:
        """Ajouter une réaction et retourner le flux limité
        
        Args:
            story_id: ID de la story
            reaction: Données de la réaction (user, avatar, text, type)
            ttl_seconds: Durée de vie (3-7s)
            
        Returns:
            Liste des réactions visibles (max 5)
        """
        reaction_id = f"{reaction.get('user_id')}__{datetime.now().timestamp()}"
        reaction['id'] = reaction_id
        now = time.time()
        reaction['created_at'] = datetime.fromtimestamp(now).isoformat()
        reaction['_ttl_end'] = now + ttl_seconds  # Timestamp d'expiration stocké dans la réaction
        
        # Protéger l'accès concurrent
        async with self._lock:
            # Ajouter au flux
            self.active_reactions[story_id].insert(0, reaction)  # Nouveau en haut (montant)
            
            # Limiter à max_visible
            if len(self.active_reactions[story_id]) > self.max_visible:
                self.active_reactions[story_id].pop()  # Simplement supprimer, pas besoin de timer
            
            return self.get_visible_reactions(story_id)
    
    async def get_visible_reactions(self, story_id: str) -> List[dict]:
        """Retourner les réactions visibles pour une story (thread-safe)"""
        async with self._lock:
            return self.active_reactions.get(story_id, [])[:self.max_visible]
    
    async def cleanup_expired_reactions(self):
        """Job de cleanup global: supprimer les réactions expirées (appelé ~1x/sec)
        
        Cette approche évite 1000+ asyncio.create_task() par réaction
        """
        now = time.time()
        cleaned_count = 0
        
        async with self._lock:
            for story_id in list(self.active_reactions.keys()):
                # Filtrer les réactions expirées
                before_count = len(self.active_reactions[story_id])
                self.active_reactions[story_id] = [
                    r for r in self.active_reactions[story_id] 
                    if r.get('_ttl_end', float('inf')) > now
                ]
                cleaned_count += before_count - len(self.active_reactions[story_id])
                
                # Nettoyer les stories vides
                if not self.active_reactions[story_id]:
                    del self.active_reactions[story_id]
        
        if cleaned_count > 0:
            logger.debug(f"✅ Cleanup: {cleaned_count} réactions expirées supprimées")
    
    async def clear_story(self, story_id: str):
        """Nettoyer toutes les réactions pour une story (thread-safe)"""
        async with self._lock:
            if story_id in self.active_reactions:
                del self.active_reactions[story_id]


# Global instances
throttler = StoryReactionThrottler(throttle_ms=300, max_queue_size=50)
stream_manager = StoryReactionStreamManager(max_visible=5)


async def process_story_reaction(story_id: str, user_id: str, reaction_data: dict) -> dict:
    """Traiter une réaction story avec throttling et streaming
    
    Returns:
        {
            'throttled': bool,
            'visible_reactions': List[dict],
            'should_broadcast': bool
        }
    """
    should_process = throttler.queue_event(story_id, user_id, reaction_data)
    
    if should_process:
        # Traiter immédiatement
        reaction_data['user_id'] = user_id
        visible = await stream_manager.add_reaction(story_id, reaction_data)
        
        return {
            'throttled': False,
            'visible_reactions': visible,
            'should_broadcast': True,
            'reaction': reaction_data
        }
    else:
        # Throttlé - pas de broadcast
        return {
            'throttled': True,
            'visible_reactions': await stream_manager.get_visible_reactions(story_id),
            'should_broadcast': False
        }
