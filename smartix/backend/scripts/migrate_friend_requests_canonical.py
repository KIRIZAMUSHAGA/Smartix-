"""
Migration Script: Canonicalisation du système d'amis
=====================================================

Ce script effectue les opérations suivantes :
1. Lit toutes les entrées de friend_requests existantes
2. Canonicalise chaque relation (user_low_id, user_high_id)
3. Fusionne les doublons en conservant le statut le plus avancé
4. Reconstruit la collection avec la structure canonique
5. Crée l'index unique pour empêcher les futurs doublons

Règle de priorité des statuts : accepted > pending > cancelled > rejected
"""

import os
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from collections import defaultdict

STATUS_PRIORITY = {
    "accepted": 4,
    "pending": 3,
    "cancelled": 2,
    "rejected": 1,
    "refused": 1,  # Alias de rejected
    "blocked": 0
}

def get_canonical_pair(id_a: str, id_b: str) -> tuple:
    """Retourne la paire canonique (user_low_id, user_high_id)"""
    if id_a < id_b:
        return (id_a, id_b)
    return (id_b, id_a)

def get_status_priority(status: str) -> int:
    """Retourne la priorité d'un statut"""
    return STATUS_PRIORITY.get(status, 0)

async def migrate_friend_requests():
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartohada")
    
    if not mongo_uri:
        print("❌ MONGO_URL not found in environment")
        return False

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        
        print("=" * 60)
        print("🔧 MIGRATION: Canonicalisation du système d'amis")
        print("=" * 60)
        
        # 1. Lire toutes les entrées existantes
        all_requests = await db.friend_requests.find({}).to_list(None)
        print(f"📊 Entrées trouvées dans friend_requests: {len(all_requests)}")
        
        if not all_requests:
            print("✅ Collection vide, rien à migrer")
            return True
        
        # 2. Grouper par paire canonique
        canonical_groups = defaultdict(list)
        for req in all_requests:
            sender = req.get("sender_id")
            receiver = req.get("receiver_id")
            if not sender or not receiver:
                print(f"⚠️  Entrée invalide ignorée: {req.get('_id')}")
                continue
            
            low_id, high_id = get_canonical_pair(sender, receiver)
            canonical_groups[(low_id, high_id)].append(req)
        
        print(f"📊 Paires canoniques uniques: {len(canonical_groups)}")
        
        # 3. Identifier les doublons
        duplicates_found = 0
        for pair, entries in canonical_groups.items():
            if len(entries) > 1:
                duplicates_found += 1
                print(f"⚠️  Doublon détecté pour paire {pair}:")
                for e in entries:
                    print(f"    - sender={e.get('sender_id')} → receiver={e.get('receiver_id')} status={e.get('status')}")
        
        print(f"📊 Paires avec doublons: {duplicates_found}")
        
        # 4. Créer les entrées canoniques fusionnées
        canonical_entries = []
        for (low_id, high_id), entries in canonical_groups.items():
            # Trouver l'entrée avec le statut le plus avancé
            best_entry = max(entries, key=lambda x: (
                get_status_priority(x.get("status", "")),
                x.get("updated_at") or x.get("created_at") or datetime.min
            ))
            
            # Trouver la date de création la plus ancienne
            earliest_created = min(
                (e.get("created_at") for e in entries if e.get("created_at")),
                default=datetime.now(timezone.utc)
            )
            
            # Trouver la date de mise à jour la plus récente
            latest_updated = max(
                (e.get("updated_at") or e.get("created_at") for e in entries if e.get("updated_at") or e.get("created_at")),
                default=datetime.now(timezone.utc)
            )
            
            # Déterminer l'initiateur original (qui a envoyé la première requête)
            original_sender = entries[0].get("sender_id")
            for e in entries:
                if e.get("created_at") and e.get("created_at") == earliest_created:
                    original_sender = e.get("sender_id")
                    break
            
            canonical_entry = {
                "user_low_id": low_id,
                "user_high_id": high_id,
                "status": best_entry.get("status"),
                "initiated_by": original_sender,
                "created_at": earliest_created,
                "updated_at": latest_updated
            }
            canonical_entries.append(canonical_entry)
        
        print(f"📊 Entrées canoniques à créer: {len(canonical_entries)}")
        
        # 5. Sauvegarde de l'ancienne collection
        backup_name = f"friend_requests_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"💾 Sauvegarde de l'ancienne collection vers: {backup_name}")
        
        pipeline = [{"$match": {}}, {"$out": backup_name}]
        await db.friend_requests.aggregate(pipeline).to_list(None)
        
        # 6. Supprimer tous les index existants (sauf _id)
        print("🗑️  Suppression des anciens index...")
        try:
            await db.friend_requests.drop_indexes()
        except Exception as e:
            print(f"⚠️  Erreur lors de la suppression des index: {e}")
        
        # 7. Vider et recréer la collection
        print("🗑️  Vidage de la collection friend_requests...")
        await db.friend_requests.delete_many({})
        
        # 8. Insérer les entrées canoniques
        if canonical_entries:
            print(f"📥 Insertion de {len(canonical_entries)} entrées canoniques...")
            await db.friend_requests.insert_many(canonical_entries)
        
        # 9. Créer l'index unique obligatoire
        print("🔒 Création de l'index unique sur (user_low_id, user_high_id)...")
        await db.friend_requests.create_index(
            [("user_low_id", 1), ("user_high_id", 1)],
            unique=True,
            name="unique_friendship_pair"
        )
        
        # 10. Créer les index de performance
        print("📈 Création des index de performance...")
        await db.friend_requests.create_index([("user_low_id", 1)])
        await db.friend_requests.create_index([("user_high_id", 1)])
        await db.friend_requests.create_index([("status", 1)])
        await db.friend_requests.create_index([("user_low_id", 1), ("status", 1)])
        await db.friend_requests.create_index([("user_high_id", 1), ("status", 1)])
        
        print("=" * 60)
        print("✅ MIGRATION TERMINÉE AVEC SUCCÈS")
        print("=" * 60)
        print(f"📊 Résumé:")
        print(f"   - Entrées originales: {len(all_requests)}")
        print(f"   - Doublons fusionnés: {duplicates_found}")
        print(f"   - Entrées finales: {len(canonical_entries)}")
        print(f"   - Sauvegarde: {backup_name}")
        print("=" * 60)
        
        return True

    except Exception as e:
        print(f"❌ Erreur lors de la migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()

async def verify_migration():
    """Vérifie l'intégrité après migration"""
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartohada")
    
    if not mongo_uri:
        print("❌ MONGO_URL not found")
        return False

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        
        print("\n" + "=" * 60)
        print("🔍 VÉRIFICATION POST-MIGRATION")
        print("=" * 60)
        
        # 1. Vérifier la structure des documents
        sample = await db.friend_requests.find_one({})
        if sample:
            required_fields = ["user_low_id", "user_high_id", "status", "created_at"]
            missing = [f for f in required_fields if f not in sample]
            if missing:
                print(f"❌ Champs manquants: {missing}")
                return False
            print("✅ Structure des documents conforme")
        
        # 2. Vérifier qu'aucune paire n'est dupliquée
        pipeline = [
            {"$group": {
                "_id": {"low": "$user_low_id", "high": "$user_high_id"},
                "count": {"$sum": 1}
            }},
            {"$match": {"count": {"$gt": 1}}}
        ]
        duplicates = await db.friend_requests.aggregate(pipeline).to_list(None)
        if duplicates:
            print(f"❌ Paires dupliquées trouvées: {len(duplicates)}")
            for d in duplicates[:5]:
                print(f"   - {d}")
            return False
        print("✅ Aucune paire dupliquée")
        
        # 3. Vérifier la canonicalisation
        bad_order = await db.friend_requests.find_one({
            "$expr": {"$gt": ["$user_low_id", "$user_high_id"]}
        })
        if bad_order:
            print(f"❌ Entrée non canonique trouvée: {bad_order}")
            return False
        print("✅ Toutes les entrées sont canoniques (user_low_id < user_high_id)")
        
        # 4. Vérifier les index
        indexes = await db.friend_requests.index_information()
        if "unique_friendship_pair" not in indexes:
            print("❌ Index unique manquant!")
            return False
        print("✅ Index unique présent")
        
        # 5. Statistiques
        total = await db.friend_requests.count_documents({})
        accepted = await db.friend_requests.count_documents({"status": "accepted"})
        pending = await db.friend_requests.count_documents({"status": "pending"})
        
        print(f"\n📊 Statistiques finales:")
        print(f"   - Total relations: {total}")
        print(f"   - Accepted: {accepted}")
        print(f"   - Pending: {pending}")
        
        print("\n✅ VÉRIFICATION RÉUSSIE - Le système est conforme")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"❌ Erreur lors de la vérification: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    import sys
    
    async def main():
        if len(sys.argv) > 1 and sys.argv[1] == "--verify-only":
            return await verify_migration()
        
        success = await migrate_friend_requests()
        if success:
            await verify_migration()
        return success
    
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
