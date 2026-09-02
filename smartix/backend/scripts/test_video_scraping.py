
#!/usr/bin/env python3
"""
Script de test pour vérifier le scraping de vidéos
"""
import sys
import os

# Ajouter le répertoire backend au path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

import asyncio
from app.services.video_aggregator import run_video_aggregation

if __name__ == "__main__":
    print("=" * 60)
    print("🎬 TEST DU SCRAPING DE VIDÉOS")
    print("=" * 60)
    
    try:
        # Exécuter l'agrégation (MongoDB initialized by FastAPI app)
        result = asyncio.run(run_video_aggregation())
        
        print("=" * 60)
        print(f"✅ Résultat : {result} vidéos ajoutées")
        print("=" * 60)
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
