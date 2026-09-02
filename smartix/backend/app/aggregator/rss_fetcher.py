import feedparser
import requests
import logging
from dateutil import parser as dateparser
from app.config import MAX_RSS_ITEMS

logger = logging.getLogger(__name__)

def parse_entry(entry):
    title = entry.get("title")
    link = entry.get("link")
    summary = entry.get("summary", "") or entry.get("description", "")
    published = entry.get("published") or entry.get("pubDate") or None
    if published:
        try:
            published = dateparser.parse(published)
        except:
            published = None
    image = None
    if "media_content" in entry:
        try:
            image = entry.media_content[0].get("url")
        except:
            image = None
    if not image and "enclosures" in entry and entry.enclosures:
        image = entry.enclosures[0].get("url")
    return {"title": title, "link": link, "summary": summary, "published": published, "image": image}

def fetch_from_rss(rss_url, max_items=MAX_RSS_ITEMS):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    try:
        # Forcer un timeout court pour éviter de bloquer
        response = requests.get(rss_url, headers=headers, timeout=10)
        # Utilisation de bytes pour feedparser pour éviter les problèmes d'encodage
        feed = feedparser.parse(response.content)
        items = []
        for entry in feed.entries[:max_items]:
            items.append(parse_entry(entry))
        return items
    except Exception as e:
        logger.debug(f"Fetch RSS échoué pour {rss_url}: {e}")
        return []
