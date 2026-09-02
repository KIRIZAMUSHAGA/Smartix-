from rapidfuzz import fuzz
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio

async def is_similar(a: str, b: str, threshold: int = 92) -> bool:
    if not a or not b:
        return False
    score = fuzz.ratio(a, b)
    return score >= threshold

async def mark_duplicates(db: AsyncIOMotorDatabase, recent_window: int = 500):
    """Compare recent entries and mark duplicates"""
    news_collection = db["news"]
    
    # Get recent news sorted by published_at
    recent = await news_collection.find({}).sort("published_at", -1).limit(recent_window).to_list(length=recent_window)
    
    for i, doc_a in enumerate(recent):
        for doc_b in recent[i+1:]:
            title_a = doc_a.get("title", "")
            title_b = doc_b.get("title", "")
            
            if await is_similar(title_a, title_b):
                # Mark one as duplicate based on published_at
                pub_a = doc_a.get("published_at")
                pub_b = doc_b.get("published_at")
                
                if pub_a and pub_b:
                    if pub_a >= pub_b:
                        await news_collection.update_one(
                            {"_id": doc_b["_id"]},
                            {"$set": {"is_duplicate": True}}
                        )
                    else:
                        await news_collection.update_one(
                            {"_id": doc_a["_id"]},
                            {"$set": {"is_duplicate": True}}
                        )

def mark_duplicates_sync(db):
    """Sync wrapper for scheduler"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(mark_duplicates(db))
    finally:
        loop.close()
