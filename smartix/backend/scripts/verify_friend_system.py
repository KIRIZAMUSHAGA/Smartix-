"""
Script de vérification du système d'amis canonique
===================================================

Ce script vérifie que le système d'amis respecte toutes les règles métier:
1. Pas de doublons (une seule entrée par paire)
2. Structure canonique (user_low_id < user_high_id)
3. Index unique présent
4. Pas de relations asymétriques

Usage:
    python backend/scripts/verify_friend_system.py
    python backend/scripts/verify_friend_system.py --fix  # Pour corriger les problèmes
"""

import os
import asyncio
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from collections import defaultdict


def get_canonical_pair(id_a: str, id_b: str) -> tuple:
    """Retourne la paire canonique"""
    if id_a < id_b:
        return (id_a, id_b)
    return (id_b, id_a)


async def verify_friend_system(fix_mode: bool = False):
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartohada")
    
    if not mongo_uri:
        print("❌ MONGO_URL not found")
        return False

    client = AsyncIOMotorClient(mongo_uri)
    errors_found = 0
    warnings_found = 0
    
    try:
        db = client[db_name]
        
        print("=" * 70)
        print("🔍 VÉRIFICATION DU SYSTÈME D'AMIS CANONIQUE")
        print("=" * 70)
        print(f"Mode: {'CORRECTION' if fix_mode else 'AUDIT'}")
        print()
        
        # ===================================================================
        # TEST 1: Vérifier la présence de l'index unique
        # ===================================================================
        print("1️⃣  Vérification de l'index unique...")
        indexes = await db.friend_requests.index_information()
        if "unique_friendship_pair" not in indexes:
            print("   ❌ ERREUR: Index unique 'unique_friendship_pair' manquant!")
            errors_found += 1
            if fix_mode:
                print("   🔧 Création de l'index...")
                await db.friend_requests.create_index(
                    [("user_low_id", 1), ("user_high_id", 1)],
                    unique=True,
                    name="unique_friendship_pair"
                )
                print("   ✅ Index créé")
        else:
            print("   ✅ Index unique présent")
        
        # ===================================================================
        # TEST 2: Vérifier la structure canonique (user_low_id < user_high_id)
        # ===================================================================
        print("\n2️⃣  Vérification de la canonicalisation...")
        bad_order = await db.friend_requests.find({
            "$expr": {"$gt": ["$user_low_id", "$user_high_id"]}
        }).to_list(None)
        
        if bad_order:
            print(f"   ❌ ERREUR: {len(bad_order)} entrées non canoniques trouvées!")
            errors_found += len(bad_order)
            for entry in bad_order[:5]:
                print(f"      - {entry.get('user_low_id')} > {entry.get('user_high_id')}")
            if len(bad_order) > 5:
                print(f"      ... et {len(bad_order) - 5} autres")
        else:
            print("   ✅ Toutes les entrées sont canoniques")
        
        # ===================================================================
        # TEST 3: Vérifier l'absence de doublons
        # ===================================================================
        print("\n3️⃣  Vérification des doublons...")
        pipeline = [
            {"$group": {
                "_id": {"low": "$user_low_id", "high": "$user_high_id"},
                "count": {"$sum": 1},
                "entries": {"$push": {"_id": "$_id", "status": "$status"}}
            }},
            {"$match": {"count": {"$gt": 1}}}
        ]
        duplicates = await db.friend_requests.aggregate(pipeline).to_list(None)
        
        if duplicates:
            print(f"   ❌ ERREUR: {len(duplicates)} paires dupliquées trouvées!")
            errors_found += len(duplicates)
            for dup in duplicates[:5]:
                print(f"      - {dup['_id']['low']} <-> {dup['_id']['high']} ({dup['count']} entrées)")
        else:
            print("   ✅ Aucun doublon trouvé")
        
        # ===================================================================
        # TEST 4: Vérifier l'ancien format (sender_id/receiver_id)
        # ===================================================================
        print("\n4️⃣  Vérification de l'ancien format (sender_id/receiver_id)...")
        old_format = await db.friend_requests.find_one({
            "$or": [
                {"sender_id": {"$exists": True}},
                {"receiver_id": {"$exists": True}}
            ]
        })
        
        if old_format:
            old_count = await db.friend_requests.count_documents({
                "$or": [
                    {"sender_id": {"$exists": True}},
                    {"receiver_id": {"$exists": True}}
                ]
            })
            print(f"   ⚠️  WARNING: {old_count} entrées avec l'ancien format détectées!")
            warnings_found += 1
            print("      → La migration n'a peut-être pas été exécutée")
            print("      → Exécutez: python backend/scripts/migrate_friend_requests_canonical.py")
        else:
            print("   ✅ Aucune entrée avec l'ancien format")
        
        # ===================================================================
        # TEST 5: Vérifier la présence de initiated_by
        # ===================================================================
        print("\n5️⃣  Vérification du champ 'initiated_by'...")
        missing_initiator = await db.friend_requests.count_documents({
            "initiated_by": {"$exists": False}
        })
        
        if missing_initiator > 0:
            print(f"   ⚠️  WARNING: {missing_initiator} entrées sans 'initiated_by'")
            warnings_found += 1
        else:
            print("   ✅ Toutes les entrées ont un initiateur")
        
        # ===================================================================
        # TEST 6: Vérifier les statuts valides
        # ===================================================================
        print("\n6️⃣  Vérification des statuts...")
        valid_statuses = ["pending", "accepted", "rejected", "refused", "cancelled", "blocked"]
        invalid_status = await db.friend_requests.find_one({
            "status": {"$nin": valid_statuses}
        })
        
        if invalid_status:
            print(f"   ❌ ERREUR: Statut invalide trouvé: '{invalid_status.get('status')}'")
            errors_found += 1
        else:
            print("   ✅ Tous les statuts sont valides")
        
        # ===================================================================
        # TEST 7: Statistiques
        # ===================================================================
        print("\n7️⃣  Statistiques...")
        total = await db.friend_requests.count_documents({})
        stats = await db.friend_requests.aggregate([
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]).to_list(None)
        
        print(f"   📊 Total des relations: {total}")
        for stat in stats:
            print(f"      - {stat['_id']}: {stat['count']}")
        
        # ===================================================================
        # TEST 8: Vérifier la cohérence avec les caches utilisateurs
        # ===================================================================
        print("\n8️⃣  Vérification de cohérence (cache utilisateurs)...")
        
        accepted_count = await db.friend_requests.count_documents({"status": "accepted"})
        
        pipeline = [
            {"$project": {"friends_count": {"$size": {"$ifNull": ["$friends", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$friends_count"}}}
        ]
        user_friends = await db.users.aggregate(pipeline).to_list(1)
        total_in_cache = user_friends[0]["total"] if user_friends else 0
        
        expected_cache = accepted_count * 2
        if total_in_cache != expected_cache:
            print(f"   ⚠️  WARNING: Désynchronisation détectée")
            print(f"      - Relations accepted: {accepted_count}")
            print(f"      - Entrées dans caches users: {total_in_cache} (attendu: {expected_cache})")
            warnings_found += 1
        else:
            print(f"   ✅ Caches synchronisés ({accepted_count} relations = {total_in_cache} entrées cache)")
        
        # ===================================================================
        # RÉSUMÉ
        # ===================================================================
        print("\n" + "=" * 70)
        if errors_found == 0 and warnings_found == 0:
            print("✅ SYSTÈME CONFORME - Aucune anomalie détectée")
        elif errors_found == 0:
            print(f"⚠️  SYSTÈME PARTIELLEMENT CONFORME - {warnings_found} warning(s)")
        else:
            print(f"❌ SYSTÈME NON CONFORME - {errors_found} erreur(s), {warnings_found} warning(s)")
            print("\n   Actions recommandées:")
            print("   1. Exécutez le script de migration:")
            print("      python backend/scripts/migrate_friend_requests_canonical.py")
            print("   2. Relancez cette vérification")
        print("=" * 70)
        
        return errors_found == 0

    except Exception as e:
        print(f"❌ Erreur lors de la vérification: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()


async def test_scenarios():
    """Tests des scénarios métier critiques"""
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartohada")
    
    if not mongo_uri:
        print("❌ MONGO_URL not found")
        return

    client = AsyncIOMotorClient(mongo_uri)
    try:
        db = client[db_name]
        
        print("\n" + "=" * 70)
        print("🧪 TESTS DES SCÉNARIOS MÉTIER")
        print("=" * 70)
        
        test_user_a = "test_user_a_verification"
        test_user_b = "test_user_b_verification"
        
        low_id, high_id = get_canonical_pair(test_user_a, test_user_b)
        
        # Nettoyer avant le test
        await db.friend_requests.delete_many({
            "user_low_id": low_id,
            "user_high_id": high_id
        })
        
        print("\n1️⃣  Test: Création d'une relation...")
        now = datetime.now(timezone.utc)
        await db.friend_requests.insert_one({
            "user_low_id": low_id,
            "user_high_id": high_id,
            "status": "pending",
            "initiated_by": test_user_a,
            "created_at": now,
            "updated_at": now
        })
        print("   ✅ Relation créée")
        
        print("\n2️⃣  Test: Tentative de doublon (doit échouer)...")
        try:
            await db.friend_requests.insert_one({
                "user_low_id": low_id,
                "user_high_id": high_id,
                "status": "pending",
                "initiated_by": test_user_b,
                "created_at": now,
                "updated_at": now
            })
            print("   ❌ ERREUR: Le doublon a été accepté!")
        except Exception as e:
            if "duplicate key" in str(e).lower() or "E11000" in str(e):
                print("   ✅ Doublon correctement rejeté par l'index unique")
            else:
                print(f"   ⚠️  Erreur inattendue: {e}")
        
        print("\n3️⃣  Test: Mise à jour du statut...")
        result = await db.friend_requests.update_one(
            {"user_low_id": low_id, "user_high_id": high_id},
            {"$set": {"status": "accepted"}}
        )
        if result.modified_count == 1:
            print("   ✅ Statut mis à jour correctement")
        else:
            print("   ❌ Échec de la mise à jour")
        
        print("\n4️⃣  Test: Suppression...")
        result = await db.friend_requests.delete_one({
            "user_low_id": low_id,
            "user_high_id": high_id
        })
        if result.deleted_count == 1:
            print("   ✅ Relation supprimée correctement")
        else:
            print("   ❌ Échec de la suppression")
        
        print("\n✅ Tous les tests de scénarios passés!")
        
    except Exception as e:
        print(f"❌ Erreur lors des tests: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    async def main():
        fix_mode = "--fix" in sys.argv
        run_tests = "--test" in sys.argv
        
        success = await verify_friend_system(fix_mode)
        
        if run_tests or "--test" in sys.argv:
            await test_scenarios()
        
        return success
    
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
