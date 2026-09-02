import os
import uuid
from PIL import Image
from io import BytesIO
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from db import get_db
from typing import List, Optional
from datetime import datetime, timezone
from middleware.auth_middleware import get_current_user
from utils.audit_log import get_client_ip, log_action
from utils.validators import validate_id_string

router = APIRouter(tags=["posts"])

UPLOAD_POSTS_DIR = "backend/uploads/posts"
os.makedirs(UPLOAD_POSTS_DIR, exist_ok=True)

# Upload limits for post images
ALLOWED_POST_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_POST_CONTENT_LEN = 5000  # characters


async def _find_post(db, post_id: str):
    """Find a post by its `id` (uuid/timestamp) or `_id` (ObjectId) field."""
    post = await db.posts.find_one({"id": post_id})
    if post:
        return post
    try:
        from bson import ObjectId
        return await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        return None

def generate_thumbnail(image_bytes: bytes) -> bytes:
    img = Image.open(BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    
    # Max width 600px, preserve ratio
    max_width = 600
    if img.width > max_width:
        ratio = max_width / float(img.width)
        height = int(float(img.height) * float(ratio))
        img = img.resize((max_width, height), Image.Resampling.LANCZOS)
    
    output = BytesIO()
    img.save(output, format="WEBP", quality=60, optimize=True)
    return output.getvalue()

@router.post("/api/posts/upload")
async def upload_post_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        # Validate MIME type
        if file.content_type not in ALLOWED_POST_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Invalid file type (allowed: jpeg, png, webp, gif)")

        content = await file.read()

        # Validate size
        if len(content) > MAX_POST_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        # Pick a safe extension based on the validated MIME type
        ext_map = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
        }
        file_extension = ext_map[file.content_type]
        base_filename = str(uuid.uuid4())
        original_filename = f"{base_filename}.{file_extension}"
        thumbnail_filename = f"{base_filename}_thumb.webp"

        # Save original
        with open(os.path.join(UPLOAD_POSTS_DIR, original_filename), "wb") as f:
            f.write(content)
            
        # Generate and save thumbnail
        thumb_content = generate_thumbnail(content)
        with open(os.path.join(UPLOAD_POSTS_DIR, thumbnail_filename), "wb") as f:
            f.write(thumb_content)
            
        return {
            "image": original_filename,
            "image_thumbnail": thumbnail_filename,
            "image_url": f"/uploads/posts/{original_filename}",
            "thumbnail_url": f"/uploads/posts/{thumbnail_filename}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

@router.post("/api/posts")
async def create_post(request: Request, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        data = await request.json()
        
        # Validation de base
        content = data.get("content", "").strip()
        post_type = data.get("post_type", "regular")
        shared_post_id = data.get("shared_post_id")
        
        if not content and not data.get("image") and not data.get("background_id") and post_type != "shared_post":
            raise HTTPException(status_code=400, detail="Content is required")

        if content and len(content) > MAX_POST_CONTENT_LEN:
            raise HTTPException(
                status_code=400,
                detail=f"Content too long (max {MAX_POST_CONTENT_LEN} characters)",
            )

        new_post = {
            "id": str(datetime.now(timezone.utc).timestamp()),
            "user_id": current_user["id"],
            "content": content,
            "post_type": post_type,
            "shared_post_id": shared_post_id,
            "shared_post_author_id": data.get("shared_post_author_id"),
            "category": data.get("category", "general"),
            "image": data.get("image"),
            "image_thumbnail": data.get("image_thumbnail"),
            "background_id": data.get("background_id"),
            "background_css": data.get("background_css"),
            "background_image": data.get("background_image"),
            "visibility": data.get("visibility", "public"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reactions_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "likes": [],
            "status": "published"
        }
        
        result = await db.posts.insert_one(new_post)
        new_post["_id"] = str(result.inserted_id)
        
        return new_post
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/posts/{post_id}")
async def delete_post(
    post_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Soft-delete a post (moves it to a 30-day trash). Owner only."""
    post_id = validate_id_string(post_id)
    db = get_db()
    post = await _find_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if str(post.get("user_id")) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Soft delete via the post's stable id (or _id fallback)
    query = {"id": post["id"]} if post.get("id") else {"_id": post["_id"]}
    await db.posts.update_one(
        query,
        {"$set": {"deleted_at": datetime.now(timezone.utc), "status": "trashed"}},
    )

    await log_action(
        user_id=current_user["id"],
        action="post.delete",
        target_id=post_id,
        ip=get_client_ip(request),
    )

    return {"deleted": True, "expires_in_days": 30}


@router.post("/api/posts/{post_id}/restore")
async def restore_post(
    post_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Restore a soft-deleted post if still within the 30-day trash window."""
    post_id = validate_id_string(post_id)
    db = get_db()
    post = await _find_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if str(post.get("user_id")) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    deleted_at = post.get("deleted_at")
    if not deleted_at:
        raise HTTPException(status_code=400, detail="Post not in trash")

    # Normalise tz
    if isinstance(deleted_at, str):
        try:
            deleted_at = datetime.fromisoformat(deleted_at)
        except ValueError:
            deleted_at = None
    if deleted_at and deleted_at.tzinfo is None:
        deleted_at = deleted_at.replace(tzinfo=timezone.utc)

    if deleted_at:
        days_in_trash = (datetime.now(timezone.utc) - deleted_at).days
        if days_in_trash > 30:
            raise HTTPException(status_code=400, detail="Post expired")

    query = {"id": post["id"]} if post.get("id") else {"_id": post["_id"]}
    await db.posts.update_one(
        query,
        {"$unset": {"deleted_at": ""}, "$set": {"status": "published"}},
    )

    await log_action(
        user_id=current_user["id"],
        action="post.restore",
        target_id=post_id,
        ip=get_client_ip(request),
    )

    return {"restored": True}


@router.post("/api/posts/{post_id}/save")
async def save_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Toggle 'save for later' on a post."""
    post_id = validate_id_string(post_id)
    db = get_db()
    post = await _find_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    saved = await db.saved_posts.find_one({
        "user_id": current_user["id"],
        "post_id": post_id,
    })

    if saved:
        await db.saved_posts.delete_one({"_id": saved["_id"]})
        return {"saved": False}

    await db.saved_posts.insert_one({
        "user_id": current_user["id"],
        "post_id": post_id,
        "created_at": datetime.now(timezone.utc),
    })
    return {"saved": True}


@router.post("/api/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        # Trouver le post original
        original_post = await db.posts.find_one({"id": post_id})
        if not original_post:
            try:
                from bson import ObjectId
                original_post = await db.posts.find_one({"_id": ObjectId(post_id)})
            except:
                pass
                
        if not original_post:
            raise HTTPException(status_code=404, detail="Post original non trouvé")

        # Créer le nouveau post de type "shared_post"
        shared_post = {
            "id": str(datetime.now(timezone.utc).timestamp()),
            "user_id": current_user["id"],
            "content": "", 
            "post_type": "shared_post",
            "shared_post_id": original_post.get("id") or str(original_post.get("_id")),
            "shared_post_author_id": original_post.get("user_id"),
            "category": original_post.get("category", "general"),
            "visibility": "public",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reactions_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "likes": [],
            "status": "published"
        }
        
        await db.posts.insert_one(shared_post)
        
        # Notification
        if original_post.get("user_id") != current_user["id"]:
            notification = {
                "user_id": original_post.get("user_id"),
                "type": "post_shared",
                "from_user_id": current_user["id"],
                "post_id": str(original_post.get("_id")),
                "message": f"{current_user.get('full_name', 'Quelqu’un')} a partagé votre publication",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "read": False
            }
            await db.notifications.insert_one(notification)

        return {"status": "success", "message": "Post partagé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/posts/{post_id}")
async def get_post_detail(post_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        post = await db.posts.find_one({"id": post_id})
        if not post:
            from bson import ObjectId
            try:
                post = await db.posts.find_one({"_id": ObjectId(post_id)})
            except:
                pass
        
        if not post:
            raise HTTPException(status_code=404, detail="Post non trouvé")
            
        if "_id" in post: post["_id"] = str(post["_id"])
        
        # Enrichir avec l'auteur
        user_info = await db.users.find_one({"id": post.get("user_id")})
        avatar = user_info.get("avatar") if user_info else None
        if avatar and isinstance(avatar, str) and not avatar.startswith("/") and not avatar.startswith("http") and not avatar.startswith("uploads/"):
            avatar = f"/uploads/avatars/{avatar}"
            
        post["author"] = {
            "id": user_info.get("id") if user_info else post.get("user_id"),
            "full_name": user_info.get("full_name", "Utilisateur") if user_info else "Utilisateur",
            "avatar": avatar
        }
        return post
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/posts")
async def get_posts(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    try:
        # Pagination caps to prevent DoS via large page requests
        skip = max(0, skip)
        limit = max(1, min(limit, 100))
        db = get_db()
        posts = await db.posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrichir avec l'auteur
        user_ids = list(set(p.get("user_id") for p in posts if p.get("user_id")))
        users = await db.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids))
        users_dict = {u["id"]: u for u in users}
        
        enriched_posts = []
        for p in posts:
            if "_id" in p: p["_id"] = str(p["_id"])
            user_info = users_dict.get(p.get("user_id"))
            avatar = user_info.get("avatar") if user_info else None
            if avatar and isinstance(avatar, str) and not avatar.startswith("/") and not avatar.startswith("http") and not avatar.startswith("uploads/"):
                avatar = f"/uploads/avatars/{avatar}"
            p["author"] = {
                "id": user_info.get("id") if user_info else p.get("user_id"),
                "full_name": user_info.get("full_name", "Utilisateur") if user_info else "Utilisateur",
                "avatar": avatar
            }
            
            # Media separation logic
            p["image_original_url"] = None
            p["image_thumbnail_url"] = None
            
            if p.get("image"):
                p["image_original_url"] = f"/uploads/posts/{p['image']}"
                if p.get("image_thumbnail"):
                    p["image_thumbnail_url"] = f"/uploads/posts/{p['image_thumbnail']}"
                else:
                    # Fallback for old posts
                    p["image_thumbnail_url"] = f"/uploads/posts/{p['image']}"
            
            enriched_posts.append(p)
            
        return enriched_posts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
