import socketio
import logging
from datetime import datetime, timezone
import re

logger = logging.getLogger(__name__)

# Création de l'instance Socket.io asynchrone
# cors_allowed_origins="*" est nécessaire pour le développement sur Replit
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio_app = socketio.ASGIApp(sio)

# Dictionnaire pour mapper user_id -> sid (socket id)
user_sessions = {}

async def emit_to_user(user_id, event, data):
    """
    Diffuse un événement à un utilisateur spécifique.
    """
    sid = user_sessions.get(user_id)
    if sid:
        await sio.emit(event, data, room=sid)
        return True
    return False

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connected: {sid}")

@sio.event
async def authenticate(sid, data):
    """
    Événement d'authentification envoyé par le client après la connexion.
    data doit contenir le user_id.
    """
    user_id = data.get('user_id')
    if user_id:
        user_sessions[user_id] = sid
        await sio.save_session(sid, {'user_id': user_id})
        logger.info(f"User {user_id} authenticated with sid {sid}")
        
        # Synchronisation MongoDB - Online
        try:
            from db import get_collection
            users_col = get_collection('users')
            # Forcer is_online à True et s'assurer que last_seen est géré
            await users_col.update_one(
                {"id": user_id},
                {"$set": {"is_online": True, "last_seen": None}}
            )
            logger.info(f"User {user_id} marked online in DB")
        except Exception as e:
            logger.error(f"Error updating DB for user {user_id} (online): {e}")

        await sio.emit('authenticated', {'status': 'success'}, room=sid)
        
        # Envoi de l'état initial
        await sio.emit('presence:init', {
            'user_id': user_id,
            'is_online': True,
            'last_seen': None
        }, room=sid)
        
        # Diffusion du statut "En ligne"
        await sio.emit('user_status_change', {
            'user_id': user_id, 
            'status': 'online',
            'is_online': True,
            'last_seen': None
        })
        
        # DIFFUSION AUX AMIS (OPTIONNEL MAIS RECOMMANDÉ)
        # On pourrait ici récupérer la liste d'amis et leur envoyer spécifiquement
        # mais la diffusion globale est gérée par le client qui filtre.
    else:
        await sio.emit('authenticated', {'status': 'error', 'message': 'Missing user_id'}, room=sid)

@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: {sid}")
    # Nettoyage du dictionnaire user_sessions
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    
    if user_id:
        if user_id in user_sessions:
            del user_sessions[user_id]
        logger.info(f"User {user_id} session removed")
        
        last_seen = datetime.now(timezone.utc).isoformat()
        
        # Synchronisation MongoDB - Offline
        try:
            from db import get_collection
            users_col = get_collection('users')
            await users_col.update_one(
                {"id": user_id},
                {"$set": {"is_online": False, "last_seen": last_seen}}
            )
            logger.info(f"User {user_id} marked offline in DB with last_seen: {last_seen}")
        except Exception as e:
            logger.error(f"Error updating DB for user {user_id} (offline): {e}")

        # Diffusion du statut "Hors ligne"
        await sio.emit('user_status_change', {
            'user_id': user_id, 
            'status': 'offline',
            'is_online': False,
            'last_seen': last_seen
        })

# =============================
# B4 — ROOM COMMUNAUTÉ
# =============================
@sio.event
async def join_community_room(sid, data):
    """
    Le client rejoint la room communauté pour recevoir les mises à jour en temps réel.
    """
    await sio.enter_room(sid, 'community')
    await sio.emit('community:joined', {'status': 'success'}, room=sid)
    logger.info(f"Socket {sid} joined community room")

@sio.event
async def send_message(sid, data):
    """
    Événement pour envoyer un message et détecter les liens pour l'aperçu.
    """
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    recipient_id = data.get('recipient_id')
    content = data.get('content', '')
    
    if user_id and recipient_id and content:
        # Détection basique de lien
        url_match = re.search(r'https?://[^\s]+', content)
        link_preview = None
        if url_match:
            url = url_match.group(0)
            link_preview = {
                "url": url,
                "title": "Aperçu du lien",
                "description": url,
                "image": None
            }

        await emit_to_user(recipient_id, 'new_message', {
            'sender_id': user_id,
            'content': content,
            'type': 'text',
            'link_preview': link_preview,
            'created_at': datetime.now(timezone.utc).isoformat()
        })

@sio.event
async def mark_read(sid, data):
    """
    Marquer un message comme lu et notifier l'expéditeur.
    data doit contenir 'message_id' et 'sender_id' (l'expéditeur original).
    """
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    message_id = data.get('message_id')
    sender_id = data.get('sender_id') # L'utilisateur qui a envoyé le message original

    if user_id and message_id and sender_id:
        try:
            from db import get_collection
            conv_col = get_collection('conversations')
            msg_col = get_collection('messages')
            now = datetime.now(timezone.utc)

            # Mise à jour dans la collection conversations (messages embed)
            await conv_col.update_one(
                {"messages.id": message_id},
                {"$set": {
                    "messages.$[msg].read": True,
                    "messages.$[msg].read_at": now
                }},
                array_filters=[{"msg.id": message_id}]
            )

            # Mise à jour dans la collection messages (si séparée)
            await msg_col.update_one(
                {"id": message_id},
                {"$set": {"read": True, "read_at": now}}
            )

            # Notification de l'expéditeur original
            await emit_to_user(sender_id, 'message_read', {
                'message_id': message_id,
                'reader_id': user_id,
                'read_at': now.isoformat()
            })
            logger.info(f"Message {message_id} marked read by {user_id}, notified {sender_id}")
        except Exception as e:
            logger.error(f"Error marking message {message_id} as read: {e}")
