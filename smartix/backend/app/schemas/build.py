"""
Schémas Pydantic pour les builds et la prévisualisation
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class BuildStart(BaseModel):
    projectId: str
    type: str = "production"  # development, production, analyze
    target: str = "web"  # web, android, ios, windows, macos, linux
    minify: bool = True
    sourceMaps: bool = False

class BuildOut(BaseModel):
    id: str
    projectId: str
    userId: str
    status: str  # pending, building, success, failed, cancelled
    progress: int
    errors: List[str] = []
    warnings: List[str] = []
    startTime: datetime
    endTime: Optional[datetime] = None
    duration: Optional[int] = None  # milliseconds
    output: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}

class BuildLog(BaseModel):
    level: str  # info, warning, error, success, build
    message: str
    timestamp: datetime

class BuildListOut(BaseModel):
    builds: List[BuildOut]
    total: int
    offset: int
    limit: int
    hasMore: bool

class PreviewStart(BaseModel):
    projectId: str
    port: Optional[int] = 3000

class PreviewStatus(BaseModel):
    projectId: str
    state: str  # stopped, starting, running, error, building
    url: Optional[str] = None
    port: Optional[int] = None
    wsPort: Optional[int] = None
    isHealthy: bool = False
