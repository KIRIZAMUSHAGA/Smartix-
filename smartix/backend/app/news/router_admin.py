from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db_mongo import get_db
from app.aggregator.aggregator import run_once_sync, run_once
from app.aggregator.deduplicator import mark_duplicates_sync
import asyncio

router = APIRouter()

@router.post("/admin/sources")
async def add_source(name: str, rss_url: str, country: str = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    sources_collection = db["news_sources"]

    existing = await sources_collection.find_one({"rss_url": rss_url})
    if existing:
        raise HTTPException(status_code=400, detail="Source already exists")

    source = {
        "name": name,
        "rss_url": rss_url,
        "country": country,
        "priority": 0,
        "last_checked": None
    }
    result = await sources_collection.insert_one(source)
    return {"ok": True, "source": {"id": str(result.inserted_id), "name": name}}

@router.post("/admin/fetch")
async def trigger_fetch():
    """Déclenche manuellement l'agrégation de news"""
    try:
        asyncio.create_task(run_once())
        return {"status": "success", "message": "News aggregation started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/dedupe")
async def trigger_dedupe(db: AsyncIOMotorDatabase = Depends(get_db)):
    mark_duplicates_sync(db)
    return {"ok": True, "message": "Deduplication triggered"}

@router.get("/admin/test-sources")
async def test_all_sources():
    """Teste toutes les sources RSS et retourne un rapport détaillé"""
    from app.aggregator.rss_fetcher import fetch_from_rss
    from app.aggregator.rss_sources import DEFAULT_RSS_SOURCES

    results = []
    for source in DEFAULT_RSS_SOURCES:
        try:
            items = fetch_from_rss(source["rss_url"])
            results.append({
                "name": source["name"],
                "url": source["rss_url"],
                "status": "success",
                "items_count": len(items),
                "first_title": items[0]["title"] if items else None
            })
        except Exception as e:
            results.append({
                "name": source["name"],
                "url": source["rss_url"],
                "status": "error",
                "error": str(e)
            })

    working = [r for r in results if r["status"] == "success" and r["items_count"] > 0]
    empty = [r for r in results if r["status"] == "success" and r["items_count"] == 0]
    errors = [r for r in results if r["status"] == "error"]

    return {
        "total": len(results),
        "working": len(working),
        "empty": len(empty),
        "errors": len(errors),
        "details": {
            "working_sources": working,
            "empty_sources": empty,
            "error_sources": errors
        }
    }