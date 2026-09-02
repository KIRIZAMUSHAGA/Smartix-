import requests
from bs4 import BeautifulSoup
import logging
import time
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
}

_last_request_time = {}
_domain_backoff = {}

def get_domain(url: str) -> str:
    from urllib.parse import urlparse
    try:
        return urlparse(url).netloc.lower()
    except:
        return "unknown"

def wait_for_rate_limit(url: str, base_delay: float = 2.0):
    """Simple synchronous rate limiting per domain"""
    domain = get_domain(url)
    
    backoff = _domain_backoff.get(domain, 1.0)
    delay = base_delay * backoff
    
    if domain in ['www.jeuneafrique.com', 'jeuneafrique.com']:
        delay = max(delay, 5.0)
    
    last_time = _last_request_time.get(domain, 0)
    elapsed = time.time() - last_time
    
    if elapsed < delay:
        wait_time = delay - elapsed
        logger.debug(f"Rate limiting: waiting {wait_time:.1f}s for {domain}")
        time.sleep(wait_time)
    
    _last_request_time[domain] = time.time()

def mark_rate_limited(url: str):
    """Increase backoff for domain after 429 error"""
    domain = get_domain(url)
    current = _domain_backoff.get(domain, 1.0)
    _domain_backoff[domain] = min(10.0, current * 2.0)
    logger.warning(f"Rate limited by {domain}, backoff now: {_domain_backoff[domain]}")

def mark_success(url: str):
    """Decrease backoff for domain after success"""
    domain = get_domain(url)
    current = _domain_backoff.get(domain, 1.0)
    _domain_backoff[domain] = max(1.0, current * 0.9)

def dedupe_paragraphs(paragraphs: List[str]) -> List[str]:
    """Déduplique les paragraphes en gardant l'ordre"""
    seen = set()
    result = []
    for p in paragraphs:
        normalized = " ".join(p.split())
        if not normalized or len(normalized) < 20:
            continue
        key = normalized[:150].lower()
        if key not in seen:
            seen.add(key)
            result.append(normalized)
    return result

def html_to_paragraphs(html_content: str) -> List[str]:
    """Convertit HTML en liste de paragraphes"""
    if not html_content:
        return []
    soup = BeautifulSoup(html_content, "html.parser")
    paragraphs = []
    for p in soup.find_all(['p', 'h2', 'h3', 'h4', 'blockquote']):
        text = p.get_text(separator=" ", strip=True)
        if text and len(text) > 20:
            paragraphs.append(text)
    return paragraphs

def extract_with_article_selectors(soup: BeautifulSoup, url: str) -> Optional[Dict]:
    """Essaye d'extraire avec des sélecteurs d'article courants"""
    selectors = [
        ('article', None),
        (None, 'article-body'),
        (None, 'article-content'),
        (None, 'post-content'),
        (None, 'entry-content'),
        (None, 'content-body'),
        (None, 'story-body'),
        (None, 'article-text'),
        (None, 'td-post-content'),
        (None, 'single-post-content'),
        ('main', 'content'),
        ('#main-content', None),
        ('#article-content', None),
        ('[itemprop="articleBody"]', None),
        ('.post-body', None),
        ('.article__body', None),
    ]
    
    for tag, class_name in selectors:
        try:
            if tag and tag.startswith('#'):
                element = soup.select_one(tag)
            elif tag and tag.startswith('['):
                element = soup.select_one(tag)
            elif tag and tag.startswith('.'):
                element = soup.select_one(tag)
            elif class_name:
                element = soup.find(class_=class_name)
            else:
                element = soup.find(tag)
            
            if element:
                paragraphs = html_to_paragraphs(str(element))
                if len(paragraphs) >= 2:
                    logger.info(f"✅ Extraction réussie avec sélecteur {tag or class_name} pour {url}")
                    return {
                        "paragraphs": paragraphs,
                        "content_html": str(element),
                        "method": f"selector_{tag or class_name}"
                    }
        except Exception as e:
            logger.debug(f"Sélecteur {tag or class_name} échoué: {e}")
            continue
    
    return None

def extract_with_heuristics(soup: BeautifulSoup, url: str) -> Optional[Dict]:
    """Extraction heuristique basée sur la densité de texte"""
    body = soup.find('body')
    if not body:
        return None
    
    containers = []
    for tag in ['div', 'section', 'article', 'main']:
        for container in body.find_all(tag):
            p_count = len(container.find_all('p'))
            if p_count >= 3:
                text_length = len(container.get_text(strip=True))
                containers.append((container, p_count, text_length))
    
    if containers:
        containers.sort(key=lambda x: x[1] * x[2], reverse=True)
        best_container = containers[0][0]
        paragraphs = html_to_paragraphs(str(best_container))
        if paragraphs:
            logger.info(f"✅ Extraction heuristique réussie pour {url}")
            return {
                "paragraphs": paragraphs,
                "content_html": str(best_container),
                "method": "heuristic"
            }
    
    return None

def extract_all_paragraphs(soup: BeautifulSoup, url: str) -> Dict:
    """Dernier recours: extrait tous les paragraphes du body"""
    body = soup.find('body')
    if not body:
        return {"paragraphs": [], "content_html": "", "method": "failed"}
    
    for unwanted in body.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
        unwanted.decompose()
    
    all_p = body.find_all('p')
    paragraphs = []
    for p in all_p:
        text = p.get_text(separator=" ", strip=True)
        if text and len(text) > 30:
            paragraphs.append(text)
    
    logger.info(f"⚠️ Extraction basique (tous les <p>) pour {url} - {len(paragraphs)} paragraphes")
    return {
        "paragraphs": paragraphs,
        "content_html": "<br/>".join(f"<p>{p}</p>" for p in paragraphs),
        "method": "all_paragraphs"
    }

def fetch_html(url: str, timeout: int = 15, max_retries: int = 2) -> Optional[str]:
    """Télécharge le HTML de la page avec rate limiting et retry"""
    
    for attempt in range(max_retries + 1):
        try:
            wait_for_rate_limit(url)
            
            response = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
            
            if response.status_code == 429:
                mark_rate_limited(url)
                retry_after = int(response.headers.get('Retry-After', 10))
                wait_time = min(retry_after, 30)
                logger.warning(f"429 Too Many Requests pour {url}, attente {wait_time}s")
                if attempt < max_retries:
                    time.sleep(wait_time)
                    continue
                return None
            
            response.raise_for_status()
            mark_success(url)
            response.encoding = response.apparent_encoding
            return response.text
            
        except requests.exceptions.Timeout:
            logger.warning(f"⚠️ Timeout pour {url}")
            if attempt < max_retries:
                time.sleep(2)
                continue
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 429:
                mark_rate_limited(url)
                if attempt < max_retries:
                    time.sleep(10)
                    continue
            logger.warning(f"⚠️ Erreur HTTP pour {url}: {e}")
        except requests.exceptions.RequestException as e:
            logger.warning(f"⚠️ Erreur réseau pour {url}: {e}")
        except Exception as e:
            logger.error(f"❌ Erreur inattendue pour {url}: {e}")
        
        if attempt < max_retries:
            time.sleep(2)
    
    return None

def extract_full_content(url: str) -> str:
    """
    Extrait le contenu complet d'un article depuis son URL.
    Retourne du HTML propre avec déduplication des paragraphes.
    """
    try:
        html_text = fetch_html(url)
        if not html_text:
            return "<p>Impossible de charger l'article.</p>"
        
        soup = BeautifulSoup(html_text, "html.parser")
        
        for element in soup.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript', 'form', 'button']):
            element.decompose()
        
        for ad_class in ['ad', 'advertisement', 'pub', 'banner', 'sidebar', 'related', 'social-share', 'comments', 'newsletter']:
            for element in soup.find_all(class_=lambda x: bool(x and ad_class in str(x).lower())):
                element.decompose()
        
        result = extract_with_article_selectors(soup, url)
        
        if not result or len(result.get("paragraphs", [])) < 2:
            result = extract_with_heuristics(soup, url)
        
        if not result or len(result.get("paragraphs", [])) < 2:
            result = extract_all_paragraphs(soup, url)
        
        paragraphs = dedupe_paragraphs(result.get("paragraphs", []))
        
        if not paragraphs:
            logger.debug(f"Aucun contenu extrait pour {url}")
            return "<p>Le contenu de cet article n'est pas disponible. Veuillez consulter l'article original.</p>"
        
        content_parts = [f"<p>{p}</p>" for p in paragraphs]
        full_content = "\n".join(content_parts)
        
        logger.info(f"✅ Extrait {len(paragraphs)} paragraphes pour {url} (méthode: {result.get('method')})")
        return f"<div class='article-content'>{full_content}</div>"
        
    except Exception as e:
        logger.error(f"❌ Erreur extraction pour {url}: {e}", exc_info=True)
        return "<p>Une erreur s'est produite lors de l'extraction de l'article.</p>"
