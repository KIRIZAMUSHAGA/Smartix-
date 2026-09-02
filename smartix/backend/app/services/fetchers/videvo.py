"""
Videvo fetcher - scrapes free stock videos from videvo.net
Only includes Royalty-Free and Creative Commons licensed content
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict
from .utils import make_video_doc, HEADERS


def fetch_videvo(per_page: int = 12) -> List[Dict]:
    """
    Fetch videos from Videvo.net
    
    Args:
        per_page: Maximum number of videos to fetch
        
    Returns:
        List of normalized video documents
    """
    items = []
    
    try:
        r = requests.get(
            'https://www.videvo.net/free-stock-footage/', 
            headers=HEADERS,
            timeout=10
        )
        if r.status_code != 200:
            print(f"⚠️ Videvo: HTTP {r.status_code}")
            return items
            
        soup = BeautifulSoup(r.text, 'html.parser')
        
        cards = soup.select('.video-responsive, .clip-card, a[href*="/video/"]')[:per_page * 2]
        
        processed = 0
        for card in cards:
            if processed >= per_page:
                break
                
            try:
                link = card if card.name == 'a' else card.find('a', href=True)
                if not link:
                    continue
                    
                href = link.get('href', '')
                if '/video/' not in href:
                    continue
                
                if not href.startswith('http'):
                    href = 'https://www.videvo.net' + href
                
                page = requests.get(href, headers=HEADERS, timeout=8)
                if page.status_code != 200:
                    continue
                    
                sp = BeautifulSoup(page.text, 'html.parser')
                
                video_tag = sp.find('video')
                source_tag = sp.find('source', {'type': 'video/mp4'})
                
                video_url = None
                if video_tag and video_tag.get('src'):
                    video_url = video_tag.get('src')
                elif source_tag and source_tag.get('src'):
                    video_url = source_tag.get('src')
                
                if not video_url:
                    dl_btn = sp.find('a', {'class': 'download-button'})
                    if dl_btn and dl_btn.get('href'):
                        video_url = dl_btn.get('href')
                
                if not video_url:
                    continue
                
                thumb_meta = sp.find('meta', {'property': 'og:image'})
                thumb = thumb_meta.get('content') if thumb_meta else None
                
                title_meta = sp.find('meta', {'property': 'og:title'})
                title_tag = sp.find('h1')
                title = (title_meta.get('content') if title_meta else None) or \
                        (title_tag.text.strip() if title_tag else 'Videvo clip')
                
                source_id = href.strip('/').split('/')[-1][:50]
                
                items.append(make_video_doc(
                    source='Videvo',
                    source_id=source_id,
                    video_url=video_url,
                    thumbnail_url=thumb,
                    title=title,
                    license='Videvo Free License',
                    tags=['stock', 'videvo']
                ))
                processed += 1
                
            except Exception as e:
                continue
                
        print(f"✅ Videvo: {len(items)} videos fetched")
        
    except Exception as e:
        print(f"❌ Videvo fetch error: {e}")
        
    return items
