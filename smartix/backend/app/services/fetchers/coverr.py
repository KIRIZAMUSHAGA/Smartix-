"""
Coverr fetcher - scrapes free stock videos from coverr.co
All videos are free to use commercially
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict
from .utils import make_video_doc, HEADERS


def fetch_coverr(per_page: int = 12) -> List[Dict]:
    """
    Fetch videos from Coverr.co
    
    Args:
        per_page: Maximum number of videos to fetch
        
    Returns:
        List of normalized video documents
    """
    items = []
    
    try:
        r = requests.get('https://coverr.co/videos', headers=HEADERS, timeout=10)
        if r.status_code != 200:
            print(f"⚠️ Coverr: HTTP {r.status_code}")
            return items
            
        soup = BeautifulSoup(r.text, 'html.parser')
        
        cards = soup.select('a[href*="/videos/"], .video-card, .card')[:per_page * 2]
        
        processed = 0
        for card in cards:
            if processed >= per_page:
                break
                
            try:
                link = card if card.name == 'a' else card.find('a', href=True)
                if not link:
                    continue
                    
                href = link.get('href', '')
                if '/videos/' not in href:
                    continue
                
                if not href.startswith('http'):
                    href = 'https://coverr.co' + href
                
                page = requests.get(href, headers=HEADERS, timeout=8)
                if page.status_code != 200:
                    continue
                    
                sp = BeautifulSoup(page.text, 'html.parser')
                
                video_url = None
                
                video_tag = sp.find('video')
                if video_tag:
                    source = video_tag.find('source')
                    if source and source.get('src'):
                        video_url = source.get('src')
                    elif video_tag.get('src'):
                        video_url = video_tag.get('src')
                
                if not video_url:
                    for script in sp.find_all('script'):
                        text = script.string or ''
                        if '.mp4' in text:
                            import re
                            urls = re.findall(r'https?://[^\s"\'"]+\.mp4[^\s"\'"]*', text)
                            if urls:
                                video_url = urls[0].split('"')[0].split("'")[0]
                                break
                
                if not video_url:
                    continue
                
                thumb_meta = sp.find('meta', {'property': 'og:image'})
                thumb = thumb_meta.get('content') if thumb_meta else None
                
                title_tag = sp.find('h1')
                title_meta = sp.find('meta', {'property': 'og:title'})
                title = (title_tag.text.strip() if title_tag else None) or \
                        (title_meta.get('content') if title_meta else 'Coverr video')
                
                source_id = href.strip('/').split('/')[-1][:50]
                
                items.append(make_video_doc(
                    source='Coverr',
                    source_id=source_id,
                    video_url=video_url,
                    thumbnail_url=thumb,
                    title=title,
                    license='Coverr License (Free)',
                    tags=['stock', 'coverr', 'free']
                ))
                processed += 1
                
            except Exception as e:
                continue
                
        print(f"✅ Coverr: {len(items)} videos fetched")
        
    except Exception as e:
        print(f"❌ Coverr fetch error: {e}")
        
    return items
