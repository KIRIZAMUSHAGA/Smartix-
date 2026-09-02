
import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';

// Formateur global pour éviter les recréations
const createFormatter = (locale = 'fr-FR', options = {}) => {
  return new Intl.DateTimeFormat(locale, options);
};

// Formateurs préconfigurés
const formatters = {
  full: (locale) => createFormatter(locale, { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  }),
  noYear: (locale) => createFormatter(locale, { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long'
  }),
  short: (locale) => createFormatter(locale, { 
    weekday: 'long'
  }),
  numeric: (locale) => createFormatter(locale, { 
    day: 'numeric', 
    month: 'numeric', 
    year: 'numeric'
  })
};

// Cache pour les dates formatées
const formatCache = new Map();

/**
 * Normalise une date pour comparaison (ignore l'heure)
 * @param {string|Date} date - Date à normaliser
 * @returns {Date} - Date normalisée (minuit)
 */
const normalizeDate = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

/**
 * Compare deux dates avec normalisation UTC
 * @param {string|Date} date1 - Première date
 * @param {string|Date} date2 - Deuxième date
 * @returns {boolean}
 */
export const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  
  return d1.toDateString() === d2.toDateString();
};

/**
 * Obtient la différence en jours entre deux dates
 * @param {string|Date} date1 - Première date
 * @param {string|Date} date2 - Deuxième date
 * @returns {number}
 */
export const getDaysDiff = (date1, date2) => {
  if (!date1 || !date2) return Infinity;
  
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formate une date selon les règles WhatsApp-like
 * @param {string|Date} date - Date à formater
 * @param {string} locale - Locale (défaut: 'fr-FR')
 * @returns {string}
 */
export const formatDateSeparator = (date, locale = 'fr-FR') => {
  if (!date) return '';
  
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Vérification du cache
  const cacheKey = `${date}_${locale}`;
  if (formatCache.has(cacheKey)) {
    return formatCache.get(cacheKey);
  }
  
  const normalizedDate = normalizeDate(d);
  const normalizedToday = normalizeDate(today);
  const normalizedYesterday = normalizeDate(yesterday);
  
  let result;
  
  if (normalizedDate.getTime() === normalizedToday.getTime()) {
    result = "Aujourd'hui";
  } else if (normalizedDate.getTime() === normalizedYesterday.getTime()) {
    result = "Hier";
  } else {
    const daysDiff = getDaysDiff(d, today);
    
    // Moins de 7 jours → afficher le jour de la semaine
    if (daysDiff < 7) {
      const shortFormatter = formatters.short(locale);
      result = shortFormatter.format(d);
      // Capitaliser la première lettre
      result = result.charAt(0).toUpperCase() + result.slice(1);
    } else {
      // Plus ancien → date complète
      const isSameYear = d.getFullYear() === today.getFullYear();
      const formatter = isSameYear ? formatters.noYear(locale) : formatters.full(locale);
      result = formatter.format(d);
      // Capitaliser la première lettre
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
  }
  
  // Mise en cache (limite à 100 entrées)
  if (formatCache.size > 100) {
    const firstKey = formatCache.keys().next().value;
    formatCache.delete(firstKey);
  }
  formatCache.set(cacheKey, result);
  
  return result;
};

/**
 * Devrait-on afficher un séparateur entre deux messages ?
 * @param {Object} currentMsg - Message courant
 * @param {Object} prevMsg - Message précédent
 * @returns {boolean}
 */
export const shouldShowDateSeparator = (currentMsg, prevMsg) => {
  // Cas où il n'y a pas de message précédent → afficher
  if (!prevMsg) return true;
  
  // Si l'un des messages n'a pas de date → afficher par sécurité
  if (!currentMsg?.created_at || !prevMsg?.created_at) {
    return true;
  }
  
  return !isSameDay(currentMsg.created_at, prevMsg.created_at);
};

// Composant mémoïsé avec useMemo
const DateSeparator = memo(({
  date,
  format = 'default',
  variant = 'default',
  customText = null,
  locale = 'fr-FR'
}) => {
  // Mémoïsation du texte formaté
  const formattedDate = useMemo(() => {
    if (customText) return customText;
    return formatDateSeparator(date, locale);
  }, [date, customText, locale]);

  // Variants d'affichage
  const variantClasses = useMemo(() => {
    switch (variant) {
      case 'line':
        return {
          container: 'flex items-center justify-center my-4',
          line: 'flex-1 h-px bg-border',
          text: 'mx-4 text-[11px] font-medium text-muted-foreground'
        };
      case 'pill':
        return {
          container: 'flex justify-center my-4',
          text: 'bg-white/70 dark:bg-white/10 backdrop-blur-sm text-[11px] font-semibold text-muted-foreground px-4 py-1.5 rounded-full shadow-sm'
        };
      case 'simple':
        return {
          container: 'flex justify-center my-3',
          text: 'text-[10px] text-muted-foreground/60'
        };
      default:
        return {
          container: 'flex justify-center my-4',
          text: 'bg-muted/50 text-[11px] font-medium text-muted-foreground px-3 py-1 rounded-full'
        };
    }
  }, [variant]);

  if (!date) return null;

  if (variant === 'line') {
    return (
      <div className={variantClasses.container}>
        <div className={variantClasses.line} />
        <span className={variantClasses.text}>
          {formattedDate}
        </span>
        <div className={variantClasses.line} />
      </div>
    );
  }

  return (
    <div className={variantClasses.container}>
      <span className={variantClasses.text}>
        {formattedDate}
      </span>
    </div>
  );
});

DateSeparator.displayName = 'DateSeparator';

DateSeparator.propTypes = {
  date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  format: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'line', 'pill', 'simple']),
  customText: PropTypes.string,
  locale: PropTypes.string
};

export default DateSeparator;
