"""Firebase Phone Auth — relais REST côté serveur.

⚠️ Contrainte technique imposée par Firebase, pas un choix d'architecture :
   l'envoi d'un SMS via Firebase Phone Auth nécessite *toujours* un token
   reCAPTCHA fourni par le navigateur. Le Firebase Admin SDK seul ne peut
   pas déclencher l'envoi d'un OTP. Ce module agit donc comme un proxy
   entre le frontend (qui détient le recaptchaToken) et l'endpoint REST
   `identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode`.

Variables d'environnement requises :
  - FIREBASE_API_KEY                        (clé Web API du projet Firebase)
  - FIREBASE_PROJECT_ID                     (utilisé par firebase-admin)
  - FIREBASE_SERVICE_ACCOUNT_JSON           (chemin vers le JSON du service
                                             account, optionnel si ADC dispo)
"""
from __future__ import annotations

import os

import httpx
import firebase_admin
from firebase_admin import auth as fb_auth, credentials

IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1"

_initialized = False


def _init_firebase_admin() -> None:
    """Initialise firebase_admin une seule fois (idempotent)."""
    global _initialized
    if _initialized:
        return
    if firebase_admin._apps:
        _initialized = True
        return

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    options = {"projectId": project_id} if project_id else None

    try:
        if sa_path and os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred, options or {})
        else:
            # Application Default Credentials (utile sur GCP) ou aucun cred.
            # Les appels REST fonctionneront quand même (FIREBASE_API_KEY
            # suffit pour sendVerificationCode / signInWithPhoneNumber).
            firebase_admin.initialize_app(options=options or None)
    except Exception as e:
        # Pas critique : verify_id_token ne sera juste pas dispo
        print(f"⚠️ firebase_admin init non bloquante a échoué: {e}")
    _initialized = True


def _api_key() -> str:
    k = os.getenv("FIREBASE_API_KEY")
    if not k:
        raise RuntimeError("FIREBASE_API_KEY env var manquante")
    return k


async def send_verification_code(phone_number: str, recaptcha_token: str) -> dict:
    """Renvoie {sessionInfo: '...'} ou lève httpx.HTTPStatusError.

    `phone_number` doit être au format E.164 (ex: +33612345678).
    """
    _init_firebase_admin()
    payload = {
        "phoneNumber": phone_number,
        "recaptchaToken": recaptcha_token,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{IDENTITY_TOOLKIT}/accounts:sendVerificationCode",
            params={"key": _api_key()},
            json=payload,
        )
    r.raise_for_status()
    return r.json()


async def verify_phone_code(session_info: str, code: str) -> dict:
    """Renvoie {idToken, refreshToken, localId, phoneNumber, isNewUser, verified_phone}
    ou lève httpx.HTTPStatusError.
    """
    _init_firebase_admin()
    payload = {"sessionInfo": session_info, "code": code}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{IDENTITY_TOOLKIT}/accounts:signInWithPhoneNumber",
            params={"key": _api_key()},
            json=payload,
        )
    r.raise_for_status()
    data = r.json()
    # Sécurité supplémentaire : on revérifie l'id_token côté serveur via
    # firebase-admin, ce qui prouve cryptographiquement le numéro.
    try:
        decoded = fb_auth.verify_id_token(data["idToken"])
        data["verified_phone"] = decoded.get("phone_number") or data.get("phoneNumber")
    except Exception:
        # Si firebase-admin n'a pas pu être initialisé (pas de service account),
        # on retombe sur le numéro renvoyé par l'endpoint REST de Firebase
        # (qui reste source de vérité pour ce flux).
        data["verified_phone"] = data.get("phoneNumber")
    return data
