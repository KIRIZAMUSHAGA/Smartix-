"""
🎵 Music Upload Handler
Handles audio file uploads, validation, and storage
"""
import os
import uuid
from datetime import datetime
from pathlib import Path
import mimetypes

UPLOAD_DIR = Path("uploads/music")
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DURATION = 60  # seconds

def ensure_upload_dir():
    """Create upload directory if it doesn't exist"""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def validate_audio_file(filename: str, file_size: int) -> tuple[bool, str]:
    """Validate audio file"""
    # Check extension
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Format non supporté. Utilisez: {', '.join(ALLOWED_EXTENSIONS)}"
    
    # Check file size
    if file_size > MAX_FILE_SIZE:
        return False, f"Fichier trop volumineux (max {MAX_FILE_SIZE / 1024 / 1024:.0f}MB)"
    
    return True, "OK"

def save_music_file(file_content: bytes, filename: str, title: str) -> dict:
    """Save music file and return metadata"""
    ensure_upload_dir()
    
    # Generate unique filename
    file_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'mp3'
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(file_content)
    
    # Return music metadata
    return {
        "id": f"custom_{uuid.uuid4().hex[:8]}",
        "title": title.replace(f".{file_ext}", ""),
        "artist": "Ma Musique",
        "duration": 45,  # Estimate, would need ffprobe for exact
        "url": f"/api/music/stream/{unique_filename}",
        "category": "custom",
        "isCustom": True,
        "uploadedAt": datetime.now().isoformat()
    }
