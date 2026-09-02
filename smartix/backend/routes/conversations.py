from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from middleware.auth_middleware import get_current_user
from routes.messaging import get_messages # Importation pour cohérence
router = APIRouter(prefix="/api/conversations", tags=["conversations"])

class CreateConversationRequest(BaseModel):
    partner_id: str

class SendMessageRequest(BaseModel):
    recipient_id: str
    content: str
    user_id: str
    message_type: str = "text"

@router.get("")
async def get_conversations(request: Request, current_user: dict = Depends(get_current_user)):
    try:
        from db import get_db
        
        db = get_db()
        
        user_id = current_user.get("id") if current_user else None
        if not user_id:
            return []
            
        pipeline = [
            {"$match": {"participants": user_id, "archived": {"$ne": True}}},
            {"$sort": {"last_message_at": -1}},
            {"$limit": 50}
        ]
        
        conversations = await db.conversations.aggregate(pipeline).to_list(50)
        
        from utils.crypto_service import crypto_service
        result = []
        for conv in conversations:
            partner_id = next((p for p in conv.get("participants", []) if p != user_id), None)
            if partner_id:
                partner = await db.users.find_one({"id": partner_id})
                if partner:
                    last_msg = conv.get("last_message")
                    # Tenter de décrypter si c'est une chaîne
                    if isinstance(last_msg, str):
                        last_msg = crypto_service.decrypt(last_msg)
                        
                    is_online = partner.get("is_online", False)
                    last_seen = partner.get("last_seen")
                    
                    # Correction dynamique pour les profils système
                    if partner.get("is_system"):
                        from utils.system_presence import is_system_user_online, get_simulated_last_seen
                        signature = partner.get("signature_temporelle")
                        if signature:
                            is_online = is_system_user_online(signature)
                            if is_online:
                                last_seen = datetime.utcnow().isoformat()
                            elif not last_seen:
                                last_seen = get_simulated_last_seen(signature)

                    # S'assurer que les champs is_online et last_seen sont toujours présents
                    partner_info = {
                        "id": partner.get("id"),
                        "full_name": partner.get("full_name"),
                        "username": partner.get("username"),
                        "avatar": partner.get("avatar"),
                        "is_online": is_online,
                        "last_seen": last_seen
                    }
                    
                    result.append({
                        "id": conv.get("id"),
                        "partner_id": partner_id,
                        "partner": partner_info,
                        "last_message": last_msg,
                        "last_message_at": conv.get("last_message_at"),
                        "unread_count": conv.get("unread_count", {}).get(user_id, 0)
                    })
        
        return result
    except Exception as e:
        logging.getLogger(__name__).error(f"Error fetching conversations: {e}")
        return []

@router.post("")
async def create_conversation(data: CreateConversationRequest, request: Request, current_user: dict = Depends(get_current_user)):
    try:
        from db import get_db
        
        db = get_db()
        
        user_id = current_user.get("id") if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        partner_id = data.partner_id
        
        # Vérification si amis (Phase 1 Audit Strict)
        friendship = await db.friend_requests.find_one({
            "user_low_id": min(user_id, partner_id),
            "user_high_id": max(user_id, partner_id),
            "status": "accepted"
        })
        
        if not friendship:
            raise HTTPException(status_code=403, detail="Vous devez être amis pour discuter")

        existing = await db.conversations.find_one({
            "participants": {"$all": [user_id, partner_id]}
        })
        
        if existing:
            return {"id": existing.get("id"), "exists": True}
        
        conv_data = {
            "id": str(uuid.uuid4()),
            "participants": [user_id, partner_id],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "archived": False,
            "last_message": None,
            "last_message_at": datetime.now(timezone.utc).isoformat(),
            "unread_count": {user_id: 0, partner_id: 0},
            "messages": []
        }
        await db.conversations.insert_one(conv_data)
        return {"id": conv_data["id"], "exists": False}
    except HTTPException:
        raise
    except Exception as e:
        logging.getLogger(__name__).error(f"Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création")

@router.post("/messages/send")
async def send_message_alt(data: SendMessageRequest, request: Request, current_user: dict = Depends(get_current_user)):
    try:
        from db import get_db
        db = get_db()
        
        # S'assurer que l'ID utilisateur est celui de l'utilisateur connecté pour la sécurité
        user_id = current_user.get("id") if current_user else data.user_id
        
        from utils.crypto_service import crypto_service
        
        message_doc = {
            "id": str(uuid.uuid4()),
            "sender_id": user_id,
            "recipient_id": data.recipient_id,
            "content": crypto_service.encrypt(data.content),
            "type": data.message_type,
            "is_encrypted": True,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.conversations.update_one(
            {"participants": {"$all": [data.user_id, data.recipient_id]}},
            {
                "$push": {"messages": message_doc},
                "$set": {
                    "last_message": crypto_service.encrypt(data.content),
                    "last_message_at": message_doc["created_at"]
                }
            }
        )
        
        await db.messages.insert_one(message_doc)
        
        try:
            from utils.socket_manager import emit_to_user
            await emit_to_user(data.recipient_id, 'new_message', {
                'id': message_doc['id'],
                'sender_id': user_id,
                'content': data.content,
                'created_at': message_doc['created_at']
            })
        except Exception as e:
            logging.getLogger(__name__).error(f"Error emitting websocket message: {e}")
        
        return {
            "success": True,
            "message_id": message_doc["id"],
            "timestamp": message_doc["created_at"]
        }
    except Exception as e:
        logging.getLogger(__name__).error(f"Error sending message: {e}")
        return {"success": False, "error": str(e)}

@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    try:
        from db import get_db
        
        db = get_db()
        
        user_id = current_user.get("id") if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        conv = await db.conversations.find_one({"id": conversation_id})
        if not conv or user_id not in conv.get("participants", []):
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        
        await db.conversations.delete_one({"id": conversation_id})
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.getLogger(__name__).error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression")

@router.post("/{conversation_id}/archive")
async def archive_conversation(conversation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    try:
        from db import get_db
        
        db = get_db()
        
        user_id = current_user.get("id") if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        await db.conversations.update_one(
            {"id": conversation_id, "participants": user_id},
            {"$set": {"archived": True}}
        )
        return {"status": "archived"}
    except Exception as e:
        logging.getLogger(__name__).error(f"Error archiving conversation: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'archivage")

@router.post("/{conversation_id}/restore")
async def restore_conversation(conversation_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    try:
        from db import get_db
        
        db = get_db()
        
        user_id = current_user.get("id") if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Non authentifié")
        
        await db.conversations.update_one(
            {"id": conversation_id, "participants": user_id},
            {"$set": {"archived": False}}
        )
        return {"status": "restored"}
    except Exception as e:
        logging.getLogger(__name__).error(f"Error restoring conversation: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la restauration")
