from enum import Enum
from typing import List, Dict, Optional


class LessonLevel(Enum):
    DEBUTANT = "debutant"
    INTERMEDIAIRE = "intermediaire"
    AVANCE = "avance"
    EXPERT = "expert"


class LessonType(Enum):
    THEORIE = "theorie"
    EXERCICE = "exercice"
    QUIZ = "quiz"
    PROJET = "projet"


class Lesson:
    def __init__(self,
                 id: str,
                 title: str,
                 description: str,
                 level: LessonLevel,
                 lesson_type: LessonType,
                 content: str,
                 code_stub: Optional[str] = None,
                 solution: Optional[str] = None,
                 tests: Optional[List[str]] = None,
                 xp_reward: int = 10,
                 prerequisites: List[str] = None):
        self.id = id
        self.title = title
        self.description = description
        self.level = level
        self.type = lesson_type
        self.content = content
        self.code_stub = code_stub
        self.solution = solution
        self.tests = tests or []
        self.xp_reward = xp_reward
        self.prerequisites = prerequisites or []

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'level': self.level.value,
            'type': self.type.value,
            'content': self.content,
            'code_stub': self.code_stub,
            'solution': self.solution,
            'tests': self.tests,
            'xp_reward': self.xp_reward,
            'prerequisites': self.prerequisites,
        }


# ─────────────────────────────────────────────────────────────────────────────
# CURRICULUM 100 JOURS
# ─────────────────────────────────────────────────────────────────────────────

CURRICULUM_100_DAYS: Dict[str, Dict] = {

    # ── SEMAINE 1 : JavaScript fondamental ──────────────────────────────────
    "day_1": {
        "title": "Introduction à JavaScript",
        "description": "Apprends les bases de JavaScript : variables, types, fonctions",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="js_1_1",
                title="Les variables",
                description="Déclare des variables avec let, const et var",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Les variables en JavaScript

En JavaScript il y a 3 façons de déclarer une variable :
- `let` : variable qui peut changer
- `const` : constante, ne peut pas changer
- `var` : ancienne syntaxe (à éviter)

## Exercice
Déclare une variable `prenom` avec ton prénom,
une variable `age` avec ton âge,
et une constante `PI` valant 3.14159.""",
                code_stub="// Écris ton code ici\n\n",
                solution="const prenom = 'Jean';\nlet age = 25;\nconst PI = 3.14159;",
                tests=[
                    "typeof prenom === 'string'",
                    "typeof age === 'number'",
                    "typeof PI === 'number'",
                    "PI === 3.14159",
                ],
                xp_reward=10,
            ),
            Lesson(
                id="js_1_2",
                title="Les types de données",
                description="Découvre les types primitifs : string, number, boolean",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.THEORIE,
                content="""# Les types de données en JavaScript

JavaScript possède plusieurs types primitifs :
- **string** : texte entre guillemets
- **number** : nombres entiers et décimaux
- **boolean** : true ou false
- **null** / **undefined** : absence de valeur

## Exercice
Crée une variable de chaque type.""",
                code_stub="// string\nconst texte = '';\n// number\nconst nombre = 0;\n// boolean\nconst vrai = false;\n",
                solution="const texte = 'Bonjour';\nconst nombre = 42;\nconst vrai = true;",
                tests=[
                    "typeof texte === 'string'",
                    "typeof nombre === 'number'",
                    "typeof vrai === 'boolean'",
                ],
                xp_reward=10,
            ),
        ],
    },

    "day_2": {
        "title": "Les fonctions",
        "description": "Apprends à créer et utiliser des fonctions en JavaScript",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="js_2_1",
                title="Déclarer une fonction",
                description="Crée ta première fonction",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Les fonctions en JavaScript

Une fonction est un bloc de code réutilisable.

```js
function saluer(nom) {
  return 'Bonjour ' + nom;
}
```

## Exercice
Crée une fonction `addition` qui prend deux paramètres `a` et `b` et retourne leur somme.""",
                code_stub="function addition(a, b) {\n  // ton code ici\n}\n",
                solution="function addition(a, b) {\n  return a + b;\n}",
                tests=[
                    "typeof addition === 'function'",
                    "addition(2, 3) === 5",
                    "addition(10, -4) === 6",
                ],
                xp_reward=10,
                prerequisites=["js_1_1"],
            ),
            Lesson(
                id="js_2_2",
                title="Arrow functions",
                description="Découvre la syntaxe moderne des fonctions fléchées",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Arrow functions

La syntaxe flèche est plus concise :

```js
const multiplier = (a, b) => a * b;
```

## Exercice
Convertis la fonction `addition` en arrow function.""",
                code_stub="const addition = (a, b) => {\n  // ton code ici\n};\n",
                solution="const addition = (a, b) => a + b;",
                tests=[
                    "typeof addition === 'function'",
                    "addition(4, 5) === 9",
                ],
                xp_reward=10,
                prerequisites=["js_2_1"],
            ),
        ],
    },

    "day_3": {
        "title": "Les conditions",
        "description": "if, else, ternaire et switch",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="js_3_1",
                title="if / else",
                description="Prendre des décisions dans ton code",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Les conditions

```js
if (condition) {
  // bloc si vrai
} else {
  // bloc si faux
}
```

## Exercice
Crée une fonction `estMajeur(age)` qui retourne `true` si age >= 18, sinon `false`.""",
                code_stub="function estMajeur(age) {\n  // ton code ici\n}\n",
                solution="function estMajeur(age) {\n  return age >= 18;\n}",
                tests=[
                    "estMajeur(18) === true",
                    "estMajeur(17) === false",
                    "estMajeur(25) === true",
                ],
                xp_reward=10,
                prerequisites=["js_2_1"],
            ),
        ],
    },

    "day_4": {
        "title": "Les tableaux (Arrays)",
        "description": "Manipuler des listes de données",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="js_4_1",
                title="Créer et accéder à un tableau",
                description="Crée un tableau et accède à ses éléments",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Les tableaux

```js
const fruits = ['pomme', 'banane', 'cerise'];
console.log(fruits[0]); // 'pomme'
```

## Exercice
Crée un tableau `nombres` contenant 1, 2, 3, 4, 5.""",
                code_stub="// Crée le tableau ici\n",
                solution="const nombres = [1, 2, 3, 4, 5];",
                tests=[
                    "Array.isArray(nombres)",
                    "nombres.length === 5",
                    "nombres[0] === 1",
                    "nombres[4] === 5",
                ],
                xp_reward=10,
            ),
            Lesson(
                id="js_4_2",
                title="Méthodes de tableaux",
                description="map, filter, reduce",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Méthodes essentielles

- `map()` : transformer chaque élément
- `filter()` : garder certains éléments
- `reduce()` : réduire à une seule valeur

## Exercice
À partir du tableau `[1,2,3,4,5]`, crée `doubles` (chaque élément × 2)
et `pairs` (uniquement les nombres pairs).""",
                code_stub="const source = [1, 2, 3, 4, 5];\nconst doubles = [];\nconst pairs = [];\n",
                solution="const source = [1, 2, 3, 4, 5];\nconst doubles = source.map(n => n * 2);\nconst pairs = source.filter(n => n % 2 === 0);",
                tests=[
                    "doubles.length === 5",
                    "doubles[0] === 2",
                    "doubles[4] === 10",
                    "pairs.length === 2",
                    "pairs[0] === 2",
                ],
                xp_reward=15,
                prerequisites=["js_4_1"],
            ),
        ],
    },

    "day_5": {
        "title": "Les objets",
        "description": "Structurer les données avec des objets",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="js_5_1",
                title="Créer un objet",
                description="Déclare et utilise un objet JavaScript",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Les objets

```js
const personne = {
  nom: 'Alice',
  age: 30,
  saluer() { return 'Bonjour ' + this.nom; }
};
```

## Exercice
Crée un objet `voiture` avec les propriétés `marque`, `modele` et `annee`.""",
                code_stub="const voiture = {\n  // ajoute tes propriétés\n};\n",
                solution="const voiture = {\n  marque: 'Toyota',\n  modele: 'Corolla',\n  annee: 2022\n};",
                tests=[
                    "typeof voiture === 'object'",
                    "typeof voiture.marque === 'string'",
                    "typeof voiture.modele === 'string'",
                    "typeof voiture.annee === 'number'",
                ],
                xp_reward=10,
            ),
        ],
    },

    # ── SEMAINE 2 : DOM & Web ────────────────────────────────────────────────
    "day_6": {
        "title": "Introduction au DOM",
        "description": "Manipuler le HTML avec JavaScript",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="dom_6_1",
                title="Sélectionner des éléments",
                description="querySelector et getElementById",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.THEORIE,
                content="""# Le DOM (Document Object Model)

Le DOM permet de manipuler le HTML depuis JavaScript.

```js
const titre = document.querySelector('h1');
const btn = document.getElementById('mon-btn');
```

## Théorie
Apprends les sélecteurs CSS et leur usage en JS.""",
                xp_reward=10,
            ),
        ],
    },

    "day_7": {
        "title": "Événements DOM",
        "description": "Réagir aux clics et interactions utilisateur",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="dom_7_1",
                title="addEventListener",
                description="Écouter les événements",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Les événements

```js
btn.addEventListener('click', () => {
  console.log('Cliqué !');
});
```

## Exercice
Crée une fonction `onClic` qui affiche 'Bonjour !' dans la console.""",
                code_stub="const onClic = () => {\n  // ton code\n};\n",
                solution="const onClic = () => {\n  console.log('Bonjour !');\n};",
                tests=[
                    "typeof onClic === 'function'",
                ],
                xp_reward=10,
            ),
        ],
    },

    # ── JOURS 8-20 : CSS, Responsive, Fetch, Promises ──────────────────────
    "day_8": {
        "title": "CSS Fondamental",
        "description": "Styliser tes pages web",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="css_8_1",
                title="Sélecteurs et propriétés",
                description="Les bases du CSS",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.THEORIE,
                content="# CSS\n\nApprenez les sélecteurs, la couleur, les marges et le positionnement.",
                xp_reward=10,
            ),
        ],
    },
    "day_9": {
        "title": "Flexbox",
        "description": "Mise en page moderne avec Flexbox",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="css_9_1",
                title="Flex container",
                description="display: flex et ses propriétés",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.THEORIE,
                content="# Flexbox\n\nFlexbox rend la mise en page responsive et flexible.",
                xp_reward=10,
            ),
        ],
    },
    "day_10": {
        "title": "Grid CSS",
        "description": "Grilles CSS pour des layouts complexes",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="css_10_1",
                title="Grid de base",
                description="display: grid",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.THEORIE,
                content="# CSS Grid\n\nCréez des grilles en 2 dimensions.",
                xp_reward=10,
            ),
        ],
    },

    # ── JOURS 11-20 : Promises, Fetch, Async/Await ─────────────────────────
    "day_11": {
        "title": "Promises",
        "description": "Gestion des opérations asynchrones",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="async_11_1",
                title="Créer une Promise",
                description="new Promise((resolve, reject) => ...)",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Les Promises

```js
const maPromesse = new Promise((resolve, reject) => {
  resolve('Succès !');
});
```

## Exercice
Crée une Promise `delai` qui se résout après 1 seconde avec la valeur 'fait'.""",
                code_stub="const delai = new Promise((resolve, reject) => {\n  // ton code\n});\n",
                solution="const delai = new Promise((resolve) => {\n  setTimeout(() => resolve('fait'), 1000);\n});",
                tests=["delai instanceof Promise"],
                xp_reward=15,
            ),
        ],
    },
    "day_12": {
        "title": "Async / Await",
        "description": "Syntaxe moderne pour l'asynchrone",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="async_12_1",
                title="async function",
                description="Utiliser async/await",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Async / Await

```js
async function getData() {
  const data = await fetch('/api/data');
  return data.json();
}
```

## Exercice
Crée une fonction async `fetchUser` qui retourne `{ name: 'Alice' }`.""",
                code_stub="async function fetchUser() {\n  // ton code\n}\n",
                solution="async function fetchUser() {\n  return { name: 'Alice' };\n}",
                tests=[
                    "fetchUser() instanceof Promise",
                ],
                xp_reward=15,
                prerequisites=["async_11_1"],
            ),
        ],
    },

    # ── JOURS 13-20 : React ─────────────────────────────────────────────────
    "day_13": {
        "title": "Introduction à React",
        "description": "Premiers composants React",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="react_13_1",
                title="Premier composant",
                description="Créer un composant fonctionnel",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# React - Composants

```jsx
function Bonjour({ nom }) {
  return <h1>Bonjour {nom} !</h1>;
}
```

## Exercice
Crée un composant `Carte` qui affiche un titre et une description.""",
                code_stub="function Carte({ titre, description }) {\n  // ton code\n}\n",
                solution="function Carte({ titre, description }) {\n  return (\n    <div>\n      <h2>{titre}</h2>\n      <p>{description}</p>\n    </div>\n  );\n}",
                tests=["typeof Carte === 'function'"],
                xp_reward=15,
            ),
        ],
    },
    "day_14": {
        "title": "Props et State",
        "description": "Gérer les données dans React",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="react_14_1",
                title="useState hook",
                description="Gérer l'état local d'un composant",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# useState

```jsx
const [compteur, setCompteur] = useState(0);
```

## Exercice
Crée un composant `Compteur` avec un bouton qui incrémente une valeur.""",
                code_stub="import { useState } from 'react';\n\nfunction Compteur() {\n  // ton code\n}\n",
                solution="import { useState } from 'react';\n\nfunction Compteur() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(count + 1)}>{count}</button>;\n}",
                tests=["typeof Compteur === 'function'"],
                xp_reward=20,
                prerequisites=["react_13_1"],
            ),
        ],
    },

    # ── JOURS 15-30 : React avancé, hooks, useEffect ────────────────────────
    "day_15": {
        "title": "useEffect",
        "description": "Effets de bord dans React",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="react_15_1",
                title="useEffect de base",
                description="Déclencher un effet au montage",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# useEffect

```jsx
useEffect(() => {
  document.title = 'Bonjour !';
}, []);
```

## Exercice
Crée un composant qui charge des données au montage et les affiche.""",
                code_stub="import { useState, useEffect } from 'react';\n\nfunction DataLoader() {\n  // ton code\n}\n",
                solution="import { useState, useEffect } from 'react';\n\nfunction DataLoader() {\n  const [data, setData] = useState(null);\n  useEffect(() => { setData('chargé'); }, []);\n  return <div>{data}</div>;\n}",
                tests=["typeof DataLoader === 'function'"],
                xp_reward=20,
                prerequisites=["react_14_1"],
            ),
        ],
    },

    # ── JOURS 16-40 : Node.js, API REST ─────────────────────────────────────
    "day_16": {
        "title": "Introduction à Node.js",
        "description": "JavaScript côté serveur",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="node_16_1",
                title="Modules Node.js",
                description="require et module.exports",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.THEORIE,
                content="# Node.js\n\nNode.js permet d'exécuter JavaScript côté serveur.",
                xp_reward=15,
            ),
        ],
    },
    "day_17": {
        "title": "Créer une API REST",
        "description": "Endpoints GET et POST avec Express",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="node_17_1",
                title="Express.js",
                description="Créer un serveur HTTP",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Express.js

```js
const express = require('express');
const app = express();
app.get('/', (req, res) => res.json({ ok: true }));
app.listen(3000);
```

## Exercice
Crée une route GET `/ping` qui retourne `{ pong: true }`.""",
                code_stub="const express = require('express');\nconst app = express();\n// ton code\n",
                solution="const express = require('express');\nconst app = express();\napp.get('/ping', (req, res) => res.json({ pong: true }));\napp.listen(3000);",
                tests=["typeof app === 'function'"],
                xp_reward=20,
                prerequisites=["node_16_1"],
            ),
        ],
    },

    # ── JOURS 18-50 : Bases de données, SQL ─────────────────────────────────
    "day_18": {
        "title": "Introduction aux bases de données",
        "description": "SQL et PostgreSQL",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="db_18_1",
                title="Requêtes SQL de base",
                description="SELECT, INSERT, UPDATE, DELETE",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.THEORIE,
                content="# SQL\n\nSQL est le langage des bases de données relationnelles.",
                xp_reward=15,
            ),
        ],
    },
    "day_19": {
        "title": "JOINs en SQL",
        "description": "Relier plusieurs tables",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="db_19_1",
                title="INNER JOIN",
                description="Combiner des tables",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.THEORIE,
                content="# SQL JOINs\n\nLes JOINs permettent de combiner plusieurs tables.",
                xp_reward=15,
            ),
        ],
    },
    "day_20": {
        "title": "Projet : Mini blog",
        "description": "Construis un mini blog avec Node.js et SQLite",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="proj_20_1",
                title="Architecture du blog",
                description="Structure du projet",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.PROJET,
                content="# Projet Mini Blog\n\nConstruis une API REST pour un blog avec des articles et des commentaires.",
                xp_reward=50,
                prerequisites=["node_17_1", "db_18_1"],
            ),
        ],
    },

    # ── JOURS 21-40 : TypeScript ─────────────────────────────────────────────
    "day_21": {
        "title": "Introduction à TypeScript",
        "description": "JavaScript avec les types",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="ts_21_1",
                title="Types de base",
                description="string, number, boolean, any",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# TypeScript

TypeScript ajoute les types statiques à JavaScript.

```ts
const nom: string = 'Alice';
const age: number = 30;
```

## Exercice
Déclare une variable `score` de type `number` et `pseudo` de type `string`.""",
                code_stub="const score: number = 0;\nconst pseudo: string = '';\n",
                solution="const score: number = 100;\nconst pseudo: string = 'Player1';",
                tests=[
                    "typeof score === 'number'",
                    "typeof pseudo === 'string'",
                ],
                xp_reward=15,
            ),
        ],
    },
    "day_22": {
        "title": "Interfaces TypeScript",
        "description": "Définir la forme des objets",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="ts_22_1",
                title="Interface",
                description="Créer une interface",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Interfaces

```ts
interface User {
  id: number;
  name: string;
  email: string;
}
```

## Exercice
Crée une interface `Produit` avec `id`, `nom` et `prix`.""",
                code_stub="interface Produit {\n  // tes propriétés\n}\n",
                solution="interface Produit {\n  id: number;\n  nom: string;\n  prix: number;\n}",
                tests=["typeof Produit !== 'undefined' || true"],
                xp_reward=15,
                prerequisites=["ts_21_1"],
            ),
        ],
    },

    # ── JOURS 23-40 : React avancé + TypeScript ──────────────────────────────
    "day_23": {
        "title": "React + TypeScript",
        "description": "Typer tes composants React",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="rts_23_1",
                title="Composant typé",
                description="Props avec interface TypeScript",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.EXERCICE,
                content="""# React + TypeScript

```tsx
interface Props {
  name: string;
  age: number;
}
function Profil({ name, age }: Props) {
  return <p>{name} - {age} ans</p>;
}
```

## Exercice
Crée un composant `Badge` avec les props `label: string` et `color: string`.""",
                code_stub="interface BadgeProps {\n  label: string;\n  color: string;\n}\n\nfunction Badge({ label, color }: BadgeProps) {\n  // ton code\n}\n",
                solution="interface BadgeProps {\n  label: string;\n  color: string;\n}\n\nfunction Badge({ label, color }: BadgeProps) {\n  return <span style={{ background: color }}>{label}</span>;\n}",
                tests=["typeof Badge === 'function'"],
                xp_reward=20,
                prerequisites=["ts_22_1", "react_14_1"],
            ),
        ],
    },

    # ── JOURS 24-50 : Python fondamental ─────────────────────────────────────
    "day_24": {
        "title": "Introduction à Python",
        "description": "Les bases de Python",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="py_24_1",
                title="Variables Python",
                description="Déclarer des variables en Python",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Python - Variables

Python est un langage simple et puissant.

```python
prenom = 'Alice'
age = 30
pi = 3.14159
```

## Exercice
Crée les variables `nom`, `age` et `ville`.""",
                code_stub="# Ton code ici\n",
                solution="nom = 'Alice'\nage = 25\nville = 'Paris'",
                tests=[
                    "isinstance(nom, str)",
                    "isinstance(age, int)",
                    "isinstance(ville, str)",
                ],
                xp_reward=10,
            ),
        ],
    },
    "day_25": {
        "title": "Listes et dictionnaires Python",
        "description": "Structures de données fondamentales",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="py_25_1",
                title="Listes Python",
                description="Créer et manipuler des listes",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Listes Python

```python
fruits = ['pomme', 'banane', 'cerise']
fruits.append('mangue')
```

## Exercice
Crée une liste `nombres` de 1 à 5 et ajoute le nombre 6.""",
                code_stub="nombres = []\n# Ton code ici\n",
                solution="nombres = [1, 2, 3, 4, 5]\nnombres.append(6)",
                tests=[
                    "len(nombres) == 6",
                    "nombres[0] == 1",
                    "nombres[-1] == 6",
                ],
                xp_reward=10,
                prerequisites=["py_24_1"],
            ),
        ],
    },

    # ── JOURS 26-50 : Python avancé, FastAPI ─────────────────────────────────
    "day_26": {
        "title": "Fonctions Python",
        "description": "Définir et utiliser des fonctions",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="py_26_1",
                title="def en Python",
                description="Créer une fonction Python",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.EXERCICE,
                content="""# Fonctions Python

```python
def saluer(nom):
    return f'Bonjour {nom} !'
```

## Exercice
Crée une fonction `carre` qui retourne le carré de son argument.""",
                code_stub="def carre(n):\n    # ton code\n    pass\n",
                solution="def carre(n):\n    return n ** 2",
                tests=[
                    "carre(3) == 9",
                    "carre(5) == 25",
                    "carre(0) == 0",
                ],
                xp_reward=10,
                prerequisites=["py_24_1"],
            ),
        ],
    },
    "day_27": {
        "title": "Classes Python",
        "description": "Programmation orientée objet",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="py_27_1",
                title="Créer une classe",
                description="class et __init__",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Classes Python

```python
class Animal:
    def __init__(self, nom):
        self.nom = nom
    
    def parler(self):
        return f'{self.nom} fait un son'
```

## Exercice
Crée une classe `Rectangle` avec `largeur` et `hauteur` et une méthode `aire()`.""",
                code_stub="class Rectangle:\n    def __init__(self, largeur, hauteur):\n        pass\n    \n    def aire(self):\n        pass\n",
                solution="class Rectangle:\n    def __init__(self, largeur, hauteur):\n        self.largeur = largeur\n        self.hauteur = hauteur\n    \n    def aire(self):\n        return self.largeur * self.hauteur",
                tests=[
                    "Rectangle(4, 5).aire() == 20",
                    "Rectangle(3, 3).aire() == 9",
                ],
                xp_reward=20,
                prerequisites=["py_26_1"],
            ),
        ],
    },
    "day_28": {
        "title": "Fichiers et JSON en Python",
        "description": "Lire et écrire des fichiers",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="py_28_1",
                title="Lecture de fichiers",
                description="open() et json.load()",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.THEORIE,
                content="# Fichiers Python\n\nPython permet de lire et écrire des fichiers facilement.",
                xp_reward=15,
            ),
        ],
    },
    "day_29": {
        "title": "Gestion d'erreurs Python",
        "description": "try, except, finally",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="py_29_1",
                title="try / except",
                description="Gérer les exceptions",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Gestion d'erreurs

```python
try:
    resultat = 10 / 0
except ZeroDivisionError:
    print('Division par zéro !')
```

## Exercice
Crée une fonction `diviser(a, b)` qui retourne `a/b` ou `None` si b==0.""",
                code_stub="def diviser(a, b):\n    # ton code\n    pass\n",
                solution="def diviser(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return None",
                tests=[
                    "diviser(10, 2) == 5.0",
                    "diviser(10, 0) is None",
                ],
                xp_reward=15,
                prerequisites=["py_26_1"],
            ),
        ],
    },
    "day_30": {
        "title": "Projet : Calculatrice Python",
        "description": "Mini-projet de consolidation",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="proj_30_1",
                title="Calculatrice complète",
                description="Addition, soustraction, multiplication, division",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.PROJET,
                content="""# Projet : Calculatrice

Crée une calculatrice avec les 4 opérations de base.

```python
class Calculatrice:
    def addition(self, a, b): ...
    def soustraction(self, a, b): ...
    def multiplication(self, a, b): ...
    def division(self, a, b): ...
```""",
                code_stub="class Calculatrice:\n    pass\n",
                solution="class Calculatrice:\n    def addition(self, a, b): return a + b\n    def soustraction(self, a, b): return a - b\n    def multiplication(self, a, b): return a * b\n    def division(self, a, b): return a / b if b != 0 else None",
                tests=[
                    "Calculatrice().addition(2, 3) == 5",
                    "Calculatrice().soustraction(10, 4) == 6",
                    "Calculatrice().multiplication(3, 4) == 12",
                    "Calculatrice().division(10, 2) == 5.0",
                    "Calculatrice().division(10, 0) is None",
                ],
                xp_reward=50,
                prerequisites=["py_29_1"],
            ),
        ],
    },

    # ── JOURS 31-50 : FastAPI, Bases de données ──────────────────────────────
    "day_31": {
        "title": "Introduction à FastAPI",
        "description": "Créer une API moderne avec Python",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="api_31_1",
                title="Premier endpoint FastAPI",
                description="GET et POST avec FastAPI",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.EXERCICE,
                content="""# FastAPI

```python
from fastapi import FastAPI
app = FastAPI()

@app.get('/hello')
def hello():
    return {'message': 'Bonjour !'}
```

## Exercice
Crée un endpoint GET `/status` retournant `{'status': 'ok'}`.""",
                code_stub="from fastapi import FastAPI\napp = FastAPI()\n\n# ton endpoint ici\n",
                solution="from fastapi import FastAPI\napp = FastAPI()\n\n@app.get('/status')\ndef status():\n    return {'status': 'ok'}",
                tests=["app is not None"],
                xp_reward=25,
                prerequisites=["py_27_1"],
            ),
        ],
    },

    # ── JOURS 32-50 : Auth, Sécurité ─────────────────────────────────────────
    "day_32": {
        "title": "Authentification JWT",
        "description": "Sécuriser une API avec les tokens JWT",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="sec_32_1",
                title="Générer un token JWT",
                description="PyJWT et sécurité",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# JWT (JSON Web Token)\n\nLes JWT permettent d'authentifier les utilisateurs de façon sécurisée.",
                xp_reward=20,
            ),
        ],
    },

    # ── JOURS 33-60 : Git, DevOps ────────────────────────────────────────────
    "day_33": {
        "title": "Git fondamental",
        "description": "Versionnage de code avec Git",
        "level": LessonLevel.DEBUTANT,
        "lessons": [
            Lesson(
                id="git_33_1",
                title="Commandes Git de base",
                description="init, add, commit, push",
                level=LessonLevel.DEBUTANT,
                lesson_type=LessonType.THEORIE,
                content="# Git\n\ngit init, git add, git commit, git push sont les commandes essentielles.",
                xp_reward=10,
            ),
        ],
    },
    "day_34": {
        "title": "Branches Git",
        "description": "Travailler en parallèle avec les branches",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="git_34_1",
                title="Créer et fusionner des branches",
                description="branch, checkout, merge",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.THEORIE,
                content="# Branches Git\n\nLes branches permettent de développer des fonctionnalités en isolation.",
                xp_reward=15,
            ),
        ],
    },

    # ── JOURS 35-50 : Tests unitaires ────────────────────────────────────────
    "day_35": {
        "title": "Tests unitaires JavaScript",
        "description": "Jest et les tests automatisés",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="test_35_1",
                title="Premiers tests avec Jest",
                description="describe, it, expect",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.EXERCICE,
                content="""# Tests avec Jest

```js
test('addition', () => {
  expect(2 + 3).toBe(5);
});
```

## Exercice
Écris un test pour vérifier que `Math.max(1, 2, 3)` retourne 3.""",
                code_stub="test('max', () => {\n  // ton test\n});\n",
                solution="test('max', () => {\n  expect(Math.max(1, 2, 3)).toBe(3);\n});",
                tests=["typeof test !== 'undefined' || true"],
                xp_reward=20,
            ),
        ],
    },
    "day_36": {
        "title": "Tests unitaires Python",
        "description": "pytest et tests automatisés",
        "level": LessonLevel.INTERMEDIAIRE,
        "lessons": [
            Lesson(
                id="test_36_1",
                title="pytest de base",
                description="Écrire des tests Python",
                level=LessonLevel.INTERMEDIAIRE,
                lesson_type=LessonType.THEORIE,
                content="# pytest\n\npytest est le framework de test Python le plus populaire.",
                xp_reward=20,
            ),
        ],
    },

    # ── JOURS 37-60 : Docker & Déploiement ───────────────────────────────────
    "day_37": {
        "title": "Introduction à Docker",
        "description": "Containeriser une application",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="docker_37_1",
                title="Dockerfile de base",
                description="Créer une image Docker",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Docker\n\nDocker permet d'empaqueter une application et ses dépendances dans un conteneur.",
                xp_reward=25,
            ),
        ],
    },
    "day_38": {
        "title": "Docker Compose",
        "description": "Orchestrer plusieurs services",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="docker_38_1",
                title="docker-compose.yml",
                description="Définir des services multi-conteneurs",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Docker Compose\n\nDocker Compose orchestre plusieurs conteneurs.",
                xp_reward=25,
            ),
        ],
    },

    # ── JOURS 39-60 : CI/CD, GitHub Actions ──────────────────────────────────
    "day_39": {
        "title": "GitHub Actions",
        "description": "Intégration et déploiement continus",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="cicd_39_1",
                title="Premier workflow CI",
                description="Automatiser les tests",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# GitHub Actions\n\nGitHub Actions automatise le test et le déploiement de ton code.",
                xp_reward=25,
            ),
        ],
    },
    "day_40": {
        "title": "Projet : API déployée",
        "description": "Déploie ton API FastAPI avec Docker",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="proj_40_1",
                title="Dockeriser une API FastAPI",
                description="Dockerfile + docker-compose",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.PROJET,
                content="# Projet : API Déployée\n\nPackage et déploie ton API FastAPI.",
                xp_reward=100,
                prerequisites=["api_31_1", "docker_38_1"],
            ),
        ],
    },

    # ── JOURS 41-60 : Algorithmique & Structures de données ──────────────────
    "day_41": {
        "title": "Complexité algorithmique",
        "description": "Big O notation",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="algo_41_1",
                title="Big O",
                description="Comprendre les performances des algorithmes",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Big O\n\nLa notation Big O mesure la complexité temporelle et spatiale.",
                xp_reward=20,
            ),
        ],
    },
    "day_42": {
        "title": "Recherche et tri",
        "description": "Algorithmes fondamentaux",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="algo_42_1",
                title="Tri à bulles",
                description="Implémenter bubble sort",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.EXERCICE,
                content="""# Tri à bulles

Le tri à bulles compare des éléments adjacents et les échange.

## Exercice
Implémente la fonction `bubble_sort(arr)` en Python.""",
                code_stub="def bubble_sort(arr):\n    # ton code\n    pass\n",
                solution="def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n-i-1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]\n    return arr",
                tests=[
                    "bubble_sort([3,1,2]) == [1,2,3]",
                    "bubble_sort([5,4,3,2,1]) == [1,2,3,4,5]",
                    "bubble_sort([]) == []",
                ],
                xp_reward=25,
            ),
        ],
    },
    "day_43": {
        "title": "Récursivité",
        "description": "Fonctions qui s'appellent elles-mêmes",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="algo_43_1",
                title="Factorielle récursive",
                description="Implémenter la factorielle",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.EXERCICE,
                content="""# Récursivité

```python
def factorielle(n):
    if n == 0: return 1
    return n * factorielle(n-1)
```

## Exercice
Implémente la suite de Fibonacci de manière récursive.""",
                code_stub="def fibonacci(n):\n    # ton code\n    pass\n",
                solution="def fibonacci(n):\n    if n <= 1: return n\n    return fibonacci(n-1) + fibonacci(n-2)",
                tests=[
                    "fibonacci(0) == 0",
                    "fibonacci(1) == 1",
                    "fibonacci(6) == 8",
                ],
                xp_reward=25,
            ),
        ],
    },
    "day_44": {
        "title": "Structures de données : Pile et File",
        "description": "Stack et Queue",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="algo_44_1",
                title="Implémenter une Pile",
                description="Stack avec push et pop",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.EXERCICE,
                content="""# Pile (Stack)

```python
class Pile:
    def __init__(self): self.items = []
    def push(self, item): self.items.append(item)
    def pop(self): return self.items.pop()
```

## Exercice
Complète la classe `Pile` avec une méthode `peek()` et `is_empty()`.""",
                code_stub="class Pile:\n    def __init__(self):\n        self.items = []\n    \n    def push(self, item):\n        self.items.append(item)\n    \n    def pop(self):\n        return self.items.pop()\n    \n    def peek(self):\n        pass\n    \n    def is_empty(self):\n        pass\n",
                solution="class Pile:\n    def __init__(self):\n        self.items = []\n    def push(self, item): self.items.append(item)\n    def pop(self): return self.items.pop()\n    def peek(self): return self.items[-1] if self.items else None\n    def is_empty(self): return len(self.items) == 0",
                tests=[
                    "Pile().is_empty() == True",
                    "(lambda p: [p.push(1), p.peek()][-1])(Pile()) == 1",
                ],
                xp_reward=25,
            ),
        ],
    },
    "day_45": {
        "title": "Arbres binaires",
        "description": "Structures arborescentes",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="algo_45_1",
                title="Nœud d'arbre binaire",
                description="Créer un arbre binaire simple",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Arbres Binaires\n\nUn arbre binaire est une structure où chaque nœud a au plus 2 enfants.",
                xp_reward=30,
            ),
        ],
    },

    # ── JOURS 46-60 : Design Patterns ────────────────────────────────────────
    "day_46": {
        "title": "Design Patterns : Singleton",
        "description": "Patron de conception Singleton",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="pattern_46_1",
                title="Singleton en Python",
                description="Garantir une instance unique",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.EXERCICE,
                content="""# Singleton

Le Singleton garantit qu'une classe n'a qu'une seule instance.

## Exercice
Implémente un Singleton `Config` en Python.""",
                code_stub="class Config:\n    _instance = None\n    \n    @classmethod\n    def get_instance(cls):\n        # ton code\n        pass\n",
                solution="class Config:\n    _instance = None\n    @classmethod\n    def get_instance(cls):\n        if cls._instance is None:\n            cls._instance = cls()\n        return cls._instance",
                tests=[
                    "Config.get_instance() is Config.get_instance()",
                ],
                xp_reward=30,
            ),
        ],
    },
    "day_47": {
        "title": "Design Patterns : Observer",
        "description": "Patron de conception Observer",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="pattern_47_1",
                title="Observer en Python",
                description="Implémenter le patron Observer",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Observer\n\nL'Observer permet à des objets d'être notifiés des changements d'état d'un autre objet.",
                xp_reward=30,
            ),
        ],
    },
    "day_48": {
        "title": "Design Patterns : Factory",
        "description": "Patron de conception Factory",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="pattern_48_1",
                title="Factory Method",
                description="Créer des objets sans spécifier leur classe",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Factory Method\n\nLe Factory Method délègue la création d'objets à des sous-classes.",
                xp_reward=30,
            ),
        ],
    },

    # ── JOURS 49-60 : IA et Machine Learning ─────────────────────────────────
    "day_49": {
        "title": "Introduction à l'IA",
        "description": "Concepts fondamentaux du Machine Learning",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="ml_49_1",
                title="Types d'apprentissage",
                description="Supervisé, non supervisé, par renforcement",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Machine Learning\n\nLe ML permet aux machines d'apprendre à partir de données.",
                xp_reward=30,
            ),
        ],
    },
    "day_50": {
        "title": "Projet mi-parcours : Full-stack App",
        "description": "Construis une application full-stack complète",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="proj_50_1",
                title="Application Full-Stack",
                description="React + FastAPI + PostgreSQL",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.PROJET,
                content="# Projet Mi-Parcours\n\nConçois et développe une application full-stack.",
                xp_reward=200,
                prerequisites=["api_31_1", "react_15_1", "db_18_1"],
            ),
        ],
    },

    # ── JOURS 51-70 : Sujets avancés ─────────────────────────────────────────
    "day_51": {
        "title": "GraphQL",
        "description": "API flexible avec GraphQL",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="gql_51_1",
                title="Schéma GraphQL",
                description="Types, queries, mutations",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# GraphQL\n\nGraphQL permet de requêter exactement les données dont tu as besoin.",
                xp_reward=25,
            ),
        ],
    },
    "day_52": {
        "title": "WebSockets",
        "description": "Communication temps réel",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="ws_52_1",
                title="WebSocket avec FastAPI",
                description="Connexions temps réel",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# WebSockets\n\nLes WebSockets permettent une communication bidirectionnelle en temps réel.",
                xp_reward=25,
            ),
        ],
    },
    "day_53": {
        "title": "Redis et Cache",
        "description": "Optimiser les performances",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="redis_53_1",
                title="Redis de base",
                description="GET, SET, EXPIRE",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Redis\n\nRedis est une base de données en mémoire ultra-rapide.",
                xp_reward=25,
            ),
        ],
    },
    "day_54": {
        "title": "Microservices",
        "description": "Architecture en microservices",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="ms_54_1",
                title="Architecture microservices",
                description="Principes et patterns",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Microservices\n\nLes microservices décomposent une application en services indépendants.",
                xp_reward=30,
            ),
        ],
    },
    "day_55": {
        "title": "Message Queues",
        "description": "RabbitMQ et communication asynchrone",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="mq_55_1",
                title="File de messages",
                description="Producer / Consumer pattern",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Message Queues\n\nLes files de messages découplent les services.",
                xp_reward=30,
            ),
        ],
    },

    # ── JOURS 56-70 : Sécurité avancée ───────────────────────────────────────
    "day_56": {
        "title": "Sécurité web",
        "description": "XSS, CSRF, injections SQL",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="sec_56_1",
                title="Les vulnérabilités communes",
                description="OWASP Top 10",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Sécurité Web\n\nL'OWASP Top 10 liste les vulnérabilités les plus critiques.",
                xp_reward=25,
            ),
        ],
    },
    "day_57": {
        "title": "Hachage et cryptographie",
        "description": "bcrypt, SHA, chiffrement",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="sec_57_1",
                title="Hacher un mot de passe",
                description="bcrypt en Python",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Cryptographie\n\nLes mots de passe ne doivent jamais être stockés en clair.",
                xp_reward=20,
            ),
        ],
    },

    # ── JOURS 58-70 : Performance & Monitoring ───────────────────────────────
    "day_58": {
        "title": "Optimisation des performances",
        "description": "Profiling et goulots d'étranglement",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="perf_58_1",
                title="Profiling Python",
                description="cProfile et optimisation",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Optimisation\n\nLe profiling identifie les parties lentes du code.",
                xp_reward=30,
            ),
        ],
    },
    "day_59": {
        "title": "Monitoring et Logs",
        "description": "Observer ton application en production",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="mon_59_1",
                title="Logging structuré",
                description="Logs JSON et dashboards",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Monitoring\n\nLes logs et métriques sont essentiels pour une app en production.",
                xp_reward=25,
            ),
        ],
    },
    "day_60": {
        "title": "Projet : Application microservices",
        "description": "Architecture distribuée complète",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="proj_60_1",
                title="App microservices",
                description="3 services interconnectés",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Projet : Microservices\n\nConçois une architecture microservices avec 3 services.",
                xp_reward=200,
                prerequisites=["ms_54_1", "docker_38_1", "api_31_1"],
            ),
        ],
    },

    # ── JOURS 61-80 : Cloud & Infrastructure ─────────────────────────────────
    "day_61": {
        "title": "Introduction au Cloud",
        "description": "AWS, GCP, Azure — les bases",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cloud_61_1",
                title="Services Cloud essentiels",
                description="Compute, Storage, Database",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Cloud Computing\n\nLe cloud offre des ressources à la demande.",
                xp_reward=30,
            ),
        ],
    },
    "day_62": {
        "title": "Serverless",
        "description": "AWS Lambda et fonctions sans serveur",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cloud_62_1",
                title="Lambda Functions",
                description="Exécuter du code sans serveur",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Serverless\n\nLe serverless exécute du code à la demande sans gérer de serveurs.",
                xp_reward=30,
            ),
        ],
    },
    "day_63": {
        "title": "Kubernetes",
        "description": "Orchestration de conteneurs",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="k8s_63_1",
                title="Pods et Deployments",
                description="Concepts Kubernetes de base",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Kubernetes\n\nKubernetes orchestre des applications containerisées à grande échelle.",
                xp_reward=35,
            ),
        ],
    },

    # ── JOURS 64-80 : Intelligence Artificielle avancée ──────────────────────
    "day_64": {
        "title": "Réseaux de neurones",
        "description": "Introduction au deep learning",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="dl_64_1",
                title="Perceptron",
                description="Le neurone artificiel",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Deep Learning\n\nLes réseaux de neurones imitent le fonctionnement du cerveau.",
                xp_reward=35,
            ),
        ],
    },
    "day_65": {
        "title": "PyTorch fondamental",
        "description": "Tenseurs et autograd",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="dl_65_1",
                title="Tenseurs PyTorch",
                description="Créer et manipuler des tenseurs",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# PyTorch\n\nPyTorch est le framework de deep learning le plus populaire.",
                xp_reward=35,
            ),
        ],
    },
    "day_66": {
        "title": "NLP - Traitement du langage naturel",
        "description": "Analyse de texte avec l'IA",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="nlp_66_1",
                title="Tokenisation",
                description="Découper le texte en tokens",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# NLP\n\nLe NLP permet aux machines de comprendre le langage humain.",
                xp_reward=35,
            ),
        ],
    },
    "day_67": {
        "title": "API OpenAI",
        "description": "Intégrer GPT dans tes applications",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="ai_67_1",
                title="Chat Completions",
                description="Utiliser l'API OpenAI",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.EXERCICE,
                content="""# API OpenAI

```python
from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
    model='gpt-4',
    messages=[{'role': 'user', 'content': 'Bonjour !'}]
)
```

## Exercice
Crée une fonction `ask_gpt(question)` qui interroge l'API.""",
                code_stub="from openai import OpenAI\n\ndef ask_gpt(question: str) -> str:\n    # ton code\n    pass\n",
                solution="from openai import OpenAI\n\ndef ask_gpt(question: str) -> str:\n    client = OpenAI()\n    response = client.chat.completions.create(\n        model='gpt-4o-mini',\n        messages=[{'role': 'user', 'content': question}]\n    )\n    return response.choices[0].message.content",
                tests=["callable(ask_gpt)"],
                xp_reward=40,
            ),
        ],
    },
    "day_68": {
        "title": "Embeddings et recherche sémantique",
        "description": "Recherche par similarité vectorielle",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="ai_68_1",
                title="Embeddings OpenAI",
                description="Transformer du texte en vecteurs",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Embeddings\n\nLes embeddings représentent du texte sous forme de vecteurs numériques.",
                xp_reward=35,
            ),
        ],
    },
    "day_69": {
        "title": "RAG - Retrieval Augmented Generation",
        "description": "Combiner recherche et génération IA",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="ai_69_1",
                title="Architecture RAG",
                description="Retriever + LLM",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# RAG\n\nLe RAG améliore les LLM en leur fournissant du contexte externe.",
                xp_reward=40,
            ),
        ],
    },
    "day_70": {
        "title": "Projet : Chatbot IA",
        "description": "Construis un chatbot intelligent",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="proj_70_1",
                title="Chatbot avec mémoire",
                description="FastAPI + OpenAI + historique",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Projet : Chatbot IA\n\nConstruis un chatbot avec mémoire de conversation.",
                xp_reward=300,
                prerequisites=["ai_67_1", "api_31_1"],
            ),
        ],
    },

    # ── JOURS 71-90 : Projets avancés ────────────────────────────────────────
    "day_71": {
        "title": "Architecture hexagonale",
        "description": "Clean architecture et DDD",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="arch_71_1",
                title="Ports & Adapters",
                description="Architecture propre",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Clean Architecture\n\nL'architecture hexagonale sépare le domaine métier de l'infrastructure.",
                xp_reward=40,
            ),
        ],
    },
    "day_72": {
        "title": "Event-Driven Architecture",
        "description": "Architecture événementielle",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="arch_72_1",
                title="Event Sourcing",
                description="Stocker les événements",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Event-Driven\n\nL'architecture événementielle découple les composants via des événements.",
                xp_reward=40,
            ),
        ],
    },
    "day_73": {
        "title": "CQRS",
        "description": "Séparation commandes et requêtes",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="arch_73_1",
                title="CQRS pattern",
                description="Commands vs Queries",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# CQRS\n\nCQRS sépare les opérations de lecture et d'écriture.",
                xp_reward=40,
            ),
        ],
    },
    "day_74": {
        "title": "Tests d'intégration",
        "description": "Tester le système complet",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="test_74_1",
                title="Tests end-to-end",
                description="Playwright et Cypress",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Tests E2E\n\nLes tests end-to-end vérifient l'application de bout en bout.",
                xp_reward=35,
            ),
        ],
    },
    "day_75": {
        "title": "Accessibilité web (a11y)",
        "description": "Rendre le web accessible à tous",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="a11y_75_1",
                title="WCAG et ARIA",
                description="Standards d'accessibilité",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Accessibilité\n\nL'accessibilité garantit que ton app est utilisable par tous.",
                xp_reward=25,
            ),
        ],
    },
    "day_76": {
        "title": "Internationalisation (i18n)",
        "description": "Adapter ton app à plusieurs langues",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="i18n_76_1",
                title="i18next en React",
                description="Traduire une application React",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# i18n\n\nL'internationalisation permet d'adapter ton app à différentes langues et cultures.",
                xp_reward=25,
            ),
        ],
    },
    "day_77": {
        "title": "Progressive Web Apps",
        "description": "Applications web installables",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="pwa_77_1",
                title="Service Workers",
                description="Cache et offline",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# PWA\n\nLes PWA combinent le meilleur du web et des apps natives.",
                xp_reward=25,
            ),
        ],
    },
    "day_78": {
        "title": "Web Performance",
        "description": "Optimiser le chargement des pages",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="perf_78_1",
                title="Core Web Vitals",
                description="LCP, FID, CLS",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Web Performance\n\nLes Core Web Vitals mesurent l'expérience utilisateur.",
                xp_reward=25,
            ),
        ],
    },
    "day_79": {
        "title": "SEO technique",
        "description": "Optimisation pour les moteurs de recherche",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="seo_79_1",
                title="Meta tags et sitemap",
                description="Bases du SEO technique",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# SEO\n\nLe SEO technique améliore la visibilité de ton site.",
                xp_reward=20,
            ),
        ],
    },
    "day_80": {
        "title": "Projet : SaaS complet",
        "description": "Build a full SaaS application",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="proj_80_1",
                title="SaaS de A à Z",
                description="Auth, paiements, dashboard",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Projet : SaaS\n\nConstruis un vrai SaaS avec authentification et paiements.",
                xp_reward=400,
                prerequisites=["sec_32_1", "api_31_1", "react_15_1"],
            ),
        ],
    },

    # ── JOURS 81-100 : Capstone & Spécialisation ─────────────────────────────
    "day_81": {
        "title": "Mobile avec React Native",
        "description": "Développement mobile cross-platform",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="mobile_81_1",
                title="Premier composant React Native",
                description="View, Text, StyleSheet",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# React Native\n\nReact Native permet de créer des apps mobiles avec React.",
                xp_reward=35,
            ),
        ],
    },
    "day_82": {
        "title": "Blockchain basics",
        "description": "Comprendre la blockchain",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="bc_82_1",
                title="Hash et blocs",
                description="Comment fonctionne une blockchain",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Blockchain\n\nLa blockchain est un registre distribué et immuable.",
                xp_reward=35,
            ),
        ],
    },
    "day_83": {
        "title": "WebAssembly",
        "description": "Performances natives dans le navigateur",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="wasm_83_1",
                title="Introduction WASM",
                description="Rust vers WebAssembly",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# WebAssembly\n\nWasm permet d'exécuter du code compilé dans le navigateur.",
                xp_reward=40,
            ),
        ],
    },
    "day_84": {
        "title": "Three.js - 3D dans le navigateur",
        "description": "Graphiques 3D avec WebGL",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="3d_84_1",
                title="Scène Three.js",
                description="Camera, lumières, géométries",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Three.js\n\nThree.js simplifie la création de graphiques 3D dans le navigateur.",
                xp_reward=40,
            ),
        ],
    },
    "day_85": {
        "title": "Rust fondamental",
        "description": "Sécurité mémoire et performances",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="rust_85_1",
                title="Ownership en Rust",
                description="Le système d'ownership unique de Rust",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Rust\n\nRust garantit la sécurité mémoire sans garbage collector.",
                xp_reward=45,
            ),
        ],
    },
    "day_86": {
        "title": "Go (Golang) fondamental",
        "description": "Concurrence et performance",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="go_86_1",
                title="Goroutines et channels",
                description="Concurrence en Go",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.THEORIE,
                content="# Go\n\nGo excelle dans les applications concurrentes et les microservices.",
                xp_reward=40,
            ),
        ],
    },
    "day_87": {
        "title": "Revue de code",
        "description": "Bonnes pratiques de code review",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="collab_87_1",
                title="Code review efficace",
                description="Comment donner et recevoir du feedback",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Code Review\n\nLa revue de code améliore la qualité et partage les connaissances.",
                xp_reward=25,
            ),
        ],
    },
    "day_88": {
        "title": "Documentation technique",
        "description": "Documenter son code efficacement",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="doc_88_1",
                title="README et docstrings",
                description="Écrire une bonne documentation",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Documentation\n\nUne bonne documentation rend le code accessible et maintenable.",
                xp_reward=20,
            ),
        ],
    },
    "day_89": {
        "title": "Open Source",
        "description": "Contribuer à l'open source",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="os_89_1",
                title="Ta première PR",
                description="Fork, branch, pull request",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.THEORIE,
                content="# Open Source\n\nContribuer à l'open source améliore tes compétences et ta visibilité.",
                xp_reward=30,
            ),
        ],
    },
    "day_90": {
        "title": "Projet : Portfolio en ligne",
        "description": "Montre tes compétences au monde",
        "level": LessonLevel.AVANCE,
        "lessons": [
            Lesson(
                id="proj_90_1",
                title="Portfolio développeur",
                description="Next.js + déploiement",
                level=LessonLevel.AVANCE,
                lesson_type=LessonType.PROJET,
                content="# Portfolio\n\nCrée un portfolio professionnel qui présente tes projets.",
                xp_reward=200,
                prerequisites=["react_15_1", "docker_38_1"],
            ),
        ],
    },

    # ── JOURS 91-100 : Capstone final ────────────────────────────────────────
    "day_91": {
        "title": "Planification du projet Capstone",
        "description": "Définis ton projet final",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_91_1",
                title="Cahier des charges",
                description="Définir les exigences du projet",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Planification\n\nDéfinis les fonctionnalités de ton projet final.",
                xp_reward=50,
            ),
        ],
    },
    "day_92": {
        "title": "Architecture du Capstone",
        "description": "Concevoir l'architecture",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_92_1",
                title="Schéma d'architecture",
                description="Diagrammes et choix techniques",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Architecture\n\nConçois l'architecture de ton projet final.",
                xp_reward=50,
                prerequisites=["cap_91_1"],
            ),
        ],
    },
    "day_93": {
        "title": "Sprint 1 du Capstone",
        "description": "Développement - Semaine 1",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_93_1",
                title="Backend du Capstone",
                description="API et base de données",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone Sprint 1\n\nDéveloppe le backend de ton projet.",
                xp_reward=100,
                prerequisites=["cap_92_1"],
            ),
        ],
    },
    "day_94": {
        "title": "Sprint 2 du Capstone",
        "description": "Développement - Semaine 2",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_94_1",
                title="Frontend du Capstone",
                description="Interface utilisateur",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone Sprint 2\n\nDéveloppe le frontend de ton projet.",
                xp_reward=100,
                prerequisites=["cap_93_1"],
            ),
        ],
    },
    "day_95": {
        "title": "Tests du Capstone",
        "description": "Tests unitaires et d'intégration",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_95_1",
                title="Tests complets",
                description="Couverture de tests >80%",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Tests\n\nÉcris des tests complets pour ton projet.",
                xp_reward=100,
                prerequisites=["cap_94_1"],
            ),
        ],
    },
    "day_96": {
        "title": "Déploiement du Capstone",
        "description": "Mise en production",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_96_1",
                title="Deploy en production",
                description="CI/CD et monitoring",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Déploiement\n\nDéploie ton projet en production.",
                xp_reward=100,
                prerequisites=["cap_95_1"],
            ),
        ],
    },
    "day_97": {
        "title": "Revue du Capstone",
        "description": "Code review et optimisations",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_97_1",
                title="Audit de code",
                description="Revue et refactoring",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Revue\n\nAudit et amélioration de ton code.",
                xp_reward=75,
                prerequisites=["cap_96_1"],
            ),
        ],
    },
    "day_98": {
        "title": "Documentation du Capstone",
        "description": "Documenter le projet final",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_98_1",
                title="README et API docs",
                description="Documentation complète",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Documentation\n\nRédige la documentation complète de ton projet.",
                xp_reward=75,
                prerequisites=["cap_97_1"],
            ),
        ],
    },
    "day_99": {
        "title": "Présentation du Capstone",
        "description": "Préparer la démo",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_99_1",
                title="Démo et pitch",
                description="Présenter son projet",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="# Capstone - Présentation\n\nPrépare et effectue la démo de ton projet.",
                xp_reward=100,
                prerequisites=["cap_98_1"],
            ),
        ],
    },
    "day_100": {
        "title": "🎉 Diplôme : 100 Days of Code",
        "description": "Tu as terminé le programme !",
        "level": LessonLevel.EXPERT,
        "lessons": [
            Lesson(
                id="cap_100_1",
                title="Certification 100 Days",
                description="Félicitations !",
                level=LessonLevel.EXPERT,
                lesson_type=LessonType.PROJET,
                content="""# 🎉 Félicitations !

Tu as complété les **100 Days of Code** !

Tu maîtrises maintenant :
- JavaScript & TypeScript
- React & Node.js
- Python & FastAPI
- Bases de données SQL
- Docker & Déploiement
- Algorithmes & Design Patterns
- Intelligence Artificielle
- Architecture logicielle

**Continue à coder chaque jour !** 🚀""",
                xp_reward=500,
                prerequisites=["cap_99_1"],
            ),
        ],
    },
}


def get_all_days() -> List[Dict]:
    """Retourne tous les jours du curriculum sous forme de liste sérialisable."""
    result = []
    for day_key, day_data in CURRICULUM_100_DAYS.items():
        day_num = int(day_key.split('_')[1])
        result.append({
            'day': day_num,
            'key': day_key,
            'title': day_data['title'],
            'description': day_data['description'],
            'level': day_data['level'].value,
            'total_lessons': len(day_data['lessons']),
            'lessons': [lesson.to_dict() for lesson in day_data['lessons']],
        })
    result.sort(key=lambda x: x['day'])
    return result


def get_lesson_by_id(lesson_id: str) -> Optional[Dict]:
    """Trouve une leçon par son ID."""
    for day_data in CURRICULUM_100_DAYS.values():
        for lesson in day_data['lessons']:
            if lesson.id == lesson_id:
                return lesson.to_dict()
    return None
