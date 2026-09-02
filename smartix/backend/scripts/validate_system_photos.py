"""
Script de validation des photos systèmes générées
Vérifie la cohérence, la répartition et la qualité des données
"""
import os
import sys
import json
import asyncio
import hashlib
from pathlib import Path
from collections import Counter
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

STORAGE_PATH = Path("backend/static/system_photos")

async def validate_photos():
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix")
    
    if not mongo_uri:
        print("MONGO_URL non configurée")
        return
    
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    try:
        users_col = db.users
        photos_col = db.system_photos
        
        total_system_users = await users_col.count_documents({"is_system": True})
        total_photos = await photos_col.count_documents({})
        total_files = len(list(STORAGE_PATH.glob("*.png"))) if STORAGE_PATH.exists() else 0
        
        print("=" * 60)
        print("VALIDATION DES PHOTOS SYSTÈMES")
        print("=" * 60)
        print(f"\n📊 STATISTIQUES GÉNÉRALES:")
        print(f"   Profils système en base: {total_system_users}")
        print(f"   Métadonnées photos en base: {total_photos}")
        print(f"   Fichiers photos sur disque: {total_files}")
        
        origin_stats = Counter()
        gender_stats = Counter()
        scope_stats = Counter()
        locked_count = 0
        errors = []
        
        async for photo in photos_col.find({}):
            origin_stats[photo.get("origin", "unknown")] += 1
            gender_stats[photo.get("gender_used", "unknown")] += 1
            scope_stats[photo.get("avatar_scope", "unknown")] += 1
            
            if photo.get("is_locked"):
                locked_count += 1
            
            filename = photo.get("filename")
            if filename:
                filepath = STORAGE_PATH / filename
                if not filepath.exists():
                    errors.append(f"Fichier manquant: {filename}")
        
        print(f"\n🌍 RÉPARTITION PAR ORIGINE:")
        total_with_origin = sum(origin_stats.values())
        for origin, count in origin_stats.most_common():
            pct = (count / total_with_origin * 100) if total_with_origin > 0 else 0
            print(f"   {origin}: {count} ({pct:.1f}%)")
        
        african_count = origin_stats.get("africaine", 0)
        african_pct = (african_count / total_with_origin * 100) if total_with_origin > 0 else 0
        
        print(f"\n👤 RÉPARTITION PAR GENRE:")
        for gender, count in gender_stats.most_common():
            pct = (count / sum(gender_stats.values()) * 100) if gender_stats else 0
            print(f"   {gender}: {count} ({pct:.1f}%)")
        
        print(f"\n🔒 SÉCURITÉ:")
        print(f"   Photos verrouillées: {locked_count}/{total_photos}")
        print(f"   Scopes:")
        for scope, count in scope_stats.most_common():
            print(f"      {scope}: {count}")
        
        print(f"\n✅ VALIDATIONS:")
        
        if 60 <= african_pct <= 80:
            print(f"   [OK] Répartition africaine dans la cible: {african_pct:.1f}%")
        else:
            print(f"   [WARN] Répartition africaine hors cible: {african_pct:.1f}% (cible: 60-80%)")
        
        if locked_count == total_photos and total_photos > 0:
            print(f"   [OK] Toutes les photos sont verrouillées")
        else:
            print(f"   [WARN] Photos non verrouillées: {total_photos - locked_count}")
        
        if scope_stats.get("system_only", 0) == total_photos and total_photos > 0:
            print(f"   [OK] Toutes les photos ont le scope 'system_only'")
        else:
            print(f"   [WARN] Photos sans scope 'system_only': {total_photos - scope_stats.get('system_only', 0)}")
        
        if total_photos == total_files:
            print(f"   [OK] Cohérence base/fichiers: {total_photos} = {total_files}")
        else:
            print(f"   [WARN] Incohérence base/fichiers: {total_photos} vs {total_files}")
        
        if errors:
            print(f"\n❌ ERREURS DÉTECTÉES ({len(errors)}):")
            for err in errors[:10]:
                print(f"   - {err}")
            if len(errors) > 10:
                print(f"   ... et {len(errors) - 10} autres erreurs")
        
        print("\n" + "=" * 60)
        
        mismatch_count = 0
        async for user in users_col.find({"is_system": True}).limit(100):
            user_id = user.get("id")
            user_gender = user.get("genre")
            
            photo = await photos_col.find_one({"profile_id": user_id})
            if photo:
                photo_gender = photo.get("gender_used")
                
                if user_gender == "M" and photo_gender != "homme":
                    mismatch_count += 1
                elif user_gender == "F" and photo_gender != "femme":
                    mismatch_count += 1
        
        if mismatch_count == 0:
            print("✅ Cohérence genre profil/photo: OK (échantillon 100)")
        else:
            print(f"⚠️ Incohérences genre détectées: {mismatch_count}/100")
        
    finally:
        client.close()

async def check_security_locks():
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix")
    
    if not mongo_uri:
        return
    
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    try:
        photos_col = db.system_photos
        users_col = db.users
        
        print("\n🔐 TEST DES VERROUS DE SÉCURITÉ:")
        
        non_system_with_system_photo = await users_col.count_documents({
            "is_system": {"$ne": True},
            "avatar": {"$regex": "^/static/system_photos/"}
        })
        
        if non_system_with_system_photo == 0:
            print("   [OK] Aucun utilisateur réel n'a de photo système")
        else:
            print(f"   [CRITICAL] {non_system_with_system_photo} utilisateurs réels ont des photos système!")
        
        recycled = await photos_col.count_documents({
            "usage_restrictions.allow_recycling": True
        })
        
        if recycled == 0:
            print("   [OK] Aucune photo avec recyclage autorisé")
        else:
            print(f"   [WARN] {recycled} photos avec recyclage autorisé")
        
        public_api = await photos_col.count_documents({
            "usage_restrictions.allow_public_api": True
        })
        
        if public_api == 0:
            print("   [OK] Aucune photo exposée via API publique")
        else:
            print(f"   [WARN] {public_api} photos exposées via API publique")
        
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(validate_photos())
    asyncio.run(check_security_locks())
