// frontend/src/config/appConfig.js

/**
 * Configuration globale de l'application Smartix
 * Toutes les constantes partagées sont centralisées ici
 */

// =============================
// 1️⃣ CONFIGURATION UTILISATEUR
// =============================

/**
 * Âge minimum requis pour s'inscrire
 * @constant {number}
 */
export const MIN_AGE = 13;

/**
 * Âge maximum autorisé (limite raisonnable)
 * @constant {number}
 */
export const MAX_AGE = 100;

/**
 * Longueur minimale du nom d'utilisateur
 * @constant {number}
 */
export const MIN_USERNAME_LENGTH = 3;

/**
 * Longueur maximale du nom d'utilisateur
 * @constant {number}
 */
export const MAX_USERNAME_LENGTH = 20;

/**
 * Longueur minimale du mot de passe
 * @constant {number}
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Longueur recommandée pour un mot de passe fort
 * @constant {number}
 */
export const RECOMMENDED_PASSWORD_LENGTH = 12;

// =============================
// 2️⃣ CONFIGURATION DES FORMULAIRES
// =============================

/**
 * Délai de debounce pour les vérifications en temps réel (ms)
 * @constant {number}
 */
export const DEBOUNCE_DELAY = 300;

/**
 * Délai d'affichage du loader minimum (ms)
 * @constant {number}
 */
export const MIN_LOADER_DISPLAY = 500;

/**
 * Délai avant masquage automatique du mot de passe (ms)
 * @constant {number}
 */
export const PASSWORD_AUTO_HIDE_DELAY = 3000;

// =============================
// 3️⃣ CONFIGURATION DES LIMITES
// =============================

/**
 * Longueur maximale d'un nom d'école
 * @constant {number}
 */
export const MAX_SCHOOL_NAME_LENGTH = 100;

/**
 * Longueur minimale d'un nom d'école
 * @constant {number}
 */
export const MIN_SCHOOL_NAME_LENGTH = 2;

/**
 * Longueur maximale d'un commentaire
 * @constant {number}
 */
export const MAX_COMMENT_LENGTH = 500;

/**
 * Longueur maximale d'un message
 * @constant {number}
 */
export const MAX_MESSAGE_LENGTH = 1000;

// =============================
// 4️⃣ CONFIGURATION DES PAGINATIONS
// =============================

/**
 * Nombre d'éléments par page par défaut
 * @constant {number}
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Nombre maximum d'éléments par page
 * @constant {number}
 */
export const MAX_PAGE_SIZE = 100;

// =============================
// 5️⃣ CONFIGURATION DES TIMEOUTS
// =============================

/**
 * Timeout par défaut pour les requêtes API (ms)
 * @constant {number}
 */
export const DEFAULT_API_TIMEOUT = 30000;

/**
 * Timeout pour les requêtes de vérification (ms)
 * @constant {number}
 */
export const VERIFICATION_TIMEOUT = 5000;

/**
 * Timeout pour les uploads (ms)
 * @constant {number}
 */
export const UPLOAD_TIMEOUT = 60000;

// =============================
// 6️⃣ CONFIGURATION DES COOKIES
// =============================

/**
 * Durée de vie du consentement cookies (jours)
 * @constant {number}
 */
export const COOKIE_CONSENT_DURATION = 365;

// =============================
// 7️⃣ CONFIGURATION DES LIMITES D'ÂGE PAR FONCTIONNALITÉ
// =============================

/**
 * Âge minimum pour accéder aux fonctionnalités sociales
 * @constant {number}
 */
export const SOCIAL_FEATURES_MIN_AGE = 13;

/**
 * Âge minimum pour créer une story
 * @constant {number}
 */
export const STORY_CREATION_MIN_AGE = 16;

/**
 * Âge minimum pour publier sur le marketplace
 * @constant {number}
 */
export const MARKETPLACE_MIN_AGE = 18;

// =============================
// 8️⃣ CONFIGURATION DES BADGES ET NIVEAUX
// =============================

/**
 * Points par niveau
 * @constant {number}
 */
export const POINTS_PER_LEVEL = 100;

/**
 * Niveau maximum
 * @constant {number}
 */
export const MAX_LEVEL = 100;

// =============================
// 9️⃣ CONFIGURATION DES FICHIERS
// =============================

/**
 * Taille maximale d'upload d'image (bytes)
 * @constant {number}
 */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Taille maximale d'upload de vidéo (bytes)
 * @constant {number}
 */
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Taille maximale d'upload de couverture (bytes)
 * @constant {number}
 */
export const MAX_COVER_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Taille maximale d'upload de fichier de cours (bytes)
 * @constant {number}
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Types d'images acceptés
 * @constant {string[]}
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Types de vidéos acceptés
 * @constant {string[]}
 */
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

/**
 * Types de fichiers acceptés pour les cours
 * @constant {string[]}
 */
export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/jpeg',
  'image/png',
  'image/webp'
];

// =============================
// 🔟 CONFIGURATION DES COURS
// =============================

/**
 * Seuil de validation des quiz (%)
 * @constant {number}
 */
export const QUIZ_PASS_THRESHOLD = 70;

/**
 * Nombre maximum de tentatives par quiz
 * @constant {number}
 */
export const MAX_QUIZ_ATTEMPTS = 3;

/**
 * Durée de cooldown après échec (heures)
 * @constant {number}
 */
export const QUIZ_COOLDOWN_HOURS = 24;

/**
 * Points XP gagnés par chapitre validé
 * @constant {number}
 */
export const XP_PER_CHAPTER = 50;

// =============================
// 1️⃣1️⃣ EXPORT PAR DÉFAUT
// =============================

export default {
  MIN_AGE,
  MAX_AGE,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  RECOMMENDED_PASSWORD_LENGTH,
  DEBOUNCE_DELAY,
  MIN_LOADER_DISPLAY,
  PASSWORD_AUTO_HIDE_DELAY,
  MAX_SCHOOL_NAME_LENGTH,
  MIN_SCHOOL_NAME_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_MESSAGE_LENGTH,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEFAULT_API_TIMEOUT,
  VERIFICATION_TIMEOUT,
  UPLOAD_TIMEOUT,
  COOKIE_CONSENT_DURATION,
  SOCIAL_FEATURES_MIN_AGE,
  STORY_CREATION_MIN_AGE,
  MARKETPLACE_MIN_AGE,
  POINTS_PER_LEVEL,
  MAX_LEVEL,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_COVER_SIZE,
  MAX_FILE_SIZE,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  ACCEPTED_FILE_TYPES,
  QUIZ_PASS_THRESHOLD,
  MAX_QUIZ_ATTEMPTS,
  QUIZ_COOLDOWN_HOURS,
  XP_PER_CHAPTER
};
