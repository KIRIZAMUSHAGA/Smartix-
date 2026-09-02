"""
Shared utilities for video fetchers
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional
import os

USER_AGENT = os.getenv("SCRAPER_USER_AGENT", "SmartixClip-VideoBot/1.0")
HEADERS = {"User-Agent": USER_AGENT}


def make_video_doc(
    source: str,
    source_id: str,
    video_url: str,
    thumbnail_url: Optional[str],
    title: str,
    duration: Optional[int] = None,
    tags: List[str] = None,
    description: Optional[str] = None,
    license: str = "Open Source",
    author_name: Optional[str] = None,
    author_avatar: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None
) -> Dict:
    """
    Create a normalized video document for database storage.
    """
    from app.services.avatars import author_name_for_source, avatar_url_for_source
    
    return {
        "source": source,
        "source_id": source_id,
        "title": title or f"{source} video",
        "description": description,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
        "duration": duration,
        "tags": tags or [],
        "license": license,
        "type": "open_source",
        "author_name": author_name or author_name_for_source(source),
        "author_avatar": author_avatar or avatar_url_for_source(source),
        "width": width,
        "height": height,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "views": 0,
        "liked_by": [],
        "created_at": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc)
    }
