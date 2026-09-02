import { imagePreloader } from './imagePreloader';
import { stickerPerformance } from '../utils/stickerPerformance';
import { storyPreloader } from '../utils/storyPreloader';

class CacheManager {
  /**
   * Calcule la taille estimée du cache en bytes
   * Note: C'est une estimation car nous n'avons pas accès direct à la taille mémoire réelle
   */
  async calculateCacheSize() {
    let totalSize = 0;
    
    // Estimation basée sur localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      totalSize += (key.length + localStorage.getItem(key).length) * 2; // UTF-16
    }

    // Estimation basée sur sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      totalSize += (key.length + sessionStorage.getItem(key).length) * 2;
    }

    // Estimation arbitraire pour les objets en mémoire (images préchargées, etc)
    // On compte ~200KB par item en cache (taille moyenne image compressée)
    const memItems = (imagePreloader.cache?.size || 0) + 
                     (stickerPerformance.cache?.size || 0) + 
                     (storyPreloader.cache?.size || 0);
    
    totalSize += memItems * 200 * 1024; 

    return totalSize;
  }

  /**
   * Formate la taille en MB/KB
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.1) return (bytes / 1024).toFixed(1) + ' KB';
    return mb.toFixed(1) + ' MB';
  }

  /**
   * Nettoie tout le cache
   */
  async clearAll() {
    // 1. Nettoyer les services de mémoire
    imagePreloader.clearCache();
    stickerPerformance.clear();
    storyPreloader.clear();

    // 2. Nettoyer sessionStorage (données volatiles)
    sessionStorage.clear();

    // 3. Nettoyer localStorage sélectivement (on garde les préférences utilisateur)
    const keysToKeep = [
      'smartix-language', 
      'smartix-theme', 
      'smartix-font-size', 
      'smartix-animations-enabled',
      'smartix-region',
      'smartix-notification-settings',
      'smartix-content-settings',
      'smartix-performance-settings',
      'smartix-accessibility-settings',
      'rememberMe',
      'access_token',
      'refresh_token',
      'user'
    ];

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    }

    // 4. Tenter de nettoyer le cache du navigateur (Cache API) si disponible
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (e) {
        console.warn('Erreur nettoyage Cache API:', e);
      }
    }

    console.log('✅ Cache intégral nettoyé');
  }
}

export const cacheManager = new CacheManager();
export default cacheManager;
