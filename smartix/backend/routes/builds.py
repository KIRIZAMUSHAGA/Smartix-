"""
Routes pour les builds et la prévisualisation
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Body
from typing import Optional
import asyncio
import uuid
from datetime import datetime  # ← AJOUT IMPORTANT

from middleware.auth_middleware import get_current_user
from db import get_collection

from models.build import Build, BUILD_STATUS
from schemas.build import BuildStart, BuildOut, BuildListOut, PreviewStatus
from services.build_runner import build_runner

router = APIRouter(prefix="/api/builds", tags=["Builds"])

# Stockage temporaire des previews en mémoire
active_previews = {}

# =============================
# BUILDS
# =============================

@router.post("/project/{project_id}", response_model=BuildOut)
async def start_build(
    project_id: str,
    build_data: BuildStart,
    current_user: dict = Depends(get_current_user)
):
    """Démarre un build pour un projet"""
    builds_col = get_collection("builds")
    projects_col = get_collection("projects")
    
    # Vérifier que le projet existe
    project = await projects_col.find_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Créer le build
    build = Build({
        "projectId": project_id,
        "userId": current_user["id"],
        "type": build_data.type,
        "target": build_data.target
    })
    
    await builds_col.insert_one(build.to_dict())
    
    # Lancer le build réel en arrière-plan
    asyncio.create_task(_run_real_build(build.id, project))
    
    return build.to_dict()

@router.get("/{build_id}", response_model=BuildOut)
async def get_build(
    build_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupère un build par son ID"""
    builds_col = get_collection("builds")
    build = await builds_col.find_one({
        "id": build_id,
        "userId": current_user["id"]
    })
    
    if not build:
        raise HTTPException(status_code=404, detail="Build non trouvé")
    
    return build

@router.get("/project/{project_id}", response_model=BuildListOut)
async def list_builds(
    project_id: str,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Liste les builds d'un projet"""
    builds_col = get_collection("builds")
    
    query = {
        "projectId": project_id,
        "userId": current_user["id"]
    }
    
    total = await builds_col.count_documents(query)
    skip = (page - 1) * limit
    
    cursor = builds_col.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    builds = await cursor.to_list(length=limit)
    
    return {
        "builds": builds,
        "total": total,
        "offset": skip,
        "limit": limit,
        "hasMore": skip + limit < total
    }

@router.post("/{build_id}/cancel")
async def cancel_build(
    build_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Annule un build en cours"""
    builds_col = get_collection("builds")
    
    build = await builds_col.find_one({
        "id": build_id,
        "userId": current_user["id"]
    })
    
    if not build:
        raise HTTPException(status_code=404, detail="Build non trouvé")
    
    if build["status"] not in ["pending", "building"]:
        raise HTTPException(status_code=400, detail="Ce build ne peut pas être annulé")
    
    build_obj = Build.from_dict(build)
    build_obj.cancel()
    
    await builds_col.replace_one({"id": build_id}, build_obj.to_dict())
    
    return {"success": True}

@router.get("/{build_id}/logs")
async def get_build_logs(
    build_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupère les logs d'un build"""
    builds_col = get_collection("builds")
    
    build = await builds_col.find_one({
        "id": build_id,
        "userId": current_user["id"]
    })
    
    if not build:
        raise HTTPException(status_code=404, detail="Build non trouvé")
    
    return build.get("logs", [])

# =============================
# PREVIEW SERVER
# =============================

@router.post("/preview/start")
async def start_preview(
    project_id: str = Body(..., embed=True),
    port: int = Body(3000),
    current_user: dict = Depends(get_current_user)
):
    """Démarre un serveur de prévisualisation"""
    projects_col = get_collection("projects")
    
    # Vérifier que le projet existe
    project = await projects_col.find_one({
        "id": project_id,
        "userId": current_user["id"]
    })
    
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Vérifier si une preview existe déjà
    if project_id in active_previews:
        return active_previews[project_id]
    
    # TODO: Démarrer un vrai serveur Vite/Next.js
    # Pour l'instant, on simule
    preview = {
        "projectId": project_id,
        "state": "running",
        "url": f"http://localhost:{port}",
        "port": port,
        "wsPort": port + 1,
        "isHealthy": True
    }
    
    active_previews[project_id] = preview
    
    return preview

@router.post("/preview/stop")
async def stop_preview(
    project_id: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Arrête un serveur de prévisualisation"""
    if project_id in active_previews:
        del active_previews[project_id]
    
    return {"success": True}

@router.get("/preview/status/{project_id}", response_model=PreviewStatus)
async def get_preview_status(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupère le statut de la prévisualisation"""
    if project_id in active_previews:
        return active_previews[project_id]
    
    return {
        "projectId": project_id,
        "state": "stopped",
        "isHealthy": False
    }

# =============================
# WEBSOCKET POUR BUILDS EN TEMPS RÉEL
# =============================

@router.websocket("/ws/{build_id}")
async def websocket_build(
    websocket: WebSocket,
    build_id: str
):
    """WebSocket pour suivre un build en temps réel (polling MongoDB)"""
    await websocket.accept()
    builds_col = get_collection("builds")

    sent_count = 0
    POLL_INTERVAL = 0.5        # secondes
    MAX_POLLS    = 600         # 5 minutes max

    TERMINAL_STATUSES = {"success", "failed", "cancelled"}

    try:
        for _ in range(MAX_POLLS):
            build = await builds_col.find_one({"id": build_id})
            if not build:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Build {build_id} introuvable"
                })
                break

            # ─── Envoyer les nouveaux logs (delta uniquement) ───
            all_logs = build.get("logs", [])
            new_logs = all_logs[sent_count:]
            for log in new_logs:
                ts = log.get("timestamp")
                await websocket.send_json({
                    "type": "log",
                    "level": log.get("level", "info"),
                    "message": log.get("message", ""),
                    "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
                })
            sent_count += len(new_logs)

            # ─── Envoyer la progression ───
            status   = build.get("status", "pending")
            progress = build.get("progress", 0)
            await websocket.send_json({
                "type": "progress",
                "progress": progress,
                "status": status
            })

            # ─── Arrêter si statut terminal ───
            if status in TERMINAL_STATUSES:
                await websocket.send_json({
                    "type": "complete",
                    "status": status,
                    "message": "✅ Build réussi" if status == "success"
                               else f"Build {status}"
                })
                break

            await asyncio.sleep(POLL_INTERVAL)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

# =============================
# FONCTIONS INTERNES
# =============================

async def _run_real_build(build_id: str, project: dict):
    """
    Exécute un vrai build via BuildRunner.
    Remplace l'ancienne _simulate_build.
    """
    builds_col = get_collection("builds")

    build_doc = await builds_col.find_one({"id": build_id})
    if not build_doc:
        return

    build_obj = Build.from_dict(build_doc)
    build_obj.progress = 10
    build_obj.add_log("build", "🔍 Analyse des fichiers du projet...")
    await builds_col.update_one(
        {"id": build_id},
        {"$set": {"progress": 10, "logs": build_obj.logs}}
    )

    project_files = project.get("files", {})
    project_type  = project.get("type", "html")

    if not project_files:
        build_obj.add_log("error", "❌ Aucun fichier trouvé dans le projet")
        build_obj.fail("Aucun fichier à compiler")
        await builds_col.replace_one({"id": build_id}, build_obj.to_dict())
        return

    build_obj.progress = 25
    build_obj.add_log("build", f"📦 Démarrage du build {project_type} ({len(project_files)} fichiers)...")
    await builds_col.update_one(
        {"id": build_id},
        {"$set": {"progress": 25, "logs": build_obj.logs}}
    )

    result = await build_runner.run_build(
        project_files=project_files,
        project_id=project.get("id", build_id),
        project_type=project_type
    )

    build_obj.progress = 90
    for log_line in result.get("logs", []):
        build_obj.add_log("build", log_line)
    await builds_col.update_one(
        {"id": build_id},
        {"$set": {"progress": 90, "logs": build_obj.logs}}
    )

    if result.get("success"):
        build_obj.progress = 100
        build_obj.add_log("build", f"✅ {result.get('message', 'Build réussi')}")
        build_obj.complete({
            "type": result.get("type"),
            "outputDir": result.get("outputDir"),
            "files": result.get("files", [])
        })
    else:
        error_msg = result.get("error", "Erreur inconnue")
        build_obj.add_log("error", f"❌ {error_msg}")
        build_obj.fail(error_msg)

    await builds_col.replace_one({"id": build_id}, build_obj.to_dict())
