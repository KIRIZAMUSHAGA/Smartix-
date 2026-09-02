
# Système de Cours avec Quiz Gamifié - Documentation

## ⚠️ RAPPEL IMPORTANT

**LES FICHIERS `chapters.json` ET `quizzes.json` CONTIENNENT DES STRUCTURES VIDES.**

Les tableaux `questions` dans `quizzes.json` sont **intentionnellement vides**. Vous devez les remplir avec vos propres questions.

## Structure du Projet

```
/frontend/src
  /components
    - BookCover.js          # Couverture du livre
    - PageTurn.js           # Affichage et navigation des pages
    - AudioReader.js        # Lecture vocale (Web Speech API)
    - TimerBar.js           # Timer avec barre de progression
    - QuizPage.js           # Engine de quiz (une question)
    - QuizSummary.js        # Résumé des résultats
    - ConfettiEffect.js     # Animation de confetti
    
  /pages
    - CourseReader.js       # Page principale
    
  /data
    - chapters.json         # Chapitres (contenu placeholder)
    - quizzes.json          # Quiz (questions VIDES)
    
  /utils
    - soundPlayer.js        # Gestion des sons
    
  /styles
    - animations.css        # Animations CSS
    
/public
  /sounds                   # Fichiers audio (placeholders)
  /confetti                 # Assets de confetti
```

## Comment Ajouter les Questions Réelles

### Format d'une question dans `quizzes.json`

```json
{
  "chapterId": 1,
  "series": "A",
  "timePerQuestion": 30,
  "questions": [
    {
      "text": "Quelle est la définition de l'OHADA ?",
      "choices": [
        {
          "text": "Organisation pour l'Harmonisation en Afrique du Droit des Affaires",
          "isCorrect": true
        },
        {
          "text": "Organisation Humanitaire Africaine des Affaires",
          "isCorrect": false
        },
        {
          "text": "Office d'Harmonisation Administrative",
          "isCorrect": false
        },
        {
          "text": "Organisme de l'Habitat et du Développement Africain",
          "isCorrect": false
        }
      ]
    }
  ]
}
```

### Étapes pour ajouter vos questions

1. Ouvrez `frontend/src/data/quizzes.json`
2. Localisez la série que vous voulez remplir (A, B, ou C)
3. Ajoutez vos questions dans le tableau `questions`
4. Assurez-vous qu'**une seule réponse** a `"isCorrect": true`
5. Sauvegardez le fichier

## Système de Séries (A, B, C)

- **Série A** : Premier essai du quiz
- **Série B** : Si échec à la série A (score < 70%)
- **Série C** : Si échec à la série B

Quand un utilisateur échoue, il doit **relire le chapitre** avant de passer à la série suivante.

## Progression et Validation

### Critères de validation

- Score minimum : **70%**
- Un chapitre doit être validé avant de passer au suivant
- La progression est sauvegardée dans `localStorage`

### Structure de la progression

```javascript
{
  chapterId: number,
  validated: boolean,
  attemptCount: number,
  lastAccess: string (ISO date)
}
```

## Fonctionnalités Anti-Triche

1. **Sélection de texte désactivée** pendant le quiz
2. **Navigation arrière bloquée** pendant le quiz
3. **Avertissement** si tentative de rafraîchir la page
4. **Timer strict** : pas de pause possible
5. **Une seule réponse** par question (boutons désactivés après clic)

## Sons et Assets

### Fichiers audio requis

Placez vos fichiers audio dans `/public/sounds/` :

- `success.mp3` - Joué quand réponse correcte
- `error.mp3` - Joué quand réponse incorrecte
- `timeover.mp3` - Joué quand temps écoulé
- `pageturn.mp3` - Joué au tournage de page

### Assets de confetti

Placez vos assets dans `/public/confetti/` :

- `confetti1.svg` - Formes de confetti
- `star.png` - Étoiles dorées

## Utilisation

### Lancement en développement

```bash
cd frontend
npm install
npm start
```

### Accès au lecteur

URL : `http://localhost:5000/course/:chapterId`

Exemple : `http://localhost:5000/course/1`

## Personnalisation

### Modifier le temps par question

Dans `quizzes.json`, ajustez `timePerQuestion` (en secondes).

### Modifier le score minimum

Dans `CourseReader.js`, ligne de validation :

```javascript
const isPassed = score >= 70; // Changer 70 par votre seuil
```

### Ajouter de nouveaux chapitres

1. Ajoutez un objet dans `chapters.json`
2. Créez les séries correspondantes dans `quizzes.json`

## Architecture Technique

### Composants principaux

- **CourseReader** : Orchestrateur principal, gère tous les états
- **BookCover** : Point d'entrée visuel
- **PageTurn** : Affichage avec animations 3D
- **QuizPage** : Engine de question avec timer
- **QuizSummary** : Affichage des résultats et statistiques

### État de l'application

```
mode: 'cover' | 'reading' | 'quiz' | 'summary'
currentPage: number
currentQuestionIndex: number
quizResults: Array<{questionNumber, isCorrect, timeSpent}>
currentSeries: 'A' | 'B' | 'C'
attemptCount: number
```

## Dépannage

### Les sons ne jouent pas

- Vérifiez que les fichiers MP3 existent dans `/public/sounds/`
- Certains navigateurs bloquent l'autoplay audio

### Le quiz ne se lance pas

- Vérifiez que `quizzes.json` contient des questions pour ce chapitre
- Consultez la console pour les erreurs

### La progression n'est pas sauvegardée

- Vérifiez que `localStorage` est activé dans le navigateur
- En navigation privée, `localStorage` peut être désactivé

## Tests Recommandés

1. **Test de navigation** : Vérifier toutes les pages du chapitre
2. **Test de quiz** : Répondre correctement/incorrectement
3. **Test de timer** : Laisser expirer le temps
4. **Test de séries** : Échouer volontairement pour tester série B
5. **Test de validation** : Obtenir > 70% et vérifier la sauvegarde

## Support

Pour toute question sur l'implémentation, consultez les commentaires dans le code source.

**N'oubliez pas : Ce système est une structure prête à accueillir votre contenu pédagogique réel !**
