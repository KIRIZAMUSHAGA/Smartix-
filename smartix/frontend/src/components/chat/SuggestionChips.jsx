import React from 'react';
import PropTypes from 'prop-types';
import { Lightbulb, Sparkles, BookOpen, Code, Calculator, PenTool } from 'lucide-react';

// =============================
// ICÔNES PAR DÉFAUT
// =============================
const defaultIcons = {
  simplify: <Lightbulb size={16} />,
  example: <BookOpen size={16} />,
  summary: <Sparkles size={16} />,
  code: <Code size={16} />,
  calculate: <Calculator size={16} />,
  rewrite: <PenTool size={16} />
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SuggestionChips = ({
  suggestions,
  onSelect,
  className = '',
  variant = 'default'
}) => {
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'compact':
        return 'gap-1.5';
      case 'pill':
        return 'gap-2 flex-wrap';
      default:
        return 'gap-2 flex-wrap';
    }
  };

  const getButtonClasses = (variant) => {
    const baseClasses = `
      inline-flex items-center gap-1.5
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
    `;

    switch (variant) {
      case 'compact':
        return `
          ${baseClasses}
          px-2 py-1 text-xs
          bg-gray-100 dark:bg-gray-700
          hover:bg-gray-200 dark:hover:bg-gray-600
          text-gray-700 dark:text-gray-200
          rounded-md
        `;
      case 'pill':
        return `
          ${baseClasses}
          px-4 py-2 text-sm
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          hover:border-indigo-500 dark:hover:border-indigo-400
          hover:bg-indigo-50 dark:hover:bg-indigo-900/20
          text-gray-700 dark:text-gray-200
          rounded-full
          shadow-sm hover:shadow
        `;
      default:
        return `
          ${baseClasses}
          px-3 py-1.5 text-sm
          bg-gray-100 dark:bg-gray-700
          hover:bg-gray-200 dark:hover:bg-gray-600
          text-gray-700 dark:text-gray-200
          rounded-lg
        `;
    }
  };

  return (
    <div className={`flex ${getVariantClasses()} ${className}`}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion.action)}
          className={getButtonClasses(variant)}
          aria-label={`Suggestion: ${suggestion.label}`}
        >
          {suggestion.icon || defaultIcons[suggestion.action]}
          <span>{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
};

// =============================
// SUGGESTIONS PRÉDÉFINIES
// =============================
export const SUGGESTIONS = {
  GENERAL: [
    { id: 'simplify', label: 'Simplifier', action: 'simplify' },
    { id: 'example', label: 'Exemple', action: 'example' },
    { id: 'summary', label: 'Résumer', action: 'summary' }
  ],
  PROGRAMMATION: [
    { id: 'explain', label: 'Expliquer', action: 'explain' },
    { id: 'refactor', label: 'Refactoriser', action: 'refactor' },
    { id: 'debug', label: 'Debugger', action: 'debug' }
  ],
  MATHEMATIQUES: [
    { id: 'calculate', label: 'Calculer', action: 'calculate' },
    { id: 'prove', label: 'Démontrer', action: 'prove' },
    { id: 'graph', label: 'Représenter', action: 'graph' }
  ],
  REDACTION: [
    { id: 'rewrite', label: 'Réécrire', action: 'rewrite' },
    { id: 'translate', label: 'Traduire', action: 'translate' },
    { id: 'correct', label: 'Corriger', action: 'correct' }
  ]
};

SuggestionChips.propTypes = {
  suggestions: PropTypes.array,
  onSelect: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.string,
};

export default SuggestionChips;
