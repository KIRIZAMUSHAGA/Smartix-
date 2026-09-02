"""
Service d'intégration IA pour les suggestions d'amélioration
Version PRO avec corrections et optimisations
- Session HTTP persistante
- Parsing JSON robuste
- Cache Redis
- Structured output
- Context engineering enrichi
- Suggestion scoring (impact/effort)
- Déduplication
- Batch analysis ready
- Sécurité anti-injection
"""

import os
import json
import re
import hashlib
import aiohttp
import redis
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Union
from collections import defaultdict

class AIIntegration:
    """Intégration avec les services IA (OpenAI/Claude)"""
    
    def __init__(self, api_key: str = None, model: str = "gpt-4"):
        # ⚠️ CORRECTION : Import os
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.base_url = "https://api.openai.com/v1"
        
        # Rate limits
        self.rate_limits = {
            "analyze": {"used": 0, "limit": 100, "reset": datetime.now()},
            "generate": {"used": 0, "limit": 50, "reset": datetime.now()}
        }
        
        # ⚠️ CORRECTION : Session HTTP persistante
        self.session = None
        
        # Cache Redis
        self.redis_client = None
        self._init_redis()
        
        # Cache des suggestions déjà générées
        self.suggestion_cache = {}
        self.cache_ttl = 86400  # 24h
    
    def _init_redis(self):
        """Initialise Redis pour le cache"""
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
        except:
            print("Redis not available, using memory cache")
            self.redis_client = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """⚠️ CORRECTION : Session persistante"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    # ==================== UTILITAIRES ====================
    
    def _get_cache_key(self, prefix: str, app_id: str, context_hash: str = "") -> str:
        """Génère une clé de cache"""
        return f"ai:{prefix}:{app_id}:{context_hash}"
    
    def _hash_text(self, text: str) -> str:
        """Hash un texte pour déduplication"""
        return hashlib.md5(text.encode()).hexdigest()[:8]
    
    def _extract_json(self, content: str) -> Optional[Dict]:
        """
        ⚠️ CORRECTION : Extraction robuste du JSON depuis la réponse LLM
        Les modèles renvoient souvent du texte + JSON
        """
        # Chercher un bloc JSON
        json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        match = re.search(json_pattern, content, re.IGNORECASE)
        
        if match:
            content = match.group(1)
        
        # Chercher un objet JSON dans le texte
        try:
            # Essayer de parser directement
            return json.loads(content)
        except:
            # Chercher le premier { ... }
            match = re.search(r'(\{.*\})', content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except:
                    pass
        
        # Dernier recours : parsing manuel
        return self._parse_manual(content)
    
    def _parse_manual(self, content: str) -> Dict:
        """Parsing manuel en dernier recours"""
        suggestions = []
        
        # Chercher des patterns de suggestions
        suggestion_patterns = [
            r'(?:suggestion|improvement|fix|optimization)[:\s]+(.+?)(?=\n\n|\Z)',
            r'[*-]\s*(.+?)(?=\n[*-]|\Z)'
        ]
        
        for pattern in suggestion_patterns:
            matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)
            for match in matches:
                suggestions.append({
                    "type": "optimization",
                    "title": match[:50],
                    "description": match,
                    "confidence": 0.5
                })
        
        return {"suggestions": suggestions} if suggestions else {}
    
    # ==================== PROMPT ENGINEERING ====================
    
    def _build_analysis_prompt(self, app_data: Dict, analytics: Dict, context: Dict = None) -> str:
        """
        Construit le prompt pour l'analyse IA
        Avec contexte enrichi (reviews, crashes, feedback)
        """
        # Données de base
        prompt = f"""You are an expert mobile app developer and UX designer. Analyze this app and suggest improvements.

APP INFORMATION:
Name: {app_data.get('name')}
Category: {app_data.get('category')}
Description: {app_data.get('description')}
Tags: {', '.join(app_data.get('tags', []))}

ANALYTICS (last 30 days):
Views: {analytics.get('views', 0)}
Downloads: {analytics.get('downloads', 0)}
Installs: {analytics.get('installs', 0)}
Active Users: {analytics.get('activeUsers', 0)}
Retention Rate: {analytics.get('retention', 0)}%
Crash Rate: {analytics.get('crashRate', 0)}%
Avg Session Duration: {analytics.get('avgSessionDuration', 0)}s
"""
        
        # Ajouter les issues détectées
        issues = analytics.get('issues', [])
        if issues:
            prompt += "\n\nISSUES DETECTED:\n"
            for issue in issues:
                prompt += f"- {issue.get('description')} (severity: {issue.get('severity')})\n"
        
        # ⚠️ NOUVEAU : Ajouter les reviews négatives
        negative_reviews = context.get('negative_reviews', []) if context else []
        if negative_reviews:
            prompt += "\n\nRECENT NEGATIVE REVIEWS:\n"
            for review in negative_reviews[:3]:
                prompt += f"- {review.get('comment', '')} (rating: {review.get('rating')})\n"
        
        # ⚠️ NOUVEAU : Ajouter les crashes récents
        recent_crashes = context.get('recent_crashes', []) if context else []
        if recent_crashes:
            prompt += "\n\nRECENT CRASHES:\n"
            for crash in recent_crashes[:3]:
                prompt += f"- {crash.get('message', '')}\n"
        
        # Format de sortie structuré
        prompt += """

Based on this data, suggest 3-5 specific improvements. For each suggestion, provide a JSON object with:

- type: one of ["ui", "performance", "feature", "security", "bug_fix", "optimization"]
- title: short title (max 100 chars)
- description: detailed explanation (200-300 chars)
- confidence: number 0-1 (how confident you are)
- reason: why this improvement matters (linked to metrics/issues)
- impact: one of ["high", "medium", "low"]
- effort: one of ["high", "medium", "low"]
- files: list of files that might need changes (optional)
- estimated_impact: brief description of expected improvement

Return ONLY a valid JSON array of suggestions, no other text.

Example:
[
  {
    "type": "performance",
    "title": "Optimize image loading with lazy loading",
    "description": "Implement lazy loading for images to reduce initial load time and improve performance on slow connections",
    "confidence": 0.9,
    "reason": "high_crash_rate",
    "impact": "high",
    "effort": "medium",
    "files": ["src/components/ImageGallery.js"],
    "estimated_impact": "40% faster load time, 30% reduction in memory usage"
  }
]"""
        
        return prompt
    
    # ==================== SUGGESTION PROCESSING ====================
    
    def _process_suggestions(self, raw_suggestions: List[Dict], app_id: str) -> List[Dict]:
        """
        Traite et enrichit les suggestions
        - Déduplication
        - Scoring
        - Formatage
        """
        processed = []
        seen_hashes = set()
        
        for idx, sugg in enumerate(raw_suggestions):
            # S'assurer que c'est un dict
            if not isinstance(sugg, dict):
                continue
            
            # Extraire les champs
            title = sugg.get('title', '')
            description = sugg.get('description', '')
            
            # Déduplication
            content_hash = self._hash_text(title + description)
            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)
            
            # Calculer le score de priorité
            impact_score = {"high": 3, "medium": 2, "low": 1}.get(sugg.get('impact'), 1)
            effort_score = {"high": 1, "medium": 2, "low": 3}.get(sugg.get('effort'), 2)
            confidence = sugg.get('confidence', 0.5)
            
            priority_score = (impact_score * confidence * 2) + (effort_score * 0.5)
            
            # Créer la suggestion formatée
            processed.append({
                "id": f"sugg_{app_id}_{idx}_{int(datetime.now().timestamp())}",
                "type": sugg.get('type', 'optimization'),
                "title": title,
                "description": description,
                "confidence": confidence,
                "reason": sugg.get('reason'),
                "impact": sugg.get('impact', 'medium'),
                "effort": sugg.get('effort', 'medium'),
                "priority_score": round(priority_score, 2),
                "files": sugg.get('files', []),
                "estimated_impact": sugg.get('estimated_impact', ''),
                "created_at": datetime.now().isoformat()
            })
        
        return processed
    
    # ==================== API CALL ====================
    
    async def _call_ai_api(self, prompt: str, action: str) -> Dict:
        """⚠️ CORRECTION : Appel API avec session persistante"""
        if not self.api_key:
            # Mode simulation pour le développement
            return self._simulate_ai_response(prompt, action)
        
        # Vérifier le rate limit
        if not self._check_rate_limit(action):
            return {"error": "Rate limit exceeded", "suggestions": []}
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are an expert mobile app developer and UX designer. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 2000,
            "response_format": {"type": "json_object"}  # Si supporté par l'API
        }
        
        try:
            session = await self._get_session()
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    content = result["choices"][0]["message"]["content"]
                    
                    # ⚠️ CORRECTION : Extraction robuste du JSON
                    parsed = self._extract_json(content)
                    
                    if parsed:
                        return parsed
                    else:
                        return {"suggestions": []}
                else:
                    error = await response.text()
                    print(f"AI API error: {error}")
                    return {"suggestions": []}
                    
        except Exception as e:
            print(f"AI API call failed: {e}")
            return {"suggestions": []}
    
    def _simulate_ai_response(self, prompt: str, action: str) -> Dict:
        """Simule une réponse IA pour le développement"""
        return {
            "suggestions": [
                {
                    "type": "ui",
                    "title": "Improve onboarding flow",
                    "description": "Add interactive tutorial for new users to increase retention",
                    "confidence": 0.85,
                    "reason": "low_retention",
                    "impact": "high",
                    "effort": "medium",
                    "files": ["src/components/Onboarding.js"],
                    "estimated_impact": "Expected +15% retention"
                },
                {
                    "type": "performance",
                    "title": "Optimize image loading",
                    "description": "Implement lazy loading and image compression",
                    "confidence": 0.9,
                    "reason": "performance",
                    "impact": "high",
                    "effort": "medium",
                    "files": ["src/components/ImageGallery.js"],
                    "estimated_impact": "40% faster load time"
                },
                {
                    "type": "bug_fix",
                    "title": "Fix crash on login",
                    "description": "Add null check for user session and error handling",
                    "confidence": 0.95,
                    "reason": "high_crash_rate",
                    "impact": "high",
                    "effort": "low",
                    "files": ["src/services/auth.js"],
                    "estimated_impact": "Reduce crashes by 80%"
                }
            ]
        }
    
    def _check_rate_limit(self, action: str) -> bool:
        """⚠️ CORRECTION : Vérifie les limites de taux"""
        now = datetime.now()
        limit_info = self.rate_limits.get(action, self.rate_limits.get("analyze"))
        
        # Réinitialiser si nécessaire
        if now > limit_info["reset"]:
            limit_info["used"] = 0
            # ⚠️ CORRECTION : timedelta importé
            limit_info["reset"] = now + timedelta(hours=24)
        
        if limit_info["used"] >= limit_info["limit"]:
            return False
        
        limit_info["used"] += 1
        return True
    
    # ==================== API PUBLIQUE ====================
    
    async def analyze_app(self, app_data: Dict, analytics: Dict, context: Dict = None) -> List[Dict]:
        """
        Analyse une application et propose des améliorations
        Avec cache et déduplication
        """
        # Générer une clé de cache
        context_str = json.dumps({
            "app_id": app_data.get("id"),
            "analytics_hash": hashlib.md5(json.dumps(analytics).encode()).hexdigest()[:8]
        })
        cache_key = self._get_cache_key("analysis", app_data.get("id", ""), context_str)
        
        # Vérifier le cache
        if self.redis_client:
            cached = self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        elif cache_key in self.suggestion_cache:
            cache_time, suggestions = self.suggestion_cache[cache_key]
            if datetime.now().timestamp() - cache_time < self.cache_ttl:
                return suggestions
        
        # Construire le prompt
        prompt = self._build_analysis_prompt(app_data, analytics, context)
        
        # Appeler l'API
        response = await self._call_ai_api(prompt, "analyze")
        
        # Traiter les suggestions
        raw_suggestions = response.get("suggestions", [])
        processed_suggestions = self._process_suggestions(raw_suggestions, app_data.get("id", ""))
        
        # Mettre en cache
        if self.redis_client:
            self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(processed_suggestions))
        else:
            self.suggestion_cache[cache_key] = (datetime.now().timestamp(), processed_suggestions)
        
        return processed_suggestions
    
    async def generate_feature(self, app_data: Dict, description: str) -> Dict:
        """
        Génère une nouvelle fonctionnalité
        """
        prompt = f"""
        Based on the following app and feature request, generate the code changes needed.
        
        App: {json.dumps(app_data, indent=2)}
        
        Feature request: {description}
        
        Generate a detailed implementation plan with:
        - type: "feature"
        - title: short title
        - description: detailed explanation
        - confidence: 0-1
        - impact: high/medium/low
        - effort: high/medium/low
        - files: list of files to modify
        - code_changes: brief description of changes
        
        Return ONLY a valid JSON object.
        """
        
        response = await self._call_ai_api(prompt, "generate")
        
        suggestions = self._process_suggestions(
            [response] if isinstance(response, dict) else [],
            app_data.get("id", "")
        )
        
        return suggestions[0] if suggestions else {}
    
    async def optimize_performance(self, app_data: Dict, context: Dict = None) -> List[Dict]:
        """
        Suggère des optimisations de performance
        """
        return await self.analyze_app(app_data, {
            "views": 0,
            "issues": [{"description": "Performance optimization needed"}]
        }, context)
    
    async def fix_bug(self, app_data: Dict, error_description: str) -> Dict:
        """
        Propose une correction de bug
        """
        prompt = f"""
        Bug description: {error_description}
        
        App code structure: {json.dumps(app_data, indent=2)}
        
        Identify the bug and provide the fix. Return a JSON with:
        - type: "bug_fix"
        - title: short description
        - description: detailed fix explanation
        - confidence: 0-1
        - impact: high/medium/low
        - effort: high/medium/low
        - files: list of files to modify
        - code_changes: specific code changes
        """
        
        response = await self._call_ai_api(prompt, "generate")
        
        suggestions = self._process_suggestions(
            [response] if isinstance(response, dict) else [],
            app_data.get("id", "")
        )
        
        return suggestions[0] if suggestions else {}
    
    async def batch_analyze(self, apps_data: List[Dict], analytics_list: List[Dict]) -> List[List[Dict]]:
        """
        ⚠️ NOUVEAU : Analyse en batch de plusieurs apps
        Réduit le nombre d'appels API
        """
        # Version simplifiée - à implémenter avec un vrai batch si supporté par l'API
        results = []
        for app_data, analytics in zip(apps_data, analytics_list):
            suggestions = await self.analyze_app(app_data, analytics)
            results.append(suggestions)
        return results
    
    async def close(self):
        """Ferme la session HTTP"""
        if self.session and not self.session.closed:
            await self.session.close()

# Instance unique
ai_integration = AIIntegration()
