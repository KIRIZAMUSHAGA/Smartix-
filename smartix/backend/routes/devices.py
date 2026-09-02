"""
Routes pour la gestion des appareils connectés
- Liste des appareils
- Blocage / déblocage
- Statistiques
- Historique des connexions
"""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid
import asyncio

from middleware.auth_middleware import get_current_user, get_current_user_optional
from db import get_collection

router = APIRouter(prefix="/api/devices", tags=["Devices"])

# =============================
# CONFIGURATION
# =============================

DEVICE_TIMEOUT = 300  # 5 minutes sans ping
MAX_DEVICES_PER_USER = 100
ACTIVE_THRESHOLD = 60  # 1 minute

# =============================
# MODÈLES
# =============================

class DeviceInfo:
    """Informations sur un appareil"""
    def __init__(self, device_id, user_id, device_data):
        self.id = device_id
        self.user_id = user_id
        self.platform = device_data.get("platform", "unknown")
        self.version = device_data.get("version", "unknown")
        self.model = device_data.get("model", "unknown")
        self.manufacturer = device_data.get("manufacturer", "unknown")
        self.user_agent = device_data.get("user_agent", "")
        self.ip = device_data.get("ip", "")
        self.first_seen = datetime.now()
        self.last_seen = datetime.now()
        self.status = "connected"
        self.blocked = False
        self.connections = 1
        self.sessions = []
        self.metadata = device_data.get("metadata", {})

# Stockage temporaire des appareils connectés (en production, utiliser Redis)
active_devices = {}  # device_id -> DeviceInfo
user_devices = {}    # user_id -> set(device_ids)
device_sessions = {} # session_id -> device_id

# =============================
# WEBSOCKET POUR CONNEXIONS TEMPS RÉEL
# =============================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.device_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, device_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.device_connections[device_id] = websocket

    def disconnect(self, websocket: WebSocket, device_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if device_id in self.device_connections:
            del self.device_connections[device_id]

    async def send_to_device(self, device_id: str, message: dict):
        if device_id in self.device_connections:
            try:
                await self.device_connections[device_id].send_json(message)
                return True
            except:
                return False
        return False

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# =============================
# WEBSOCKET ENDPOINT
# =============================

@router.websocket("/ws")
async def websocket_device(websocket: WebSocket):
    """WebSocket pour les connexions d'appareils"""
    device_id = None
    
    try:
        # Attendre le message d'identification
        data = await websocket.receive_json()
        device_id = data.get("device_id")
        user_id = data.get("user_id")
        
        if not device_id:
            await websocket.close(code=1008, reason="device_id requis")
            return
        
        # Enregistrer la connexion
        await manager.connect(websocket, device_id)
        
        # Mettre à jour le statut de l'appareil
        if device_id in active_devices:
            device = active_devices[device_id]
            device.last_seen = datetime.now()
            device.status = "connected"
        else:
            # Nouvel appareil
            device = DeviceInfo(
                device_id=device_id,
                user_id=user_id,
                device_data=data.get("device", {})
            )
            active_devices[device_id] = device
            
            if user_id:
                if user_id not in user_devices:
                    user_devices[user_id] = set()
                user_devices[user_id].add(device_id)
        
        # Confirmer la connexion
        await websocket.send_json({
            "type": "connected",
            "device_id": device_id,
            "timestamp": datetime.now().isoformat()
        })
        
        # Boucle principale pour les messages
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                # Mettre à jour le timestamp
                if device_id in active_devices:
                    active_devices[device_id].last_seen = datetime.now()
                
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
            
            elif data.get("type") == "update":
                # Mettre à jour les infos de l'appareil
                if device_id in active_devices:
                    device = active_devices[device_id]
                    device.metadata.update(data.get("metadata", {}))
                
            elif data.get("type") == "log":
                # Enregistrer un log de l'appareil
                logs_col = get_collection("device_logs")
                await logs_col.insert_one({
                    "device_id": device_id,
                    "user_id": user_id,
                    "level": data.get("level", "info"),
                    "message": data.get("message"),
                    "timestamp": datetime.now()
                })
    
    except WebSocketDisconnect:
        # Déconnexion
        if device_id:
            manager.disconnect(websocket, device_id)
            
            if device_id in active_devices:
                active_devices[device_id].status = "disconnected"
                active_devices[device_id].last_seen = datetime.now()
    
    except Exception as e:
        print(f"Erreur WebSocket: {e}")
        if device_id:
            manager.disconnect(websocket, device_id)

# =============================
# ROUTES REST
# =============================

@router.get("/")
async def list_devices(
    status: Optional[str] = Query(None, regex="^(connected|disconnected|all)$"),
    platform: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user)
):
    """
    Liste tous les appareils de l'utilisateur
    """
    devices_list = []
    
    # Récupérer les IDs des appareils de l'utilisateur
    device_ids = user_devices.get(current_user["id"], set())
    
    for device_id in device_ids:
        if device_id in active_devices:
            device = active_devices[device_id]
            
            # Appliquer les filtres
            if status and status != "all":
                if status == "connected" and device.status != "connected":
                    continue
                if status == "disconnected" and device.status != "disconnected":
                    continue
            
            if platform and device.platform != platform:
                continue
            
            devices_list.append({
                "id": device.id,
                "platform": device.platform,
                "version": device.version,
                "model": device.model,
                "manufacturer": device.manufacturer,
                "status": device.status,
                "first_seen": device.first_seen.isoformat(),
                "last_seen": device.last_seen.isoformat(),
                "connections": device.connections,
                "blocked": device.blocked,
                "metadata": device.metadata,
                "is_active": (datetime.now() - device.last_seen).total_seconds() < ACTIVE_THRESHOLD
            })
    
    # Ajouter les appareils de la base de données (historique)
    devices_col = get_collection("devices")
    cursor = devices_col.find({"user_id": current_user["id"]})
    historical_devices = await cursor.to_list(length=1000)
    
    # Fusionner avec les appareils actifs
    existing_ids = {d["id"] for d in devices_list}
    
    for dev in historical_devices:
        if dev["id"] not in existing_ids:
            devices_list.append({
                "id": dev["id"],
                "platform": dev.get("platform", "unknown"),
                "version": dev.get("version", "unknown"),
                "model": dev.get("model", "unknown"),
                "manufacturer": dev.get("manufacturer", "unknown"),
                "status": "offline",
                "first_seen": dev.get("first_seen").isoformat() if dev.get("first_seen") else None,
                "last_seen": dev.get("last_seen").isoformat() if dev.get("last_seen") else None,
                "connections": dev.get("connections", 0),
                "blocked": dev.get("blocked", False),
                "metadata": dev.get("metadata", {}),
                "is_active": False
            })
    
    # Trier par date de dernière connexion
    devices_list.sort(key=lambda x: x["last_seen"] or "", reverse=True)
    
    # Paginer
    total = len(devices_list)
    paginated = devices_list[offset:offset + limit]
    
    return {
        "devices": paginated,
        "total": total,
        "offset": offset,
        "limit": limit,
        "connected": sum(1 for d in devices_list if d["status"] == "connected"),
        "active": sum(1 for d in devices_list if d.get("is_active"))
    }

@router.get("/{device_id}")
async def get_device(
    device_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les informations détaillées d'un appareil
    """
    # Vérifier que l'appareil appartient à l'utilisateur
    if device_id not in active_devices:
        # Chercher dans la base de données
        devices_col = get_collection("devices")
        device_doc = await devices_col.find_one({
            "id": device_id,
            "user_id": current_user["id"]
        })
        
        if not device_doc:
            raise HTTPException(status_code=404, detail="Appareil non trouvé")
        
        return {
            "id": device_doc["id"],
            "platform": device_doc.get("platform"),
            "version": device_doc.get("version"),
            "model": device_doc.get("model"),
            "manufacturer": device_doc.get("manufacturer"),
            "status": "offline",
            "first_seen": device_doc.get("first_seen").isoformat(),
            "last_seen": device_doc.get("last_seen").isoformat(),
            "connections": device_doc.get("connections", 0),
            "blocked": device_doc.get("blocked", False),
            "metadata": device_doc.get("metadata", {}),
            "history": await get_device_history(device_id)
        }
    
    # Appareil actif
    device = active_devices[device_id]
    
    # Vérifier que l'utilisateur est le propriétaire
    if device.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    return {
        "id": device.id,
        "platform": device.platform,
        "version": device.version,
        "model": device.model,
        "manufacturer": device.manufacturer,
        "user_agent": device.user_agent,
        "ip": device.ip,
        "status": device.status,
        "first_seen": device.first_seen.isoformat(),
        "last_seen": device.last_seen.isoformat(),
        "connections": device.connections,
        "blocked": device.blocked,
        "metadata": device.metadata,
        "is_active": (datetime.now() - device.last_seen).total_seconds() < ACTIVE_THRESHOLD
    }

@router.post("/{device_id}/block")
async def block_device(
    device_id: str,
    reason: str = Body("manual"),
    duration: Optional[int] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Bloque un appareil
    """
    # Vérifier que l'appareil appartient à l'utilisateur
    if device_id in active_devices:
        device = active_devices[device_id]
        if device.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Non autorisé")
        device.blocked = True
    else:
        # Marquer comme bloqué en base
        devices_col = get_collection("devices")
        await devices_col.update_one(
            {"id": device_id, "user_id": current_user["id"]},
            {"$set": {"blocked": True}}
        )
    
    # Enregistrer le blocage
    blocks_col = get_collection("device_blocks")
    await blocks_col.insert_one({
        "device_id": device_id,
        "user_id": current_user["id"],
        "reason": reason,
        "duration": duration,
        "blocked_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(seconds=duration) if duration else None
    })
    
    # Déconnecter l'appareil si actif
    if device_id in manager.device_connections:
        await manager.send_to_device(device_id, {
            "type": "blocked",
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        })
        # La déconnexion effective se fera via WebSocket
    
    return {
        "success": True,
        "device_id": device_id,
        "blocked": True,
        "reason": reason,
        "expires_at": (datetime.now() + timedelta(seconds=duration)).isoformat() if duration else None
    }

@router.post("/{device_id}/unblock")
async def unblock_device(
    device_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Débloque un appareil
    """
    # Vérifier que l'appareil appartient à l'utilisateur
    if device_id in active_devices:
        device = active_devices[device_id]
        if device.user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Non autorisé")
        device.blocked = False
    else:
        # Débloquer en base
        devices_col = get_collection("devices")
        await devices_col.update_one(
            {"id": device_id, "user_id": current_user["id"]},
            {"$set": {"blocked": False}}
        )
    
    return {
        "success": True,
        "device_id": device_id,
        "blocked": False
    }

@router.post("/{device_id}/disconnect")
async def disconnect_device(
    device_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Déconnecte un appareil manuellement
    """
    if device_id in manager.device_connections:
        await manager.send_to_device(device_id, {
            "type": "disconnect",
            "reason": "user_requested",
            "timestamp": datetime.now().isoformat()
        })
        return {"success": True}
    
    raise HTTPException(status_code=404, detail="Appareil non connecté")

@router.get("/{device_id}/logs")
async def get_device_logs(
    device_id: str,
    limit: int = Query(100, le=500),
    level: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Récupère les logs d'un appareil
    """
    logs_col = get_collection("device_logs")
    
    query = {"device_id": device_id}
    if level:
        query["level"] = level
    
    cursor = logs_col.find(query).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    for log in logs:
        log.pop("_id", None)
    
    return {"logs": logs}

# =============================
# STATISTIQUES
# =============================

@router.get("/stats/global")
async def get_global_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Statistiques globales des appareils
    """
    device_ids = user_devices.get(current_user["id"], set())
    
    total_connected = 0
    total_active = 0
    by_platform = {}
    by_model = {}
    
    for device_id in device_ids:
        if device_id in active_devices:
            device = active_devices[device_id]
            
            if device.status == "connected":
                total_connected += 1
            
            if (datetime.now() - device.last_seen).total_seconds() < ACTIVE_THRESHOLD:
                total_active += 1
            
            by_platform[device.platform] = by_platform.get(device.platform, 0) + 1
            by_model[device.model] = by_model.get(device.model, 0) + 1
    
    return {
        "total_devices": len(device_ids),
        "connected": total_connected,
        "active": total_active,
        "by_platform": by_platform,
        "by_model": by_model,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/stats/{device_id}")
async def get_device_stats(
    device_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Statistiques détaillées pour un appareil
    """
    # Récupérer l'historique des connexions
    logs_col = get_collection("device_logs")
    
    # Nombre de logs par jour
    pipeline = [
        {"$match": {"device_id": device_id}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 30}
    ]
    
    cursor = logs_col.aggregate(pipeline)
    logs_by_day = await cursor.to_list(length=30)
    
    # Durée de connexion moyenne
    sessions_col = get_collection("device_sessions")
    pipeline_sessions = [
        {"$match": {"device_id": device_id, "duration": {"$exists": True}}},
        {"$group": {
            "_id": None,
            "avg_duration": {"$avg": "$duration"},
            "total_sessions": {"$sum": 1},
            "total_duration": {"$sum": "$duration"}
        }}
    ]
    
    cursor = sessions_col.aggregate(pipeline_sessions)
    session_stats = await cursor.to_list(length=1)
    
    return {
        "logs_by_day": logs_by_day,
        "session_stats": session_stats[0] if session_stats else {
            "avg_duration": 0,
            "total_sessions": 0,
            "total_duration": 0
        }
    }

# =============================
# FONCTIONS INTERNES
# =============================

async def get_device_history(device_id: str, limit: int = 10):
    """Récupère l'historique des connexions d'un appareil"""
    sessions_col = get_collection("device_sessions")
    cursor = sessions_col.find({"device_id": device_id}).sort("started_at", -1).limit(limit)
    sessions = await cursor.to_list(length=limit)
    
    history = []
    for session in sessions:
        history.append({
            "started_at": session.get("started_at").isoformat() if session.get("started_at") else None,
            "ended_at": session.get("ended_at").isoformat() if session.get("ended_at") else None,
            "duration": session.get("duration"),
            "ip": session.get("ip"),
            "location": session.get("location")
        })
    
    return history

async def cleanup_inactive_devices():
    """
    Nettoie les appareils inactifs (à appeler périodiquement)
    """
    now = datetime.now()
    cleaned = 0
    
    for device_id, device in list(active_devices.items()):
        if (now - device.last_seen).total_seconds() > DEVICE_TIMEOUT:
            device.status = "timeout"
            
            # Sauvegarder dans la base de données
            devices_col = get_collection("devices")
            await devices_col.update_one(
                {"id": device_id},
                {"$set": {
                    "last_seen": device.last_seen,
                    "connections": device.connections,
                    "metadata": device.metadata
                }},
                upsert=True
            )
            
            # Supprimer des structures actives
            del active_devices[device_id]
            if device.user_id and device.user_id in user_devices:
                user_devices[device.user_id].discard(device_id)
            
            cleaned += 1
    
    return cleaned
