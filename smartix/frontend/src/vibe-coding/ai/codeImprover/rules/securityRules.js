/**
 * Règles de sécurité
 */

import * as t from '@babel/types';

export const securityRules = {
  'no-eval': {
    name: 'no-eval',
    message: 'Éviter eval() - risque de sécurité majeur',
    severity: 'error',
    condition: (path) => {
      return t.isCallExpression(path.node) &&
             path.node.callee.name === 'eval';
    },
    fix: (path) => {
      path.remove();
    }
  },

  'no-inner-html': {
    name: 'no-inner-html',
    message: 'Utiliser textContent ou createElement au lieu de innerHTML (risque XSS)',
    severity: 'warning',
    condition: (path) => {
      return t.isAssignmentExpression(path.node) &&
             t.isMemberExpression(path.node.left) &&
             path.node.left.property?.name === 'innerHTML';
    },
    fix: (path) => {
      if (t.isStringLiteral(path.node.right)) {
        path.node.left.property.name = 'textContent';
      }
    }
  },

  'secure-token-storage': {
    name: 'secure-token-storage',
    message: 'Considérer httpOnly cookies pour plus de sécurité',
    severity: 'info',
    condition: (path) => {
      return t.isCallExpression(path.node) &&
             path.node.callee.object?.name === 'localStorage' &&
             path.node.callee.property?.name === 'getItem' &&
             path.node.arguments[0]?.value === 'token';
    }
  }
};
