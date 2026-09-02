from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Form, File, UploadFile, Depends
from pydantic import BaseModel
from typing import Optional, List
import logging
from datetime import datetime, timedelta, timezone
import uuid
import os
import io

try:
    from PIL import Image
except ImportError:
    Image = None

from db import get_db
from middleware.auth_middleware import get_current_user
from utils.thumbnail_generator import generate_story_cover, generate_text_thumbnail

router = APIRouter(prefix="/stories", tags=["stories"])
logger = logging.getLogger(__name__)

class Element(BaseModel):
    id: Optional[int] = None
    type: str
    content: Optional[str] = None
    x: Optional[int] = 0
    y: Optional[int] = 0
    size: Optional[int] = None
    fontSize: Optional[int] = None
    color: Optional[str] = None
    opacity: Optional[int] = 100
    rotation: Optional[int] = 0

class Music(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    artist: Optional[str] = None
    duration: Optional[int] = 0
    url: Optional[str] = None
    isCustom: Optional[bool] = False
    startTime: Optional[int] = 0

class StoryCreate(BaseModel):
    id: Optional[int] = None
    backgroundImage: Optional[str] = None
    elements: List[Element] = []
    music: Optional[Music] = None
    filters: Optional[dict] = {}
    createdAt: Optional[str] = None
    expiresAt: Optional[str] = None

@router.post("/")
async def create_story(story: StoryCreate, background_tasks: BackgroundTasks, request: Request):
    """
    🚀 Ultra-fast story creation with optimized data storage
    """
    try:
        db = get_db()
        
        # Récupérer le token manuellement depuis cookie ou header
        auth_header = request.headers.get('Authorization', '')
        cookie_token = request.cookies.get('access_token')
        
        # Extraire le token du header Authorization
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Remove "Bearer " prefix
        else:
            token = cookie_token or auth_header
        
        logger.info(f"🔐 Auth header present: {bool(auth_header)}, Cookie present: {bool(cookie_token)}, Token length: {len(token) if token else 0}")
        
        # ✅ TOUJOURS UTILISER JWT_SECRET MANDATOIRE DE REPLIT
        import os
        SECRET_KEY = os.getenv('JWT_SECRET')
        if not SECRET_KEY:
             logger.error("❌ JWT_SECRET non défini dans l'environnement")
             raise HTTPException(status_code=500, detail="Configuration serveur incorrecte")

        if not token:
            raise HTTPException(status_code=401, detail="Non authentifié - Token manquant")
        
        # Vérifier le token et récupérer l'utilisateur
        try:
            import jwt
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id_from_token = payload.get("user_id") or payload.get("sub") or payload.get("id")
            logger.info(f"🔐 Token decoded, user_id: {user_id_from_token}")
            if not user_id_from_token:
                raise HTTPException(status_code=401, detail="Token invalide - User ID manquant dans le token")
            current_user = {"id": user_id_from_token, "user_id": user_id_from_token}
        except jwt.ExpiredSignatureError:
            logger.error("🔐 Token expiré!")
            raise HTTPException(status_code=401, detail="Token expiré - Veuillez vous reconnecter")
        except jwt.InvalidTokenError as e:
            logger.error(f"🔐 JWT error: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Token invalide: {str(e)}")
        except Exception as e:
            logger.error(f"🔐 Auth error: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Token invalide: {str(e)}")
        
        # Récupérer l'utilisateur connecté - TOUJOURS convertir en string
        user_id = str(current_user.get("id") or current_user.get("user_id") or current_user.get("_id", ""))
        
        if not user_id or user_id == "":
            raise HTTPException(status_code=401, detail="Non authentifié - User ID manquant")
        
        logger.info(f"📝 Story création par user ID: {user_id}")
        
        # Générer un ID unique
        story_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)
        
        # Préparer les données de la story
        # ✅ S'assurer que backgroundImage est bien récupéré
        background_image = story.backgroundImage or story.dict().get('media_url') or story.dict().get('backgroundImage')
        
        # Story document SANS thumbnail (process en background)
        story_doc = {
            "id": story_id,
            "user_id": user_id,  # ✅ Utilise le vrai user_id du payload ou cookie
            "media_url": background_image,  # Stocker l'image base64 ou URL
            "backgroundImage": background_image,  # ✅ S'assurer que backgroundImage est toujours rempli
            "story_cover_url": None,  # 🖼️ Généré en background
            "media_type": "image",
            "elements": [el.dict() for el in story.elements] if story.elements else [],
            "music": story.music.dict() if story.music else None,
            "filters": story.filters or {},
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "views": [],
            "views_count": 0,
            "likes_count": 0,
            "likes": [],
            "reactions": [],
            "is_highlight": False,
            "collection_id": None
        }
        
        logger.info(f"📸 Story créée avec image: {background_image[:50] if background_image and len(str(background_image)) > 50 else background_image}")
        
        # Insérer dans MongoDB IMMÉDIATEMENT (sans attendre la thumbnail)
        await db.stories.insert_one(story_doc)
        
        logger.info(f"✅ Story created: {story_id}")

        # Background task: Generate thumbnail + cleanup
        def generate_thumbnail_and_cleanup():
            try:
                logger.info(f"🖼️ Generating story cover in background...")
                if background_image:
                    try:
                        story_cover_url = generate_story_cover(background_image, "image")
                        logger.info(f"🖼️ Story cover générée: {story_cover_url}")
                        # Update document with thumbnail
                        db.stories.update_one(
                            {"id": story_id},
                            {"$set": {"story_cover_url": story_cover_url}}
                        )
                    except Exception as e:
                        logger.warning(f"⚠️ Impossible de générer la cover: {e}")
                
                logger.info(f"🧹 Cleaning up old stories...")
                # Cleanup expired stories
            except Exception as e:
                logger.error(f"❌ Background task error: {e}")

        background_tasks.add_task(generate_thumbnail_and_cleanup)

        return {
            "success": True,
            "id": story_id,
            "storyId": story_id,
            "message": "Story published successfully",
            "publishedAt": now.isoformat(),
            "expiresAt": expires_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Story creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create story")

@router.get("/id/{story_id}")
async def get_story(story_id: str):
    """Get a specific story by ID"""
    try:
        db = get_db()
        story = await db.stories.find_one({"id": story_id})
        if not story:
             raise HTTPException(status_code=404, detail="Story not found")
        
        return {
            "storyId": story_id,
            "status": "available",
            "data": story
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail="Story not found")

@router.get("")
async def get_all_stories():
    """
    📖 Récupère toutes les stories groupées par utilisateur avec compteur de stories non vues
    """
    logger.info("🔄 GET /api/stories called - fetching all stories")
    try:
        # Import inside function to avoid circular imports
        from datetime import datetime, timezone
        db = get_db()

        # Récupère les stories non expirées - MÉTHODE SIMPLIFIÉE
        now = datetime.now(timezone.utc)

        # 1. Récupérer SEULEMENT les stories valides (< 24h)
        stories_list = await db.stories.find(
            {"expires_at": {"$gt": now.isoformat()}},
            {
                "_id": 0,
                "id": 1,
                "user_id": 1,
                "media_url": 1,
                "backgroundImage": 1,
                "story_cover_url": 1,
                "media_type": 1,
                "text": 1,
                "style": 1,
                "elements": 1,
                "music": 1,
                "filters": 1,
                "created_at": 1,
                "expires_at": 1,
                "views": 1,
                "likes_count": 1
            }
        ).sort("created_at", -1).limit(50).to_list(length=50)

        if not stories_list:
            logger.info("📭 Aucune story active")
            return []

        # 2. Grouper par user_id en Python (plus rapide que MongoDB $lookup)
        user_stories_map = {}
        user_ids = set()

        for story in stories_list:
            # TOUJOURS convertir user_id en string pour cohérence
            user_id = str(story.get("user_id", ""))
            if user_id and user_id != "":
                user_ids.add(user_id)
                if user_id not in user_stories_map:
                    user_stories_map[user_id] = []
                # Normaliser views pour éviter les erreurs de type
                views = story.get("views", [])
                if isinstance(views, int):
                    story["views"] = []
                    story["views_count"] = views
                user_stories_map[user_id].append(story)

        # 3. Récupérer les infos users EN UNE SEULE REQUÊTE
        # Convertir tous les user_ids en string pour éviter les erreurs de type
        user_ids_list = list(user_ids)  # Assure que c'est une liste
        user_ids_str = [str(uid) for uid in user_ids_list]
        
        logger.info(f"🔍 Looking for {len(user_ids_str)} users with IDs: {user_ids_str}")
        
        if user_ids_str:
            users_cursor = db.users.find(
                {"id": {"$in": user_ids_str}},
                {"_id": 0, "id": 1, "full_name": 1, "username": 1, "avatar": 1}
            )
            users_list = await users_cursor.to_list(length=len(user_ids_str))
            logger.info(f"✅ Database returned {len(users_list)} users")
            for u in users_list:
                logger.info(f"  - User {u.get('id')}: {u.get('full_name')}")
        else:
            users_list = []
            logger.warning("⚠️ No user IDs to search for!")
            
        users_dict = {str(u["id"]): u for u in users_list}
        logger.info(f"🔍 Total: Found {len(users_list)} users out of {len(user_ids_str)} requested")

        # 4. Construire le résultat final avec enrichissement des stories
        result = []
        for user_id, stories in user_stories_map.items():
            # S'assurer que user_id est toujours une string
            user_id_str = str(user_id)
            user_info = users_dict.get(user_id_str)
            
            # Log si utilisateur pas trouvé
            if not user_info:
                logger.warning(f"⚠️ User {user_id_str} not found in database")
                user_info = {
                    "id": user_id_str,
                    "full_name": "Utilisateur",
                    "username": "user",
                    "avatar": None
                }
            else:
                logger.info(f"✅ Found user {user_id_str}: {user_info.get('full_name')}")
            
            # Enrichir chaque story avec les infos d'auteur
            enriched_stories = []
            for story in stories:
                story_copy = dict(story)
                story_copy["author"] = {
                    "id": user_info.get("id"),
                    "full_name": user_info.get("full_name", "Utilisateur"),
                    "avatar": user_info.get("avatar"),
                    "username": user_info.get("username", "user")
                }
                enriched_stories.append(story_copy)
            
            stories = enriched_stories
            
            # 🖼️ Utiliser la cover de la première story comme preview du groupe
            first_story = stories[0] if stories else {}
            story_cover_url = first_story.get("story_cover_url")
            
            # 🔧 FALLBACK: Si pas de cover générée, générer on-the-fly
            if not story_cover_url and first_story:
                background_image = first_story.get("backgroundImage") or first_story.get("media_url")
                if background_image:
                    try:
                        story_cover_url = generate_story_cover(background_image, "image")
                        # Aussi mettre à jour la DB pour la prochaine fois
                        if story_cover_url:
                            await db.stories.update_one(
                                {"id": first_story.get("id")},
                                {"$set": {"story_cover_url": story_cover_url}},
                                upsert=False
                            )
                            logger.info(f"✅ Generated missing cover for story {first_story.get('id')}: {story_cover_url}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not generate cover: {e}")

            result.append({
                "user": user_info,
                "stories": stories,
                "unseen_count": len(stories),
                "story_cover_url": story_cover_url
            })

        logger.info(f"✅ Récupération de {len(result)} groupes ({len(stories_list)} stories)")
        return result

    except Exception as e:
        logger.error(f"❌ Error fetching stories: {str(e)}")
        return []

@router.get("/{story_id}/thumbnail")
async def get_story_thumbnail(story_id: str):
    """🖼️ ROBUSTE: Génère et retourne le thumbnail d'une story"""
    try:
        from fastapi.responses import FileResponse, RedirectResponse
        
        db = get_db()
        
        # 1️⃣ Vérifier si on a déjà le thumbnail en cache
        story = await db.stories.find_one(
            {"id": story_id},
            {"story_cover_url": 1, "backgroundImage": 1, "media_url": 1, "media_type": 1}
        )
        
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # 2️⃣ Si on a déjà une cover valide et en /uploads, la servir
        story_cover = story.get("story_cover_url")
        if story_cover and isinstance(story_cover, str):
            if story_cover.startswith('/uploads'):
                # Servir le fichier directement
                file_path = story_cover.lstrip('/')
                if os.path.exists(file_path):
                    return FileResponse(file_path, media_type="image/jpeg")
        
        # 3️⃣ Sinon, générer à partir de backgroundImage ou media_url
        image_data = story.get("backgroundImage") or story.get("media_url")
        if not image_data:
            # Pas d'image source
            raise HTTPException(status_code=404, detail="No image data")
        
        # 4️⃣ Générer le thumbnail
        thumbnail_url = None
        if isinstance(image_data, str):
            if image_data.startswith('data:'):
                # Base64 image
                thumbnail_url = generate_story_cover(image_data, "image")
            elif image_data.startswith('/'):
                # File path
                thumbnail_url = generate_story_cover(image_data, "image")
        
        # 5️⃣ Servir le thumbnail généré
        if thumbnail_url:
            # Sauvegarder pour les futures requêtes
            await db.stories.update_one(
                {"id": story_id},
                {"$set": {"story_cover_url": thumbnail_url}},
                upsert=False
            )
            logger.info(f"✅ Generated thumbnail for story {story_id}: {thumbnail_url}")
            
            # Servir le fichier
            file_path = thumbnail_url.lstrip('/')
            if os.path.exists(file_path):
                return FileResponse(file_path, media_type="image/jpeg")
        
        raise HTTPException(status_code=500, detail="Failed to generate thumbnail")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating thumbnail: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate thumbnail")

@router.post("/{story_id}/like")
async def like_story(story_id: str, request: Request):
    """Like une story"""
    try:
        db = get_db()
        
        # Récupérer l'utilisateur connecté
        token = request.cookies.get('access_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        # Décoder le JWT manuellement
        import jwt
        import os
        SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id") or payload.get("sub") or payload.get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Token invalide - User ID manquant")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expiré")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        # Incrémenter le compteur de likes
        result = await db.stories.update_one(
            {"id": story_id},
            {"$inc": {"likes_count": 1}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        # Récupérer le nouveau compteur
        story = await db.stories.find_one({"id": story_id}, {"likes_count": 1})
        
        return {
            "success": True,
            "likes_count": story.get("likes_count", 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error liking story: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{story_id}/react")
async def react_to_story(story_id: str, reaction: str, request: Request):
    """Réagir à une story avec une réaction spécifique"""
    try:
        db = get_db()
        
        # Récupérer l'utilisateur connecté
        token = request.cookies.get('access_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        # Décoder le JWT manuellement
        import jwt
        import os
        SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id") or payload.get("sub") or payload.get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Token invalide - User ID manquant")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expiré")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        # Ajouter la réaction
        result = await db.stories.update_one(
            {"id": story_id},
            {
                "$push": {
                    "reactions": {
                        "user_id": user_id,
                        "reaction": reaction,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Story non trouvée")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error reacting to story: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/health")
async def health_check():
    """Health check for story publishing"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@router.post("/upload")
async def create_story_with_media(
    request: Request,
    user_id: str = Form(...),
    text: Optional[str] = Form(None),
    background_color: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    music_id: Optional[str] = Form(None),
    stickers: Optional[str] = Form(None)
):
    try:
        media_url = None
        media_type = None

        if media_file:
            # Validate file size (max 10MB)
            content = await media_file.read()
            file_size_mb = len(content) / (1024 * 1024)

            if file_size_mb > 10:
                raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

            # Save media file
            file_extension = media_file.filename.split(".")[-1].lower()
            filename = f"{uuid.uuid4()}.{file_extension}"
            media_path = f"uploads/stories/{filename}"
            os.makedirs("uploads/stories", exist_ok=True)

            # Compress image if it's an image
            if file_extension in ["jpg", "jpeg", "png", "gif"]:
                img = Image.open(io.BytesIO(content))

                # Resize if too large
                max_dimension = 1920
                if img.width > max_dimension or img.height > max_dimension:
                    img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

                # Save compressed
                output = io.BytesIO()
                if file_extension in ["jpg", "jpeg"]:
                    img.convert('RGB').save(output, format='JPEG', quality=85, optimize=True)
                elif file_extension == "png":
                    img.save(output, format='PNG', optimize=True)
                else:
                    img.save(output, format=file_extension.upper())

                content = output.getvalue()

            with open(media_path, "wb") as f:
                f.write(content)

            media_url = f"/uploads/stories/{filename}"
            media_type = "image" if file_extension in ["jpg", "jpeg", "png", "gif"] else "video"
        
        # 🖼️ Générer automatiquement la cover/thumbnail pour l'aperçu
        story_cover_url = None
        if media_url:
            try:
                story_cover_url = generate_story_cover(media_url, media_type or "image")
                logger.info(f"🖼️ Story cover générée: {story_cover_url}")
            except Exception as e:
                logger.warning(f"⚠️ Impossible de générer la cover: {e}")
        
        # Save the story data to the database
        db = get_db()
        story_id = str(uuid.uuid4())
        published_at = datetime.now(timezone.utc).isoformat()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        
        story_doc = {
            "id": story_id,
            "user_id": user_id,
            "media_url": media_url,
            "backgroundImage": media_url,
            "story_cover_url": story_cover_url,
            "media_type": media_type,
            "text": text,
            "background_color": background_color,
            "music_id": music_id,
            "stickers": stickers,
            "created_at": published_at,
            "expires_at": expires_at,
            "views": [],
            "views_count": 0,
            "likes_count": 0,
            "likes": [],
            "reactions": [],
            "is_highlight": False,
            "collection_id": None
        }
        
        await db.stories.insert_one(story_doc)
        logger.info(f"✅ Story with media created: {story_id}")

        return {
            "success": True,
            "storyId": story_id,
            "message": "Story with media published successfully",
            "publishedAt": published_at,
            "expiresAt": expires_at,
            "mediaUrl": media_url,
            "mediaType": media_type,
            "storyCoverUrl": story_cover_url
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"❌ Story creation with media failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create story with media")


@router.get("/stories/feed")
async def get_stories_feed(request: Request):
    """Get stories feed for the current user"""
    try:
        from middleware.auth_middleware import get_current_user
        
        # Get current user from token
        token = request.cookies.get('access_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        current_user = await get_current_user(token)
        db = get_db()
        
        # Get user's friends
        user = await db.users.find_one({"id": current_user.id}, {"friends": 1})
        friends = user.get("friends", []) if user else []

        # Get stories from friends and self
        user_ids = friends + [current_user.id]

        # Current time for filtering expired stories
        now = datetime.now(timezone.utc)

        # Optimize query with expires_at filter and limit
        stories_cursor = await db.stories.find(
            {
                "user_id": {"$in": user_ids},
                "expires_at": {"$gt": now.isoformat()}
            },
            projection={
                "_id": 0,
                "id": 1,
                "user_id": 1,
                "media_url": 1,
                "media_type": 1,
                "text": 1,
                "background_color": 1,
                "music": 1,
                "stickers": 1,
                "views": 1,
                "created_at": 1,
                "expires_at": 1
            }
        ).sort("created_at", -1).limit(100)
        
        stories = await stories_cursor.to_list(length=100)

        # Fetch user info for all stories
        user_ids = list(set(str(s["user_id"]) for s in stories))
        users_cursor = db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "full_name": 1, "username": 1, "avatar": 1}
        )
        users_list = await users_cursor.to_list(length=len(user_ids))
        users_dict = {str(u["id"]): u for u in users_list}

        # Group by user and enrich with author info
        stories_by_user = {}
        for story in stories:
            user_id = str(story["user_id"])
            user_info = users_dict.get(user_id, {
                "id": user_id,
                "full_name": "Utilisateur",
                "username": "user",
                "avatar": None
            })
            
            story["author"] = {
                "id": user_info.get("id"),
                "full_name": user_info.get("full_name", "Utilisateur"),
                "avatar": user_info.get("avatar"),
                "username": user_info.get("username", "user")
            }
            
            if user_id not in stories_by_user:
                stories_by_user[user_id] = []
            stories_by_user[user_id].append(story)

        return {"stories": stories_by_user}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching stories feed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-text/")
async def upload_text_story(request: Request, background_tasks: BackgroundTasks):
    """
    📝 Create a text-based story with custom styling
    """
    try:
        db = get_db()
        
        # Extract token
        auth_header = request.headers.get('Authorization', '')
        cookie_token = request.cookies.get('access_token')
        
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            token = cookie_token or auth_header
        
        if not token:
            raise HTTPException(status_code=401, detail="Non authentifié - Token manquant")
        
        # Verify token
        try:
            import jwt
            import os
            SECRET_KEY = os.getenv('JWT_SECRET')
            if not SECRET_KEY:
                 logger.error("❌ JWT_SECRET non défini dans l'environnement")
                 raise HTTPException(status_code=500, detail="Configuration serveur incorrecte")
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = str(payload.get("user_id") or payload.get("sub") or payload.get("id"))
            if not user_id:
                raise HTTPException(status_code=401, detail="Token invalide - User ID manquant")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expiré")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Token invalide: {str(e)}")
        
        # Parse request data
        body = await request.json()
        text = body.get('text', '')
        style = body.get('style', {})
        
        # ✅ VALIDATION: Texte vide
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Le texte ne peut pas être vide")
        
        # ✅ VALIDATION: Longueur (MAX 500 caractères)
        if len(text.strip()) > 500:
            raise HTTPException(status_code=400, detail="Maximum 500 caractères")
        
        # ✅ SANITIZATION
        import html
        import re
        text = html.escape(text.strip())
        
        # ✅ VALIDATION: Couleurs hex
        hex_pattern = r'^#[0-9A-Fa-f]{6}$'
        for color_key in ['textColor', 'backgroundColor', 'gradientColor2']:
            if style.get(color_key):
                if not re.match(hex_pattern, style[color_key]):
                    raise HTTPException(status_code=400, detail=f"Couleur invalide: {color_key}")
        
        # ✅ VALIDATION: Font size
        font_size = style.get('fontSize', 24)
        if not isinstance(font_size, int) or font_size < 16 or font_size > 48:
            raise HTTPException(status_code=400, detail="Taille invalide (16-48px)")
        
        # ✅ VALIDATION: Alignement
        if style.get('textAlign') not in ['left', 'center', 'right']:
            raise HTTPException(status_code=400, detail="Alignement invalide")
        
        # Create story document
        story_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)
        
        story_doc = {
            "id": story_id,
            "user_id": user_id,
            "text": text.strip(),
            "style": style,
            "media_type": "text",
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "views": [],
            "views_count": 0,
            "likes_count": 0,
            "likes": [],
            "reactions": [],
            "comments": [],
            "is_highlight": False,
            "collection_id": None
        }
        
        # Insert into MongoDB
        await db.stories.insert_one(story_doc)
        
        logger.info(f"✅ Text story created: {story_id}")
        
        # Generate thumbnail in background
        def generate_text_story_thumbnail():
            try:
                logger.info(f"🖼️ Generating text story thumbnail...")
                story_cover_url = generate_text_thumbnail(text.strip(), style)
                if story_cover_url:
                    db.stories.update_one(
                        {"id": story_id},
                        {"$set": {"story_cover_url": story_cover_url}}
                    )
                    logger.info(f"🖼️ Text story thumbnail saved: {story_cover_url}")
            except Exception as e:
                logger.error(f"❌ Failed to generate text thumbnail: {e}")
        
        background_tasks.add_task(generate_text_story_thumbnail)
        
        return {
            "success": True,
            "id": story_id,
            "storyId": story_id,
            "text": text.strip(),
            "style": style,
            "message": "Story texte publiée avec succès",
            "publishedAt": now.isoformat(),
            "expiresAt": expires_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Text story creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create text story")