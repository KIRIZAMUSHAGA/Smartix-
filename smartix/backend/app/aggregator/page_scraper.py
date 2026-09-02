import requests
from bs4 import BeautifulSoup
from app.config import USER_AGENT
from app.aggregator.content_extractor import wait_for_rate_limit, mark_success, mark_rate_limited
import time
import logging

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": USER_AGENT}

def extract_og_image(html_text):
    soup = BeautifulSoup(html_text, "html.parser")
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]
    link_img = soup.find("link", rel="image_src")
    if link_img and link_img.get("href"):
        return link_img["href"]
    img = soup.find("img")
    if img and img.get("src"):
        return img["src"]
    return None

def fetch_page_image(url, timeout=6, max_retries=1):
    for attempt in range(max_retries + 1):
        try:
            wait_for_rate_limit(url, base_delay=1.0)
            
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            
            if r.status_code == 429:
                mark_rate_limited(url)
                if attempt < max_retries:
                    time.sleep(5)
                    continue
                return None
            
            if r.status_code == 200:
                mark_success(url)
                return extract_og_image(r.text)
                
        except requests.exceptions.Timeout:
            logger.debug(f"Timeout fetching image from {url}")
        except Exception as e:
            logger.debug(f"Error fetching image from {url}: {e}")
        
        if attempt < max_retries:
            time.sleep(1)
    
    return None
