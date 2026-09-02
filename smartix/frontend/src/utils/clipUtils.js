
import { isValidVideoUrl } from './videoUtils';

/**
 * Valide si un clip a toutes les propriétés requises
 * @param {Object} clip - L'objet clip à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export const validateClip = (clip) => {
  const errors = [];
  
  if (!clip) {
    errors.push('Clip invalide');
    return { valid: false, errors };
  }
  
  if (!clip.id) {
    errors.push('ID du clip manquant');
  }
  
  if (!clip.video_url) {
    errors.push('URL vidéo manquante');
  } else if (!isValidVideoUrl(clip.video_url)) {
    errors.push('URL vidéo invalide');
  }
  
  if (!clip.author || !clip.author.id) {
    errors.push('Auteur du clip manquant');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Formate le nombre de likes pour l'affichage (K, M)
 * @param {number} likes - Nombre de likes
 * @returns {string} - Likes formatés
 */
export const formatLikes = (likes) => {
  if (!likes || likes < 0) return '0';
  
  if (likes >= 1_000_000) {
    const value = likes / 1_000_000;
    // Supprimer le ".0" si présent
    const formatted = value.toFixed(1).replace(/\.0$/, '');
    return `${formatted}M`;
  }
  
  if (likes >= 1_000) {
    const value = likes / 1_000;
    const formatted = value.toFixed(1).replace(/\.0$/, '');
    return `${formatted}K`;
  }
  
  return likes.toString();
};

/**
 * Extrait les hashtags du texte de description (sans doublons)
 * @param {string} text - Texte de description
 * @returns {string[]} - Tableau des hashtags trouvés (sans doublons)
 */
export const extractHashtags = (text) => {
  if (!text) return [];
  
  const hashtagRegex = /#([\w\u00C0-\u00FF]+)/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) return [];
  
  // Utiliser un Set pour éliminer les doublons
  const uniqueTags = new Set(matches.map(tag => tag.slice(1)));
  return Array.from(uniqueTags);
};

/**
 * Extrait l'ID d'une URL YouTube (version robuste)
 * @param {string} url - URL YouTube
 * @returns {string|null} - ID de la vidéo ou null
 */
export const extractYouTubeId = (url) => {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    
    // Format: youtube.com/watch?v=xxx
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    
    // Format: youtu.be/xxx
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1);
    }
    
    // Format: youtube.com/embed/xxx
    if (urlObj.pathname.includes('/embed/')) {
      return urlObj.pathname.split('/embed/')[1]?.split('?')[0];
    }
  } catch {
    // URL invalide, fallback aux regex
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/,
      /(?:youtu\.be\/)([^?]+)/,
      /(?:youtube\.com\/embed\/)([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
  }
  
  return null;
};

/**
 * Vérifie si une URL est une URL YouTube
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
export const isYouTubeUrl = (url) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
};

/**
 * Génère une URL de miniature pour une vidéo YouTube (avec fallback)
 * @param {string} youtubeId - ID YouTube
 * @param {string} quality - Qualité: 'maxres', 'hq', 'mq', 'default'
 * @returns {string}
 */
const getYouTubeThumbnail = (youtubeId, quality = 'maxres') => {
  const qualities = {
    maxres: 'maxresdefault.jpg',
    hq: 'hqdefault.jpg',
    mq: 'mqdefault.jpg',
    default: 'default.jpg'
  };
  
  return `https://img.youtube.com/vi/${youtubeId}/${qualities[quality] || qualities.default}`;
};

/**
 * Génère une URL de miniature pour une vidéo
 * @param {Object} clip - L'objet clip
 * @returns {string|null} - URL de la miniature
 */
export const getThumbnailUrl = (clip) => {
  if (!clip) return null;
  
  // Si le clip a déjà une miniature
  if (clip.thumbnail_url) return clip.thumbnail_url;
  
  // Si c'est une vidéo YouTube
  const youtubeId = extractYouTubeId(clip.video_url);
  if (youtubeId) {
    // Essayer d'abord la meilleure qualité, fallback si indisponible
    return getYouTubeThumbnail(youtubeId, 'maxres');
  }
  
  return null;
};

/**
 * Tronque une description longue
 * @param {string} description - Description complète
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - Description tronquée
 */
export const truncateDescription = (description, maxLength = 100) => {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  
  // Tronquer au dernier espace pour éviter de couper un mot
  const truncated = description.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};

/**
 * Trie les clips par date (du plus récent au plus ancien)
 * @param {Array} clips - Tableau des clips
 * @returns {Array} - Clips triés
 */
export const sortClipsByDate = (clips) => {
  if (!clips || !clips.length) return [];
  
  return [...clips].sort((a, b) => {
    const dateA = new Date(a.created_at || a.createdAt || a.timestamp || 0);
    const dateB = new Date(b.created_at || b.createdAt || b.timestamp || 0);
    return dateB - dateA;
  });
};

/**
 * Filtre les clips par hashtag
 * @param {Array} clips - Tableau des clips
 * @param {string} hashtag - Hashtag à filtrer (sans le #)
 * @returns {Array} - Clips filtrés
 */
export const filterClipsByHashtag = (clips, hashtag) => {
  if (!clips || !hashtag) return [...clips];
  
  const lowerHashtag = hashtag.toLowerCase();
  
  return clips.filter(clip => {
    if (!clip.hashtags || !clip.hashtags.length) return false;
    return clip.hashtags.some(tag => tag.toLowerCase() === lowerHashtag);
  });
};

/**
 * Calcule le temps de lecture estimé pour une liste de clips
 * @param {Array} clips - Tableau des clips
 * @returns {number} - Temps total en secondes
 */
export const estimateTotalWatchTime = (clips) => {
  if (!clips || !clips.length) return 0;
  
  // Utiliser les durées réelles si disponibles
  let total = 0;
  for (const clip of clips) {
    if (clip.duration && clip.duration > 0) {
      total += clip.duration;
    } else {
      // Durée estimée par défaut
      total += 15;
    }
  }
  
  return total;
};

/**
 * Formate une durée en heures, minutes et secondes
 * @param {number} seconds - Durée en secondes
 * @returns {string} - Durée formatée (ex: "2h 30m 45s")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds}s`);
  }
  
  return parts.join(' ');
};

/**
 * Vérifie si l'utilisateur est l'auteur du clip
 * @param {Object} clip - L'objet clip
 * @param {Object} user - L'utilisateur courant
 * @returns {boolean}
 */
export const isClipAuthor = (clip, user) => {
  if (!clip?.author?.id || !user?.id) return false;
  return clip.author.id === user.id;
};

/**
 * Vérifie si l'utilisateur a liké le clip
 * @param {Object} clip - L'objet clip
 * @returns {boolean}
 */
export const isLiked = (clip) => {
  return clip?.liked === true;
};

/**
 * Vérifie si l'utilisateur a sauvegardé le clip
 * @param {Object} clip - L'objet clip
 * @returns {boolean}
 */
export const isSaved = (clip) => {
  return clip?.saved === true;
};

/**
 * Calcule le pourcentage de progression d'une vidéo
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @returns {number} - Pourcentage (0-100)
 */
export const getVideoProgress = (video) => {
  if (!video || !video.duration || video.duration === 0) return 0;
  return (video.currentTime / video.duration) * 100;
};

/**
 * Export par défaut
 */
export default {
  validateClip,
  formatLikes,
  extractHashtags,
  extractYouTubeId,
  isYouTubeUrl,
  getThumbnailUrl,
  truncateDescription,
  sortClipsByDate,
  filterClipsByHashtag,
  estimateTotalWatchTime,
  formatDuration,
  isClipAuthor,
  isLiked,
  isSaved,
  getVideoProgress
};
