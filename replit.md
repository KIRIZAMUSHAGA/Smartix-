# Smartix

Smartix est une plateforme francophone pour apprendre, créer, partager et vendre, avec un espace de programmation assistée par IA.

## Lancement

- `Smartix Frontend` — démarre React/CRACO sur le port 5000
- `Smartix Backend` — démarre FastAPI/Uvicorn sur le port 8000
- Frontend : `cd smartix/frontend && npm start`
- Backend : `cd smartix/backend && PYTHONPATH=/home/runner/workspace/smartix/backend:/home/runner/workspace/.pythonlibs python -m uvicorn server:app --host 0.0.0.0 --port 8000

## Structure

- `smartix/frontend/` — application React, pages, composants et module Vibe-Coding
- `smartix/backend/` — API FastAPI, authentification, services et routeurs
- `smartix/backend/requirements.txt` — dépendances Python
- `smartix/frontend/package.json` — dépendances et scripts frontend

## Variables d’environnement

Le backend peut utiliser MongoDB, Redis, OpenAI, Stripe, Firebase et les services de déploiement selon les fonctionnalités activées. Les secrets doivent être ajoutés via les Secrets Replit, jamais dans les fichiers versionnés.

## Notes

- Le dépôt original a été importé sous `smartix/` sans son historique Git interne ni ses fichiers `.env`.
- Le backend démarre même lorsque MongoDB ou Redis ne sont pas disponibles, mais les fonctions qui en dépendent resteront limitées.
