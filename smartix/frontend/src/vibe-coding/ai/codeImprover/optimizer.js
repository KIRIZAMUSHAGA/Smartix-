/**
 * Optimiseur de code
 * Transformations pour améliorer les performances
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';

export class Optimizer {
  constructor() {
    this.optimizations = [];
  }

  async initialize() {
    console.log('✅ Optimizer initialized');
  }

  async optimize(ast, language) {
    this._optimizeImports(ast);
    this._optimizeLoops(ast);
    this._optimizeMemoization(ast);
    this._optimizeRender(ast);
    
    return ast;
  }

  _optimizeImports(ast) {
    // Fusionner les imports du même module
    const importMap = new Map();

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (!importMap.has(source)) {
          importMap.set(source, []);
        }
        importMap.get(source).push(path);
      }
    });

    // Fusionner et remplacer
    importMap.forEach((paths, source) => {
      if (paths.length > 1) {
        const allSpecifiers = paths.flatMap(p => p.node.specifiers);
        const merged = t.importDeclaration(allSpecifiers, t.stringLiteral(source));
        
        // Remplacer le premier et supprimer les autres
        paths[0].replaceWith(merged);
        paths.slice(1).forEach(p => p.remove());
      }
    });
  }

  _optimizeLoops(ast) {
    traverse(ast, {
      ForStatement(path) {
        // Optimiser les for simples quand possible
        if (this._isSimpleForLoop(path.node)) {
          const array = path.node.test.left?.object;
          if (array) {
            // Transformer en forEach
            const callback = t.arrowFunctionExpression(
              [t.identifier('item'), t.identifier('index')],
              path.node.body
            );
            
            path.replaceWith(
              t.callExpression(
                t.memberExpression(array, t.identifier('forEach')),
                [callback]
              )
            );
          }
        }
      }
    });
  }

  _isSimpleForLoop(node) {
    return node.init &&
           t.isVariableDeclaration(node.init) &&
           node.test &&
           t.isBinaryExpression(node.test) &&
           node.test.operator === '<' &&
           t.isMemberExpression(node.test.right) &&
           node.test.right.property?.name === 'length';
  }

  _optimizeMemoization(ast) {
    // Ajouter React.memo aux composants exportés
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        if (t.isFunctionDeclaration(path.node.declaration) ||
            t.isArrowFunctionExpression(path.node.declaration)) {
          
          // Vérifier si déjà memo
          if (path.node.declaration.type !== 'CallExpression' ||
              path.node.declaration.callee.name !== 'memo') {
            
            const memoCall = t.callExpression(
              t.identifier('React.memo'),
              [path.node.declaration]
            );
            
            path.node.declaration = memoCall;
          }
        }
      }
    });
  }

  _optimizeRender(ast) {
    // Éviter les fonctions inline dans les props
    traverse(ast, {
      JSXAttribute(path) {
        if (path.node.value?.type === 'JSXExpressionContainer') {
          const expr = path.node.value.expression;
          
          if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
            // Extraire la fonction comme constante
            const functionName = path.scope.generateUidIdentifier('handler');
            
            // Créer la déclaration
            const declaration = t.variableDeclaration('const', [
              t.variableDeclarator(functionName, expr)
            ]);
            
            // Insérer avant le composant
            const program = path.findParent(p => p.isProgram());
            program.node.body.unshift(declaration);
            
            // Remplacer par la référence
            path.node.value.expression = functionName;
          }
        }
      }
    });
  }
}
