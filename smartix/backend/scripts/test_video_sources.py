
#!/usr/bin/env python3
"""
Script pour tester individuellement chaque source de vidéos
"""
import sys
import os

# Ajouter le répertoire backend au path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.scraper_sources import (
    fetch_pexels,
    fetch_pixabay,
    fetch_mixkit,
    fetch_sample_videos,
    fetch_all_sources,
    PEXELS_API_KEY,
    PIXABAY_API_KEY
)

def test_sample_videos():
    print("\n" + "=" * 60)
    print("📹 TEST: Sample Videos")
    print("=" * 60)
    
    try:
        videos = fetch_sample_videos()
        print(f"✅ Récupéré {len(videos)} vidéos d'exemple")
        if videos:
            print(f"   Première vidéo: {videos[0]['title']}")
            print(f"   Source: {videos[0]['source']}")
    except Exception as e:
        print(f"❌ Erreur: {e}")

def test_pexels():
    print("\n" + "=" * 60)
    print("📹 TEST: Pexels API")
    print("=" * 60)
    
    if not PEXELS_API_KEY:
        print("⚠️ PEXELS_API_KEY non configuré")
        return
    
    try:
        videos = fetch_pexels(query="nature", per_page=10)
        print(f"✅ Récupéré {len(videos)} vidéos depuis Pexels")
        if videos:
            print(f"   Première vidéo: {videos[0]['title']}")
            print(f"   URL: {videos[0]['video_url'][:50]}...")
    except Exception as e:
        print(f"❌ Erreur: {e}")

def test_pixabay():
    print("\n" + "=" * 60)
    print("📹 TEST: Pixabay API")
    print("=" * 60)
    
    if not PIXABAY_API_KEY:
        print("⚠️ PIXABAY_API_KEY non configuré")
        return
    
    try:
        videos = fetch_pixabay(query="nature", per_page=10)
        print(f"✅ Récupéré {len(videos)} vidéos depuis Pixabay")
        if videos:
            print(f"   Première vidéo: {videos[0]['title']}")
            print(f"   URL: {videos[0]['video_url'][:50]}...")
    except Exception as e:
        print(f"❌ Erreur: {e}")

def test_mixkit():
    print("\n" + "=" * 60)
    print("📹 TEST: Mixkit")
    print("=" * 60)
    
    try:
        videos = fetch_mixkit(per_page=10)
        print(f"✅ Récupéré {len(videos)} vidéos depuis Mixkit")
        if videos:
            print(f"   Première vidéo: {videos[0]['title']}")
            print(f"   URL: {videos[0]['video_url'][:50]}...")
    except Exception as e:
        print(f"❌ Erreur: {e}")

def test_all_sources():
    print("\n" + "=" * 60)
    print("📹 TEST: Toutes les sources combinées")
    print("=" * 60)
    
    try:
        videos = fetch_all_sources()
        print(f"✅ Récupéré {len(videos)} vidéos au total (après déduplication)")
        
        # Compter par source
        sources_count = {}
        for v in videos:
            source = v.get('source', 'Unknown')
            sources_count[source] = sources_count.get(source, 0) + 1
        
        print("\n📊 Répartition par source:")
        for source, count in sources_count.items():
            print(f"   {source}: {count} vidéos")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔍 TEST DES SOURCES DE VIDÉOS")
    
    test_sample_videos()
    test_pexels()
    test_pixabay()
    test_mixkit()
    test_all_sources()
    
    print("\n" + "=" * 60)
    print("✅ Tests terminés")
    print("=" * 60)
