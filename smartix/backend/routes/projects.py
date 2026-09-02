"""
Routes pour les projets utilisateur
CRUD + opérations spécifiques
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
import uuid

# Dépendances
from middleware.auth_middleware import get_current_user
from db import get_collection

# Modèles
from models.project import Project, PROJECT_STATUS

# Schémas
from schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectOut, 
    ProjectListOut, ProjectStats
)

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.get("/", response_model=ProjectListOut)
async def get_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    type: Optional[str] = None,
    sort: str = "updatedAt",
    current_user: dict = Depends(get_current_user)
):
    """Récupère tous les projets de l'utilisateur"""
    collection = get_collection("projects")
    
    # Filtres
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    # Total
    total = await collection.count_documents(query)
    
    # Pagination
    skip = (page - 1) * limit
    cursor = collection.find(query).sort(sort, -1).skip(skip).limit(limit)
    projects = await cursor.to_list(length=limit)
    
    return {
        "projects": projects,
        "total": total,
        "offset": skip,
        "limit": limit,
        "hasMore": skip + limit < total
    }

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupère un projet par son ID"""
    collection = get_collection("projects")
    project = await collection.find_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    return project

@router.post("/", response_model=ProjectOut, status_code=201)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Crée un nouveau projet"""
    collection = get_collection("projects")
    
    project = Project({
        **project_data.dict(),
        "userId": current_user["id"]
    })
    
    await collection.insert_one(project.to_dict())
    return project.to_dict()

@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    updates: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Met à jour un projet"""
    collection = get_collection("projects")
    
    # Vérifier que le projet existe
    existing = await collection.find_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Mettre à jour
    project = Project.from_dict(existing)
    project.update(updates.dict(exclude_unset=True))
    
    await collection.replace_one({"id": project_id}, project.to_dict())
    return project.to_dict()

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprime un projet"""
    collection = get_collection("projects")
    
    result = await collection.delete_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    return {"success": True}

@router.post("/{project_id}/clone", response_model=ProjectOut)
async def clone_project(
    project_id: str,
    new_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Clone un projet existant"""
    collection = get_collection("projects")
    
    # Récupérer le projet original
    original = await collection.find_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if not original:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Créer une copie
    original.pop("_id", None)
    original["id"] = str(uuid.uuid4())
    original["name"] = new_name or f"{original['name']} (copie)"
    original["createdAt"] = datetime.now()
    original["updatedAt"] = datetime.now()
    
    await collection.insert_one(original)
    return original

@router.post("/{project_id}/archive")
async def archive_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive un projet"""
    collection = get_collection("projects")
    
    result = await collection.update_one(
        {"id": project_id, "userId": current_user["id"]},
        {"$set": {"status": PROJECT_STATUS["ARCHIVED"], "updatedAt": datetime.now()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    return {"success": True}

@router.get("/{project_id}/stats", response_model=ProjectStats)
async def get_project_stats(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupère les statistiques d'un projet"""
    collection = get_collection("projects")
    project = await collection.find_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    files = project.get("files", {})
    totalSize = sum(len(str(content)) for content in files.values())
    totalLines = sum(len(str(content).split("\n")) for content in files.values())
    
    extensions = {}
    for filename in files.keys():
        ext = filename.split(".")[-1] if "." in filename else "unknown"
        extensions[ext] = extensions.get(ext, 0) + 1
    
    return {
        "projectId": project_id,
        "name": project["name"],
        "filesCount": len(files),
        "totalSize": totalSize,
        "totalLines": totalLines,
        "extensions": extensions
    }
