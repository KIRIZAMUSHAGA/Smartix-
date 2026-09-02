"""
Schémas Pydantic pour les uploads
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class UploadStart(BaseModel):
    filename: str
    fileSize: int
    mimeType: Optional[str] = None
    bucket: str = "default"
    category: str = "general"
    public: bool = False
    metadata: Dict[str, Any] = {}

class UploadChunk(BaseModel):
    uploadId: str
    chunkIndex: int
    totalChunks: int

class UploadComplete(BaseModel):
    uploadId: str
    bucket: str = "default"
    category: str = "general"
    public: bool = False
    metadata: Dict[str, Any] = {}

class UploadOut(BaseModel):
    id: str
    userId: str
    filename: str
    storedFilename: Optional[str] = None
    fileSize: int
    mimeType: Optional[str] = None
    bucket: str
    category: str
    public: bool
    status: str
    progress: int
    uploadedBytes: int
    totalChunks: int
    checksum: Optional[str] = None
    metadata: Dict[str, Any] = {}
    createdAt: datetime
    completedAt: Optional[datetime] = None
    duration: Optional[int] = None

    model_config = {"from_attributes": True}

class UploadListOut(BaseModel):
    uploads: List[UploadOut]
    total: int
    offset: int
    limit: int
    hasMore: bool

class UploadProgress(BaseModel):
    uploadId: str
    progress: int
    uploadedBytes: int
    totalBytes: int
    status: str
    speed: Optional[float] = None  # bytes per second
    eta: Optional[int] = None  # seconds remaining
