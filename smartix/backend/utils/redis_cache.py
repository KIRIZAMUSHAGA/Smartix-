import redis.asyncio as redis
import os
import json

redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'), decode_responses=True)

async def get_cached_feed(cursor_key):
    data = await redis_client.get(f"feed:{cursor_key}")
    return json.loads(data) if data else None

async def set_cached_feed(cursor_key, data, ttl=30):
    await redis_client.setex(f"feed:{cursor_key}", ttl, json.dumps(data))
