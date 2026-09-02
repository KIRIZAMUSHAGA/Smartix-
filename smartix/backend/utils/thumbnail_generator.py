import os
import io
import uuid
import base64
import logging
import subprocess
from PIL import Image
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

THUMBNAIL_SIZE = (200, 200)
THUMBNAIL_QUALITY = 85
THUMBNAILS_DIR = "uploads/story_covers"

def ensure_thumbnails_dir():
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)

def generate_square_thumbnail(image: Image.Image, size: Tuple[int, int] = THUMBNAIL_SIZE) -> Image.Image:
    width, height = image.size
    min_dim = min(width, height)
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    right = left + min_dim
    bottom = top + min_dim
    cropped = image.crop((left, top, right, bottom))
    cropped.thumbnail(size, Image.Resampling.LANCZOS)
    return cropped

def save_thumbnail(image: Image.Image, filename: str) -> str:
    ensure_thumbnails_dir()
    filepath = os.path.join(THUMBNAILS_DIR, filename)
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')
    image.save(filepath, format='JPEG', quality=THUMBNAIL_QUALITY, optimize=True)
    return f"/{THUMBNAILS_DIR}/{filename}"

def generate_cover_from_image_bytes(image_bytes: bytes) -> Optional[str]:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        thumbnail = generate_square_thumbnail(image)
        filename = f"{uuid.uuid4()}_cover.jpg"
        cover_url = save_thumbnail(thumbnail, filename)
        logger.info(f"✅ Cover généré: {cover_url}")
        return cover_url
    except Exception as e:
        logger.error(f"❌ Erreur génération cover image: {e}")
        return None

def generate_cover_from_base64(base64_data: str) -> Optional[str]:
    try:
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]
        image_bytes = base64.b64decode(base64_data)
        return generate_cover_from_image_bytes(image_bytes)
    except Exception as e:
        logger.error(f"❌ Erreur décodage base64: {e}")
        return None

def generate_cover_from_image_path(image_path: str) -> Optional[str]:
    try:
        full_path = image_path.lstrip('/')
        if not os.path.exists(full_path):
            logger.error(f"❌ Fichier non trouvé: {full_path}")
            return None
        with open(full_path, 'rb') as f:
            image_bytes = f.read()
        return generate_cover_from_image_bytes(image_bytes)
    except Exception as e:
        logger.error(f"❌ Erreur lecture fichier image: {e}")
        return None

def extract_video_first_frame(video_path: str) -> Optional[str]:
    try:
        full_path = video_path.lstrip('/')
        if not os.path.exists(full_path):
            logger.error(f"❌ Vidéo non trouvée: {full_path}")
            return None
        ensure_thumbnails_dir()
        output_filename = f"{uuid.uuid4()}_frame.jpg"
        output_path = os.path.join(THUMBNAILS_DIR, output_filename)
        cmd = [
            'ffmpeg', '-y', '-i', full_path,
            '-ss', '00:00:00.000',
            '-vframes', '1',
            '-q:v', '2',
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            logger.error(f"❌ FFmpeg error: {result.stderr.decode()}")
            return None
        if not os.path.exists(output_path):
            logger.error("❌ Frame non extraite")
            return None
        with open(output_path, 'rb') as f:
            frame_bytes = f.read()
        os.remove(output_path)
        cover_url = generate_cover_from_image_bytes(frame_bytes)
        return cover_url
    except subprocess.TimeoutExpired:
        logger.error("❌ FFmpeg timeout")
        return None
    except Exception as e:
        logger.error(f"❌ Erreur extraction frame vidéo: {e}")
        return None

def generate_text_thumbnail(text: str, style: dict) -> Optional[str]:
    """Generate a thumbnail image from text story content"""
    try:
        from PIL import ImageDraw, ImageFont
        import textwrap
        
        # Parse colors more robustly
        def parse_color(color_str: str, default: tuple) -> tuple:
            try:
                if not color_str or not isinstance(color_str, str):
                    return default
                color_str = color_str.strip()
                if color_str.startswith('#') and len(color_str) == 7:
                    return tuple(int(color_str[i:i+2], 16) for i in (1, 3, 5))
                return default
            except:
                return default
        
        # Create image with background color
        bg_color = parse_color(style.get('backgroundColor', '#FFFFFF'), (255, 255, 255))
        text_color = parse_color(style.get('textColor', '#000000'), (0, 0, 0))
        
        # Create square image
        img = Image.new('RGB', THUMBNAIL_SIZE, bg_color)
        draw = ImageDraw.Draw(img)
        
        # Load font - try multiple paths
        font = None
        font_size = min(max(style.get('fontSize', 24), 16), 32)
        
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
        ]
        
        for font_path in font_paths:
            try:
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                    logger.info(f"✅ Font loaded: {font_path}")
                    break
            except:
                continue
        
        # Fallback to default font
        if not font:
            font = ImageFont.load_default()
            logger.warning("⚠️ Using default font for text thumbnail")
        
        # Clean and validate text
        text = str(text).strip()[:150]  # Max 150 chars
        if not text:
            logger.warning("⚠️ Empty text for thumbnail")
            return None
        
        # Wrap text intelligently
        max_width = THUMBNAIL_SIZE[0] - 20
        lines = []
        
        # Simple word wrapping
        words = text.split()
        current_line = ""
        
        for word in words:
            test_line = f"{current_line} {word}".strip()
            try:
                bbox = draw.textbbox((0, 0), test_line, font=font)
                line_width = bbox[2] - bbox[0]
            except:
                line_width = len(test_line) * 8  # Rough estimate
            
            if line_width > max_width and current_line:
                lines.append(current_line)
                current_line = word
            else:
                current_line = test_line
        
        if current_line:
            lines.append(current_line)
        
        lines = lines[:5]  # Max 5 lines
        
        # Draw text centered
        padding = 10
        line_height = font_size + 8
        total_height = len(lines) * line_height
        start_y = max(10, (THUMBNAIL_SIZE[1] - total_height) // 2)
        
        for i, line in enumerate(lines):
            try:
                bbox = draw.textbbox((0, 0), line, font=font)
                text_width = bbox[2] - bbox[0]
                x = max(padding, (THUMBNAIL_SIZE[0] - text_width) // 2)
                y = start_y + i * line_height
                
                # Draw text with slight shadow for better visibility (if background is light)
                if bg_color != (0, 0, 0) and bg_color != text_color:
                    shadow_color = tuple(min(max(c - 50, 0), 255) for c in text_color)
                    draw.text((x+1, y+1), line, fill=shadow_color, font=font)
                
                draw.text((x, y), line, fill=text_color, font=font)
            except Exception as e:
                logger.error(f"⚠️ Error drawing line: {e}")
                continue
        
        # Save thumbnail
        filename = f"{uuid.uuid4()}_text.jpg"
        cover_url = save_thumbnail(img, filename)
        logger.info(f"✅ Text thumbnail generated with {len(lines)} lines: {cover_url}")
        return cover_url
        
    except Exception as e:
        logger.error(f"❌ Error generating text thumbnail: {e}")
        return None

def generate_story_cover(media_url: Optional[str], media_type: str = "image") -> Optional[str]:
    if not media_url:
        return None
    if media_url.startswith('data:'):
        return generate_cover_from_base64(media_url)
    if media_type == "video":
        cover = extract_video_first_frame(media_url)
        if cover:
            return cover
    return generate_cover_from_image_path(media_url)
