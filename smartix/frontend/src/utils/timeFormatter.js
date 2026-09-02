/**
 * 🕐 TIME FORMATTER - Formats dates in French relative format
 * "il y a 2 minutes", "il y a 1 heure", "hier", etc
 */

export const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Maintenant';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    // Maintenant
    if (diffSec < 10) {
      return 'À l\'instant';
    }

    // Secondes
    if (diffSec < 60) {
      return `il y a ${diffSec} seconde${diffSec > 1 ? 's' : ''}`;
    }

    // Minutes
    if (diffMin < 60) {
      return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
    }

    // Heures
    if (diffHour < 24) {
      return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
    }

    // Hier
    if (diffDay === 1) {
      return 'hier';
    }

    // Jours
    if (diffDay < 7) {
      return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
    }

    // Semaines
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 4) {
      return `il y a ${diffWeek} semaine${diffWeek > 1 ? 's' : ''}`;
    }

    // Mois
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) {
      return `il y a ${diffMonth} mois`;
    }

    // Années
    const diffYear = Math.floor(diffDay / 365);
    return `il y a ${diffYear} an${diffYear > 1 ? 's' : ''}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Récemment';
  }
};

/**
 * Format date as detailed string (e.g., "12 décembre 2024 à 14:30")
 */
export const formatDateDetailed = (dateString) => {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    const months = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${year} à ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};
