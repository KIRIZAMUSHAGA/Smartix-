/**
 * Utilitaires pour les vibrations mobiles
 */

export const vibrate = (duration = 15) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
};

export const vibratePattern = (pattern) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const vibrateLight = () => {
  vibrate(10);
};

export const vibrateStrong = () => {
  vibrate(20);
};

export const vibrateDouble = () => {
  vibratePattern([10, 10, 10]);
};

export default vibrate;
