"""
Schémas Pydantic pour les projets utilisateur
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str
    files: Optional[Dict[str, Any]] = {}
    config: Optional[Dict[str, Any]] = {}
    tags: Optional[List[str]] = []

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    files: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

class ProjectOut(ProjectBase):
    id: str
    userId: str
    status: str
    createdAt: datetime
    updatedAt: datetime
    metadata: Optional[Dict[str, Any]] = {}

    model_config = {"from_attributes": True}

class ProjectStats(BaseModel):
    projectId: str
    name: str
    filesCount: int
    totalSize: int
    totalLines: int
    extensions: Dict[str, int]

class ProjectListOut(BaseModel):
    projects: List[ProjectOut]
    total: int
    offset: int
    limit: int
    hasMore: bool
