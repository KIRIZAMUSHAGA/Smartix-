/**
 * Règles de bonnes pratiques
 */

import * as t from '@babel/types';

export const bestPractices = {
  'no-var': {
    name: 'no-var',
    message: 'Utiliser let ou const au lieu de var',
    severity: 'warning',
    condition: (path) => {
      return t.isVariableDeclaration(path.node) && path.node.kind === 'var';
    },
    fix: (path) => {
      // Déterminer si c'est une constante
      const isConst = path.node.declarations.every(
        decl => !decl.init || decl.id.name === decl.init.name
      );
      path.node.kind = isConst ? 'const' : 'let';
    }
  },

  'use-strict-equality': {
    name: 'use-strict-equality',
    message: 'Utiliser === au lieu de ==',
    severity: 'error',
    condition: (path) => {
      return t.isBinaryExpression(path.node) && path.node.operator === '==';
    },
    fix: (path) => {
      path.node.operator = '===';
    }
  },

  'no-console-log': {
    name: 'no-console-log',
    message: 'Supprimer les console.log en production',
    severity: 'warning',
    condition: (path) => {
      return t.isCallExpression(path.node) &&
             path.node.callee.object?.name === 'console' &&
             path.node.callee.property?.name === 'log';
    },
    fix: (path) => {
      path.remove();
    }
  },

  'no-unused-vars': {
    name: 'no-unused-vars',
    message: 'Variable déclarée mais jamais utilisée',
    severity: 'warning',
    condition: (path) => {
      if (!t.isVariableDeclarator(path.node)) return false;
      
      // Vérifier l'utilisation dans le scope
      const binding = path.scope.getBinding(path.node.id.name);
      return binding && !binding.referenced;
    }
  },

  'use-optional-chaining': {
    name: 'use-optional-chaining',
    message: 'Utiliser l\'optional chaining (?.)',
    severity: 'info',
    condition: (path) => {
      return t.isLogicalExpression(path.node) &&
             path.node.operator === '&&' &&
             t.isMemberExpression(path.node.left) &&
             t.isMemberExpression(path.node.right);
    }
  },

  'no-todo-comments': {
    name: 'no-todo-comments',
    message: 'TODO restant à traiter',
    severity: 'info',
    condition: (path) => {
      if (!t.isCommentBlock(path.node) && !t.isCommentLine(path.node)) return false;
      return path.node.value.includes('TODO') || path.node.value.includes('FIXME');
    }
  }
};
