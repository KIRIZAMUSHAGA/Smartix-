/**
 * Feature Flags Configuration
 */
const FEATURE_FLAGS = {
  FEATURE_NEW_FEED: {
    enabled: true,
    percentage: 100, // Activation complète pour test utilisateur
  }
};

/**
 * Vérifie si une fonctionnalité est activée pour un utilisateur spécifique.
 * @param {string} flagName - Le nom du flag.
 * @param {string} userId - L'ID de l'utilisateur.
 * @returns {boolean}
 */
export const isFeatureEnabled = (flagName, userId) => {
  const flag = FEATURE_FLAGS[flagName];
  if (!flag || !flag.enabled) return false;

  if (!userId) {
    // Si pas d'ID (non connecté), on utilise un random simple pour le test
    return Math.random() * 100 < flag.percentage;
  }

  // Hash simple de l'ID utilisateur pour un ciblage déterministe
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  const bucket = Math.abs(hash) % 100;
  return bucket < flag.percentage;
};
