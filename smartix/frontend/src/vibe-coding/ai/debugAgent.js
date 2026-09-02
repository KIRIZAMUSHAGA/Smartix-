/**
 * debugAgent - Agent IA pour l'analyse et la correction d'erreurs (version ULTRA PRO)
 * 
 * Rôle: Analyser les erreurs et générer des corrections
 * - Support des patches au lieu de fichiers complets
 * - Multi-analysis (3 propositions)
 * - LRU cache pour éviter les fuites mémoire
 * - Static analysis avant IA
 * - Self-learning
 * - Risk-based execution
 */

import { appGenerator } from './appGenerator';
import { linter } from '../services/linter';
import { parser } from '../services/parser';

// =============================
// LRU CACHE IMPLEMENTATION
// =============================
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    // Mettre à jour l'ordre d'accès
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    
    return this.cache.get(key);
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Supprimer le plus ancien
      const oldest = this.accessOrder.shift();
      this.cache.delete(oldest);
    }
    
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }
}

// =============================
// MAIN AGENT CLASS
// =============================
export class DebugAgent {
  constructor() {
    this.initialized = false;
    this.analysisCache = new LRUCache(1000); // ✅ LRU cache avec limite
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.errorPatterns = new Map();
    this.knowledgeBase = []; // Dataset auto-apprentissage
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalAnalyses: 0,
      successfulFixes: 0,
      failedFixes: 0
    };
  }

  async initialize() {
    if (this.initialized) return;
    await this._loadErrorPatterns();
    this.initialized = true;
    console.log('✅ DebugAgent initialisé');
  }

  /**
   * Charge les patterns d'erreurs connus
   */
  async _loadErrorPatterns() {
    // Patterns avec prompts spécialisés
    this.errorPatterns.set('syntax', {
      prompt: `Corrige cette erreur de syntaxe en proposant un patch minimal.
               Identifie précisément la ligne et la colonne de l'erreur.
               Propose UNIQUEMENT la modification nécessaire, pas tout le fichier.`,
      confidence: 0.8,
      staticAnalysis: true
    });
    
    this.errorPatterns.set('runtime', {
      prompt: `Corrige cette erreur d'exécution.
               Analyse la stack trace pour comprendre le contexte.
               Propose un patch ciblé qui résout le problème.`,
      confidence: 0.7,
      staticAnalysis: true
    });
    
    this.errorPatterns.set('network', {
      prompt: `Corrige cette erreur réseau.
               Vérifie les URLs, les timeouts et les headers.
               Propose une solution robuste avec gestion d'erreur.`,
      confidence: 0.6,
      staticAnalysis: false
    });
    
    this.errorPatterns.set('logic', {
      prompt: `Corrige ce bug logique.
               Analyse le flux d'exécution et les conditions.
               Propose une correction qui préserve le comportement attendu.`,
      confidence: 0.5,
      staticAnalysis: true
    });
    
    this.errorPatterns.set('performance', {
      prompt: `Optimise cette partie du code.
               Identifie le goulot d'étranglement.
               Propose une version plus performante.`,
      confidence: 0.4,
      staticAnalysis: true
    });
    
    // ✅ Pattern unknown ajouté
    this.errorPatterns.set('unknown', {
      prompt: `Analyse cette erreur et propose une correction.
               Identifie d'abord le type d'erreur, puis propose une solution.`,
      confidence: 0.3,
      staticAnalysis: false
    });
  }

  /**
   * Analyse une erreur et génère une correction
   */
  async analyzeError(error, context = {}) {
    this.stats.totalAnalyses++;
    
    try {
      // 1. Essayer la static analysis d'abord
      const staticFix = await this._tryStaticAnalysis(error, context);
      if (staticFix) {
        return staticFix;
      }

      // 2. Déterminer le type d'erreur
      const errorType = this._classifyError(error);
      const pattern = this.errorPatterns.get(errorType) || this.errorPatterns.get('unknown');
      
      // 3. Générer signature avec hash de stack
      const signature = this._generateRobustSignature(error, context);
      
      // 4. Vérifier le cache
      const cached = this._getFromCache(signature);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;

      // 5. Préparer le contexte enrichi
      const enrichedContext = await this._enrichContext(context);

      // 6. Multi-analysis (3 propositions)
      const analyses = await Promise.all([
        this._runSingleAnalysis(error, enrichedContext, pattern, 0.3),
        this._runSingleAnalysis(error, enrichedContext, pattern, 0.5),
        this._runSingleAnalysis(error, enrichedContext, pattern, 0.7)
      ]);

      // 7. Choisir la meilleure analyse
      const bestAnalysis = this._selectBestAnalysis(analyses);
      
      // 8. Mettre en cache
      this._setCache(signature, bestAnalysis);

      // 9. Apprentissage si réussi
      if (bestAnalysis.confidence > 0.8) {
        this._addToKnowledgeBase(error, bestAnalysis);
      }

      return bestAnalysis;

    } catch (error) {
      console.error('❌ Erreur analyse IA:', error);
      return this._getFallbackAnalysis(error, context);
    }
  }

  /**
   * Tente une correction via static analysis (ESLint, TypeScript)
   */
  async _tryStaticAnalysis(error, context) {
    const { file, code, line } = context;
    
    // Utiliser le linter pour les erreurs simples
    const lintResult = await linter.check(code, file);
    
    if (lintResult.fixable) {
      return {
        file,
        patch: lintResult.patch,
        description: lintResult.message,
        confidence: 0.9,
        risk: 'low',
        source: 'static-analysis'
      };
    }

    return null;
  }

  /**
   * Exécute une analyse simple
   */
  async _runSingleAnalysis(error, context, pattern, temperature) {
    const prompt = this._buildPrompt(error, context, pattern, temperature);
    
    try {
      const response = await appGenerator.generateText({
        prompt,
        temperature,
        maxTokens: 1000,
        system: `Tu es un expert en débogage JavaScript/TypeScript.
                Analyse l'erreur et propose une correction précise.
                Réponds UNIQUEMENT avec un objet JSON valide.`
      });

      return this._parseResponse(response, error, context);

    } catch (error) {
      return {
        confidence: 0,
        error: 'Échec analyse'
      };
    }
  }

  /**
   * Enrichit le contexte avec les imports et types
   */
  async _enrichContext(context) {
    const { file, code, project } = context;
    
    // Analyser le code pour extraire les imports
    const imports = parser.extractImports(code);
    
    // Trouver les fonctions voisines
    const nearbyFunctions = parser.getNearbyFunctions(code, context.line);
    
    // Récupérer les types (si TypeScript)
    const types = parser.extractTypes(code);

    return {
      ...context,
      imports,
      nearbyFunctions,
      types,
      projectContext: {
        framework: project?.type || 'unknown',
        dependencies: project?.dependencies || {}
      }
    };
  }

  /**
   * Sélectionne la meilleure analyse parmi plusieurs
   */
  _selectBestAnalysis(analyses) {
    return analyses
      .filter(a => a.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)[0] || analyses[0];
  }

  /**
   * Ajoute à la base de connaissances
   */
  _addToKnowledgeBase(error, fix) {
    this.knowledgeBase.push({
      error: error.message,
      type: this._classifyError(error),
      fix,
      timestamp: Date.now(),
      success: true
    });

    // Limiter la taille
    if (this.knowledgeBase.length > 1000) {
      this.knowledgeBase = this.knowledgeBase.slice(-1000);
    }
  }

  /**
   * Construit le prompt adapté
   */
  _buildPrompt(error, context, pattern, temperature) {
    const { message, stack } = error;
    const { file, code, line, column, imports, nearbyFunctions, types } = context;

    return `
${pattern.prompt}

ERREUR:
${message}

STACK TRACE:
${stack || 'Non disponible'}

CONTEXTE:
Fichier: ${file || 'inconnu'}
Ligne: ${line || '?'}, Colonne: ${column || '?'}

IMPORTS DU FICHIER:
${imports?.join('\n') || 'Aucun'}

FONCTIONS VOISINES:
${nearbyFunctions || 'Non disponible'}

TYPES (si TypeScript):
${types || 'Non disponible'}

CODE CONCERNÉ:
\`\`\`javascript
${code || 'Non disponible'}
\`\`\`

TÂCHE:
1. Identifie la cause exacte
2. Propose un PATCH minimal (pas tout le fichier)
3. Explique pourquoi ça marche
4. Évalue le risque (low/medium/high)

FORMAT DE RÉPONSE OBLIGATOIRE:
{
  "file": "chemin/du/fichier.js",
  "patch": {
    "startLine": 42,
    "endLine": 45,
    "replacement": "code corrigé"
  },
  "description": "explication courte",
  "confidence": 0.95,
  "risk": "low",
  "tests": ["test1", "test2"]
}
`;
  }

  /**
   * Parse la réponse avec gestion robuste du JSON
   */
  _parseResponse(response, originalError, context) {
    try {
      // Nettoyer la réponse pour extraire le JSON
      const cleaned = response
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      // Trouver le premier { et le dernier }
      const startIdx = cleaned.indexOf('{');
      const endIdx = cleaned.lastIndexOf('}') + 1;
      
      if (startIdx === -1 || endIdx <= startIdx) {
        throw new Error('Pas de JSON valide trouvé');
      }

      const jsonStr = cleaned.substring(startIdx, endIdx);
      const parsed = JSON.parse(jsonStr);
      
      // Valider les champs requis
      if (!parsed.file || !parsed.patch || !parsed.description) {
        throw new Error('Champs requis manquants');
      }

      // Calculer la confiance finale
      const errorType = this._classifyError(originalError);
      const pattern = this.errorPatterns.get(errorType) || this.errorPatterns.get('unknown');
      
      parsed.confidence = Math.min(
        parsed.confidence || 0.5,
        pattern?.confidence || 0.5
      );

      return parsed;

    } catch (e) {
      console.warn('⚠️ Erreur parsing JSON:', e.message);
      
      // Fallback: extraction manuelle
      return this._manualExtract(response, originalError, context);
    }
  }

  /**
   * Extraction manuelle en cas d'échec JSON
   */
  _manualExtract(response, originalError, context) {
    // Chercher des patterns de patch
    const patchMatch = response.match(/startLine["\s:]+(\d+).*?endLine["\s:]+(\d+)/is);
    
    if (patchMatch) {
      return {
        file: context.file || 'unknown',
        patch: {
          startLine: parseInt(patchMatch[1]),
          endLine: parseInt(patchMatch[2]),
          replacement: '// Patch manuel à appliquer'
        },
        description: response.substring(0, 200),
        confidence: 0.3,
        risk: 'high'
      };
    }

    return this._getFallbackAnalysis(originalError, context);
  }

  /**
   * Génère une signature robuste avec hash de stack
   */
  _generateRobustSignature(error, context) {
    const message = error.message || String(error);
    const file = context?.file || 'unknown';
    const line = context?.lineno || context?.line || 0;
    
    // Hash de la stack pour éviter les collisions
    const stack = error.stack || '';
    const stackHash = this._hashString(stack.split('\n').slice(0, 3).join(''));
    
    return `${message}|${file}|${line}|${stackHash}`;
  }

  /**
   * Hash simple d'une string
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  /**
   * Classifie l'erreur
   */
  _classifyError(error) {
    const message = error.message || '';
    
    if (message.includes('Unexpected token')) return 'syntax';
    if (message.includes('undefined is not a function')) return 'runtime';
    if (message.includes('Failed to fetch') || message.includes('network')) return 'network';
    if (message.includes('Cannot read property')) return 'logic';
    if (message.includes('performance')) return 'performance';
    
    // Recherche dans la knowledge base
    for (const entry of this.knowledgeBase) {
      if (message.includes(entry.error.substring(0, 50))) {
        return entry.type;
      }
    }
    
    return 'unknown';
  }

  /**
   * Récupère du cache
   */
  _getFromCache(key) {
    const cached = this.analysisCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.analysisCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Stocke dans le cache
   */
  _setCache(key, data) {
    this.analysisCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Analyse de fallback
   */
  _getFallbackAnalysis(error, context) {
    const message = error.message || '';
    const file = context.file || 'unknown';
    
    // Chercher dans la knowledge base
    for (const entry of this.knowledgeBase) {
      if (message.includes(entry.error.substring(0, 50))) {
        return entry.fix;
      }
    }

    return {
      file,
      patch: {
        startLine: context.line || 1,
        endLine: context.line || 1,
        replacement: '// TODO: Corriger manuellement'
      },
      description: 'Aucune correction automatique disponible',
      confidence: 0,
      risk: 'high'
    };
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.analysisCache.clear();
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const hitRate = this.stats.totalAnalyses > 0
      ? (this.stats.cacheHits / this.stats.totalAnalyses * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      cacheHitRate: `${hitRate}%`,
      cacheSize: this.analysisCache.size(),
      knowledgeBaseSize: this.knowledgeBase.length,
      patterns: this.errorPatterns.size
    };
  }

  /**
   * Exporte la knowledge base
   */
  exportKnowledgeBase() {
    return {
      errors: this.knowledgeBase,
      patterns: Array.from(this.errorPatterns.entries()),
      stats: this.getStats(),
      exportedAt: Date.now()
    };
  }
}

export const debugAgent = new DebugAgent();
export default debugAgent;
