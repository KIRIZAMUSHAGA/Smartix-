from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
HOST_URL = os.getenv("HOST_URL", "http://localhost:8000")
USER_AGENT = os.getenv("SCRAPER_USER_AGENT", "SmartOHADA-NewsBot/1.0")
FETCH_INTERVAL_MINUTES = int(os.getenv("FETCH_INTERVAL_MINUTES", "10"))
MAX_RSS_ITEMS = int(os.getenv("MAX_RSS_ITEMS", "30"))
IMAGE_STORE_LOCAL = os.getenv("IMAGE_STORE_LOCAL", "local_images")
S3_ENDPOINT = os.getenv("S3_ENDPOINT")
S3_KEY = os.getenv("S3_KEY")
S3_SECRET = os.getenv("S3_SECRET")
S3_BUCKET = os.getenv("S3_BUCKET")


def update_config(key: str, value):
    """Mise à jour dynamique d'une variable de configuration en mémoire."""
    globals()[key] = value
    return value
