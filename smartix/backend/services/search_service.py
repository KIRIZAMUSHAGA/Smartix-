"""
Service de recherche web multi-sources avec cache et fallback
Version optimisée avec session globale, timeouts robustes et déduplication
Supporte SearXNG, Wikipedia, DuckDuckGo
"""

import aiohttp
import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

# =============================
# CONFIGURATION
# =============================

# Instances SearXNG publiques (fallback automatique)
SEARXNG_INSTANCES = [
    "https://searx.be",
    "https://search.mdosch.de",
    "https://searx.namejeff.xyz",
    "https://northboot.xyz",
    "https://searx.work"
]

# Timeouts optimisés
REQUEST_TIMEOUT = 3  # secondes
CONNECTION_TIMEOUT = 2  # secondes
CACHE_TTL = 3600  # 1 heure

# Cache en mémoire (sera remplacé par Redis en prod)
_search_cache = {}

# Session HTTP globale (optimisation majeure)
_session: Optional[aiohttp.ClientSession] = None

# =============================
# GESTION DE LA SESSION HTTP GLOBALE
# =============================

async def get_session() -> aiohttp.ClientSession:
    """Retourne une session HTTP réutilisable"""
    global _session
    if _session is None or _session.closed:
        timeout = aiohttp.ClientTimeout(
            total=REQUEST_TIMEOUT,
            connect=CONNECTION_TIMEOUT,
            sock_read=REQUEST_TIMEOUT
        )
        _session = aiohttp.ClientSession(timeout=timeout)
    return _session

async def close_session():
    """Ferme la session HTTP (à appeler à l'arrêt)"""
    global _session
    if _session and not _session.closed:
        await _session.close()

# =============================
# UTILITAIRES DE CACHE
# =============================

def get_cache_key(query: str, source: str) -> str:
    """Génère une clé de cache unique"""
    key_str = f"{source}:{query.lower().strip()}"
    return hashlib.md5(key_str.encode()).hexdigest()

def get_from_cache(key: str) -> Optional[Dict]:
    """Récupère du cache si valide"""
    cached = _search_cache.get(key)
    if cached and datetime.now() - cached["timestamp"] < timedelta(seconds=CACHE_TTL):
        logger.debug(f"Cache hit: {key[:20]}...")
        return cached["data"]
    return None

def save_to_cache(key: str, data: Dict):
    """Sauvegarde dans le cache avec nettoyage automatique"""
    _search_cache[key] = {
        "data": data,
        "timestamp": datetime.now()
    }
    # Nettoyer le cache s'il devient trop grand
    if len(_search_cache) > 1000:
        oldest_keys = sorted(_search_cache.keys(), 
                           key=lambda k: _search_cache[k]["timestamp"])[:100]
        for k in oldest_keys:
            del _search_cache[k]

# =============================
# UTILITAIRES DE NETTOYAGE
# =============================

def clean_html(text: str) -> str:
    """Supprime toutes les balises HTML d'un texte"""
    if not text:
        return ""
    return re.sub(r'<.*?>', '', text)

def deduplicate_results(results: List[Dict]) -> List[Dict]:
    """Déduplique les résultats par URL"""
    seen = set()
    unique = []
    
    for r in results:
        url = r.get("url", "")
        if url and url not in seen:
            unique.append(r)
            seen.add(url)
    
    return unique

def sort_by_score(results: List[Dict]) -> List[Dict]:
    """Trie les résultats par score (si disponible)"""
    return sorted(
        results, 
        key=lambda x: (x.get("score", 0), len(x.get("snippet", ""))), 
        reverse=True
    )

# =============================
# SOURCE 1 : SearXNG (meilleure qualité)
# =============================

async def search_searxng(query: str, session: aiohttp.ClientSession, instance_index: int = 0) -> Optional[List[Dict]]:
    """Recherche via une instance SearXNG avec timeout"""
    if instance_index >= len(SEARXNG_INSTANCES):
        return None
    
    instance = SEARXNG_INSTANCES[instance_index]
    encoded_query = quote(query)
    url = f"{instance}/search?q={encoded_query}&format=json&categories=general"
    
    try:
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                results = []
                
                for item in data.get("results", [])[:8]:  # Prendre un peu plus pour tri
                    # Nettoyer le snippet
                    snippet = item.get("content", item.get("snippet", ""))
                    snippet = clean_html(snippet)
                    
                    results.append({
                        "title": clean_html(item.get("title", ""))[:200],
                        "url": item.get("url", ""),
                        "snippet": snippet[:400],
                        "source": "searxng",
                        "engine": item.get("engine", "web"),
                        "score": item.get("score", 0)
                    })
                
                return sort_by_score(results)[:5]  # Garder les 5 meilleurs
            else:
                logger.warning(f"SearXNG {instance} status {response.status}")
                return None
    except asyncio.TimeoutError:
        logger.warning(f"SearXNG {instance} timeout")
        return None
    except Exception as e:
        logger.error(f"SearXNG error: {e}")
        return None

# =============================
# SOURCE 2 : Wikipedia (connaissances)
# =============================

async def search_wikipedia(query: str, session: aiohttp.ClientSession) -> Optional[List[Dict]]:
    """Recherche via Wikipedia API (version française)"""
    encoded_query = quote(query)
    
    # Recherche d'articles
    search_url = f"https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_query}&format=json&srlimit=3"
    
    try:
        async with session.get(search_url) as response:
            if response.status != 200:
                return None
            
            data = await response.json()
            search_results = data.get("query", {}).get("search", [])
            
            if not search_results:
                return None
            
            results = []
            for item in search_results[:2]:  # Top 2
                title = item.get("title", "")
                
                # Récupérer l'extrait formaté
                extract_url = f"https://fr.wikipedia.org/w/api.php?action=query&titles={quote(title)}&prop=extracts&exintro&explaintext&format=json"
                
                try:
                    async with session.get(extract_url) as ext_response:
                        if ext_response.status == 200:
                            ext_data = await ext_response.json()
                            pages = ext_data.get("query", {}).get("pages", {})
                            for page_id, page in pages.items():
                                if page_id != "-1":
                                    extract = page.get("extract", "")
                                    results.append({
                                        "title": clean_html(title)[:200],
                                        "url": f"https://fr.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                                        "snippet": clean_html(extract)[:400] + ("..." if len(extract) > 400 else ""),
                                        "source": "wikipedia",
                                        "score": 10  # Score élevé pour Wikipedia
                                    })
                except:
                    # Fallback: juste le résultat de recherche
                    snippet = clean_html(item.get("snippet", ""))[:300]
                    results.append({
                        "title": clean_html(title)[:200],
                        "url": f"https://fr.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
                        "snippet": snippet,
                        "source": "wikipedia",
                        "score": 8
                    })
            
            return sort_by_score(results)[:2]
    except Exception as e:
        logger.error(f"Wikipedia error: {e}")
        return None

# =============================
# SOURCE 3 : DuckDuckGo (réponses rapides)
# =============================

async def search_duckduckgo(query: str, session: aiohttp.ClientSession) -> Optional[List[Dict]]:
    """Recherche via DuckDuckGo Instant Answer API"""
    encoded_query = quote(query)
    url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"
    
    try:
        async with session.get(url) as response:
            if response.status != 200:
                return None
            
            data = await response.json()
            results = []
            
            # Réponse directe (Abstract)
            if data.get("Abstract"):
                results.append({
                    "title": clean_html(data.get("Heading", "Résultat"))[:100],
                    "url": data.get("AbstractURL", ""),
                    "snippet": clean_html(data.get("Abstract", ""))[:500],
                    "source": "duckduckgo",
                    "type": "abstract",
                    "score": 9
                })
            
            # Sujets connexes (RelatedTopics)
            for topic in data.get("RelatedTopics", [])[:4]:
                if isinstance(topic, dict):
                    results.append({
                        "title": clean_html(topic.get("Text", ""))[:100],
                        "url": topic.get("FirstURL", ""),
                        "snippet": clean_html(topic.get("Text", ""))[:300],
                        "source": "duckduckgo",
                        "type": "related",
                        "score": 5
                    })
            
            return sort_by_score(results)[:3] if results else None
    except Exception as e:
        logger.error(f"DuckDuckGo error: {e}")
        return None

# =============================
# DÉTECTION DU TYPE DE QUESTION
# =============================

def detect_question_type(query: str) -> str:
    """Détecte le type de question pour choisir la source la plus rapide"""
    q = query.lower()
    
    if any(word in q for word in ["définition", "définir", "c'est quoi", "qu'est-ce que", "défini"]):
        return "definition"
    elif any(word in q for word in ["aujourd'hui", "actuel", "dernier", "récent", "actu", "prix"]):
        return "actualite"
    elif any(word in q for word in ["comment", "pourquoi", "explique", "expliquer"]):
        return "explication"
    else:
        return "general"

# =============================
# RECHERCHE PRINCIPALE OPTIMISÉE
# =============================

async def search_web(query: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Recherche web optimisée avec :
    - Cache
    - Session HTTP réutilisable
    - Détection du type de question
    - Parallélisation intelligente
    - Déduplication et tri des résultats
    - Fallback automatique
    """
    # 1. Vérifier le cache
    cache_key = get_cache_key(query, "combined")
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    # 2. Obtenir la session HTTP
    session = await get_session()
    
    # 3. Détecter le type de question
    question_type = detect_question_type(query)
    
    # 4. Lancer les recherches appropriées en parallèle
    tasks = []
    sources = []
    
    if question_type == "definition":
        # Priorité Wikipedia
        tasks.append(search_wikipedia(query, session))
        sources.append("wikipedia")
        # Fallback DuckDuckGo en parallèle
        tasks.append(search_duckduckgo(query, session))
        sources.append("duckduckgo")
    elif question_type == "actualite":
        # Priorité SearXNG (actualités)
        tasks.append(search_searxng(query, session))
        sources.append("searxng")
    else:
        # Par défaut : SearXNG d'abord, DuckDuckGo en parallèle
        tasks.append(search_searxng(query, session))
        sources.append("searxng")
        tasks.append(search_duckduckgo(query, session))
        sources.append("duckduckgo")
    
    # 5. Exécuter en parallèle avec gestion d'erreurs
    results_list = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 6. Combiner les résultats
    all_results = []
    sources_used = []
    
    for source, result in zip(sources, results_list):
        if isinstance(result, Exception):
            logger.warning(f"Source {source} failed: {result}")
            continue
        if result:
            all_results.extend(result)
            sources_used.append(source)
    
    # 7. Si pas de résultats, essayer les fallbacks
    if not all_results:
        # Fallback sur toutes les instances SearXNG
        for i in range(len(SEARXNG_INSTANCES)):
            searxng_results = await search_searxng(query, session, i)
            if searxng_results:
                all_results.extend(searxng_results)
                sources_used.append(f"searxng-fallback-{i}")
                break
    
    # 8. Nettoyer, dédupliquer et trier
    if all_results:
        # Déduplication
        all_results = deduplicate_results(all_results)
        # Tri par score
        all_results = sort_by_score(all_results)
    
    # 9. Formater la réponse
    response = {
        "query": query,
        "results": all_results[:8],  # Limiter à 8 résultats
        "sources_used": sources_used,
        "total_results": len(all_results),
        "question_type": question_type,
        "timestamp": datetime.now().isoformat()
    }
    
    # 10. Sauvegarder en cache
    save_to_cache(cache_key, response)
    
    return response

# =============================
# FONCTIONS UTILITAIRES POUR L'IA
# =============================

def format_results_for_llm(results: Dict[str, Any]) -> str:
    """Formate les résultats pour le LLM de manière lisible"""
    if not results.get("results"):
        return "Aucun résultat trouvé pour cette recherche."
    
    formatted = f"🔍 **Recherche :** {results['query']}\n"
    formatted += f"📊 **{len(results['results'])} résultats trouvés**\n\n"
    
    for i, r in enumerate(results["results"], 1):
        formatted += f"**{i}. {r['title']}**  \n"
        formatted += f"📌 {r['snippet']}  \n"
        if r.get("url"):
            formatted += f"🔗 [Source]({r['url']})  \n"
        formatted += f"🏷️ Source: {r['source']}  \n\n"
    
    return formatted

def extract_top_snippets(results: Dict[str, Any], count: int = 3) -> str:
    """Extrait seulement les meilleurs snippets pour contexte rapide"""
    if not results.get("results"):
        return ""
    
    snippets = []
    for r in results["results"][:count]:
        snippets.append(f"- {r['snippet']}")
    
    return "\n".join(snippets)
