// =============================
// CONFIGURATION
// =============================
const CACHE_TTL = 60 * 60 * 1000; // 1 heure
const MAX_CACHE_SIZE = 1000; // Limite de cache pour éviter saturation RAM
const REQUEST_TIMEOUT = 60000; // 60 secondes
const MAX_PROMPT_LENGTH = 1000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 seconde

const SUPPORTED_SIZES = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'];
const DEFAULT_SIZE = '1024x1024';
const SUPPORTED_FORMATS = ['url', 'base64', 'binary'];

// Rate limiting par utilisateur
const RATE_LIMIT = {
  maxRequests: 10, // 10 images par minute
  windowMs: 60000 // 1 minute
};

// =============================
// CACHE LRU SIMPLE
// =============================
class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    const value = this.cache.get(key);
    // Rafraîchir l'ordre (LRU)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Supprimer la plus ancienne entrée
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

// =============================
// CACHE ET RATE LIMITING
// =============================
const cache = new LRUCache();
const userRequests = new Map(); // Map<userId, Array<timestamp>>

// =============================
// UTILITAIRES
// =============================
const getToken = () => localStorage.getItem('access_token');

// ✅ Hachage sécurisé du prompt
const hashPrompt = async (prompt) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const getCacheKey = async (prompt, size, format) => {
  const hash = await hashPrompt(prompt);
  return `img_${hash}_${size}_${format}`;
};

// ✅ Rate limiting par utilisateur
const checkRateLimit = (userId) => {
  if (!userId) return true; // Pas de limit pour anonyme

  const now = Date.now();
  const userHistory = userRequests.get(userId) || [];
  
  // Nettoyer les anciennes requêtes
  const recentRequests = userHistory.filter(t => now - t < RATE_LIMIT.windowMs);
  
  if (recentRequests.length >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  userRequests.set(userId, recentRequests);
  return true;
};

// ✅ Validation améliorée du prompt
const validatePrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return {
      valid: false,
      error: 'Prompt invalide'
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt trop long (max ${MAX_PROMPT_LENGTH} caractères)`
    };
  }

  // ✅ Regex pour détecter les variations de mots interdits
  const forbiddenPatterns = [
    /v[i1][o0]l[e3]nt/i,  // violent, vi0lent, vi01ent
    /explic[i1]t/i,        // explicit, expl1cit
    /h[a@]t[e3]/i,         // hate, h@te, hat3
    /n[uù][d4][i1]ty/i,    // nudity, n4dity
    /[s5][e3]x[uù][a@]l/i  // sexual, s3xual
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(prompt)) {
      return {
        valid: false,
        error: 'Le prompt contient des termes non autorisés'
      };
    }
  }

  return { valid: true };
};

// ✅ Fetch avec retry
const fetchWithRetry = async (url, options, maxRetries = MAX_RETRIES) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Attente exponentielle
      const delay = RETRY_DELAY * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
};

// =============================
// FONCTION PRINCIPALE
// =============================
export const imageTool = {
  name: 'generate_image',
  description: 'Générer une image à partir d\'une description textuelle',
  
  execute: async (prompt, options = {}) => {
    const {
      userId = 'anonymous',
      size = DEFAULT_SIZE,
      format = 'url',
      n = 1,
      quality = 'standard',
      useCache = true,
      timeout = REQUEST_TIMEOUT
    } = options;

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return {
        error: true,
        message: `Limite de ${RATE_LIMIT.maxRequests} images par minute atteinte`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: RATE_LIMIT.windowMs / 1000
      };
    }

    // Validation du prompt
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      return {
        error: true,
        message: validation.error,
        code: 'INVALID_PROMPT'
      };
    }

    // Validation de la taille
    if (!SUPPORTED_SIZES.includes(size)) {
      return {
        error: true,
        message: `Taille non supportée. Tailles disponibles: ${SUPPORTED_SIZES.join(', ')}`,
        code: 'INVALID_SIZE'
      };
    }

    // Validation du format
    if (!SUPPORTED_FORMATS.includes(format)) {
      return {
        error: true,
        message: `Format non supporté. Formats disponibles: ${SUPPORTED_FORMATS.join(', ')}`,
        code: 'INVALID_FORMAT'
      };
    }

    // Validation du nombre d'images
    if (n < 1 || n > 4) {
      return {
        error: true,
        message: 'Le nombre d\'images doit être entre 1 et 4',
        code: 'INVALID_COUNT'
      };
    }

    // Vérification du cache
    if (useCache && n === 1) {
      const cacheKey = await getCacheKey(prompt, size, format);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          ...cached.data,
          fromCache: true,
          cachedAt: new Date(cached.timestamp).toISOString()
        };
      }
    }

    // Contrôleur d'abandon
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const token = getToken();
      
      // Utilisation de fetchWithRetry pour les tentatives réseau
      const response = await fetchWithRetry('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          prompt,
          size,
          n,
          quality,
          response_format: format
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      const data = await response.json();

      // Formater les résultats
      const images = Array.isArray(data.images) ? data.images : [];
      
      const result = {
        prompt,
        size,
        format,
        n: images.length,
        images: images.map((img, index) => ({
          id: img.id || `img_${Date.now()}_${index}`,
          url: img.url || null,
          base64: img.base64 || null,
          binary: img.binary || null,
          alt: prompt,
          width: parseInt(size.split('x')[0]),
          height: parseInt(size.split('x')[1]),
          created: new Date().toISOString()
        })),
        timestamp: new Date().toISOString(),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      };

      // Mettre en cache
      if (useCache && n === 1) {
        const cacheKey = await getCacheKey(prompt, size, format);
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          error: true,
          message: 'La génération a pris trop de temps',
          code: 'TIMEOUT',
          timeout
        };
      }

      console.error('Image generation error:', error);

      // Gestion spécifique des erreurs
      if (error.message.includes('content policy')) {
        return {
          error: true,
          message: 'Le prompt viole la politique de contenu',
          code: 'CONTENT_POLICY_VIOLATION'
        };
      }

      if (error.message.includes('rate limit')) {
        return {
          error: true,
          message: 'Trop de générations, veuillez patienter',
          code: 'RATE_LIMIT_EXCEEDED'
        };
      }

      return {
        error: true,
        message: error.message || 'Échec de la génération d\'image',
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  },

  // =============================
  // FONCTIONS UTILITAIRES
  // =============================

  /**
   * Télécharger une image
   */
  downloadImage: async (imageUrl, filename = 'generated-image.png') => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    } catch (error) {
      console.error('Download error:', error);
      return {
        error: true,
        message: 'Échec du téléchargement'
      };
    }
  },

  /**
   * Effacer le cache
   */
  clearCache: () => {
    cache.clear();
    return { success: true };
  },

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats: () => ({
    size: cache.size,
    maxSize: MAX_CACHE_SIZE
  }),

  /**
   * Réinitialiser le rate limiting pour un utilisateur
   */
  resetRateLimit: (userId) => {
    userRequests.delete(userId);
    return { success: true };
  },

  /**
   * Obtenir les tailles supportées
   */
  getSupportedSizes: () => SUPPORTED_SIZES,

  /**
   * Obtenir les formats supportés
   */
  getSupportedFormats: () => SUPPORTED_FORMATS,

  /**
   * Valider un prompt
   */
  validatePrompt: (prompt) => {
    const validation = validatePrompt(prompt);
    return {
      valid: validation.valid,
      ...(validation.error && { error: validation.error })
    };
  },

  /**
   * Estimer le coût
   */
  estimateCost: (size, n = 1, quality = 'standard') => {
    const baseCost = quality === 'hd' ? 0.080 : 0.040;
    const sizeMultiplier = {
      '256x256': 0.5,
      '512x512': 0.75,
      '1024x1024': 1,
      '1792x1024': 1.5,
      '1024x1792': 1.5
    };
    
    const multiplier = sizeMultiplier[size] || 1;
    return baseCost * multiplier * n;
  }
};

export default imageTool;
