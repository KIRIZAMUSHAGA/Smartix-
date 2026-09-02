"""
WebSocket events configuration for real-time features
To integrate: Install python-socketio and python-engineio
pip install python-socketio python-engineio

Then in server.py:
from socketio import AsyncServer
sio = AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = ASGIApp(app, socketio_listeners=sio.handlers)
"""

# Example namespace handlers structure
WEBSOCKET_EVENTS = {
    "notifications": {
        "notification:new": "Nouvelle notification reçue",
        "notification:read": "Notification marquée comme lue",
        "notification:delete": "Notification supprimée"
    },
    "posts": {
        "post:create": "Nouveau post publié",
        "post:update": "Post mis à jour",
        "post:delete": "Post supprimé"
    },
    "reactions": {
        "reaction:add": "Réaction ajoutée",
        "reaction:remove": "Réaction supprimée",
        "reaction:update": "Compteur de réactions mis à jour"
    },
    "comments": {
        "comment:new": "Nouveau commentaire",
        "comment:edit": "Commentaire modifié",
        "comment:delete": "Commentaire supprimé",
        "comment:reaction": "Réaction sur commentaire"
    },
    "presence": {
        "user:online": "Utilisateur en ligne",
        "user:offline": "Utilisateur hors ligne",
        "user:typing": "Utilisateur en train de taper"
    }
}

# Example event payloads
EXAMPLE_PAYLOADS = {
    "notification:new": {
        "id": "notif_123",
        "type": "reaction",
        "actor": {"id": "user_456", "name": "Jean", "avatar": "url"},
        "content": "Jean a aimé votre post",
        "target_id": "post_789",
        "created_at": "2025-11-26T12:00:00Z"
    },
    "reaction:update": {
        "post_id": "post_789",
        "reactions": {
            "love": 5,
            "haha": 2,
            "wow": 1
        },
        "total": 8
    },
    "comment:new": {
        "post_id": "post_789",
        "comment_id": "comment_123",
        "user": {"id": "user_456", "name": "Jean"},
        "content": "Super publication!",
        "type": "text",
        "created_at": "2025-11-26T12:00:00Z"
    }
}


# Async function template for server.py
"""
@sio.event
async def notification_new(data):
    # Broadcast to user's connected clients
    user_id = data.get('user_id')
    await sio.emit('notification:new', data, room=f"user_{user_id}")

@sio.event
async def reaction_update(data):
    post_id = data.get('post_id')
    await sio.emit('reaction:update', data, room=f"post_{post_id}")

@sio.event
async def user_online(data):
    user_id = data.get('user_id')
    await sio.emit('user:online', {"user_id": user_id}, skip_sid=True)

@sio.event
async def user_offline(data):
    user_id = data.get('user_id')
    await sio.emit('user:offline', {"user_id": user_id}, skip_sid=True)
"""
