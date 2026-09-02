// frontend/src/config/features.js
// Flags de migration. USE_SINGLE_PLAYER reste désactivé par défaut
// pour garantir que l'existant continue de fonctionner sans régression.
// Pour tester la nouvelle architecture single-player, basculer à true.

export const FEATURES = {
  USE_SINGLE_PLAYER: true,
  PRELOAD_COUNT: 2,
  CACHE_SIZE: 5
};

export default FEATURES;
