/**
 * securityAnalyzer - Analyse de sécurité du code (version PRO)
 * 
 * Rôle: Détecter les vulnérabilités potentielles
 * - Analyse AST pour plus de précision
 * - Détection des secrets par patterns
 * - Analyse contextuelle multi-fichiers
 * - Suggestions de correction
 * - Niveaux de risque
 */

import { Parser } from 'acorn';
import * as walk from 'acorn-walk';
import crypto from 'crypto';

// =============================
// CONSTANTES
//==============================

const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3
};

const RISK_THRESHOLDS = {
  low: 90,
  medium: 70,
  high: 40,
  critical: 0
};

// Patterns de secrets (API keys, tokens)
const SECRET_PATTERNS = [
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key', severity: 'critical' },
  // GitHub
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Token', severity: 'critical' },
  // Stripe
  { pattern: /sk_live_[0-9a-zA-Z]{24}/, name: 'Stripe Secret Key', severity: 'critical' },
  { pattern: /pk_live_[0-9a-zA-Z]{24}/, name: 'Stripe Public Key', severity: 'high' },
  // JWT
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, name: 'JWT Token', severity: 'high' },
  // Générique
  { pattern: /(sk|pk|api[_-]?key|secret|token)[\s]*[:=][\s]*['"`]([^'"]{8,})['"`]/i, name: 'Secret potentiel', severity: 'high' }
];

// =============================
// MAIN CLASS
// =============================

export class SecurityAnalyzer {
  constructor() {
    this.secretDetector = new SecretDetector();
    this.dependencyScanner = new DependencyScanner();
    this.crossFileAnalyzer = new CrossFileAnalyzer();
  }

  /**
   * Analyse un fichier
   */
  async analyze(content, filePath, context = {}) {
    const startTime = Date.now();
    
    // 1. Analyse AST
    const ast = await this._parseAST(content, filePath);
    const astIssues = this._analyzeAST(ast, filePath);

    // 2. Analyse ligne par ligne (pour les patterns simples)
    const lineIssues = this._analyzeLines(content, filePath);

    // 3. Détection des secrets
    const secretIssues = await this.secretDetector.analyze(content, filePath);

    // 4. Analyse contextuelle
    const contextualIssues = await this._contextualAnalysis(content, filePath, context);

    // Fusionner tous les issues
    const allIssues = [...astIssues, ...lineIssues, ...secretIssues, ...contextualIssues];

    // Organiser par sévérité
    const critical = allIssues.filter(i => i.severity === 'critical');
    const high = allIssues.filter(i => i.severity === 'high');
    const medium = allIssues.filter(i => i.severity === 'medium');
    const low = allIssues.filter(i => i.severity === 'low');

    // Calculer le score
    const score = this._calculateScore(critical, high, medium, low);
    
    // Déterminer le niveau de risque
    const riskLevel = this._getRiskLevel(score);

    // Générer des suggestions
    const suggestions = this._generateSuggestions(allIssues);

    return {
      summary: {
        score,
        riskLevel,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
        total: allIssues.length,
        duration: Date.now() - startTime
      },
      issues: allIssues.map(i => ({
        ...i,
        suggestion: this._getFixSuggestion(i)
      })),
      suggestions,
      file: filePath
    };
  }

  /**
   * Analyse tout un projet
   */
  async analyzeProject(project, options = {}) {
    const results = {};
    const dependencies = project.dependencies || {};

    // Analyser tous les fichiers
    for (const [filePath, content] of Object.entries(project.files || {})) {
      if (this._shouldAnalyze(filePath)) {
        results[filePath] = await this.analyze(content, filePath, { project });
      }
    }

    // Analyser les dépendances
    const depIssues = await this.dependencyScanner.scan(dependencies);

    // Analyse cross-files
    const crossIssues = await this.crossFileAnalyzer.analyze(results);

    return {
      files: results,
      dependencies: depIssues,
      crossFile: crossIssues,
      summary: this._generateProjectSummary(results, depIssues, crossIssues)
    };
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
        ...(isJSX && { plugins: { jsx: true } })
      });
    } catch {
      return { type: 'Program', body: [] };
    }
  }

  /**
   * Analyse via AST
   */
  _analyzeAST(ast, filePath) {
    const issues = [];

    walk.simple(ast, {
      // XSS - innerHTML
      AssignmentExpression: (node) => {
        if (node.left.type === 'MemberExpression' &&
            node.left.property.name === 'innerHTML') {
          
          // Vérifier si la valeur est safe
          const isSafe = this._isSafeAssignment(node.right);
          
          issues.push({
            type: 'xss',
            severity: isSafe ? 'medium' : 'high',
            message: isSafe 
              ? 'innerHTML avec valeur potentiellement safe, vérifier la source'
              : 'innerHTML direct peut causer des XSS',
            line: node.loc?.start.line || 1,
            column: node.loc?.start.column || 0,
            code: this._getCodeSnippet(node),
            fix: !isSafe ? {
              description: 'Remplacer par textContent',
              replacement: 'textContent'
            } : null
          });
        }
      },

      // Évaluation dangereuse
      CallExpression: (node) => {
        if (node.callee.name === 'eval') {
          issues.push({
            type: 'code-injection',
            severity: 'critical',
            message: 'eval() permet l\'exécution de code arbitraire',
            line: node.loc?.start.line || 1,
            column: node.loc?.start.column || 0,
            code: this._getCodeSnippet(node),
            fix: {
              description: 'Remplacer eval() par une alternative sûre',
              suggestion: 'JSON.parse() pour données, ou Function constructor avec précautions'
            }
          });
        }
      },

      // Requêtes API sans gestion d'erreur
      CallExpression: (node, ancestors) => {
        if (node.callee.name === 'fetch' || 
            (node.callee.type === 'MemberExpression' && node.callee.object.name === 'axios')) {
          
          const hasCatch = ancestors.some(a => 
            a.type === 'CallExpression' && a.callee.property?.name === 'catch'
          );

          if (!hasCatch) {
            issues.push({
              type: 'error-handling',
              severity: 'medium',
              message: 'Requête API sans gestion d\'erreur (.catch())',
              line: node.loc?.start.line || 1,
              column: node.loc?.start.column || 0,
              code: this._getCodeSnippet(node),
              fix: {
                description: 'Ajouter une gestion d\'erreur',
                suggestion: '.catch(error => console.error(error))'
              }
            });
          }
        }
      },

      // Injection SQL
      CallExpression: (node) => {
        const isSQL = node.callee.type === 'MemberExpression' &&
                     ['query', 'execute', 'find'].includes(node.callee.property?.name);
        
        if (isSQL && this._hasInjection(node.arguments)) {
          issues.push({
            type: 'sql-injection',
            severity: 'critical',
            message: 'Requête SQL avec concaténation, risque d\'injection',
            line: node.loc?.start.line || 1,
            column: node.loc?.start.column || 0,
            code: this._getCodeSnippet(node),
            fix: {
              description: 'Utiliser des requêtes paramétrées',
              suggestion: 'db.query("SELECT * FROM users WHERE id = ?", [userId])'
            }
          });
        }
      }
    });

    return issues;
  }

  /**
   * Analyse ligne par ligne
   */
  _analyzeLines(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Détection des commentaires TODO/FIXME
      if (line.match(/\/\/\s*(TODO|FIXME|HACK)/i)) {
        issues.push({
          type: 'code-quality',
          severity: 'low',
          message: `Commentaire ${line.match(/TODO|FIXME|HACK/i)[0]} détecté`,
          line: lineNumber,
          column: line.indexOf('//') + 1,
          code: line.trim()
        });
      }

      // Détection des mots de passe en clair (version ligne)
      if (line.match(/password\s*[:=]\s*['"`][^'"]{6,}['"`]/i)) {
        issues.push({
          type: 'hardcoded-secret',
          severity: 'critical',
          message: 'Mot de passe probable codé en dur',
          line: lineNumber,
          column: line.indexOf('=') + 1,
          code: line.trim()
        });
      }

      // Détection des clés API (version ligne)
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.pattern.test(line)) {
          issues.push({
            type: 'hardcoded-secret',
            severity: pattern.severity,
            message: `${pattern.name} détecté en clair`,
            line: lineNumber,
            column: line.search(pattern.pattern),
            code: this._maskSecret(line, pattern)
          });
        }
      }
    });

    return issues;
  }

  /**
   * Analyse contextuelle
   */
  async _contextualAnalysis(content, filePath, context) {
    const issues = [];
    const project = context.project || {};

    // Authentification sans validation
    if (content.match(/login|signin|auth|jwt|token|session/i)) {
      const hasValidation = content.match(/validate|sanitize|escape|req\.body/i);
      
      if (!hasValidation) {
        issues.push({
          type: 'authentication',
          severity: 'high',
          message: 'Gestion d\'authentification sans validation des entrées',
          context: 'global'
        });
      }
    }

    // Fichiers sensibles exposés
    if (filePath.includes('config') || filePath.includes('.env')) {
      // Vérifier si le projet est public
      if (project.isPublic) {
        issues.push({
          type: 'exposure',
          severity: 'critical',
          message: 'Fichier de configuration exposé dans un projet public',
          context: 'global',
          file: filePath
        });
      }
    }

    return issues;
  }

  /**
   * Vérifie si une assignation est safe
   */
  _isSafeAssignment(node) {
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      return callee.name === 'sanitize' || 
             callee.name === 'escape' ||
             (callee.type === 'MemberExpression' && 
              callee.property.name === 'sanitize');
    }
    return false;
  }

  /**
   * Vérifie si des arguments contiennent une injection
   */
  _hasInjection(args) {
    return args.some(arg => {
      if (arg.type === 'BinaryExpression' && arg.operator === '+') {
        return true;
      }
      if (arg.type === 'TemplateLiteral' && arg.expressions.length > 0) {
        return true;
      }
      return false;
    });
  }

  /**
   * Calcule le score de sécurité
   */
  _calculateScore(critical, high, medium, low) {
    const total = critical.length + high.length + medium.length + low.length;
    if (total === 0) return 100;

    const weightedSum = 
      critical.length * SEVERITY_WEIGHTS.critical +
      high.length * SEVERITY_WEIGHTS.high +
      medium.length * SEVERITY_WEIGHTS.medium +
      low.length * SEVERITY_WEIGHTS.low;

    const maxPossible = total * SEVERITY_WEIGHTS.critical;
    const score = 100 - (weightedSum / maxPossible * 100);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Détermine le niveau de risque
   */
  _getRiskLevel(score) {
    if (score >= RISK_THRESHOLDS.low) return 'low';
    if (score >= RISK_THRESHOLDS.medium) return 'medium';
    if (score >= RISK_THRESHOLDS.high) return 'high';
    return 'critical';
  }

  /**
   * Génère des suggestions
   */
  _generateSuggestions(issues) {
    const suggestions = [];

    if (issues.some(i => i.type === 'xss')) {
      suggestions.push({
        type: 'xss-prevention',
        message: 'Utiliser DOMPurify pour sanitizer le HTML',
        link: 'https://github.com/cure53/DOMPurify'
      });
    }

    if (issues.some(i => i.type === 'hardcoded-secret')) {
      suggestions.push({
        type: 'secrets-management',
        message: 'Utiliser des variables d\'environnement (.env)',
        link: 'https://12factor.net/config'
      });
    }

    if (issues.some(i => i.type === 'sql-injection')) {
      suggestions.push({
        type: 'sql-prevention',
        message: 'Utiliser un ORM ou des requêtes paramétrées',
        link: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'
      });
    }

    return suggestions;
  }

  /**
   * Obtient une suggestion de correction
   */
  _getFixSuggestion(issue) {
    const suggestions = {
      'innerHTML': 'Remplacer par textContent si le contenu est textuel, sinon utiliser DOMPurify',
      'eval': 'Utiliser JSON.parse() pour les données, ou Function constructor avec précautions',
      'password': 'Utiliser des variables d\'environnement ou un service de gestion de secrets',
      'sql-injection': 'Utiliser des requêtes paramétrées avec des placeholders (?, $1)'
    };

    return suggestions[issue.type] || null;
  }

  /**
   * Masque un secret dans le code
   */
  _maskSecret(line, pattern) {
    return line.replace(pattern.pattern, '******');
  }

  /**
   * Obtient un extrait de code
   */
  _getCodeSnippet(node) {
    // TODO: Implémenter l'extraction du code autour du nœud
    return '';
  }

  /**
   * Vérifie si un fichier doit être analysé
   */
  _shouldAnalyze(filePath) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.env'];
    return extensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Génère un résumé de projet
   */
  _generateProjectSummary(files, dependencies, crossIssues) {
    let totalCritical = 0;
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;

    for (const file of Object.values(files)) {
      totalCritical += file.summary.critical;
      totalHigh += file.summary.high;
      totalMedium += file.summary.medium;
      totalLow += file.summary.low;
    }

    const score = this._calculateScore(
      { length: totalCritical },
      { length: totalHigh },
      { length: totalMedium },
      { length: totalLow }
    );

    return {
      files: Object.keys(files).length,
      totalIssues: totalCritical + totalHigh + totalMedium + totalLow,
      critical: totalCritical,
      high: totalHigh,
      medium: totalMedium,
      low: totalLow,
      score,
      riskLevel: this._getRiskLevel(score),
      dependencies: dependencies.length,
      crossIssues: crossIssues.length
    };
  }
}

// =============================
// SECRET DETECTOR (dédié)
// =============================

class SecretDetector {
  constructor() {
    this.patterns = SECRET_PATTERNS;
    this.entropyThreshold = 4.5; // Seuil d'entropie pour les secrets
  }

  async analyze(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Détection par pattern
      for (const pattern of this.patterns) {
        const matches = line.match(pattern.pattern);
        if (matches) {
          issues.push({
            type: 'hardcoded-secret',
            severity: pattern.severity,
            message: `${pattern.name} détecté en clair`,
            line: index + 1,
            column: line.indexOf(matches[0]),
            code: this._maskSecret(line, matches[0]),
            entropy: this._calculateEntropy(matches[0])
          });
        }
      }

      // Détection par entropie (secrets inconnus)
      const words = line.split(/\W+/);
      for (const word of words) {
        if (word.length > 10 && this._calculateEntropy(word) > this.entropyThreshold) {
          issues.push({
            type: 'high-entropy',
            severity: 'medium',
            message: 'Chaîne à haute entropie (secret potentiel)',
            line: index + 1,
            column: line.indexOf(word),
            code: word,
            entropy: this._calculateEntropy(word)
          });
        }
      }
    });

    return issues;
  }

  /**
   * Calcule l'entropie d'une chaîne
   */
  _calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in freq) {
      const p = freq[char] / str.length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Masque un secret
   */
  _maskSecret(line, secret) {
    return line.replace(secret, '******');
  }
}

// =============================
// DEPENDENCY SCANNER
// =============================

class DependencyScanner {
  constructor() {
    this.vulnerablePackages = {
      'lodash': ['<4.17.21'],
      'express': ['<4.17.0'],
      'axios': ['<0.21.1'],
      'react': ['<16.13.0']
    };
  }

  async scan(dependencies) {
    const issues = [];

    for (const [name, version] of Object.entries(dependencies)) {
      const vuln = this.vulnerablePackages[name];
      if (vuln && this._isVulnerable(version, vuln[0])) {
        issues.push({
          type: 'vulnerable-dependency',
          severity: 'high',
          name,
          version,
          message: `Version ${version} de ${name} a des vulnérabilités connues`,
          fix: `Mettre à jour vers ${vuln[0]}`
        });
      }
    }

    return issues;
  }

  _isVulnerable(version, range) {
    // TODO: Implémenter comparaison de versions
    return true;
  }
}

// =============================
// CROSS FILE ANALYZER
// =============================

class CrossFileAnalyzer {
  async analyze(fileResults) {
    const issues = [];

    // Chercher les patterns dangereux entre fichiers
    const apiEndpoints = [];
    const sensitiveData = [];

    for (const [file, result] of Object.entries(fileResults)) {
      if (file.includes('api') || file.includes('route')) {
        apiEndpoints.push(file);
      }
      if (result.summary.critical > 0) {
        sensitiveData.push(file);
      }
    }

    // API endpoints sans validation
    if (apiEndpoints.length > 0 && sensitiveData.length > 0) {
      issues.push({
        type: 'exposed-sensitive',
        severity: 'high',
        message: `${sensitiveData.length} fichier(s) sensible(s) accessible(s) via ${apiEndpoints.length} API(s)`,
        files: sensitiveData,
        endpoints: apiEndpoints
      });
    }

    return issues;
  }
}

export const securityAnalyzer = new SecurityAnalyzer();
export default securityAnalyzer;
