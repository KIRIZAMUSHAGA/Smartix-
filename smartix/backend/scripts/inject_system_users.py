import json
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def inject_profiles():
    load_dotenv()
    
    # Configuration MongoDB - Utiliser MONGO_URL et DB_NAME
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix") # Fallback sur 'smartix' si DB_NAME absent
    
    if not mongo_uri:
        print("❌ MONGO_URL non trouvée dans les variables d'environnement")
        return

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        users_col = db.users

        # Lecture du fichier JSON
        input_path = "backend/scripts/system_profiles_10000.json"
        if not os.path.exists(input_path):
            print(f"❌ Fichier non trouvé : {input_path}")
            return

        print(f"📂 Lecture de {input_path}...")
        with open(input_path, "r", encoding="utf-8") as f:
            profiles = json.load(f)

        print(f"🚀 Injection de {len(profiles)} profils dans la base '{db_name}'...")
        
        batch_size = 500
        total_inserted = 0
        
        for i in range(0, len(profiles), batch_size):
            batch = profiles[i:i + batch_size]
            try:
                # Utiliser unordered=True pour ignorer les erreurs de doublons et continuer
                result = await users_col.insert_many(batch, ordered=False)
                total_inserted += len(result.inserted_ids)
            except Exception as e:
                # Si des doublons sont détectés, on compte ceux qui ont été insérés
                if hasattr(e, 'details') and 'nInserted' in e.details:
                    total_inserted += e.details['nInserted']
                print(f"⚠️ Note lot {i//batch_size + 1} : Certains profils existent déjà ou erreur mineure.")
            
            print(f"📊 Progression : {total_inserted} profils en base...")

        print(f"✨ Mission accomplie : {total_inserted} profils système sont maintenant en base de données.")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(inject_profiles())
