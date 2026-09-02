"""
Route /api/ai/* — Génération, complétion, streaming, tests, docs, contexte
Sécurité : la clé API reste strictement côté backend.
Sprint 2 : streaming SSE, multi-langages, generate-tests, generate-docs, contexte étendu
"""

import os
import json
import logging
import asyncio
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from middleware.auth_middleware import get_current_user

# Services agent (mémoire, historique, détection langage, etc.)
from services import conversation_memory, action_history, language_detector
from services import proactive_suggestions, error_correction
from services import env_manager
from services.vercel_client import VercelClient, VercelError

# Pour les opérations git de l'agent (réutilise la même racine sandboxée)
import subprocess

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Codegen"])

# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
# do not change this unless explicitly requested by the user
OPENAI_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
OPENAI_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")

try:
    from openai import OpenAI, AsyncOpenAI
    _client = OpenAI(api_key=OPENAI_KEY, base_url=OPENAI_BASE_URL)
    _async_client = AsyncOpenAI(api_key=OPENAI_KEY, base_url=OPENAI_BASE_URL)
    AI_AVAILABLE = True
except Exception:
    _client = None
    _async_client = None
    AI_AVAILABLE = False


# =============================
# PROMPTS SYSTÈME PAR LANGAGE
# =============================

LANGUAGE_SYSTEM_PROMPTS: Dict[str, str] = {
    "javascript": (
        "Tu es un expert JavaScript/Node.js. "
        "Utilise la syntaxe ES2022+, les modules ESM, async/await. "
        "Préfère les fonctions fléchées et les noms descriptifs."
    ),
    "typescript": (
        "Tu es un expert TypeScript. "
        "Utilise des types stricts, des interfaces, des génériques quand approprié. "
        "Évite `any`, préfère `unknown`. Respecte les conventions TSDoc."
    ),
    "python": (
        "Tu es un expert Python 3.10+. "
        "Utilise les type hints, les dataclasses ou Pydantic si pertinent. "
        "Respecte PEP 8, docstrings Google style. Préfère les f-strings."
    ),
    "css": (
        "Tu es un expert CSS/SCSS. "
        "Utilise les custom properties CSS, flexbox, grid. "
        "Sois concis, sans vendor-prefix inutiles."
    ),
    "html": (
        "Tu es un expert HTML5 sémantique. "
        "Utilise les éléments sémantiques corrects, les attributs d'accessibilité (ARIA). "
        "Génère du HTML propre et valide."
    ),
    "rust": (
        "Tu es un expert Rust. "
        "Utilise la gestion d'erreurs avec Result/Option, les lifetimes si nécessaire. "
        "Code idiomatique, sans unsafe sauf si indispensable."
    ),
    "go": (
        "Tu es un expert Go. "
        "Utilise les conventions Go (gofmt), gestion d'erreurs explicite, interfaces petites."
    ),
    "java": (
        "Tu es un expert Java 17+. "
        "Utilise les records, sealed classes, pattern matching si approprié. "
        "Respecte les conventions Oracle Java."
    ),
    "php": (
        "Tu es un expert PHP 8.2+. "
        "Utilise les types union, fibers si pertinent, PSR-12 coding style."
    ),
    "ruby": (
        "Tu es un expert Ruby 3+. "
        "Code idiomatique Ruby, utilise les blocs, méthodes Enumerable."
    ),
    "cpp": (
        "Tu es un expert C++20. "
        "Utilise les concepts, ranges, coroutines si pertinent. RAII toujours."
    ),
    "json": "Tu es un expert en structuration de données JSON.",
    "markdown": "Tu es un expert en documentation Markdown.",
}

FALLBACK_SYSTEM_PROMPT = (
    "Tu es un expert développeur polyvalent. "
    "Génère du code propre, commenté et fonctionnel."
)

def get_language_prompt(language: str) -> str:
    lang = language.lower().strip()
    return LANGUAGE_SYSTEM_PROMPTS.get(lang, FALLBACK_SYSTEM_PROMPT)


SYSTEM_PROMPT = """Tu es un expert en développement d'applications web et mobile.
Génère du code propre, commenté et fonctionnel basé sur la description fournie.

Réponds UNIQUEMENT avec un objet JSON valide de la forme :
{
  "files": {
    "chemin/relatif/fichier.ext": "contenu complet du fichier"
  },
  "description": "description courte de l'application générée",
  "entryPoint": "fichier principal (ex: src/index.js)"
}

Règles :
- Tous les chemins sont relatifs à la racine du projet
- Inclure un package.json si nécessaire
- Le code doit être complet et exécutable
- Pas de markdown, pas de blocs de code, JSON pur
"""


# =============================
# MODÈLES
# =============================

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=2000)
    project_type: str = Field(default="react")
    features: List[str] = Field(default_factory=list)
    name: Optional[str] = None


class GenerateResponse(BaseModel):
    files: dict
    description: str
    entryPoint: Optional[str] = None
    model: str
    ai_generated: bool


class ExplainRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=8000)
    language: str = Field(default="javascript", max_length=50)


class ExplainResponse(BaseModel):
    explanation: str
    model: str
    ai_generated: bool


class CompleteRequest(BaseModel):
    prefix: str = Field(..., min_length=1, max_length=4000)
    language: str = Field(default="javascript", max_length=50)
    maxTokens: int = Field(default=80, ge=10, le=256)
    context: Optional[str] = Field(default=None, max_length=8000)


class CompleteResponse(BaseModel):
    completion: str
    model: str
    ai_generated: bool


class GenerateTestsRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=8000)
    language: str = Field(default="javascript", max_length=50)
    framework: Optional[str] = Field(default=None)
    context: Optional[str] = Field(default=None, max_length=4000)


class GenerateTestsResponse(BaseModel):
    tests: str
    framework: str
    filename: str
    model: str
    ai_generated: bool


class GenerateDocsRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=8000)
    language: str = Field(default="javascript", max_length=50)
    context: Optional[str] = Field(default=None, max_length=4000)


class GenerateDocsResponse(BaseModel):
    documentation: str
    model: str
    ai_generated: bool


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[dict] = Field(default_factory=list)
    mode: str = Field(default="build")
    current_file: Optional[str] = None
    current_file_content: Optional[str] = Field(default=None, max_length=20000)
    selection: Optional[Any] = None  # str (legacy) ou dict {file, language, range, text, length}
    open_files: Optional[List[str]] = None
    context: Optional[Dict] = None  # Contexte structuré du projet (files, features, etc.)
    session_id: Optional[str] = None  # Identifiant de session pour mémoire/historique persistants
    recent_event: Optional[Dict] = None  # ex: {"type":"file_created","path":"src/main.py"}


class FixErrorRequest(BaseModel):
    error: str = Field(..., min_length=1, max_length=4000)
    file_path: Optional[str] = None
    language: Optional[str] = None
    code: Optional[str] = Field(default=None, max_length=8000)


class SuggestRequest(BaseModel):
    project_id: str
    recent_event: Optional[Dict] = None


# =============================
# STATUS
# =============================

@router.get("/status")
async def ai_status():
    return {
        "available": AI_AVAILABLE and bool(OPENAI_KEY) and bool(OPENAI_BASE_URL),
        "key_configured": bool(OPENAI_KEY),
        "model": "gpt-5-mini"
    }


# =============================
# POST /api/ai/generate
# =============================

@router.post("/generate", response_model=GenerateResponse)
async def generate_code(
    req: GenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    if not AI_AVAILABLE or not _client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    user_message = f"Crée une application {req.project_type}"
    if req.name:
        user_message += f" nommée '{req.name}'"
    user_message += f" qui : {req.prompt}"
    if req.features:
        user_message += f"\n\nFonctionnalités : {', '.join(req.features)}"

    try:
        response = _client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            max_completion_tokens=8192,
            response_format={"type": "json_object"}
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        if "files" not in data or not isinstance(data["files"], dict):
            raise ValueError("Réponse IA malformée")
        return GenerateResponse(
            files=data.get("files", {}),
            description=data.get("description", "Application générée par IA"),
            entryPoint=data.get("entryPoint"),
            model=response.model,
            ai_generated=True
        )
    except json.JSONDecodeError as e:
        logger.error(f"[AI Codegen] JSON invalide : {e}")
        raise HTTPException(status_code=502, detail="Réponse IA invalide")
    except Exception as e:
        logger.error(f"[AI Codegen] Erreur : {e}")
        raise HTTPException(status_code=502, detail=str(e)[:200])


# =============================
# POST /api/ai/explain
# =============================

EXPLAIN_SYSTEM_PROMPT = """Tu es un expert en programmation et pédagogie.
Explique le code fourni en français, de manière claire et concise.
Décris ce que fait le code, les algorithmes utilisés, et les patterns importants.
Adapte ton niveau pour un développeur junior.
Réponds directement en texte (pas de JSON, pas de markdown excessif).
"""

@router.post("/explain", response_model=ExplainResponse)
async def explain_code(req: ExplainRequest):
    if not AI_AVAILABLE or not _client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    user_message = f"Langage : {req.language}\n\nCode :\n```{req.language}\n{req.code}\n```"
    try:
        response = _client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": EXPLAIN_SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            max_completion_tokens=512
        )
        return ExplainResponse(
            explanation=response.choices[0].message.content.strip(),
            model=response.model,
            ai_generated=True
        )
    except Exception as e:
        logger.error(f"[AI Explain] Erreur : {e}")
        raise HTTPException(status_code=502, detail=str(e)[:200])


# =============================
# POST /api/ai/complete  (standard, non-streaming)
# =============================

COMPLETE_SYSTEM_PROMPT_BASE = """Tu es un assistant de complétion de code.
Complète le code fourni en continuant logiquement à partir du dernier caractère.
Retourne UNIQUEMENT le texte à insérer, sans répéter le code existant.
Sois concis : une ligne ou quelques lignes maximum.
Pas de commentaires, pas d'explications, juste le code de complétion.
"""

@router.post("/complete", response_model=CompleteResponse)
async def complete_code(req: CompleteRequest):
    if not AI_AVAILABLE or not _client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    lang_prompt = get_language_prompt(req.language)
    system_prompt = f"{COMPLETE_SYSTEM_PROMPT_BASE}\n\nContexte langage : {lang_prompt}"

    context_block = f"\n\nContexte du projet :\n{req.context}" if req.context else ""
    user_message = f"Langage : {req.language}{context_block}\n\nCode :\n```{req.language}\n{req.prefix}"

    try:
        response = _client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_completion_tokens=req.maxTokens
        )
        completion = response.choices[0].message.content.strip()
        if completion.startswith("```"):
            lines = completion.split("\n")
            completion = "\n".join(lines[1:-1]) if len(lines) > 2 else ""
        return CompleteResponse(completion=completion, model=response.model, ai_generated=True)
    except Exception as e:
        logger.error(f"[AI Complete] Erreur : {e}")
        raise HTTPException(status_code=502, detail=str(e)[:200])


# =============================
# POST /api/ai/complete-stream  (SSE streaming)
# =============================

@router.post("/complete-stream")
async def complete_code_stream(req: CompleteRequest):
    """
    Streaming SSE de la complétion de code (Ghostwriter token par token).
    Retourne text/event-stream avec data: <token>\n\n
    """
    if not AI_AVAILABLE or not _async_client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    lang_prompt = get_language_prompt(req.language)
    system_prompt = f"{COMPLETE_SYSTEM_PROMPT_BASE}\n\nContexte langage : {lang_prompt}"
    context_block = f"\n\nContexte du projet :\n{req.context}" if req.context else ""
    user_message = f"Langage : {req.language}{context_block}\n\nCode :\n```{req.language}\n{req.prefix}"

    async def event_generator():
        try:
            stream = await _async_client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_completion_tokens=req.maxTokens,
                stream=True
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content if chunk.choices else None
                if token:
                    # Encoder le token en JSON pour éviter les problèmes de caractères
                    payload = json.dumps({"token": token})
                    yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"[AI Stream] Erreur : {e}")
            payload = json.dumps({"error": str(e)[:200]})
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# =============================
# POST /api/ai/generate-tests
# =============================

TESTS_FRAMEWORK_MAP = {
    "javascript": "jest",
    "typescript": "jest",
    "python": "pytest",
    "ruby": "rspec",
    "go": "testing",
    "rust": "cargo test",
    "java": "junit5",
    "php": "phpunit",
}

def get_test_framework(language: str, hint: Optional[str]) -> str:
    if hint:
        return hint
    return TESTS_FRAMEWORK_MAP.get(language.lower(), "jest")

def get_test_filename(language: str, framework: str) -> str:
    ext_map = {
        "javascript": ".test.js",
        "typescript": ".test.ts",
        "python": "_test.py",
        "ruby": "_spec.rb",
        "go": "_test.go",
        "rust": "_test.rs",
        "java": "Test.java",
        "php": "Test.php",
    }
    return f"generated{ext_map.get(language.lower(), '.test.js')}"

@router.post("/generate-tests", response_model=GenerateTestsResponse)
async def generate_tests(req: GenerateTestsRequest):
    if not AI_AVAILABLE or not _client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    framework = get_test_framework(req.language, req.framework)
    lang_prompt = get_language_prompt(req.language)

    system_prompt = f"""Tu es un expert en tests logiciels et en {req.language}.
{lang_prompt}
Génère des tests unitaires complets pour le code fourni en utilisant {framework}.
- Couvre les cas normaux, les cas limites, et les cas d'erreur
- Utilise des mocks si nécessaire
- Nomme les tests de façon descriptive
- Retourne UNIQUEMENT le code de test, sans explications
"""
    context_block = f"\n\nContexte :\n{req.context}" if req.context else ""
    user_message = f"Génère les tests {framework} pour ce code {req.language} :{context_block}\n\n```{req.language}\n{req.code}\n```"

    try:
        response = _client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_completion_tokens=1024
        )
        tests_code = response.choices[0].message.content.strip()
        if tests_code.startswith("```"):
            lines = tests_code.split("\n")
            tests_code = "\n".join(lines[1:-1]) if len(lines) > 2 else tests_code

        return GenerateTestsResponse(
            tests=tests_code,
            framework=framework,
            filename=get_test_filename(req.language, framework),
            model=response.model,
            ai_generated=True
        )
    except Exception as e:
        logger.error(f"[AI Tests] Erreur : {e}")
        raise HTTPException(status_code=502, detail=str(e)[:200])


# =============================
# POST /api/ai/generate-docs
# =============================

DOCS_STYLE_MAP = {
    "javascript": "JSDoc",
    "typescript": "TSDoc/JSDoc",
    "python": "Google-style docstrings (Python)",
    "java": "Javadoc",
    "php": "PHPDoc",
    "ruby": "YARD",
    "go": "GoDoc",
    "rust": "Rustdoc",
    "cpp": "Doxygen",
}

@router.post("/generate-docs", response_model=GenerateDocsResponse)
async def generate_docs(req: GenerateDocsRequest):
    if not AI_AVAILABLE or not _client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    doc_style = DOCS_STYLE_MAP.get(req.language.lower(), "JSDoc")
    lang_prompt = get_language_prompt(req.language)

    system_prompt = f"""Tu es un expert en documentation de code et en {req.language}.
{lang_prompt}
Génère la documentation {doc_style} pour la fonction/classe fournie.
- Pour JS/TS : génère le bloc JSDoc complet (@param, @returns, @throws, @example)
- Pour Python : génère la docstring Google-style complète (Args, Returns, Raises, Example)
- Inclus uniquement le commentaire de documentation, sans répéter le code
- Pas d'explications supplémentaires, juste le bloc de documentation prêt à insérer
"""
    context_block = f"\n\nContexte :\n{req.context}" if req.context else ""
    user_message = f"Génère la documentation {doc_style} pour :{context_block}\n\n```{req.language}\n{req.code}\n```"

    try:
        response = _client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_completion_tokens=512
        )
        docs = response.choices[0].message.content.strip()
        if docs.startswith("```"):
            lines = docs.split("\n")
            docs = "\n".join(lines[1:-1]) if len(lines) > 2 else docs

        return GenerateDocsResponse(
            documentation=docs,
            model=response.model,
            ai_generated=True
        )
    except Exception as e:
        logger.error(f"[AI Docs] Erreur : {e}")
        raise HTTPException(status_code=502, detail=str(e)[:200])


# =============================
# POST /api/ai/chat  (Chat IA avec streaming SSE)
# =============================

CHAT_SYSTEM_PROMPT = """Tu es l'assistant IA de vibe-coding, l'IDE intégré à Smartix.

## 🏗️ ARCHITECTURE DU PROJET
- Frontend: React 18 + Monaco Editor
- Backend: FastAPI (Python)
- Base de données: PostgreSQL + ClickHouse
- Cache: Redis
- Orchestration: Kubernetes
- CDN: CloudFront
- Régions: EU (Paris), US (Virginie), APAC (Singapour)

## 🛠️ FONCTIONNALITÉS DISPONIBLES (Sprints 1-10)

### Sprint 1 - Fondations
- Multi-onglets de fichiers
- Palette de commandes (Ctrl+K)
- Raccourcis clavier (F5, Ctrl+Enter, Ctrl+`, Ctrl+B)
- Thème clair/sombre
- Drag-and-drop dans l'arborescence
- Secrets chiffrés (AES-256)
- Diff visuel Git dans l'éditeur

### Sprint 2 - IA et productivité
- Ghostwriter streaming (suggestions token par token)
- Ghostwriter multi-langages (JS, TS, Python, CSS, HTML, JSON)
- Génération de tests unitaires
- Documentation auto (JSDoc/docstrings)
- Chat IA avec diff avant/après
- Contexte IA étendu (projet entier)
- LSP TypeScript (erreurs, types, autocomplétion)

### Sprint 3 - Collaboration et déploiement
- Collaboration temps réel (Yjs CRDT)
- Curseurs collaboratifs colorés
- Import/Export GitHub (OAuth + clone/push)
- Déploiement Vercel/Netlify (1-clic)
- URL de partage read-only
- Logs de production en temps réel

### Sprint 4 - Terminal et LSP
- PTY réel (vrai shell bash)
- LSP TypeScript (tsserver)
- LSP Python (pyright)
- Go to Definition (F12)
- Find References (Shift+F12)
- Minimap activée
- Multi-terminaux (onglets)

### Sprint 5 - Sandbox et infrastructure
- Container Docker par projet
- Isolation sécurisée (gVisor)
- URL .vibe.app (sous-domaine automatique)
- TLS automatique (Let's Encrypt)
- Rollback Git
- Rate limiting avancé

### Sprint 6 - Debugging avancé
- Breakpoints DAP (Node.js + Python)
- Panneau de débogage (variables, call stack)
- Eruda DevTools (mobile embarqué)
- Responsive preview (mobile/tablette/desktop)
- Watch mode (re-exécution auto)

### Sprint 7 - Base de données et cron
- PostgreSQL par projet
- UI de gestion de base de données
- Cron jobs UI (tâches planifiées)
- Asset storage S3
- Always On (maintien actif)

### Sprint 8 - Apprentissage gamifié
- Curriculum 100 jours
- Validation automatique du code
- XP, niveaux et streaks
- Badges et récompenses
- Leaderboard (classement)
- Certificats PDF

### Sprint 9 - Différenciateurs Smartix
- SmartClips de code (vidéos courtes)
- Bounties communautaires (SmartCoins)
- Collab audio WebRTC
- Marketplace de templates payants
- IA pédagogique en français
- Feed social intégré

### Sprint 10 - Passage à l'échelle
- Kubernetes orchestration
- Multi-régions (latence routing)
- Monitoring ClickHouse + Grafana
- Auto-scaling avancé
- CDN global
- Cache distribué (Redis)

## 🔧 OUTILS DISPONIBLES (function calling)

Tu as accès aux outils suivants via function calling :

1. **read_file(file_path)** - Lire le contenu d'un fichier du projet
2. **write_file(file_path, content)** - Écrire ou modifier un fichier
3. **list_files(directory)** - Lister les fichiers d'un dossier
4. **search_code(pattern, directory)** - Chercher du code (grep)
5. **run_shell_command(command)** - Exécuter une commande dans le terminal
6. **install_package(package_name)** - Installer un package npm/pip
7. **git_commit(message)** - Commiter les changements
8. **git_push()** - Pousser vers GitHub
9. **deploy()** - Déployer l'application
10. **create_database()** - Créer une base de données PostgreSQL
11. **run_sql(query)** - Exécuter une requête SQL
12. **get_env_vars()** - Lister les variables d'environnement
13. **set_env_var(key, value)** - Définir une variable d'environnement
14. **create_bounty(title, description, reward)** - Créer une prime SmartCoins
15. **create_smartclip(code, language)** - Créer un SmartClip

## 📋 RÈGLES DE FONCTIONNEMENT (CRITIQUES)

### Règle 1 : Verbalisation OBLIGATOIRE
Tu DOIS annoncer chaque action AVANT de l'exécuter.

Format OBLIGATOIRE pour chaque action :
```
📌 Je vais [description de l'action]
→ [résultat de l'action]
```

Exemple :
```
📌 Je vais créer un fichier server.js
→ Fichier server.js créé avec succès
```

### Règle 2 : Langue
Tu réponds TOUJOURS en français (sauf code et commandes techniques).

### Règle 3 : Contexte
Tu connais PARFAITEMENT l'architecture de vibe-coding décrite ci-dessus.

### Règle 4 : Action avant texte
Quand tu utilises un outil, tu le fais AVANT de donner le résultat final.

## 🚀 COMMENCER
Tu es maintenant prêt à aider l'utilisateur. Souviens-toi : annonce TOUJOURS ce que tu vas faire."""


# ========== TOOLS DEFINITION FOR FUNCTION CALLING ==========

AI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Lire le contenu d'un fichier du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Chemin relatif du fichier dans le projet"}
                },
                "required": ["file_path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Écrire ou modifier un fichier du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Chemin relatif du fichier"},
                    "content": {"type": "string", "description": "Contenu complet du fichier"},
                },
                "required": ["file_path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "Lister les fichiers d'un dossier du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "directory": {"type": "string", "description": "Chemin du dossier (défaut: '.')"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Chercher du code dans le projet (grep)",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Motif de recherche (regex supportée)"},
                    "directory": {"type": "string", "description": "Dossier de recherche (défaut: '.')"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell_command",
            "description": "Exécuter une commande dans le terminal du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Commande shell à exécuter"}
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "install_package",
            "description": "Installer un package (npm/pip)",
            "parameters": {
                "type": "object",
                "properties": {
                    "package_name": {"type": "string", "description": "Nom du package à installer"},
                    "manager": {"type": "string", "enum": ["npm", "pip", "yarn"], "description": "Gestionnaire de packages"},
                },
                "required": ["package_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_commit",
            "description": "Commiter les changements Git",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Message du commit"}
                },
                "required": ["message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "deploy",
            "description": "Déployer l'application (Vercel/Netlify)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_sql",
            "description": "Exécuter une requête SQL sur la base de données du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Requête SQL à exécuter"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_status",
            "description": "Obtenir le statut Git du projet (fichiers modifiés, branche)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_log",
            "description": "Lister les derniers commits du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Nombre de commits (défaut: 10)"}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "deploy_vercel",
            "description": "Déployer le projet courant sur Vercel. "
                           "Nécessite la variable d'environnement VERCEL_TOKEN configurée pour le projet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string", "description": "Nom du projet Vercel"},
                    "framework": {"type": "string", "description": "Framework (nextjs, vite, ...)"}
                },
                "required": ["project_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "env_get",
            "description": "Lire la valeur (déchiffrée) d'une variable d'environnement du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Nom de la variable"}
                },
                "required": ["key"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "env_set",
            "description": "Créer ou mettre à jour une variable d'environnement chiffrée du projet",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["key", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "env_list",
            "description": "Lister les noms des variables d'environnement configurées (sans valeur)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_language",
            "description": "Détecter le langage et le framework principaux du projet "
                           "à partir des fichiers manifestes",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


def _safe_project_root(project_id: str) -> str:
    """Racine sandboxée du projet sur disque."""
    safe_id = re.sub(r"[^A-Za-z0-9_\-]", "", str(project_id or "default"))
    return os.path.join("/projects", safe_id)


def _safe_join(project_id: str, rel_path: str) -> Optional[str]:
    """Joint un chemin relatif à la racine projet en empêchant le path traversal."""
    root = _safe_project_root(project_id)
    candidate = os.path.normpath(os.path.join(root, rel_path or ""))
    if not candidate.startswith(os.path.normpath(root)):
        return None
    return candidate


def _git_run(project_id: str, *args: str, timeout: int = 20) -> dict:
    """Exécute une commande git dans le sandbox du projet de l'agent."""
    root = _safe_project_root(project_id)
    os.makedirs(root, exist_ok=True)
    if not os.path.isdir(os.path.join(root, ".git")):
        init = subprocess.run(["git", "init"], cwd=root, capture_output=True, text=True, timeout=timeout)
        if init.returncode != 0:
            return {"success": False, "error": init.stderr.strip() or "git init a échoué"}
        subprocess.run(["git", "config", "user.email", "agent@vibe-coding.app"],
                       cwd=root, capture_output=True, text=True, timeout=5)
        subprocess.run(["git", "config", "user.name", "Vibe-Coding Agent"],
                       cwd=root, capture_output=True, text=True, timeout=5)
    try:
        proc = subprocess.run(["git", *args], cwd=root, capture_output=True,
                              text=True, timeout=timeout)
        return {
            "success": proc.returncode == 0,
            "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-2000:],
            "returncode": proc.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"timeout après {timeout}s"}
    except Exception as e:
        return {"success": False, "error": str(e)[:200]}


async def execute_tool(tool_name: str, tool_args: dict, project_id: str) -> dict:
    """Exécute un outil appelé par l'agent."""
    try:
        if tool_name == "read_file":
            file_path = tool_args.get("file_path", "")
            full_path = _safe_join(project_id, file_path)
            if not full_path:
                return {"success": False, "error": "Chemin invalide"}
            if not os.path.exists(full_path):
                return {"success": False, "error": f"Fichier {file_path} non trouvé"}
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return {"success": True, "content": content[:20000], "file_path": file_path}

        elif tool_name == "write_file":
            file_path = tool_args.get("file_path", "")
            content = tool_args.get("content", "")
            full_path = _safe_join(project_id, file_path)
            if not full_path:
                return {"success": False, "error": "Chemin invalide"}
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"success": True, "file_path": file_path, "lines": len(content.split("\n"))}

        elif tool_name == "list_files":
            directory = tool_args.get("directory", ".")
            full_dir = _safe_join(project_id, directory)
            if not full_dir or not os.path.exists(full_dir):
                return {"success": False, "error": f"Dossier {directory} non trouvé"}
            root_proj = _safe_project_root(project_id)
            files: List[str] = []
            for root, _dirs, filenames in os.walk(full_dir):
                for filename in filenames:
                    rel = os.path.relpath(os.path.join(root, filename), root_proj)
                    files.append(rel)
                    if len(files) >= 100:
                        break
                if len(files) >= 100:
                    break
            return {"success": True, "files": files}

        elif tool_name == "search_code":
            pattern = tool_args.get("pattern", "")
            directory = tool_args.get("directory", ".")
            full_dir = _safe_join(project_id, directory)
            if not full_dir or not os.path.exists(full_dir):
                return {"success": False, "error": f"Dossier {directory} non trouvé"}
            root_proj = _safe_project_root(project_id)
            results = []
            exts = (".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css")
            for root, _dirs, filenames in os.walk(full_dir):
                for filename in filenames:
                    if not filename.endswith(exts):
                        continue
                    file_path = os.path.join(root, filename)
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                            for i, line in enumerate(f, 1):
                                if pattern in line:
                                    results.append({
                                        "file": os.path.relpath(file_path, root_proj),
                                        "line": i,
                                        "content": line.strip()[:200],
                                    })
                                    if len(results) >= 50:
                                        break
                    except Exception:
                        continue
                    if len(results) >= 50:
                        break
                if len(results) >= 50:
                    break
            return {"success": True, "results": results}

        elif tool_name == "run_shell_command":
            return {
                "success": False,
                "command": tool_args.get("command"),
                "error": "Exécution shell arbitraire désactivée. Utilise plutôt git_status, "
                         "git_log, env_set, deploy_vercel ou install_package.",
            }

        elif tool_name == "install_package":
            return {
                "success": False,
                "package": tool_args.get("package_name"),
                "error": "Installation de package non disponible depuis l'agent (utiliser le terminal projet).",
            }

        elif tool_name == "git_commit":
            message = tool_args.get("message") or "Commit via agent IA"
            add = _git_run(project_id, "add", "-A")
            if not add["success"]:
                return {"success": False, "step": "add", "error": add.get("stderr") or add.get("error")}
            commit = _git_run(project_id, "commit", "-m", str(message)[:500])
            return {
                "success": commit["success"],
                "message": message,
                "stdout": commit.get("stdout"),
                "stderr": commit.get("stderr"),
            }

        elif tool_name == "git_status":
            r = _git_run(project_id, "status", "--short", "--branch")
            return {"success": r["success"], "status": r.get("stdout"), "error": r.get("stderr")}

        elif tool_name == "git_log":
            limit = int(tool_args.get("limit") or 10)
            r = _git_run(project_id, "log", f"-{max(1, min(limit, 50))}",
                         "--pretty=format:%h %ad %s", "--date=short")
            return {"success": r["success"], "log": r.get("stdout"), "error": r.get("stderr")}

        elif tool_name in ("deploy", "deploy_vercel"):
            project_name = tool_args.get("project_name") or f"smartix-{project_id}"
            framework = tool_args.get("framework")
            token = await env_manager.env_manager.get_decrypted(project_id, "VERCEL_TOKEN")
            if not token:
                return {
                    "success": False,
                    "error": "VERCEL_TOKEN absent. Demande à l'utilisateur de le configurer "
                             "via env_set ou le panneau Variables d'environnement.",
                }
            root = _safe_project_root(project_id)
            files: List[Dict[str, str]] = []
            for r, _d, fnames in os.walk(root):
                if any(seg in r for seg in (".git", "node_modules", "__pycache__", "dist", "build")):
                    continue
                for fname in fnames:
                    full = os.path.join(r, fname)
                    rel = os.path.relpath(full, root)
                    try:
                        with open(full, "r", encoding="utf-8", errors="replace") as fh:
                            files.append({"file": rel, "data": fh.read()})
                    except Exception:
                        continue
                    if len(files) >= 200:
                        break
                if len(files) >= 200:
                    break
            if not files:
                return {"success": False, "error": "Aucun fichier à déployer dans le projet."}
            try:
                client = VercelClient(token=token)
                result = await client.deploy(project_name, files, framework)
                return {"success": True, **result}
            except VercelError as e:
                return {"success": False, "error": str(e)[:300]}

        elif tool_name == "env_get":
            key = (tool_args.get("key") or "").strip().upper()
            if not key:
                return {"success": False, "error": "Clé manquante"}
            value = await env_manager.env_manager.get_decrypted(project_id, key)
            return {
                "success": value is not None,
                "key": key,
                "value": value,
                "error": None if value is not None else f"Variable {key} non trouvée",
            }

        elif tool_name == "env_set":
            key = (tool_args.get("key") or "").strip().upper()
            value = tool_args.get("value")
            if not key or value is None:
                return {"success": False, "error": "Clé ou valeur manquante"}
            res = await env_manager.env_manager.set_var(project_id, key, str(value))
            return {"success": True, "key": key, **(res or {})}

        elif tool_name == "env_list":
            keys = await env_manager.env_manager.list_keys(project_id)
            return {"success": True, "keys": keys}

        elif tool_name == "detect_language":
            root = _safe_project_root(project_id)
            detection = language_detector.detect_from_dir(root)
            return {"success": True, **detection}

        elif tool_name == "run_sql":
            return {
                "success": False,
                "query": tool_args.get("query"),
                "error": "Exécution SQL non disponible depuis l'agent (utiliser le panneau Database).",
            }

        return {"success": False, "error": f"Outil {tool_name} non reconnu"}
    except Exception as e:
        logger.error(f"[AI Tool] Erreur {tool_name}: {e}")
        return {"success": False, "error": str(e)[:200]}


def _format_selection(selection: Any, current_file: Optional[str]) -> str:
    """Formate la sélection de code de l'éditeur pour l'inclure dans le prompt système.

    Accepte soit une chaîne (legacy), soit un dict avec les clés
    {file, language, range:{startLine,endLine,startColumn,endColumn}, text, length}.
    """
    if not selection:
        return "Aucune sélection"

    # Legacy : sélection envoyée comme simple chaîne
    if isinstance(selection, str):
        text = selection.strip()
        if not text:
            return "Aucune sélection"
        return f"Fichier: {current_file or 'inconnu'}\n\n```\n{text[:4000]}\n```"

    # Nouveau format structuré
    if isinstance(selection, dict):
        text = (selection.get("text") or "").strip()
        if not text:
            return "Aucune sélection"
        file_path = selection.get("file") or current_file or "inconnu"
        language = selection.get("language") or ""
        rng = selection.get("range") or {}
        start_line = rng.get("startLine")
        end_line = rng.get("endLine")
        line_info = (
            f"Lignes: {start_line} à {end_line}"
            if start_line is not None and end_line is not None
            else ""
        )
        header = f"Fichier: {file_path}"
        if line_info:
            header += f"\n{line_info}"
        return (
            f"{header}\n\n```{language}\n{text[:4000]}\n```\n\n"
            "Si l'utilisateur demande d'expliquer ou de modifier du code "
            "sans préciser lequel, c'est cette sélection qu'il désigne."
        )

    return str(selection)[:4000]


async def build_messages_with_context(req: ChatRequest) -> List[Dict]:
    """Construit la liste des messages OpenAI avec contexte projet enrichi.

    Inclut désormais :
      - mémoire de conversation persistante (Redis, par session_id)
      - historique d'actions (10 dernières)
      - détection automatique du langage / framework du projet
      - contenu complet du fichier ouvert (jusqu'à 20 000 caractères)
    """
    messages: List[Dict] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

    ctx = req.context or {}
    project_id = ctx.get("project_id", "default")

    # Détection langage à partir des fichiers du contexte ou du disque
    files_in_ctx = []
    raw_files = ctx.get("files") or []
    for f in raw_files:
        if isinstance(f, str):
            files_in_ctx.append(f)
        elif isinstance(f, dict) and f.get("path"):
            files_in_ctx.append(f["path"])
    if files_in_ctx:
        detection = language_detector.detect_from_paths(files_in_ctx)
    else:
        detection = language_detector.detect_from_dir(_safe_project_root(project_id))
    lang_summary = language_detector.format_for_prompt(detection)

    # Historique d'actions (mémoire des outils déjà appelés)
    actions_block = ""
    if req.session_id:
        recent_actions = await action_history.list_recent(req.session_id, limit=10)
        if recent_actions:
            lines = []
            for a in recent_actions[:10]:
                age = max(0, int(__import__("time").time()) - int(a.get("ts", 0)))
                marker = "✓" if a.get("ok") else "✗"
                lines.append(f"  {marker} {a.get('tool')} ({age}s) — {a.get('summary', '')}")
            actions_block = "### Actions récentes de l'agent\n" + "\n".join(lines)

    # Contenu complet du fichier ouvert (gap : "current file context")
    current_file_block = "Aucun fichier ouvert"
    if req.current_file:
        current_file_block = f"`{req.current_file}`"
        if req.current_file_content:
            content = req.current_file_content[:20000]
            current_file_block += f"\n\n```\n{content}\n```"

    try:
        files_part = json.dumps(raw_files, indent=2, ensure_ascii=False)[:2000]
    except Exception:
        files_part = str(raw_files)[:2000]
    try:
        features_part = json.dumps(ctx.get("features", []), indent=2, ensure_ascii=False)
    except Exception:
        features_part = str(ctx.get("features", ""))

    context_str = f"""
## CONTEXTE ACTUEL DU PROJET

### Langage / écosystème détecté
{lang_summary}

### Fichier ouvert
{current_file_block}

### Code sélectionné
{_format_selection(req.selection, req.current_file)}

### Fichiers ouverts
{', '.join(req.open_files) if req.open_files else 'Aucun'}

### Structure du projet
{files_part}

### Fonctionnalités disponibles
{features_part}

{actions_block}
"""
    messages.append({"role": "system", "content": context_str})

    # 1) Mémoire de conversation persistante (Redis, antérieure à cette requête)
    if req.session_id:
        memory = await conversation_memory.get_history(req.session_id, limit=20)
        for m in memory:
            role = m.get("role")
            if role in ("user", "assistant") and m.get("content"):
                messages.append({"role": role, "content": str(m["content"])[:2000]})

    # 2) Historique court envoyé par le frontend (compatibilité existante)
    for h in req.history[-10:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": str(h["content"])[:2000]})

    messages.append({"role": "user", "content": req.message})
    return messages


@router.post("/chat-stream")
async def chat_stream(req: ChatRequest):
    """Chat IA en streaming SSE avec contexte projet et function calling."""
    if not AI_AVAILABLE or not _async_client:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    messages = await build_messages_with_context(req)
    project_id = (req.context or {}).get("project_id", "default") if req.context else "default"
    session_id = req.session_id

    # Persistance de la question utilisateur dans la mémoire de conversation
    if session_id:
        await conversation_memory.append_message(
            session_id, "user", req.message,
            meta={"file": req.current_file} if req.current_file else None,
        )

    async def event_generator():
        assistant_text_parts: List[str] = []
        try:
            response = await _async_client.chat.completions.create(
                model="gpt-5-mini",
                messages=messages,
                stream=True,
                tools=AI_TOOLS,
                tool_choice="auto",
                max_completion_tokens=1024,
            )

            tool_calls_buffer: Dict[int, Dict] = {}

            async for chunk in response:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # Tokens texte
                if getattr(delta, "content", None):
                    assistant_text_parts.append(delta.content)
                    payload = json.dumps({"type": "text", "token": delta.content})
                    yield f"data: {payload}\n\n"

                # Tool calls (accumulés en streaming)
                if getattr(delta, "tool_calls", None):
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_buffer:
                            tool_calls_buffer[idx] = {"id": None, "name": None, "arguments": ""}
                        if tc.id:
                            tool_calls_buffer[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            tool_calls_buffer[idx]["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls_buffer[idx]["arguments"] += tc.function.arguments

            # Exécuter les tool_calls collectés
            for tc_data in tool_calls_buffer.values():
                tool_name = tc_data.get("name") or "unknown"

                announce = json.dumps({
                    "type": "action",
                    "action": f"Je vais exécuter {tool_name}",
                    "status": "pending",
                })
                yield f"data: {announce}\n\n"

                try:
                    tool_args = json.loads(tc_data.get("arguments") or "{}")
                except Exception:
                    tool_args = {}

                result = await execute_tool(tool_name, tool_args, project_id)
                status = "success" if result.get("success") else "error"

                # Persistance dans l'historique d'actions (Redis)
                if session_id:
                    try:
                        await action_history.record(
                            session_id, tool_name, tool_args, result, project_id=project_id
                        )
                    except Exception:
                        pass

                done_event = json.dumps({
                    "type": "action",
                    "action": f"Résultat de {tool_name}",
                    "status": status,
                    "result": result,
                })
                yield f"data: {done_event}\n\n"

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc_data.get("id") or tool_name,
                    "content": json.dumps(result)[:4000],
                })

            # Persistance de la réponse assistante dans la mémoire de conversation
            if session_id:
                full_text = "".join(assistant_text_parts).strip()
                if full_text:
                    try:
                        await conversation_memory.append_message(
                            session_id, "assistant", full_text
                        )
                    except Exception:
                        pass

            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"[AI Chat] Erreur : {e}")
            payload = json.dumps({"error": str(e)[:200]})
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# =============================
# ENDPOINTS AGENT (mémoire / actions / suggestions / corrections)
# =============================

@router.get("/conversation/{session_id}")
async def get_conversation(session_id: str, limit: int = 50):
    """Retourne la mémoire de conversation persistante d'une session."""
    history = await conversation_memory.get_history(session_id, limit=limit)
    return {
        "session_id": session_id,
        "count": len(history),
        "messages": history,
    }


@router.delete("/conversation/{session_id}")
async def clear_conversation(session_id: str):
    """Vide la mémoire de conversation et l'historique d'actions d'une session."""
    await conversation_memory.clear(session_id)
    await action_history.clear(session_id)
    return {"success": True, "session_id": session_id}


@router.get("/actions/{session_id}")
async def get_actions(session_id: str, limit: int = 30):
    """Retourne l'historique des outils déjà exécutés par l'agent."""
    actions = await action_history.list_recent(session_id, limit=limit)
    return {
        "session_id": session_id,
        "count": len(actions),
        "actions": actions,
    }


@router.post("/suggestions")
async def get_proactive_suggestions(req: SuggestRequest):
    """Analyse le projet et propose des actions pertinentes (dépendances
    manquantes, fichiers vides, point d'entrée absent, etc.)."""
    project_dir = _safe_project_root(req.project_id)
    return proactive_suggestions.analyze(project_dir, recent_event=req.recent_event)


@router.post("/fix-error")
async def fix_error(req: FixErrorRequest):
    """Analyse un message d'erreur et propose un correctif (heuristique + IA)."""
    return await error_correction.propose_fix(
        error_text=req.error,
        code_snippet=req.code,
        file_path=req.file_path,
        language=req.language,
        ai_client=_async_client if AI_AVAILABLE else None,
    )
