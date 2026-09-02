/**
 * Règles React
 */

import * as t from '@babel/types';

export const reactRules = {
  'class-to-function': {
    name: 'class-to-function',
    message: 'Utiliser des composants fonctionnels avec hooks',
    severity: 'info',
    condition: (path) => {
      return t.isClassDeclaration(path.node) &&
             path.node.superClass?.name === 'Component' ||
             path.node.superClass?.name === 'React.Component';
    }
  },

  'missing-key-in-list': {
    name: 'missing-key-in-list',
    message: 'Ajouter une prop "key" unique dans les listes',
    severity: 'warning',
    condition: (path) => {
      if (!t.isJSXElement(path.node)) return false;
      
      const hasKey = path.node.openingElement.attributes.some(
        attr => t.isJSXAttribute(attr) && attr.name.name === 'key'
      );
      
      return !hasKey && path.parentPath?.isCallExpression() &&
             path.parentPath.node.callee?.property?.name === 'map';
    }
  },

  'missing-alt-on-image': {
    name: 'missing-alt-on-image',
    message: 'Ajouter un attribut alt pour l\'accessibilité',
    severity: 'warning',
    condition: (path) => {
      if (!t.isJSXElement(path.node)) return false;
      
      const isImg = path.node.openingElement.name.name === 'img';
      if (!isImg) return false;
      
      const hasAlt = path.node.openingElement.attributes.some(
        attr => t.isJSXAttribute(attr) && attr.name.name === 'alt'
      );
      
      return !hasAlt;
    }
  },

  'button-without-text': {
    name: 'button-without-text',
    message: 'Ajouter un aria-label si le bouton n\'a pas de texte',
    severity: 'info',
    condition: (path) => {
      if (!t.isJSXElement(path.node)) return false;
      
      const isButton = path.node.openingElement.name.name === 'button';
      if (!isButton) return false;
      
      // Vérifier s'il y a du texte
      const hasText = path.node.children.some(child => 
        t.isJSXText(child) && child.value.trim().length > 0
      );
      
      if (hasText) return false;
      
      // Vérifier s'il y a déjà un aria-label
      const hasAriaLabel = path.node.openingElement.attributes.some(
        attr => t.isJSXAttribute(attr) && attr.name.name === 'aria-label'
      );
      
      return !hasAriaLabel;
    },
    fix: (path) => {
      path.node.openingElement.attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier('aria-label'),
          t.stringLiteral('Bouton')
        )
      );
    }
  }
};
