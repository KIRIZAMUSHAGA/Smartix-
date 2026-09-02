/**
 * Règles de performance
 */

import * as t from '@babel/types';

export const performanceRules = {
  'avoid-map-filter-chain': {
    name: 'avoid-map-filter-chain',
    message: 'Combiner map et filter en une seule passe pour éviter double itération',
    severity: 'warning',
    condition: (path) => {
      if (!t.isCallExpression(path.node)) return false;
      
      const callee = path.node.callee;
      if (!t.isMemberExpression(callee)) return false;
      
      // Vérifier pattern .map().filter()
      return callee.property?.name === 'map' && 
             path.parentPath?.isCallExpression() &&
             path.parentPath.node.callee?.property?.name === 'filter';
    },
    fix: (path) => {
      // Note: Ce fix nécessite une analyse plus poussée
      return null;
    }
  },

  'use-for-each-instead': {
    name: 'use-for-each-instead',
    message: 'Utiliser forEach ou map pour plus de clarté',
    severity: 'info',
    condition: (path) => {
      return t.isForStatement(path.node) && 
             !path.node.test?.left && // Pas un for...in
             path.node.init; // a une initialisation
    }
  },

  'avoid-inline-functions-in-render': {
    name: 'avoid-inline-functions-in-render',
    message: 'Éviter les fonctions anonymes dans le render pour prévenir les re-rendus',
    severity: 'warning',
    condition: (path) => {
      return t.isJSXExpressionContainer(path.parent) &&
             (t.isArrowFunctionExpression(path.node) || t.isFunctionExpression(path.node));
    }
  }
};
