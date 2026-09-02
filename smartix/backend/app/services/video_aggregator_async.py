"""
Async Video Aggregator for SmartixClip
Fetches from all sources in PARALLEL and stores in MongoDB
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict
from datetime import datetime, timezone

from app.services.scraper_sources import (
    fetch_pexels, fetch_pixabay, fetch_sample_videos, 
    PEXELS_API_KEY, PIXABAY_API_KEY, FETCHERS_AVAILABLE
)

try:
    from app.services.fetchers import fetch_videvo, fetch_coverr, fetch_archive_org, fetch_mazwai
except ImportError:
    fetch_videvo = fetch_coverr = fetch_archive_org = fetch_mazwai = None


SEARCH_QUERIES = [
    "nature", "technology", "sports", "music", 
    "education", "travel", "food", "art",
    "science", "business", "health", "animals",
    "africa", "city", "ocean", "forest"
]


def _fetch_pexels_all() -> List[Dict]:
    """Fetch all Pexels videos synchronously"""
    if not PEXELS_API_KEY:
        print("⚠️ PEXELS: Clé API non configurée")
        return []
    
    all_videos = []
    for query in SEARCH_QUERIES:
        try:
            videos = fetch_pexels(query=query, per_page=20)
            all_videos.extend(videos)
        except Exception as e:
            print(f"❌ Pexels ({query}): {e}")
    
    print(f"📹 PEXELS: {len(all_videos)} vidéos trouvées")
    return all_videos


def _fetch_pixabay_all() -> List[Dict]:
    """Fetch all Pixabay videos synchronously"""
    if not PIXABAY_API_KEY:
        print("⚠️ PIXABAY: Clé API non configurée")
        return []
    
    all_videos = []
    for query in SEARCH_QUERIES:
        try:
            videos = fetch_pixabay(query=query, per_page=20)
            all_videos.extend(videos)
        except Exception as e:
            print(f"❌ Pixabay ({query}): {e}")
    
    print(f"📹 PIXABAY: {len(all_videos)} vidéos trouvées")
    return all_videos


def _fetch_sample() -> List[Dict]:
    """Fetch sample videos"""
    videos = fetch_sample_videos()
    print(f"📹 SAMPLE: {len(videos)} vidéos trouvées")
    return videos


def _fetch_coverr() -> List[Dict]:
    """Fetch Coverr videos"""
    if not fetch_coverr or not FETCHERS_AVAILABLE:
        return []
    try:
        videos = fetch_coverr(per_page=20)
        print(f"📹 COVERR: {len(videos)} vidéos trouvées")
        return videos
    except Exception as e:
        print(f"❌ Coverr: {e}")
        return []


def _fetch_videvo() -> List[Dict]:
    """Fetch Videvo videos"""
    if not fetch_videvo or not FETCHERS_AVAILABLE:
        return []
    try:
        videos = fetch_videvo(per_page=20)
        print(f"📹 VIDEVO: {len(videos)} vidéos trouvées")
        return videos
    except Exception as e:
        print(f"❌ Videvo: {e}")
        return []


def _fetch_archive() -> List[Dict]:
    """Fetch Archive.org videos"""
    if not fetch_archive_org or not FETCHERS_AVAILABLE:
        return []
    try:
        videos = fetch_archive_org(per_page=15)
        print(f"📹 ARCHIVE.ORG: {len(videos)} vidéos trouvées")
        return videos
    except Exception as e:
        print(f"❌ Archive.org: {e}")
        return []


def _fetch_mazwai() -> List[Dict]:
    """Fetch Mazwai videos"""
    if not fetch_mazwai or not FETCHERS_AVAILABLE:
        return []
    try:
        videos = fetch_mazwai(per_page=15)
        print(f"📹 MAZWAI: {len(videos)} vidéos trouvées")
        return videos
    except Exception as e:
        print(f"❌ Mazwai: {e}")
        return []


async def fetch_all_sources_parallel() -> List[Dict]:
    """
    Fetch videos from ALL sources in PARALLEL using ThreadPoolExecutor.
    Returns combined list of all videos.
    """
    print("\n" + "="*60)
    print("🚀 DÉMARRAGE AGRÉGATION VIDÉOS EN PARALLÈLE")
    print("="*60 + "\n")
    
    loop = asyncio.get_event_loop()
    all_videos = []
    
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [
            loop.run_in_executor(executor, _fetch_sample),
            loop.run_in_executor(executor, _fetch_pexels_all),
            loop.run_in_executor(executor, _fetch_pixabay_all),
        ]
        
        if FETCHERS_AVAILABLE:
            futures.extend([
                loop.run_in_executor(executor, _fetch_coverr),
                loop.run_in_executor(executor, _fetch_videvo),
                loop.run_in_executor(executor, _fetch_archive),
                loop.run_in_executor(executor, _fetch_mazwai),
            ])
        
        results = await asyncio.gather(*futures, return_exceptions=True)
        
        for result in results:
            if isinstance(result, Exception):
                print(f"❌ Erreur scraper: {result}")
            elif isinstance(result, list):
                all_videos.extend(result)
    
    seen_urls = set()
    unique_videos = []
    for video in all_videos:
        url = video.get("video_url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_videos.append(video)
    
    print(f"\n📊 TOTAL: {len(unique_videos)} vidéos uniques (dédupliquées de {len(all_videos)})")
    return unique_videos


async def run_full_aggregation() -> int:
    """
    Run full video aggregation: fetch all sources and store in MongoDB.
    Returns number of new videos inserted.
    """
    from app.services.video_service import bulk_insert
    
    print("\n🔄 Début de l'agrégation complète des vidéos...")
    
    try:
        videos = await fetch_all_sources_parallel()
        
        if videos:
            inserted = await bulk_insert(videos)
            print(f"\n✅ AGRÉGATION TERMINÉE: {inserted} nouvelles vidéos ajoutées")
            return inserted
        else:
            print("⚠️ Aucune vidéo récupérée des sources")
            return 0
            
    except Exception as e:
        print(f"❌ Erreur agrégation: {e}")
        import traceback
        traceback.print_exc()
        return 0


async def get_aggregation_stats() -> Dict:
    """Get statistics about current video aggregation"""
    from app.services.video_service import get_videos_count
    
    try:
        total = await get_videos_count()
        
        from db import get_collection
        collection = get_collection('smartclips')
        
        pipeline = [
            {"$group": {"_id": "$source", "count": {"$sum": 1}}}
        ]
        cursor = collection.aggregate(pipeline)
        source_counts = {}
        async for doc in cursor:
            source_counts[doc["_id"]] = doc["count"]
        
        return {
            "total_videos": total,
            "by_source": source_counts,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return {"error": str(e)}
