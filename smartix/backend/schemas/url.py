"""
Schémas Pydantic pour les URLs
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DownloadUrlCreate(BaseModel):
    fileId: str
    filename: Optional[str] = None
    expiresIn: int = 86400  # 24 hours
    singleUse: bool = False

class PreviewUrlCreate(BaseModel):
    projectId: str
    sessionId: Optional[str] = None
    expiresIn: int = 3600  # 1 hour

class ShareUrlCreate(BaseModel):
    content: str
    expiresIn: int = 604800  # 7 days
    password: Optional[str] = None
    maxUses: Optional[int] = None

class UrlOut(BaseModel):
    urlId: str
    url: str
    token: str
    signature: Optional[str] = None
    shortUrl: Optional[str] = None
    expiresAt: int
    expiresIn: int
    singleUse: bool = False
    hasPassword: bool = False
    maxUses: Optional[int] = None

class UrlAccess(BaseModel):
    type: str  # download, preview, share
    fileId: Optional[str] = None
    projectId: Optional[str] = None
    sessionId: Optional[str] = None
    content: Optional[str] = None
    expiresAt: int
    needsPassword: bool = False

class UrlVerify(BaseModel):
    valid: bool
    type: Optional[str] = None
    expiresAt: Optional[int] = None
    payload: Dict[str, Any] = {}

class UrlListOut(BaseModel):
    urls: List[Dict[str, Any]]
    total: int
    offset: int
    limit: int
