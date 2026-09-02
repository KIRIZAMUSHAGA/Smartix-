"""
Script: Envoi de demandes d'ami sortantes depuis les profils système
=====================================================================

Version canonique - utilise (user_low_id, user_high_id) pour les relations.
Garantit qu'une seule entrée existe par paire d'utilisateurs.
"""

import os
import asyncio
import random
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv


def get_canonical_pair(id_a: str, id_b: str) -> tuple:
    """Retourne la paire canonique (user_low_id, user_high_id)"""
    if id_a < id_b:
        return (id_a, id_b)
    return (id_b, id_a)


async def process_system_outbound_requests():
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL", "")
    db_name = os.environ.get("DB_NAME", "smartohada")

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        
        threshold = datetime.now(timezone.utc) - timedelta(hours=24)
        new_real_users = await db.users.find({
            "is_system": {"$ne": True},
            "created_at": {"$gte": threshold.isoformat() if isinstance(threshold, datetime) else threshold}
        }).to_list(100)

        if not new_real_users:
            return

        system_actors = await db.users.aggregate([
            {"$match": {"is_system": True}},
            {"$sample": {"size": 50}}
        ]).to_list(50)

        for real_user in new_real_users:
            real_user_id = real_user["id"]
            
            vague_size = random.randint(1, 5)
            selected_systems = random.sample(system_actors, min(vague_size, len(system_actors)))

            for sys_user in selected_systems:
                sys_id = sys_user["id"]
                
                low_id, high_id = get_canonical_pair(sys_id, real_user_id)
                
                existing = await db.friend_requests.find_one({
                    "user_low_id": low_id,
                    "user_high_id": high_id
                })
                
                if existing:
                    continue

                now = datetime.now(timezone.utc)
                await db.friend_requests.insert_one({
                    "user_low_id": low_id,
                    "user_high_id": high_id,
                    "status": "pending",
                    "initiated_by": sys_id,
                    "created_at": now,
                    "updated_at": now
                })

                await db.users.update_one({"id": sys_id}, {"$addToSet": {"friend_requests_sent": real_user_id}})
                await db.users.update_one({"id": real_user_id}, {"$addToSet": {"friend_requests_received": sys_id}})

                await db.notifications.insert_one({
                    "user_id": real_user_id,
                    "actor_id": sys_id,
                    "actor_name": sys_user.get("full_name"),
                    "actor_avatar": sys_user.get("avatar"),
                    "type": "friend_request",
                    "content": "vous a envoyé une demande d'ami.",
                    "target_id": sys_id,
                    "read": False,
                    "created_at": now
                })
                print(f"📡 System {sys_user.get('full_name')} sent request to new user {real_user.get('full_name')}")

    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(process_system_outbound_requests())
