// frontend/src/pages/Landing/utils/validators.js

// =============================
// 1️⃣ VALIDATION EMAIL
// =============================

/**
 * Vérifie si un email est valide (format réaliste)
 * @param {string} email - L'email à valider
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  // Format: quelque chose@quelque-chose.domaine (domaine avec au moins 2 lettres)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * Retourne un message d'erreur pour l'email
 * @param {string} email - L'email à valider
 * @returns {string}
 */
export const getEmailError = (email) => {
  if (!email) return 'Email requis';
  if (!/^[^\s@]+@[^\s@]+/.test(email)) return 'Format email invalide (ex: nom@domaine.com)';
  if (!/\.[a-zA-Z]{2,}$/.test(email)) return 'Domaine invalide (ex: .com, .fr, .org)';
  if (!isValidEmail(email)) return 'Email invalide';
  return '';
};

// =============================
// 2️⃣ VALIDATION USERNAME
// =============================

/**
 * Vérifie si un nom d'utilisateur est valide
 * @param {string} username - Le nom d'utilisateur à valider
 * @returns {boolean}
 */
export const isValidUsername = (username) => {
  if (!username) return false;
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * Retourne un message d'erreur détaillé pour le nom d'utilisateur
 * @param {string} username - Le nom d'utilisateur à valider
 * @returns {string}
 */
export const getUsernameError = (username) => {
  if (!username) return 'Nom d\'utilisateur requis';
  if (username.length < 3) return 'Au moins 3 caractères';
  if (username.length > 20) return 'Maximum 20 caractères';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Seulement lettres, chiffres, - et _';
  }
  return '';
};

// =============================
// 3️⃣ VALIDATION NOM COMPLET
// =============================

/**
 * Vérifie si un nom complet est valide (support accents, apostrophes)
 * @param {string} fullName - Le nom complet à valider
 * @returns {boolean}
 */
export const isValidFullName = (fullName) => {
  if (!fullName) return false;
  // Support: lettres, accents, espaces, apostrophes, tirets
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]{2,}$/;
  return nameRegex.test(fullName.trim());
};

/**
 * Retourne un message d'erreur pour le nom complet
 * @param {string} fullName - Le nom complet à valider
 * @returns {string}
 */
export const getFullNameError = (fullName) => {
  if (!fullName) return 'Nom complet requis';
  if (fullName.trim().length < 2) return 'Au moins 2 caractères';
  if (!/^[a-zA-ZÀ-ÿ\s'-]/.test(fullName)) {
    return 'Caractères invalides (lettres, accents, apostrophes)';
  }
  if (!isValidFullName(fullName)) return 'Nom invalide';
  return '';
};

// =============================
// 4️⃣ VALIDATION MOT DE PASSE
// =============================

/**
 * Vérifie si deux mots de passe correspondent
 * @param {string} password - Le mot de passe
 * @param {string} confirmPassword - La confirmation
 * @returns {boolean}
 */
export const doPasswordsMatch = (password, confirmPassword) => {
  return password === confirmPassword;
};

/**
 * Vérifie si le mot de passe est suffisamment fort
 * @param {Object} strength - L'objet strength retourné par usePasswordStrength
 * @returns {boolean}
 */
export const isPasswordStrongEnough = (strength) => {
  // Sécurité : vérifier que strength et strength.checks existent
  if (!strength || !strength.checks) return false;
  return strength.score >= 5 && strength.checks.longLength;
};

/**
 * Retourne un message d'erreur guidé pour le mot de passe
 * @param {Object} strength - L'objet strength
 * @returns {string}
 */
export const getPasswordErrorMessage = (strength) => {
  if (!strength || !strength.checks) return '';

  const { score, checks } = strength;

  if (score < 3) {
    return 'Ajoute des majuscules, minuscules et chiffres.';
  }

  if (!checks.special) {
    return 'Ajoute un caractère spécial (!@#$%^&*) pour renforcer la sécurité.';
  }

  if (!checks.longLength) {
    return 'Utilise au moins 12 caractères pour un mot de passe fort.';
  }

  return '';
};

// =============================
// 5️⃣ VALIDATION GLOBALE POUR L'INSCRIPTION
// =============================

/**
 * Valide l'ensemble du formulaire d'inscription
 * @param {Object} data - Les données du formulaire
 * @param {string} data.email - Email
 * @param {string} data.username - Nom d'utilisateur
 * @param {string} data.fullName - Nom complet
 * @param {string} data.password - Mot de passe
 * @param {string} data.confirmPassword - Confirmation du mot de passe
 * @param {Object} data.strength - Force du mot de passe
 * @returns {Object} - Résultat de validation pour chaque champ
 */
export const validateSignup = ({ email, username, fullName, password, confirmPassword, strength }) => {
  return {
    email: isValidEmail(email),
    username: isValidUsername(username),
    fullName: isValidFullName(fullName),
    password: isPasswordStrongEnough(strength),
    match: doPasswordsMatch(password, confirmPassword)
  };
};

/**
 * Vérifie si le formulaire d'inscription est entièrement valide
 * @param {Object} validation - Le résultat de validateSignup
 * @param {boolean} acceptTerms - Acceptation des conditions
 * @returns {boolean}
 */
export const isSignupFormValid = (validation, acceptTerms) => {
  return validation.email && 
         validation.username && 
         validation.fullName && 
         validation.password && 
         validation.match && 
         acceptTerms;
};

// =============================
// 6️⃣ VALIDATION LOGIN
// =============================

/**
 * Valide le formulaire de connexion
 * @param {Object} data - Les données de connexion
 * @param {string} data.email - Email
 * @param {string} data.password - Mot de passe
 * @returns {Object} - Résultat de validation
 */
export const validateLogin = ({ email, password }) => {
  return {
    email: isValidEmail(email),
    password: !!password && password.trim().length > 0
  };
};

/**
 * Vérifie si le formulaire de connexion est valide
 * @param {Object} validation - Le résultat de validateLogin
 * @returns {boolean}
 */
export const isLoginFormValid = (validation) => {
  return validation.email && validation.password;
};
