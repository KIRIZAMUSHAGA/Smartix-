/**
 * Index des templates pour le module Vibe-Coding
 * 
 * Rôle: Gérer les templates de projets disponibles
 * - Catégorisation des templates
 * - Recherche et filtrage
 * - Chargement des fichiers de template
 * - Statistiques et recommandations
 */

import { useState, useCallback } from 'react';

// =============================
// CONSTANTES
// =============================

const TEMPLATE_SCHEMA_VERSION = 1;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures
const MAX_CACHE_SIZE = 100;

// Cache mémoire des fichiers de templates (clé = templateId, valeur = { files, timestamp })
const templateCache = new Map();

// =============================
// CATÉGORIES
// =============================

export const TEMPLATE_CATEGORIES = {
  PRODUCTIVITY: {
    id: 'productivity',
    name: 'Productivité',
    icon: '✅',
    color: '#28a745',
    description: 'Applications pour organiser votre travail'
  },
  SOCIAL: {
    id: 'social',
    name: 'Social',
    icon: '👥',
    color: '#007bff',
    description: 'Réseaux sociaux et communautés'
  },
  LIFESTYLE: {
    id: 'lifestyle',
    name: 'Lifestyle',
    icon: '🌟',
    color: '#ffc107',
    description: 'Bien-être et vie quotidienne'
  },
  FINANCE: {
    id: 'finance',
    name: 'Finance',
    icon: '💰',
    color: '#28a745',
    description: 'Gestion financière et budget'
  },
  EDUCATION: {
    id: 'education',
    name: 'Éducation',
    icon: '📚',
    color: '#17a2b8',
    description: 'Apprentissage et formation'
  },
  UTILITIES: {
    id: 'utilities',
    name: 'Utilitaires',
    icon: '🔧',
    color: '#6c757d',
    description: 'Outils pratiques'
  },
  GAMES: {
    id: 'games',
    name: 'Jeux',
    icon: '🎮',
    color: '#dc3545',
    description: 'Petits jeux amusants'
  }
};

// =============================
// TEMPLATES (DONNÉES COMPLÈTES)
// =============================

// Fonction utilitaire pour créer un template avec valeurs par défaut
const createTemplate = (overrides) => ({
  templateSchema: TEMPLATE_SCHEMA_VERSION,
  framework: 'react',
  difficultyColor: 'green',
  estimatedTime: 5,
  popularity: 50,
  createdAt: new Date().toISOString().split('T')[0],
  updatedAt: new Date().toISOString().split('T')[0],
  author: 'VibeCoding',
  version: '1.0.0',
  tags: [],
  ...overrides
});

// Templates de productivité
const productivityTemplates = [
  createTemplate({
    id: 'todo-app',
    name: 'Todo App',
    description: 'Application de tâches simple avec stockage local',
    category: 'productivity',
    type: 'todo',
    complexity: 'simple',
    icon: '✅',
    preview: '📋',
    features: ['add-task', 'delete-task', 'mark-complete', 'filter-tasks'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 95,
    tags: ['todo', 'tasks', 'productivity', 'local-storage']
  }),
  
  createTemplate({
    id: 'notes-app',
    name: 'Notes App',
    description: 'Prenez des notes facilement avec catégories',
    category: 'productivity',
    type: 'notes',
    complexity: 'simple',
    icon: '📝',
    preview: '📒',
    features: ['create-note', 'edit-note', 'delete-note', 'search', 'categories'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 88,
    tags: ['notes', 'writing', 'productivity', 'categories']
  }),
  
  createTemplate({
    id: 'kanban-board',
    name: 'Kanban Board',
    description: 'Tableau Kanban pour gérer vos projets',
    category: 'productivity',
    type: 'kanban',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 10,
    icon: '📊',
    preview: '📊',
    features: ['create-column', 'create-card', 'drag-drop', 'assign-members'],
    dependencies: { 
      react: '^18.2.0', 
      'react-dom': '^18.2.0',
      'react-beautiful-dnd': '^13.1.0'
    },
    popularity: 82,
    tags: ['kanban', 'project-management', 'drag-drop']
  })
];

// Templates sociaux
const socialTemplates = [
  createTemplate({
    id: 'chat-app',
    name: 'Chat App',
    description: 'Application de chat en temps réel',
    category: 'social',
    type: 'chat',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 15,
    icon: '💬',
    preview: '💬',
    features: ['send-message', 'user-list', 'typing-indicator', 'message-history'],
    dependencies: { 
      react: '^18.2.0', 
      'react-dom': '^18.2.0',
      'socket.io-client': '^4.5.0'
    },
    popularity: 90,
    tags: ['chat', 'realtime', 'messaging', 'socket']
  }),
  
  createTemplate({
    id: 'social-feed',
    name: 'Social Feed',
    description: 'Flux social avec posts et commentaires',
    category: 'social',
    type: 'feed',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 12,
    icon: '📱',
    preview: '📱',
    features: ['create-post', 'like-post', 'comment', 'share'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 85,
    tags: ['social', 'feed', 'posts', 'comments']
  })
];

// Templates lifestyle
const lifestyleTemplates = [
  createTemplate({
    id: 'fitness-tracker',
    name: 'Fitness Tracker',
    description: 'Suivez vos activités physiques',
    category: 'lifestyle',
    type: 'fitness',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 12,
    icon: '💪',
    preview: '💪',
    features: ['log-activity', 'view-stats', 'set-goals', 'progress-charts'],
    dependencies: { 
      react: '^18.2.0', 
      'react-dom': '^18.2.0',
      'recharts': '^2.5.0'
    },
    popularity: 78,
    tags: ['fitness', 'health', 'tracker', 'charts']
  }),
  
  createTemplate({
    id: 'meal-planner',
    name: 'Meal Planner',
    description: 'Planifiez vos repas de la semaine',
    category: 'lifestyle',
    type: 'meal',
    complexity: 'simple',
    icon: '🍲',
    preview: '🍲',
    features: ['plan-meals', 'grocery-list', 'recipe-suggestions'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 72,
    tags: ['food', 'meal-planning', 'recipes']
  })
];

// Templates finance
const financeTemplates = [
  createTemplate({
    id: 'expense-tracker',
    name: 'Expense Tracker',
    description: 'Suivez vos dépenses quotidiennes',
    category: 'finance',
    type: 'expense',
    complexity: 'simple',
    icon: '💰',
    preview: '💰',
    features: ['add-expense', 'view-expenses', 'expense-charts', 'budget-alerts'],
    dependencies: { 
      react: '^18.2.0', 
      'react-dom': '^18.2.0',
      'recharts': '^2.5.0'
    },
    popularity: 92,
    tags: ['finance', 'expenses', 'budget', 'money']
  }),
  
  createTemplate({
    id: 'budget-planner',
    name: 'Budget Planner',
    description: 'Planifiez votre budget mensuel',
    category: 'finance',
    type: 'budget',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 10,
    icon: '📊',
    preview: '📊',
    features: ['set-budget', 'track-spending', 'savings-goals', 'reports'],
    dependencies: { 
      react: '^18.2.0', 
      'react-dom': '^18.2.0',
      'recharts': '^2.5.0'
    },
    popularity: 80,
    tags: ['budget', 'finance', 'savings', 'planning']
  })
];

// Templates éducation
const educationTemplates = [
  createTemplate({
    id: 'flashcards',
    name: 'Flashcards',
    description: 'Apprenez avec des cartes mémoire',
    category: 'education',
    type: 'flashcard',
    complexity: 'simple',
    icon: '🃏',
    preview: '🃏',
    features: ['create-decks', 'study-mode', 'progress-tracking', 'spaced-repetition'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 86,
    tags: ['education', 'flashcards', 'learning', 'study']
  }),
  
  createTemplate({
    id: 'quiz-app',
    name: 'Quiz App',
    description: 'Créez et passez des quiz',
    category: 'education',
    type: 'quiz',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 10,
    icon: '❓',
    preview: '❓',
    features: ['create-quiz', 'take-quiz', 'score-tracking', 'leaderboard'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 84,
    tags: ['quiz', 'education', 'games', 'learning']
  })
];

// Templates utilitaires
const utilitiesTemplates = [
  createTemplate({
    id: 'weather-app',
    name: 'Weather App',
    description: 'Consultez la météo de votre ville',
    category: 'utilities',
    type: 'weather',
    complexity: 'simple',
    icon: '☀️',
    preview: '☀️',
    features: ['current-weather', 'forecast', 'search-city', 'weather-icons'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 94,
    tags: ['weather', 'utilities', 'api', 'forecast']
  }),
  
  createTemplate({
    id: 'calculator',
    name: 'Calculator',
    description: 'Calculatrice simple et intuitive',
    category: 'utilities',
    type: 'calculator',
    complexity: 'simple',
    icon: '🧮',
    preview: '🧮',
    features: ['basic-operations', 'memory', 'history'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 88,
    tags: ['calculator', 'math', 'utilities']
  }),
  
  createTemplate({
    id: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Générez des QR codes à partir de texte',
    category: 'utilities',
    type: 'qr',
    complexity: 'simple',
    icon: '📱',
    preview: '📱',
    features: ['generate-qr', 'download-qr', 'scan-history'],
    dependencies: { 
      react: '^18.2.0', 
      'react-dom': '^18.2.0',
      'qrcode.react': '^3.1.0'
    },
    popularity: 82,
    tags: ['qr', 'utilities', 'generator', 'scan']
  })
];

// Templates jeux
const gamesTemplates = [
  createTemplate({
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    description: 'Jeu de morpion classique',
    category: 'games',
    type: 'game',
    complexity: 'simple',
    icon: '❌',
    preview: '❌⭕',
    features: ['2-player', 'ai-opponent', 'score-tracking', 'reset-game'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 96,
    tags: ['game', 'tic-tac-toe', 'morpion', 'ai']
  }),
  
  createTemplate({
    id: 'memory-game',
    name: 'Memory Game',
    description: 'Testez votre mémoire avec ce jeu de cartes',
    category: 'games',
    type: 'game',
    complexity: 'simple',
    icon: '🎴',
    preview: '🎴',
    features: ['flip-cards', 'match-pairs', 'timer', 'moves-counter'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 89,
    tags: ['game', 'memory', 'cards', 'kids']
  }),
  
  createTemplate({
    id: 'snake-game',
    name: 'Snake Game',
    description: 'Le serpent classique à rejouer',
    category: 'games',
    type: 'game',
    complexity: 'medium',
    difficultyColor: 'orange',
    estimatedTime: 12,
    icon: '🐍',
    preview: '🐍',
    features: ['keyboard-controls', 'score', 'high-score', 'speed-increase'],
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    popularity: 91,
    tags: ['game', 'snake', 'arcade', 'classic']
  })
];

// =============================
// TABLEAU GLOBAL
// =============================

const ALL_TEMPLATES = [
  ...productivityTemplates,
  ...socialTemplates,
  ...lifestyleTemplates,
  ...financeTemplates,
  ...educationTemplates,
  ...utilitiesTemplates,
  ...gamesTemplates
];

// =============================
// VALIDATION
// =============================

const validateTemplates = () => {
  const errors = [];
  const ids = new Set();

  ALL_TEMPLATES.forEach(template => {
    // Vérifier ID unique
    if (ids.has(template.id)) {
      errors.push(`ID dupliqué: ${template.id}`);
    }
    ids.add(template.id);

    // Vérifier champs requis
    const required = ['id', 'name', 'description', 'category', 'type', 'icon'];
    required.forEach(field => {
      if (!template[field]) {
        errors.push(`Template ${template.id}: champ ${field} manquant`);
      }
    });

    // Vérifier catégorie valide
    if (!TEMPLATE_CATEGORIES[template.category?.toUpperCase()]) {
      errors.push(`Template ${template.id}: catégorie invalide ${template.category}`);
    }
  });

  if (errors.length > 0) {
    console.warn('⚠️ Erreurs de validation des templates:', errors);
  }

  return errors.length === 0;
};

// Valider au chargement
validateTemplates();

// =============================
// INDEX AUTOMATIQUE
// =============================

export const TEMPLATES_INDEX = Object.fromEntries(
  ALL_TEMPLATES.map(t => [t.id, t])
);

// =============================
// FONCTIONS DE BASE
// =============================

export const getAllTemplates = () => ALL_TEMPLATES;

export const getTemplateById = (id) => TEMPLATES_INDEX[id] || null;

export const getTemplatesByCategory = (categoryId) => {
  const category = Object.values(TEMPLATE_CATEGORIES).find(c => c.id === categoryId);
  if (!category) return [];
  
  return ALL_TEMPLATES.filter(t => t.category === categoryId);
};

export const getTemplatesByType = (type) => 
  ALL_TEMPLATES.filter(t => t.type === type);

// =============================
// MOTEUR DE RECHERCHE AVANCÉ
// =============================

export const searchTemplates = (query, options = {}) => {
  if (!query) return [];

  const {
    limit = 10,
    category = null,
    minPopularity = 0,
    maxComplexity = 'hard',
    sortBy = 'relevance' // relevance, popularity, date, name
  } = options;

  const q = query.toLowerCase().trim();

  // Poids des différents champs pour le score de pertinence
  const weights = {
    name: 10,
    tags: 5,
    description: 3,
    features: 2
  };

  let results = ALL_TEMPLATES;

  // Filtre par catégorie
  if (category) {
    results = results.filter(t => t.category === category);
  }

  // Filtre par popularité
  if (minPopularity > 0) {
    results = results.filter(t => t.popularity >= minPopularity);
  }

  // Filtre par complexité
  const complexityOrder = { simple: 1, medium: 2, hard: 3 };
  if (maxComplexity) {
    const maxLevel = complexityOrder[maxComplexity] || 3;
    results = results.filter(t => complexityOrder[t.complexity] <= maxLevel);
  }

  // Calcul du score de pertinence
  results = results.map(template => {
    let score = 0;

    // Recherche dans le nom
    if (template.name.toLowerCase().includes(q)) {
      score += weights.name;
      if (template.name.toLowerCase() === q) score += 5; // Exact match bonus
    }

    // Recherche dans les tags
    const tagMatches = template.tags.filter(t => t.includes(q)).length;
    score += tagMatches * weights.tags;

    // Recherche dans la description
    if (template.description.toLowerCase().includes(q)) {
      score += weights.description;
    }

    // Recherche dans les features
    const featureMatches = template.features.filter(f => f.includes(q)).length;
    score += featureMatches * weights.features;

    return { ...template, searchScore: score };
  });

  // Filtrer les résultats sans score
  results = results.filter(t => t.searchScore > 0);

  // Tri selon l'option choisie
  switch (sortBy) {
    case 'popularity':
      results.sort((a, b) => b.popularity - a.popularity);
      break;
    case 'date':
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'name':
      results.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default: // relevance
      results.sort((a, b) => b.searchScore - a.searchScore);
  }

  return results.slice(0, limit);
};

// =============================
// TEMPLATES POPULAIRES
// =============================

export const getPopularTemplates = (limit = 6, category = null) => {
  let templates = ALL_TEMPLATES;

  if (category) {
    templates = templates.filter(t => t.category === category);
  }

  return [...templates]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
};

// =============================
// TEMPLATES RÉCENTS
// =============================

export const getRecentTemplates = (limit = 6, category = null) => {
  let templates = ALL_TEMPLATES;

  if (category) {
    templates = templates.filter(t => t.category === category);
  }

  return [...templates]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
};

// =============================
// RECOMMANDATIONS
// =============================

export const getRecommendedTemplates = (type, limit = 3) => {
  return getTemplatesByType(type).slice(0, limit);
};

export const getSimilarTemplates = (templateId, limit = 3) => {
  const template = getTemplateById(templateId);
  if (!template) return [];

  return ALL_TEMPLATES
    .filter(t => t.id !== templateId && t.category === template.category)
    .sort((a, b) => {
      // Calculer la similarité basée sur les tags communs
      const aCommon = a.tags.filter(tag => template.tags.includes(tag)).length;
      const bCommon = b.tags.filter(tag => template.tags.includes(tag)).length;
      return bCommon - aCommon;
    })
    .slice(0, limit);
};

// =============================
// STATISTIQUES
// =============================

export const countTemplatesByCategory = () => {
  const counts = {};
  
  ALL_TEMPLATES.forEach(t => {
    const category = t.category;
    counts[category] = (counts[category] || 0) + 1;
  });

  return counts;
};

export const getTemplatesStats = () => {
  const byCategory = countTemplatesByCategory();
  const total = ALL_TEMPLATES.length;
  const byComplexity = { simple: 0, medium: 0, hard: 0 };
  const byFramework = {};

  ALL_TEMPLATES.forEach(t => {
    byComplexity[t.complexity] = (byComplexity[t.complexity] || 0) + 1;
    byFramework[t.framework] = (byFramework[t.framework] || 0) + 1;
  });

  return {
    total,
    byCategory,
    byComplexity,
    byFramework,
    mostPopular: getPopularTemplates(1)[0],
    newest: getRecentTemplates(1)[0]
  };
};

// =============================
// CHARGEMENT DES FICHIERS
// =============================

export const loadTemplateFiles = async (templateId, options = {}) => {
  // Vérifier le cache
  if (templateCache.has(templateId)) {
    const cached = templateCache.get(templateId);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.files;
    }
    templateCache.delete(templateId);
  }

  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" non trouvé`);
  }

  // Gérer le cache (éviter les fuites mémoire)
  if (templateCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = templateCache.keys().next().value;
    templateCache.delete(oldestKey);
  }

  // Générer les fichiers selon le type de template
  const files = await generateTemplateFiles(template, options);

  // Mettre en cache
  templateCache.set(templateId, {
    files,
    timestamp: Date.now()
  });

  return files;
};

// =============================
// GÉNÉRATION DE FICHIERS
// =============================

const generateTemplateFiles = async (template, options) => {
  const { includeTests = false, includeDocs = true, customName = null } = options;
  const projectName = customName || template.id;

  // Package.json
  const packageJson = {
    name: projectName,
    version: template.version,
    description: template.description,
    private: true,
    dependencies: {
      ...template.dependencies,
      'react-scripts': '5.0.1'
    },
    scripts: {
      start: 'react-scripts start',
      build: 'react-scripts build',
      test: 'react-scripts test',
      eject: 'react-scripts eject'
    },
    eslintConfig: {
      extends: ['react-app']
    },
    browserslist: {
      production: ['>0.2%', 'not dead', 'not op_mini all'],
      development: ['last 1 chrome version', 'last 1 firefox version', 'last 1 safari version']
    }
  };

  // Fichiers de base
  const files = {
    'package.json': JSON.stringify(packageJson, null, 2),

    'public/index.html': `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name}</title>
  <meta name="description" content="${template.description}">
  <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
</head>
<body>
  <noscript>Vous devez activer JavaScript pour utiliser cette application.</noscript>
  <div id="root"></div>
</body>
</html>`,

    'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('[Template] Élément #root introuvable dans le DOM');
const root = ReactDOM.createRoot(rootEl);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

    'src/index.css': `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`,

    'src/App.js': generateAppJs(template),

    'src/App.css': generateAppCss(template),

    'README.md': generateReadme(template)
  };

  // Ajouter les tests si demandé
  if (includeTests) {
    files['src/App.test.js'] = `import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});`;
  }

  return files;
};

// =============================
// GÉNÉRATEURS DE CODE SPÉCIFIQUES
// =============================

const generateAppJs = (template) => {
  // Version simple par défaut
  if (template.type === 'todo') {
    return `import React, { useState } from 'react';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { text: input, completed: false }]);
      setInput('');
    }
  };

  const toggleTodo = (index) => {
    const newTodos = [...todos];
    newTodos[index].completed = !newTodos[index].completed;
    setTodos(newTodos);
  };

  const deleteTodo = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>${template.name}</h1>
        <p>${template.description}</p>
      </header>
      <main>
        <div className="todo-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ajouter une tâche..."
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button onClick={addTodo}>Ajouter</button>
        </div>
        <ul className="todo-list">
          {todos.map((todo, index) => (
            <li key={index} className={todo.completed ? 'completed' : ''}>
              <span onClick={() => toggleTodo(index)}>{todo.text}</span>
              <button onClick={() => deleteTodo(index)}>Supprimer</button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

App.propTypes = {};

export default App;`;
  }

  // Version générique
  return `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>${template.name}</h1>
        <p>${template.description}</p>
      </header>
      <main>
        <div className="features">
          <h2>Fonctionnalités</h2>
          <ul>
            ${template.features.map(f => `<li>${f}</li>`).join('\n            ')}
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;`;
};

const generateAppCss = (template) => {
  return `.App {
  text-align: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.App-header {
  background-color: rgba(0, 0, 0, 0.3);
  padding: 2rem;
  color: white;
  margin-bottom: 2rem;
}

.App-header h1 {
  margin: 0;
  font-size: 2.5em;
}

.App-header p {
  margin: 1rem 0 0;
  font-size: 1.2em;
  opacity: 0.9;
}

main {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.features ul {
  list-style: none;
  padding: 0;
}

.features li {
  padding: 0.5rem;
  margin: 0.5rem 0;
  background: #f0f0f0;
  border-radius: 5px;
}

.todo-input {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.todo-input input {
  flex: 1;
  padding: 0.8rem;
  font-size: 1rem;
  border: 2px solid #ddd;
  border-radius: 5px;
}

.todo-input button {
  padding: 0.8rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
}

.todo-input button:hover {
  background: #5a67d8;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin: 0.5rem 0;
  background: #f8f9fa;
  border-radius: 5px;
  border-left: 4px solid #667eea;
}

.todo-list li.completed span {
  text-decoration: line-through;
  opacity: 0.6;
}

.todo-list li span {
  flex: 1;
  cursor: pointer;
}

.todo-list li button {
  padding: 0.4rem 0.8rem;
  background: #e53e3e;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.todo-list li button:hover {
  background: #c53030;
}`;
};

const generateReadme = (template) => {
  return `# ${template.name}

${template.description}

## 🚀 Fonctionnalités

${template.features.map(f => `- ${f}`).join('\n')}

## 📦 Installation

\`\`\`bash
# Cloner le projet
git clone https://github.com/vibecoding/${template.id}.git

# Installer les dépendances
cd ${template.id}
npm install

# Lancer l'application
npm start
\`\`\`

## 🛠️ Technologies

- React ${template.dependencies.react}
- ${Object.keys(template.dependencies).filter(d => d !== 'react').join('\n- ')}

## 📝 Licence

MIT © VibeCoding

## 👨‍💻 Auteur

Créé par ${template.author}
  `;
};

// =============================
// HOOK PERSONNALISÉ
// =============================

export const useTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState(getTemplatesStats());

  const search = useCallback((query, options) => {
    setLoading(true);
    try {
      const results = searchTemplates(query, options);
      setSearchResults(results);
      return results;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplate = useCallback(async (templateId, options) => {
    setLoading(true);
    try {
      const files = await loadTemplateFiles(templateId, options);
      return files;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    templates,
    searchResults,
    stats,
    getAllTemplates,
    getTemplateById,
    getTemplatesByCategory,
    getTemplatesByType,
    getPopularTemplates,
    getRecentTemplates,
    getRecommendedTemplates,
    getSimilarTemplates,
    search,
    loadTemplate,
    TEMPLATE_CATEGORIES
  };
};

// =============================
// EXPORT
// =============================

export default {
  TEMPLATES_INDEX,
  TEMPLATE_CATEGORIES,
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  getTemplatesByType,
  searchTemplates,
  getPopularTemplates,
  getRecentTemplates,
  getRecommendedTemplates,
  getSimilarTemplates,
  countTemplatesByCategory,
  getTemplatesStats,
  loadTemplateFiles
};

export const templatesIndex = { getAllTemplates, getTemplateById, getTemplatesByCategory, getTemplatesByType, searchTemplates, getPopularTemplates, getRecentTemplates, getRecommendedTemplates, getSimilarTemplates, countTemplatesByCategory, getTemplatesStats, loadTemplateFiles };
