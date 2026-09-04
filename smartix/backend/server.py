import os
import asyncio
from openai import OpenAI
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Literal
from fastapi import FastAPI, Depends, HTTPException, Body, APIRouter, UploadFile, File, Request, Response, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import jwt
from jwt import PyJWTError as JWTError
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import uvicorn
import uuid
import json
import pathlib
import logging
from bson.objectid import ObjectId

# Import MongoDB database module
from db import init_mongodb, close_mongodb, get_db, get_collection

# Import news aggregator synchronously for the scheduler
try:
    from app.aggregator.aggregator import run_once_sync
except ImportError:
    run_once_sync = None

# Import rate limiter
# Removed: from utils.rate_limiter import rate_limiter, get_client_id (dead code, replaced by middleware/rate_limit.py)

# Import token manager
from utils.token_manager import (
    generate_token_pair,
    verify_refresh_token,
    generate_access_token,
    generate_reset_token
)

# Import auth middleware
from middleware.auth_middleware import get_current_user, get_current_user_optional

# Import email sender
from utils.email_sender import email_sender

# Import routers
try:
    from routes.security import router as security_router
except ImportError:
    security_router = None

try:
    from routes.friends import router as friends_router
    from routes.friends_debug import router as friends_debug_router
except ImportError:
    friends_router = None
    friends_debug_router = None

try:
    from routes.blocked_users import router as blocked_users_router
except ImportError:
    blocked_users_router = None

try:
    from routes.marketplace import router as marketplace_router
except ImportError:
    marketplace_router = None

try:
    from routes.courses import router as courses_router
except ImportError:
    courses_router = None

try:
    from routes.stories import router as stories_router
except ImportError:
    stories_router = None

try:
    from routes.posts import router as posts_router
except ImportError:
    posts_router = None

try:
    from routes.comments_crud import router as comments_router
except ImportError:
    comments_router = None

try:
    from routes.story_reactions import router as story_reactions_router
except ImportError:
    story_reactions_router = None

try:
    from routes.subscriptions import router as subscriptions_router
except ImportError:
    subscriptions_router = None

try:
    from routes.news_routes import router as news_router
except ImportError:
    news_router = None

try:
    from routes.fcm_notifications import router as fcm_router
except ImportError:
    fcm_router = None

# Sprint 10 — Monitoring & Scaling
# Feature flag MONITORING_ENABLED : opt-in explicite, jamais de fallback silencieux.
# - true  : modules chargés et stricts (toute erreur de ClickHouse fait échouer le startup)
# - false : modules non chargés ; les endpoints monitoring renvoient 503 explicite
_MONITORING_ENABLED = os.getenv("MONITORING_ENABLED", "false").lower() == "true"

if _MONITORING_ENABLED:
    from monitoring.clickhouse_client import ClickHouseClient
    from monitoring.metrics_collector import MetricsCollector, MetricsMiddleware
    from monitoring.analytics_service import AnalyticsService
    from scaling.metrics_provider import MetricsProvider
    from scaling.auto_scaler import AutoScaler

    _clickhouse_client = ClickHouseClient()
    _metrics_provider = MetricsProvider(clickhouse_client=_clickhouse_client)
    _metrics_collector = MetricsCollector(clickhouse=_clickhouse_client)
    _analytics_service = AnalyticsService(clickhouse=_clickhouse_client)
    _auto_scaler = AutoScaler(metrics_provider=_metrics_provider)
else:
    _clickhouse_client = None
    _metrics_provider = None
    _metrics_collector = None
    _analytics_service = None
    _auto_scaler = None
    MetricsMiddleware = None  # type: ignore

# Import system tasks
process_system_responses = None
process_system_outbound_requests = None
process_system_messages = None
try:
    from scripts.system_auto_accept import process_system_responses
    from scripts.system_outbound_requests import process_system_outbound_requests
    from scripts.system_messages import process_system_messages
except ImportError:
    pass

# Import WebSocket manager
try:
    from utils.websocket_manager import ws_manager
    from utils.socket_manager import sio_app
except ImportError:
    ws_manager = None
    sio_app = None

# Import story reactions stream manager
try:
    from utils.story_reactions_handler import stream_manager
except ImportError:
    stream_manager = None

# Logger
logger = logging.getLogger(__name__)
load_dotenv()

# Lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    async def background_startup():
        global _mongo_ready
        try:
            try:
                await init_mongodb()
                _mongo_ready = True
            except Exception as e:
                logger.error("❌ MongoDB startup failed; database-backed routes disabled: %s", type(e).__name__)
            finally:
                _mongo_ready_event.set()

            if not _mongo_ready:
                return

            try:
                from db import get_collection
                posts_col = get_collection('posts')
                stories_col = get_collection('stories')
                users_col = get_collection('users')
                await posts_col.create_index([("created_at", -1)])
                idx_info = await stories_col.index_information()
                if "stories_ttl_index" not in idx_info:
                    await stories_col.create_index([("expires_at", 1)], name="stories_ttl_index", expireAfterSeconds=0)
                # ----------------------------------------------------------
                # Migration index `users` :
                # On accepte désormais des comptes téléphone-only (sans email)
                # et des identités fédérées (google_id). Les index uniques sur
                # ces champs doivent être PARTIELS pour ne pas faire collisionner
                # plusieurs documents qui omettent le champ.
                # ----------------------------------------------------------
                users_idx = await users_col.index_information()

                # email : passer d'un index unique simple à un unique partiel
                old_email = users_idx.get("email_1")
                if old_email and "partialFilterExpression" not in old_email:
                    try:
                        await users_col.drop_index("email_1")
                        print("ℹ️  Index users.email_1 (legacy) supprimé pour migration partielle")
                    except Exception as drop_err:
                        print(f"⚠️ drop legacy email_1 a échoué: {drop_err}")
                await users_col.create_index(
                    [("email", 1)],
                    name="email_1",
                    unique=True,
                    partialFilterExpression={"email": {"$exists": True, "$type": "string"}},
                )

                # phone : nouveau, unique partiel (E.164)
                await users_col.create_index(
                    [("phone", 1)],
                    name="phone_1",
                    unique=True,
                    partialFilterExpression={"phone": {"$exists": True, "$type": "string"}},
                )

                # google_id : nouveau, unique partiel (sub OAuth)
                await users_col.create_index(
                    [("google_id", 1)],
                    name="google_id_1",
                    unique=True,
                    partialFilterExpression={"google_id": {"$exists": True, "$type": "string"}},
                )

                await users_col.create_index([("username", 1)])
                print("✅ MongoDB indexes verified (email/phone/google_id partial-unique)")
            except Exception as e:
                print(f"⚠️ Index creation error: {e}")

            # News Aggregator setup
            try:
                from app.news.scheduler import start_scheduler
                start_scheduler(persistent=False)
                print("✅ News aggregator scheduled (10 min)")
            except Exception as e:
                print(f"⚠️ News aggregator setup error: {e}")

            # Sprint 5 : Redis + Container cleanup
            try:
                from redis_client import redis_vibe
                await redis_vibe.connect()
                print(f"✅ Redis Vibe-Coding: {'connecté' if redis_vibe.available else 'mode in-memory'}")
            except Exception as e:
                print(f"⚠️ Redis init error: {e}")

            try:
                from containers.container_manager import container_manager
                container_manager.start_cleanup()
                print("✅ Container manager démarré (cleanup automatique)")
            except Exception as e:
                print(f"⚠️ Container manager error: {e}")

            try:
                from services.ssl_manager import ssl_manager
                ssl_manager.start_auto_renew(interval_hours=12)
                print("✅ SSL auto-renew planifié (12h)")
            except Exception as e:
                print(f"⚠️ SSL manager error: {e}")

            # Sprint 7 — EnvManager
            try:
                from db import get_db as _get_db_s7
                from services.env_manager import env_manager
                env_manager.set_db(_get_db_s7())
                print("✅ EnvManager initialisé")
            except Exception as e:
                print(f"⚠️ EnvManager error: {e}")

            # Sprint 7 — RequestLogger
            try:
                from db import get_db as _get_db_rl
                from services.request_logger import request_logger
                request_logger.set_db(_get_db_rl())
                request_logger.start()
                await request_logger.ensure_index()
                print("✅ RequestLogger démarré")
            except Exception as e:
                print(f"⚠️ RequestLogger error: {e}")

            # Sprint 10 — Monitoring & AutoScaler startup (strict si activé)
            if _MONITORING_ENABLED:
                await _clickhouse_client.connect()
                await _clickhouse_client.create_tables()
                await _metrics_provider.start()
                await _metrics_collector.start()
                await _auto_scaler.start()
                print("✅ Sprint 10: Monitoring + AutoScaler démarrés (strict)")
            else:
                print("ℹ️  Sprint 10: monitoring désactivé (MONITORING_ENABLED=false)")

            # System tasks loop — désactivé si MONGO_URL absent (évite le spam "Empty host")
            _sys_mongo = os.environ.get("MONGO_URL", "").strip()
            if _sys_mongo and (process_system_responses or process_system_outbound_requests or process_system_messages):
                async def run_system_loop():
                    await asyncio.sleep(5)
                    _backoff = 10
                    while True:
                        try:
                            if process_system_responses: await process_system_responses()
                            if process_system_outbound_requests: await process_system_outbound_requests()
                            if process_system_messages: await process_system_messages()
                            _backoff = 10
                        except Exception as e:
                            logger.error(f"❌ System loop error: {e}")
                            _backoff = min(_backoff * 2, 300)
                        await asyncio.sleep(_backoff)
                asyncio.create_task(run_system_loop())
            elif not _sys_mongo:
                logger.info("ℹ️  System loop désactivé : MONGO_URL non défini")
        except Exception as e:
            logger.error(f"❌ Background startup error: {e}")

    asyncio.create_task(background_startup())
    yield
    await close_mongodb()

# App initialization
app = FastAPI(title="Smartix API", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import logging
    logger = logging.getLogger(__name__)

    # ⚠️ Ne JAMAIS rappeler `await request.body()` ici : quand plusieurs
    # `BaseHTTPMiddleware` (rate limit, sandbox log, audit) sont dans la
    # chaîne, le flux de body a déjà été consommé/relayé en aval, et un
    # second `request.body()` peut rester suspendu jusqu'à un timeout de
    # pile (~30 s observé), ce qui transformait une simple erreur 422 en
    # blocage perçu comme un timeout côté client.
    #
    # Si le body a été mis en cache par Starlette dans `request._body`, on
    # le récupère sans nouveau `await` (lecture purement synchrone). Sinon,
    # on log sans le body — l'objet `exc.errors()` contient déjà ce qui est
    # nécessaire pour diagnostiquer.
    body_str = "<not buffered>"
    cached_body = getattr(request, "_body", None)
    if cached_body is not None:
        try:
            body_str = cached_body.decode("utf-8", errors="replace")[:500]
        except Exception:
            body_str = "<decode error>"

    logger.error(
        f"❌ VALIDATION ERROR 422: Path: {request.url.path} | "
        f"Query: {request.query_params} | Errors: {exc.errors()} | Body: {body_str}"
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

_replit_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:3000",
]
if _replit_domain:
    _allowed_origins.append(f"https://{_replit_domain}")

def _is_allowed_origin(origin: str) -> bool:
    if origin in _allowed_origins:
        return True
    if origin and (
        origin.endswith(".replit.dev") or
        origin.endswith(".repl.co") or
        origin.endswith(".replit.app")
    ):
        return True
    return False

class DynamicCORSMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin", b"").decode("utf-8", errors="replace")

            if _is_allowed_origin(origin):
                if scope.get("method") == "OPTIONS":
                    async def send_preflight(message):
                        if message["type"] == "http.response.start":
                            message["headers"] = list(message.get("headers", [])) + [
                                (b"access-control-allow-origin", origin.encode()),
                                (b"access-control-allow-credentials", b"true"),
                                (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, PATCH, OPTIONS"),
                                (b"access-control-allow-headers", b"Content-Type, Authorization, X-Requested-With"),
                                (b"access-control-max-age", b"86400"),
                            ]
                        await send(message)
                    await self.app(scope, receive, send_preflight)
                    return
                else:
                    async def send_cors(message):
                        if message["type"] == "http.response.start":
                            message["headers"] = list(message.get("headers", [])) + [
                                (b"access-control-allow-origin", origin.encode()),
                                (b"access-control-allow-credentials", b"true"),
                            ]
                        await send(message)
                    await self.app(scope, receive, send_cors)
                    return

        await self.app(scope, receive, send)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(DynamicCORSMiddleware)

# ── Sprint 5 : Rate limiting middleware ─────────────────────────────────────
try:
    from middleware.rate_limit import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware)
    print("✅ Rate limit middleware activé")
except ImportError as e:
    print(f"⚠️ Rate limit middleware non disponible: {e}")

# ── Sprint 7 : Logs d'accès sandbox ─────────────────────────────────────────
try:
    from middleware.sandbox_log_middleware import SandboxLogMiddleware
    app.add_middleware(SandboxLogMiddleware)
    print("✅ SandboxLog middleware activé")
except ImportError as e:
    print(f"⚠️ SandboxLog middleware non disponible: {e}")

# Ping endpoint — vérification de connectivité (OfflineContext)
@app.head("/ping")
@app.get("/ping")
async def ping():
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
    )

# Auth models
class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    username: Optional[str] = None
    school: Optional[str] = None
    level: Optional[str] = None
    date_of_birth: Optional[str] = None
    accept_terms: Optional[bool] = None
    accept_privacy: Optional[bool] = None

class OnboardingProgressUpdate(BaseModel):
    currentStep: int = Field(..., ge=1, le=5)
    completedSteps: List[int] = Field(default_factory=list)
    hasSeenOnboarding: bool = False
    status: Literal["in_progress", "dismissed", "completed"] = "in_progress"

class CheckUsernameRequest(BaseModel):
    username: str

class CheckEmailRequest(BaseModel):
    email: str

_mongo_ready = False
_mongo_ready_event = asyncio.Event()

async def _require_mongodb():
    """Wait for startup initialization and fail clearly if MongoDB is unavailable."""
    if not _mongo_ready_event.is_set():
        try:
            await asyncio.wait_for(_mongo_ready_event.wait(), timeout=15)
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=503,
                detail="La base de données est encore en cours d'initialisation. Réessaie dans quelques secondes.",
            )

    if not _mongo_ready:
        raise HTTPException(
            status_code=503,
            detail="Le service d'inscription est temporairement indisponible : la base de données n'est pas connectée.",
        )

import bcrypt as _bcrypt_lib

def _bcrypt_check_sync(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt_lib.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def _bcrypt_hash_sync(plain: str) -> str:
    salt = _bcrypt_lib.gensalt()
    return _bcrypt_lib.hashpw(plain.encode('utf-8'), salt).decode('utf-8')

async def verify_password(plain_password, hashed_password):
    # bcrypt est CPU-bound : on le sort de l'event loop pour ne pas
    # bloquer les autres requêtes async pendant le hash (~100-500 ms).
    return await asyncio.to_thread(_bcrypt_check_sync, plain_password, hashed_password)

async def hash_password(plain_password: str) -> str:
    return await asyncio.to_thread(_bcrypt_hash_sync, plain_password)

@app.post("/api/auth/login")
@app.post("/auth/login")
async def login(credentials: UserLogin, request: Request):
    await _require_mongodb()
    users_col = get_collection('users')
    # Normalisation : login insensible à la casse / espaces parasites pour
    # rester cohérent avec /auth/check-email qui normalise déjà l'entrée.
    email_normalized = (credentials.email or "").strip().lower()
    user = await users_col.find_one({"email": email_normalized})
    if not user or not await verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    tokens = generate_token_pair(user["id"], user["email"])
    # Convert tuple to dict if generate_token_pair returns a tuple (access, refresh)
    if isinstance(tokens, tuple):
        access_token, refresh_token = tokens
        tokens = {"access_token": access_token, "refresh_token": refresh_token}
    
    await _create_session(user["id"], tokens["access_token"], request)
    user_info = {k: v for k, v in user.items() if k not in ["_id", "hashed_password"]}
    return {"user": user_info, **tokens, "expires_in": 3600}

@app.post("/api/auth/register")
@app.post("/auth/register")
async def register(user_data: UserRegister, request: Request):
    await _require_mongodb()
    users_col = get_collection('users')

    # Normalisation email : on stocke et compare toujours en minuscules,
    # cohérent avec /auth/login et /auth/check-email. Évite la création de
    # doublons "Jean@x.com" vs "jean@x.com" et un login impossible ensuite.
    email_normalized = (user_data.email or "").strip().lower()

    existing = await users_col.find_one({"email": email_normalized})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    hashed_password = await hash_password(user_data.password)

    user_id = str(uuid.uuid4())
    filename = f"{user_id}.jpg"
    new_user = {
        "id": user_id,
        "email": email_normalized,
        "username": user_data.username or email_normalized.split('@')[0],
        "full_name": user_data.full_name,
        "hashed_password": hashed_password,
        "avatar": filename,
        "hasSeenOnboarding": False,
        "onboardingProgress": {
            "currentStep": 1,
            "completedSteps": [],
            "status": "in_progress",
        },
        "created_at": datetime.now(timezone.utc)
    }
    optional_fields = {
        "school": user_data.school,
        "level": user_data.level,
        "date_of_birth": user_data.date_of_birth,
        "accept_terms": user_data.accept_terms,
        "accept_privacy": user_data.accept_privacy,
    }
    new_user.update({
        key: value
        for key, value in optional_fields.items()
        if value is not None and value != ""
    })

    await users_col.insert_one(new_user)

    tokens = generate_token_pair(user_id, user_data.email)
    if isinstance(tokens, tuple):
        access_token, refresh_token = tokens
        tokens = {"access_token": access_token, "refresh_token": refresh_token}

    await _create_session(user_id, tokens["access_token"], request)

    # ⚠️ Mongo `insert_one` mute `new_user` en y ajoutant `_id` (ObjectId),
    # qui n'est pas sérialisable en JSON par FastAPI et fait planter la
    # réponse en 500. On le retire explicitement, en plus de `hashed_password`.
    return {
        "user": {
            k: v for k, v in new_user.items()
            if k not in ("hashed_password", "_id")
        },
        **tokens,
    }

@app.post("/api/auth/check-email")
@app.post("/auth/check-email")
async def check_email(data: CheckEmailRequest):
    """Vérifie la disponibilité d'un email.
    - 200 {"available": true}  -> email libre
    - 409 {"available": false} -> email déjà utilisé
    - 400                      -> format invalide ou champ manquant
    """
    await _require_mongodb()
    email = (data.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email requis")

    import re
    email_regex = r"^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$"
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Format email invalide")

    users_col = get_collection('users')
    existing = await users_col.find_one({"email": email})

    if existing:
        return JSONResponse(status_code=409, content={"available": False})
    return {"available": True}

@app.get("/api/auth/me")
@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": {k: v for k, v in current_user.items() if k not in ["hashed_password", "_id"]}}

@app.put("/api/auth/me/onboarding")
@app.put("/auth/me/onboarding")
async def update_onboarding_progress(
    progress: OnboardingProgressUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Persist the onboarding state on the authenticated user's account."""
    await _require_mongodb()

    invalid_steps = [
        step for step in progress.completedSteps
        if step < 1 or step > 5
    ]
    if invalid_steps:
        raise HTTPException(
            status_code=422,
            detail="Les étapes complétées doivent être comprises entre 1 et 5.",
        )

    completed_steps = sorted(set(progress.completedSteps))
    has_seen_onboarding = progress.hasSeenOnboarding or progress.status in {
        "dismissed",
        "completed",
    }
    onboarding_progress = {
        "currentStep": progress.currentStep,
        "completedSteps": completed_steps,
        "status": progress.status,
        "updatedAt": datetime.now(timezone.utc),
    }

    users_col = get_collection("users")
    await users_col.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "hasSeenOnboarding": has_seen_onboarding,
                "onboardingProgress": onboarding_progress,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    updated_user = await users_col.find_one({"id": current_user["id"]})
    if not updated_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return {
        "user": {
            key: value
            for key, value in updated_user.items()
            if key not in ("hashed_password", "_id")
        }
    }


# ============================================================================
# AUTH FÉDÉRÉE — Google OAuth + Phone OTP (Firebase)
# ----------------------------------------------------------------------------
# Convergence : tous les flux émettent EXACTEMENT le même couple de JWT que
# /auth/login (via _finalize_auth) afin que le frontend, le middleware
# get_current_user, le refresh et /auth/me restent inchangés.
# ============================================================================
from utils import oauth_google as _oauth_google
from utils import firebase_phone as _firebase_phone
from fastapi.responses import RedirectResponse
import httpx as _httpx


def _public_user(user: dict) -> dict:
    """Vue safe d'un user (sans _id ni hashed_password)."""
    return {k: v for k, v in user.items() if k not in ("_id", "hashed_password")}


def _parse_device(user_agent: str) -> str:
    """Extrait un nom d'appareil court à partir d'un User-Agent. Best-effort."""
    if not user_agent:
        return "Appareil inconnu"
    ua = user_agent
    os_name = "OS inconnu"
    for token, name in [
        ("Windows NT 10", "Windows 10/11"),
        ("Windows NT", "Windows"),
        ("Mac OS X", "macOS"),
        ("iPhone", "iPhone"),
        ("iPad", "iPad"),
        ("Android", "Android"),
        ("Linux", "Linux"),
    ]:
        if token in ua:
            os_name = name
            break
    browser = "Navigateur"
    if "Edg/" in ua:
        browser = "Edge"
    elif "OPR/" in ua or "Opera" in ua:
        browser = "Opera"
    elif "Chrome/" in ua and "Chromium" not in ua:
        browser = "Chrome"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Safari/" in ua and "Chrome/" not in ua:
        browser = "Safari"
    return f"{browser} sur {os_name}"


async def _create_session(user_id: str, access_token: str, request) -> None:
    """Trace une session active dans la collection 'sessions' (best-effort).

    On stocke le `jti` du JWT pour pouvoir, plus tard, identifier dynamiquement
    quelle session correspond à la requête en cours et la marquer `is_current`
    dans l'UI sans modifier le middleware d'auth.
    """
    try:
        from utils.token_manager import SECRET_KEY, ALGORITHM
        decoded = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = decoded.get("jti")
        exp_ts = decoded.get("exp")
        expires_at = (
            datetime.utcfromtimestamp(exp_ts) if exp_ts
            else datetime.utcnow() + timedelta(hours=1)
        )
        ua = (request.headers.get("user-agent") if request else None) or "Inconnu"
        ip = request.client.host if (request and request.client) else None

        sessions_col = get_collection('sessions')
        await sessions_col.insert_one({
            "user_id": user_id,
            "jti": jti,
            "device": _parse_device(ua),
            "user_agent": ua,
            "ip": ip,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "expires_at": expires_at,
        })
    except Exception as e:
        # Non-bloquant : si le tracking échoue, l'auth marche quand même.
        print(f"⚠️ _create_session ignoré: {e}")


async def _finalize_auth(user: dict, request=None) -> dict:
    """Génère exactement la même réponse que /auth/login."""
    subject = user.get("email") or user.get("phone") or user["id"]
    tokens = generate_token_pair(user["id"], subject)
    if isinstance(tokens, tuple):
        access_token, refresh_token = tokens
        tokens = {"access_token": access_token, "refresh_token": refresh_token}
    await _create_session(user["id"], tokens["access_token"], request)
    return {"user": _public_user(user), **tokens, "expires_in": 3600}


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "/").rstrip("/") or "/"


# ---------- Google OAuth ----------------------------------------------------

_GOOGLE_STATE_COOKIE = "g_oauth_state"
_LINK_STATE_PREFIX = "lnk."  # marqueur de "link state" (suivi du JWT signé)


def _make_link_state(user_id: str) -> str:
    """Crée un state JWT court signalant un flux 'liaison' (et non login).

    Le state est signé avec SECRET_KEY (même clé que les access tokens) et
    expire en 10 minutes. Préfixé par `lnk.` pour pouvoir être repéré sans
    tenter un decode JWT systématique côté callback.
    """
    from utils.token_manager import SECRET_KEY, ALGORITHM
    payload = {
        "intent": "link",
        "user_id": user_id,
        "nonce": uuid.uuid4().hex,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return _LINK_STATE_PREFIX + token


def _parse_link_state(state: str) -> Optional[dict]:
    """Renvoie le payload si `state` est un link state valide, sinon None."""
    if not state or not state.startswith(_LINK_STATE_PREFIX):
        return None
    token = state[len(_LINK_STATE_PREFIX):]
    try:
        from utils.token_manager import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception as e:
        print(f"⚠️ link state JWT invalide: {e}")
        return None
    if payload.get("intent") != "link" or not payload.get("user_id"):
        return None
    return payload


@app.get("/api/auth/google")
@app.get("/auth/google")
async def google_oauth_start():
    """Redirige vers l'écran de consentement Google (flux LOGIN)."""
    state = _oauth_google.make_state()
    url = _oauth_google.build_authorize_url(state)
    print(f"[GOOGLE_AUTH][backend] /auth/google START — issuing 302 -> {url[:120]}... | state(prefix)={state[:12]}...")
    resp = RedirectResponse(url=url, status_code=302)
    # Cookie anti-CSRF (state) — court, http-only, secure si HTTPS
    resp.set_cookie(
        _GOOGLE_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return resp


@app.get("/api/auth/google/link")
@app.get("/auth/google/link")
async def google_oauth_link_start(
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    """Démarre un flux OAuth Google en mode LIAISON pour l'utilisateur connecté.

    Renvoie l'URL d'autorisation à laquelle le frontend devra rediriger le
    navigateur (top-level), tout en posant le cookie state HTTP-only.
    Le state encode l'intention "link" et l'`user_id` cible, signés avec
    SECRET_KEY pour empêcher toute usurpation.
    """
    state = _make_link_state(current_user["id"])
    url = _oauth_google.build_authorize_url(state)
    response.set_cookie(
        _GOOGLE_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"authorize_url": url}


@app.get("/api/auth/google/callback")
@app.get("/auth/google/callback")
async def google_oauth_callback(request: Request, code: Optional[str] = None,
                                state: Optional[str] = None,
                                error: Optional[str] = None):
    """Échange le code, vérifie l'id_token, crée/fusionne le compte, puis
    redirige vers FRONTEND_URL/auth/callback#access_token=...&refresh_token=...
    """
    frontend = _frontend_url()
    callback_page = f"{frontend}/auth/callback"
    print(f"[GOOGLE_AUTH][backend] /auth/google/callback HIT — has_code={bool(code)} has_state={bool(state)} error_param={error!r} | FRONTEND_URL resolves to={frontend!r} | callback_page={callback_page!r}")

    def _redirect_with_error(err: str):
        target = f"{callback_page}#error={err}"
        print(f"[GOOGLE_AUTH][backend] callback ERROR -> 302 {target}")
        return RedirectResponse(
            url=target,
            status_code=302,
        )

    if error:
        return _redirect_with_error(error)
    if not code or not state:
        return _redirect_with_error("missing_code_or_state")

    cookie_state = request.cookies.get(_GOOGLE_STATE_COOKIE)
    print(f"[GOOGLE_AUTH][backend] callback state check — cookie_present={bool(cookie_state)} match={cookie_state == state if cookie_state else False}")
    if not cookie_state or cookie_state != state:
        return _redirect_with_error("state_mismatch")

    # Mode "liaison" : si le state est un JWT signé d'intention `link`, on
    # rattache le google_id à l'user_id encodé au lieu d'émettre des tokens.
    link_payload = _parse_link_state(state)

    # 1. Échanger le code
    try:
        token_resp = await _oauth_google.exchange_code_for_tokens(code)
    except _httpx.HTTPStatusError as e:
        print(f"⚠️ google token exchange failed: {e.response.text}")
        return _redirect_with_error("token_exchange_failed")

    id_tok = token_resp.get("id_token")
    if not id_tok:
        return _redirect_with_error("no_id_token")

    # 2. Vérifier l'id_token (signature + audience)
    try:
        claims = _oauth_google.verify_id_token(id_tok)
    except Exception as e:
        print(f"⚠️ google id_token invalid: {e}")
        return _redirect_with_error("id_token_invalid")

    google_sub = claims.get("sub")
    google_email = (claims.get("email") or "").strip().lower() or None
    email_verified = bool(claims.get("email_verified"))
    full_name = claims.get("name") or ""
    picture = claims.get("picture")

    if not google_sub:
        return _redirect_with_error("no_google_sub")

    users_col = get_collection('users')

    # ---- Branche LINK : rattacher google_id à l'user_id du state ----------
    if link_payload:
        target_user_id = link_payload["user_id"]
        target_user = await users_col.find_one({"id": target_user_id})
        profile_page = f"{frontend}/profile"

        def _link_redirect(qs: str):
            r = RedirectResponse(url=f"{profile_page}?{qs}", status_code=302)
            r.delete_cookie(_GOOGLE_STATE_COOKIE, path="/")
            return r

        if not target_user:
            return _link_redirect("linked_error=user_not_found")

        # Refus si ce google_id est déjà attaché à un autre user
        existing = await users_col.find_one({"google_id": google_sub})
        if existing and existing.get("id") != target_user_id:
            return _link_redirect("linked_error=google_already_linked")

        await users_col.update_one(
            {"id": target_user_id},
            {"$set": {
                "google_id": google_sub,
                "providers": list(set((target_user.get("providers") or []) + ["google"])),
                # Si le compte n'avait pas d'email, on profite de Google pour
                # le renseigner (Google atteste l'email).
                **({"email": google_email, "email_verified": True}
                   if google_email and not target_user.get("email") else {}),
                **({"avatar": picture} if picture and not target_user.get("avatar") else {}),
            }},
        )
        return _link_redirect("linked=google")
    # -----------------------------------------------------------------------

    # 3. Recherche / fusion / création (flux LOGIN classique)
    user = await users_col.find_one({"google_id": google_sub})
    if not user and google_email:
        # Fusion : compte email préexistant → on attache l'identité Google
        user = await users_col.find_one({"email": google_email})
        if user:
            await users_col.update_one(
                {"id": user["id"]},
                {"$set": {
                    "google_id": google_sub,
                    "email_verified": True,  # Google atteste l'email
                    "providers": list(set((user.get("providers") or ["email"]) + ["google"])),
                }},
            )
            user = await users_col.find_one({"id": user["id"]})

    if not user:
        # Création
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "email": google_email,
            "email_verified": email_verified,
            "username": (google_email.split('@')[0] if google_email else f"user_{user_id[:8]}"),
            "full_name": full_name,
            "google_id": google_sub,
            "avatar": picture or f"{user_id}.jpg",
            "providers": ["google"],
            "hasSeenOnboarding": False,
            "onboardingProgress": {
                "currentStep": 1,
                "completedSteps": [],
                "status": "in_progress",
            },
            "created_at": datetime.now(timezone.utc),
        }
        # Pas de hashed_password : ce compte ne peut se connecter que via Google
        # (ou via le flux "mot de passe oublié" si on l'active plus tard).
        await users_col.insert_one(new_user)
        user = new_user

    # 4. JWT pair
    auth_payload = await _finalize_auth(user, request)
    from urllib.parse import urlencode
    fragment = urlencode({
        "access_token": auth_payload["access_token"],
        "refresh_token": auth_payload["refresh_token"],
        "expires_in": auth_payload["expires_in"],
    })

    final_url = f"{callback_page}#{fragment}"
    print(f"[GOOGLE_AUTH][backend] callback SUCCESS -> 302 to {final_url[:120]}... (fragment hidden) | user_id={user.get('id')}")
    resp = RedirectResponse(url=final_url, status_code=302)
    # On nettoie le cookie state
    resp.delete_cookie(_GOOGLE_STATE_COOKIE, path="/")
    return resp


# ---------- Phone OTP (Firebase) -------------------------------------------

class PhoneSendCodeRequest(BaseModel):
    phone: str = Field(..., description="Numéro au format E.164, ex: +33612345678")
    recaptcha_token: str = Field(..., description="Token reCAPTCHA obtenu côté frontend")


class PhoneVerifyCodeRequest(BaseModel):
    session_info: str
    code: str
    full_name: Optional[str] = None


@app.post("/api/auth/phone/send-code")
@app.post("/auth/phone/send-code")
async def phone_send_code(payload: PhoneSendCodeRequest):
    phone = (payload.phone or "").strip()
    if not phone.startswith("+") or len(phone) < 8:
        raise HTTPException(status_code=400, detail="Numéro invalide (format E.164 attendu)")
    try:
        data = await _firebase_phone.send_verification_code(phone, payload.recaptcha_token)
    except _httpx.HTTPStatusError as e:
        detail = e.response.text
        print(f"⚠️ Firebase sendVerificationCode failed: {detail}")
        raise HTTPException(status_code=400, detail="Envoi du code impossible")
    session_info = data.get("sessionInfo")
    if not session_info:
        raise HTTPException(status_code=502, detail="Réponse Firebase invalide")
    return {"session_info": session_info}


@app.post("/api/auth/phone/verify-code")
@app.post("/auth/phone/verify-code")
async def phone_verify_code(payload: PhoneVerifyCodeRequest, request: Request):
    if not payload.session_info or not payload.code:
        raise HTTPException(status_code=400, detail="session_info et code requis")
    try:
        data = await _firebase_phone.verify_phone_code(payload.session_info, payload.code)
    except _httpx.HTTPStatusError as e:
        print(f"⚠️ Firebase signInWithPhoneNumber failed: {e.response.text}")
        raise HTTPException(status_code=401, detail="Code invalide ou expiré")

    verified_phone = data.get("verified_phone") or data.get("phoneNumber")
    if not verified_phone:
        raise HTTPException(status_code=502, detail="Numéro non confirmé par Firebase")

    users_col = get_collection('users')
    user = await users_col.find_one({"phone": verified_phone})

    if not user:
        # Création d'un compte phone-only (pas d'email, pas de hashed_password)
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "phone": verified_phone,
            "phone_verified": True,
            "username": f"user_{user_id[:8]}",
            "full_name": payload.full_name or "",
            "avatar": f"{user_id}.jpg",
            "providers": ["phone"],
            "hasSeenOnboarding": False,
            "onboardingProgress": {
                "currentStep": 1,
                "completedSteps": [],
                "status": "in_progress",
            },
            "created_at": datetime.now(timezone.utc),
        }
        await users_col.insert_one(new_user)
        user = new_user
    else:
        # Mise à jour douce (idempotente) : marquer phone_verified à True
        if not user.get("phone_verified"):
            await users_col.update_one(
                {"id": user["id"]},
                {"$set": {
                    "phone_verified": True,
                    "providers": list(set((user.get("providers") or []) + ["phone"])),
                }},
            )
            user = await users_col.find_one({"id": user["id"]})

    return await _finalize_auth(user, request)


# ---------- Liaison de comptes (utilisateur déjà connecté) ------------------

class PhoneLinkVerifyRequest(BaseModel):
    session_info: str
    code: str


def _has_other_auth_method(user: dict, exclude: str) -> bool:
    """Vérifie qu'il reste au moins une méthode de connexion après retrait."""
    methods = []
    if user.get("hashed_password") and user.get("email"):
        methods.append("email")
    if user.get("google_id"):
        methods.append("google")
    if user.get("phone") and user.get("phone_verified"):
        methods.append("phone")
    return any(m != exclude for m in methods)


@app.post("/api/auth/phone/link/send-code")
@app.post("/auth/phone/link/send-code")
async def phone_link_send_code(
    payload: PhoneSendCodeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Envoie un OTP au numéro à rattacher au compte courant."""
    phone = (payload.phone or "").strip()
    if not phone.startswith("+") or len(phone) < 8:
        raise HTTPException(status_code=400, detail="Numéro invalide (format E.164 attendu)")

    # Refus immédiat si déjà rattaché à un autre compte
    users_col = get_collection('users')
    existing = await users_col.find_one({"phone": phone})
    if existing and existing.get("id") != current_user["id"]:
        raise HTTPException(status_code=409, detail="Ce numéro est déjà utilisé par un autre compte")

    try:
        data = await _firebase_phone.send_verification_code(phone, payload.recaptcha_token)
    except _httpx.HTTPStatusError as e:
        print(f"⚠️ Firebase sendVerificationCode (link) failed: {e.response.text}")
        raise HTTPException(status_code=400, detail="Envoi du code impossible")
    session_info = data.get("sessionInfo")
    if not session_info:
        raise HTTPException(status_code=502, detail="Réponse Firebase invalide")
    return {"session_info": session_info}


@app.post("/api/auth/phone/link/verify-code")
@app.post("/auth/phone/link/verify-code")
async def phone_link_verify_code(
    payload: PhoneLinkVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Vérifie l'OTP et rattache le numéro confirmé à l'utilisateur courant."""
    if not payload.session_info or not payload.code:
        raise HTTPException(status_code=400, detail="session_info et code requis")
    try:
        data = await _firebase_phone.verify_phone_code(payload.session_info, payload.code)
    except _httpx.HTTPStatusError as e:
        print(f"⚠️ Firebase signInWithPhoneNumber (link) failed: {e.response.text}")
        raise HTTPException(status_code=401, detail="Code invalide ou expiré")

    verified_phone = data.get("verified_phone") or data.get("phoneNumber")
    if not verified_phone:
        raise HTTPException(status_code=502, detail="Numéro non confirmé par Firebase")

    users_col = get_collection('users')

    # Re-vérifier la collision (race window entre send et verify)
    existing = await users_col.find_one({"phone": verified_phone})
    if existing and existing.get("id") != current_user["id"]:
        raise HTTPException(status_code=409, detail="Ce numéro est déjà utilisé par un autre compte")

    await users_col.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "phone": verified_phone,
            "phone_verified": True,
            "providers": list(set((current_user.get("providers") or []) + ["phone"])),
        }},
    )
    user = await users_col.find_one({"id": current_user["id"]})
    return {"user": _public_user(user), "linked": "phone"}


@app.delete("/api/auth/google/unlink")
@app.delete("/auth/google/unlink")
async def google_unlink(current_user: dict = Depends(get_current_user)):
    """Détache l'identité Google du compte courant.

    Refusé si c'est la seule méthode de connexion restante.
    """
    if not current_user.get("google_id"):
        raise HTTPException(status_code=400, detail="Aucun compte Google n'est lié")
    if not _has_other_auth_method(current_user, exclude="google"):
        raise HTTPException(
            status_code=400,
            detail="Impossible de détacher Google : c'est votre seule méthode de connexion. Définissez d'abord un mot de passe ou liez un numéro.",
        )
    users_col = get_collection('users')
    new_providers = [p for p in (current_user.get("providers") or []) if p != "google"]
    await users_col.update_one(
        {"id": current_user["id"]},
        {
            "$unset": {"google_id": ""},
            "$set": {"providers": new_providers},
        },
    )
    user = await users_col.find_one({"id": current_user["id"]})
    return {"user": _public_user(user), "unlinked": "google"}


@app.delete("/api/auth/phone/unlink")
@app.delete("/auth/phone/unlink")
async def phone_unlink(current_user: dict = Depends(get_current_user)):
    """Détache le numéro de téléphone du compte courant.

    Refusé si c'est la seule méthode de connexion restante.
    """
    if not current_user.get("phone"):
        raise HTTPException(status_code=400, detail="Aucun numéro n'est lié")
    if not _has_other_auth_method(current_user, exclude="phone"):
        raise HTTPException(
            status_code=400,
            detail="Impossible de détacher le numéro : c'est votre seule méthode de connexion. Définissez d'abord un mot de passe ou liez Google.",
        )
    users_col = get_collection('users')
    new_providers = [p for p in (current_user.get("providers") or []) if p != "phone"]
    await users_col.update_one(
        {"id": current_user["id"]},
        {
            "$unset": {"phone": "", "phone_verified": ""},
            "$set": {"providers": new_providers},
        },
    )
    user = await users_col.find_one({"id": current_user["id"]})
    return {"user": _public_user(user), "unlinked": "phone"}


# ============================================================
# RGPD : EXPORT + SUPPRESSION DE COMPTE
# ============================================================

# Liste des collections où l'utilisateur courant peut apparaître via son `id`.
# Pour chaque collection : la liste des champs où matcher (un $or est appliqué
# si plusieurs champs). Cette liste sert à la fois à l'export et à la
# suppression en cascade.
_USER_LINKED_COLLECTIONS = [
    ("posts",                ["user_id", "author_id"]),
    ("comments",             ["user_id", "author_id"]),
    ("stories",              ["user_id"]),
    ("story_comments",       ["user_id"]),
    ("story_reactions",      ["user_id"]),
    ("story_replies",        ["user_id"]),
    ("news_comments",        ["user_id", "author_id"]),
    ("news_likes",           ["user_id"]),
    ("smartclips",           ["user_id"]),
    ("smartclip_comments",   ["user_id"]),
    ("friend_requests",      ["sender_id", "receiver_id", "from_user_id", "to_user_id"]),
    ("user_blocks",          ["user_id", "blocked_user_id"]),
    ("notifications",        ["user_id", "actor_id"]),
    ("favorites",            ["user_id"]),
    ("shares",               ["user_id"]),
    ("devices",              ["user_id"]),
    ("device_sessions",      ["user_id"]),
    ("device_logs",          ["user_id"]),
    ("sessions",             ["user_id"]),
    ("subscriptions",        ["user_id"]),
    ("user_preferences",     ["user_id"]),
    ("user_progress",        ["user_id"]),
    ("user_message_quota",   ["user_id"]),
    ("user_tool_quotas",     ["user_id"]),
    ("watched_videos",       ["user_id"]),
    ("uploads",              ["user_id", "uploaded_by"]),
    ("projects",             ["user_id", "owner_id"]),
    ("builds",               ["user_id"]),
    ("templates",            ["author_id", "user_id"]),
    ("reviews",              ["author_id", "user_id"]),
    ("ai_chats",             ["user_id"]),
]

# Collections conservées mais anonymisées :
#  - messages : on garde l'historique pour les autres participants ; on
#    remplace seulement sender_id par un placeholder.
#  - marketplace/transactions : conservation légale (factures, comptabilité).
_USER_ANONYMIZE_COLLECTIONS = [
    ("messages",             ["sender_id"]),
    ("marketplace_orders",   ["user_id"]),
    ("marketplace_payments", ["user_id"]),
    ("transactions",         ["user_id"]),
    ("payment_history",      ["user_id"]),
]

_DELETED_USER_PLACEHOLDER = "deleted-user"


def _user_match_query(user_id: str, fields: list) -> dict:
    """Construit un filtre Mongo $or sur tous les champs où user_id pourrait apparaître."""
    if len(fields) == 1:
        return {fields[0]: user_id}
    return {"$or": [{f: user_id} for f in fields]}


def _serialize_doc(doc: dict) -> dict:
    """Convertit récursivement les ObjectId en str pour JSON-sérialiser un doc Mongo."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, list):
            out[k] = [
                _serialize_doc(x) if isinstance(x, dict)
                else (str(x) if isinstance(x, ObjectId)
                      else (x.isoformat() if isinstance(x, datetime) else x))
                for x in v
            ]
        elif isinstance(v, dict):
            out[k] = _serialize_doc(v)
        else:
            out[k] = v
    return out


@app.get("/api/auth/me/export")
@app.get("/auth/me/export")
async def export_my_data(current_user: dict = Depends(get_current_user)):
    """Export RGPD : retourne toutes les données associées au compte courant.

    Format : {exported_at, user_id, user, data: {<collection>: [...docs...]}}
    Le navigateur traite la réponse comme un téléchargement (Content-Disposition).
    """
    user_id = current_user["id"]
    bundle = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "user_id": user_id,
        "user": _serialize_doc(_public_user(current_user)),
        "data": {},
    }

    for col_name, fields in _USER_LINKED_COLLECTIONS + _USER_ANONYMIZE_COLLECTIONS:
        try:
            col = get_collection(col_name)
            cursor = col.find(_user_match_query(user_id, fields))
            docs = []
            async for doc in cursor:
                docs.append(_serialize_doc(doc))
            if docs:
                bundle["data"][col_name] = docs
        except Exception as e:
            # Une collection inexistante ne doit pas tout casser
            print(f"⚠️ Export RGPD : collection '{col_name}' ignorée ({e})")

    headers = {
        "Content-Disposition": f'attachment; filename="smartix-export-{user_id}.json"'
    }
    return JSONResponse(content=bundle, headers=headers)


@app.delete("/api/auth/me")
@app.delete("/auth/me")
async def delete_my_account(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_user),
):
    """Supprime définitivement le compte courant et toutes ses données.

    Body JSON attendu :
      - confirmation : doit valoir exactement "SUPPRIMER"
      - password     : OBLIGATOIRE si le compte a un mot de passe local

    Retourne le détail des suppressions (counts par collection).
    """
    if (payload or {}).get("confirmation") != "SUPPRIMER":
        raise HTTPException(
            status_code=400,
            detail="Confirmation requise : envoyez 'SUPPRIMER' dans le champ confirmation.",
        )

    # Si l'utilisateur a un mot de passe local → on le revérifie pour éviter
    # qu'un token volé suffise à supprimer le compte.
    if current_user.get("hashed_password"):
        pwd = (payload or {}).get("password") or ""
        if not pwd:
            raise HTTPException(status_code=400, detail="Mot de passe requis pour confirmer la suppression")
        ok = await verify_password(pwd, current_user["hashed_password"])
        if not ok:
            raise HTTPException(status_code=401, detail="Mot de passe incorrect")

    user_id = current_user["id"]
    user_email = current_user.get("email") or current_user.get("phone") or "(anonyme)"

    # 1. SUPPRESSION en cascade
    deleted_counts = {}
    for col_name, fields in _USER_LINKED_COLLECTIONS:
        try:
            col = get_collection(col_name)
            res = await col.delete_many(_user_match_query(user_id, fields))
            if res.deleted_count > 0:
                deleted_counts[col_name] = res.deleted_count
        except Exception as e:
            print(f"⚠️ Suppression compte : '{col_name}' ignorée ({e})")

    # 2. ANONYMISATION (on garde le doc, on remplace l'id de l'utilisateur)
    anonymized_counts = {}
    for col_name, fields in _USER_ANONYMIZE_COLLECTIONS:
        try:
            col = get_collection(col_name)
            for f in fields:
                res = await col.update_many(
                    {f: user_id},
                    {"$set": {f: _DELETED_USER_PLACEHOLDER}},
                )
                if res.modified_count > 0:
                    anonymized_counts[f"{col_name}.{f}"] = res.modified_count
        except Exception as e:
            print(f"⚠️ Anonymisation : '{col_name}' ignorée ({e})")

    # 3. SUPPRESSION du user lui-même (en dernier)
    users_col = get_collection('users')
    user_delete = await users_col.delete_one({"id": user_id})

    print(
        f"🗑️  Compte supprimé : {user_email} (id={user_id}) — "
        f"{sum(deleted_counts.values())} docs supprimés, "
        f"{sum(anonymized_counts.values())} anonymisés"
    )

    return {
        "deleted": True,
        "user_id": user_id,
        "deleted_counts": deleted_counts,
        "anonymized_counts": anonymized_counts,
        "user_doc_removed": user_delete.deleted_count == 1,
    }


# Mount static files
os.makedirs("backend/uploads/avatars", exist_ok=True)
os.makedirs("backend/uploads/posts", exist_ok=True)
os.makedirs("backend/uploads/marketplace/covers", exist_ok=True)
os.makedirs("backend/uploads/marketplace/products", exist_ok=True)

# Correctly mount the absolute path to ensure FastAPI finds the directory
# Replit specific: the workflow might be running from the root or from backend/
# We will check both or use the most reliable path.
backend_dir = os.path.dirname(os.path.abspath(__file__))
uploads_dir = os.path.join(backend_dir, "uploads")

print(f"DEBUG: Backend file path: {os.path.abspath(__file__)}")
print(f"DEBUG: Mounting uploads from {uploads_dir}")

# Use html_handlers=True to ensure we serve files correctly even if they don't have perfect mime types
app.mount("/uploads", StaticFiles(directory=uploads_dir, html=False), name="uploads")

@app.post("/api/payments/process")
async def api_process_payment(payment: Any = Body(...), current_user: dict = Depends(get_current_user)):
    from routes.marketplace import process_payment
    from models.marketplace import PaymentCreate
    return await process_payment(PaymentCreate(**payment), current_user_id=current_user["id"])

# Include Routers
try:
    from routes.adaptive_feed import router as adaptive_feed_router
    app.include_router(adaptive_feed_router)
except ImportError:
    pass

if news_router:
    app.include_router(news_router, prefix="/api/news", tags=["News"])
    print("✅ News routes registered")
else:
    print("⚠️ News router non chargé (scheduler indisponible)")
if security_router: app.include_router(security_router, prefix="/api", tags=["Security"])
if friends_router: app.include_router(friends_router, prefix="/api", tags=["Friends"])
if friends_debug_router: app.include_router(friends_debug_router, prefix="/api", tags=["Friends"])
if blocked_users_router: app.include_router(blocked_users_router, prefix="/api", tags=["Blocked"])

if marketplace_router: 
    app.include_router(marketplace_router, prefix="/api/marketplace", tags=["Marketplace"])
else:
    try:
        from routes.marketplace import router as marketplace_router_fallback
        app.include_router(marketplace_router_fallback, prefix="/api/marketplace", tags=["Marketplace"])
    except ImportError:
        pass

if courses_router:
    # Routes liées aux cours (ex: /api/courses)
    app.include_router(courses_router, prefix="/api/courses", tags=["Courses"])
    # Routes liées à l'utilisateur et ses cours (ex: /api/user/last-course)
    app.include_router(courses_router, prefix="/api/user", tags=["User Courses"])

# Smartclips Routers
try:
    from routes.smartclips import router as smartclips_router
    app.include_router(smartclips_router, prefix="/api", tags=["SmartClips"])
except ImportError:
    pass

try:
    from routes.smartclips_v2 import router as smartclips_v2_router
    app.include_router(smartclips_v2_router, prefix="/api", tags=["SmartClips V2"])
except ImportError:
    pass

if stories_router: app.include_router(stories_router, prefix="/api", tags=["Stories"])
if posts_router: app.include_router(posts_router, tags=["Posts"])

# Users profile router (GET/PUT/follow) — routes already prefixed with /api/users
try:
    from routes.users import router as users_router
    app.include_router(users_router, tags=["Users"])
    print("✅ Users router activé")
except ImportError as e:
    print(f"⚠️ Users router non disponible: {e}")

# Profile image upload at /auth/upload-image (standalone, no /api prefix)
try:
    from routes.auth_uploads import router as auth_uploads_router
    app.include_router(auth_uploads_router, tags=["Uploads"])
    print("✅ Auth upload-image router activé")
except ImportError as e:
    print(f"⚠️ Auth upload-image router non disponible: {e}")
if comments_router: app.include_router(comments_router, prefix="/api", tags=["Comments"])
if story_reactions_router: app.include_router(story_reactions_router, prefix="/api", tags=["Reactions"])
if subscriptions_router: app.include_router(subscriptions_router, prefix="/api", tags=["Subs"])
if fcm_router: app.include_router(fcm_router, tags=["Notifications"])

# Additional registrations for missing endpoints
from routes.notifications import router as notifications_router
app.include_router(notifications_router, prefix="/api", tags=["Notifications"])

from routes.messaging import router as messaging_router
app.include_router(messaging_router, prefix="/api", tags=["Messaging"])

try:
    from routes.groups import router as groups_router
    app.include_router(groups_router, prefix="/api", tags=["Groups"])
except ImportError:
    pass

# =============================
# VIBE-CODING ROUTES
# =============================
# Projets
try:
    from routes.projects import router as projects_router
    app.include_router(projects_router, prefix="/api/projects", tags=["Vibe Projects"])
    print("✅ Vibe-Coding Projects routes registered")
except ImportError as e:
    print(f"⚠️ Vibe-Coding Projects routes not available: {e}")

# Templates marketplace
try:
    from routes.templates import router as templates_router
    app.include_router(templates_router, prefix="/api/templates", tags=["Vibe Templates"])
    print("✅ Vibe-Coding Templates routes registered")
except ImportError as e:
    print(f"⚠️ Vibe-Coding Templates routes not available: {e}")

# Paiements
try:
    from routes.payments import router as payments_router
    app.include_router(payments_router, prefix="/api/payments", tags=["Vibe Payments"])
    print("✅ Vibe-Coding Payments routes registered")
except ImportError as e:
    print(f"⚠️ Vibe-Coding Payments routes not available: {e}")

# Builds et prévisualisation
try:
    from routes.builds import router as builds_router
    app.include_router(builds_router, prefix="/api/builds", tags=["Vibe Builds"])
    print("✅ Vibe-Coding Builds routes registered")
except ImportError as e:
    print(f"⚠️ Vibe-Coding Builds routes not available: {e}")

# AI Codegen (génération de code via OpenAI)
try:
    from routes.ai_codegen import router as ai_codegen_router
    app.include_router(ai_codegen_router, tags=["AI Codegen"])
    print("✅ AI Codegen routes registered")
except ImportError as e:
    print(f"⚠️ AI Codegen routes not available: {e}")

# AI Suggestions proactives (Écart 7)
try:
    from routes.ai_suggestions import router as ai_suggestions_router
    app.include_router(ai_suggestions_router, tags=["AI Suggestions"])
    print("✅ AI Suggestions routes registered")
except ImportError as e:
    print(f"⚠️ AI Suggestions routes not available: {e}")

# =============================
# SPRINT 5 — Sandbox + Git Rollback
# =============================
try:
    from routes.sandbox import router as sandbox_router
    app.include_router(sandbox_router, tags=["Sandbox"])
    print("✅ Sandbox (Docker) routes registered")
except ImportError as e:
    print(f"⚠️ Sandbox routes not available: {e}")

try:
    from routes.git_rollback import router as git_rollback_router
    app.include_router(git_rollback_router, tags=["Git Rollback"])
    print("✅ Git Rollback routes registered")
except ImportError as e:
    print(f"⚠️ Git Rollback routes not available: {e}")

try:
    from routes.debugger import router as debugger_router
    app.include_router(debugger_router, tags=["Debugger"])
    print("✅ Debugger Sprint 6 routes registered")
except ImportError as e:
    print(f"⚠️ Debugger Sprint 6 routes not available: {e}")

# =============================
# SPRINT 4 — LSP & Terminal PTY
# =============================
try:
    from routes.lsp import router as lsp_router
    app.include_router(lsp_router, tags=["LSP & Terminal"])
    print("✅ LSP & Terminal routes registered")
except ImportError as e:
    print(f"⚠️ LSP & Terminal routes not available: {e}")

# =============================
# SPRINT 3 — GitHub, Deploy, Share
# =============================
try:
    from routes.github import router as github_router
    app.include_router(github_router, tags=["GitHub"])
    print("✅ GitHub routes registered")
except ImportError as e:
    print(f"⚠️ GitHub routes not available: {e}")

try:
    from routes.deploy import router as deploy_router
    app.include_router(deploy_router, tags=["Deploy"])
    print("✅ Deploy routes registered")
except ImportError as e:
    print(f"⚠️ Deploy routes not available: {e}")

try:
    from routes.share import router as share_router
    app.include_router(share_router, tags=["Share"])
    print("✅ Share routes registered")
except ImportError as e:
    print(f"⚠️ Share routes not available: {e}")

# =============================
# COMMUNITY FEED
# =============================
try:
    from routes.community import router as community_router
    app.include_router(community_router, prefix="/api", tags=["Community"])
    print("✅ Community routes registered")
except ImportError as e:
    print(f"⚠️ Community routes not available: {e}")

# =============================
# CONTACT & PARTNER REQUESTS
# =============================
try:
    from routes.contact import router as contact_router
    app.include_router(contact_router, prefix="/api", tags=["Contact"])
    print("✅ Contact routes registered")
except ImportError as e:
    print(f"⚠️ Contact routes not available: {e}")

# =============================
# SPRINT 7 — DB, Cron, Storage, Env Vars, Access Logs
# =============================
try:
    from routes.database import router as database_router
    app.include_router(database_router, tags=["Database"])
    print("✅ Database (PostgreSQL) routes registered")
except ImportError as e:
    print(f"⚠️ Database routes not available: {e}")

try:
    from routes.cron import router as cron_router
    app.include_router(cron_router, tags=["Cron Jobs"])
    print("✅ Cron Jobs routes registered")
except ImportError as e:
    print(f"⚠️ Cron routes not available: {e}")

try:
    from routes.storage import router as storage_router
    app.include_router(storage_router, tags=["Asset Storage"])
    print("✅ Asset Storage routes registered")
except ImportError as e:
    print(f"⚠️ Storage routes not available: {e}")

try:
    from routes.env_vars import router as env_vars_router
    app.include_router(env_vars_router, tags=["Env Variables"])
    print("✅ Env Variables routes registered")
except ImportError as e:
    print(f"⚠️ Env Variables routes not available: {e}")

try:
    from routes.logs import router as logs_router
    app.include_router(logs_router, tags=["Access Logs"])
    print("✅ Access Logs routes registered")
except ImportError as e:
    print(f"⚠️ Access Logs routes not available: {e}")

try:
    from routes.curriculum import router as curriculum_router
    app.include_router(curriculum_router, prefix="/api", tags=["Curriculum"])
    print("✅ Curriculum (Sprint 8) routes registered")
except ImportError as e:
    print(f"⚠️ Curriculum routes not available: {e}")

# =============================
# SOCKET.IO — MOUNT AU PATH /ws
# =============================
if sio_app is not None:
    app.mount('/ws', sio_app)

# =============================
# HEALTH & ROOT ENDPOINTS
# =============================
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/ready")
async def ready():
    """Kubernetes readiness probe — vérifie que l'app est prête à recevoir du trafic."""
    from db import get_db
    db = get_db()
    db_ok = db is not None
    checks = {"api": "ok", "db": "ok" if db_ok else "unavailable"}
    ready_state = db_ok

    if _MONITORING_ENABLED:
        clickhouse_ok = await _clickhouse_client.ping()
        checks["clickhouse"] = "ok" if clickhouse_ok else "unavailable"
        ready_state = ready_state and clickhouse_ok

    return JSONResponse(
        status_code=200 if ready_state else 503,
        content={"status": "ready" if ready_state else "not_ready", "checks": checks},
    )

def _monitoring_required():
    if not _MONITORING_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Monitoring désactivé. Activer MONITORING_ENABLED=true.",
        )

@app.get("/metrics")
async def prometheus_metrics():
    """Endpoint Prometheus pour le scraping des métriques."""
    _monitoring_required()
    data, content_type = _metrics_provider.get_prometheus_output()
    return Response(content=data, media_type=content_type)

@app.get("/api/monitoring/summary")
async def monitoring_summary():
    """Résumé global du monitoring pour le dashboard admin."""
    _monitoring_required()
    return await _analytics_service.get_dashboard_summary()

@app.get("/api/monitoring/performance")
async def monitoring_performance(endpoint: str = None):
    """Performances des endpoints API."""
    _monitoring_required()
    return await _analytics_service.get_api_performance(endpoint)

@app.get("/api/scaling/status")
async def scaling_status():
    """Statut de l'AutoScaler."""
    _monitoring_required()
    return _auto_scaler.get_status()

@app.post("/api/scaling/scale-up")
async def manual_scale_up(by: int = 1):
    """Force un scale up manuel."""
    _monitoring_required()
    return await _auto_scaler.scale_up(by=by)

@app.post("/api/scaling/scale-down")
async def manual_scale_down(by: int = 1):
    """Force un scale down manuel."""
    _monitoring_required()
    return await _auto_scaler.scale_down(by=by)

@app.get("/")
async def root(): return {"message": "Smartix API is running"}

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000)
