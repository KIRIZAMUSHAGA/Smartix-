
import { toast } from 'sonner';
import { isValidVideoUrl } from './videoUtils';

const DEBUG = false;

class DownloadManager {
  constructor(config = {}) {
    this.activeDownloads = new Set(); // Changement: Set au lieu de boolean global
    this.downloadHistory = [];
    this.config = {
      rateLimit: config.rateLimit || 3,
      rateLimitWindowMs: config.rateLimitWindowMs || 60000,
      downloadTimeoutMs: config.downloadTimeoutMs || 30000,
      maxHistoryDays: config.maxHistoryDays || 7,
      debug: config.debug || DEBUG,
      maxRetries: config.maxRetries || 3,
      ...config
    };
    
    this._loadHistory();
  }

  /**
   * Nettoie l'historique ancien
   */
  _cleanHistory() {
    const now = Date.now();
    const maxAge = this.config.maxHistoryDays * 24 * 60 * 60 * 1000;
    const filtered = this.downloadHistory.filter(t => now - t < maxAge);
    
    if (filtered.length !== this.downloadHistory.length) {
      this.downloadHistory = filtered;
      this._saveHistory();
      this._log('Historique nettoyé, reste', this.downloadHistory.length, 'entrées');
    }
  }

  /**
   * Charge l'historique depuis localStorage
   */
  _loadHistory() {
    try {
      const stored = localStorage.getItem('download_history');
      if (stored) {
        this.downloadHistory = JSON.parse(stored);
      } else {
        this.downloadHistory = [];
      }
      this._cleanHistory();
    } catch (e) {
      this._log('Erreur chargement historique:', e);
      this.downloadHistory = [];
    }
  }

  /**
   * Sauvegarde l'historique dans localStorage
   */
  _saveHistory() {
    try {
      // Limiter à 100 entrées maximum pour éviter le stockage trop volumineux
      const limited = this.downloadHistory.slice(-100);
      localStorage.setItem('download_history', JSON.stringify(limited));
    } catch (e) {
      this._log('Erreur sauvegarde historique:', e);
    }
  }

  /**
   * Log conditionnel
   */
  _log(...args) {
    if (this.config.debug) {
      console.log('[DownloadManager]', ...args);
    }
  }

  /**
   * Vérifie si la limite de téléchargements est atteinte
   * @returns {boolean}
   */
  isRateLimitExceeded() {
    const now = Date.now();
    const recentDownloads = this.downloadHistory.filter(
      t => now - t < this.config.rateLimitWindowMs
    );
    const exceeded = recentDownloads.length >= this.config.rateLimit;
    
    if (exceeded) {
      this._log('Rate limit dépassé:', recentDownloads.length, '/', this.config.rateLimit);
    }
    
    return exceeded;
  }

  /**
   * Enregistre un téléchargement
   */
  _recordDownload() {
    this.downloadHistory.push(Date.now());
    this._cleanHistory();
    this._saveHistory();
  }

  /**
   * Génère un nom de fichier sécurisé
   * @param {Object} clip - Le clip
   * @returns {string}
   */
  _generateFilename(clip) {
    const baseName = `smartclip_${clip.id}`;
    const extension = 'mp4';
    // Meilleure sécurité: permet lettres, chiffres, tirets, underscores, points
    const safeBase = baseName.replace(/[^a-z0-9._-]/gi, '_');
    return `${safeBase}.${extension}`;
  }

  /**
   * Télécharge via fetch + blob (méthode robuste)
   * @param {Object} clip - Le clip à télécharger
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<boolean>}
   */
  async downloadWithFetch(clip, options = {}) {
    const downloadId = `${clip.id}_${Date.now()}`;
    
    // Vérifier si déjà en cours
    if (this.activeDownloads.has(downloadId)) {
      toast.info('Téléchargement déjà en cours');
      return false;
    }
    
    // Vérifier l'URL
    if (!isValidVideoUrl(clip.video_url)) {
      toast.error('URL vidéo invalide');
      return false;
    }
    
    // Vérifier le rate limit (soft limit, backend nécessaire pour la sécurité)
    if (this.isRateLimitExceeded()) {
      toast.error(`Trop de téléchargements, réessayez dans ${Math.ceil(this.config.rateLimitWindowMs / 1000)} secondes`);
      return false;
    }
    
    this.activeDownloads.add(downloadId);
    let retryCount = 0;
    
    const attemptDownload = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        this._log('Timeout dépassé');
      }, this.config.downloadTimeoutMs);
      
      try {
        this._log('Début téléchargement:', clip.id);
        
        const response = await fetch(clip.video_url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            // Optionnel: demander un range pour tester la disponibilité
            ...(options.headers || {})
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const filename = this._generateFilename(clip);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Nettoyer l'URL objet
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        
        this._recordDownload();
        this._log('Téléchargement réussi:', filename);
        
        toast.success('Téléchargement terminé !');
        return true;
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Déterminer si on doit réessayer
        const isNetworkError = error.name === 'AbortError' || 
                               error.message?.includes('network') ||
                               error.message?.includes('fetch');
        
        if (isNetworkError && retryCount < this.config.maxRetries) {
          retryCount++;
          this._log(`Tentative ${retryCount}/${this.config.maxRetries} échouée, nouvelle tentative...`);
          
          const delay = Math.pow(2, retryCount) * 1000; // Backoff exponentiel
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return attemptDownload();
        }
        
        // Erreur non récupérable
        if (error.name === 'AbortError') {
          toast.error('Téléchargement trop long, réessayez');
        } else if (error.message?.includes('404')) {
          toast.error('Vidéo introuvable');
        } else if (error.message?.includes('403')) {
          toast.error('Accès refusé à la vidéo');
        } else {
          toast.error('Erreur lors du téléchargement');
        }
        
        this._log('Échec téléchargement:', error.message);
        return false;
        
      } finally {
        this.activeDownloads.delete(downloadId);
      }
    };
    
    return attemptDownload();
  }

  /**
   * Méthode de téléchargement legacy (fallback)
   * @param {Object} clip
   * @returns {boolean}
   */
  downloadLegacy(clip) {
    if (!isValidVideoUrl(clip.video_url)) {
      toast.error('URL vidéo invalide');
      return false;
    }
    
    if (this.isRateLimitExceeded()) {
      toast.error(`Trop de téléchargements, réessayez dans ${Math.ceil(this.config.rateLimitWindowMs / 1000)} secondes`);
      return false;
    }
    
    const link = document.createElement('a');
    link.href = clip.video_url;
    link.download = this._generateFilename(clip);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this._recordDownload();
    toast.success('Téléchargement démarré!');
    return true;
  }

  /**
   * Méthode principale de téléchargement (choisit la meilleure méthode)
   * @param {Object} clip
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  async download(clip, options = { useFetch: true }) {
    if (options.useFetch) {
      return this.downloadWithFetch(clip, options);
    }
    return Promise.resolve(this.downloadLegacy(clip));
  }

  /**
   * Vérifie si un téléchargement est en cours
   * @param {string} clipId
   * @returns {boolean}
   */
  isDownloading(clipId) {
    for (const id of this.activeDownloads) {
      if (id.startsWith(`${clipId}_`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Récupère le nombre de téléchargements récents
   * @returns {number}
   */
  getRecentDownloadCount() {
    const now = Date.now();
    return this.downloadHistory.filter(
      t => now - t < this.config.rateLimitWindowMs
    ).length;
  }

  /**
   * Réinitialise l'historique (utile pour les tests)
   */
  resetHistory() {
    this.downloadHistory = [];
    this._saveHistory();
    this._log('Historique réinitialisé');
  }
}

// Export d'une instance unique (singleton) pour toute l'application
export const downloadManager = new DownloadManager({
  debug: process.env.NODE_ENV === 'development',
  rateLimit: 3,
  rateLimitWindowMs: 60000,
  downloadTimeoutMs: 30000,
  maxRetries: 2
});

// Export de la classe pour permettre des instances personnalisées si besoin
export default DownloadManager;
