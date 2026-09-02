"""
Incremental Scraper - Scraping intelligent et planifié
Planifie 10 requêtes réparties sur 10 heures (1 par heure)
"""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor
import random

_scheduler_tasks = {}
_batch_lock = asyncio.Lock()


async def get_collection(name: str):
    from db import get_collection as db_get_collection
    return db_get_collection(name)


async def get_existing_video_ids() -> set:
    """Récupérer les IDs des vidéos déjà en base"""
    try:
        clips_col = await get_collection('smartclips')
        cursor = clips_col.find({}, {"provider_video_id": 1, "video_url": 1})
        videos = await cursor.to_list(100000)
        
        ids = set()
        for v in videos:
            if v.get("provider_video_id"):
                ids.add(str(v["provider_video_id"]))
            if v.get("video_url"):
                ids.add(v["video_url"])
        return ids
    except Exception as e:
        print(f"Error getting existing video IDs: {e}")
        return set()


async def get_max_batch_number() -> int:
    """Récupérer le numéro de batch maximum actuel"""
    try:
        clips_col = await get_collection('smartclips')
        pipeline = [
            {"$group": {"_id": None, "max_batch": {"$max": "$batch_number"}}}
        ]
        result = await clips_col.aggregate(pipeline).to_list(1)
        if result and result[0].get("max_batch"):
            return result[0]["max_batch"]
        return 0
    except Exception as e:
        print(f"Error getting max batch number: {e}")
        return 0


async def store_batch_videos(videos: List[Dict], batch_number: int) -> int:
    """Stocker les vidéos d'un batch avec priority = batch_number + 1"""
    if not videos:
        return 0
    
    try:
        clips_col = await get_collection('smartclips')
        existing_ids = await get_existing_video_ids()
        
        inserted = 0
        for video in videos:
            video_url = video.get("video_url", "")
            provider_id = str(video.get("provider_video_id", ""))
            
            if video_url in existing_ids or provider_id in existing_ids:
                continue
            
            video["batch_number"] = batch_number
            video["priority"] = batch_number + 1
            video["fetched_at"] = datetime.now(timezone.utc)
            if "created_at" not in video:
                video["created_at"] = datetime.now(timezone.utc)
            if "id" not in video:
                from bson import ObjectId
                video["id"] = str(ObjectId())
            
            try:
                await clips_col.insert_one(video)
                inserted += 1
                existing_ids.add(video_url)
                if provider_id:
                    existing_ids.add(provider_id)
            except Exception as e:
                if "duplicate" not in str(e).lower():
                    print(f"Insert error: {e}")
        
        print(f"✅ Batch {batch_number}: {inserted} nouvelles vidéos insérées")
        return inserted
    except Exception as e:
        print(f"Error storing batch videos: {e}")
        return 0


def fetch_pexels_batch(query: str = "education", per_page: int = 40, page: int = 1) -> List[Dict]:
    """Fetch un batch de vidéos Pexels"""
    import os
    import requests
    
    api_key = os.getenv("PEXELS_API_KEY", "")
    if not api_key:
        return []
    
    try:
        headers = {"Authorization": api_key}
        url = f"https://api.pexels.com/videos/search?query={query}&per_page={per_page}&page={page}"
        
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            print(f"Pexels error: {response.status_code}")
            return []
        
        data = response.json()
        videos = []
        
        for video in data.get("videos", []):
            video_files = video.get("video_files", [])
            best_file = None
            for vf in video_files:
                if vf.get("quality") == "hd" or vf.get("height", 0) >= 720:
                    best_file = vf
                    break
            if not best_file and video_files:
                best_file = video_files[0]
            
            if best_file:
                videos.append({
                    "provider": "pexels",
                    "provider_video_id": str(video.get("id")),
                    "video_url": best_file.get("link"),
                    "thumbnail_url": video.get("image"),
                    "title": f"Pexels Video {video.get('id')}",
                    "description": query,
                    "source": "Pexels",
                    "author_name": video.get("user", {}).get("name", "Pexels"),
                    "author_avatar": video.get("user", {}).get("url", ""),
                    "tags": [query, "pexels", "stock"],
                    "likes": 0,
                    "views": 0,
                    "comments": 0,
                    "shares": 0
                })
        
        return videos
    except Exception as e:
        print(f"Pexels fetch error: {e}")
        return []


def fetch_pixabay_batch(query: str = "education", per_page: int = 40, page: int = 1) -> List[Dict]:
    """Fetch un batch de vidéos Pixabay"""
    import os
    import requests
    
    api_key = os.getenv("PIXABAY_API_KEY", "")
    if not api_key:
        return []
    
    try:
        url = f"https://pixabay.com/api/videos/?key={api_key}&q={query}&per_page={per_page}&page={page}"
        
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            print(f"Pixabay error: {response.status_code}")
            return []
        
        data = response.json()
        videos = []
        
        for video in data.get("hits", []):
            video_files = video.get("videos", {})
            best_file = video_files.get("medium", video_files.get("small", {}))
            
            if best_file.get("url"):
                videos.append({
                    "provider": "pixabay",
                    "provider_video_id": str(video.get("id")),
                    "video_url": best_file.get("url"),
                    "thumbnail_url": f"https://i.vimeocdn.com/video/{video.get('picture_id')}_640x360.jpg",
                    "title": f"Pixabay Video {video.get('id')}",
                    "description": query,
                    "source": "Pixabay",
                    "author_name": video.get("user", "Pixabay"),
                    "author_avatar": video.get("userImageURL", ""),
                    "tags": [query, "pixabay", "stock"] + video.get("tags", "").split(", ")[:3],
                    "likes": video.get("likes", 0),
                    "views": video.get("views", 0),
                    "comments": video.get("comments", 0),
                    "shares": 0
                })
        
        return videos
    except Exception as e:
        print(f"Pixabay fetch error: {e}")
        return []


async def run_incremental_batch(batch_number: int, queries: List[str] = None) -> int:
    """Exécuter un batch de scraping incrémental"""
    if queries is None:
        queries = ["education", "science", "technology", "nature", "business"]
    
    print(f"\n🔄 Démarrage batch incrémental #{batch_number}")
    
    loop = asyncio.get_event_loop()
    all_videos = []
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        for query in queries:
            page = (batch_number % 10) + 1
            
            pexels_future = loop.run_in_executor(
                executor, fetch_pexels_batch, query, 20, page
            )
            pixabay_future = loop.run_in_executor(
                executor, fetch_pixabay_batch, query, 20, page
            )
            
            try:
                pexels_videos = await pexels_future
                all_videos.extend(pexels_videos)
            except Exception as e:
                print(f"Pexels batch error: {e}")
            
            try:
                pixabay_videos = await pixabay_future
                all_videos.extend(pixabay_videos)
            except Exception as e:
                print(f"Pixabay batch error: {e}")
    
    inserted = await store_batch_videos(all_videos, batch_number)
    
    status_col = await get_collection('scraping_status')
    await status_col.update_one(
        {"_id": "current"},
        {
            "$inc": {"completed_batches": 1},
            "$set": {
                "last_batch_completed": batch_number,
                "last_batch_time": datetime.now(timezone.utc),
                "last_batch_videos": inserted
            }
        }
    )
    
    print(f"✅ Batch #{batch_number} terminé: {inserted} nouvelles vidéos")
    return inserted


async def schedule_incremental_scraping(total_batches: int = 10, interval_hours: float = 1.0):
    """
    Planifier 10 batchs de scraping répartis sur 10 heures
    """
    global _scheduler_tasks
    
    async with _batch_lock:
        if "main_scheduler" in _scheduler_tasks and not _scheduler_tasks["main_scheduler"].done():
            print("⚠️ Scraping déjà planifié, annulation de la nouvelle demande")
            return
        
        current_batch = await get_max_batch_number()
        
        status_col = await get_collection('scraping_status')
        await status_col.update_one(
            {"_id": "current"},
            {
                "$set": {
                    "status": "scheduled",
                    "scheduled_batches": total_batches,
                    "completed_batches": 0,
                    "start_batch": current_batch + 1,
                    "started_at": datetime.now(timezone.utc),
                    "interval_hours": interval_hours
                }
            },
            upsert=True
        )
        
        print(f"\n📅 Planification de {total_batches} batchs sur {total_batches * interval_hours}h")
        print(f"   Intervalle: {interval_hours}h entre chaque batch")
        print(f"   Batch de départ: #{current_batch + 1}")
        
        async def scheduler_loop():
            for i in range(total_batches):
                batch_num = current_batch + 1 + i
                
                if i > 0:
                    delay_seconds = interval_hours * 3600
                    print(f"⏳ Attente de {interval_hours}h avant le batch #{batch_num}")
                    await asyncio.sleep(delay_seconds)
                
                try:
                    await run_incremental_batch(batch_num)
                except Exception as e:
                    print(f"❌ Erreur batch #{batch_num}: {e}")
                    await asyncio.sleep(60)
                    try:
                        await run_incremental_batch(batch_num)
                    except Exception as e2:
                        print(f"❌ Échec définitif batch #{batch_num}: {e2}")
            
            await status_col.update_one(
                {"_id": "current"},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
            print("🎉 Tous les batchs planifiés sont terminés!")
        
        _scheduler_tasks["main_scheduler"] = asyncio.create_task(scheduler_loop())


async def run_background_update(user_id: str = None):
    """
    Lancer une mise à jour en arrière-plan (appelé depuis SmartixClips)
    Vérifie d'abord si nécessaire, puis planifie le scraping
    """
    from app.services.smartclips_service import (
        should_trigger_scraping,
        check_session_scraping,
        mark_session_scraping_done
    )
    
    if user_id:
        already_scraped = await check_session_scraping(user_id)
        if already_scraped:
            print(f"ℹ️ Scraping déjà effectué cette session pour {user_id}")
            return False
    
    if user_id:
        should_scrape = await should_trigger_scraping(user_id)
        if not should_scrape:
            print(f"ℹ️ Seuil de scraping non atteint pour {user_id}")
            await mark_session_scraping_done(user_id)
            return False
    
    status_col = await get_collection('scraping_status')
    current_status = await status_col.find_one({"_id": "current"})
    
    if current_status and current_status.get("status") == "scheduled":
        print("ℹ️ Scraping déjà en cours")
        if user_id:
            await mark_session_scraping_done(user_id)
        return False
    
    await schedule_incremental_scraping(total_batches=10, interval_hours=1.0)
    
    if user_id:
        await mark_session_scraping_done(user_id)
    
    return True


async def run_initial_scraping():
    """
    Scraping initial léger au premier accès (si DB vide)
    Un seul batch pour avoir du contenu rapidement
    """
    clips_col = await get_collection('smartclips')
    count = await clips_col.count_documents({})
    
    if count > 0:
        print(f"ℹ️ Base déjà peuplée avec {count} vidéos")
        return count
    
    print("🚀 Scraping initial - Base vide, récupération du premier lot...")
    return await run_incremental_batch(1)
