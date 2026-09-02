"""⚡ Optimized route patterns"""
from fastapi import APIRouter
from typing import List, Optional

router = APIRouter()

# ⚡ Query optimization with projections
async def find_posts_optimized(db, skip: int = 0, limit: int = 20, user_id: str = None):
    """Optimized posts query with field projection"""
    projection = {
        "_id": 1,
        "id": 1,
        "user_id": 1,
        "content": 1,
        "image": 1,
        "likes_count": 1,
        "comments_count": 1,
        "shares_count": 1,
        "created_at": 1
    }
    # ⚡ Filtrage des utilisateurs bloqués (Mutuel)
    blocked_ids = []
    if user_id:
        user_blocks = await db.user_blocks.find({
            "$or": [
                {"user_id": user_id, "status": "blocked"},
                {"blocked_id": user_id, "status": "blocked"}
            ]
        }).to_list(1000)
        
        for block in user_blocks:
            if block["user_id"] == user_id:
                blocked_ids.append(block["blocked_id"])
            else:
                blocked_ids.append(block["user_id"])

    query = {"deleted": {"$ne": True}}
    if blocked_ids:
        query["user_id"] = {"$nin": blocked_ids}

    return await db.posts.find(
        query,
        projection
    ).skip(skip).limit(limit).to_list(limit)

# ⚡ Batch operations
async def batch_update_counts(db, updates: dict):
    """Batch update multiple counters"""
    operations = []
    for post_id, counts in updates.items():
        operations.append({
            "updateOne": {
                "filter": {"id": post_id},
                "update": {"$set": counts}
            }
        })
    if operations:
        await db.posts.bulk_write(operations)
