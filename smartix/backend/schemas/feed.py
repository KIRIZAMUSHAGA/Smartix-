from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class PostThumbnail(BaseModel):
    id: str
    user_id: str
    username: str
    avatar_thumbnail: Optional[str] = None
    content_preview: str
    image_thumbnail: Optional[str] = None
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime

class FeedResponse(BaseModel):
    posts: List[PostThumbnail]
    next_cursor_created_at: Optional[datetime] = None
    next_cursor_id: Optional[str] = None
    limit: int
