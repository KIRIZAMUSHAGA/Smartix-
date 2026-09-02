"""
Service de détection de spam pour les avis du marketplace
Version PRO avec corrections et améliorations
- Cache Redis
- Regex domain précis
- Normalisation texte
- Détection cross-app
- Bot timing detection
- Spam word density
"""

import re
import time
import hashlib
import redis
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import os

class SpamDetector:
    """Détecte les avis spam dans le marketplace"""
    
    def __init__(self):
        # Patterns spam
        self.spam_patterns = [
            r'\b(buy|cheap|price|offer|discount|sale|free|win|cash)\b',
            r'\b(v1agra|cialis|rolex|viagra|casin[o]?|poker|lottery)\b',
            r'\b(click here|visit site|check this out|subscribe|follow me)\b',
            r'\b(make money|earn cash|work from home|passive income)\b',
        ]
        
        # ⚠️ CORRECTION : Patterns domain avec regex précise
        self.suspicious_domains = [
            r'https?://(?:www\.)?bit\.ly/',
            r'https?://(?:www\.)?tinyurl\.com/',
            r'https?://(?:www\.)?goo\.gl/',
            r'https?://(?:www\.)?shorturl\.at/',
            r'https?://(?:www\.)?cutt\.ly/',
            r'https?://(?:www\.)?ow\.ly/',
            r'https?://(?:www\.)?is\.gd/',
            r'https?://(?:www\.)?buff\.ly/',
            r'https?://(?:www\.)?adf\.ly/',
        ]
        
        # Spam words pour densité
        self.spam_words = [
            'free', 'win', 'cash', 'money', 'buy', 'cheap', 'discount',
            'offer', 'limited', 'act now', 'don\'t miss', 'guaranteed',
            'profit', 'earn', 'billion', 'million', 'secret', 'revealed'
        ]
        
        # Connexion Redis (à configurer)
        self.redis_client = None
        self._init_redis()
        
        # Cache local pour fallback
        self.local_cache = {}
    
    def _init_redis(self):
        """Initialise la connexion Redis si disponible"""
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
        except:
            print("Redis not available, using local cache")
            self.redis_client = None
    
    # ==================== UTILITAIRES ====================
    
    def _get_redis_key(self, prefix: str, *parts) -> str:
        """Génère une clé Redis"""
        return f"spam:{prefix}:{':'.join(str(p) for p in parts)}"
    
    def _normalize_text(self, text: str) -> str:
        """⚠️ CORRECTION : Normalise le texte pour comparaison"""
        if not text:
            return ""
        text = text.lower()
        text = re.sub(r'[^\w\s]', '', text)  # Enlève la ponctuation
        text = re.sub(r'\s+', ' ', text)     # Normalise les espaces
        return text.strip()
    
    def _get_text_hash(self, text: str) -> str:
        """Hash du texte pour détection de doublons"""
        normalized = self._normalize_text(text)
        return hashlib.md5(normalized.encode()).hexdigest()
    
    # ==================== ANALYSE TEXTUELLE ====================
    
    def _analyze_text_content(self, text: str, title: str) -> Tuple[float, List[str]]:
        """Analyse le contenu textuel"""
        score = 0.0
        reasons = []
        combined = text + " " + title
        
        # ⚠️ CORRECTION : Limiter le nombre de patterns comptés
        pattern_hits = 0
        for pattern in self.spam_patterns:
            if re.search(pattern, combined, re.IGNORECASE):
                pattern_hits += 1
                reasons.append(f"spam_pattern:{pattern}")
        
        # Max 0.3 pour les patterns
        score += min(pattern_hits * 0.1, 0.3)
        
        # URLs count
        url_count = len(re.findall(r'https?://', combined))
        if url_count > 1:
            score += min(url_count * 0.1, 0.3)
            reasons.append(f"multiple_urls:{url_count}")
        
        # ⚠️ CORRECTION : Domain detection avec regex précise
        domain_hits = 0
        for domain_pattern in self.suspicious_domains:
            if re.search(domain_pattern, combined, re.IGNORECASE):
                domain_hits += 1
                reasons.append(f"suspicious_domain:{domain_pattern}")
        
        score += min(domain_hits * 0.15, 0.3)
        
        return score, reasons
    
    def _analyze_text_structure(self, text: str) -> Tuple[float, List[str]]:
        """Analyse la structure du texte"""
        score = 0.0
        reasons = []
        
        if not text:
            return score, reasons
        
        # Longueur
        length = len(text)
        if length < 20:
            score += 0.1
            reasons.append("too_short")
        elif length > 2000:
            score += 0.1
            reasons.append("too_long")
        
        # Ponctuation excessive
        punct_count = len(re.findall(r'[!?.]{2,}', text))
        if punct_count > 2:
            score += min(punct_count * 0.05, 0.2)
            reasons.append("excessive_punctuation")
        
        # Mots en majuscules
        upper_words = len(re.findall(r'\b[A-Z]{4,}\b', text))
        if upper_words > 1:
            score += min(upper_words * 0.05, 0.15)
            reasons.append("excessive_uppercase")
        
        # Caractères spéciaux
        special_chars = len(re.findall(r'[^a-zA-Z0-9\s]', text))
        if length > 0 and special_chars / length > 0.3:
            score += 0.15
            reasons.append("too_many_special_chars")
        
        # Densité de mots spam
        text_lower = text.lower()
        spam_word_count = sum(1 for word in self.spam_words if word in text_lower)
        if spam_word_count > 2:
            score += min(spam_word_count * 0.05, 0.2)
            reasons.append(f"spam_word_density:{spam_word_count}")
        
        return score, reasons
    
    # ==================== ANALYSE COMPORTEMENTALE ====================
    
    async def _analyze_user_history(self, user_id: str, app_id: str, history: List[Dict]) -> Tuple[float, List[str]]:
        """Analyse l'historique de l'utilisateur avec Redis"""
        score = 0.0
        reasons = []
        
        if not user_id or not history:
            return score, reasons
        
        now = time.time()
        
        # Utiliser Redis si disponible
        if self.redis_client:
            # Vérifier les reviews récentes
            recent_key = self._get_redis_key('recent', user_id)
            recent_count = self.redis_client.get(recent_key)
            
            if recent_count and int(recent_count) > 3:
                score += 0.2
                reasons.append("too_many_recent_reviews")
            
            # Incrémenter
            self.redis_client.incr(recent_key)
            self.redis_client.expire(recent_key, 3600)  # 1 heure
            
            # Vérifier les reviews sur différentes apps
            apps_key = self._get_redis_key('apps', user_id)
            apps_reviewed = self.redis_client.smembers(apps_key)
            
            if len(apps_reviewed) > 5:
                score += 0.2
                reasons.append("too_many_different_apps")
            
            self.redis_client.sadd(apps_key, app_id)
            self.redis_client.expire(apps_key, 86400)  # 24h
            
            # ⚠️ CORRECTION : Timing pattern detection
            timing_key = self._get_redis_key('timing', user_id)
            last_time = self.redis_client.get(timing_key)
            
            if last_time:
                interval = now - float(last_time)
                if interval < 10:  # Moins de 10 secondes entre reviews
                    score += 0.2
                    reasons.append(f"suspicious_timing:{interval:.1f}s")
            
            self.redis_client.set(timing_key, str(now))
            self.redis_client.expire(timing_key, 3600)
        
        else:
            # Fallback local
            recent_reviews = [r for r in history if r.get("time", 0) > now - 3600]
            if len(recent_reviews) > 3:
                score += 0.2
                reasons.append("too_many_recent_reviews")
            
            # Timing pattern
            if len(history) >= 3:
                times = [r.get("time", 0) for r in history[-3:]]
                intervals = [times[i+1] - times[i] for i in range(len(times)-1)]
                
                if all(20 < interval < 40 for interval in intervals):
                    score += 0.3
                    reasons.append("bot_timing_pattern")
        
        return score, reasons
    
    # ==================== ANALYSE GLOBALE ====================
    
    async def _check_global_duplicates(self, text: str) -> Tuple[float, List[str]]:
        """⚠️ NOUVEAU : Vérifie les doublons globaux"""
        if not text or not self.redis_client:
            return 0.0, []
        
        score = 0.0
        reasons = []
        
        text_hash = self._get_text_hash(text)
        hash_key = self._get_redis_key('hash', text_hash)
        
        # Compter combien de fois ce texte a été vu
        count = self.redis_client.get(hash_key)
        
        if count:
            count = int(count)
            if count > 5:
                score += 0.3
                reasons.append(f"global_duplicate:{count}")
            elif count > 2:
                score += 0.15
                reasons.append(f"frequent_text:{count}")
        
        # Incrémenter
        self.redis_client.incr(hash_key)
        self.redis_client.expire(hash_key, 604800)  # 7 jours
        
        return score, reasons
    
    # ==================== API PUBLIQUE ====================
    
    async def analyze(self, data: Dict) -> Dict:
        """
        Analyse un avis pour détecter du spam
        Retourne: {
            "is_spam": bool,
            "score": float (0-1),
            "reasons": List[str],
            "confidence": "high|medium|low"
        }
        """
        text = data.get("text", "")
        title = data.get("title", "")
        user_id = data.get("userId")
        app_id = data.get("appId")
        user_history = data.get("userHistory", [])
        
        reasons = []
        score = 0.0
        
        # 1. Analyse du contenu textuel
        text_score, text_reasons = self._analyze_text_content(text, title)
        score += text_score
        reasons.extend(text_reasons)
        
        # 2. Analyse de la structure
        struct_score, struct_reasons = self._analyze_text_structure(text)
        score += struct_score
        reasons.extend(struct_reasons)
        
        # 3. Analyse de l'historique utilisateur
        history_score, history_reasons = await self._analyze_user_history(user_id, app_id, user_history)
        score += history_score
        reasons.extend(history_reasons)
        
        # 4. ⚠️ NOUVEAU : Vérification des doublons globaux
        duplicate_score, duplicate_reasons = await self._check_global_duplicates(text)
        score += duplicate_score
        reasons.extend(duplicate_reasons)
        
        # 5. Normalisation finale
        score = min(score, 1.0)
        
        # Déterminer la confiance
        confidence = "low"
        if score > 0.8:
            confidence = "high"
        elif score > 0.5:
            confidence = "medium"
        
        result = {
            "is_spam": score > 0.6,  # Seuil à 0.6
            "score": round(score, 2),
            "reasons": reasons[:8],  # Limiter le nombre de raisons
            "confidence": confidence
        }
        
        return result
    
    async def close(self):
        """Ferme la connexion Redis"""
        if self.redis_client:
            self.redis_client.close()

# Instance unique
spam_detector = SpamDetector()
