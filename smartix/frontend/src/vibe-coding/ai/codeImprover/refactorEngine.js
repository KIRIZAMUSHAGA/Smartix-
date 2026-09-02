/**
 * Moteur de refactorisation
 * Applique des transformations sûres basées sur l'AST
 */

import * as t from '@babel/types';
import template from '@babel/template';

export class RefactorEngine {
  constructor() {
    this.fixers = {};
    this.suggestions = [];
  }

  async initialize() {
    console.log('✅ RefactorEngine initialized');
  }

  async suggestRefactors(ast, language) {
    const suggestions = [];

    // Suggestions de refactorisation
    const visitor = {
      ClassDeclaration(path) {
        if (path.node.superClass?.name === 'Component') {
          suggestions.push({
            id: 'class-to-function',
            title: 'Convertir en composant fonctionnel',
            description: 'Utiliser des hooks au lieu de lifecycle methods',
            difficulty: path.node.body.body.length > 5 ? 'hard' : 'medium'
          });
        }
      },

      FunctionDeclaration(path) {
        if (path.node.params.length > 3) {
          suggestions.push({
            id: 'extract-params',
            title: 'Extraire les paramètres dans un objet',
            description: 'Remplacer les paramètres multiples par un objet options',
            difficulty: 'easy'
          });
        }
      },

      VariableDeclaration(path) {
        if (path.node.declarations.length > 5) {
          suggestions.push({
            id: 'group-variables',
            title: 'Grouper les déclarations',
            description: 'Fusionner les déclarations multiples',
            difficulty: 'easy'
          });
        }
      }
    };

    traverse(ast, visitor);
    return suggestions;
  }

  async suggestFixes(ast, language) {
    const fixes = [];

    traverse(ast, {
      enter(path) {
        // var → let/const
        if (t.isVariableDeclaration(path.node) && path.node.kind === 'var') {
          fixes.push({
            id: `fix-var-${path.node.start}`,
            type: 'auto',
            title: 'Remplacer var par let/const',
            severity: 'warning',
            apply: () => {
              const isConst = path.node.declarations.every(
                decl => !decl.init || decl.id.name === decl.init.name
              );
              path.node.kind = isConst ? 'const' : 'let';
            }
          });
        }

        // == → ===
        if (t.isBinaryExpression(path.node) && path.node.operator === '==') {
          fixes.push({
            id: `fix-equality-${path.node.start}`,
            type: 'auto',
            title: 'Remplacer == par ===',
            severity: 'error',
            apply: () => {
              path.node.operator = '===';
            }
          });
        }

        // console.log()
        if (t.isCallExpression(path.node) &&
            path.node.callee.object?.name === 'console' &&
            path.node.callee.property?.name === 'log') {
          fixes.push({
            id: `fix-console-${path.node.start}`,
            type: 'auto',
            title: 'Supprimer console.log',
            severity: 'warning',
            apply: () => {
              path.remove();
            }
          });
        }
      }
    });

    return fixes;
  }

  async applyFix(ast, fixId, language) {
    let fixed = false;

    traverse(ast, {
      enter(path) {
        if (path.node.start?.toString() === fixId.replace('fix-var-', '')) {
          if (t.isVariableDeclaration(path.node) && path.node.kind === 'var') {
            path.node.kind = 'let';
            fixed = true;
            path.stop();
          }
        }
      }
    });

    return fixed ? ast : null;
  }

  async applyAutoFixes(ast, language) {
    const fixes = await this.suggestFixes(ast, language);
    
    fixes.forEach(fix => {
      try {
        fix.apply();
      } catch (error) {
        console.warn(`Failed to apply fix ${fix.id}:`, error);
      }
    });

    return ast;
  }
}
