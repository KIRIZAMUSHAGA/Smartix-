"""
Video quality selection utility for SmartixClip
Picks the best quality stream from available video files
Priority: 4K -> 1080p -> 720p -> largest file size
"""

from typing import List, Dict, Optional


def pick_best_video(candidate_files: List[Dict]) -> Optional[str]:
    """
    Select the best quality video from a list of candidates.
    
    Args:
        candidate_files: list of dicts with keys: url, width, height, quality_label, filesize (optional)
    
    Returns:
        URL of the best quality video, or None if no candidates
    """
    if not candidate_files:
        return None
    
    def score(f: Dict) -> tuple:
        w = f.get('width') or 0
        h = f.get('height') or 0
        size = f.get('filesize') or 0
        quality = f.get('quality_label', '').lower()
        
        quality_bonus = 0
        if '4k' in quality or '2160' in quality:
            quality_bonus = 4
        elif '1080' in quality or 'hd' in quality:
            quality_bonus = 3
        elif '720' in quality:
            quality_bonus = 2
        elif '480' in quality or 'sd' in quality:
            quality_bonus = 1
        
        return (quality_bonus, w * h, size)
    
    best = max(candidate_files, key=score)
    return best.get('url')


def get_best_video_from_pexels(video_files: List[Dict]) -> Optional[str]:
    """Extract best video URL from Pexels API response video_files - prioritize HD/4K"""
    if not video_files:
        return None
    
    # Sort by quality first (hd > sd > other)
    hd_files = [f for f in video_files if f.get('quality') == 'hd']
    if hd_files:
        video_files = hd_files
    
    candidates = []
    for f in video_files:
        url = f.get('link')
        if url and isinstance(url, str) and url.strip():
            candidates.append({
                'url': url,
                'width': f.get('width', 0),
                'height': f.get('height', 0),
                'quality_label': f.get('quality', ''),
                'filesize': f.get('file_size', 0)
            })
    
    return pick_best_video(candidates) if candidates else None


def get_best_video_from_pixabay(videos_dict: Dict) -> Optional[str]:
    """Extract best video URL from Pixabay API response videos dict - prioritize large/HD"""
    if not videos_dict:
        return None
    
    # Prioritize large (usually 1080p HD) then fall back to smaller
    quality_order = ['large', 'medium', 'small', 'tiny']
    
    for quality in quality_order:
        if quality in videos_dict:
            video_data = videos_dict[quality]
            url = video_data.get('url')
            if url:
                # Ensure URL is valid and not empty
                if isinstance(url, str) and url.strip():
                    return url
    
    return None
