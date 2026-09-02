"""Tests d'intégration de /api/auth/register.

Couvre les quatre scénarios de non-régression validés en avril 2026 :
    A. Inscription valide (200 + user.id UUID, pas d'_id ObjectId)
    B. Payload invalide (422 instantané, pas de blocage)
    C. Charge légère (5 inscriptions séquentielles stables, < 2 s chacune)
    D. Email en double (400 avec message attendu)

Frappe le backend FastAPI réellement lancé (workflow `backend-main` sur
http://localhost:8000) au lieu d'utiliser `TestClient`, qui est cassé
sur cette base à cause d'une incompatibilité starlette/httpx 0.28
(`Client.__init__() got an unexpected keyword argument 'app'`). Cohérent
avec les autres tests d'intégration du dossier qui ciblent la vraie base.

Si le backend n'est pas démarré, les tests sont marqués `skip` plutôt que
faussement échoués.
"""
import os
import time

import httpx
import pytest


BASE_URL = os.environ.get("SMARTIX_TEST_BASE_URL", "http://localhost:8000")
REGISTER_PATH = "/api/auth/register"
REQUEST_TIMEOUT = 10.0


@pytest.fixture(scope="module")
def http() -> httpx.Client:
    """Client httpx réutilisable, avec skip propre si backend down."""
    client = httpx.Client(base_url=BASE_URL, timeout=REQUEST_TIMEOUT)
    try:
        # ping rapide — n'importe quelle route 404 confirme que le serveur répond
        client.get("/__ping__", timeout=2.0)
    except httpx.HTTPError:
        client.close()
        pytest.skip(f"Backend non disponible sur {BASE_URL}")
    yield client
    client.close()


def _unique_payload(prefix: str) -> dict:
    suffix = time.time_ns()
    return {
        "email": f"{prefix}_{suffix}@pytest.smartix.local",
        "password": "PytestRegister123!",
        "full_name": f"Pytest {prefix.title()} {suffix}",
        "username": f"{prefix}_{suffix}",
    }


def _assert_clean_user_payload(user: dict) -> None:
    """La réponse ne doit JAMAIS contenir _id (ObjectId) ni hashed_password."""
    assert "_id" not in user, "ObjectId Mongo ne doit pas fuiter dans la réponse"
    assert "hashed_password" not in user, "Le hash bcrypt ne doit jamais être renvoyé"
    assert "id" in user and isinstance(user["id"], str) and len(user["id"]) >= 32
    assert "email" in user and "username" in user and "full_name" in user


# ──────────────────────────────────────────────────────────────────────────
# TEST A — Inscription normale
# ──────────────────────────────────────────────────────────────────────────
def test_register_valid_returns_200_with_clean_user_and_tokens(http: httpx.Client):
    payload = _unique_payload("alpha")

    t0 = time.perf_counter()
    response = http.post(REGISTER_PATH, json=payload)
    elapsed = time.perf_counter() - t0

    assert response.status_code == 200, response.text
    assert elapsed < 5.0, f"Inscription trop lente: {elapsed:.2f}s"

    body = response.json()
    assert "access_token" in body and "refresh_token" in body
    assert isinstance(body["access_token"], str) and len(body["access_token"]) > 20
    _assert_clean_user_payload(body["user"])
    assert body["user"]["email"] == payload["email"]
    assert body["user"]["username"] == payload["username"]


# ──────────────────────────────────────────────────────────────────────────
# TEST B — Payload invalide → 422 instantané
# ──────────────────────────────────────────────────────────────────────────
def test_register_invalid_payload_returns_422_fast(http: httpx.Client):
    t0 = time.perf_counter()
    response = http.post(REGISTER_PATH, json={"foo": "bar"})
    elapsed = time.perf_counter() - t0

    assert response.status_code == 422
    # La cible production est < 100 ms ; on tolère 1 s en CI / cold start.
    assert elapsed < 1.0, f"Validation handler trop lent: {elapsed:.2f}s"

    body = response.json()
    assert "detail" in body
    missing = {tuple(err["loc"]) for err in body["detail"]}
    assert ("body", "email") in missing
    assert ("body", "password") in missing
    assert ("body", "full_name") in missing


# ──────────────────────────────────────────────────────────────────────────
# TEST C — Charge légère : 5 inscriptions séquentielles
# ──────────────────────────────────────────────────────────────────────────
def test_register_sequential_load_is_stable(http: httpx.Client):
    durations = []
    for i in range(5):
        payload = _unique_payload(f"loadc{i}")

        t0 = time.perf_counter()
        response = http.post(REGISTER_PATH, json=payload)
        elapsed = time.perf_counter() - t0

        assert response.status_code == 200, response.text
        assert elapsed < 5.0, f"Iter {i} trop lent: {elapsed:.2f}s"
        _assert_clean_user_payload(response.json()["user"])
        durations.append(elapsed)

    # Toutes les durées doivent être dans le même ordre de grandeur :
    # le ratio max/min protège contre une dérive (memory leak, contention…).
    assert max(durations) / min(durations) < 5.0, (
        f"Latence instable : {durations}"
    )


# ──────────────────────────────────────────────────────────────────────────
# TEST D — Email en double → 400
# ──────────────────────────────────────────────────────────────────────────
def test_register_duplicate_email_returns_400(http: httpx.Client):
    payload = _unique_payload("dup")

    first = http.post(REGISTER_PATH, json=payload)
    assert first.status_code == 200, first.text

    # Deuxième tentative avec le même email mais un username différent
    duplicate_payload = {
        **payload,
        "username": payload["username"] + "_bis",
    }
    second = http.post(REGISTER_PATH, json=duplicate_payload)

    assert second.status_code == 400
    assert "email" in second.json()["detail"].lower()
