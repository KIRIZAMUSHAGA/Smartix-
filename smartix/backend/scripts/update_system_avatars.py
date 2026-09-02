import asyncio
import os
import hashlib
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

def get_unique_avatar_url(user_id, full_name, gender):
    """
    Génère une URL d'avatar unique pour chaque utilisateur.
    Utilise DiceBear API avec un seed unique basé sur l'ID utilisateur.
    
    DiceBear génère des avatars déterministes: même seed = même avatar.
    Cela garantit 10 000+ avatars uniques puisque chaque user_id est unique.
    """
    seed = hashlib.md5(user_id.encode()).hexdigest()[:12]
    
    styles = [
        "avataaars",
        "avataaars-neutral", 
        "big-ears",
        "big-ears-neutral",
        "big-smile",
        "lorelei",
        "lorelei-neutral",
        "micah",
        "notionists",
        "notionists-neutral",
        "open-peeps",
        "personas",
        "pixel-art",
        "pixel-art-neutral"
    ]
    
    style_index = int(seed[:2], 16) % len(styles)
    style = styles[style_index]
    
    if style in ["avataaars", "avataaars-neutral", "big-ears", "big-ears-neutral", 
                 "lorelei", "lorelei-neutral", "micah", "open-peeps", "personas"]:
        bg_colors = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "f4d9b2", "a8e6cf", "dcedc1"]
        bg_index = int(seed[2:4], 16) % len(bg_colors)
        bg = bg_colors[bg_index]
        return f"https://api.dicebear.com/7.x/{style}/svg?seed={seed}&backgroundColor={bg}&size=150"
    else:
        return f"https://api.dicebear.com/7.x/{style}/svg?seed={seed}&size=150"

async def update_avatars():
    load_dotenv()
    
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix")
    
    if not mongo_uri:
        print("❌ MONGO_URL non trouvée")
        return

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        users_col = db.users

        print(f"🔍 Recherche des profils système dans {db_name}...")
        
        cursor = users_col.find({"is_system": True})
        count = await users_col.count_documents({"is_system": True})
        
        if count == 0:
            print("ℹ️ Aucun profil système trouvé.")
            return

        print(f"📸 Génération de {count} avatars uniques...")
        
        from pymongo import UpdateOne
        batch_size = 500
        updates = []
        total_updated = 0
        avatar_urls = set()
        
        async for user in cursor:
            user_id = str(user.get("id", user.get("_id", "")))
            full_name = user.get("full_name", "User")
            gender = user.get("genre", "N")
            
            avatar_url = get_unique_avatar_url(user_id, full_name, gender)
            avatar_urls.add(avatar_url)
            
            updates.append(UpdateOne({"_id": user["_id"]}, {"$set": {"avatar": avatar_url}}))
            
            if len(updates) >= batch_size:
                result = await users_col.bulk_write(updates)
                total_updated += result.modified_count
                print(f"✅ {total_updated}/{count} avatars mis à jour...")
                updates = []

        if updates:
            result = await users_col.bulk_write(updates)
            total_updated += result.modified_count

        print(f"\n✨ Mise à jour terminée :")
        print(f"   - {total_updated} avatars mis à jour")
        print(f"   - {len(avatar_urls)} URLs d'avatars uniques générées")
        
        if len(avatar_urls) == count:
            print(f"   ✅ Tous les avatars sont maintenant uniques!")
        else:
            print(f"   ⚠️ {count - len(avatar_urls)} avatars en double")
            
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(update_avatars())
