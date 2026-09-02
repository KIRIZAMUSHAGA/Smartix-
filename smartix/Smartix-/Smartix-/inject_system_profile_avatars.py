"""
Script pour injecter des photos de profil réalistes aux profils systèmes.
Assigne des photos réalistes depuis la collection lumina_photos (base test)
aux profils systèmes (base smartohada) en respectant le genre.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne
import random

MONGO_URL = os.getenv('MONGO_URL', 'mongodb+srv://tolombe352_db_user:kiriza01@cluster0.pmhtdpl.mongodb.net/?appName=Cluster0')

async def inject_avatars():
    print("🚀 Démarrage de l'injection des avatars réalistes...")
    
    client = AsyncIOMotorClient(MONGO_URL)
    
    try:
        smartohada_db = client['smartohada']
        test_db = client['test']
        
        users_col = smartohada_db['users']
        lumina_col = test_db['lumina_photos']
        
        await client.admin.command('ping')
        print("✅ Connexion MongoDB établie")
        
        lumina_count = await lumina_col.count_documents({})
        system_count = await users_col.count_documents({'is_system': True})
        
        print(f"📸 Photos disponibles dans lumina_photos: {lumina_count}")
        print(f"👤 Profils systèmes à mettre à jour: {system_count}")
        
        male_count = await users_col.count_documents({'is_system': True, 'genre': 'M'})
        female_count = await users_col.count_documents({'is_system': True, 'genre': 'F'})
        neutral_count = await users_col.count_documents({'is_system': True, 'genre': 'N'})
        
        print(f"   - Hommes (M): {male_count}")
        print(f"   - Femmes (F): {female_count}")
        print(f"   - Neutre (N): {neutral_count}")
        
        all_photos = await lumina_col.find({}, {'url': 1, '_id': 1}).to_list(length=lumina_count)
        
        random.shuffle(all_photos)
        
        half = len(all_photos) // 2
        male_photos = all_photos[:half]
        female_photos = all_photos[half:]
        neutral_photos = all_photos.copy()
        random.shuffle(neutral_photos)
        
        print(f"\n📊 Répartition des photos:")
        print(f"   - Photos pour hommes: {len(male_photos)}")
        print(f"   - Photos pour femmes: {len(female_photos)}")
        
        male_idx = 0
        female_idx = 0
        neutral_idx = 0
        
        batch_size = 500
        updates = []
        total_updated = 0
        
        print("\n🔄 Mise à jour des avatars en cours...")
        
        cursor = users_col.find({'is_system': True})
        
        async for user in cursor:
            genre = user.get('genre', 'N')
            
            if genre == 'M' and male_idx < len(male_photos):
                photo = male_photos[male_idx]
                male_idx += 1
            elif genre == 'F' and female_idx < len(female_photos):
                photo = female_photos[female_idx]
                female_idx += 1
            else:
                photo = neutral_photos[neutral_idx % len(neutral_photos)]
                neutral_idx += 1
            
            new_avatar_url = photo['url']
            
            updates.append(UpdateOne(
                {'_id': user['_id']},
                {'$set': {'avatar': new_avatar_url}}
            ))
            
            if len(updates) >= batch_size:
                result = await users_col.bulk_write(updates)
                total_updated += result.modified_count
                print(f"   ✅ {total_updated}/{system_count} profils mis à jour...")
                updates = []
        
        if updates:
            result = await users_col.bulk_write(updates)
            total_updated += result.modified_count
        
        print(f"\n✨ Injection terminée avec succès!")
        print(f"   - Total de profils mis à jour: {total_updated}")
        print(f"   - Photos hommes utilisées: {male_idx}")
        print(f"   - Photos femmes utilisées: {female_idx}")
        print(f"   - Photos neutres utilisées: {neutral_idx}")
        
        sample = await users_col.find_one({'is_system': True})
        if sample:
            print(f"\n📌 Exemple de profil mis à jour:")
            print(f"   - Nom: {sample.get('full_name', 'N/A')}")
            print(f"   - Genre: {sample.get('genre', 'N/A')}")
            print(f"   - Avatar: {sample.get('avatar', 'N/A')[:80]}...")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        raise
    finally:
        client.close()
        print("\n🔌 Connexion fermée")

if __name__ == "__main__":
    asyncio.run(inject_avatars())
