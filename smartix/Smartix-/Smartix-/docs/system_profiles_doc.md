# Documentation du Système de Profils Systèmes - Smartix

Ce document détaille l'architecture, le fonctionnement et l'intégration des 10 000 profils systèmes créés pour simuler une activité humaine organique sur la plateforme.

## 1. Vue d'Ensemble
Le système est conçu pour peupler la plateforme de manière crédible, faciliter l'accueil des nouveaux utilisateurs et préparer le terrain pour des interactions IA avancées.

### Localisation des Données
- **Base de données** : Collection `users` dans MongoDB.
- **Identifiant clé** : Champ `is_system: true`.
- **Confidentialité** : Champ `is_profile_private: true` (profils non cliquables par défaut).

## 2. Structure d'un Profil
Chaque profil système respecte le schéma suivant :
- **Identité** : `full_name`, `prenom`, `nom`, `age` (22-48 ans), `genre`.
- **Géographie** : `pays` (RDC, CI, Sénégal, France, Canada), `ville`.
- **Expertise** : `competence_dominante` (Compta, Finance, OHADA, etc.).
- **Comportement** : `type_profil` (social, conversationnel, expert), `tonalite`, `niveau_bavardage`.
- **Signature Temporelle** : `temps_moyen_reponse_sec`, `variance`, `heures_actives`.
- **Avatar** : Photos humaines réalistes (via Pravatar).

## 3. Composants Techniques (`backend/scripts/`)

### `generate_system_users.py`
Le moteur de création initial. Il utilise des banques de données par pays et des algorithmes de pondération pour garantir une répartition géographique réaliste (50% Afrique francophone).

### `inject_system_users.py`
Script d'injection massive gérant les lots (batches) de 500 pour une insertion stable dans MongoDB.

### `system_auto_accept.py`
**Moteur de Réponse Entrant** :
- Surveille les demandes d'amis reçues par les profils systèmes.
- Calcule un délai de réponse basé sur la `signature_temporelle` du profil.
- Accepte automatiquement l'invitation et génère une notification réelle.

### `system_outbound_requests.py`
**Moteur d'Accueil Proactif** :
- Identifie les nouveaux comptes réels (moins de 24h).
- Sélectionne aléatoirement des "ambassadeurs" système (1 à 5 profils).
- Envoie des demandes d'amis pour qu'aucun utilisateur ne se sente seul au démarrage.

## 4. Intégration au Serveur (`backend/server.py`)
Le système est intégré via le `lifespan` de FastAPI. Une tâche de fond (`run_system_loop`) s'exécute toutes les minutes pour déclencher les moteurs de réponse et d'envoi.

## 5. Recommandations pour le Futur
- **Interactions IA** : Les profils sont prêts à être connectés à une API LLM pour répondre aux messages privés ou commenter des posts.
- **Filtrage** : Utilisez toujours l'index `{ is_system: 1 }` pour vos requêtes de maintenance.
- **Évolution** : Pour augmenter le réalisme, on peut ajouter un champ `bio` généré par IA basé sur la compétence et le pays.
