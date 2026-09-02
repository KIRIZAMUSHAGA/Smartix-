/**
 * lessonData - Données des leçons guidées Vibe-Coding
 * Chaque leçon contient des étapes numérotées avec instructions et vérifications
 */

export const LESSONS = [
  {
    id: 'js-basics',
    title: 'Les bases de JavaScript',
    description: 'Apprends les fondamentaux : variables, fonctions et console.',
    difficulty: 'Débutant',
    duration: '10 min',
    steps: [
      {
        id: 1,
        title: 'Créer une variable',
        instruction: 'Déclare une variable `nom` et assigne-lui ton prénom entre guillemets.',
        hint: 'Utilise `const nom = "TonPrénom";`',
        validate: (code) => /const\s+nom\s*=\s*["'][^"']+["']/.test(code),
        targetLine: 1,
        example: 'const nom = "Alice";',
      },
      {
        id: 2,
        title: 'Afficher dans la console',
        instruction: 'Utilise `console.log()` pour afficher "Bonjour " suivi de ta variable `nom`.',
        hint: 'Essaie : `console.log("Bonjour " + nom);`',
        validate: (code) => /console\.log\s*\(\s*["']Bonjour\s*["']\s*\+\s*nom\s*\)/.test(code) ||
                           /console\.log\s*\(\s*`Bonjour\s*\$\{nom\}`\s*\)/.test(code),
        targetLine: 2,
        example: 'console.log("Bonjour " + nom);',
      },
      {
        id: 3,
        title: 'Créer une fonction',
        instruction: 'Crée une fonction `saluer` qui accepte un paramètre `personne` et retourne "Bonjour " + personne.',
        hint: 'Utilise `function saluer(personne) { return "Bonjour " + personne; }`',
        validate: (code) => /function\s+saluer\s*\(\s*\w+\s*\)/.test(code) && /return/.test(code),
        targetLine: 4,
        example: 'function saluer(personne) {\n  return "Bonjour " + personne;\n}',
      },
      {
        id: 4,
        title: 'Appeler la fonction',
        instruction: 'Appelle `saluer()` avec ton prénom et affiche le résultat avec `console.log()`.',
        hint: 'Essaie : `console.log(saluer("Alice"));`',
        validate: (code) => /console\.log\s*\(\s*saluer\s*\(/.test(code),
        targetLine: 8,
        example: 'console.log(saluer("Alice"));',
      },
    ],
  },

  {
    id: 'react-intro',
    title: 'Introduction à React',
    description: 'Crée ton premier composant React et découvre les props.',
    difficulty: 'Intermédiaire',
    duration: '15 min',
    steps: [
      {
        id: 1,
        title: 'Importer React',
        instruction: 'Importe React depuis le module "react".',
        hint: '`import React from "react";`',
        validate: (code) => /import\s+React\s+from\s+['"]react['"]/.test(code),
        targetLine: 1,
        example: 'import React from "react";',
      },
      {
        id: 2,
        title: 'Créer un composant fonctionnel',
        instruction: 'Crée un composant `Bonjour` qui retourne un élément `<h1>` avec "Bonjour monde !".',
        hint: 'Un composant est une fonction qui retourne du JSX.',
        validate: (code) => /function\s+Bonjour\s*\(/.test(code) && /return\s*\(?\s*<h1>/.test(code),
        targetLine: 3,
        example: 'function Bonjour() {\n  return <h1>Bonjour monde !</h1>;\n}',
      },
      {
        id: 3,
        title: 'Utiliser les props',
        instruction: 'Modifie le composant pour accepter une prop `nom` et afficher "Bonjour {nom} !".',
        hint: 'Les props sont passées comme paramètre : `function Bonjour({ nom })`',
        validate: (code) => /function\s+Bonjour\s*\(\s*\{/.test(code) && /\{nom\}/.test(code),
        targetLine: 3,
        example: 'function Bonjour({ nom }) {\n  return <h1>Bonjour {nom} !</h1>;\n}',
      },
      {
        id: 4,
        title: 'Exporter le composant',
        instruction: 'Exporte le composant `Bonjour` comme export par défaut.',
        hint: '`export default Bonjour;`',
        validate: (code) => /export\s+default\s+Bonjour/.test(code),
        targetLine: 7,
        example: 'export default Bonjour;',
      },
    ],
  },

  {
    id: 'css-flexbox',
    title: 'CSS Flexbox',
    description: 'Maîtrise la mise en page avec Flexbox en pratiquant.',
    difficulty: 'Débutant',
    duration: '12 min',
    steps: [
      {
        id: 1,
        title: 'Créer un conteneur flex',
        instruction: 'Dans ton CSS, crée une classe `.container` avec `display: flex`.',
        hint: '`.container { display: flex; }`',
        validate: (code) => /\.container\s*\{[^}]*display\s*:\s*flex/.test(code),
        targetLine: 1,
        example: '.container {\n  display: flex;\n}',
      },
      {
        id: 2,
        title: 'Centrer horizontalement',
        instruction: 'Ajoute `justify-content: center` dans ta classe `.container`.',
        hint: 'Cette propriété aligne les éléments sur l\'axe principal.',
        validate: (code) => /\.container\s*\{[^}]*justify-content\s*:\s*center/.test(code),
        targetLine: 2,
        example: '.container {\n  display: flex;\n  justify-content: center;\n}',
      },
      {
        id: 3,
        title: 'Centrer verticalement',
        instruction: 'Ajoute `align-items: center` et `height: 100vh` pour centrer verticalement.',
        hint: 'Ces propriétés centrent les éléments sur l\'axe secondaire.',
        validate: (code) => /align-items\s*:\s*center/.test(code) && /height\s*:\s*100vh/.test(code),
        targetLine: 3,
        example: '  align-items: center;\n  height: 100vh;',
      },
      {
        id: 4,
        title: 'Disposer en colonne',
        instruction: 'Ajoute `flex-direction: column` pour que les éléments s\'empilent verticalement.',
        hint: 'Par défaut, flex est en ligne (row). Column change l\'orientation.',
        validate: (code) => /flex-direction\s*:\s*column/.test(code),
        targetLine: 4,
        example: '  flex-direction: column;',
      },
    ],
  },
];

export default LESSONS;
