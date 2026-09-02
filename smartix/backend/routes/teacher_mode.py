from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
import json
import PyPDF2
from db import get_collection
from middleware.auth_middleware import get_current_user
from pydantic import BaseModel, Field
from openai import OpenAI
import os

router = APIRouter()

# Initialize OpenAI client with Replit AI Integrations
# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
client = OpenAI(
    api_key=os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
)

class TeacherSessionBase(BaseModel):
    title: str

class TeacherSessionCreate(TeacherSessionBase):
    pass

class TeacherSession(TeacherSessionBase):
    id: str
    userId: str
    content: Optional[str] = None
    analysis: Optional[dict] = None
    exam_sheet: Optional[dict] = None
    status: str = "active"
    createdAt: datetime
    lastAccessedAt: datetime

@router.post("/generate-exam/{session_id}", response_model=TeacherSession)
async def generate_exam(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        session = await get_collection("teacher_sessions").find_one({"id": session_id, "userId": current_user["id"]})
        if not session:
            raise HTTPException(status_code=404, detail="Session non trouvée")
        
        content = session.get("content", "")
        if not content:
            raise HTTPException(status_code=400, detail="Aucun contenu pour générer l'examen")

        prompt = f"""
        Génère une fiche d'examen basée EXCLUSIVEMENT sur le contenu du cours suivant.
        Format JSON attendu :
        - title: Titre de l'examen
        - questions: liste d'objets avec :
            - type: "qcm" ou "open"
            - question: texte de la question
            - options: (si qcm) liste de 4 options
            - answer: la réponse correcte
        
        Contenu du cours :
        {content[:15000]}
        """
        
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        
        raw_content = response.choices[0].message.content
        if not raw_content:
             raise HTTPException(status_code=500, detail="Le modèle n'a pas renvoyé de contenu")
        exam_result = json.loads(raw_content)
        
        await get_collection("teacher_sessions").update_one(
            {"id": session_id},
            {"$set": {
                "exam_sheet": exam_result,
                "lastAccessedAt": datetime.now(timezone.utc)
            }}
        )
        
        updated_session = await get_collection("teacher_sessions").find_one({"id": session_id})
        if updated_session:
            updated_session.pop("_id", None)
        return updated_session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/{session_id}", response_model=TeacherSession)
async def analyze_course(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        session = await get_collection("teacher_sessions").find_one({"id": session_id, "userId": current_user["id"]})
        if not session:
            raise HTTPException(status_code=404, detail="Session non trouvée")
        
        content = session.get("content", "")
        if not content:
            raise HTTPException(status_code=400, detail="Aucun contenu à analyser")

        prompt = f"""
        Analyse ce cours et extrais les informations suivantes au format JSON :
        - sections: liste d'objets avec 'title' et 'content' (le contenu détaillé de cette section extrait du texte)
        - key_notions: liste des concepts clés
        - level: niveau scolaire suggéré
        - estimated_duration: durée d'apprentissage estimée
        
        Contenu du cours :
        {content[:15000]}
        """
        
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        
        raw_content = response.choices[0].message.content
        if not raw_content:
             raise HTTPException(status_code=500, detail="Le modèle n'a pas renvoyé de contenu")
        analysis_result = json.loads(raw_content)
        
        now = datetime.now(timezone.utc)
        await get_collection("teacher_sessions").update_one(
            {"id": session_id},
            {"$set": {
                "analysis": analysis_result,
                "status": "analyzed",
                "lastAccessedAt": now
            }}
        )
        
        updated_session = await get_collection("teacher_sessions").find_one({"id": session_id})
        if updated_session:
            updated_session.pop("_id", None)
        return updated_session
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload", response_model=TeacherSession)
async def upload_course(
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        content = ""
        file_content = await file.read()
        
        if file.filename and file.filename.lower().endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            # Optimization: Extract only the first 50 pages if it's too long, or limit total characters
            # PyPDF2 is synchronous and can be slow on very large files.
            pages_to_read = pdf_reader.pages[:50] 
            content = "".join([page.extract_text() or "" for page in pages_to_read])
        else:
            content = file_content.decode('utf-8', errors='ignore')

        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        new_session = {
            "id": session_id,
            "userId": current_user["id"],
            "title": title,
            "content": content,
            "status": "uploaded",
            "createdAt": now,
            "lastAccessedAt": now
        }
        
        await get_collection("teacher_sessions").insert_one(new_session)
        res_session = new_session.copy()
        res_session.pop("_id", None)
        return res_session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions", response_model=TeacherSession)
async def create_session(session_data: TeacherSessionCreate, current_user: dict = Depends(get_current_user)):
    try:
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        new_session = {
            "id": session_id,
            "userId": current_user["id"],
            "title": session_data.title,
            "status": "active",
            "createdAt": now,
            "lastAccessedAt": now
        }
        
        await get_collection("teacher_sessions").insert_one(new_session)
        res_session = new_session.copy()
        res_session.pop("_id", None)
        return res_session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=List[TeacherSession])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    try:
        sessions = await get_collection("teacher_sessions").find(
            {"userId": current_user["id"]}
        ).sort("lastAccessedAt", -1).to_list(None)
        
        for session in sessions:
            session.pop("_id", None)
            
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
