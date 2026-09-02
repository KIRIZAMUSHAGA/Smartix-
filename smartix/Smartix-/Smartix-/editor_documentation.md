# Documentation Technique de l'Éditeur Smartix

## 1. Structuration des Contenus
L'éditeur utilise une structure hiérarchique simple et efficace :
- **Cours (Course)** : L'entité parente contenant les métadonnées globales (Titre, Description).
- **Pages / Chapitres** : Le contenu est découpé en pages indépendantes.
  - Chaque page possède un **Titre** unique.
  - Chaque page possède un **Contenu** (Texte riche/Markdown).
  - Un système d'**Ordre (Order)** gère la séquence d'affichage.

## 2. Disposition des Boutons
L'interface est divisée en trois zones interactives :

### Barre Supérieure (Header)
- **Menu (Burger)** : Ouvre/Ferme le plan du cours.
- **Badge Statut** : Indique l'état "BROUILLON".
- **Bouton Aperçu** : Visualisation en mode lecture.
- **Bouton Enregistrer** : Sauvegarde manuelle immédiate (Orange).

### Plan du Cours (Sidebar Gauche)
- **Liste des Pages** : Navigation directe entre les chapitres.
- **Poignées de déplacement** : Réorganisation de l'ordre des pages.
- **Bouton Corbeille** : Suppression d'une page spécifique.
- **Bouton + Ajouter une page** : Création instantanée en fin de liste.
- **Retour aux fichiers** : Lien vers l'importateur de documents.

### Barre de Navigation (Footer)
- **Bouton Précédent** : Recule d'une page.
- **Indicateur de progression** : Affiche "X / Y" pages.
- **Bouton Suivant** : Avance à la page suivante.

## 3. Fonctionnalités Implémentées & Opérationnelles
- **Importation Intelligente** : Conversion automatique de fichiers PDF et DOCX en pages de cours structurées.
- **Auto-Save (Sauvegarde Automatique)** : Enregistrement transparent toutes les 2 secondes après une modification.
- **Raccourcis Clavier** : Support du `Ctrl + S` (ou `Cmd + S`) pour sauvegarder manuellement sans quitter le clavier.
- **Édition Plein Écran** : Espace de travail élargi (max-w-6xl) pour une concentration maximale.
- **Gestion Dynamique** : Ajout, suppression et réordonnancement des pages en temps réel.
- **Interface Adaptative** : Sidebar intelligente qui se ferme au clic extérieur pour libérer l'espace.
