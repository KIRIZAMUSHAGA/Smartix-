"""Google OAuth 2.0 helpers (Authorization Code flow, redirect-based).

Pas de SDK lourd : on utilise httpx (déjà présent dans requirements.txt) et
google.oauth2.id_token fourni transitivement par firebase-admin / google-auth.

Variables d'environnement requises :
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - GOOGLE_REDIRECT_URI   (ex: https://<domain>/api/auth/google/callback)
"""
from __future__ import annotations

import os
import secrets
from urllib.parse import urlencode

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _client_id() -> str:
    cid = os.getenv("GOOGLE_CLIENT_ID")
    if not cid:
        raise RuntimeError("GOOGLE_CLIENT_ID env var manquante")
    return cid


def _client_secret() -> str:
    cs = os.getenv("GOOGLE_CLIENT_SECRET")
    if not cs:
        raise RuntimeError("GOOGLE_CLIENT_SECRET env var manquante")
    return cs


def _redirect_uri() -> str:
    ru = os.getenv("GOOGLE_REDIRECT_URI")
    if not ru:
        raise RuntimeError("GOOGLE_REDIRECT_URI env var manquante")
    return ru


def make_state() -> str:
    """Anti-CSRF state à signer/vérifier via cookie côté serveur."""
    return secrets.token_urlsafe(32)


def build_authorize_url(state: str) -> str:
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
        "access_type": "online",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict:
    """Échange le `code` reçu contre un dict {access_token, id_token, ...}."""
    data = {
        "code": code,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri": _redirect_uri(),
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(GOOGLE_TOKEN_URL, data=data)
    r.raise_for_status()
    return r.json()


def verify_id_token(token: str) -> dict:
    """Vérifie l'id_token Google et renvoie les claims (sub, email, name, picture,
    email_verified). Lève ValueError si invalide ou si l'audience ne correspond
    pas à GOOGLE_CLIENT_ID.
    """
    request = google_requests.Request()
    claims = google_id_token.verify_oauth2_token(token, request, _client_id())
    iss = claims.get("iss")
    if iss not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError(f"Issuer Google inattendu: {iss}")
    return claims
