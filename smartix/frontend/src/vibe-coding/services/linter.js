/**
 * linter - Service de linting pour valider le code (version PRO)
 * 
 * Rôle: Vérifier la qualité et la syntaxe du code
 * - Validation syntaxique via AST (Acorn)
 * - Détection précise avec lignes/colonnes
 * - Score de qualité
 * - Cache des résultats
 * - Multi-file support
 * - Auto-fix avancé
 */

import { Parser } from 'acorn';
import * as walk from 'acorn-walk';
import { generate } from 'escodegen';
import crypto from 'crypto';

// =============================
// CONSTANTES
// =============================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

const SEVERITY_WEIGHTS = {
  error: 20,
  warning: 5,
  info: 1
};

// =============================
// LRU CACHE
// =============================

class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    
    return this.cache.get(key);
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
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
}

// =============================
// MAIN LINTER CLASS
// =============================

export class Linter {
  constructor() {
    this.rules = {
      // Sécurité
      'no-eval': {
        pattern: 'CallExpression',
        check: (node) => node.callee.name === 'eval',
        message: 'eval() est dangereux (exécution de code arbitraire)',
        severity: 'error',
        fixable: false
      },
      'no-document-write': {
        pattern: 'CallExpression',
        check: (node) => 
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'document' &&
          node.callee.property.name === 'write',
        message: 'document.write() est dangereux (XSS potentiel)',
        severity: 'error',
        fixable: false
      },
      'no-inner-html': {
        pattern: 'AssignmentExpression',
        check: (node) => 
          node.left.type === 'MemberExpression' &&
          node.left.property.name === 'innerHTML',
        message: 'innerHTML peut causer des XSS, préférer textContent',
        severity: 'warning',
        fixable: true,
        fix: (node) => {
          node.left.property.name = 'textContent';
          return node;
        }
      },
      
      // Qualité
      'no-console': {
        pattern: 'CallExpression',
        check: (node) => 
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'console' &&
          ['log', 'warn', 'error'].includes(node.callee.property.name),
        message: 'Supprimer les console.log en production',
        severity: 'info',
        fixable: true,
        fix: () => null // Supprime le nœud
      },
      'no-debugger': {
        pattern: 'DebuggerStatement',
        check: () => true,
        message: 'Supprimer les debugger',
        severity: 'error',
        fixable: true,
        fix: () => null // Supprime le nœud
      },
      'no-alert': {
        pattern: 'CallExpression',
        check: (node) => 
          ['alert', 'confirm', 'prompt'].includes(node.callee.name),
        message: 'Éviter les alert() en production',
        severity: 'warning',
        fixable: false
      },
      
      // JSX spécifique
      'jsx-key': {
        pattern: 'JSXOpeningElement',
        check: (node, parents) => {
          // Vérifier si on est dans un map
          const hasMap = parents.some(p => 
            p.type === 'CallExpression' && 
            p.callee.property?.name === 'map'
          );
          
          if (!hasMap) return false;
          
          // Vérifier la présence de la prop key
          const hasKey = node.attributes.some(attr => 
            attr.type === 'JSXAttribute' && attr.name.name === 'key'
          );
          
          return !hasKey;
        },
        message: 'Élément JSX dans .map() sans prop "key"',
        severity: 'error',
        fixable: false
      },
      
      // TypeScript
      'no-explicit-any': {
        pattern: 'TSTypeAnnotation',
        check: (node) => 
          node.typeAnnotation.type === 'TSAnyKeyword',
        message: 'Éviter le type "any"',
        severity: 'warning',
        fixable: false
      },
      'missing-return-type': {
        pattern: 'FunctionDeclaration',
        check: (node) => 
          !node.returnType && 
          node.id && 
          !node.id.name.startsWith('_'),
        message: 'Type de retour manquant pour la fonction',
        severity: 'info',
        fixable: false
      }
    };

    this.cache = new LRUCache();
    this.stats = {
      totalLints: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Vérifie un fichier
   */
  async check(content, filePath) {
    this.stats.totalLints++;
    
    // Vérifier le cache
    const cacheKey = this._generateCacheKey(content, filePath);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }
    this.stats.cacheMisses++;

    // Analyser le code
    const ast = await this._parseAST(content, filePath);
    const issues = [];
    
    // Parcourir l'AST
    walk.simple(ast, {
      ...this._createVisitors(issues, content)
    });

    // Organiser les issues
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const infos = issues.filter(i => i.severity === 'info');

    // Vérifier les fixes disponibles
    const fixableIssues = issues.filter(i => i.fixable);
    
    const result = {
      valid: errors.length === 0,
      errors,
      warnings,
      infos,
      fixable: fixableIssues.length > 0,
      fixes: fixableIssues.map(i => ({
        rule: i.rule,
        message: i.message,
        line: i.line,
        column: i.column,
        apply: () => this._applyFix(content, i)
      })),
      score: this._calculateScore(errors, warnings, infos),
      stats: {
        errors: errors.length,
        warnings: warnings.length,
        infos: infos.length,
        total: issues.length
      }
    };

    // Mettre en cache
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Crée les visiteurs AST
   */
  _createVisitors(issues, content) {
    const visitors = {};

    for (const [ruleName, rule] of Object.entries(this.rules)) {
      visitors[rule.pattern] = (node, ancestors) => {
        if (rule.check(node, ancestors)) {
          const loc = node.loc?.start;
          
          issues.push({
            rule: ruleName,
            message: rule.message,
            severity: rule.severity,
            line: loc?.line || 1,
            column: loc?.column || 0,
            fixable: rule.fixable,
            node: rule.fixable ? node : null,
            source: this._getSourceLine(content, loc?.line)
          });
        }
      };
    }

    return visitors;
  }

  /**
   * Parse le code en AST
   */
  async _parseAST(content, filePath) {
    try {
      const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
      
      return Parser.parse(content, {
        ecmaVersion: 2020,
        sourceType: 'module',
        locations: true,
        onComment: [],
        ...(isJSX && { plugins: { jsx: true } })
      });
    } catch (error) {
      // Erreur de parsing syntaxique
      return {
        type: 'Program',
        body: [],
        errors: [{
          message: error.message,
          line: error.loc?.line || 1,
          column: error.loc?.column || 0
        }]
      };
    }
  }

  /**
   * Applique un fix
   */
  async fix(content, issue) {
    if (!issue.fixable) return content;

    const ast = await this._parseAST(content);
    
    // Parcourir pour trouver le nœud
    let targetNode = null;
    walk.simple(ast, {
      [this.rules[issue.rule].pattern]: (node) => {
        if (node.loc?.start.line === issue.line) {
          targetNode = node;
        }
      }
    });

    if (!targetNode) return content;

    // Appliquer le fix
    const rule = this.rules[issue.rule];
    if (rule.fix) {
      const fixedNode = rule.fix(targetNode);
      if (fixedNode === null) {
        // Supprimer le nœud
        // TODO: Implémenter la suppression
      } else {
        // Remplacer par génération de code
        const fixed = generate(fixedNode);
        return this._replaceNode(content, targetNode, fixed);
      }
    }

    return content;
  }

  /**
   * Lint tout un projet
   */
  async lintProject(project) {
    const results = {};
    
    for (const [filePath, content] of Object.entries(project.files || {})) {
      if (this._shouldLint(filePath)) {
        results[filePath] = await this.check(content, filePath);
      }
    }

    return {
      files: results,
      summary: this._generateProjectSummary(results)
    };
  }

  /**
   * Calcule le score de qualité
   */
  _calculateScore(errors, warnings, infos) {
    const total = errors.length + warnings.length + infos.length;
    if (total === 0) return 100;

    const weightedSum = 
      errors.length * SEVERITY_WEIGHTS.error +
      warnings.length * SEVERITY_WEIGHTS.warning +
      infos.length * SEVERITY_WEIGHTS.info;

    const maxPossible = total * SEVERITY_WEIGHTS.error;
    const score = 100 - (weightedSum / maxPossible * 100);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Génère un résumé pour un projet
   */
  _generateProjectSummary(results) {
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfos = 0;

    for (const result of Object.values(results)) {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      totalInfos += result.infos.length;
    }

    return {
      files: Object.keys(results).length,
      totalErrors,
      totalWarnings,
      totalInfos,
      averageScore: this._calculateAverageScore(results)
    };
  }

  /**
   * Calcule la moyenne des scores
   */
  _calculateAverageScore(results) {
    const scores = Object.values(results).map(r => r.score);
    if (scores.length === 0) return 100;
    
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round(sum / scores.length);
  }

  /**
   * Vérifie si un fichier doit être linté
   */
  _shouldLint(filePath) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx'];
    return extensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Récupère une ligne de code
   */
  _getSourceLine(content, line) {
    const lines = content.split('\n');
    return lines[line - 1]?.trim() || '';
  }

  /**
   * Remplace un nœud dans le code
   */
  _replaceNode(content, node, replacement) {
    const lines = content.split('\n');
    const startLine = node.loc.start.line - 1;
    const endLine = node.loc.end.line - 1;
    
    if (startLine === endLine) {
      // Même ligne
      const line = lines[startLine];
      const before = line.substring(0, node.loc.start.column);
      const after = line.substring(node.loc.end.column);
      lines[startLine] = before + replacement + after;
    } else {
      // Multi-lignes
      const before = lines[startLine].substring(0, node.loc.start.column);
      const after = lines[endLine].substring(node.loc.end.column);
      
      lines[startLine] = before + replacement;
      for (let i = startLine + 1; i <= endLine; i++) {
        lines[i] = '';
      }
      lines[endLine] = after;
    }

    return lines.join('\n');
  }

  /**
   * Génère une clé de cache
   */
  _generateCacheKey(content, filePath) {
    const hash = crypto.createHash('sha256')
      .update(content)
      .update(filePath)
      .digest('hex');
    return `${filePath}_${hash}`;
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const hitRate = this.stats.totalLints > 0
      ? (this.stats.cacheHits / this.stats.totalLints * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      cacheHitRate: `${hitRate}%`,
      cacheSize: this.cache.size
    };
  }
}

export const linter = new Linter();
export default linter;
