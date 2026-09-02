import os
import asyncio
import logging
import random
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Ajout du chemin parent pour les imports
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from utils.system_presence import is_system_user_online, get_simulated_last_seen

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def sync_system_presence():
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix")
    
    if not mongo_uri:
        logger.error("MONGO_URL non configuré")
        return

    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    try:
        # 1. Récupérer les profils système
        cursor = db.users.find({"is_system": True})
        total_synced = 0
        online_count = 0
        
        batch_updates = []
        
        async for user in cursor:
            signature = user.get("signature_temporelle")
            if not signature:
                continue
                
            is_online = is_system_user_online(signature)
            last_seen = user.get("last_seen")
            
            # Si on passe de en-ligne à hors-ligne, on génère un last_seen réaliste
            # Sinon on garde le last_seen actuel ou on en génère un si manquant
            if is_online:
                update_fields = {
                    "is_online": True,
                    "last_seen": datetime.now(timezone.utc).isoformat()
                }
                online_count += 1
            else:
                if not last_seen:
                    last_seen = get_simulated_last_seen(signature)
                
                update_fields = {
                    "is_online": False,
                    "last_seen": last_seen
                }
            
            batch_updates.append(
                db.users.update_one({"id": user["id"]}, {"$set": update_fields})
            )
            
            # Exécution par batch de 100 pour la performance
            if len(batch_updates) >= 100:
                await asyncio.gather(*batch_updates)
                total_synced += len(batch_updates)
                batch_updates = []
                logger.info(f"Progression : {total_synced} profils synchronisés...")

        # Finaliser le dernier batch
        if batch_updates:
            await asyncio.gather(*batch_updates)
            total_synced += len(batch_updates)

        logger.info(f"Terminé ! {total_synced} profils synchronisés. En ligne : {online_count}")
        
    except Exception as e:
        logger.error(f"Erreur lors de la synchronisation : {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(sync_system_presence())
