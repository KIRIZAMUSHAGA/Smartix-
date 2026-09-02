"""
Schémas Pydantic pour les builds
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class BuildStart(BaseModel):
    type: str = "production"
    target: str = "web"
    minify: bool = True
    sourceMaps: bool = False

class BuildOut(BaseModel):
    id: str
    projectId: str
    userId: str
    status: str
    progress: int
    errors: List[str] = []
    warnings: List[str] = []
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    duration: Optional[int] = None
    output: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}

class BuildListOut(BaseModel):
    builds: List[BuildOut]
    total: int
    offset: int
    limit: int
    hasMore: bool

class BuildLog(BaseModel):
    level: str
    message: str
    timestamp: datetime

class PreviewStatus(BaseModel):
    projectId: str
    status: str
    url: Optional[str] = None
    port: Optional[int] = None
    startedAt: Optional[datetime] = None
    error: Optional[str] = None
    logs: List[str] = []
