"""
Implementation of many video sources: mix of official APIs and HTML scrapers.
Includes 7+ sources for SmartixClip video aggregation with high-quality selection.
Version 2.0 avec rate limiting, cache et gestion robuste
"""

import requests
import os
import time
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple
from collections import deque
import asyncio
import aiohttp
from urllib.parse import urlparse
import redis
from functools import lru_cache

# ========== CONFIGURATION ==========
USER_AGENT = os.getenv("SCRAPER_USER_AGENT", "SmartixClip-VideoBot/1.0")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "")

HEADERS = {"User-Agent": USER_AGENT}

# Configuration rate limiting
RATE_LIMITS = {
    "pexels": {"max_requests": 200, "per_seconds": 3600},  # 200 par heure
    "pixabay": {"max_requests": 100, "per_seconds": 3600},  # 100 par heure
    "videvo": {"max_requests": 60, "per_seconds": 3600},
    "coverr": {"max_requests": 60, "per_seconds": 3600},
    "archive": {"max_requests": 30, "per_seconds": 3600},
    "mazwai": {"max_requests": 30, "per_seconds": 3600},
}

# Cache Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = None

# ========== IMPORTS OPTIONNELS ==========
from app.services.avatars import author_name_for_source, avatar_url_for_source
from app.utils_video_quality import get_best_video_from_pexels, get_best_video_from_pixabay

try:
    from app.services.fetchers import fetch_videvo, fetch_coverr, fetch_archive_org, fetch_mazwai
    FETCHERS_AVAILABLE = True
except ImportError:
    FETCHERS_AVAILABLE = False
    print("⚠️ Additional fetchers not available")

# ========== RATE LIMITER ==========
class RateLimiter:
    """Rate limiter pour les APIs externes"""
    
    def __init__(self):
        self.request_logs = {}
        self.delays = {}
        
    def _get_key(self, source: str) -> str:
        return f"rate_limit_{source}"
    
    def can_request(self, source: str) -> Tuple[bool, int]:
        """Vérifie si une requête peut être faite, retourne (bool, temps_attente)"""
        now = time.time()
        key = self._get_key(source)
        
        if key not in self.request_logs:
            self.request_logs[key] = deque()
            return True, 0
        
        # Nettoyer les anciennes requêtes
        limit = RATE_LIMITS.get(source, {"max_requests": 60, "per_seconds": 3600})
        window = limit["per_seconds"]
        
        while self.request_logs[key] and now - self.request_logs[key][0] > window:
            self.request_logs[key].popleft()
        
        if len(self.request_logs[key]) >= limit["max_requests"]:
            oldest = self.request_logs[key][0]
            wait_time = int(window - (now - oldest))
            return False, wait_time
        
        return True, 0
    
    def add_request(self, source: str):
        """Enregistre une requête"""
        key = self._get_key(source)
        if key not in self.request_logs:
            self.request_logs[key] = deque()
        self.request_logs[key].append(time.time())
    
    def wait_if_needed(self, source: str):
        """Attend si nécessaire avant de faire une requête"""
        can, wait = self.can_request(source)
        if not can:
            print(f"⏳ Rate limit pour {source}, attente de {wait}s...")
            time.sleep(wait)
        self.add_request(source)
    
    async def async_wait_if_needed(self, source: str):
        """Version asynchrone"""
        can, wait = self.can_request(source)
        if not can:
            print(f"⏳ Rate limit pour {source}, attente de {wait}s...")
            await asyncio.sleep(wait)
        self.add_request(source)

rate_limiter = RateLimiter()

# ========== CACHE REDIS ==========
async def get_redis():
    """Récupère le client Redis"""
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=5
            )
            redis_client.ping()
            print("✅ Redis connecté")
        except Exception as e:
            print(f"⚠️ Redis non disponible: {e}")
            redis_client = None
    return redis_client

def get_cache_key(source: str, query: str, page: int = 1) -> str:
    """Génère une clé de cache unique"""
    key_str = f"{source}:{query}:{page}"
    return f"scraper:{hashlib.md5(key_str.encode()).hexdigest()}"

async def get_cached_videos(source: str, query: str, page: int = 1) -> Optional[List[Dict]]:
    """Récupère les vidéos du cache"""
    try:
        redis = await get_redis()
        if not redis:
            return None
        
        key = get_cache_key(source, query, page)
        cached = redis.get(key)
        
        if cached:
            data = json.loads(cached)
            # Vérifier si le cache est encore valide
            if time.time() - data.get("timestamp", 0) < 3600:  # 1 heure
                print(f"✅ Cache hit: {source}/{query}")
                return data.get("videos", [])
    except Exception as e:
        print(f"⚠️ Erreur cache: {e}")
    
    return None

async def set_cached_videos(source: str, query: str, videos: List[Dict], page: int = 1):
    """Met en cache les vidéos"""
    try:
        redis = await get_redis()
        if not redis:
            return
        
        key = get_cache_key(source, query, page)
        data = {
            "videos": videos,
            "timestamp": time.time(),
            "source": source,
            "query": query
        }
        redis.setex(key, 7200, json.dumps(data, default=str))  # 2 heures
    except Exception as e:
        print(f"⚠️ Erreur cache set: {e}")

# ========== VALIDATION VIDÉO ==========
def is_valid_video_url(url: Optional[str]) -> bool:
    """Vérifie si l'URL vidéo est valide"""
    if not url:
        return False
    
    try:
        parsed = urlparse(url)
        return parsed.scheme in ('http', 'https') and bool(parsed.netloc)
    except:
        return False

def check_video_availability(url: str, timeout: int = 3) -> bool:
    """Vérifie rapidement si une vidéo est accessible"""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return response.status_code == 200
    except:
        return False

# ========== NORMALISATION ==========
def _norm_item(
    video_url: str, 
    title: str, 
    thumb: Optional[str] = None, 
    source: str = "unknown", 
    duration: Optional[int] = None, 
    license: str = "unknown", 
    description: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    tags: Optional[List[str]] = None,
    provider: Optional[str] = None,
    provider_video_id: Optional[str] = None,
    quality_score: int = 0
) -> Optional[Dict]:
    """Normalise un item vidéo avec validation"""
    
    # Validation URL
    if not is_valid_video_url(video_url):
        print(f"⚠️ URL invalide ignorée: {video_url[:50]}...")
        return None
    
    # Nettoyage des tags
    clean_tags = []
    if tags:
        clean_tags = [
            str(tag).strip().lower()[:30]
            for tag in tags
            if tag and len(str(tag).strip()) > 0
        ][:10]  # Max 10 tags
    
    # Calcul score qualité
    if quality_score == 0:
        if width and height:
            if width >= 1920 or height >= 1080:
                quality_score = 100  # Full HD
            elif width >= 1280 or height >= 720:
                quality_score = 70   # HD
            else:
                quality_score = 40   # SD
        else:
            quality_score = 50  # Inconnu
    
    return {
        "id": hashlib.md5(video_url.encode()).hexdigest()[:16],
        "title": (title or "Video")[:100],
        "description": description[:200] if description else None,
        "source": source,
        "provider": provider or source.lower(),
        "provider_video_id": provider_video_id or video_url,
        "type": "open_source",
        "video_url": video_url,
        "thumbnail_url": thumb,
        "duration": min(duration, 600) if duration else None,  # Max 10 minutes
        "license": license,
        "width": width,
        "height": height,
        "quality": "4K" if (width and width >= 3840) else "HD" if (width and width >= 1280) or (height and height >= 720) else "SD",
        "quality_score": quality_score,
        "tags": clean_tags,
        "author_name": author_name_for_source(source),
        "author_avatar": avatar_url_for_source(source),
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "views": 0,
        "liked_by": [],
        "created_at": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc)
    }

# ========== FETCHER PEXELS AMÉLIORÉ ==========
async def fetch_pexels_async(query: str = "nature", per_page: int = 15) -> List[Dict]:
    """Version asynchrone avec rate limiting et cache"""
    if not PEXELS_API_KEY:
        print("⚠️ Pexels API key manquante")
        return []
    
    # Vérifier cache
    cached = await get_cached_videos("pexels", query)
    if cached is not None:
        return cached
    
    await rate_limiter.async_wait_if_needed("pexels")
    
    headers = {"Authorization": PEXELS_API_KEY}
    params = {"query": query, "per_page": min(per_page, 80)}  # Max 80 par requête
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.pexels.com/videos/search",
                headers=headers,
                params=params,
                timeout=15
            ) as response:
                
                if response.status != 200:
                    print(f"⚠️ Pexels error {response.status}")
                    return []
                
                data = await response.json()
                items = []
                
                for v in data.get("videos", [])[:per_page]:
                    files = v.get("video_files", [])
                    
                    # Sélection meilleure qualité
                    video_url = get_best_video_from_pexels(files)
                    
                    if not video_url:
                        hd_files = [f for f in files if f.get("quality") in ["hd", "sd"]]
                        video_url = hd_files[0].get("link") if hd_files else None
                    
                    if not video_url:
                        continue
                    
                    # Vérification rapide disponibilité
                    if not check_video_availability(video_url):
                        continue
                    
                    thumb = v.get("image")
                    user_name = v.get("user", {}).get("name", "Pexels Creator")
                    title = f"{user_name} - {query.title()}"
                    duration = v.get("duration")
                    
                    best_file = max(files, key=lambda f: (f.get('width', 0) * f.get('height', 0)), default={})
                    width = best_file.get('width')
                    height = best_file.get('height')
                    
                    item = _norm_item(
                        video_url, title, thumb, "Pexels", duration, "Pexels License",
                        width=width, height=height, tags=[query, 'pexels', 'stock'],
                        provider="pexels", provider_video_id=str(v.get("id"))
                    )
                    
                    if item:
                        items.append(item)
                
                # Mise en cache
                await set_cached_videos("pexels", query, items)
                
                return items
                
    except asyncio.TimeoutError:
        print(f"⚠️ Pexels timeout pour '{query}'")
        return []
    except Exception as e:
        print(f"⚠️ Pexels error: {e}")
        return []

def fetch_pexels(query: str = "nature", per_page: int = 15) -> List[Dict]:
    """Wrapper synchrone"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(fetch_pexels_async(query, per_page))
    except:
        return []

# ========== FETCHER PIXABAY AMÉLIORÉ ==========
async def fetch_pixabay_async(query: str = "nature", per_page: int = 15) -> List[Dict]:
    """Version asynchrone avec rate limiting et cache"""
    if not PIXABAY_API_KEY:
        print("⚠️ Pixabay API key manquante")
        return []
    
    # Vérifier cache
    cached = await get_cached_videos("pixabay", query)
    if cached is not None:
        return cached
    
    await rate_limiter.async_wait_if_needed("pixabay")
    
    params = {
        "key": PIXABAY_API_KEY,
        "q": query,
        "per_page": min(per_page, 200),
        "video_type": "all",
        "safesearch": "true"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://pixabay.com/api/videos/",
                params=params,
                timeout=15
            ) as response:
                
                if response.status != 200:
                    print(f"⚠️ Pixabay error {response.status}")
                    return []
                
                data = await response.json()
                items = []
                
                for v in data.get("hits", [])[:per_page]:
                    videos = v.get("videos", {})
                    
                    video_url = get_best_video_from_pixabay(videos)
                    
                    if not video_url:
                        video_url = videos.get("medium", {}).get("url")
                    
                    if not video_url:
                        continue
                    
                    # Vérification disponibilité
                    if not check_video_availability(video_url):
                        continue
                    
                    # Génération thumbnail
                    thumb = None
                    if v.get("picture_id"):
                        thumb = f"https://i.vimeocdn.com/video/{v.get('picture_id')}_640x360.jpg"
                    
                    tags_str = v.get("tags", "Pixabay Video")
                    tags = [t.strip() for t in tags_str.split(",")] if isinstance(tags_str, str) else [tags_str]
                    title = tags[0] if tags else "Pixabay Video"
                    duration = v.get("duration")
                    
                    large = videos.get("large", {})
                    width = large.get("width")
                    height = large.get("height")
                    
                    item = _norm_item(
                        video_url, title, thumb, "Pixabay", duration, "Pixabay License",
                        width=width, height=height, tags=[query, 'pixabay'] + tags[:3],
                        provider="pixabay", provider_video_id=str(v.get("id"))
                    )
                    
                    if item:
                        items.append(item)
                
                # Mise en cache
                await set_cached_videos("pixabay", query, items)
                
                return items
                
    except asyncio.TimeoutError:
        print(f"⚠️ Pixabay timeout pour '{query}'")
        return []
    except Exception as e:
        print(f"⚠️ Pixabay error: {e}")
        return []

def fetch_pixabay(query: str = "nature", per_page: int = 15) -> List[Dict]:
    """Wrapper synchrone"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(fetch_pixabay_async(query, per_page))
    except:
        return []

# ========== SAMPLE VIDEOS ==========
def fetch_sample_videos() -> List[Dict]:
    """Return sample videos for initial content"""
    sample_videos = [
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "title": "Bienvenue sur SmartixClip!",
            "description": "Découvrez des vidéos éducatives et divertissantes",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
            "source": "Smartix",
            "duration": 15,
            "tags": ["welcome", "demo", "featured"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            "title": "Apprenez en vous amusant",
            "description": "Vidéos courtes pour un apprentissage rapide",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
            "source": "Smartix",
            "duration": 15,
            "tags": ["education", "learning", "demo"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
            "title": "Explorez de nouvelles connaissances",
            "description": "Du contenu frais chaque jour",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg",
            "source": "Smartix",
            "duration": 15,
            "tags": ["explore", "discovery", "demo"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
            "title": "Partagez vos moments",
            "description": "Créez et partagez vos propres clips",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg",
            "source": "Smartix",
            "duration": 15,
            "tags": ["share", "community", "demo"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "title": "Big Buck Bunny",
            "description": "Animation open source classique",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
            "source": "Archive.org",
            "duration": 60,
            "tags": ["animation", "blender", "opensource"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            "title": "Elephants Dream",
            "description": "Premier film Blender",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
            "source": "Archive.org",
            "duration": 60,
            "tags": ["blender", "3d", "animation"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
            "title": "Sintel",
            "description": "Film d'animation Blender",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
            "source": "Archive.org",
            "duration": 60,
            "tags": ["fantasy", "dragon", "blender"]
        },
        {
            "video_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
            "title": "Tears of Steel",
            "description": "Science-fiction open source",
            "thumbnail_url": "https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
            "source": "Archive.org",
            "duration": 60,
            "tags": ["scifi", "action", "blender"]
        },
    ]

    items = []
    for v in sample_videos:
        item = _norm_item(
            v["video_url"],
            v["title"],
            v.get("thumbnail_url"),
            v.get("source", "Smartix"),
            v.get("duration"),
            "Open Source",
            v.get("description"),
            tags=v.get("tags", ["sample"])
        )
        if item:
            items.append(item)

    return items

# ========== DÉDUPLICATION AMÉLIORÉE ==========
def deduplicate_videos(videos: List[Dict], quality_threshold: int = 50) -> List[Dict]:
    """Remove duplicate videos based on URL with quality scoring"""
    
    # Filtrer par qualité
    quality_filtered = [v for v in videos if v.get("quality_score", 0) >= quality_threshold]
    print(f"📊 Filtre qualité: {len(videos)} -> {len(quality_filtered)} (score ≥{quality_threshold})")
    
    # Grouper par URL
    url_map = {}
    for video in quality_filtered:
        url = video.get("video_url")
        if not url:
            continue
        
        # Garder la meilleure version de chaque URL
        if url not in url_map:
            url_map[url] = video
        else:
            existing_score = url_map[url].get("quality_score", 0)
            new_score = video.get("quality_score", 0)
            if new_score > existing_score:
                url_map[url] = video
    
    unique = list(url_map.values())
    
    # Trier par qualité
    unique.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
    
    print(f"✅ Déduplication: {len(videos)} -> {len(unique)} vidéos uniques")
    return unique

# ========== AGRÉGATION PRINCIPALE AMÉLIORÉE ==========
async def fetch_all_sources_async(
    queries: Optional[List[str]] = None,
    max_videos_per_source: int = 100,
    include_sample: bool = True
) -> List[Dict]:
    """
    Version asynchrone avec agrégation progressive
    """
    all_videos = []
    
    if queries is None:
        queries = [
            "nature", "technology", "sports", "music", 
            "education", "travel", "food", "art",
            "science", "business", "health", "animals",
            "africa", "city", "ocean", "forest",
            "space", "coding", "dance", "fitness"
        ]
    
    # Sample videos (toujours disponibles)
    if include_sample:
        print("🎬 Ajout des vidéos sample...")
        sample_videos = fetch_sample_videos()
        all_videos.extend(sample_videos)
        print(f"✅ Sample: {len(sample_videos)} vidéos")
    
    # Pexels (limitée)
    print("🎬 Agrégation Pexels...")
    pexels_count = 0
    for query in queries[:8]:  # Limiter à 8 requêtes
        try:
            videos = await fetch_pexels_async(query=query, per_page=15)
            all_videos.extend(videos)
            pexels_count += len(videos)
            print(f"  → {query}: {len(videos)} vidéos")
            await asyncio.sleep(1)  # Pause entre les requêtes
        except Exception as e:
            print(f"❌ Erreur Pexels {query}: {e}")
    print(f"✅ Pexels total: {pexels_count} vidéos")
    
    # Pixabay (limitée)
    print("🎬 Agrégation Pixabay...")
    pixabay_count = 0
    for query in queries[:8]:  # Limiter à 8 requêtes
        try:
            videos = await fetch_pixabay_async(query=query, per_page=15)
            all_videos.extend(videos)
            pixabay_count += len(videos)
            print(f"  → {query}: {len(videos)} vidéos")
            await asyncio.sleep(1)  # Pause entre les requêtes
        except Exception as e:
            print(f"❌ Erreur Pixabay {query}: {e}")
    print(f"✅ Pixabay total: {pixabay_count} vidéos")
    
    # Autres sources (si disponibles)
    if FETCHERS_AVAILABLE:
        fetchers = [
            ("Videvo", fetch_videvo, 20),
            ("Coverr", fetch_coverr, 20),
            ("Archive.org", fetch_archive_org, 15),
            ("Mazwai", fetch_mazwai, 15),
        ]
        
        for name, fetcher, limit in fetchers:
            print(f"🎬 Agrégation {name}...")
            try:
                await rate_limiter.async_wait_if_needed(name.lower())
                videos = fetcher(per_page=limit)
                if videos:
                    all_videos.extend(videos)
                    print(f"  → {len(videos)} vidéos")
            except Exception as e:
                print(f"❌ Erreur {name}: {e}")
    
    # Déduplication finale
    unique_videos = deduplicate_videos(all_videos)
    
    # Limiter le nombre total
    if len(unique_videos) > max_videos_per_source * 5:
        unique_videos = unique_videos[:max_videos_per_source * 5]
    
    print(f"📊 TOTAL: {len(unique_videos)} vidéos uniques après agrégation")
    return unique_videos

def fetch_all_sources() -> List[Dict]:
    """Wrapper synchrone pour compatibilité"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(fetch_all_sources_async())
    except Exception as e:
        print(f"❌ Erreur agrégation: {e}")
        return fetch_sample_videos()  # Fallback

# ========== FONCTIONS DE MAINTENANCE ==========
async def cleanup_old_cache(max_age_hours: int = 24):
    """Nettoie le cache Redis"""
    try:
        redis = await get_redis()
        if not redis:
            return
        
        keys = redis.keys("scraper:*")
        removed = 0
        now = time.time()
        
        for key in keys:
            try:
                data = redis.get(key)
                if data:
                    cached = json.loads(data)
                    if now - cached.get("timestamp", 0) > max_age_hours * 3600:
                        redis.delete(key)
                        removed += 1
            except:
                pass
        
        print(f"🧹 Cache nettoyé: {removed} clés supprimées")
        
    except Exception as e:
        print(f"⚠️ Erreur nettoyage cache: {e}")

def get_scraper_stats() -> Dict:
    """Retourne les statistiques du scraper"""
    return {
        "sources": list(RATE_LIMITS.keys()),
        "rate_limits": RATE_LIMITS,
        "fetchers_available": FETCHERS_AVAILABLE,
        "pexels_api": bool(PEXELS_API_KEY),
        "pixabay_api": bool(PIXABAY_API_KEY),
        "cache_enabled": redis_client is not None
    }

# ========== POINT D'ENTRÉE PRINCIPAL ==========
if __name__ == "__main__":
    print("🚀 Test du scraper...")
    videos = fetch_all_sources()
    print(f"\n✅ {len(videos)} vidéos récupérées")
    
    # Afficher quelques stats
    sources = {}
    qualities = {}
    for v in videos:
        src = v.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
        qual = v.get("quality", "unknown")
        qualities[qual] = qualities.get(qual, 0) + 1
    
    print("\n📊 Par source:")
    for src, count in sources.items():
        print(f"  {src}: {count}")
    
    print("\n📊 Par qualité:")
    for qual, count in qualities.items():
        print(f"  {qual}: {count}")
