// frontend/src/pages/Landing/components/PasswordStrengthIndicator.jsx
import React from 'react';
import { Check, X, Shield, Clock } from 'lucide-react';
import PropTypes from 'prop-types';

const PasswordStrengthIndicator = ({ password, strength }) => {
  // Sécurisation des props
  const {
    percentage = 0,
    label = '',
    level = 'weak', // weak, medium, strong
    checks = {},
    feedback = ''
  } = strength || {};

  // Ne pas afficher si l'utilisateur n'a pas encore commencé à taper
  if (!password) return null;

  // Couleurs basées sur level (maintenable)
  const labelColor = {
    weak: 'text-red-600',
    medium: 'text-yellow-600',
    strong: 'text-green-600'
  }[level] || 'text-gray-600';

  const barColor = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500'
  }[level] || 'bg-gray-300';

  // Estimation du temps de cassage
  const getHackTime = () => {
    switch (level) {
      case 'weak': return 'secondes ⏱️';
      case 'medium': return 'quelques heures ⏰';
      case 'strong': return 'plusieurs années 🔒';
      default: return '';
    }
  };

  // Règles de validation
  const rules = [
    { key: 'length', text: 'Au moins 8 caractères', met: checks.length },
    { key: 'longLength', text: 'Au moins 12 caractères (recommandé)', met: checks.longLength },
    { key: 'lowercase', text: 'Au moins une minuscule', met: checks.lowercase },
    { key: 'uppercase', text: 'Au moins une majuscule', met: checks.uppercase },
    { key: 'number', text: 'Au moins un chiffre', met: checks.number },
    { key: 'special', text: 'Au moins un caractère spécial (!@#$%^&*)', met: checks.special }
  ];

  // Règles non validées (pour UX plus légère)
  const pendingRules = rules.filter(rule => !rule.met);
  const completedCount = rules.filter(rule => rule.met).length;
  const totalRules = rules.length;

  return (
    <div className="mt-2 space-y-3">
      {/* Barre de progression avec animation fluide */}
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-[width] duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Ligne info : label + feedback + estimation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${labelColor}`} />
          <span className={`text-xs font-semibold ${labelColor}`}>
            {label}
          </span>
          {level === 'strong' && (
            <span className="text-xs text-green-600 font-semibold animate-pulse">
              🔒 Sécurisé
            </span>
          )}
        </div>
        {percentage > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Temps de cassage : {getHackTime()}</span>
          </div>
        )}
      </div>

      {/* Feedback utilisateur (plus visible) */}
      {feedback && (
        <div className="text-xs text-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
          💡 {feedback}
        </div>
      )}

      {/* Liste des règles (version optimisée) */}
      <div className="space-y-1.5 pt-1">
        {/* Option 1: Afficher seulement les règles non validées (UX plus légère) */}
        {pendingRules.length > 0 && (
          <>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">
              {completedCount}/{totalRules} règles • {pendingRules.length} à compléter
            </div>
            {pendingRules.map((rule) => (
              <div
                key={rule.key}
                className="flex items-center gap-2 transition-all duration-300 opacity-100"
              >
                <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500">{rule.text}</span>
              </div>
            ))}
          </>
        )}

        {/* Option 2: Afficher toutes les règles avec animation (si tu préfères tout montrer) */}
        {/* {rules.map((rule) => (
          <div
            key={rule.key}
            className={`flex items-center gap-2 transition-all duration-300 ${
              rule.met ? 'opacity-100' : 'opacity-60'
            }`}
          >
            {rule.met ? (
              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            )}
            <span className={`text-xs ${rule.met ? 'text-green-600' : 'text-gray-500'}`}>
              {rule.text}
            </span>
          </div>
        ))} */}
      </div>

      {/* Message de succès quand tout est validé */}
      {pendingRules.length === 0 && percentage > 0 && (
        <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 animate-fadeIn">
          ✅ Excellent ! Ton mot de passe est très sécurisé.
        </div>
      )}
    </div>
  );
};

PasswordStrengthIndicator.propTypes = {
  password: PropTypes.any.isRequired,
  strength: PropTypes.any.isRequired,
};

export default PasswordStrengthIndicator;
