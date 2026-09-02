# Smartix Backend — Security Audit Report

**Scope:** Non-invasive review of FastAPI routes for authentication, authorization, and IDOR (Insecure Direct Object Reference) vulnerabilities.
**Method:** Static read-only analysis. No code was modified.
**Auth model:** Per-route opt-in via `Depends(get_current_user)` from `backend/middleware/auth_middleware.py`. There is **no global auth middleware** — every route must add the dependency itself, or it is publicly callable.

Findings are ordered by severity.

---

## CRITICAL

### C1. `PUT /api/users/{user_id}/birthday-settings` — Unauthenticated IDOR
**File:** `backend/routes/birthday.py:11-28`
- No `Depends(get_current_user)`, no ownership check.
- `user_id` is taken straight from the URL and used as the Mongo filter.
- **Impact:** Any unauthenticated caller can overwrite the `birthday_settings` (`notify_friends`, `show_age`) of any user in the DB.
- Bonus issue: `db.users.update_one(...)` is called **without `await`** on an async Motor client — the write may silently no-op or warn, but the route still exposes the endpoint and the auth gap is the real bug.

### C2. `POST /api/posts/{post_id}/reactions` — Unauthenticated reaction spoofing
**File:** `backend/routes/reactions_shares.py:11-50`
- No auth dependency. `user_id` is an **untrusted query/body parameter** and is written verbatim into `db.reactions`.
- **Impact:** Any caller (no token needed) can post reactions *as any user_id they choose* on any post, and trigger a "like" notification to the post author from a forged actor.
- `db.reactions.insert_one(...)` is also missing `await`, but the auth issue is the dominant risk.

### C3. `POST /api/posts/{post_id}/share` (reactions_shares.py) — Unauthenticated share spoofing
**File:** `backend/routes/reactions_shares.py:69-108`
- Same pattern as C2: no auth, `user_id` and `share_type` come from the request, notifications are sent on behalf of the spoofed user.
- **Bonus:** This route collides with `POST /api/posts/{post_id}/share` in `backend/routes/posts.py:103` (which *does* require auth). Whichever router is mounted last wins — if the unauthenticated one wins, the authenticated version is shadowed. **Route registration order should be verified in `server.py`.**

### C4. `POST /api/admin/birthday-reminders-trigger` — Unauthenticated admin trigger
**File:** `backend/routes/birthday.py:46-94`
- "Admin" endpoint with no auth and no role check.
- Iterates today's birthdays and **inserts a public post** (`db.posts.insert_one`) for each matching user, plus fans out notifications to every friend.
- **Impact:** Anyone on the internet can trigger mass post creation and a notification storm at will (DoS / spam / content-injection vector via the templated message containing user-controlled `full_name`).

---

## HIGH

### H1. `GET /api/users/{user_id}/birthday-settings` — Unauthenticated PII read
**File:** `backend/routes/birthday.py:30-44`
- No auth. Leaks per-user notification preferences. Lower impact than C1 but same root cause.
- Same `find_one` missing `await` smell.

### H2. `GET /api/users/{user_id}/upcoming-birthdays` — Unauthenticated, IDOR-shaped
**File:** `backend/routes/birthday.py:96-110`
- No auth. Currently returns an empty list (logic stub), so **no data leak today**, but the contract advertises another user's friends' birthdays. If implemented as named, it becomes a friend-graph leak. Flag for fix-before-implementation.

### H3. `PUT /sellers/profile/{user_id}` — Authorization is structurally broken
**File:** `backend/routes/marketplace.py:1173-1198`, helper `backend/utils/error_handler.py:35-39`
- Signature: `current_user_id: str = Depends(get_current_user)`. But `get_current_user` returns a **dict**, not a string. So `current_user_id` is a dict at runtime.
- `validate_seller_ownership(current_user_id, user_id)` does `if user_id != seller_id: raise AuthorizationError`. A dict is never equal to a string, so **every authenticated call raises 403** — the endpoint is effectively unusable.
- Net effect today: not exploitable (fails closed), but the ownership check is not actually being performed. If anyone "fixes" the 403 by extracting `current_user_id["id"]` without re-confirming the comparison, IDOR is one keystroke away. Treat as a latent authorization bug.

### H4. `GET /api/posts/{post_id}/reactions` — Unauthenticated read of reactions
**File:** `backend/routes/reactions_shares.py:52-67`
- No auth. Aggregated reaction counts on any post. Lower sensitivity but inconsistent with the rest of `/api/posts` which requires auth.

---

## MEDIUM

### M1. `GET /groups/discover` and `GET /groups/{group_id}` — Unauthenticated
**File:** `backend/routes/groups.py:87-101`
- Both list/detail GETs have no `Depends(get_current_user)`.
- `discover` filters to `visibility: "public"` → acceptable.
- `GET /groups/{group_id}` returns the **full group document** including the `members` array (user IDs) regardless of `visibility`. Private/secret groups will leak their member list to anonymous callers.
- Recommendation: require auth, and when the group is non-public, restrict the response to non-members (or 404).

### M2. `POST /groups/{group_id}/join` — No visibility check
**File:** `backend/routes/groups.py:55-85`
- Authenticated, but any user can `$addToSet` themselves into any group, including non-public ones. Visibility / invitation status is never consulted.
- Combined with M1, an attacker can enumerate private groups and silently join them.

### M3. Notification spoofing surface inherited from C2/C3
- Because `reactions_shares.py` accepts a forged `user_id`, the `create_notification(...)` call uses attacker-controlled `actor_name` / `actor_avatar` (looked up from the spoofed id). Victims see legitimate-looking notifications attributed to arbitrary accounts. Tracked here for visibility; root fix is C2/C3.

---

## LOW / HYGIENE

- **L1.** `birthday.py` and `reactions_shares.py` both use `from server import db` instead of `db.get_db()`, and call Motor methods (`update_one`, `find_one`, `insert_one`) **without `await`**. These are silent correctness bugs that also mask whether the vulnerable writes are actually persisting in production.
- **L2.** Duplicate route declarations for `POST /api/posts/{post_id}/share` (`posts.py` vs `reactions_shares.py`). Whichever is registered last wins; behavior depends on import order in `server.py`.
- **L3.** `posts.py:188 GET /api/posts` requires auth but has no pagination caps beyond client-supplied `skip`/`limit` — a logged-in user can request arbitrarily large pages. Not a security flaw per se, but a DoS amplifier.
- **L4.** `subscriptions.py POST /subscriptions/create` accepts `payment_method`, `operator`, `phone_number` from the body and immediately marks the subscription **active** with a synthetic `transaction_id`. The file comment admits this is a simulation. If this code path is reachable in production, **any authenticated user can self-grant `yearly` Premium for free**. Flag explicitly before any go-live.
- **L5.** `auth_middleware.py:126-131` catches generic `Exception` and returns a 500 containing `str(e)` to the client. This can leak internal details (driver errors, connection strings if they appear in messages). Prefer logging server-side and returning a generic message.

---

## Confirmed-Safe Patterns (spot-checked)

These routes correctly enforce auth **and** ownership:

- `friends.py DELETE /{friend_id}` (uses authenticated `current_user["id"]` to build the canonical pair; cannot delete arbitrary relations).
- `conversations.py POST /{conversation_id}/restore` (filters `participants: user_id` in the update query → can't restore conversations you're not in).
- `subscriptions.py` — all endpoints scope queries by `current_user["id"]`; no IDOR on status/history/cancel.
- `posts.py` `/api/posts`, `/api/posts/upload`, `/api/posts` (create), `/api/posts/{post_id}/share`, `/api/posts/{post_id}` (detail), `/api/posts` (list) — all gated by `get_current_user`. Note the share route has no ownership requirement, which is correct for sharing semantics.
- `groups.py` `GET /groups`, `POST /groups`, `POST /groups/{group_id}/join`, `GET /groups/invitations/received` — auth enforced. (Authorization gaps in `join` covered by M2.)
- `community.py POST /community/posts/{post_id}/like` — auth enforced; toggles using authenticated `user_id`.

---

## Recommended Remediation Order

1. **C1, C2, C3, C4** — add `Depends(get_current_user)` to every route in `backend/routes/birthday.py` and `backend/routes/reactions_shares.py`; replace any URL/body `user_id` with `current_user["id"]`; gate the admin trigger behind a real role check; restrict it to internal callers (cron / admin token).
2. **H1, H2, H4** — same pattern (auth dep + scope by `current_user["id"]`).
3. **H3** — change signature to `current_user: dict = Depends(get_current_user)` and call `validate_seller_ownership(current_user["id"], user_id)`. Re-test that owners can edit and non-owners get 403.
4. **M1, M2** — require auth on group GETs; in `join`, reject non-public groups unless the user has an accepted invitation.
5. **L1** — add `await` to all Motor calls in `birthday.py` and `reactions_shares.py`; standardize on the `db.get_db()` accessor.
6. **L2** — pick one canonical implementation of `POST /api/posts/{post_id}/share` and remove the other.
7. **L4** — gate `subscriptions/create` behind a real Mobile Money webhook before deploying to production.

---

*End of initial report.*

---

# Remediation Log — 2026-04-22

All eight correction lots authorized by the user have been applied. Backend restarted cleanly (`backend-main` workflow: "Application startup complete").

## Lot 1 — C2 fixed (`backend/routes/reactions_shares.py`)
- `POST /api/posts/{post_id}/reactions` now requires `Depends(get_current_user)`.
- Removed the spoofable `user_id` request parameter. `user_id = current_user["id"]`.
- Added `await` to the `db.reactions.insert_one(...)` call (was silently non-awaited).
- 500 errors now return a generic message; details are logged server-side.

## Lot 2 — C3 fixed (`backend/routes/reactions_shares.py`)
- The unauthenticated `POST /api/posts/{post_id}/share` route was **removed entirely** from this module.
- Resolves the duplicate-route conflict with `backend/routes/posts.py:103`, which is now the single canonical, authenticated implementation.
- `GET /api/posts/{post_id}/shares` retained but now requires auth.

## Lot 3 — C1 fixed (`backend/routes/birthday.py`)
- `PUT /api/users/{user_id}/birthday-settings` requires auth and rejects with **403** when `current_user["id"] != user_id`.
- `db.users.update_one(...)` is now properly awaited.
- Switched from `from server import db` to `from db import get_db` (the canonical accessor).

## Lot 4 — C4 fixed (`backend/routes/birthday.py`)
- `POST /api/admin/birthday-reminders-trigger` requires auth **and** `current_user.get("role") == "admin"` — otherwise 403.
- All Motor calls inside the loop are awaited; per-iteration failures are logged via `logger.exception` instead of swallowed `print`.

## Lot 5 — H3 fixed (`backend/routes/marketplace.py:1176-1184`)
- Signature changed from `current_user_id: str = Depends(get_current_user)` (which actually held a dict and made the route always 403) to `current_user: dict = Depends(get_current_user)`.
- Ownership check now correctly calls `validate_seller_ownership(current_user["id"], user_id)`. Owners can edit; everyone else gets 403.

## Lot 6 — H1 / H2 / H4 fixed
- `GET /api/users/{user_id}/birthday-settings` and `GET /api/users/{user_id}/upcoming-birthdays` now require auth and enforce `current_user["id"] == user_id` (403 otherwise). Reads use `await`.
- `GET /api/posts/{post_id}/reactions` and `GET /api/posts/{post_id}/shares` now require auth.

## Lot 7 — M1 / M2 fixed (`backend/routes/groups.py`)
- `GET /groups/discover` now requires auth, caps `limit` to 100, and strips the `members` array from each returned group (no roster leak in discovery).
- `GET /groups/{group_id}` requires auth and **removes the `members` array** for callers who are neither the owner, an existing member, nor looking at a public group.
- `POST /groups/{group_id}/join` rejects (403) any join attempt against a non-public group unless the caller has a pending invitation in `group_invitations`.

## Lot 8 — Hygiene (L1–L5)
- **L1**: All Motor calls in `birthday.py` and `reactions_shares.py` now correctly use `await`.
- **L1 / 8.2**: Both files now import `from db import get_db` instead of `from server import db`.
- **L2**: Duplicate `POST /api/posts/{post_id}/share` removed from `reactions_shares.py`. The authenticated implementation in `posts.py` is now the only one.
- **L3**: `GET /api/posts` clamps `skip >= 0` and `1 <= limit <= 100` before querying Mongo.
- **L4**: 500 responses in the modified routes (and in `auth_middleware.py`) no longer expose `str(e)`; they return `"Erreur serveur"` and log via `logger.exception`.
- **L5**: `POST /subscriptions/create` is now gated by `ENABLE_SUBSCRIPTION_SIMULATION=1`. By default the route returns **503**, blocking the free-Premium issue in production.

## Verification
- `backend-main` workflow restarted: `Application startup complete` / `Uvicorn running on http://0.0.0.0:8000`.
- No new errors in startup logs; all route registration messages still printed.
- Frontend (`Main_App_Frontend_v2`) still compiles successfully.


---

## Remediation lot 9 — 17 corrections (audit complet)

Date : 2026-04-22
Statut : APPLIQUÉES

### Fichiers créés
- `backend/utils/validators.py` — `validate_object_id`, `is_valid_object_id`, `validate_id_string`
- `backend/utils/audit_log.py` — `log_action()`, `get_client_ip()` ; collection `audit_logs`
- `backend/routes/users.py` — `GET/PUT /api/users/{user_id}`, `POST /api/users/{user_id}/follow`
- `backend/routes/auth_uploads.py` — `POST /auth/upload-image` (5MB cap, MIME whitelist jpeg/png/webp/gif)

### Fichiers modifiés
- `backend/routes/posts.py`
  - `POST /api/posts/upload` : check MIME (jpeg/png/webp/gif), size (5MB), extension safe.
  - `POST /api/posts` : cap contenu 5000 caractères.
  - `DELETE /api/posts/{post_id}` : soft-delete, owner only, audit log.
  - `POST /api/posts/{post_id}/restore` : owner only, vérifie corbeille + expiration 30 j.
  - `POST /api/posts/{post_id}/save` : toggle save/unsave.
  - Helper `_find_post()` pour lookup uuid/ObjectId.
- `backend/routes/groups.py`
  - `POST /groups` : validation longueur 3–100, quota 50 par owner.
  - `POST /groups/{group_id}/join` : 409 si déjà membre, 400 si capacité (1000) atteinte.
- `backend/routes/subscriptions.py`
  - `POST /cancel` : 404 si aucun abonnement actif (au lieu de succès silencieux).
- `backend/middleware/rate_limit.py`
  - Ajout préfixes : `/auth/upload-image` (10/min), `/api/posts/upload` (20/min), `/api/posts` (30/min), `/api/groups` (10/min), `/api/users` (60/min).
- `backend/server.py`
  - Enregistrement `users_router` et `auth_uploads_router`.
- `backend/routes/uploads.py`
  - Note pointant vers `auth_uploads.py` (le module a un `ImportError` pré-existant sur `utils.file_uploader` non résolu ici).

### Vérification
Restart backend OK ; OpenAPI confirme l'enregistrement de :
`GET/PUT/POST /api/users/{user_id}[/follow]`, `DELETE/POST /api/posts/{post_id}[/restore|/save]`, `POST /auth/upload-image`, `POST /api/subscriptions/cancel` (avec 404), `POST /api/groups[/{group_id}/join]` (avec 409/quotas).
