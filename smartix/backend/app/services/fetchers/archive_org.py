"""
Archive.org fetcher - scrapes public domain videos from Internet Archive
All content is public domain or Creative Commons
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict
from .utils import make_video_doc, HEADERS


def fetch_archive_org(per_page: int = 12) -> List[Dict]:
    """
    Fetch videos from Internet Archive (archive.org)
    
    Args:
        per_page: Maximum number of videos to fetch
        
    Returns:
        List of normalized video documents
    """
    items = []
    
    try:
        search_url = 'https://archive.org/search'
        params = {
            'query': 'mediatype:movies AND licenseurl:*creativecommons*',
            'sort': '-downloads',
            'output': 'json',
            'rows': per_page
        }
        
        r = requests.get(search_url, params=params, headers=HEADERS, timeout=15)
        
        if r.status_code == 200:
            try:
                data = r.json()
                docs = data.get('response', {}).get('docs', [])
                
                for doc in docs[:per_page]:
                    identifier = doc.get('identifier')
                    if not identifier:
                        continue
                    
                    title = doc.get('title', 'Archive.org video')
                    description = doc.get('description', '')
                    if isinstance(description, list):
                        description = description[0] if description else ''
                    
                    video_url = f"https://archive.org/download/{identifier}/{identifier}.mp4"
                    thumb = f"https://archive.org/services/img/{identifier}"
                    
                    items.append(make_video_doc(
                        source='Archive.org',
                        source_id=identifier,
                        video_url=video_url,
                        thumbnail_url=thumb,
                        title=title[:100],
                        description=description[:500] if description else None,
                        license='Public Domain / CC',
                        tags=['archive', 'public-domain', 'classic']
                    ))
                    
            except Exception as json_err:
                print(f"⚠️ Archive.org JSON parse error: {json_err}")
        
        if not items:
            r = requests.get(
                'https://archive.org/details/movies',
                headers=HEADERS,
                timeout=10
            )
            if r.status_code != 200:
                return items
                
            soup = BeautifulSoup(r.text, 'html.parser')
            
            cards = soup.select('.item-ia, a[href*="/details/"]')[:per_page * 2]
            
            processed = 0
            for card in cards:
                if processed >= per_page:
                    break
                    
                try:
                    link = card.find('a', href=True) if card.name != 'a' else card
                    if not link:
                        continue
                        
                    href = link.get('href', '')
                    if '/details/' not in href:
                        continue
                    
                    if not href.startswith('http'):
                        href = 'https://archive.org' + href
                    
                    page = requests.get(href, headers=HEADERS, timeout=8)
                    if page.status_code != 200:
                        continue
                        
                    sp = BeautifulSoup(page.text, 'html.parser')
                    
                    sources = sp.select('a[href$=".mp4"], a[href$=".webm"], a[href$=".ogv"]')
                    if not sources:
                        continue
                    
                    video_url = sources[0].get('href')
                    if video_url and video_url.startswith('/'):
                        video_url = 'https://archive.org' + video_url
                    
                    if not video_url:
                        continue
                    
                    thumb_meta = sp.find('meta', {'property': 'og:image'})
                    thumb = thumb_meta.get('content') if thumb_meta else None
                    
                    title_meta = sp.find('meta', {'property': 'og:title'})
                    title = title_meta.get('content') if title_meta else 'Archive clip'
                    
                    source_id = href.strip('/').split('/')[-1][:50]
                    
                    items.append(make_video_doc(
                        source='Archive.org',
                        source_id=source_id,
                        video_url=video_url,
                        thumbnail_url=thumb,
                        title=title,
                        license='Public Domain / CC',
                        tags=['archive', 'public-domain']
                    ))
                    processed += 1
                    
                except Exception as e:
                    continue
        
        print(f"✅ Archive.org: {len(items)} videos fetched")
        
    except Exception as e:
        print(f"❌ Archive.org fetch error: {e}")
        
    return items
