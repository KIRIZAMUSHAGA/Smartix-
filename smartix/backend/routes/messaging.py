"""
MESSAGERIE PRIVÉE AVANCÉE - FastAPI Routes
Supporte: Messages texte, voix, éphémères, documents, appels audio/vidéo
"""

from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Form, Depends
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
from bson.objectid import ObjectId
from middleware.auth_middleware import get_current_user
from routes.notifications import create_notification

router = APIRouter(tags=["messaging"])

def get_db():
    from db import get_db
    return get_db()

def get_msg_logger():
    import logging
    return logging.getLogger(__name__)

# ============= MESSAGES TEXTE =============

@router.post("/messages/send")
async def send_message(
    recipient_id: str,
    content: str,
    user_id: str,
    message_type: str = "text"  # text, voice, ephemeral, document, media
):
    """Envoyer un message privé"""
    try:
        db = get_db()
        from utils.crypto_service import crypto_service
        
        message_doc = {
            "sender_id": user_id,
            "recipient_id": recipient_id,
            "content": crypto_service.encrypt(content),
            "type": message_type,
            "is_encrypted": True,
            "read": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db.messages.insert_one(message_doc)
        
        return {
            "success": True,
            "message_id": str(result.inserted_id),
            "timestamp": message_doc["created_at"]
        }
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}

@router.get("/conversations")
async def get_conversations_v2(user_id: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    """Alias pour get_conversations (utilisé par MessagesDetail.js)"""
    return await get_conversations(user_id, limit)

@router.get("/messages/conversations")
async def get_conversations(user_id: str, limit: int = Query(20, ge=1, le=100)):
    """Récupérer toutes les conversations de l'utilisateur"""
    try:
        db = get_db()
        from utils.crypto_service import crypto_service
        
        # Récupérer derniers messages avec chaque utilisateur
        conversations = await db.messages.find({
            "$or": [
                {"sender_id": user_id},
                {"recipient_id": user_id}
            ]
        }).sort("created_at", -1).to_list(limit * 2)
        
        # Grouper par conversation
        conv_dict = {}
        for msg in conversations or []:
            other_user = msg.get("recipient_id") if msg.get("sender_id") == user_id else msg.get("sender_id")
            if other_user not in conv_dict:
                # Décryptage pour l'aperçu
                content = msg.get("content", "")
                if msg.get("is_encrypted"):
                    content = crypto_service.decrypt(content)
                msg["content"] = content
                # Convert ObjectId to str
                if "_id" in msg:
                    msg["_id"] = str(msg["_id"])
                conv_dict[other_user] = msg
        
        conversations = [
            {
                "user_id": uid,
                "last_message": msg.get("content", ""),
                "last_message_time": msg.get("created_at"),
                "unread": not msg.get("read", False)
            }
            for uid, msg in list(conv_dict.items())[:limit]
        ]
        
        return {"success": True, "conversations": conversations}
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}

@router.get("/messages/conversations/{conversation_id}")
async def get_messages(
    conversation_id: str,
    current_user_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """Récupérer messages d'une conversation spécifique avec infos partenaire"""
    try:
        db = get_db()
        
        if not current_user_id:
             return {"success": False, "error": "Authentification requise"}

        # Recherche de la conversation
        conv = await db.conversations.find_one({
            "id": conversation_id,
            "participants": current_user_id
        })
        
        if not conv:
             return {"success": False, "error": "Conversation non trouvée ou accès refusé"}
             
        # Récupération des infos du partenaire pour le statut en temps réel
        partner_id = next((p for p in conv.get("participants", []) if p != current_user_id), None)
        partner_data = None
        if partner_id:
            partner = await db.users.find_one({"id": partner_id})
            if partner:
                is_online = partner.get("is_online", False)
                last_seen = partner.get("last_seen")
                
                # Correction dynamique pour les profils système
                if partner.get("is_system"):
                    from utils.system_presence import is_system_user_online, get_simulated_last_seen
                    signature = partner.get("signature_temporelle")
                    if signature:
                        is_online = is_system_user_online(signature)
                        # Si on simule le statut "en ligne", on rafraîchit le last_seen
                        if is_online:
                            last_seen = datetime.utcnow().isoformat()
                        else:
                            # Si hors ligne, on s'assure d'avoir un last_seen réaliste
                            if not last_seen:
                                last_seen = get_simulated_last_seen(signature)

                partner_data = {
                    "id": partner.get("id"),
                    "full_name": partner.get("full_name"),
                    "username": partner.get("username"),
                    "avatar": partner.get("avatar"),
                    "is_online": is_online,
                    "last_seen": last_seen
                }

        # Si les messages sont intégrés (embed)
        messages_raw = conv.get("messages", [])
        from utils.crypto_service import crypto_service
        messages = []
        for msg in messages_raw:
            if "_id" in msg: msg["_id"] = str(msg["_id"])
            if msg.get("is_encrypted") and isinstance(msg.get("content"), str):
                try:
                    msg["content"] = crypto_service.decrypt(msg["content"])
                except Exception: pass
            messages.append(msg)
        
        return {
            "success": True, 
            "messages": messages,
            "partner": partner_data
        }
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error fetching messages: {e}")
        return {"success": False, "error": str(e)}

# ============= UNREAD COUNT =============

@router.get("/messages/unread-count")
@router.get("/messages/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Obtenir nombre de messages non lus"""
    # VERSION_MARKER: 1.0.6
    try:
        user_id = str(current_user.get("id") or current_user.get("_id"))
        db = get_db()
        unread = await db.messages.count_documents({
            "recipient_id": user_id,
            "read": False
        })
        return {"success": True, "unread_count": unread}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/messages/{user_id}")
async def get_conversation(
    user_id: str,
    current_user_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """Récupérer messages avec un utilisateur spécifique"""
    try:
        db = get_db()
        from utils.crypto_service import crypto_service
        
        messages = await db.messages.find({
            "$or": [
                {"sender_id": current_user_id, "recipient_id": user_id},
                {"sender_id": user_id, "recipient_id": current_user_id}
            ]
        }).sort("created_at", -1).skip(offset).to_list(limit)
        
        result = []
        for msg in messages or []:
            content = msg.get("content", "")
            if msg.get("is_encrypted"):
                content = crypto_service.decrypt(content)
                
            result.append({
                "id": str(msg.get("_id")),
                "sender_id": msg.get("sender_id"),
                "recipient_id": msg.get("recipient_id"),
                "content": content,
                "type": msg.get("type", "text"),
                "read": msg.get("read", False),
                "media_url": msg.get("media_url"),
                "expires_at": msg.get("expires_at"),
                "created_at": msg.get("created_at")
            })
        
        return {"success": True, "messages": result[::-1]}  # Reverse to chronological order
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}


# ============= SUPPRIMER MESSAGE =============

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user_id: str):
    """Supprimer un message (soft delete)"""
    try:
        db = get_db()
        
        # Vérifier que c'est l'auteur
        msg = await db.messages.find_one({"_id": ObjectId(message_id) if len(message_id) == 24 else message_id})
        if msg and msg.get("sender_id") != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        await db.messages.update_one(
            {"_id": ObjectId(message_id) if len(message_id) == 24 else message_id},
            {"$set": {"deleted": True, "deleted_at": datetime.utcnow()}}
        )
        
        return {"success": True}
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}

# ============= APPELS (WEBSOCKET READY) =============

@router.post("/calls/initiate")
async def initiate_call(
    recipient_id: str,
    user_id: str,
    call_type: str = "audio"  # audio, video
):
    """Initier un appel (audio ou vidéo)"""
    try:
        db = get_db()
        
        call_doc = {
            "caller_id": user_id,
            "recipient_id": recipient_id,
            "type": call_type,
            "status": "initiated",
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=1)
        }
        
        result = await db.calls.insert_one(call_doc)
        
        return {
            "success": True,
            "call_id": str(result.inserted_id),
            "call_type": call_type,
            "status": "initiated"
        }
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}

@router.put("/calls/{call_id}/accept")
async def accept_call(call_id: str, user_id: str):
    """Accepter un appel"""
    try:
        db = get_db()
        
        await db.calls.update_one(
            {"_id": ObjectId(call_id) if len(call_id) == 24 else call_id},
            {"$set": {"status": "accepted", "accepted_at": datetime.utcnow()}}
        )
        
        return {"success": True, "status": "accepted"}
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}

@router.put("/calls/{call_id}/end")
async def end_call(call_id: str, user_id: str, duration_seconds: int = 0):
    """Terminer un appel"""
    try:
        db = get_db()
        
        await db.calls.update_one(
            {"_id": ObjectId(call_id) if len(call_id) == 24 else call_id},
            {
                "$set": {
                    "status": "ended",
                    "ended_at": datetime.utcnow(),
                    "duration_seconds": duration_seconds
                }
            }
        )
        
        # Notifier d'un appel manqué si la durée est 0 et statut n'était pas accepté
        call = await db.calls.find_one({"_id": ObjectId(call_id) if len(call_id) == 24 else call_id})
        if call and call.get("status") != "accepted" and duration_seconds == 0:
            from routes.notifications import create_notification
            actor = await db.users.find_one({"id": call["caller_id"]})
            await create_notification(
                user_id=call["recipient_id"],
                actor_id=call["caller_id"],
                actor_name=actor.get("full_name", "Un utilisateur") if actor else "Un utilisateur",
                actor_avatar=actor.get("avatar", "") if actor else "",
                notification_type="missed_call",
                content=f"Vous avez manqué un appel {call.get('type', 'audio')}.",
                target_id=call_id
            )
        
        return {"success": True, "status": "ended"}
    except Exception as e:
        msg_logger = get_msg_logger()
        msg_logger.error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}


# ============= MESSAGES VOCAUX (UPLOAD) =============

VOICE_MAX_SIZE = 2 * 1024 * 1024            # 2 MB
VOICE_MAX_DURATION_MS = 120 * 1000          # 120 secondes
VOICE_ALLOWED_MIME = {
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg",
    "audio/ogg;codecs=opus",
    "audio/mpeg",
    "audio/mp4",
}
VOICE_TARGET_BITRATE = 24000
VOICE_TARGET_SAMPLE_RATE = 16000


def _normalize_mime(mt: str) -> str:
    return (mt or "").split(";")[0].strip().lower()


def _ffmpeg_transcode(src_path: str, dst_path: str) -> bool:
    """Tente une normalisation Opus 24kbps/16kHz mono via ffmpeg si dispo."""
    import shutil
    import subprocess
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    try:
        subprocess.run(
            [
                ffmpeg, "-y", "-i", src_path,
                "-c:a", "libopus",
                "-b:a", f"{VOICE_TARGET_BITRATE}",
                "-ac", "1",
                "-ar", f"{VOICE_TARGET_SAMPLE_RATE}",
                dst_path,
            ],
            check=True, capture_output=True, timeout=30,
        )
        return True
    except Exception as e:
        get_msg_logger().warning(f"ffmpeg transcode failed: {e}")
        return False


async def _store_voice_file(conversation_id: str, message_id: str, data: bytes,
                            content_type: str) -> dict:
    """
    Stocke le fichier voix. Tente S3 (clé voice/{conv}/{msg_id}.opus),
    sinon fallback local sur backend/uploads/voice/{conv}/{msg_id}.opus
    accessible via /uploads/voice/...
    Retourne {url, key, storage}.
    """
    import io
    import os
    key = f"voice/{conversation_id}/{message_id}.opus"

    # Tentative S3
    try:
        from storage.s3_storage import S3Storage
        s3 = S3Storage()
        s3.s3.upload_fileobj(
            io.BytesIO(data),
            s3.bucket,
            key,
            ExtraArgs={"ACL": "public-read", "ContentType": content_type or "audio/webm"},
        )
        return {"url": s3._build_url(key), "key": key, "storage": "s3"}
    except Exception as e:
        get_msg_logger().warning(f"S3 upload failed, falling back to local: {e}")

    # Fallback local
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    voice_dir = os.path.join(backend_dir, "uploads", "voice", conversation_id)
    os.makedirs(voice_dir, exist_ok=True)
    local_path = os.path.join(voice_dir, f"{message_id}.opus")
    with open(local_path, "wb") as f:
        f.write(data)
    return {
        "url": f"/uploads/voice/{conversation_id}/{message_id}.opus",
        "key": key,
        "storage": "local",
    }


@router.post("/messages/voice")
async def upload_voice_message(
    file: UploadFile = File(...),
    conversation_id: str = Form(...),
    duration_ms: int = Form(...),
    mime_type: str = Form("audio/webm"),
    bitrate: Optional[int] = Form(None),
    sample_rate: Optional[int] = Form(None),
    sender_id: Optional[str] = Form(None),
    recipient_id: Optional[str] = Form(None),
):
    """
    Upload d'un message vocal.
    - Taille max 2MB, durée max 120s, format webm/ogg/mp3/mp4 audio.
    - Stockage: voice/{conversation_id}/{message_id}.opus (S3 ou local fallback).
    - Si format non conforme et ffmpeg dispo: transcodage Opus 24kbps/16kHz mono.
    """
    msg_logger = get_msg_logger()

    # Validation durée
    if duration_ms <= 0 or duration_ms > VOICE_MAX_DURATION_MS:
        raise HTTPException(
            status_code=400,
            detail=f"Durée invalide (max {VOICE_MAX_DURATION_MS // 1000}s)",
        )

    # Validation MIME
    norm_mime = _normalize_mime(mime_type or file.content_type or "")
    file_norm_mime = _normalize_mime(file.content_type or "")
    if norm_mime not in {_normalize_mime(m) for m in VOICE_ALLOWED_MIME} and \
       file_norm_mime not in {_normalize_mime(m) for m in VOICE_ALLOWED_MIME}:
        raise HTTPException(
            status_code=415,
            detail=f"Format audio non supporté: {mime_type}",
        )

    # Lecture + validation taille
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > VOICE_MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux (max {VOICE_MAX_SIZE // 1024}KB)",
        )

    # Transcodage de normalisation (best-effort) si bitrate/sample_rate non conformes
    needs_transcode = (
        (bitrate is not None and bitrate > VOICE_TARGET_BITRATE * 2) or
        (sample_rate is not None and sample_rate > VOICE_TARGET_SAMPLE_RATE * 2)
    )
    if needs_transcode:
        import os
        import tempfile
        try:
            with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as src:
                src.write(data)
                src_path = src.name
            dst_path = src_path + ".opus"
            if _ffmpeg_transcode(src_path, dst_path):
                with open(dst_path, "rb") as f:
                    data = f.read()
                norm_mime = "audio/webm"
                bitrate = VOICE_TARGET_BITRATE
                sample_rate = VOICE_TARGET_SAMPLE_RATE
            try:
                os.unlink(src_path)
                if os.path.exists(dst_path):
                    os.unlink(dst_path)
            except Exception:
                pass
        except Exception as e:
            msg_logger.warning(f"Voice transcode error (continuing as-is): {e}")

    # Création du document message d'abord pour avoir l'_id
    try:
        db = get_db()
        message_doc = {
            "sender_id": sender_id,
            "recipient_id": recipient_id,
            "conversation_id": conversation_id,
            "type": "voice",
            "audio_format": norm_mime or "audio/webm",
            "audio_bitrate": bitrate,
            "audio_duration": duration_ms,
            "audio_size": len(data),
            "is_encrypted": False,
            "read": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = await db.messages.insert_one(message_doc)
        message_id = str(result.inserted_id)

        # Stockage du fichier
        stored = await _store_voice_file(
            conversation_id, message_id, data, norm_mime or "audio/webm"
        )

        # Mise à jour du message avec l'URL
        await db.messages.update_one(
            {"_id": result.inserted_id},
            {"$set": {"audio_url": stored["url"], "audio_key": stored["key"]}},
        )

        return {
            "success": True,
            "message_id": message_id,
            "audio_url": stored["url"],
            "audio_key": stored["key"],
            "audio_format": norm_mime or "audio/webm",
            "audio_bitrate": bitrate,
            "audio_sample_rate": sample_rate,
            "audio_duration_ms": duration_ms,
            "audio_size": len(data),
            "storage": stored["storage"],
        }
    except HTTPException:
        raise
    except Exception as e:
        msg_logger.error(f"Error uploading voice message: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur upload vocal: {e}")
