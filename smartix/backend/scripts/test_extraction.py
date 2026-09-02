
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.aggregator.content_extractor import extract_full_content
import logging

logging.basicConfig(level=logging.INFO)

# URLs de test (remplace par tes URLs problématiques)
test_urls = [
    "https://www.jeuneafrique.com/1764987/politique/can-1988-coup-de-froid-sur-le-maroc/",
    # Ajoute d'autres URLs problématiques ici
]

def main():
    print("=" * 80)
    print("TEST D'EXTRACTION DE CONTENU")
    print("=" * 80)
    
    for url in test_urls:
        print(f"\n📰 Test: {url}")
        print("-" * 80)
        
        content_html = extract_full_content(url)
        
        # Compte les paragraphes
        paragraph_count = content_html.count("<p>")
        content_length = len(content_html)
        
        print(f"✅ Paragraphes extraits: {paragraph_count}")
        print(f"✅ Longueur totale: {content_length} caractères")
        
        # Affiche les 3 premiers paragraphes
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content_html, "html.parser")
        paragraphs = soup.find_all('p')
        
        print("\n📝 Premiers paragraphes:")
        for i, p in enumerate(paragraphs[:3], 1):
            text = p.get_text()[:200]
            print(f"{i}. {text}...")
        
        print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
