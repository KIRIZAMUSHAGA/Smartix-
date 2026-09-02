from fastapi import APIRouter, Depends, HTTPException, Query
from db import get_db, get_collection
from middleware.auth_middleware import get_current_user
from bson.objectid import ObjectId
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/favorites", tags=["Favorites"])

class FavoriteCreate(BaseModel):
    content_id: str
    content_type: str  # 'publication', 'exercise', 'discussion', 'author'
    metadata: Optional[dict] = {}

@router.post("/")
async def add_favorite(fav: FavoriteCreate, current_user=Depends(get_current_user)):
    db = get_db()
    collection = db["favorites"]
    
    # Vérifier si déjà en favori
    existing = await collection.find_one({
        "user_id": current_user["id"],
        "content_id": fav.content_id,
        "content_type": fav.content_type
    })
    
    if existing:
        return {"message": "Déjà dans les favoris", "id": str(existing["_id"])}
    
    new_fav = {
        "user_id": current_user["id"],
        "content_id": fav.content_id,
        "content_type": fav.content_type,
        "metadata": fav.metadata,
        "created_at": datetime.utcnow()
    }
    
    result = await collection.insert_one(new_fav)
    return {"message": "Ajouté aux favoris", "id": str(result.inserted_id)}

@router.delete("/{fav_id}")
async def remove_favorite(fav_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    collection = db["favorites"]
    
    result = await collection.delete_one({
        "_id": ObjectId(fav_id),
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favori non trouvé")
        
    return {"message": "Retiré des favoris"}

@router.get("/")
async def get_favorites(
    content_type: Optional[str] = None, 
    current_user=Depends(get_current_user)
):
    db = get_db()
    collection = db["favorites"]
    
    query = {"user_id": current_user["id"]}
    if content_type:
        query["content_type"] = content_type
        
    cursor = collection.find(query).sort("created_at", -1)
    favorites = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        favorites.append(doc)
        
    return favorites
