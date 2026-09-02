/**
 * parser - Analyseur de code source (version PRO)
 * 
 * Rôle: Extraire des informations du code source
 * - Imports/dépendances
 * - Fonctions et méthodes
 * - Classes et interfaces
 * - Types TypeScript
 * - Structure AST
 * - Métriques de code
 * - Support complet JSX/TS
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import crypto from 'crypto';

// =============================
// CONFIGURATION
// =============================

const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CACHE_SIZE = 500;

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

  size() {
    return this.cache.size;
  }
}

// =============================
// PARSER CLASS
// =============================

export class Parser {
  constructor() {
    this.cache = new LRUCache();
    this.stats = {
      totalParsed: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Analyse complète d'un fichier
   */
  async parseFile(content, filePath, options = {}) {
    // Vérifier la taille
    if (content.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${filePath} (${content.length} > ${MAX_FILE_SIZE})`);
    }

    const cacheKey = this._generateCacheKey(content, filePath);
    
    // Vérifier le cache
    if (!options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }
    this.stats.cacheMisses++;
    this.stats.totalParsed++;

    try {
      // Parser l'AST avec Babel (support TS/JSX complet)
      const ast = this._parseToAST(content, filePath);

      // Analyser l'AST en une seule passe
      const analysis = this._analyzeAST(ast, content, filePath);

      const result = {
        file: filePath,
        extension: this._getExtension(filePath),
        size: content.length,
        lines: content.split('\n').length,
        ...analysis,
        ast: options.includeAST ? ast : undefined
      };

      // Mettre en cache
      this.cache.set(cacheKey, result);

      return result;

    } catch (error) {
      console.warn(`⚠️ Erreur parsing ${filePath}:`, error.message);
      
      // Fallback: analyse ligne par ligne
      return this._fallbackParse(content, filePath);
    }
  }

  /**
   * Parse avec Babel (support complet TS/JSX)
   */
  _parseToAST(content, filePath) {
    const plugins = [
      'typescript',
      'jsx',
      'classProperties',
      'decorators-legacy',
      'dynamicImport',
      'exportNamespaceFrom',
      'exportDefaultFrom'
    ];

    // Ajouter des plugins spécifiques selon l'extension
    const ext = this._getExtension(filePath);
    if (ext === '.tsx') {
      plugins.push('typescript', 'jsx');
    } else if (ext === '.ts') {
      plugins.push('typescript');
    } else if (ext === '.jsx') {
      plugins.push('jsx');
    }

    try {
      return parse(content, {
        sourceType: 'module',
        plugins,
        tokens: true,
        ranges: true,
        locations: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        errorRecovery: true
      });
    } catch (error) {
      // Fallback pour les fichiers invalides
      return {
        type: 'File',
        program: {
          type: 'Program',
          body: [],
          directives: []
        },
        errors: [error.message]
      };
    }
  }

  /**
   * Analyse AST en une seule passe
   */
  _analyzeAST(ast, content, filePath) {
    const analysis = {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      types: [],
      jsx: [],
      variables: [],
      dependencies: new Set(),
      metrics: {
        complexity: 1,
        functions: 0,
        classes: 0,
        imports: 0,
        exports: 0,
        jsxElements: 0,
        lines: content.split('\n').length
      }
    };

    // Traverser l'AST une seule fois
    traverse(ast, {
      // Imports
      ImportDeclaration: (path) => {
        const source = path.node.source.value;
        analysis.imports.push({
          source,
          specifiers: path.node.specifiers.length,
          line: path.node.loc?.start.line
        });
        analysis.metrics.imports++;
        
        // Extraire les dépendances
        if (!source.startsWith('.') && !source.startsWith('/')) {
          const packageName = source.split('/')[0];
          analysis.dependencies.add(packageName);
        }
      },

      // Exports
      ExportNamedDeclaration: (path) => {
        analysis.exports.push({
          type: 'named',
          source: path.node.source?.value,
          specifiers: path.node.specifiers?.length || 0,
          line: path.node.loc?.start.line
        });
        analysis.metrics.exports++;
      },
      ExportDefaultDeclaration: (path) => {
        analysis.exports.push({
          type: 'default',
          line: path.node.loc?.start.line
        });
        analysis.metrics.exports++;
      },

      // Fonctions
      FunctionDeclaration: (path) => {
        const node = path.node;
        analysis.functions.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => this._getParamName(p)),
          async: node.async || false,
          generator: node.generator || false,
          line: node.loc?.start.line
        });
        analysis.metrics.functions++;
        analysis.metrics.complexity += this._countComplexity(node.body);
      },
      ArrowFunctionExpression: (path) => {
        const node = path.node;
        analysis.functions.push({
          type: 'arrow',
          params: node.params.map(p => this._getParamName(p)),
          async: node.async || false,
          expression: node.expression,
          line: node.loc?.start.line
        });
        analysis.metrics.functions++;
        analysis.metrics.complexity += this._countComplexity(node.body);
      },
      FunctionExpression: (path) => {
        const node = path.node;
        analysis.functions.push({
          type: 'function-expression',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => this._getParamName(p)),
          async: node.async || false,
          generator: node.generator || false,
          line: node.loc?.start.line
        });
        analysis.metrics.functions++;
        analysis.metrics.complexity += this._countComplexity(node.body);
      },

      // Méthodes de classe
      ClassMethod: (path) => {
        const node = path.node;
        analysis.functions.push({
          type: 'method',
          name: this._getNodeName(node.key),
          kind: node.kind,
          static: node.static || false,
          params: node.params.map(p => this._getParamName(p)),
          line: node.loc?.start.line
        });
        analysis.metrics.functions++;
        analysis.metrics.complexity += this._countComplexity(node.body);
      },

      // Classes
      ClassDeclaration: (path) => {
        const node = path.node;
        analysis.classes.push({
          type: 'class',
          name: node.id?.name,
          extends: node.superClass?.name,
          methods: node.body.body
            .filter(m => t.isClassMethod(m))
            .map(m => ({
              name: this._getNodeName(m.key),
              kind: m.kind
            })),
          line: node.loc?.start.line
        });
        analysis.metrics.classes++;
      },

      // Types TypeScript
      TSTypeAliasDeclaration: (path) => {
        const node = path.node;
        analysis.types.push({
          kind: 'type',
          name: node.id.name,
          line: node.loc?.start.line
        });
      },
      TSInterfaceDeclaration: (path) => {
        const node = path.node;
        analysis.types.push({
          kind: 'interface',
          name: node.id.name,
          extends: node.extends?.map(e => e.expression.name),
          line: node.loc?.start.line
        });
      },
      TSEnumDeclaration: (path) => {
        const node = path.node;
        analysis.types.push({
          kind: 'enum',
          name: node.id.name,
          members: node.members.map(m => m.id?.name || '?'),
          line: node.loc?.start.line
        });
      },
      TSModuleDeclaration: (path) => {
        const node = path.node;
        analysis.types.push({
          kind: 'namespace',
          name: node.id.name,
          line: node.loc?.start.line
        });
      },

      // Variables (avec gestion de la destructuration)
      VariableDeclaration: (path) => {
        const node = path.node;
        node.declarations.forEach(decl => {
          const names = this._extractVariableNames(decl.id);
          names.forEach(name => {
            analysis.variables.push({
              kind: node.kind,
              name,
              initializer: decl.init?.type,
              line: node.loc?.start.line
            });
          });
        });
      },

      // JSX
      JSXOpeningElement: (path) => {
        const node = path.node;
        analysis.jsx.push({
          type: 'jsx-element',
          name: this._getJSXName(node.name),
          attributes: node.attributes.length,
          selfClosing: node.selfClosing,
          line: node.loc?.start.line
        });
        analysis.metrics.jsxElements++;
      },
      JSXFragment: (path) => {
        analysis.jsx.push({
          type: 'jsx-fragment',
          line: path.node.loc?.start.line
        });
        analysis.metrics.jsxElements++;
      }
    });

    return {
      ...analysis,
      dependencies: Array.from(analysis.dependencies)
    };
  }

  /**
   * Extrait les noms de variables (gère la destructuration)
   */
  _extractVariableNames(pattern) {
    const names = [];

    const extract = (node) => {
      if (t.isIdentifier(node)) {
        names.push(node.name);
      } else if (t.isObjectPattern(node)) {
        node.properties.forEach(prop => {
          if (t.isObjectProperty(prop)) {
            extract(prop.value);
          } else if (t.isRestElement(prop)) {
            extract(prop.argument);
          }
        });
      } else if (t.isArrayPattern(node)) {
        node.elements.forEach(el => {
          if (el) extract(el);
        });
      } else if (t.isAssignmentPattern(node)) {
        extract(node.left);
      } else if (t.isRestElement(node)) {
        extract(node.argument);
      }
    };

    extract(pattern);
    return names;
  }

  /**
   * Compte la complexité d'un bloc
   */
  _countComplexity(node) {
    let complexity = 0;

    if (!node) return 0;

    if (t.isIfStatement(node)) complexity++;
    if (t.isForStatement(node)) complexity++;
    if (t.isForInStatement(node)) complexity++;
    if (t.isForOfStatement(node)) complexity++;
    if (t.isWhileStatement(node)) complexity++;
    if (t.isDoWhileStatement(node)) complexity++;
    if (t.isSwitchCase(node)) complexity++;
    if (t.isConditionalExpression(node)) complexity++;
    if (t.isLogicalExpression(node)) {
      if (node.operator === '&&' || node.operator === '||') complexity++;
    }
    if (t.isCatchClause(node)) complexity++;

    // Parcourir les enfants
    if (node.body) {
      if (Array.isArray(node.body)) {
        node.body.forEach(child => complexity += this._countComplexity(child));
      } else {
        complexity += this._countComplexity(node.body);
      }
    }

    return complexity;
  }

  /**
   * Obtient le nom d'un nœud (gère les expressions)
   */
  _getNodeName(node) {
    if (t.isIdentifier(node)) return node.name;
    if (t.isStringLiteral(node)) return node.value;
    if (t.isNumericLiteral(node)) return node.value.toString();
    if (t.isMemberExpression(node)) {
      return `${this._getNodeName(node.object)}.${this._getNodeName(node.property)}`;
    }
    return '?';
  }

  /**
   * Obtient le nom d'un élément JSX
   */
  _getJSXName(node) {
    if (t.isJSXIdentifier(node)) return node.name;
    if (t.isJSXMemberExpression(node)) {
      return `${this._getJSXName(node.object)}.${this._getJSXName(node.property)}`;
    }
    if (t.isJSXNamespacedName(node)) {
      return `${node.namespace.name}:${node.name.name}`;
    }
    return 'unknown';
  }

  /**
   * Récupère le nom d'un paramètre
   */
  _getParamName(param) {
    if (t.isIdentifier(param)) return param.name;
    if (t.isAssignmentPattern(param)) return this._getParamName(param.left);
    if (t.isObjectPattern(param)) return '{...}';
    if (t.isArrayPattern(param)) return '[...]';
    if (t.isRestElement(param)) return `...${this._getParamName(param.argument)}`;
    return '?';
  }

  /**
   * Trouve les fonctions voisines d'une ligne
   */
  getNearbyFunctions(content, lineNumber, radius = 5) {
    const functions = this.extractFunctions(content);
    
    return functions
      .filter(f => Math.abs(f.line - lineNumber) <= radius)
      .map(f => ({
        name: f.name,
        type: f.type,
        params: f.params,
        distance: Math.abs(f.line - lineNumber)
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Extrait les fonctions (utile pour l'analyse rapide)
   */
  extractFunctions(content) {
    const result = this.parseFile(content, 'temp.js');
    return result?.functions || [];
  }

  /**
   * Extrait les imports (utile pour l'analyse rapide)
   */
  extractImports(content) {
    const result = this.parseFile(content, 'temp.js');
    return result?.imports || [];
  }

  /**
   * Calcule la complexité (utilise l'AST déjà parsé)
   */
  calculateComplexity(ast) {
    if (typeof ast === 'string') {
      ast = this._parseToAST(ast, 'temp.js');
    }
    return this._countComplexity(ast.program);
  }

  /**
   * Génère un hash fiable (sha1)
   */
  _generateCacheKey(content, filePath) {
    const hash = crypto.createHash('sha1')
      .update(content)
      .update(filePath)
      .digest('hex');
    return `${filePath}_${hash}`;
  }

  /**
   * Obtient l'extension d'un fichier
   */
  _getExtension(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return SUPPORTED_EXTENSIONS.includes(ext) ? ext : '.js';
  }

  /**
   * Fallback parsing sans AST
   */
  _fallbackParse(content, filePath) {
    const lines = content.split('\n');
    
    const imports = [];
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content))) {
      imports.push({
        source: match[1],
        line: this._getLineNumber(content, match.index)
      });
    }

    const functions = [];
    const functionRegex = /function\s+(\w+)\s*\(/g;
    while ((match = functionRegex.exec(content))) {
      functions.push({
        name: match[1],
        line: this._getLineNumber(content, match.index)
      });
    }

    return {
      file: filePath,
      extension: this._getExtension(filePath),
      size: content.length,
      lines: lines.length,
      imports,
      functions,
      classes: [],
      types: [],
      jsx: [],
      variables: [],
      metrics: {
        complexity: 1,
        functions: functions.length,
        classes: 0,
        imports: imports.length,
        exports: 0,
        jsxElements: 0,
        lines: lines.length
      },
      fallback: true
    };
  }

  /**
   * Obtient le numéro de ligne depuis un index
   */
  _getLineNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  /**
   * Vérifie si un fichier doit être parsé
   */
  _shouldParse(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return SUPPORTED_EXTENSIONS.includes(ext);
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
    const hitRate = this.stats.totalParsed > 0
      ? (this.stats.cacheHits / this.stats.totalParsed * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      cacheHitRate: `${hitRate}%`,
      cacheSize: this.cache.size()
    };
  }
}

export const parser = new Parser();
export default parser;
