
import { useState, useEffect } from 'react';
import { format, formatDistance, isToday, isYesterday, isThisWeek, isThisYear, differenceInDays, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

// Configuration
const DEFAULT_LOCALE = 'fr';
const DEFAULT_TIMEZONE = 'Africa/Kinshasa';
const CONSECUTIVE_MESSAGE_THRESHOLD_MINUTES = 5;

// Cache LRU simple pour les formateurs
class LRUCache {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    // Mettre à jour l'ordre (récemment utilisé)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.clear();
  }
}

const formattersCache = new LRUCache(50);

/**
 * Parse une date de manière sécurisée (ISO string uniquement)
 * @param {string} dateStr - Date ISO string
 * @returns {Date|null}
 */
export const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  
  // Utiliser parseISO de date-fns pour un parsing fiable
  const d = parseISO(dateStr);
  
  if (!isValid(d)) {
    console.warn(`Invalid date: ${dateStr}`);
    return null;
  }
  
  return d;
};

/**
 * Normalise une date pour comparaison (ignore l'heure, timezone locale)
 * @param {string|Date} date - Date à normaliser
 * @returns {Date|null} - Date normalisée (minuit, timezone locale)
 */
export const normalizeDate = (date) => {
  if (!date) return null;
  
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  if (!d) return null;
  
  // Utiliser le fuseau horaire local (pas UTC)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * Compare deux dates (ignore l'heure)
 * @param {string|Date} date1 - Première date
 * @param {string|Date} date2 - Deuxième date
 * @returns {boolean}
 */
export const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  
  const d1 = typeof date1 === 'string' ? parseDateSafe(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseDateSafe(date2) : date2;
  
  if (!d1 || !d2) return false;
  
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
};

/**
 * Vérifie si une date est aujourd'hui
 * @param {string|Date} date - Date à vérifier
 * @returns {boolean}
 */
export const isTodayDate = (date) => {
  if (!date) return false;
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  return d ? isToday(d) : false;
};

/**
 * Vérifie si une date est hier
 * @param {string|Date} date - Date à vérifier
 * @returns {boolean}
 */
export const isYesterdayDate = (date) => {
  if (!date) return false;
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  return d ? isYesterday(d) : false;
};

/**
 * Vérifie si une date est dans la semaine courante
 * @param {string|Date} date - Date à vérifier
 * @param {number} weekStartsOn - Premier jour de la semaine (0: dimanche, 1: lundi)
 * @returns {boolean}
 */
export const isCurrentWeek = (date, weekStartsOn = 1) => {
  if (!date) return false;
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  return d ? isThisWeek(d, { weekStartsOn }) : false;
};

/**
 * Vérifie si une date est dans l'année courante
 * @param {string|Date} date - Date à vérifier
 * @returns {boolean}
 */
export const isCurrentYear = (date) => {
  if (!date) return false;
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  return d ? isThisYear(d) : false;
};

/**
 * Obtient la différence en jours entre deux dates
 * @param {string|Date} date1 - Première date
 * @param {string|Date} date2 - Deuxième date
 * @returns {number}
 */
export const getDaysDiff = (date1, date2) => {
  if (!date1 || !date2) return Infinity;
  
  const d1 = typeof date1 === 'string' ? parseDateSafe(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseDateSafe(date2) : date2;
  
  if (!d1 || !d2) return Infinity;
  
  return Math.abs(differenceInDays(d2, d1));
};

/**
 * Formate une date pour l'affichage dans un séparateur (WhatsApp-like)
 * @param {string|Date} date - Date à formater
 * @param {Object} options - Options de formatage
 * @param {string} options.locale - Locale (défaut: 'fr')
 * @param {number} options.weekStartsOn - Premier jour de la semaine (défaut: 1)
 * @returns {string}
 */
export const formatDateSeparator = (date, options = {}) => {
  const { locale = DEFAULT_LOCALE, weekStartsOn = 1 } = options;
  
  if (!date) return '';
  
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  if (!d) return '';
  
  const localeObj = locale === 'fr' ? fr : undefined;
  
  if (isToday(d)) {
    return "Aujourd'hui";
  }
  
  if (isYesterday(d)) {
    return "Hier";
  }
  
  if (isThisWeek(d, { weekStartsOn })) {
    // Moins de 7 jours → nom du jour
    return format(d, 'EEEE', { locale: localeObj });
  }
  
  // Plus ancien
  if (isThisYear(d)) {
    return format(d, 'd MMMM', { locale: localeObj });
  }
  
  return format(d, 'd MMMM yyyy', { locale: localeObj });
};

/**
 * Formate une heure pour l'affichage (HH:MM)
 * @param {string|Date} date - Date à formater
 * @returns {string}
 */
export const formatTime = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  if (!d) return '';
  return format(d, 'HH:mm');
};

/**
 * Formate une date complète pour l'affichage
 * @param {string|Date} date - Date à formater
 * @param {Object} options - Options de formatage
 * @param {boolean} options.includeTime - Inclure l'heure
 * @param {string} options.locale - Locale
 * @returns {string}
 */
export const formatFullDate = (date, options = {}) => {
  const { includeTime = false, locale = DEFAULT_LOCALE } = options;
  
  if (!date) return '';
  
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  if (!d) return '';
  
  const localeObj = locale === 'fr' ? fr : undefined;
  
  if (includeTime) {
    return format(d, "d MMMM yyyy 'à' HH:mm", { locale: localeObj });
  }
  
  return format(d, 'd MMMM yyyy', { locale: localeObj });
};

/**
 * Formate une date relative (ex: "il y a 5 minutes")
 * Utilise formatDistance de date-fns (fiable et i18n)
 * @param {string|Date} date - Date à formater
 * @param {Object} options - Options
 * @param {string} options.locale - Locale
 * @param {Date} options.baseDate - Date de référence (défaut: maintenant)
 * @returns {string}
 */
export const formatRelativeTime = (date, options = {}) => {
  const { locale = DEFAULT_LOCALE, baseDate = new Date() } = options;
  
  if (!date) return '';
  
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  if (!d) return '';
  
  const localeObj = locale === 'fr' ? fr : undefined;
  
  return formatDistance(d, baseDate, { 
    locale: localeObj, 
    addSuffix: true 
  });
};

/**
 * Formate une date pour le tooltip (info-bulle)
 * Utilise Intl.DateTimeFormat avec cache LRU
 * @param {string|Date} date - Date à formater
 * @param {string} locale - Locale
 * @returns {string}
 */
export const formatTooltipDate = (date, locale = 'fr-FR') => {
  if (!date) return '';
  
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  if (!d) return '';
  
  const formatter = formattersCache.get(locale);
  if (!formatter) {
    const newFormatter = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    formattersCache.set(locale, newFormatter);
    return newFormatter.format(d);
  }
  
  return formatter.format(d);
};

/**
 * Groupe des messages par date pour la virtualisation
 * @param {Array} messages - Liste des messages
 * @returns {Array} - Messages groupés avec clés de date
 */
export const groupMessagesByDate = (messages) => {
  if (!messages || !messages.length) return [];
  
  const groups = [];
  let currentDateKey = null;
  let currentGroup = null;
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg?.created_at) continue;
    
    const d = parseDateSafe(msg.created_at);
    if (!d) continue;
    
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      currentGroup = {
        date: msg.created_at,
        formattedDate: formatDateSeparator(msg.created_at),
        messages: []
      };
      groups.push(currentGroup);
    }
    
    if (currentGroup) {
      currentGroup.messages.push(msg);
    }
  }
  
  return groups;
};

/**
 * Vérifie si un message doit afficher un séparateur de date
 * @param {Object} currentMsg - Message courant
 * @param {Object} prevMsg - Message précédent
 * @returns {boolean}
 */
export const shouldShowDateSeparator = (currentMsg, prevMsg) => {
  if (!prevMsg) return true;
  if (!currentMsg?.created_at || !prevMsg?.created_at) return true;
  return !isSameDay(currentMsg.created_at, prevMsg.created_at);
};

/**
 * Vérifie si deux messages sont consécutifs (même auteur, intervalle < seuil)
 * @param {Object} msg1 - Premier message
 * @param {Object} msg2 - Deuxième message
 * @param {number} thresholdMinutes - Seuil en minutes (défaut: 5)
 * @returns {boolean}
 */
export const areConsecutiveMessages = (msg1, msg2, thresholdMinutes = CONSECUTIVE_MESSAGE_THRESHOLD_MINUTES) => {
  if (!msg1 || !msg2) return false;
  if (msg1.sender_id !== msg2.sender_id) return false;
  
  const d1 = parseDateSafe(msg1.created_at);
  const d2 = parseDateSafe(msg2.created_at);
  
  if (!d1 || !d2) return false;
  
  const diffMinutes = Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60);
  return diffMinutes < thresholdMinutes;
};

/**
 * Obtient le timestamp UNIX en secondes
 * @param {string|Date} date - Date à convertir
 * @returns {number}
 */
export const getUnixTimestamp = (date) => {
  if (!date) return 0;
  const d = typeof date === 'string' ? parseDateSafe(date) : date;
  return d ? Math.floor(d.getTime() / 1000) : 0;
};

/**
 * Convertit un timestamp UNIX en date ISO
 * @param {number} timestamp - Timestamp UNIX en secondes
 * @returns {string|null} - Date ISO string
 */
export const fromUnixTimestamp = (timestamp) => {
  if (!timestamp) return null;
  const d = new Date(timestamp * 1000);
  return isValid(d) ? d.toISOString() : null;
};

/**
 * Vérifie si une date est expirée par rapport à maintenant
 * @param {string|Date} expiresAt - Date d'expiration
 * @returns {boolean}
 */
export const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  const d = typeof expiresAt === 'string' ? parseDateSafe(expiresAt) : expiresAt;
  if (!d) return true;
  const now = Date.now();
  return now >= d.getTime();
};

/**
 * Calcule le temps restant avant expiration
 * @param {string|Date} expiresAt - Date d'expiration
 * @returns {number} - Temps restant en secondes (0 si expiré)
 */
export const getRemainingSeconds = (expiresAt) => {
  if (!expiresAt) return 0;
  const d = typeof expiresAt === 'string' ? parseDateSafe(expiresAt) : expiresAt;
  if (!d) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((d.getTime() - now) / 1000));
};

// Hook pour utiliser la date courante (à placer dans un hook séparé)
export const useNow = (updateInterval = 60000) => {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [updateInterval]);
  
  return now;
};

// Export par défaut
export default {
  parseDateSafe,
  normalizeDate,
  isSameDay,
  isTodayDate,
  isYesterdayDate,
  isCurrentWeek,
  isCurrentYear,
  getDaysDiff,
  formatDateSeparator,
  formatTime,
  formatFullDate,
  formatRelativeTime,
  formatTooltipDate,
  groupMessagesByDate,
  shouldShowDateSeparator,
  areConsecutiveMessages,
  getUnixTimestamp,
  fromUnixTimestamp,
  isExpired,
  getRemainingSeconds,
  useNow,
  CONSECUTIVE_MESSAGE_THRESHOLD_MINUTES,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE
};
