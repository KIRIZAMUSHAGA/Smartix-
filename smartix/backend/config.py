"""⚡ Configuration d'optimisation pour Smartix"""

import os

# =============================
# BASE DIRECTORY
# =============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# =============================
# DATABASE OPTIMIZATION
# =============================
MONGODB_CONNECTION_POOL_SIZE = 50
MONGODB_MIN_POOL_SIZE = 10

# =============================
# CACHE SETTINGS (Redis-ready)
# =============================
CACHE_TTL_SHORT = 300  # 5 minutes pour posts/stories
CACHE_TTL_MEDIUM = 600  # 10 minutes pour users
CACHE_TTL_LONG = 3600  # 1 hour pour courses

# =============================
# QUERY OPTIMIZATION
# =============================
PAGINATION_DEFAULT_SIZE = 20
PAGINATION_MAX_SIZE = 100

# =============================
# PERFORMANCE
# =============================
GZIP_MIN_SIZE = 1000
GZIP_COMPRESSION_LEVEL = 9
REQUEST_TIMEOUT = 10

# =============================
# FRONTEND OPTIMIZATION
# =============================
JS_BUNDLE_TARGETS = {
    'main': ['App', 'index'],
    'vendors': ['node_modules'],
    'components': ['components/*'],
    'pages': ['pages/*']
}

# =============================
# SMARTCLIPS STUDIO CONFIGURATION
# =============================

# Dossiers
SMARTCLIPS_STUDIO_DIR = os.path.join(BASE_DIR, "uploads", "smartclips_studio")
STUDIO_UPLOAD_DIR = os.path.join(SMARTCLIPS_STUDIO_DIR, "uploads")
STUDIO_PROCESSED_DIR = os.path.join(SMARTCLIPS_STUDIO_DIR, "processed")
STUDIO_TEMP_DIR = os.path.join(SMARTCLIPS_STUDIO_DIR, "temp")

# Limites de fichier
STUDIO_MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
STUDIO_ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"]

# FFmpeg
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")
FFPROBE_PATH = os.getenv("FFPROBE_PATH", "ffprobe")

# Traitement vidéo
STUDIO_MAX_CONCURRENT_JOBS = 3
STUDIO_JOB_TIMEOUT = 600  # 10 minutes (secondes)
STUDIO_POLLING_INTERVAL = 2  # secondes

# Qualité d'export
STUDIO_EXPORT_QUALITY = {
    "high": {"bitrate": "5M", "crf": 18, "preset": "slow"},
    "medium": {"bitrate": "2.5M", "crf": 23, "preset": "medium"},
    "low": {"bitrate": "1M", "crf": 28, "preset": "fast"}
}
STUDIO_DEFAULT_QUALITY = "medium"

# Formats supportés
STUDIO_OUTPUT_FORMATS = ["mp4", "webm"]
STUDIO_DEFAULT_FORMAT = "mp4"

# Cache TTL spécifique studio
CACHE_TTL_STUDIO_PROJECTS = 300  # 5 minutes
CACHE_TTL_STUDIO_TEMPLATES = 3600  # 1 heure

# Limites par utilisateur
STUDIO_MAX_PROJECTS_PER_USER = 50
STUDIO_MAX_ELEMENTS_PER_PROJECT = 20

# Créer les dossiers s'ils n'existent pas
os.makedirs(STUDIO_UPLOAD_DIR, exist_ok=True)
os.makedirs(STUDIO_PROCESSED_DIR, exist_ok=True)
os.makedirs(STUDIO_TEMP_DIR, exist_ok=True)

# =============================
# SMARTCLIPS SCRAPING
# =============================
SCRAPING_BATCH_SIZE = 20
SCRAPING_MAX_RETRIES = 3
SCRAPING_RETRY_DELAY = 5  # secondes
SCRAPING_REQUEST_TIMEOUT = 30  # secondes

# Sources de scraping
SCRAPING_SOURCES = {
    "pixabay": {
        "enabled": True,
        "api_key": os.getenv("PIXABAY_API_KEY", ""),
        "base_url": "https://pixabay.com/api/videos/",
        "max_per_page": 200,
        "rate_limit": 100  # requêtes par heure
    },
    "pexels": {
        "enabled": True,
        "api_key": os.getenv("PEXELS_API_KEY", ""),
        "base_url": "https://api.pexels.com/videos/search",
        "max_per_page": 80,
        "rate_limit": 200  # requêtes par heure
    },
    "archiveorg": {
        "enabled": True,
        "base_url": "https://archive.org/advancedsearch.php",
        "max_per_page": 50,
        "rate_limit": 30  # requêtes par heure
    }
}

# =============================
# NOTIFICATIONS
# =============================
NOTIFICATION_BATCH_SIZE = 50
NOTIFICATION_CACHE_TTL = 60  # 1 minute

# =============================
# EXPORT
# =============================
__all__ = [
    'MONGODB_CONNECTION_POOL_SIZE',
    'MONGODB_MIN_POOL_SIZE',
    'CACHE_TTL_SHORT',
    'CACHE_TTL_MEDIUM',
    'CACHE_TTL_LONG',
    'PAGINATION_DEFAULT_SIZE',
    'PAGINATION_MAX_SIZE',
    'GZIP_MIN_SIZE',
    'GZIP_COMPRESSION_LEVEL',
    'REQUEST_TIMEOUT',
    'JS_BUNDLE_TARGETS',
    # Studio
    'SMARTCLIPS_STUDIO_DIR',
    'STUDIO_UPLOAD_DIR',
    'STUDIO_PROCESSED_DIR',
    'STUDIO_TEMP_DIR',
    'STUDIO_MAX_FILE_SIZE',
    'STUDIO_ALLOWED_TYPES',
    'FFMPEG_PATH',
    'FFPROBE_PATH',
    'STUDIO_MAX_CONCURRENT_JOBS',
    'STUDIO_JOB_TIMEOUT',
    'STUDIO_POLLING_INTERVAL',
    'STUDIO_EXPORT_QUALITY',
    'STUDIO_DEFAULT_QUALITY',
    'STUDIO_OUTPUT_FORMATS',
    'STUDIO_DEFAULT_FORMAT',
    'CACHE_TTL_STUDIO_PROJECTS',
    'CACHE_TTL_STUDIO_TEMPLATES',
    'STUDIO_MAX_PROJECTS_PER_USER',
    'STUDIO_MAX_ELEMENTS_PER_PROJECT',
    # Scraping
    'SCRAPING_BATCH_SIZE',
    'SCRAPING_MAX_RETRIES',
    'SCRAPING_RETRY_DELAY',
    'SCRAPING_REQUEST_TIMEOUT',
    'SCRAPING_SOURCES',
    # Notifications
    'NOTIFICATION_BATCH_SIZE',
    'NOTIFICATION_CACHE_TTL'
]
