
import asyncio
from app.db_mongo import client

async def check_sources_in_db():
    """Vérifie quelles sources ont des articles dans MongoDB"""
    db = client["smartohada"]
    news_collection = db["news"]
    sources_collection = db["news_sources"]
    
    print("=" * 80)
    print("ANALYSE DES SOURCES DANS LA BASE DE DONNÉES")
    print("=" * 80)
    
    # Récupérer toutes les sources
    sources = await sources_collection.find({}).to_list(None)
    print(f"\n📊 Total de sources enregistrées: {len(sources)}")
    
    print("\n" + "=" * 80)
    print("ARTICLES PAR SOURCE")
    print("=" * 80)
    
    sources_with_articles = []
    sources_without_articles = []
    
    for source in sources:
        count = await news_collection.count_documents({"source_name": source["name"]})
        
        if count > 0:
            print(f"\n✅ {source['name']}: {count} articles")
            sources_with_articles.append((source["name"], count))
            
            # Afficher le dernier article
            last = await news_collection.find_one(
                {"source_name": source["name"]},
                sort=[("published_at", -1)]
            )
            if last:
                print(f"   Dernier: {last.get('title', 'N/A')[:80]}...")
                print(f"   Date: {last.get('published_at', 'N/A')}")
        else:
            print(f"\n⚠️  {source['name']}: 0 articles")
            sources_without_articles.append(source["name"])
    
    print("\n" + "=" * 80)
    print("RÉSUMÉ")
    print("=" * 80)
    print(f"\n✅ Sources avec articles: {len(sources_with_articles)}")
    print(f"⚠️  Sources sans articles: {len(sources_without_articles)}")
    
    if sources_without_articles:
        print("\n📋 Sources sans contenu:")
        for name in sources_without_articles:
            print(f"   - {name}")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(check_sources_in_db())
