
import requests
from app.aggregator.rss_sources import DEFAULT_RSS_SOURCES

# Liste des nouvelles sources congolaises ajoutées
NEW_CONGOLESE_SOURCES = [
    "7sur7.cd", "Media Congo", "Réveil Congo", "Nouveau Media",
    "Démocratie Chrétienne", "Ouragan.cd", "Netic News", "Yabiso News",
    "Brother Myephre", "Bankable Africa", "Le Baromètre", "Dépêche.cd",
    "Foxtime.cd", "RNTC", "Kivu Morning Post", "Kin Press Actu",
    "Actu30.cd", "Beto.cd", "Express Médias", "Enquête.cd",
    "Congo Intelligence", "Wise.cd", "Opinion Info", "Tremplin News"
]

def test_url_availability(url, timeout=10):
    """Teste si une URL est accessible"""
    try:
        response = requests.get(url, timeout=timeout, allow_redirects=True)
        return response.status_code, response.headers.get('content-type', 'unknown')
    except requests.exceptions.Timeout:
        return None, "Timeout"
    except requests.exceptions.ConnectionError:
        return None, "Connection Error"
    except Exception as e:
        return None, str(e)

if __name__ == "__main__":
    print("=" * 80)
    print("TEST DES NOUVELLES SOURCES CONGOLAISES")
    print("=" * 80)
    
    for source in DEFAULT_RSS_SOURCES:
        if source['name'] in NEW_CONGOLESE_SOURCES:
            print(f"\n📰 {source['name']}")
            print(f"   URL RSS: {source['rss_url']}")
            
            # Test de l'URL RSS
            status, content_type = test_url_availability(source['rss_url'])
            
            if status:
                if status == 200:
                    print(f"   ✅ RSS accessible (status: {status})")
                    print(f"   Type: {content_type}")
                else:
                    print(f"   ⚠️  Status HTTP: {status}")
                    print(f"   Type: {content_type}")
            else:
                print(f"   ❌ RSS inaccessible: {content_type}")
            
            # Test de l'URL de base
            base_status, base_type = test_url_availability(source['base_url'])
            if base_status:
                print(f"   Site web: OK (status: {base_status})")
            else:
                print(f"   Site web: {base_type}")
    
    print("\n" + "=" * 80)
