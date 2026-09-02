# Marketplace PDF Module - Étape 2 : Job Manager

## Description
L'Étape 2 implémente le `Job Manager` pour la gestion de la file d'attente des PDF dans le Marketplace. Le contrôle d'admission est désormais basé exclusivement sur la base de données MongoDB, supprimant toute dépendance aux variables globales volatiles.

## Composants
- `backend/jobs.py`: Contient la classe `JobManager` gérant les transitions d'état et le contrôle d'admission.
- `backend/tests/test_job_manager.py`: Tests unitaires validant le respect de la limite de jobs simultanés.

## Étape 3 : Worker Isolé (Validée)
- Implémentation du `Worker` dans `backend/worker.py`.
- Isolation des tâches de génération PDF via `multiprocessing.Process`.
- Gestion des Timeouts : Hard limit de 60 secondes par processus avec sécurisation stricte (`terminate()`, puis `kill()` si nécessaire). Aucun join bloquant.
- Nettoyage des processus zombies garanti par la boucle de surveillance.
- Logging détaillé du cycle de vie des jobs (début, fin, timeout, erreur).
- Mise à jour automatique des statuts en base de données (`done`, `failed`).
## Étape 4 : Robustesse et Cohérence (Validée)
- **Recovery post-crash** : Implémentation de `JobManager.recover_orphaned_jobs()`, appelée au démarrage du worker, remettant les jobs `processing` en `queued`.
- **Protection disque proactive** : Vérification de l'espace libre avant admission (`check_disk_space`), seuil sécurisé à 500MB.
- **Cohérence Produit** : Synchronisation systématique du flag `preview_ready` sur le produit en fonction de l'issue du job (`done` -> True, `failed` -> False).
- **Nettoyage temporaire** : Isolation via `finally` dans le worker (délégué aux utilitaires de traitement).
- **Tests** : Tests de recovery, protection disque et cohérence produit ajoutés dans `backend/tests/test_worker.py`.
