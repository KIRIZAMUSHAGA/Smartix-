"""
Configuration centralisée du rate limiting (Sprint Audit RL).

Format multi-bucket :
    "<pattern>": {"minute": N, "hour": N, "day": N}

Le pattern supporte les wildcards `*` (un segment) via fnmatch.
Le premier pattern qui matche le path gagne — les patterns plus spécifiques
doivent donc être placés avant les patterns génériques.

Buckets disponibles :
    - "second" : 1s   (anti-burst)
    - "minute" : 60s
    - "hour"   : 3600s
    - "day"    : 86400s

Chaque bucket est vérifié indépendamment ; si AU MOINS un bucket est dépassé,
la requête est bloquée (HTTP 429).
"""

from typing import Dict

BUCKET_WINDOWS: Dict[str, int] = {
    "second": 1,
    "minute": 60,
    "hour":   3600,
    "day":    86400,
}

# ─── Whitelist (aucun rate limit) ────────────────────────────────────────────
WHITELIST_PATHS = {
    "/health",
    "/ping",
    "/api/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/metrics",
    "/ready",
    # ─── Inscription : rate limit désactivé pour les tests ────────────
    "/api/auth/register",
    "/auth/register",
    "/api/auth/check-username",
    "/auth/check-username",
    "/api/auth/check-email",
    "/auth/check-email",
}

WHITELIST_PREFIXES = (
    "/static",
)

# ─── Limites par pattern (premier match gagne) ───────────────────────────────
# IMPORTANT : ordonner du plus spécifique au plus générique.
RATE_LIMITS_CONFIG: Dict[str, Dict[str, int]] = {
    # ─── Authentification ────────────────────────────────────────────────
    "/api/auth/login":              {"minute": 5,  "hour": 20},
    "/auth/login":                  {"minute": 5,  "hour": 20},
    "/api/auth/register":           {"hour":   3,  "day":  10},
    "/auth/register":               {"hour":   3,  "day":  10},
    "/api/auth/check-username":     {"minute": 20, "hour": 200},
    "/auth/check-username":         {"minute": 20, "hour": 200},
    "/api/auth/check-email":        {"minute": 60, "hour": 600},
    "/auth/check-email":            {"minute": 60, "hour": 600},
    "/api/auth/reset-password":     {"hour":   3,  "day":   5},
    "/api/auth/forgot-password":    {"hour":   3,  "day":   5},
    "/api/auth/otp":                {"hour":   3,  "day":  10},
    "/api/auth/verify-email":       {"hour":  10,  "day":  20},

    # ─── Sécurité (changement password / email / sessions) ──────────────
    "/api/security/change-password": {"hour":  5,  "day":  10},
    "/api/security/change-email":    {"hour":  3,  "day":   5},
    "/api/security/email/confirm/*": {"hour": 10,  "day":  20},
    "/api/security/account/*":       {"hour":  5,  "day":  10},

    # ─── Notifications / Emails / Push ──────────────────────────────────
    "/api/notifications/create":           {"minute": 10, "hour":  50},
    "/api/notifications/mark-read":        {"minute": 60, "hour": 500},
    "/api/notifications/register-token":   {"minute": 10, "hour":  30},
    "/api/notifications/unregister-token": {"minute": 10, "hour":  30},

    # ─── SmartClips — interactions ──────────────────────────────────────
    "/api/smartclips/*/comment":  {"minute":  5, "day":  100},
    "/api/smartclips/*/like":     {"minute": 60, "day": 1000},
    "/api/smartclips/*/save":     {"minute": 60, "day": 1000},
    "/api/smartclips/*/share":    {"minute": 60, "day": 1000},

    # ─── SmartClips — création (coût stockage/transcodage) ──────────────
    "/api/smartclips":            {"minute":  1, "day":    5},
    "/api/smartclips/v2/*":       {"minute": 30, "hour": 200},

    # ─── Stories ────────────────────────────────────────────────────────
    "/api/story-export/*":        {"hour":   5, "day":  10},
    "/api/stories":               {"minute":  5, "day":  50},

    # ─── Posts ──────────────────────────────────────────────────────────
    "/api/posts/upload":          {"minute": 20, "day": 100},
    "/api/posts/*/like":          {"minute": 30, "day": 500},
    "/api/posts/*/comment":       {"minute":  5, "day": 100},
    "/api/posts/*/save":          {"minute": 30, "day": 500},
    "/api/posts":                 {"minute": 30, "hour": 200},

    # ─── Uploads (anti-saturation disque) ───────────────────────────────
    "/auth/upload-image":         {"minute": 10, "day":  30},
    "/api/uploads/simple":        {"minute": 20, "day": 100},
    "/api/uploads/chunk/*":       {"minute": 60, "day": 500},
    "/api/uploads/download/*":    {"hour":   20, "day": 100},
    "/api/uploads":               {"minute": 30, "hour": 200},

    # ─── Downloads / Exports ────────────────────────────────────────────
    "/api/marketplace/orders/*/download": {"hour": 20, "day": 100},
    "/api/export/download/*":             {"hour": 20, "day": 100},

    # ─── IA / OpenAI (coût) ─────────────────────────────────────────────
    "/api/ai/generate-image":     {"minute":  5, "day":  20},
    "/api/ai/generate":           {"minute": 10, "day":  50},
    "/api/ai/generate-tests":     {"minute": 10, "day":  50},
    "/api/ai/generate-docs":      {"minute": 10, "day":  50},
    "/api/ai/search":             {"minute": 30, "day": 200},
    "/api/ai":                    {"minute": 10, "day":  50},
    "/api/ai-suggestions":        {"minute": 20, "day": 200},
    "/api/ai-chat":               {"minute": 20, "day": 200},

    # ─── Marketplace (preview, paiements, reviews) ──────────────────────
    "/api/marketplace/products/*/generate-preview": {"hour":  3, "day":   5},
    "/api/marketplace/products/upload":             {"hour":  5, "day":  20},
    "/api/marketplace/orders/create":               {"hour": 10, "day":  30},
    "/api/marketplace/payments/process":            {"hour": 20, "day":  50},
    "/api/marketplace/reviews":                     {"minute":10, "day": 100},
    "/api/marketplace":                             {"minute":60, "hour":500},

    # ─── Recherche ──────────────────────────────────────────────────────
    "/api/search":                {"minute": 30, "day": 500},
    "/api/users/search":          {"minute": 30, "day": 500},
    "/api/tags/search":           {"minute": 30, "day": 500},
    "/api/templates/search":      {"minute": 30, "day": 500},
    "/api/templates":             {"minute": 60, "hour": 300},
    "/api/friends/users/search":  {"minute": 30, "day": 500},
    "/api/friends/tags/search":   {"minute": 30, "day": 500},

    # ─── Messaging / Conversations (anti-spam) ──────────────────────────
    "/api/messaging":             {"minute": 30, "hour": 300},
    "/api/conversations":         {"minute": 30, "hour": 300},
    "/api/comments":              {"minute":  5, "day":  100},

    # ─── Sandbox / Vibe-Coding (coût containers) ────────────────────────
    "/api/sandbox/create":        {"minute": 10, "day":  50},
    "/api/sandbox":               {"minute": 30, "day": 500},
    "/api/lsp":                   {"minute": 60, "day":2000},
    "/api/builds":                {"minute": 10, "day": 100},
    "/api/deploy":                {"minute":  5, "day":  20},

    # ─── Profils / Lectures ─────────────────────────────────────────────
    "/api/users":                 {"minute": 60, "hour": 600},
    "/api/projects":              {"minute": 60, "hour": 600},
    "/api/groups":                {"minute": 10, "hour": 100},

    # ─── WebSocket upgrades ─────────────────────────────────────────────
    "/ws":                        {"minute": 20, "hour": 100},

    # ─── Défaut API ─────────────────────────────────────────────────────
    "/api":                       {"minute": 120, "hour":2000},
}
