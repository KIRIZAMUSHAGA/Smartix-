
"""
Video aggregator for SmartixClip - fetches from multiple sources and stores in DB
"""
import sys
import os

# Ajouter le répertoire backend au path Python
backend_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.services.scraper_sources import fetch_all_sources
from app.services.video_service import bulk_insert
import asyncio

async def run_video_aggregation():
    """Run video aggregation from all configured sources"""
    print("🔄 Starting video aggregation...")
    
    try:
        # Fetch all videos (already deduplicated in fetch_all_sources)
        items = fetch_all_sources()
        print(f"📹 Fetched {len(items) if items else 0} unique videos from sources")
        
        if items:
            # Insert into database
            inserted = await bulk_insert(items)
            print(f"✅ Video aggregation complete: {inserted} new videos added")
            return inserted
        else:
            print("⚠️ No videos fetched from sources")
            return 0
    except Exception as e:
        print(f"❌ Video aggregation error: {e}")
        import traceback
        traceback.print_exc()
        return 0

def run_video_aggregation_sync():
    """Synchronous wrapper for the aggregator"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, run_video_aggregation())
                return future.result()
        else:
            return loop.run_until_complete(run_video_aggregation())
    except RuntimeError:
        return asyncio.run(run_video_aggregation())
