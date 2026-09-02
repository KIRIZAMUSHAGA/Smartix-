/**
 * SuggestionEngine
 * Génère des suggestions pour corriger les erreurs courantes
 */

export class SuggestionEngine {
  constructor() {
    this.suggestionDatabase = this._buildDatabase();
    this.customSuggestions = new Map();
  }

  /**
   * Construit la base de données de suggestions
   * @private
   * @returns {Object} Base de données
   */
  _buildDatabase() {
    return {
      // Erreurs JavaScript courantes
      'undefined is not a function': {
        title: 'Fonction non définie',
        description: 'Vous essayez d\'appeler une fonction qui n\'existe pas.',
        solution: 'Vérifiez que la variable est bien une fonction avant de l\'appeler.',
        example: 'if (typeof maFonction === "function") { maFonction(); }',
        references: ['https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Erreurs/Not_a_function']
      },
      
      'cannot read property': {
        title: 'Propriété inexistante',
        description: 'Vous essayez d\'accéder à une propriété d\'un objet non défini.',
        solution: 'Utilisez l\'optional chaining ou vérifiez que l\'objet existe.',
        example: 'const value = objet?.propriete ?? "valeur par défaut";',
        references: ['https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Opérateurs/Optional_chaining']
      },
      
      'is not defined': {
        title: 'Variable non définie',
        description: 'Vous utilisez une variable qui n\'a pas été déclarée.',
        solution: 'Déclarez la variable avec let, const ou var avant de l\'utiliser.',
        example: 'let maVariable = valeur; // ou const, var',
        references: ['https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Types_et_grammaire#Déclarations']
      },
      
      'unexpected token': {
        title: 'Erreur de syntaxe',
        description: 'Il y a une erreur de syntaxe dans votre code.',
        solution: 'Vérifiez les parenthèses, crochets, virgules et points-virgules.',
        example: '// Vérifiez que toutes les parenthèses sont fermées\nif (condition) {\n  console.log("ok");\n}',
        references: ['https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Erreurs/Unexpected_token']
      },

      // Erreurs React
      'invalid hook call': {
        title: 'Règle des Hooks violée',
        description: 'Les hooks ne peuvent être appelés qu\'au niveau racine d\'un composant React.',
        solution: 'Assurez-vous d\'appeler les hooks dans le corps d\'un composant fonction, pas dans des conditions ou des boucles.',
        example: 'function MonComposant() {\n  const [state, setState] = useState(); // ✅ OK\n  if (condition) {\n    useEffect(); // ❌ Non\n  }\n}',
        references: ['https://fr.reactjs.org/docs/hooks-rules.html']
      },

      'cannot update a component': {
        title: 'Mise à jour pendant le rendu',
        description: 'Vous essayez de mettre à jour un état pendant le rendu.',
        solution: 'Déplacez la mise à jour dans un useEffect ou un gestionnaire d\'événement.',
        example: 'useEffect(() => {\n  setState(newValue); // ✅ OK\n}, [deps]);',
        references: ['https://fr.reactjs.org/docs/hooks-effect.html']
      },

      // Erreurs réseau
      'failed to fetch': {
        title: 'Erreur réseau',
        description: 'Impossible de contacter le serveur.',
        solution: 'Vérifiez votre connexion internet et que l\'URL est correcte.',
        example: 'try {\n  const response = await fetch(url);\n  if (!response.ok) {\n    throw new Error(`HTTP ${response.status}`);\n  }\n} catch (error) {\n  console.error("Erreur réseau:", error);\n}',
        references: ['https://developer.mozilla.org/fr/docs/Web/API/Fetch_API']
      },

      'timeout': {
        title: 'Délai d\'attente dépassé',
        description: 'Le serveur a mis trop de temps à répondre.',
        solution: 'Augmentez le timeout ou optimisez la requête.',
        example: 'const controller = new AbortController();\nconst timeout = setTimeout(() => controller.abort(), 5000);\n\nfetch(url, { signal: controller.signal });',
        references: ['https://developer.mozilla.org/fr/docs/Web/API/AbortController']
      },

      // Erreurs de dépendances
      'cannot find module': {
        title: 'Module introuvable',
        description: 'Le module n\'est pas installé ou le chemin est incorrect.',
        solution: 'Installez le module avec npm ou vérifiez le chemin d\'import.',
        example: 'npm install nom-du-module\n\n// Ou vérifiez le chemin\nimport module from "./chemin/correct/module";',
        references: ['https://docs.npmjs.com/cli/install']
      },

      'export not found': {
        title: 'Export introuvable',
        description: 'Le fichier n\'exporte pas ce que vous essayez d\'importer.',
        solution: 'Vérifiez les exports du fichier et le nom de l\'export.',
        example: '// fichier.js\nexport const maFonction = () => {};\nexport default MonComposant;\n\n// autre.js\nimport maFonction, { maFonction } from "./fichier"; // ❌ Doublon',
        references: ['https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Instructions/export']
      },

      // Erreurs de build
      'cannot find name': {
        title: 'Type introuvable (TypeScript)',
        description: 'Le type n\'est pas défini ou importé.',
        solution: 'Importez le type depuis le bon module.',
        example: 'import { MonType } from "./types";\n\nconst valeur: MonType = {};',
        references: ['https://www.typescriptlang.org/docs/handbook/modules.html']
      },

      'property does not exist': {
        title: 'Propriété inexistante (TypeScript)',
        description: 'La propriété n\'existe pas sur ce type.',
        solution: 'Ajoutez la propriété à l\'interface ou utilisez une assertion de type.',
        example: 'interface MonType {\n  propriete: string;\n}\n\nconst obj: MonType = { propriete: "valeur" };',
        references: ['https://www.typescriptlang.org/docs/handbook/interfaces.html']
      }
    };
  }

  /**
   * Obtient une suggestion pour une erreur
   * @param {Error|Object|string} error - Erreur à analyser
   * @returns {Object|null} Suggestion ou null
   */
  getSuggestion(error) {
    const message = this._extractMessage(error);
    
    if (!message) return null;

    // Chercher dans la base de données
    for (const [pattern, suggestion] of Object.entries(this.suggestionDatabase)) {
      if (this._matchPattern(message, pattern)) {
        return {
          ...suggestion,
          pattern,
          confidence: 'high'
        };
      }
    }

    // Chercher dans les suggestions personnalisées
    for (const [pattern, suggestion] of this.customSuggestions) {
      if (this._matchPattern(message, pattern)) {
        return {
          ...suggestion,
          pattern,
          confidence: 'custom'
        };
      }
    }

    // Suggestion générique
    return this._getGenericSuggestion(message);
  }

  /**
   * Extrait le message d'une erreur
   * @private
   * @param {Error|Object|string} error - Erreur
   * @returns {string} Message extrait
   */
  _extractMessage(error) {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error && error.message) return error.message;
    return '';
  }

  /**
   * Vérifie si un message correspond à un pattern
   * @private
   * @param {string} message - Message à tester
   * @param {string} pattern - Pattern
   * @returns {boolean} true si correspond
   */
  _matchPattern(message, pattern) {
    const lowerMessage = message.toLowerCase();
    const lowerPattern = pattern.toLowerCase();
    
    return lowerMessage.includes(lowerPattern);
  }

  /**
   * Suggestion générique pour les erreurs non reconnues
   * @private
   * @param {string} message - Message d'erreur
   * @returns {Object} Suggestion générique
   */
  _getGenericSuggestion(message) {
    return {
      title: 'Erreur non reconnue',
      description: 'Cette erreur n\'a pas été identifiée automatiquement.',
      solution: 'Analysez le message d\'erreur et vérifiez les points suivants :',
      steps: [
        'Regardez la ligne indiquée dans l\'erreur',
        'Vérifiez les valeurs des variables à ce moment-là',
        'Utilisez console.log() pour déboguer',
        'Consultez la documentation des fonctions utilisées'
      ],
      confidence: 'low',
      originalMessage: message
    };
  }

  /**
   * Ajoute une suggestion personnalisée
   * @param {string} pattern - Pattern à reconnaître
   * @param {Object} suggestion - Suggestion
   */
  addCustomSuggestion(pattern, suggestion) {
    this.customSuggestions.set(pattern, suggestion);
  }

  /**
   * Supprime une suggestion personnalisée
   * @param {string} pattern - Pattern à supprimer
   */
  removeCustomSuggestion(pattern) {
    this.customSuggestions.delete(pattern);
  }

  /**
   * Obtient une suggestion avec des étapes détaillées
   * @param {string} errorMessage - Message d'erreur
   * @param {Object} context - Contexte (fichier, ligne, etc.)
   * @returns {Object} Suggestion détaillée
   */
  getDetailedSuggestion(errorMessage, context = {}) {
    const baseSuggestion = this.getSuggestion(errorMessage);
    
    if (!baseSuggestion) return null;

    // Ajouter des étapes contextuelles
    const steps = [...(baseSuggestion.steps || [])];

    if (context.file) {
      steps.unshift(`Vérifiez le fichier: ${context.file}`);
    }

    if (context.line) {
      steps.unshift(`Regardez la ligne ${context.line}`);
    }

    if (context.component) {
      steps.unshift(`Dans le composant: ${context.component}`);
    }

    return {
      ...baseSuggestion,
      steps,
      context
    };
  }

  /**
   * Obtient des suggestions similaires
   * @param {string} errorMessage - Message d'erreur
   * @param {number} limit - Nombre de suggestions
   * @returns {Array} Suggestions similaires
   */
  getSimilarSuggestions(errorMessage, limit = 3) {
    const suggestions = [];
    const words = errorMessage.toLowerCase().split(/\s+/);

    for (const [pattern, suggestion] of Object.entries(this.suggestionDatabase)) {
      const patternWords = pattern.toLowerCase().split(/\s+/);
      const commonWords = words.filter(w => patternWords.includes(w));
      
      if (commonWords.length > 0) {
        suggestions.push({
          ...suggestion,
          pattern,
          relevance: commonWords.length / patternWords.length
        });
      }
    }

    return suggestions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Exporte la base de données de suggestions
   * @returns {Object} Base de données
   */
  exportDatabase() {
    return {
      builtin: this.suggestionDatabase,
      custom: Object.fromEntries(this.customSuggestions)
    };
  }

  /**
   * Importe des suggestions
   * @param {Object} data - Données à importer
   */
  importDatabase(data) {
    if (data.builtin) {
      this.suggestionDatabase = { ...this.suggestionDatabase, ...data.builtin };
    }
    
    if (data.custom) {
      Object.entries(data.custom).forEach(([pattern, suggestion]) => {
        this.customSuggestions.set(pattern, suggestion);
      });
    }
  }
}

export default SuggestionEngine;
