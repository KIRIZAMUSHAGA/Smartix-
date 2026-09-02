"""
Script: Auto-acceptation des demandes d'ami pour les profils système
=====================================================================

Version canonique - utilise (user_low_id, user_high_id) pour les relations.
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


async def process_system_responses():
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL", "")
    db_name = os.environ.get("DB_NAME", "smartohada")

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        
        pending_requests = await db.friend_requests.find({
            "status": "pending"
        }).to_list(None)
        
        if not pending_requests:
            print("😴 No pending requests to process.")
            return

        print(f"🧐 Found {len(pending_requests)} pending requests. Checking which ones are for system users...")

        for req in pending_requests:
            initiated_by = req.get("initiated_by")
            user_low = req.get("user_low_id")
            user_high = req.get("user_high_id")
            
            if not initiated_by or not user_low or not user_high:
                continue
            
            receiver_id = user_high if initiated_by == user_low else user_low
            sender_id = initiated_by
            
            receiver = await db.users.find_one({"id": receiver_id, "is_system": True})
            if not receiver:
                continue
            
            sig = receiver.get("signature_temporelle", {})
            avg_delay = sig.get("temps_moyen_reponse_sec", 300)
            variance = sig.get("variance_reponse_pourcent", 50)
            
            created_at = req.get("created_at")
            if not created_at:
                continue
            
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            delay_factor = 1 + (random.uniform(-variance, variance) / 100)
            required_delay = timedelta(seconds=avg_delay * delay_factor)
            
            if datetime.now(timezone.utc) - created_at > required_delay:
                print(f"✅ System user {receiver.get('full_name')} accepting request from {sender_id}")
                
                now = datetime.now(timezone.utc)
                # Utilisation de la structure canonique pour garantir la cohérence
                await db.friend_requests.update_one(
                    {"_id": req["_id"]},
                    {"$set": {"status": "accepted", "updated_at": now}}
                )
                
                # Mise à jour des caches legacy 'friends' dans la collection users
                await db.users.update_one(
                    {"id": receiver_id},
                    {
                        "$addToSet": {"friends": sender_id},
                        "$pull": {"friend_requests_received": sender_id}
                    }
                )
                await db.users.update_one(
                    {"id": sender_id},
                    {
                        "$addToSet": {"friends": receiver_id},
                        "$pull": {"friend_requests_sent": receiver_id}
                    }
                )
                
                await db.notifications.insert_one({
                    "user_id": sender_id,
                    "actor_id": receiver_id,
                    "actor_name": receiver.get("full_name"),
                    "actor_avatar": receiver.get("avatar"),
                    "type": "friend_accept",
                    "content": "a accepté votre demande d'ami.",
                    "target_id": receiver_id,
                    "read": False,
                    "created_at": datetime.now(timezone.utc)
                })
            else:
                print(f"⏳ Too soon for {receiver.get('full_name')} to respond.")

    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(process_system_responses())
