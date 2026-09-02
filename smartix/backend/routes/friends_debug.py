
from fastapi import APIRouter, Depends
from typing import List
from middleware.auth_middleware import get_current_user
from db import get_db

router = APIRouter(prefix="/api/friends/all-accepted", tags=["friends"])

from routes.friends import get_raw_accepted_friends

@router.get("")
async def get_all_accepted_friends(current_user: dict = Depends(get_current_user)):
    """
    Récupère TOUTES les relations acceptées du système pour l'utilisateur actuel.
    Utilise le NOYAU LOGIQUE (Source de Vérité).
    """
    db = get_db()
    my_id = str(current_user["id"])
    
    accepted_ids = await get_raw_accepted_friends(my_id)
    
    friends_docs = await db.users.find({"id": {"$in": list(accepted_ids)}}).to_list(None)
    
    friends_list = []
    for doc in friends_docs:
        friends_list.append({
            "id": doc.get("id"),
            "username": doc.get("username"),
            "full_name": doc.get("full_name"),
            "avatar": doc.get("avatar"),
            "email": doc.get("email"),
            "source": "friend_requests (nucleus)"
        })
            
    return friends_list
