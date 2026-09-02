# Smartix

## Corrections récentes (30 avril 2026)
Correction de 5 bugs reportés (Vibe redirect, Feed vide, News load_error, Shop "erreur chargement produits", Seller Dashboard erreur stats + bouton retour) :

**Frontend**
- `App.js` : `ProtectedRoute` ne redirige plus systématiquement les utilisateurs connectés vers `/home` (uniquement sur la route `/auth`).
- `config/api.js` : `createApiClient` accepte désormais l'absence de `refreshToken` (no-op) au lieu de planter — c'était la cause commune des erreurs Feed/News/Shop/Stats.
- `hooks/useAuth.js` : expose `refreshToken` au contexte API.
- `pages/Feed.js` : suppression du double préfixe `/api/...` sur les appels notifications et posts.
- `pages/SellerDashboard.js` : ajout du bouton retour (`navigate(-1)`).
- `i18n/locales/{fr,en}/translation.json` : ajout de la clé `news.load_error`.

**Backend** (déblocage des routeurs `news` et `marketplace` qui étaient silencieusement en `None`)
- `app/config.py` : ajout de la fonction `update_config` manquante (utilisée par `app/news/scheduler.py`).
- `jobs.py` : correction des imports `backend.models.*` et `backend.db` → `models.*` et `db`.
- `marketplace_config.py` (déplacé depuis `config/marketplace_config.py` qui entrait en conflit avec `config.py`) ; utilise désormais `pydantic.BaseSettings` (v1).
- `routes/marketplace.py` : import `marketplace_config` corrigé, ajout du provider `get_marketplace_service`, ajout du helper `serialize_doc`.
- `routes/news_routes.py` : `get_redis()` et accès cache rendus tolérants à l'absence de Redis (cache désactivé au lieu d'erreur 500).
- `utils/api_response.py` : remplacement de `model_dump()` (pydantic v2) par `dict()` (compatible pydantic v1 utilisé partout).

## Overview
Smartix is a comprehensive multi-platform ecosystem integrating social networking, an educational marketplace, news aggregation, and AI-driven features (Vibe-Coding). It's a French-language platform targeting students for learning, creating projects, and generating income.

## Project Structure

```
├── backend/                    # FastAPI Python backend
│   ├── server.py               # Point d'entrée principal (routers, middleware, lifespan)
│   ├── db.py                   # Connexion MongoDB + création des index
│   ├── routes/                 # Handlers API REST
│   │   └── curriculum.py       # 11 endpoints Sprint 8 (curriculum 100 jours)
│   ├── middleware/             # Auth + rate limiting
│   ├── utils/                  # Email, tokens, rate limiter, WebSocket manager
│   ├── app/                    # Agrégateur de news, schedulers
│   ├── websocket/              # Serveurs WebSocket (collaboration, logs, terminal)
│   ├── containers/             # Gestion des containers Docker sandbox
│   ├── debugger/               # Serveurs DAP Node.js / Python
│   ├── lsp/                    # Serveurs LSP TypeScript / Python
│   ├── services/               # DNS, SSL, watch mode, env manager
│   ├── curriculum/             # Sprint 8 : leçons, progression, validation
│   │   ├── lesson_data.py      # 100 jours de contenu (JS, Python, React, TS, Docker, IA)
│   │   ├── progress_tracker.py # Suivi progression + streaks
│   │   └── code_validator.py   # Sandbox JS (Node.js) + Python
│   ├── gamification/           # Sprint 8 : XP, niveaux, succès, classement
│   │   └── xp_system.py        # 12 actions, 12 niveaux, titres, streaks
│   ├── monitoring/             # Sprint 10 : métriques temps réel
│   │   ├── clickhouse_client.py  # Client ClickHouse async (insert, query, batch)
│   │   ├── metrics_collector.py  # Middleware FastAPI + tracking actions/erreurs
│   │   └── analytics_service.py  # 12 méthodes analytiques (DAU, MAU, perf, erreurs…)
│   ├── scaling/                # Sprint 10 : auto-scaling
│   │   ├── metrics_provider.py   # 10 métriques temps réel + exposition Prometheus
│   │   └── auto_scaler.py        # 5 politiques, boucle kubectl, cooldown, historique
│   └── requirements.txt
├── frontend/                   # React (CRA + craco) frontend
│   ├── src/
│   │   ├── pages/              # Pages de l'application
│   │   ├── components/         # Composants UI partagés
│   │   └── vibe-coding/        # Plateforme IDE intégrée
│   │       ├── ai/             # Ghostwriter, génération tests/docs, contexte IA
│   │       ├── editor/         # Monaco Editor, LSP, Yjs collaboration
│   │       ├── terminal/       # Terminal PTY réel, multi-onglets
│   │       ├── debugger/       # DAP breakpoints, DevTools Eruda
│   │       ├── lessons/        # Sprint 1-7 : guides de leçons existants
│   │       ├── learning/       # Sprint 8 : CurriculumView, CodeValidator
│   │       ├── gamification/   # Sprint 8 : LevelProgress (XP, succès, classement)
│   │       └── ui/             # Layout IDE, command palette, thèmes
│   └── package.json
├── k8s/                        # Sprint 10 : manifests Kubernetes
│   ├── namespace.yaml
│   ├── deployment.yaml         # API (3r) + Sandbox + Frontend + Redis
│   ├── service.yaml            # ClusterIP API/sandbox/frontend/Redis
│   ├── ingress.yaml            # TLS Let's Encrypt + rate limit + CORS
│   ├── hpa.yaml                # HPA 3–20 replicas (CPU, mémoire, RPS)
│   ├── configmap.yaml          # Configuration app + nginx
│   ├── regional-config.yaml    # Endpoints EU/US/AP
│   └── custom-metrics.yaml     # Prometheus Adapter + RBAC
├── scripts/                    # Sprint 10 : scripts de déploiement
│   ├── deploy.sh               # Build → push → kubectl apply → smoke tests
│   └── rollback.sh             # Rollback ciblé par révision + health check
├── terraform/                  # Sprint 10 : infrastructure multi-régions AWS
│   ├── main.tf                 # EKS ×3 + VPC + Route53 latency routing
│   ├── variables.tf            # 15 variables (env, régions, instances, secrets)
│   └── regions/
│       ├── eu-west.tf          # Paris : RDS + Redis + S3
│       ├── us-east.tf          # Virginie : RDS + Redis + CloudFront + ACM
│       └── ap-southeast.tf     # Singapour (conditionnel var.enable_ap_southeast)
├── docker/
│   ├── docker-compose.yml      # nginx + certbot + backend + redis
│   ├── docker-compose.db.yml   # PostgreSQL + ClickHouse locaux
│   ├── Dockerfile.sandbox      # Node 20 + Python 3.11, user non-root
│   └── clickhouse/
│       └── init.sql            # 5 tables MergeTree + TTL + 2 vues matérialisées
└── grafana/
    └── dashboards/
        └── vibe-coding.json    # 12 panels : DAU, latence, RPS, erreurs, scaling, régions
```

## Tech Stack

### Backend
- **Framework**: FastAPI 0.100.1 with uvicorn 0.32.0
- **Database**: MongoDB (via motor async driver) — connection URL hardcoded with fallback in db.py
- **Cache/Queue**: Redis, Celery
- **Auth**: JWT (PyJWT, python-jose), bcrypt
- **AI**: OpenAI API
- **Payments**: Stripe
- **Push**: Firebase Admin, pywebpush
- **Real-time**: python-socketio, websockets 13.1

### Frontend
- **Framework**: React 18 with Create React App + craco
- **Styling**: Tailwind CSS, Framer Motion
- **UI**: Radix UI component suite, lucide-react
- **State**: TanStack React Query
- **Routing**: react-router-dom v7
- **Forms**: react-hook-form + zod
- **Real-time**: socket.io-client, yjs, y-websocket

## Workflows

### backend-main (port 8000)
```
cd /home/runner/workspace/backend && \
  PYTHONPATH=/home/runner/workspace/backend \
  /home/runner/workspace/.pythonlibs/bin/uvicorn server:app --host 0.0.0.0 --port 8000
```

### Main_App_Frontend_v2 (port 5000)
```
cd /home/runner/workspace/frontend && \
  PORT=5000 SKIP_PREFLIGHT_CHECK=true DANGEROUSLY_DISABLE_HOST_CHECK=true \
  ESLINT_NO_DEV_ERRORS=true /home/runner/workspace/frontend/node_modules/.bin/craco start
```

## Vibe-Coding Sprint 1 Features (Implemented)

Located in `frontend/src/vibe-coding/`:

| Feature | Files |
|---|---|
| **Multi-tab file UI** | `ui/FileTabs.js` (new) |
| **Ctrl+K command palette** | `ui/CommandPalette.js` (new) |
| **Global keyboard shortcuts** | `hooks/useKeyboardShortcuts.js` (new) — F5, Ctrl+Enter, Ctrl+`, Ctrl+B, Ctrl+K |
| **Light/dark theme toggle** | `contexts/ThemeContext.js` (new), `ui/ThemeToggle.js` (new) |
| **OS file drag-and-drop** | `editor/FileTreeBuilder.js` (enhanced) |
| **AES-256 env var encryption** | `utils/encryption.js` (new), `ui/EnvPanel.js` (updated) |
| **Git diff gutter decorations** | `editor/CodeEditor.js` (enhanced) — green/red/yellow Monaco decorations |
| **IDE layout integration** | `ui/ideLayout.js` (rewritten) — all features wired together |

## Vibe-Coding Sprint 2 Features (Implemented)

| Feature | Fichiers | Statut |
|---|---|---|
| **Ghostwriter streaming** | `ai/inlineCompletion.js` (SSE token par token), `backend/routes/ai_codegen.py` (`/complete-stream`) | ✅ |
| **Ghostwriter multi-langages** | `ai/inlineCompletion.js` (LANGUAGE_HINTS), backend (`LANGUAGE_SYSTEM_PROMPTS` 12 langages) | ✅ |
| **Génération de tests unitaires** | `ai/generateTests.js` (nouveau), `editor/CodeEditor.js` (action clic droit), backend (`/generate-tests`) | ✅ |
| **Documentation auto JSDoc/docstrings** | `ai/generateDocs.js` (nouveau), `editor/CodeEditor.js` (action + insertion directe), backend (`/generate-docs`) | ✅ |
| **Chat IA avec diff avant/après** | `ui/DiffViewer.js` (nouveau), `ui/AIChat.js` (streaming réel + rendu diff) | ✅ |
| **Contexte IA étendu** | `ai/contextBuilder.js` (nouveau — RAG léger, cache 30s, résumés fichiers) | ✅ |
| **LSP TypeScript basique** | `editor/typescriptLSP.js` (nouveau — diagnostics, hover, snippets React) | ✅ |

### Nouveaux endpoints backend Sprint 2
- `POST /api/ai/complete-stream` — Ghostwriter SSE streaming
- `POST /api/ai/generate-tests` — Jest/pytest/rspec auto-sélectionnés
- `POST /api/ai/generate-docs` — JSDoc/docstrings/Rustdoc selon langage
- `POST /api/ai/chat-stream` — Chat IA SSE avec instructions diff

## Vibe-Coding Sprint 3 Features (Implemented)

| Fonctionnalité | Fichiers | Statut |
|---|---|---|
| **Collaboration temps réel (Yjs)** | `backend/websocket/collaboration.py`, `editor/YjsProvider.js`, `editor/MonacoEditor.js` | ✅ |
| **Curseurs collaboratifs colorés** | `editor/AwarenessManager.js` | ✅ |
| **Import depuis GitHub** | `ui/GitHubImportModal.js`, `backend/routes/github.py`, `backend/services/git_service.py` | ✅ |
| **Export vers GitHub** | `ui/GitHubExportModal.js`, `backend/routes/github.py` (endpoint `/api/github/export`) | ✅ |
| **Déploiement Vercel / Netlify** | `ui/DeployModal.js`, `backend/routes/deploy.py`, `backend/services/vercel_client.py` | ✅ |
| **URL de partage read-only** | `ui/ShareModal.js`, `backend/routes/share.py` | ✅ |
| **Logs de production temps réel** | `ui/ProductionLogs.js`, `backend/websocket/logs.py` | ✅ |

### Nouveaux endpoints backend Sprint 3
- `GET  /api/github/repos` — Liste des dépôts GitHub de l'utilisateur
- `POST /api/github/import` — Clone un dépôt GitHub dans un projet
- `POST /api/github/export` — Pousse un projet vers GitHub
- `POST /api/deploy/vercel` — Déploiement sur Vercel
- `POST /api/deploy/netlify` — Déploiement sur Netlify
- `GET  /api/deploy/status` — Statut d'un déploiement (polling)
- `GET  /api/deploy/logs` — Logs de build Vercel
- `POST /api/share/create` — Génère un lien de partage read-only
- `GET  /api/share/{token}` — Récupère les métadonnées d'un projet partagé
- `DELETE /api/share/{token}` — Révoque un lien de partage

### Nouveaux serveurs WebSocket Sprint 3
- `ws://host:1234/collab/{roomId}` — Collaboration Yjs temps réel
- `ws://host:1235/logs/{deploymentId}` — Streaming de logs de production

### Nouvelles dépendances Sprint 3
- Backend: `websockets==13.1`
- Frontend: `yjs`, `y-websocket`

## Vibe-Coding Sprint 4 Features (Implemented)

| Fonctionnalité | Fichiers | Statut |
|---|---|---|
| **PTY réel (terminal bash)** | `backend/websocket/terminal.py`, `frontend/src/vibe-coding/terminal/RealTerminal.js` | ✅ |
| **Multi-terminaux en onglets** | `frontend/src/vibe-coding/terminal/TerminalTabs.js` | ✅ |
| **LSP TypeScript (typescript-language-server)** | `backend/lsp/typescript_server.py` | ✅ |
| **LSP Python (pyright / pylsp)** | `backend/lsp/python_server.py` | ✅ |
| **Routes HTTP LSP** | `backend/routes/lsp.py` | ✅ |
| **Go to Definition (F12)** | `editor/MonacoEditor.js` — action + appel LSP | ✅ |
| **Find All References (Shift+F12)** | `editor/MonacoEditor.js` — panneau de résultats | ✅ |
| **Rename Symbol (F2)** | `editor/MonacoEditor.js` — via Monaco natif | ✅ |
| **Hover LSP enrichi** | `editor/MonacoEditor.js` — registerHoverProvider | ✅ |
| **Autocomplétion LSP** | `editor/MonacoEditor.js` — registerCompletionItemProvider | ✅ |
| **Diagnostics push (WebSocket LSP)** | `backend/routes/lsp.py` (ws/lsp/{lang}), `editor/MonacoEditor.js` | ✅ |
| **Minimap activée** | `editor/MonacoEditor.js` — MONACO_OPTIONS minimap.enabled=true | ✅ |

### Nouveaux endpoints backend Sprint 4
- `POST /api/lsp/open`        — Ouvrir un fichier dans le serveur LSP
- `POST /api/lsp/completion`  — Autocomplétion LSP
- `POST /api/lsp/hover`       — Hover info LSP
- `POST /api/lsp/definition`  — Go to Definition
- `POST /api/lsp/references`  — Find All References
- `GET  /api/lsp/diagnostics` — Diagnostics d'un fichier
- `WS   /ws/terminal/{session_id}` — PTY réel (bash)
- `WS   /ws/lsp/{language}`   — Diagnostics LSP push temps réel

### Architecture LSP (Sprint 4)
- Pool par projet : une instance LSP par `project_id`, mise en cache dans `_lsp_pool`
- Protocole JSON-RPC 2.0 complet (initialize, textDocument/*, shutdown)
- Priorité : `typescript-language-server` pour TS/JS, `pyright-langserver` > `pylsp` pour Python
- Fallback Monaco natif si le serveur LSP est indisponible

### Architecture Terminal PTY (Sprint 4)
- `PtySession` : pseudo-terminal via `pty.openpty()`, master_fd non-bloquant (`fcntl.O_NONBLOCK`)
- `TerminalManager` : gestionnaire de sessions (une par `session_id`)
- WebSocket bridge : messages JSON entrants (`{type: "input"/"resize"/"ping"}`) + binaire sortant
- Resize via `ioctl(TIOCSWINSZ)` → SIGWINCH propagé au shell
- Timeout d'inactivité : 300 secondes
- Frontend : xterm.js + FitAddon + WebLinksAddon, thème Catppuccin Mocha, reconnexion automatique

### Nouvelles dépendances Sprint 4
- Frontend: `xterm@^5.3.0` (déjà présent), `xterm-addon-fit@^0.8.0` (déjà présent)
- Backend : modules stdlib uniquement (`pty`, `fcntl`, `termios`, `select`, `struct`)

## Vibe-Coding Sprint 5 Features (Implemented)

| Fonctionnalité | Fichiers | Statut |
|---|---|---|
| **Container Docker par projet** | `backend/containers/container_manager.py`, `backend/containers/docker_client.py` | ✅ |
| **Isolation sécurisée (gVisor + seccomp)** | `backend/containers/security.py` — profil seccomp JSON-RPC, cap_drop ALL | ✅ |
| **Routes sandbox REST + WebSocket** | `backend/routes/sandbox.py` — 7 endpoints + WS streaming | ✅ |
| **Dockerfile multi-langage** | `docker/Dockerfile.sandbox` — Node 20 + Python 3.11, user sandbox non-root | ✅ |
| **Docker Compose infrastructure** | `docker/docker-compose.yml` — nginx + certbot + backend + redis | ✅ |
| **DNS automatique *.vibe.app** | `backend/services/dns_manager.py` — Cloudflare API + fallback simulé | ✅ |
| **TLS automatique (Let's Encrypt)** | `backend/services/ssl_manager.py` — certbot async + renouvellement auto 12h | ✅ |
| **Nginx reverse proxy** | `backend/nginx/nginx.conf` + `nginx-ssl.conf` — routing sandbox par sous-domaine | ✅ |
| **Rollback Git (historique + restore)** | `backend/routes/git_rollback.py`, `frontend/src/vibe-coding/ui/GitRollbackModal.js` | ✅ |
| **Rate limiting avancé** | `backend/middleware/rate_limit.py` — sliding window, headers, 429 | ✅ |
| **Redis client centralisé** | `backend/redis_client.py` — cache containers, LSP, DNS, SSL, rate limit distribué | ✅ |

### Nouveaux endpoints backend Sprint 5
- `POST /api/sandbox/create`               — Créer un container Docker isolé
- `POST /api/sandbox/{id}/exec`            — Exécuter une commande (SSE streaming)
- `GET  /api/sandbox/{id}/status`          — Statut du container
- `GET  /api/sandbox/{id}/info`            — URL/port du container
- `POST /api/sandbox/{id}/stop`            — Arrêter le container
- `POST /api/sandbox/{id}/restart`         — Redémarrer le container
- `GET  /api/sandbox/list`                 — Liste des containers actifs
- `WS   /ws/sandbox/{id}/output`           — Streaming output WebSocket
- `GET  /api/projects/{id}/commits`        — Historique git (50 derniers commits)
- `POST /api/projects/{id}/rollback`       — Rollback à un commit (+ stash auto)
- `POST /api/projects/{id}/rollback/preview` — Diff avant rollback
- `POST /api/projects/{id}/rollback/undo`  — Annuler le rollback (restore stash)
- `GET  /api/projects/{id}/stash`          — Liste des stashs

### Architecture container (Sprint 5)
- Limites : 512 MB RAM, 0.5 vCPU, tmpfs /tmp 64 MB
- Sécurité : `cap_drop ALL` + profil seccomp (liste blanche 80+ syscalls) + `no-new-privileges`
- gVisor : runtime `runsc` auto-détecté si disponible (`/usr/bin/runsc`)
- TTL 30 min d'inactivité → cleanup automatique
- Mode simulation si Docker socket indisponible

### Architecture DNS/TLS (Sprint 5)
- Cloudflare API v4 : CNAME/A record par sous-domaine
- Certbot webroot : challenge via `/var/www/certbot`
- Renouvellement automatique toutes les 12h via asyncio task
- Nginx : routing dynamique `vibe-{subdomain}:3000` via Docker DNS interne

### Rate limiting (Sprint 5)
- Algorithme sliding window (précis, anti-burst)
- Par utilisateur JWT ou IP si non authentifié
- Limites par catégorie d'endpoint (sandbox: 10/min, AI: 20/min, API: 120/min)
- Headers `X-RateLimit-*` sur toutes les réponses
- HTTP 429 + `Retry-After` + message en français

### Nouvelles dépendances Sprint 5
- Backend: `docker>=7.1.0` (SDK Python Docker), `httpx>=0.27.0` (Cloudflare API async)

## Vibe-Coding Sprint 6 Features (Implemented)

| Fonctionnalité | Fichiers | Statut |
|---|---|---|
| **Breakpoints DAP Node.js** | `backend/debugger/dap_server.py`, `backend/debugger/node_debugger.py`, `frontend/src/vibe-coding/debugger/BreakpointManager.js`, `frontend/src/vibe-coding/editor/MonacoEditor.js`, `frontend/src/vibe-coding/editor/CodeEditor.js` | ✅ |
| **Breakpoints Python** | `backend/debugger/python_debugger.py` | ✅ |
| **Panneau debug variables/call stack** | `frontend/src/vibe-coding/debugger/DebugPanel.js`, `backend/routes/debugger.py` | ✅ |
| **Eruda DevTools mobile** | `frontend/src/vibe-coding/debugger/ErudaDevTools.js`, `frontend/public/index.html`, `frontend/src/vibe-coding/ui/ideLayout.js` | ✅ |
| **Responsive preview** | `frontend/src/vibe-coding/ui/ResponsivePreview.js`, `frontend/src/vibe-coding/ui/DeviceSelector.js`, `frontend/src/vibe-coding/ui/ideLayout.js` | ✅ |
| **Watch mode** | `backend/services/watch_service.py`, `frontend/src/vibe-coding/debugger/WatchMode.js`, `backend/routes/debugger.py` | ✅ |
| **Console de sessions debug** | `frontend/src/vibe-coding/debugger/DebugSessionConsole.js`, `frontend/src/vibe-coding/debugger/DebugPanel.js` — historique local, relance en un clic | ✅ |

### Nouveaux endpoints backend Sprint 6
- `POST /api/debugger/{project_id}/start` — démarre une session debug Node.js/Python
- `POST /api/debugger/{project_id}/breakpoints` — enregistre et synchronise les breakpoints
- `GET /api/debugger/{project_id}/stack` — pile d'appels courante
- `GET /api/debugger/{project_id}/variables` — variables courantes
- `POST /api/debugger/{project_id}/continue|step-over|step-into|step-out|stop` — contrôles d'exécution
- `WS /ws/debugger/{project_id}` — événements debug temps réel
- `POST /api/watch/{project_id}/start|stop` — contrôle watch mode
- `WS /ws/watch/{project_id}` — notifications de fichiers modifiés

## Vibe-Coding Sprint 7 Features (Implemented)

| Fonctionnalité | Fichiers | Statut |
|---|---|---|
| **Base de données par projet** | `backend/services/db_provisioner.py`, `backend/routes/db_routes.py` | ✅ |
| **Migrations automatiques** | `backend/services/migration_runner.py` | ✅ |
| **Query Builder visuel** | `frontend/src/vibe-coding/ui/QueryBuilder.js` | ✅ |
| **Gestionnaire d'environnements** | `backend/services/env_manager.py`, `backend/routes/env_routes.py` | ✅ |
| **Logger de requêtes** | `backend/services/request_logger.py` | ✅ |

## Vibe-Coding Sprint 8 Features (Implemented)

| Fonctionnalité | Fichiers | Statut |
|---|---|---|
| **Curriculum 100 jours** | `backend/curriculum/lesson_data.py` — JS, CSS, Python, TS, React, Node, FastAPI, Docker, IA, algos | ✅ |
| **Suivi de progression** | `backend/curriculum/progress_tracker.py` — XP, streaks, niveaux | ✅ |
| **Validation de code automatique** | `backend/curriculum/code_validator.py` — sandbox JS (Node.js) + Python | ✅ |
| **Système XP & niveaux** | `backend/gamification/xp_system.py` — 12 actions, 12 niveaux, titres | ✅ |
| **Vue Curriculum** | `frontend/src/vibe-coding/learning/CurriculumView.js` — grille 100 jours, filtres, modal leçon | ✅ |
| **Résultats test par test** | `frontend/src/vibe-coding/learning/CodeValidator.js` | ✅ |
| **Dashboard progression** | `frontend/src/vibe-coding/gamification/LevelProgress.js` — 4 onglets | ✅ |

### Endpoints backend Sprint 8 (sous `/api`)
| Endpoint | Description |
|---|---|
| `GET /api/curriculum` | Liste des 100 jours avec métadonnées |
| `GET /api/curriculum/day/{n}` | Leçon du jour N |
| `GET /api/curriculum/lesson/{id}` | Leçon par identifiant |
| `POST /api/validate-code` | Validation JS (Node.js) ou Python avec tests |
| `GET /api/user/progress` | Progression complète de l'utilisateur |
| `POST /api/user/complete-lesson` | Marquer une leçon complète + attribution XP |
| `GET /api/user/level` | Niveau et XP courants |
| `GET /api/leaderboard` | Classement des utilisateurs |
| `GET /api/gamification/milestones` | Jalons disponibles + état |

### Architecture validateur de code (Sprint 8)
- JS : écriture dans un fichier temporaire `/tmp/*.js`, exécution `node` avec timeout 5 s, nettoyage auto
- Python : subprocess isolé, injection du code utilisateur + tests assert, timeout 5 s
- Frontend : affichage test par test (✅/❌), conseils d'aide après 2 échecs

## Vibe-Coding Sprint 10 — Passage à l'échelle (Implemented)

### 1. Kubernetes Orchestration

| Fichier | Contenu |
|---|---|
| `k8s/namespace.yaml` | Namespace `vibe-coding` avec labels |
| `k8s/deployment.yaml` | API (3 replicas), Sandbox, Frontend, Redis — rolling update zero-downtime, probes liveness/readiness |
| `k8s/service.yaml` | ClusterIP pour API (8000/8080), Frontend (3000), Redis (6379) + PVC |
| `k8s/ingress.yaml` | TLS Let's Encrypt, rate-limit 100/burst 200, CORS, gzip, deux vhosts |
| `k8s/hpa.yaml` | HPA 3–20 replicas : CPU 70%, mémoire 80%, RPS 1000 — scale-up rapide, scale-down prudent |
| `k8s/configmap.yaml` | Configuration app (ClickHouse host, région, timeouts) + nginx upstream |
| `k8s/regional-config.yaml` | Endpoints EU/US/AP avec priorité et latence cible |
| `k8s/custom-metrics.yaml` | Prometheus Adapter + APIService + RBAC pour métriques personnalisées dans le HPA |

### 2. Scripts de déploiement

**`scripts/deploy.sh`** :
1. Vérification prérequis (kubectl, docker, git, cluster joignable)
2. Build des 3 images Docker (api, sandbox, frontend) avec tags versionnés (git SHA)
3. Push vers le registry
4. `kubectl apply` dans l'ordre (namespace → configmaps → secrets → workloads → ingress → HPA)
5. Attente du rollout (`kubectl rollout status`)
6. Smoke tests HTTP sur `/health` et `/ready`
7. Résumé avec état des pods et HPA

**`scripts/rollback.sh`** :
- Affiche l'historique des révisions disponibles
- Confirmation interactive (désactivable via `AUTO_CONFIRM=true`)
- Rollback vers révision précédente ou ciblée (`--revision N`)
- Health check post-rollback

### 3. Terraform Multi-régions (AWS)

**Régions déployées :**
| Région | Localisation | Statut |
|---|---|---|
| `eu-west-3` | Paris, France | Actif (défaut) |
| `us-east-1` | Virginie du Nord, USA | Actif |
| `ap-southeast-1` | Singapour | Conditionnel (`var.enable_ap_southeast`) |

**Ressources par région :** EKS (1.28), VPC multi-AZ, RDS PostgreSQL 15 multi-AZ, ElastiCache Redis ×2, S3 chiffré AES-256, versioning activé.

**Ressources globales :** CloudFront CDN (prix mondial), ACM wildcard `*.vibe-coding.smartix.com`, Route53 latency-based routing (TTL 60 s) — l'utilisateur est automatiquement dirigé vers la région la plus proche.

**Backend Terraform :** state dans S3 + verrouillage DynamoDB pour les déploiements en équipe.

### 4. Monitoring ClickHouse

**Tables :**
| Table | Données | TTL |
|---|---|---|
| `vibe_metrics` | Actions utilisateur (event_type, duration_ms, metadata) | 1 an |
| `performance_metrics` | Requêtes API (endpoint, method, response_time_ms, status_code) | 90 jours |
| `errors` | Erreurs (type, message, stack trace) | 6 mois |
| `scaling_events` | Historique scaling (from/to replicas, trigger) | 1 an |
| `user_sessions` | Sessions agrégées (SummingMergeTree) | 2 ans |

**Vues matérialisées :**
- `dau_mv` → `dau` : DAU par jour avec AggregatingMergeTree (uniqState)
- `perf_hourly_mv` → `perf_hourly` : latence avg/P95 + taux d'erreur par heure et endpoint

**`AnalyticsService` — 12 méthodes :**
- DAU/MAU, nouveaux utilisateurs, top endpoints, latence P50/P95/P99, taux d'erreur, distribution géographique, engagement utilisateur, historique scaling, résumé dashboard

### 5. Auto-scaling avancé

**`MetricsProvider` — 10 métriques en temps réel :**
`requests_per_second`, `avg_response_time_ms`, `p95_response_time_ms`, `error_rate_pct`, `active_users`, `queue_size`, `active_containers`, `websocket_connections`, `cpu_usage_pct`, `memory_usage_pct`

**`AutoScaler` — 5 politiques :**
| Politique | Métrique | Scale up | Scale down | Cooldown |
|---|---|---|---|---|
| `cpu_high` | CPU % | > 70% | < 30% | 120 s |
| `rps_high` | RPS | > 500 | < 100 | 60 s |
| `response_time_degraded` | P95 latence | > 2000 ms | < 500 ms | 180 s |
| `error_rate_high` | Erreurs % | > 5% | < 1% | 300 s |
| `active_users` | Users actifs | > 200 | < 50 | 90 s |

Vote majoritaire entre politiques, scale-up prioritaire sur scale-down, kubectl intégré avec fallback simulation.

### 6. Dashboard Grafana (12 panels)

| Panel | Type | Source |
|---|---|---|
| Utilisateurs actifs (30 min) | Stat | vibe_metrics |
| Requêtes/seconde | Stat | performance_metrics |
| Taux d'erreur | Stat | performance_metrics |
| Latence P95 | Stat | performance_metrics |
| Replicas actifs | Stat | scaling_events |
| DAU — 30 jours | Timeseries | dau |
| Latence API dans le temps | Timeseries | performance_metrics |
| Requêtes/minute par endpoint | Timeseries | performance_metrics |
| Top 10 endpoints | Table | performance_metrics |
| Distribution géographique | Pie chart | vibe_metrics |
| Historique scaling | Table | scaling_events |
| Erreurs récentes | Logs | errors |

Annotations automatiques des événements de scaling sur tous les graphes. Templates variables : région et endpoint.

### Nouveaux endpoints backend Sprint 10

| Endpoint | Description |
|---|---|
| `GET /health` | Santé + statut monitoring |
| `GET /ready` | Kubernetes readiness probe (DB + monitoring) |
| `GET /metrics` | Scraping Prometheus (format texte) |
| `GET /api/monitoring/summary` | Résumé global dashboard (DAU, latence, erreurs, RPS, régions) |
| `GET /api/monitoring/performance` | Performances par endpoint |
| `GET /api/scaling/status` | Statut AutoScaler (replicas, politiques, historique) |
| `POST /api/scaling/scale-up` | Scale up manuel (`?by=N`) |
| `POST /api/scaling/scale-down` | Scale down manuel (`?by=N`) |

### Activation du monitoring (pattern opt-in strict)

Architecture sans aucun stub ni fallback silencieux. Le monitoring est contrôlé par le feature flag `MONITORING_ENABLED` :

| `MONITORING_ENABLED` | Comportement |
|---|---|
| `false` (défaut) | Modules monitoring non importés. Les endpoints `/metrics`, `/api/monitoring/*` et `/api/scaling/*` renvoient HTTP 503 avec un message explicite. `/ready` ne vérifie pas ClickHouse. |
| `true` | Modules strictement chargés. ClickHouse, Prometheus et Kubernetes API sont **requis** : toute erreur de connexion au démarrage fait échouer le boot (pas de mode dégradé). `/ready` vérifie ClickHouse (503 si KO). |

**Variable complémentaire :** `AUTOSCALER_MODE`
- `kubernetes` (défaut) — utilise l'API Kubernetes officielle (client-python) pour modifier les replicas
- `observe` — évalue les politiques et enregistre les décisions sans appeler K8s (pour les environnements sans cluster)

**Dépendances requises** (dans `requirements.txt`) : `clickhouse-driver==0.2.9`, `prometheus-client==0.21.1`, `kubernetes==31.0.0`.

## Important Notes

- **Python packages** are installed in `/home/runner/workspace/.pythonlibs/` — always use the full path to uvicorn
- **Node packages** (craco, react-scripts) are installed in `frontend/node_modules/`
- npm install in frontend/ must use `--legacy-peer-deps` flag due to peer dependency conflicts
- The frontend runs on port 5000 (webview) and backend API on port 8000
- MongoDB initialization (index creation) runs as a background task on startup to avoid blocking the server port from opening
- The frontend proxies `/api` requests to `http://127.0.0.1:8000` via craco devServer proxy config
- Replit migration restored frontend dependencies in `frontend/node_modules/` and backend dependencies in `.pythonlibs/`.
- `backend/app/db_mongo.py` uses the shared backend `MONGO_URL` and `DB_NAME` configuration to avoid local MongoDB fallbacks in Replit.
- **Sprint 10** : les scripts `scripts/deploy.sh` et `scripts/rollback.sh` nécessitent `kubectl` et `docker` dans le PATH. En environnement Replit, le scaling est en mode simulation (kubectl absent).

## Environment Variables Required
- `MONGO_URL` — MongoDB connection string (has hardcoded fallback in db.py)
- `OPENAI_API_KEY` — for AI/Vibe-coding features
- `STRIPE_SECRET_KEY` — for payment processing
- `JWT_SECRET` / `SECRET_KEY` — for authentication tokens
- Firebase credentials — for push notifications
- `PROJECTS_DIR` — Répertoire pour les projets importés (défaut : /tmp/vibe-coding-projects)
- `FRONTEND_URL` — URL de base pour les liens de partage (défaut : https://smartix.app)
- `CLICKHOUSE_HOST` — Hôte ClickHouse Sprint 10 (défaut : localhost)
- `CLICKHOUSE_PORT` — Port ClickHouse (défaut : 9000)
- `CLICKHOUSE_USER` — Utilisateur ClickHouse (défaut : default)
- `CLICKHOUSE_PASSWORD` — Mot de passe ClickHouse (sensible)
- `CLICKHOUSE_DATABASE` — Base de données ClickHouse (défaut : vibe_coding)
- `METRICS_UPDATE_INTERVAL` — Intervalle de mise à jour des métriques en secondes (défaut : 15)
- `IMAGE_REGISTRY` — Registry Docker pour le déploiement (défaut : docker.io/vibecoding)
- `DATABASE_URL` — URL PostgreSQL pour Kubernetes secrets (Sprint 10)
- `MONITORING_ENABLED` — Active le monitoring Sprint 10 strict (défaut : `false`)
- `AUTOSCALER_MODE` — `kubernetes` (défaut) ou `observe` (pour les environnements sans cluster K8s)

## Inscription `/api/auth/register` — corrections (avril 2026)

Trois bugs cumulés provoquaient un timeout client de 60 s et un 500 :

1. **Contrat d'échange** : le frontend envoyait `multipart/form-data` alors que le handler attend un body JSON typé (`UserRegister`). Pydantic ne parsait pas, le pipeline restait bloqué ~30 s avant un 422. Corrigé dans `frontend/src/services/authService.js` (`register()`) : payload JSON pur + `Content-Type: application/json`.
2. **Sérialisation `_id`** : `Motor.insert_one` mute le dict en y injectant un `ObjectId` non sérialisable, ce qui produisait un 500 après l'écriture en base. `backend/server.py` exclut désormais `_id` ET `hashed_password` de la réponse (le champ `id` UUID reste exposé).
3. **`validation_exception_handler` bloquant** : `await request.body()` rejoué après la chaîne `BaseHTTPMiddleware` pouvait rester suspendu ~30 s. Le handler lit maintenant uniquement le body bufferisé (`request._body`) sans nouveau `await`.

Performances mesurées après correctifs : inscription valide ~720 ms ; payload invalide ~10 ms ; doublon email ~250 ms.

## Détection des identifiants non définis (`npm run lint:undef`)

Bug récurrent du repo : les enums TypeScript supprimés lors de la conversion en JS laissent des identifiants en PascalCase utilisés mais jamais déclarés (vu sur `BottomNav.icon`, `Courses.Category` / `Courses.Level`). Au runtime, le premier `useMemo` qui les lit lève `ReferenceError` et démonte la page.

Pour repérer ces cas en lot : depuis `frontend/`, lancer `npm run lint:undef`. Le script appelle ESLint sur `src/` en désactivant le bruit (`react/prop-types`, `no-unused-vars`, etc.) afin de ne laisser remonter que `no-undef` et `react/jsx-no-undef`. À utiliser après tout refactor large ou avant un merge sensible. Baseline actuelle : ~120 occurrences résiduelles concentrées dans `src/vibe-coding/` (globals navigateur `Node`, `NodeFilter`, `DOMParser` non listés dans la config) — à nettoyer progressivement, hors scope des correctifs ciblés.
