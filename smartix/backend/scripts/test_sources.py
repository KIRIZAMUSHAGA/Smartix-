
# Test RSS sources quickly
from app.aggregator.rss_fetcher import fetch_from_rss
from app.aggregator.rss_sources import DEFAULT_RSS_SOURCES

if __name__ == "__main__":
    print("=" * 80)
    print("TEST DES SOURCES RSS")
    print("=" * 80)
    
    working_sources = []
    failing_sources = []
    
    for s in DEFAULT_RSS_SOURCES:
        print(f"\n📡 Testing: {s['name']}")
        print(f"   URL: {s['rss_url']}")
        try:
            items = fetch_from_rss(s["rss_url"])
            if items:
                print(f"   ✅ SUCCÈS - {len(items)} articles trouvés")
                if items:
                    print(f"   Premier article: {items[0]['title'][:80]}...")
                working_sources.append(s['name'])
            else:
                print(f"   ⚠️  AUCUN ARTICLE - Le flux existe mais est vide")
                failing_sources.append((s['name'], "Flux vide"))
        except Exception as e:
            print(f"   ❌ ERREUR - {str(e)[:100]}")
            failing_sources.append((s['name'], str(e)[:50]))
    
    print("\n" + "=" * 80)
    print("RÉSUMÉ")
    print("=" * 80)
    print(f"\n✅ Sources fonctionnelles ({len(working_sources)}):")
    for name in working_sources:
        print(f"   - {name}")
    
    print(f"\n❌ Sources en erreur ({len(failing_sources)}):")
    for name, error in failing_sources:
        print(f"   - {name}: {error}")
    
    print("\n" + "=" * 80)
