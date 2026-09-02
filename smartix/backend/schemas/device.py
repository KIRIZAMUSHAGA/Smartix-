"""
Schémas Pydantic pour les appareils
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DeviceInfo(BaseModel):
    deviceId: Optional[str] = None
    platform: Optional[str] = None
    version: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    userAgent: Optional[str] = None
    screen: Optional[str] = None
    metadata: Dict[str, Any] = {}

class DeviceOut(BaseModel):
    id: str
    userId: str
    clientId: Optional[str] = None
    sessionId: Optional[str] = None
    platform: str
    version: str
    model: str
    manufacturer: str
    status: str
    blocked: bool
    blockReason: Optional[str] = None
    blockedAt: Optional[datetime] = None
    connections: int
    totalTime: int
    firstSeen: datetime
    lastSeen: datetime
    metadata: Dict[str, Any] = {}
    isActive: Optional[bool] = None

    model_config = {"from_attributes": True}

class DeviceListOut(BaseModel):
    devices: List[DeviceOut]
    total: int
    offset: int
    limit: int
    hasMore: bool
    connected: int
    active: int

class DeviceStats(BaseModel):
    totalDevices: int
    connected: int
    active: int
    byPlatform: Dict[str, int]
    byModel: Dict[str, int]
    timestamp: datetime

class BlockDevice(BaseModel):
    reason: str = "manual"
    duration: Optional[int] = None  # seconds

class DeviceLog(BaseModel):
    level: str  # info, warning, error
    message: str
    timestamp: datetime
    metadata: Dict[str, Any] = {}
