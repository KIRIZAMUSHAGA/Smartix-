import os
import requests
from urllib.parse import urlparse
from app.config import IMAGE_STORE_LOCAL, S3_BUCKET, S3_KEY, S3_SECRET, S3_ENDPOINT
from PIL import Image
from io import BytesIO

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

def download_image_local(url):
    ensure_dir(IMAGE_STORE_LOCAL)
    try:
        r = requests.get(url, timeout=8, stream=True)
        if r.status_code == 200:
            filename = os.path.basename(urlparse(url).path) or ("img_" + str(abs(hash(url))) + ".jpg")
            path = os.path.join(IMAGE_STORE_LOCAL, filename)
            with open(path, "wb") as f:
                for chunk in r.iter_content(1024):
                    f.write(chunk)
            # optional: resize to thumbnail
            try:
                img = Image.open(path)
                img.thumbnail((1024, 1024))
                img.save(path)
            except Exception:
                pass
            return path
    except Exception:
        return None
    return None

# TODO: implement S3 uploader if S3 creds are provided.
