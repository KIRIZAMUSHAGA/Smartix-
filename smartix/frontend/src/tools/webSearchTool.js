// =============================
// CONFIGURATION
// =============================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS = 10;
const REQUEST_TIMEOUT = 10000; // 10 secondes
const RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60000 // 1 minute
};

// =============================
// CACHE EN MÉMOIRE
// =============================
const cache = new Map();

// =============================
// RATE LIMITING
// =============================
const requestLog = new Map();

const checkRateLimit = (userId = 'anonymous') => {
  const now = Date.now();
  const userRequests = requestLog.get(userId) || [];
  
  // Nettoyer les anciennes requêtes
  const recentRequests = userRequests.filter(t => now - t < RATE_LIMIT.windowMs);
  
  if (recentRequests.length >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  requestLog.set(userId, recentRequests);
  return true;
};

// =============================
// UTILITAIRES
// =============================
const getCacheKey = (query) => `search_${query.toLowerCase().trim()}`;

const getToken = () => localStorage.getItem('access_token');

// =============================
// FONCTION PRINCIPALE DE RECHERCHE
// =============================
export const webSearchTool = {
  name: 'web_search',
  description: 'Rechercher des informations sur le web',
  
  execute: async (query, options = {}) => {
    const {
      userId = 'anonymous',
      maxResults = MAX_RESULTS,
      useCache = true,
      timeout = REQUEST_TIMEOUT
    } = options;

    // Validation
    if (!query || typeof query !== 'string') {
      return {
        error: true,
        message: 'Requête de recherche invalide',
        code: 'INVALID_QUERY'
      };
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return {
        error: true,
        message: 'Trop de requêtes, veuillez patienter',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: RATE_LIMIT.windowMs / 1000
      };
    }

    // Vérification du cache
    if (useCache) {
      const cacheKey = getCacheKey(query);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          ...cached.data,
          fromCache: true,
          cachedAt: new Date(cached.timestamp).toISOString()
        };
      }
    }

    // Contrôleur d'abandon pour timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const token = getToken();
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${maxResults}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      const data = await response.json();

      // Formater les résultats
      const results = Array.isArray(data.results) ? data.results.slice(0, maxResults) : [];
      
      const formattedResults = {
        query,
        totalResults: data.totalResults || results.length,
        results: results.map(item => ({
          title: item.title || 'Sans titre',
          url: item.url || '',
          snippet: item.snippet || item.description || '',
          source: item.source || 'web'
        })),
        timestamp: new Date().toISOString()
      };

      // Mettre en cache
      if (useCache) {
        const cacheKey = getCacheKey(query);
        cache.set(cacheKey, {
          data: formattedResults,
          timestamp: Date.now()
        });
      }

      return formattedResults;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          error: true,
          message: 'La requête a pris trop de temps',
          code: 'TIMEOUT',
          timeout
        };
      }

      console.error('Web search error:', error);

      return {
        error: true,
        message: error.message || 'Impossible d\'effectuer la recherche',
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  },

  // =============================
  // FONCTIONS UTILITAIRES
  // =============================

  /**
   * Efface le cache de recherche
   */
  clearCache: () => {
    cache.clear();
    return { success: true };
  },

  /**
   * Récupère les statistiques du cache
   */
  getCacheStats: () => ({
    size: cache.size,
    keys: Array.from(cache.keys())
  }),

  /**
   * Réinitialise le rate limiting pour un utilisateur
   */
  resetRateLimit: (userId) => {
    requestLog.delete(userId);
    return { success: true };
  },

  /**
   * Suggestions de recherche basées sur une requête
   */
  getSuggestions: async (partialQuery) => {
    if (!partialQuery || partialQuery.length < 2) return [];

    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(partialQuery)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  }
};

// =============================
// EXPORT PAR DÉFAUT
// =============================
export default webSearchTool;
