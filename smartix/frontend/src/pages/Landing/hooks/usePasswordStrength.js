// frontend/src/pages/Landing/hooks/usePasswordStrength.js
import { useState, useCallback } from 'react';

/**
 * Calcule la force d'un mot de passe avec feedback pédagogique
 * @param {string} password - Le mot de passe à évaluer
 * @returns {Object} { percentage, label, level, color, score, checks, feedback }
 */
const calculatePasswordStrength = (password) => {
  if (!password) {
    return {
      percentage: 0,
      label: '',
      level: 'weak',
      color: '',
      score: 0,
      checks: {
        length: false,
        longLength: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false
      },
      feedback: ''
    };
  }

  // Vérifications individuelles
  const checks = {
    length: password.length >= 8,
    longLength: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };

  // Calcul du score (1 point par condition remplie)
  let score = 0;
  if (checks.length) score += 1;
  if (checks.longLength) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;

  const percentage = (score / 6) * 100;

  // Détermination du label, niveau et feedback
  let label = 'Faible';
  let level = 'weak';
  let color = 'bg-red-500';
  let feedback = '';

  if (score >= 5 && password.length >= 10) {
    label = 'Fort';
    level = 'strong';
    color = 'bg-green-500';
    feedback = 'Excellent mot de passe 🔒';
  } else if (score >= 4) {
    label = 'Bon';
    level = 'medium';
    color = 'bg-blue-500';
    feedback = 'Ajoutez des caractères spéciaux pour le rendre encore plus fort';
  } else if (score >= 3) {
    label = 'Moyen';
    level = 'medium';
    color = 'bg-yellow-500';
    feedback = 'Ajoutez des majuscules et des chiffres pour renforcer';
  } else if (score >= 1) {
    label = 'Faible';
    level = 'weak';
    color = 'bg-red-500';
    feedback = 'Ajoutez des majuscules, des chiffres et des caractères spéciaux';
  } else {
    feedback = 'Commencez par entrer un mot de passe';
  }

  return {
    percentage,
    label,
    level,
    color,
    score,
    checks,
    feedback
  };
};

export const usePasswordStrength = () => {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState({
    percentage: 0,
    label: '',
    level: 'weak',
    color: '',
    score: 0,
    checks: {
      length: false,
      longLength: false,
      lowercase: false,
      uppercase: false,
      number: false,
      special: false
    },
    feedback: ''
  });

  const updatePassword = useCallback((newPassword) => {
    setPassword(newPassword);
    setStrength(calculatePasswordStrength(newPassword));
  }, []);

  const reset = useCallback(() => {
    setPassword('');
    setStrength({
      percentage: 0,
      label: '',
      level: 'weak',
      color: '',
      score: 0,
      checks: {
        length: false,
        longLength: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false
      },
      feedback: ''
    });
  }, []);

  return { password, strength, updatePassword, reset };
};

export default usePasswordStrength;
