"""Profile-image upload route mounted at /auth/upload-image (no /api prefix)."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from middleware.auth_middleware import get_current_user

router = APIRouter(tags=["Uploads"])

ALLOWED_PROFILE_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
PROFILE_UPLOAD_DIR = Path("backend/uploads/avatars")
PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/auth/upload-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a profile/avatar image (JPEG/PNG/WebP/GIF, max 5MB)."""
    if file.content_type not in ALLOWED_PROFILE_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type (allowed: jpeg, png, webp, gif)",
        )

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > MAX_PROFILE_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    ext = ext_map[file.content_type]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = PROFILE_UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/avatars/{filename}", "filename": filename}
