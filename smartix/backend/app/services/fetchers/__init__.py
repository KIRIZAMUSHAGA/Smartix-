"""
Video fetchers for SmartixClip
Each fetcher retrieves videos from a specific source
"""

from .videvo import fetch_videvo
from .coverr import fetch_coverr
from .archive_org import fetch_archive_org
from .mazwai import fetch_mazwai

__all__ = [
    'fetch_videvo',
    'fetch_coverr', 
    'fetch_archive_org',
    'fetch_mazwai'
]
