import asyncio
import os
import sys

# Ajouter le chemin du backend pour l'import des modules
sys.path.append(os.path.join(os.getcwd(), "backend"))

from db import init_mongodb, get_db
from routes.friends import get_raw_accepted_friends, get_canonical_pair

async def run_tests():
    print("🧪 Démarrage des tests unitaires du système d'amis...")
    await init_mongodb()
    db = get_db()
    
    test_user_id = "test_user_id"
    test_friend_id = "test_friend_id"
    
    # 1. Test de normalisation et canonicalisation
    print("1. Test de canonicalisation...")
    low, high = get_canonical_pair(123, "456")
    assert isinstance(low, str) and isinstance(high, str), "Les IDs doivent être des strings"
    assert low < high, "Canonicalisation incorrecte"
    print("✅ Canonicalisation OK")
    
    # 2. Test du noyau (Source de vérité)
    print("2. Test du noyau get_raw_accepted_friends...")
    # Nettoyage
    low_id, high_id = get_canonical_pair(test_user_id, test_friend_id)
    await db.friend_requests.delete_many({"$or": [{"user_low_id": test_user_id}, {"user_high_id": test_user_id}]})
    
    # Insertion manuelle d'une relation acceptée
    await db.friend_requests.insert_one({
        "user_low_id": low_id,
        "user_high_id": high_id,
        "status": "accepted",
        "initiated_by": test_user_id
    })
    
    friends = await get_raw_accepted_friends(test_user_id)
    assert test_friend_id in friends, f"Ami {test_friend_id} non trouvé dans le noyau"
    assert len(friends) == 1, "Nombre d'amis incorrect"
    print("✅ Noyau logique OK")
    
    # 3. Test des doublons et relations inversées
    print("3. Test anti-doublon et relations inversées...")
    # Le noyau doit être insensible à l'ordre grâce à la requête $or sur low/high
    friends_inv = await get_raw_accepted_friends(test_friend_id)
    assert test_user_id in friends_inv, "Relation inversée non détectée"
    print("✅ Relations inversées OK")
    
    print("\n🚀 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS")

if __name__ == "__main__":
    asyncio.run(run_tests())
