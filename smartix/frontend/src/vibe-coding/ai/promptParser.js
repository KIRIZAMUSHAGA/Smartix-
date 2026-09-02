/**
 * Analyseur de prompts pour le module Vibe-Coding
 * Version améliorée avec:
 * - Word boundaries pour éviter faux positifs
 * - Scores normalisés
 * - Support multi-types
 * - Optimisé pour grande échelle
 */

// =============================
// CONFIGURATION
// =============================

// Mapping des mots-clés vers les types d'applications (avec word boundaries)
const TYPE_KEYWORDS = {
  // Productivité
  todo: ['\\btodo\\b', '\\btâches\\b', '\\btasks\\b', '\\bliste\\b', '\\blist\\b', '\\bchecklist\\b'],
  notes: ['\\bnote\\b', '\\bnotes\\b', '\\bprise de notes\\b', '\\bmemo\\b', '\\bmémos\\b'],
  habit: ['\\bhabitude\\b', '\\bhabit\\b', '\\btracker\\b', '\\bsuivi\\b', '\\broutine\\b'],
  planner: ['\\bplanning\\b', '\\bplanner\\b', '\\bagenda\\b', '\\bcalendrier\\b', '\\bschedule\\b'],
  timer: ['\\btimer\\b', '\\bchrono\\b', '\\bcompte à rebours\\b', '\\bcountdown\\b', '\\bpomodoro\\b'],

  // Social
  social: ['\\bsocial\\b', '\\bréseau\\b', '\\bnetwork\\b', '\\bfeed\\b', '\\bmur\\b', '\\bwall\\b'],
  forum: ['\\bforum\\b', '\\bdiscussion\\b', '\\bcommunauté\\b', '\\bcommunity\\b', '\\bthread\\b'],
  profile: ['\\bprofil\\b', '\\bprofile\\b', '\\bbio\\b', '\\bcarte\\b', '\\bcard\\b'],

  // Lifestyle
  recipe: ['\\brecette\\b', '\\brecipe\\b', '\\bcuisine\\b', '\\bcooking\\b', '\\brepas\\b', '\\bmeal\\b'],
  workout: ['\\bsport\\b', '\\bworkout\\b', '\\bentraînement\\b', '\\btraining\\b', '\\bfitness\\b'],
  meditation: ['\\bméditation\\b', '\\bmeditation\\b', '\\bmindfulness\\b', '\\bcalme\\b', '\\brelax\\b'],
  travel: ['\\bvoyage\\b', '\\btravel\\b', '\\bitinéraire\\b', '\\bitineraire\\b', '\\bitinérary\\b'],

  // Finance
  expense: ['\\bdépense\\b', '\\bexpense\\b', '\\bbudget\\b', '\\bcomptes\\b', '\\baccounts\\b'],
  finance: ['\\bfinance\\b', '\\bargent\\b', 'bmoney\\b', '\\bépargne\\b', '\\bsaving\\b'],
  investment: ['\\binvestissement\\b', '\\binvestment\\b', '\\bbourse\\b', '\\bstock\\b'],

  // Education
  flashcard: ['\\bflashcard\\b', '\\bcarte\\b', '\\brévision\\b', '\\bstudy\\b', '\\bapprendre\\b'],
  quiz: ['\\bquiz\\b', '\\bquestionnaire\\b', '\\btest\\b', '\\bexamen\\b', '\\bexam\\b'],
  course: ['\\bcours\\b', '\\bcourse\\b', '\\bformation\\b', '\\blearning\\b'],

  // Utilitaires
  calculator: ['\\bcalculatrice\\b', '\\bcalculator\\b', '\\bcalcul\\b', '\\bmath\\b'],
  converter: ['\\bconvertisseur\\b', '\\bconverter\\b', '\\bconversion\\b', '\\bunités\\b'],
  password: ['\\bmot de passe\\b', '\\bpassword\\b', '\\bmdp\\b', '\\bsécurisé\\b'],
  qr: ['\\bqr\\b', '\\bcode\\b', '\\bscanner\\b', '\\breader\\b'],

  // Jeux
  tictactoe: ['\\bmorpion\\b', '\\btictactoe\\b', '\\btic tac toe\\b'],
  memory: ['\\bmemory\\b', '\\bmémoire\\b', '\\bpaires\\b', '\\bpairs\\b'],
  clicker: ['\\bclicker\\b', '\\bcliqueur\\b', '\\bidle\\b', '\\bincremental\\b']
};

// Mapping des mots-clés vers les catégories
const CATEGORY_KEYWORDS = {
  productivity: ['\\bproductivité\\b', '\\bproductivity\\b', '\\btravail\\b', '\\bwork\\b', '\\borganisation\\b'],
  social: ['\\bsocial\\b', '\\bréseau\\b', '\\bnetwork\\b', '\\bpartage\\b', '\\bshare\\b'],
  lifestyle: ['\\blifestyle\\b', '\\bmode de vie\\b', '\\bquotidien\\b', '\\bdaily\\b', '\\bbien-être\\b'],
  finance: ['\\bfinance\\b', '\\bargent\\b', 'bmoney\\b', '\\bbudget\\b', '\\bcompte\\b'],
  education: ['\\béducation\\b', '\\beducation\\b', '\\bapprendre\\b', '\\blearn\\b', '\\bétudes\\b'],
  utilities: ['\\butilitaire\\b', '\\butilities\\b', '\\boutil\\b', '\\btool\\b'],
  games: ['\\bjeu\\b', '\\bgame\\b', '\\bouer\\b', '\\bplay\\b']
};

// Mots-clés de fonctionnalités
const FEATURE_KEYWORDS = {
  auth: ['\\bconnexion\\b', '\\blogin\\b', '\\binscription\\b', '\\bregister\\b', '\\bauthentification\\b'],
  database: ['\\bbase de données\\b', '\\bdatabase\\b', '\\bstockage\\b', '\\bstorage\\b', '\\bsauvegarde\\b'],
  api: ['\\bapi\\b', '\\bbackend\\b', '\\bserveur\\b', '\\bserver\\b', '\\brest\\b'],
  offline: ['\\bhors ligne\\b', '\\boffline\\b', '\\bsans internet\\b', '\\blocal\\b'],
  darkmode: ['\\bmode sombre\\b', '\\bdark mode\\b', '\\bthème sombre\\b'],
  responsive: ['\\bresponsive\\b', '\\bmobile\\b', '\\badaptatif\\b', '\\bmobile friendly\\b'],
  notifications: ['\\bnotification\\b', '\\balerte\\b', '\\bnotif\\b', '\\bpush\\b'],
  sharing: ['\\bpartage\\b', '\\bshare\\b', '\\bexport\\b', '\\bimporter\\b'],
  search: ['\\brecherche\\b', '\\bsearch\\b', '\\bfiltre\\b', '\\bfilter\\b'],
  sorting: ['\\btri\\b', '\\bsort\\b', '\\bclassement\\b', 'border\\b']
};

// Niveaux de complexité
const COMPLEXITY_KEYWORDS = {
  simple: ['\\bsimple\\b', '\\bbasique\\b', '\\bbasic\\b', '\\bpetit\\b', '\\bsmall\\b'],
  medium: ['\\bmoyen\\b', '\\bmedium\\b', '\\bintermédiaire\\b', '\\baverage\\b'],
  complex: ['\\bcomplexe\\b', '\\bcomplex\\b', '\\bavancé\\b', '\\badvanced\\b', '\\bgrand\\b', '\\blarge\\b']
};

// Styles d'interface
const STYLE_KEYWORDS = {
  modern: ['\\bmoderne\\b', '\\bmodern\\b', '\\bcontemporain\\b', '\\bsleek\\b'],
  minimal: ['\\bminimal\\b', '\\bminimaliste\\b', '\\bclean\\b', '\\bépuré\\b'],
  colorful: ['\\bcoloré\\b', '\\bcolorful\\b', '\\bvibrant\\b', '\\bbright\\b'],
  dark: ['\\bsombre\\b', '\\bdark\\b', '\\bnoir\\b', '\\bblack\\b'],
  glassmorphism: ['\\bverre\\b', '\\bglass\\b', '\\btransparent\\b', '\\bflou\\b', '\\bblur\\b'],
  neumorphism: ['\\bneumorphisme\\b', '\\bsoft\\b', '\\bdoux\\b']
};

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Nettoie et normalise un prompt
 */
const cleanPrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') return '';
  
  return prompt
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Enlève les accents
    .trim();
};

/**
 * Extrait les mots-clés avec word boundaries
 */
const extractKeywords = (prompt) => {
  return prompt.split(/\s+/).filter(word => word.length > 2);
};

/**
 * Compte les occurrences de mots-clés avec regex
 */
const countKeywordMatches = (prompt, keywordsList) => {
  let count = 0;
  keywordsList.forEach(pattern => {
    const regex = new RegExp(pattern, 'g');
    const matches = prompt.match(regex);
    if (matches) {
      count += matches.length;
    }
  });
  return count;
};

// =============================
// DÉTECTIONS AMÉLIORÉES
// =============================

/**
 * Détecte les types d'application (supporte multi-types)
 */
const detectTypes = (prompt) => {
  const scores = {};
  let maxScore = 0;
  
  Object.entries(TYPE_KEYWORDS).forEach(([type, keywordsList]) => {
    const score = countKeywordMatches(prompt, keywordsList);
    if (score > 0) {
      scores[type] = score;
      if (score > maxScore) maxScore = score;
    }
  });
  
  // Normaliser les scores
  const normalized = {};
  Object.entries(scores).forEach(([type, score]) => {
    normalized[type] = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  });
  
  // Trier par score
  const sorted = Object.entries(normalized)
    .sort(([, a], [, b]) => b - a)
    .map(([type, score]) => ({ type, score }));
  
  return {
    primary: sorted[0] || { type: 'unknown', score: 0 },
    all: sorted,
    hasMultiple: sorted.length > 1
  };
};

/**
 * Détecte les fonctionnalités (multiples)
 */
const detectFeatures = (prompt) => {
  const features = [];
  
  Object.entries(FEATURE_KEYWORDS).forEach(([feature, keywordsList]) => {
    const count = countKeywordMatches(prompt, keywordsList);
    if (count > 0) {
      features.push({
        name: feature,
        confidence: Math.min(count / 3, 1)
      });
    }
  });
  
  return features.sort((a, b) => b.confidence - a.confidence);
};

/**
 * Détecte la complexité avec scores normalisés
 */
const detectComplexity = (prompt) => {
  const scores = {};
  let total = 0;
  
  Object.entries(COMPLEXITY_KEYWORDS).forEach(([level, keywordsList]) => {
    const score = countKeywordMatches(prompt, keywordsList);
    scores[level] = score;
    total += score;
  });
  
  // Normaliser
  const normalized = {};
  Object.entries(scores).forEach(([level, score]) => {
    normalized[level] = total > 0 ? score / total : 0;
  });
  
  // Trouver le meilleur niveau
  let bestLevel = 'medium';
  let bestScore = 0;
  
  Object.entries(normalized).forEach(([level, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestLevel = level;
    }
  });
  
  // Estimation du temps basée sur la complexité
  const baseTime = { simple: 5, medium: 15, complex: 30 };
  const estimatedMinutes = baseTime[bestLevel] || 15;
  
  return {
    level: bestLevel,
    confidence: bestScore,
    scores: normalized,
    estimatedMinutes
  };
};

/**
 * Détecte la catégorie principale
 */
const detectCategory = (prompt) => {
  const scores = {};
  let maxScore = 0;
  
  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywordsList]) => {
    const score = countKeywordMatches(prompt, keywordsList);
    if (score > 0) {
      scores[category] = score;
      if (score > maxScore) maxScore = score;
    }
  });
  
  let bestCategory = 'uncategorized';
  let bestScore = 0;
  
  Object.entries(scores).forEach(([category, score]) => {
    const normalized = maxScore > 0 ? score / maxScore : 0;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestCategory = category;
    }
  });
  
  return {
    category: bestCategory,
    confidence: bestScore,
    all: Object.entries(scores)
      .map(([cat, score]) => ({
        category: cat,
        confidence: maxScore > 0 ? score / maxScore : 0
      }))
      .filter(c => c.confidence > 0.2)
  };
};

/**
 * Détecte le style
 */
const detectStyle = (prompt) => {
  const scores = {};
  let maxScore = 0;
  
  Object.entries(STYLE_KEYWORDS).forEach(([style, keywordsList]) => {
    const score = countKeywordMatches(prompt, keywordsList);
    if (score > 0) {
      scores[style] = score;
      if (score > maxScore) maxScore = score;
    }
  });
  
  const styles = Object.entries(scores)
    .map(([style, score]) => ({
      name: style,
      confidence: maxScore > 0 ? score / maxScore : 0
    }))
    .sort((a, b) => b.confidence - a.confidence);
  
  return {
    primary: styles[0]?.name || 'modern',
    all: styles,
    hasStyles: styles.length > 0
  };
};

// =============================
// API PRINCIPALE
// =============================

/**
 * Parse un prompt utilisateur (version améliorée)
 */
export const parsePrompt = (userPrompt) => {
  const cleaned = cleanPrompt(userPrompt);
  const keywords = extractKeywords(cleaned);
  
  // Analyses
  const types = detectTypes(cleaned);
  const category = detectCategory(cleaned);
  const features = detectFeatures(cleaned);
  const complexity = detectComplexity(cleaned);
  const style = detectStyle(cleaned);
  
  // Score de confiance global
  const globalConfidence = Math.min(
    types.primary.score * 0.4 +
    category.confidence * 0.3 +
    features.reduce((acc, f) => acc + f.confidence, 0) / (features.length || 1) * 0.2 +
    complexity.confidence * 0.1,
    1
  );
  
  return {
    original: userPrompt,
    cleaned,
    keywords,
    
    types,
    category,
    features,
    complexity,
    style,
    
    confidence: globalConfidence,
    timestamp: new Date().toISOString()
  };
};

/**
 * Suggère un template (supporte le multi-type)
 */
export const suggestTemplate = (analysis) => {
  const { types, features, complexity } = analysis;
  
  // Mapping type -> template
  const templateMap = {
    todo: 'productivity/todoApp',
    notes: 'productivity/notesApp',
    habit: 'productivity/habitTracker',
    planner: 'productivity/dailyPlanner',
    timer: 'productivity/focusTimer',
    
    social: 'social/miniSocialFeed',
    forum: 'social/communityForum',
    profile: 'social/profileApp',
    
    recipe: 'lifestyle/recipeApp',
    workout: 'lifestyle/workoutTracker',
    meditation: 'lifestyle/meditationApp',
    travel: 'lifestyle/travelJournal',
    
    expense: 'finance/expenseTracker',
    finance: 'finance/budgetManager',
    investment: 'finance/savingsTracker',
    
    flashcard: 'education/flashcardsApp',
    quiz: 'education/quizApp',
    course: 'education/courseTracker',
    
    calculator: 'utilities/calculatorApp',
    converter: 'utilities/unitConverter',
    password: 'utilities/passwordManager',
    qr: 'utilities/qrScanner',
    
    tictactoe: 'games/ticTacToe',
    memory: 'games/memoryGame',
    clicker: 'games/clickerGame'
  };
  
  // Prendre le type principal
  const primaryType = types.primary?.type;
  const templateId = templateMap[primaryType] || 'productivity/todoApp';
  
  // Suggestions alternatives
  const alternatives = types.all
    .slice(1, 4)
    .filter(t => t.score > 0.3)
    .map(t => ({
      type: t.type,
      templateId: templateMap[t.type] || templateId,
      confidence: t.score
    }));
  
  return {
    primary: {
      templateId,
      type: primaryType,
      confidence: types.primary.score
    },
    alternatives,
    features: features.map(f => f.name),
    complexity: complexity.level,
    estimatedMinutes: complexity.estimatedMinutes
  };
};

/**
 * Extrait le nom du projet
 */
export const extractProjectName = (prompt) => {
  // Prendre les mots significatifs
  const words = prompt
    .split(' ')
    .filter(w => w.length > 3)
    .slice(0, 5);
  
  if (words.length === 0) return 'Nouveau projet';
  
  // Capitaliser
  const name = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name;
};

// =============================
// EXPORT
// =============================
export default {
  parsePrompt,
  suggestTemplate,
  extractProjectName,
  detectTypes,
  detectCategory,
  detectFeatures,
  detectComplexity,
  detectStyle
};
