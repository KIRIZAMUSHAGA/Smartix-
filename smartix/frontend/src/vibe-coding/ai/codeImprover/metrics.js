/**
 * Calculateur de métriques de code
 */

import traverse from '@babel/traverse';

export class MetricsCalculator {
  calculate(ast, code) {
    const metrics = {
      lines: code.split('\n').length,
      characters: code.length,
      functions: 0,
      classes: 0,
      imports: 0,
      exports: 0,
      complexity: 0,
      comments: 0,
      jsxElements: 0,
      hooks: 0
    };

    // Compter les commentaires (hors AST)
    metrics.comments = (code.match(/\/\/.*$|\/\*[\s\S]*?\*\//gm) || []).length;

    traverse(ast, {
      FunctionDeclaration: () => metrics.functions++,
      FunctionExpression: () => metrics.functions++,
      ArrowFunctionExpression: () => metrics.functions++,
      ClassDeclaration: () => metrics.classes++,
      ImportDeclaration: () => metrics.imports++,
      ExportNamedDeclaration: () => metrics.exports++,
      ExportDefaultDeclaration: () => metrics.exports++,
      JSXElement: () => metrics.jsxElements++,
      
      CallExpression(path) {
        if (path.node.callee.name === 'useState' ||
            path.node.callee.name === 'useEffect' ||
            path.node.callee.name === 'useCallback' ||
            path.node.callee.name === 'useMemo') {
          metrics.hooks++;
        }
      },

      // Complexité cyclomatique
      IfStatement: () => metrics.complexity++,
      ConditionalExpression: () => metrics.complexity++,
      LogicalExpression: () => metrics.complexity++,
      ForStatement: () => metrics.complexity += 2,
      WhileStatement: () => metrics.complexity += 2,
      SwitchCase: () => metrics.complexity++,
      CatchClause: () => metrics.complexity++
    });

    return metrics;
  }

  getQualityGrade(metrics) {
    const score = this._calculateScore(metrics);
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  _calculateScore(metrics) {
    let score = 100;

    // Pénalités
    if (metrics.complexity > 50) score -= 20;
    else if (metrics.complexity > 30) score -= 10;
    
    if (metrics.functions > 20) score -= 10;
    if (metrics.classes > 5) score -= 5;
    
    // Bonus
    if (metrics.comments > metrics.lines * 0.1) score += 5;
    if (metrics.hooks > 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }
      }
