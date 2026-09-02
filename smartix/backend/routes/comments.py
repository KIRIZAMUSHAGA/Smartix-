from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid

router = APIRouter(prefix="/api/comments", tags=["comments"])

async def get_db():
    """Placeholder - will be imported from main server"""
    # This is a placeholder. In a real application, you'd initialize and return your database connection here.
    # For example:
    # from app.database import database
    # return database
    raise NotImplementedError("Database connection not implemented")

async def get_current_user():
    """Placeholder - will be imported from auth"""
    # This is a placeholder for user authentication.
    # In a real application, you'd verify the user's token and return user information.
    # For example:
    # from app.auth import get_user
    # return await get_user(token)
    raise NotImplementedError("User authentication not implemented")


class CommentCreate(BaseModel):
    post_id: str
    type: str  # text, audio, video, image, gif, sticker
    content: str
    parent_comment_id: Optional[str] = None

class CommentUpdate(BaseModel):
    content: str
    type: str

class CommentResponse(BaseModel):
    id: str
    post_id: str
    author_id: str
    author_name: str
    author_email: str
    author_avatar: Optional[str] = None
    type: str
    content: str
    created_at: datetime
    updated_at: datetime
    likes: int = 0
    dislikes: int = 0
    reactions: dict = {}
    parent_comment_id: Optional[str] = None
    replies: List[dict] = []

# The original create_comment was a placeholder and is now replaced by add_comment below.
# This function was likely intended to create a comment directly associated with a post,
# but the provided changes indicate a different endpoint and logic.
# The original placeholder function is removed to avoid confusion.

# Placeholder for the original create_comment function, if it was meant to be different from add_comment.
# As the changes provided target a new endpoint and modify the logic for adding comments to posts,
# the original `create_comment` placeholder is removed. If a separate comment creation without post association
# was intended, it would need to be defined.

@router.get("/{post_id}")
async def get_comments(post_id: str):
    """Récupérer les commentaires d'un post"""
    # In a real implementation, you would query the database for comments related to post_id.
    # Example:
    # db: AsyncIOMotorDatabase = await get_db()
    # comments = await db.comments.find({"post_id": post_id}).to_list(length=100)
    # return {"comments": comments, "count": len(comments)}
    return {"comments": [], "count": 0}

@router.delete("/{comment_id}")
async def delete_comment(comment_id: str):
    """Supprimer un commentaire (auteur uniquement)"""
    # In a real implementation, you would delete the comment from the database.
    # Ensure the user making the request is the author of the comment.
    # Example:
    # db: AsyncIOMotorDatabase = await get_db()
    # result = await db.comments.delete_one({"_id": ObjectId(comment_id), "author_id": current_user["_id"]})
    # if result.deleted_count == 0:
    #     raise HTTPException(status_code=404, detail="Comment not found or not authorized")
    # return {"status": "success"}
    return {"status": "success"}

@router.put("/{comment_id}/like")
async def like_comment(comment_id: str):
    """Liker un commentaire"""
    # In a real implementation, you would update the like count for the comment.
    # Example:
    # db: AsyncIOMotorDatabase = await get_db()
    # result = await db.comments.update_one(
    #     {"_id": ObjectId(comment_id)},
    #     {"$inc": {"likes": 1}}
    # )
    # if result.modified_count == 0:
    #     raise HTTPException(status_code=404, detail="Comment not found")
    # return {"status": "success"}
    return {"status": "success"}

@router.put("/{comment_id}/reaction")
async def add_reaction(comment_id: str, reaction: dict = None):
    """Ajouter une réaction à un commentaire"""
    # In a real implementation, you would add or update reactions for the comment.
    # Example:
    # db: AsyncIOMotorDatabase = await get_db()
    # update_data = {f"reactions.{reaction['type']}": 1} # Example, actual logic may vary
    # result = await db.comments.update_one(
    #     {"_id": ObjectId(comment_id)},
    #     {"$inc": update_data}
    # )
    # if result.modified_count == 0:
    #     raise HTTPException(status_code=404, detail="Comment not found")
    # return {"status": "success"}
    return {"status": "success"}

# Endpoint for adding a comment to a post, utilizing atomic $push and updating comment count.
@router.post("/{post_id}/comments")
async def add_comment(
    post_id: str,
    comment: dict, # Expecting a dict with a 'text' field based on comment_data structure
    current_user: dict = Depends(get_current_user)
):
    """Ajouter un commentaire à un post en utilisant $push atomique"""
    try:
        # Ensure post_id is a valid ObjectId string if your MongoDB uses ObjectIds for _id
        # If not, adjust this part accordingly.
        post_object_id = ObjectId(post_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID format")

    try:
        comment_data = {
            "id": str(uuid.uuid4()), # Use UUID for comment ID
            "user_id": current_user["_id"],
            "username": current_user.get("username", "Unknown"),
            "avatar": current_user.get("avatar"),
            "text": comment.get("text", ""), # Safely get text, default to empty string
            "created_at": datetime.utcnow(), # Store as datetime object
            "likes": 0,
            "replies": []
        }

        db: AsyncIOMotorDatabase = await get_db()
        # Use atomic $push with $inc to update comment count
        result = await db.posts.update_one(
            {"_id": post_object_id},
            {
                "$push": {"comments": comment_data},
                "$inc": {"comments_count": 1}
            }
        )

        if result.modified_count == 0:
            # Check if the post exists but has no comments array yet, or if it doesn't exist at all.
            post_check = await db.posts.find_one({"_id": post_object_id})
            if not post_check:
                raise HTTPException(status_code=404, detail="Post not found")
            else:
                # If post exists but update failed, it might mean the comments array was not initialized.
                # Re-attempt with $setOnInsert for comments array if needed, or handle as an error.
                # For simplicity, we'll assume the post document structure is managed elsewhere.
                raise HTTPException(status_code=500, detail="Failed to add comment")


        # Get updated comment count for the response
        post = await db.posts.find_one({"_id": post_object_id}, {"comments_count": 1})
        comment_data["total_comments"] = post.get("comments_count", 1)
        # Convert datetime to ISO format for JSON serialization if needed, or handle in Pydantic model
        comment_data["created_at"] = comment_data["created_at"].isoformat()
        # Ensure 'id' is a string for the response
        comment_data["id"] = str(comment_data["id"])


        return {"success": True, "comment": comment_data}
    except HTTPException as e:
        raise e # Re-raise HTTPException to preserve status code and detail
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))