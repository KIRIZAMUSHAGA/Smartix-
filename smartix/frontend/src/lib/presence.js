

export const PRESENCE_TYPES = {
  TYPING: 'typing',
  ONLINE: 'online',
  LAST_SEEN: 'last_seen'
};

/**
 * Détermine le statut de présence d'un utilisateur
 * @param {Object} partner - L'utilisateur partenaire
 * @param {boolean} isTyping - Indicateur de frappe
 * @returns {Object} - { type, value }
 */
export const getUserPresence = (partner, isTyping) => {
  if (isTyping) {
    return { type: PRESENCE_TYPES.TYPING };
  }
  
  if (partner?.is_online) {
    return { type: PRESENCE_TYPES.ONLINE };
  }
  
  return { 
    type: PRESENCE_TYPES.LAST_SEEN, 
    value: partner?.last_seen 
  };
};
