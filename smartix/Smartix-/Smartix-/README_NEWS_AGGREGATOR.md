SmartOHADA — News Aggregator (Phoenix-like, no-AI) — Ultra-complete bundle (v3)

Contenu : backend FastAPI complet (scrapers, dedupe, image handling, scheduler), SQL, scripts, et exemples frontend (React Native web-friendly components).

Étapes rapides :

1. Copier les fichiers dans ton repo.

2. Ajouter secrets (.env) : DATABASE_URL, S3_*, etc.

3. pip install -r backend/requirements.txt

4. Créer les tables : psql $DATABASE_URL -f backend/create_news_table.sql (ou laisse SQLAlchemy le faire)

5. Lancer : uvicorn app.main:app --host 0.0.0.0 --port 8000

6. Assurer scheduler (il démarre dans main.py). Si Replit coupe, lance backend/scripts/run_scheduler.py en tâche séparée.
