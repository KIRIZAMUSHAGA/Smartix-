import json
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def update_system_names():
    load_dotenv()
    
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix")
    
    if not mongo_uri:
        print("❌ MONGO_URL non trouvée dans les variables d'environnement")
        return

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        users_col = db.users

        script_dir = os.path.dirname(os.path.abspath(__file__))
        input_path = os.path.join(script_dir, "system_profiles_10000.json")
        
        if not os.path.exists(input_path):
            print(f"❌ Fichier non trouvé : {input_path}")
            return

        print(f"📂 Lecture de {input_path}...")
        with open(input_path, "r", encoding="utf-8") as f:
            new_profiles = json.load(f)

        system_users = await users_col.find({"is_system": True}).to_list(length=None)
        print(f"📊 Trouvé {len(system_users)} utilisateurs système en base")
        print(f"📊 Nouveaux profils disponibles: {len(new_profiles)}")
        
        if len(system_users) == 0:
            print("ℹ️ Aucun utilisateur système trouvé. Utiliser inject_system_users.py pour les créer.")
            return

        print(f"🚀 Mise à jour des noms de {len(system_users)} profils système...")
        
        from pymongo import UpdateOne
        updates = []
        
        for i, user in enumerate(system_users):
            if i < len(new_profiles):
                new_data = new_profiles[i]
                updates.append(UpdateOne(
                    {"_id": user["_id"]},
                    {"$set": {
                        "full_name": new_data["full_name"],
                        "prenom": new_data["prenom"],
                        "nom": new_data["nom"],
                        "pays": new_data["pays"],
                        "ville": new_data["ville"]
                    }}
                ))
        
        batch_size = 500
        total_updated = 0
        
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            result = await users_col.bulk_write(batch)
            total_updated += result.modified_count
            print(f"📊 Progression : {total_updated}/{len(updates)} profils mis à jour...")

        names_in_db = [u["full_name"] for u in await users_col.find({"is_system": True}, {"full_name": 1}).to_list(length=None)]
        unique_names = set(names_in_db)
        duplicates = len(names_in_db) - len(unique_names)
        
        print(f"\n✨ Mise à jour terminée :")
        print(f"   - {total_updated} profils mis à jour")
        print(f"   - {len(unique_names)} noms uniques en base")
        if duplicates > 0:
            print(f"   ⚠️ {duplicates} noms encore en double")
        else:
            print(f"   ✅ Tous les noms sont maintenant uniques!")
            
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(update_system_names())
