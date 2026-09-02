from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter()


class SuggestionRequest(BaseModel):
    project_id: str
    event_type: str  # 'file_created', 'file_modified', 'file_deleted'
    file_path: str
    file_content: Optional[str] = None
    context: Optional[Dict] = None


class Suggestion(BaseModel):
    id: str
    title: str
    description: str
    action_type: str  # 'create_file', 'modify_file', 'install_package', 'run_command'
    action_data: Dict
    confidence: float


class ApplyRequest(BaseModel):
    project_id: str


@router.post("/api/ai/suggestions")
async def get_proactive_suggestions(request: SuggestionRequest):
    """Analyse le projet et retourne des suggestions proactives."""
    suggestions: List[Suggestion] = []
    content = request.file_content or ""

    # 1. Nouveau fichier Python sans bloc main
    if request.event_type == "file_created" and request.file_path.endswith(".py"):
        if 'if __name__ == "__main__"' not in content:
            suggestions.append(Suggestion(
                id="add_main_block",
                title="Ajouter un point d'entrée",
                description="Ce fichier Python n'a pas de bloc main. Veux-tu en ajouter un ?",
                action_type="modify_file",
                action_data={
                    "file_path": request.file_path,
                    "content": '\n\nif __name__ == "__main__":\n    main()'
                },
                confidence=0.9,
            ))

    # 2. server.js sans express
    if request.file_path.endswith("server.js") and "express" not in content:
        suggestions.append(Suggestion(
            id="install_express",
            title="Installer Express",
            description="Tu as créé un fichier server.js mais Express n'est pas installé.",
            action_type="install_package",
            action_data={"package": "express"},
            confidence=0.95,
        ))

    # 3. Fichier JSX sans import React
    if request.file_path.endswith(".jsx") and "import React" not in content:
        suggestions.append(Suggestion(
            id="add_react_import",
            title="Ajouter l'import React",
            description="Ce fichier JSX utilise React mais React n'est pas importé.",
            action_type="modify_file",
            action_data={
                "file_path": request.file_path,
                "content": "import React from 'react';\n"
            },
            confidence=0.85,
        ))

    # 4. package.json sans script start
    if request.file_path.endswith("package.json") and '"start"' not in content:
        suggestions.append(Suggestion(
            id="add_start_script",
            title="Ajouter un script start",
            description="Ton package.json n'a pas de script 'start' pour lancer l'application.",
            action_type="modify_file",
            action_data={
                "file_path": "package.json",
                "content": '"scripts": { "start": "node server.js" }'
            },
            confidence=0.8,
        ))

    return {"suggestions": [s.dict() for s in suggestions]}


@router.post("/api/ai/suggestions/{suggestion_id}/apply")
async def apply_suggestion(suggestion_id: str, request: ApplyRequest):
    """Applique une suggestion."""
    return {
        "success": True,
        "suggestion_id": suggestion_id,
        "project_id": request.project_id,
        "message": "Suggestion appliquée",
    }
