import base64
import os
import pathlib
import uuid
import logging
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict, Union

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI

from db import get_db, get_collection
from middleware.auth_middleware import get_current_user
from routes.subscriptions import PLANS
from prompts.kirixSystemPrompt import KIRIX_SYSTEM_PROMPT
from prompts.identity_guard_config import get_guard_response

# Import des services
from services.search_service import search_web, format_results_for_llm
from services.image_service import generate_image_robust, get_supported_sizes, check_service_health as check_image_health

# =============================
# MODÈLES PYDANTIC
# =============================

class ChatRequest(BaseModel):
    question: str
    thread_id: Optional[str] = None
    subject: Optional[str] = None
    file_ids: Optional[List[str]] = []
    is_temporary: Optional[bool] = False

class RenameThreadRequest(BaseModel):
    title: str

class ToolDecisionRequest(BaseModel):
    systemPrompt: str
    userMessage: str
    conversation: Optional[List[Dict[str, Any]]] = []

class ToolExecutionRequest(BaseModel):
    tool: str
    params: Dict[str, Any]
    userId: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    extract_content: Optional[bool] = False
    format_for_llm: Optional[bool] = False

# ✅ NOUVEAU : Modèle pour la génération d'images
class ImageGenerationRequest(BaseModel):
    prompt: str
    size: Optional[str] = "1024x1024"
    enhance_prompt: Optional[bool] = False

# =============================
# CONFIGURATION
# =============================

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)

openai_api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
openai_base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")

if openai_api_key:
    client = OpenAI(
        api_key=openai_api_key,
        base_url=openai_base_url
    )
else:
    logger.warning("AI_INTEGRATIONS_OPENAI_API_KEY non trouvée. Utilisation de Replit AI native...")
    try:
        client = OpenAI()
    except Exception:
        client = None

# =============================
# FONCTIONS UTILITAIRES
# =============================

async def get_user_tier_limits(user_id: str):
    try:
        sub_col = get_collection("subscriptions")
        sub = await sub_col.find_one({"user_id": user_id, "status": "active"})
        plan_id = sub.get("plan_id", "free") if sub else "free"
        return PLANS.get(plan_id, PLANS["free"])["limits"]
    except Exception:
        return PLANS["free"]["limits"]

async def check_image_quota(user_id: str) -> bool:
    """
    Vérifie le quota d'images (1 par jour) de manière atomique
    Retourne True si le quota est OK et a été consommé
    """
    quota_col = get_collection("user_tool_quotas")
    now = datetime.now(timezone.utc)
    last_day = now - timedelta(days=1)
    
    # Mise à jour atomique - incrémente seulement si < 1
    result = await quota_col.find_one_and_update(
        {
            "userId": user_id, 
            "tool": "generate_image",
            "$or": [
                {"count": {"$lt": 1}},
                {"lastUsed": {"$lt": last_day}}
            ]
        },
        {
            "$inc": {"count": 1},
            "$set": {"lastUsed": now},
            "$setOnInsert": {"createdAt": now}
        },
        upsert=True,
        return_document=True
    )
    
    return result is not None

# =============================
# ✅ NOUVEAU ENDPOINT : GÉNÉRATION D'IMAGES
# =============================

@router.post("/generate-image")
async def generate_image_endpoint(
    request: ImageGenerationRequest, 
    current_user: dict = Depends(get_current_user)
):
    """
    Génère une image à partir d'un prompt via Pollinations AI
    - 1 image par jour par utilisateur
    - Validation du prompt (contenu inapproprié)
    - Rate limiting (1 requête / 10s)
    - Fallback si service indisponible
    """
    try:
        user_id = current_user["id"]
        
        # Valider la taille
        if request.size not in get_supported_sizes():
            request.size = "1024x1024"
            logger.warning(f"Invalid size, using default")
        
        # Améliorer le prompt si demandé
        prompt = request.prompt
        if request.enhance_prompt and client:
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "Améliore ce prompt pour générer une belle image (garde la langue originale, max 200 caractères):"},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=100,
                    temperature=0.7
                )
                enhanced = response.choices[0].message.content.strip()
                if enhanced:
                    prompt = enhanced
                    logger.info(f"Prompt enhanced: {prompt[:50]}...")
            except Exception as e:
                logger.warning(f"Prompt enhancement failed: {e}")
        
        # Appeler le service robuste avec la fonction de quota
        result = await generate_image_robust(
            user_id=user_id,
            prompt=prompt,
            size=request.size,
            check_quota_func=check_image_quota
        )
        
        # Si le quota a été consommé, on le reflète dans la réponse
        if result.get("quota_consumed"):
            logger.info(f"Image generated for user {user_id}, quota consumed")
        
        return result
        
    except Exception as e:
        logger.error(f"Image generation endpoint error: {e}")
        return {
            "success": False,
            "error": True,
            "message": str(e),
            "image_url": "https://via.placeholder.com/1024x1024?text=Erreur"
        }

# =============================
# ENDPOINT DE RECHERCHE WEB
# =============================

@router.post("/search")
async def web_search(request: SearchRequest, current_user: dict = Depends(get_current_user)):
    """
    Recherche web multi-sources avec cache et fallback automatique
    """
    try:
        user_id = current_user["id"]
        
        logger.info(f"Web search for: {request.query[:100]}...")
        results = await search_web(request.query, user_id)
        
        if request.format_for_llm:
            formatted = format_results_for_llm(results)
            return {
                "formatted": formatted,
                "raw": results
            }
        
        return results
        
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return {
            "error": True,
            "message": str(e),
            "results": []
        }

# =============================
# ENDPOINT DE DÉCISION D'OUTILS
# =============================

@router.post("/decide-tool")
async def decide_tool(request: ToolDecisionRequest, current_user: dict = Depends(get_current_user)):
    """
    Endpoint dédié pour que l'IA décide quel outil utiliser.
    """
    try:
        messages = [
            {"role": "system", "content": request.systemPrompt},
            {"role": "user", "content": request.userMessage}
        ]
        
        if request.conversation:
            for msg in request.conversation:
                messages.append(msg)

        if not client:
            return {"response": json.dumps({"needsTool": False, "error": "Service AI non configuré"})}

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=150,
            temperature=0.1
        )

        return {"response": response.choices[0].message.content}
    except Exception as e:
        logger.error(f"Tool decision error: {e}")
        return {"response": json.dumps({"needsTool": False, "error": str(e)})}

# =============================
# FONCTIONS D'EXÉCUTION DES OUTILS
# =============================

async def execute_web_search(query: str, user_id: str) -> Dict[str, Any]:
    """Recherche web via notre service de recherche"""
    try:
        results = await search_web(query, user_id)
        return results
    except Exception as e:
        logger.error(f"Web search execution error: {e}")
        return {
            "results": [
                {"title": "Erreur de recherche", "snippet": str(e)}
            ]
        }

async def execute_image_generation(prompt: str, user_id: str, size: str = "1024x1024") -> Dict[str, Any]:
    """Génération d'image via notre service"""
    try:
        # Utiliser directement l'endpoint interne sans vérifier quota (déjà fait)
        result = await generate_image_robust(
            user_id=user_id,
            prompt=prompt,
            size=size,
            check_quota_func=None  # Quota déjà vérifié dans execute-tool
        )
        return result
    except Exception as e:
        logger.error(f"Image generation execution error: {e}")
        return {
            "images": [
                {"url": f"https://via.placeholder.com/1024x1024.png?text=Erreur"}
            ]
        }

async def execute_code_execution(code: str, user_id: str, language: str = "javascript") -> Dict[str, Any]:
    """Exécution de code (à implémenter)"""
    # TODO: Intégrer un service comme Piston API
    return {
        "output": f"Exécution de code {language} simulée",
        "error": None
    }

# =============================
# ENDPOINT D'EXÉCUTION D'OUTILS
# =============================

@router.post("/execute-tool")
async def execute_tool(request: ToolExecutionRequest, current_user: dict = Depends(get_current_user)):
    """
    Exécute un outil spécifique (recherche, image, code)
    """
    try:
        user_id = current_user["id"]
        quota_col = get_collection("user_tool_quotas")
        now = datetime.now(timezone.utc)
        
        tool_quota = await quota_col.find_one({"userId": user_id, "tool": request.tool})
        
        if request.tool == "web_search":
            if tool_quota:
                last_minute = now - timedelta(minutes=1)
                if tool_quota["lastUsed"] > last_minute and tool_quota["count"] >= 30:
                    return {"error": True, "message": "Limite de recherche atteinte (30/min)"}
            
            result = await execute_web_search(request.params.get("query", ""), user_id)
            
        elif request.tool == "generate_image":
            if tool_quota:
                last_day = now - timedelta(days=1)
                if tool_quota["lastUsed"] > last_day and tool_quota["count"] >= 1:
                    return {"error": True, "message": "Limite d'images atteinte (1/jour)"}
            
            result = await execute_image_generation(
                request.params.get("prompt", ""),
                user_id,
                request.params.get("size", "1024x1024")
            )
            
        elif request.tool == "run_code":
            if tool_quota:
                last_hour = now - timedelta(hours=1)
                if tool_quota["lastUsed"] > last_hour and tool_quota["count"] >= 20:
                    return {"error": True, "message": "Limite d'exécution de code atteinte (20/heure)"}
            
            result = await execute_code_execution(
                request.params.get("code", ""),
                user_id,
                request.params.get("language", "javascript")
            )
            
        else:
            return {"error": True, "message": f"Outil '{request.tool}' non supporté"}

        # Mettre à jour les quotas
        await quota_col.update_one(
            {"userId": user_id, "tool": request.tool},
            {
                "$inc": {"count": 1},
                "$set": {"lastUsed": now},
                "$setOnInsert": {"createdAt": now}
            },
            upsert=True
        )

        return {"success": True, "result": result}

    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return {"error": True, "message": str(e)}

# =============================
# ENDPOINT DE QUOTAS DES OUTILS
# =============================

@router.get("/tool-quotas")
async def get_tool_quotas(current_user: dict = Depends(get_current_user)):
    """
    Récupère les quotas d'utilisation des outils pour l'utilisateur
    """
    try:
        quota_col = get_collection("user_tool_quotas")
        user_quotas = await quota_col.find({"userId": current_user["id"]}).to_list(length=10)
        
        result = {}
        now = datetime.now(timezone.utc)
        
        default_quotas = {
            "web_search": {"remaining": 30, "limit": 30, "period": "minute", "displayText": "30 par minute"},
            "generate_image": {"remaining": 1, "limit": 1, "period": "day", "displayText": "1 par jour"},
            "run_code": {"remaining": 20, "limit": 20, "period": "hour", "displayText": "20 par heure"}
        }
        
        for q in user_quotas:
            tool = q["tool"]
            count = q["count"]
            last_used = q["lastUsed"]
            
            if tool == "web_search":
                if now - last_used > timedelta(minutes=1):
                    count = 0
                result[tool] = {
                    "remaining": max(0, 30 - count),
                    "limit": 30,
                    "period": "minute",
                    "displayText": f"{max(0, 30 - count)}/30 par minute"
                }
            elif tool == "generate_image":
                if now - last_used > timedelta(days=1):
                    count = 0
                result[tool] = {
                    "remaining": max(0, 1 - count),
                    "limit": 1,
                    "period": "day",
                    "displayText": f"{max(0, 1 - count)}/1 par jour"
                }
            elif tool == "run_code":
                if now - last_used > timedelta(hours=1):
                    count = 0
                result[tool] = {
                    "remaining": max(0, 20 - count),
                    "limit": 20,
                    "period": "hour",
                    "displayText": f"{max(0, 20 - count)}/20 par heure"
                }
        
        for tool, default in default_quotas.items():
            if tool not in result:
                result[tool] = default
        
        return result
    except Exception as e:
        logger.error(f"Error getting tool quotas: {e}")
        return {
            "web_search": {"remaining": 30, "limit": 30, "period": "minute", "displayText": "30 par minute"},
            "generate_image": {"remaining": 1, "limit": 1, "period": "day", "displayText": "1 par jour"},
            "run_code": {"remaining": 20, "limit": 20, "period": "hour", "displayText": "20 par heure"}
        }

# =============================
# ENDPOINT DE VÉRIFICATION SANTÉ IMAGE
# =============================

@router.get("/image-health")
async def image_service_health():
    """Vérifie si le service d'images est disponible"""
    try:
        health = await check_image_health()
        return health
    except Exception as e:
        return {"healthy": False, "error": str(e)}

# =============================
# ROUTES EXISTANTES (INCHANGÉES)
# =============================

@router.post("/chat")
async def chat_with_ai(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        limits = await get_user_tier_limits(current_user["id"])
        
        quota_col = get_collection("user_message_quota")
        now = datetime.now(timezone.utc)
        now_date = now.date().isoformat()
        
        quota_doc = await quota_col.find_one_and_update(
            {"userId": current_user["id"]},
            {"$setOnInsert": {"userId": current_user["id"], "messagesSentToday": 0, "lastResetAt": now.isoformat()}},
            upsert=True,
            return_document=True
        )
        
        last_reset = datetime.fromisoformat(quota_doc["lastResetAt"].replace("Z", "+00:00"))
        if last_reset.date().isoformat() != now_date:
            quota_doc = await quota_col.find_one_and_update(
                {"userId": current_user["id"]},
                {"$set": {"messagesSentToday": 0, "lastResetAt": now.isoformat()}},
                return_document=True
            )
        
        if quota_doc["messagesSentToday"] >= limits.get("ai_messages_per_day", 20):
            async def limit_streamer():
                error_msg = f"Limite quotidienne de messages atteinte ({limits['ai_messages_per_day']})."
                yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
            return StreamingResponse(limit_streamer(), media_type="text/event-stream")

        guard_response = get_guard_response(request.question)
        chat_id = str(uuid.uuid4())
        thread_id = request.thread_id or str(uuid.uuid4())
        
        if guard_response:
            async def guard_streamer():
                words = guard_response.split(' ')
                for i, word in enumerate(words):
                    chunk = word + (" " if i < len(words) - 1 else "")
                    yield f"data: {json.dumps({'text': chunk, 'done': False})}\n\n"
                    await asyncio.sleep(0.05)
                
                await quota_col.update_one(
                    {"userId": current_user["id"]},
                    {"$inc": {"messagesSentToday": 1}}
                )
                
                if not getattr(request, 'is_temporary', False):
                    chat_obj = {
                        "id": chat_id,
                        "user_id": current_user["id"],
                        "thread_id": thread_id,
                        "question": request.question,
                        "answer": guard_response,
                        "file_ids": request.file_ids,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.ai_chats.insert_one(chat_obj)
                
                yield f"data: {json.dumps({'done': True, 'id': chat_id, 'thread_id': thread_id})}\n\n"
            return StreamingResponse(guard_streamer(), media_type="text/event-stream")

        messages: List[Dict[str, Any]] = [{"role": "system", "content": KIRIX_SYSTEM_PROMPT}]
        if request.thread_id:
            chat_history = await db.ai_chats.find(
                {"user_id": current_user["id"], "thread_id": thread_id}
            ).sort("created_at", 1).to_list(length=20)
            for chat in chat_history:
                messages.append({"role": "user", "content": str(chat["question"])})
                messages.append({"role": "assistant", "content": str(chat["answer"])})
        
        user_content: List[Dict[str, Any]] = [{"type": "text", "text": str(request.question)}]
        if request.file_ids:
            upload_dir = pathlib.Path("uploads/ai_temp")
            for f_id in request.file_ids:
                matching_files = list(upload_dir.glob(f"{f_id}*"))
                if matching_files:
                    file_path = matching_files[0]
                    if file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                        with open(file_path, "rb") as image_file:
                            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
                            user_content.append({
                                "type": "image_url",
                                "image_url": {"url": f"data:image/{file_path.suffix[1:].replace('jpg', 'jpeg')};base64,{base64_image}"}
                            })
                    else:
                        user_content.append({"type": "text", "text": f"\n[Fichier joint: {file_path.name}]"})
        messages.append({"role": "user", "content": user_content})

        ai_model = limits.get("ai_model", "gpt-4o-mini")
        max_tokens = limits.get("ai_max_tokens", 500)

        async def ai_streamer():
            full_answer = ""
            try:
                if not client:
                    yield f"data: {json.dumps({'error': 'Service AI non configuré', 'done': True})}\n\n"
                    return

                response = client.chat.completions.create(
                    model=ai_model,
                    messages=messages,
                    max_tokens=max_tokens,
                    stream=True
                )
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_answer += content
                        yield f"data: {json.dumps({'text': content, 'done': False})}\n\n"
                
                await quota_col.update_one(
                    {"userId": current_user["id"]},
                    {"$inc": {"messagesSentToday": 1}}
                )
                
                if not getattr(request, 'is_temporary', False):
                    chat_obj = {
                        "id": chat_id,
                        "user_id": current_user["id"],
                        "thread_id": thread_id,
                        "question": request.question,
                        "answer": full_answer,
                        "file_ids": request.file_ids,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.ai_chats.insert_one(chat_obj)
                
                yield f"data: {json.dumps({'done': True, 'id': chat_id, 'thread_id': thread_id})}\n\n"
            except Exception as stream_err:
                logger.error(f"Streaming error: {stream_err}")
                yield f"data: {json.dumps({'error': 'Erreur de flux', 'done': True})}\n\n"
        return StreamingResponse(ai_streamer(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur KIRIX: {str(e)}")
                    @router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        limits = await get_user_tier_limits(current_user["id"])
        if not limits.get("ai_file_upload"):
            raise HTTPException(status_code=403, detail="L'upload de fichiers nécessite un abonnement Standard ou Premium")
        upload_dir = pathlib.Path("uploads/ai_temp")
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_ext = pathlib.Path(file.filename).suffix.lower() if file.filename else ".bin"
        file_id = f"ai_{uuid.uuid4()}"
        filename = f"{file_id}{file_ext}"
        file_path = upload_dir / filename
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        return {"file_id": file_id, "filename": file.filename, "url": f"/uploads/ai_temp/{filename}", "extension": file_ext}
    except Exception as e:
        logger.error(f"AI upload error: {e}")
        raise HTTPException(status_code=500, detail="Erreur d'upload")

@router.delete("/thread/{thread_id}")
async def delete_thread(thread_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        await db.ai_chats.delete_many({"user_id": current_user["id"], "thread_id": thread_id})
        return {"success": True, "message": "Discussion supprimée"}
    except Exception as e:
        logger.error(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression")

@router.patch("/thread/{thread_id}")
async def rename_thread(thread_id: str, request: RenameThreadRequest, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        first_msg = await db.ai_chats.find_one({"user_id": current_user["id"], "thread_id": thread_id}, sort=[("created_at", 1)])
        if first_msg:
            await db.ai_chats.update_one({"_id": first_msg["_id"]}, {"$set": {"question": request.title}})
        return {"success": True, "message": "Discussion renommée"}
    except Exception as e:
        logger.error(f"Error renaming thread: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du renommage")

@router.get("/check-quota")
async def check_quota(current_user: dict = Depends(get_current_user)):
    try:
        quota_col = get_collection("user_message_quota")
        limits = await get_user_tier_limits(current_user["id"])
        
        now = datetime.now(timezone.utc)
        now_date = now.date().isoformat()
        
        quota_doc = await quota_col.find_one({"userId": current_user["id"]})
        
        if not quota_doc:
            quota_doc = {
                "userId": current_user["id"],
                "messagesSentToday": 0,
                "lastResetAt": now.isoformat()
            }
            await quota_col.insert_one(quota_doc)
        else:
            last_reset = datetime.fromisoformat(quota_doc["lastResetAt"].replace("Z", "+00:00"))
            if last_reset.date().isoformat() != now_date:
                await quota_col.update_one(
                    {"userId": current_user["id"]},
                    {"$set": {"messagesSentToday": 0, "lastResetAt": now.isoformat()}}
                )
                quota_doc["messagesSentToday"] = 0
                quota_doc["lastResetAt"] = now.isoformat()
        
        limit_val = limits.get("ai_messages_per_day", 20)
        quota_reached = quota_doc["messagesSentToday"] >= limit_val
        
        tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        return {
            "quotaReached": quota_reached,
            "messagesSentToday": quota_doc["messagesSentToday"],
            "quotaLimit": limit_val,
            "quotaResetAt": tomorrow.isoformat()
        }
    except Exception as e:
        logger.error(f"Error checking quota: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        @router.get("/history")
async def get_chat_history(current_user: dict = Depends(get_current_user), limit: int = 20):
    try:
        db = get_db()
        pipeline = [
            {"$match": {"user_id": current_user["id"]}},
            {"$sort": {"created_at": 1}},
            {"$group": {"_id": "$thread_id", "first_message": {"$first": "$$ROOT"}, "last_message_date": {"$last": "$created_at"}}},
            {"$sort": {"last_message_date": -1}},
            {"$limit": limit}
        ]
        results = await db.ai_chats.aggregate(pipeline).to_list(length=limit)
        history = []
        for res in results:
            item = res["first_message"]
            if "_id" in item: del item["_id"]
            history.append(item)
        return history
    except Exception as e:
        logger.error(f"Error fetching AI history: {e}")
        return []

@router.get("/thread/{thread_id}")
async def get_thread_messages(thread_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db = get_db()
        messages = await db.ai_chats.find({"user_id": current_user["id"], "thread_id": thread_id}).sort("created_at", 1).to_list(length=100)
        for m in messages:
            if "_id" in m: del m["_id"]
        return messages
    except Exception as e:
        logger.error(f"Error fetching thread: {e}")
        return []
          
