
import requests
from bs4 import BeautifulSoup

# Sites à tester
SITES = [
    "https://7sur7.cd",
    "https://www.mediacongo.net",
    "https://reveil-congo.net",
    "https://nouveaumedia.cd",
    "https://democratiechretienne.org",
    "https://ouragan.cd",
    "https://netic-news.net",
    "https://yabisonews.cd",
    "https://brothermyephre.com",
    "https://bankable.africa",
    "https://lebarometre.cd",
    "https://depeche.cd",
    "https://foxtime.cd",
    "https://rntc.cd",
    "https://kivumorningpost.com",
    "https://kinpressactu.cd",
    "https://actu30.cd",
    "https://beto.cd",
    "https://expressmedias.net",
    "https://enquete.cd",
    "https://congointelligence.com",
    "https://wise.cd",
    "https://opinion-info.cd",
    "https://tremplin-news.net"
]

RSS_VARIANTS = [
    "/feed",
    "/feed/",
    "/rss",
    "/rss/",
    "/rss.xml",
    "/feed.xml",
    "/index.xml",
    "/atom.xml",
    "/?feed=rss",
    "/?feed=rss2",
    "/?feed=atom"
]

def find_rss_in_html(url):
    """Cherche les liens RSS dans le HTML de la page"""
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Chercher les liens RSS
        rss_links = []
        for link in soup.find_all('link', type=['application/rss+xml', 'application/atom+xml']):
            href = link.get('href')
            if href:
                rss_links.append(href)
        
        return rss_links
    except:
        return []

def test_rss_url(url):
    """Teste si une URL RSS fonctionne"""
    try:
        response = requests.get(url, timeout=10)
        content_type = response.headers.get('content-type', '').lower()
        
        if response.status_code == 200:
            if 'xml' in content_type or 'rss' in content_type or 'atom' in content_type:
                return True, content_type
            # Vérifier le contenu même si le content-type n'est pas correct
            if b'<rss' in response.content[:500] or b'<feed' in response.content[:500]:
                return True, "xml detected in content"
        
        return False, f"status {response.status_code}"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    print("=" * 80)
    print("RECHERCHE DES VRAIES URLs RSS")
    print("=" * 80)
    
    results = {}
    
    for site in SITES:
        print(f"\n🔍 {site}")
        
        found_urls = []
        
        # 1. Chercher dans le HTML
        html_rss = find_rss_in_html(site)
        if html_rss:
            print(f"   📄 Trouvé dans HTML: {html_rss}")
            for rss_url in html_rss:
                if not rss_url.startswith('http'):
                    rss_url = site + rss_url
                success, info = test_rss_url(rss_url)
                if success:
                    found_urls.append(rss_url)
                    print(f"   ✅ Valide: {rss_url}")
        
        # 2. Tester les variantes communes
        for variant in RSS_VARIANTS:
            test_url = site + variant
            success, info = test_rss_url(test_url)
            if success and test_url not in found_urls:
                found_urls.append(test_url)
                print(f"   ✅ Trouvé: {test_url} ({info})")
        
        results[site] = found_urls
        
        if not found_urls:
            print(f"   ❌ Aucun flux RSS trouvé")
    
    print("\n" + "=" * 80)
    print("RÉSUMÉ - URLs RSS FONCTIONNELLES")
    print("=" * 80)
    
    for site, urls in results.items():
        site_name = site.replace('https://', '').replace('http://', '').replace('www.', '')
        if urls:
            print(f'\n{{"name": "{site_name}", "rss_url": "{urls[0]}", "base_url": "{site}", "country": "cd", "language": "fr"}},')
        else:
            print(f'\n# ❌ {site_name} - Pas de flux RSS trouvé')
    
    print("\n" + "=" * 80)
