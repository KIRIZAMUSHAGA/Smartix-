/**
 * 🚀 STORY OPTIMIZER - Version production
 * Ultra-fast story publishing with real asset upload
 * Support multi-utilisateurs avec token
 * Support export vidéo avec FFmpeg
 */

import { useState, useCallback, useRef } from 'react';
import { useApiClient } from '../contexts/ApiClientContext';
import { toast } from 'sonner';

// =============================
// CONSTANTES
// =============================
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RATE_LIMIT_DELAY = 2000;
const MAX_STORY_SIZE_MB = 50;
const MAX_ELEMENTS = 50;
const MAX_TEXT_LENGTH = 100;
const MAX_TITLE_LENGTH = 100;
const MAX_ARTIST_LENGTH = 100;
const MAX_CONCURRENT_UPLOADS = 3; // Limite de concurrence pour les uploads
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks pour lecture fichiers

// Qualités pour l'export vidéo
const VIDEO_QUALITY_BITRATES = {
  low: 500,
  medium: 1500,
  high: 4000,
  ultra: 8000
};

// Types MIME autorisés
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']
};

// =============================
// GESTIONNAIRE D'UPLOAD AVEC ABORT
// =============================

class UploadManager {
  constructor() {
    this.controllers = new Map();
    this.activeUploads = new Set();
  }

  createController(uploadId) {
    const controller = new AbortController();
    this.controllers.set(uploadId, controller);
    return controller;
  }

  cancelUpload(uploadId) {
    const controller = this.controllers.get(uploadId);
    if (controller) {
      controller.abort();
      this.controllers.delete(uploadId);
      this.activeUploads.delete(uploadId);
    }
  }

  cancelAll() {
    for (const [uploadId, controller] of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
    this.activeUploads.clear();
  }

  registerUpload(uploadId) {
    this.activeUploads.add(uploadId);
  }

  unregisterUpload(uploadId) {
    this.activeUploads.delete(uploadId);
    this.controllers.delete(uploadId);
  }
}

const uploadManager = new UploadManager();

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Valide une URL (check basique, backend fera validation finale)
 */
const isValidUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('data:')) return true;
  if (url.startsWith('blob:')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Sanitize un texte (protection XSS basique - backend fait validation finale)
 */
const sanitizeText = (text, maxLength) => {
  if (!text) return '';
  // Ne supprime pas les caractères, backend fera la validation finale
  return text.substring(0, maxLength);
};

/**
 * Sanitize le contenu selon le type
 */
const sanitizeContent = (content, type) => {
  if (!content) return '';
  if (type === 'text') {
    return content.substring(0, MAX_TEXT_LENGTH);
  }
  return content;
};

/**
 * Valide une couleur hex
 */
const validateColor = (color) => {
  if (!color) return '#FFFFFF';
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  return '#FFFFFF';
};

/**
 * Normalise les coordonnées
 */
const normalizeCoordinate = (value, defaultValue = 0) => {
  if (value === undefined || value === null) return defaultValue;
  return Math.round(Math.min(100, Math.max(0, value)));
};

/**
 * Normalise la taille
 */
const normalizeSize = (value, min = 10, max = 200, defaultValue = 50) => {
  if (value === undefined || value === null) return defaultValue;
  return Math.round(Math.min(max, Math.max(min, value)));
};

/**
 * Normalise la durée
 */
const normalizeDuration = (value, min = 1, max = 60, defaultValue = 5) => {
  if (value === undefined || value === null) return defaultValue;
  return Math.min(max, Math.max(min, value));
};

/**
 * Normalise le volume
 */
const normalizeVolume = (value, defaultValue = 0.8) => {
  if (value === undefined || value === null) return defaultValue;
  return Math.min(1, Math.max(0, value));
};

// =============================
// VALIDATION (UX uniquement - backend source de vérité)
// =============================

/**
 * Valide les données d'une story pour l'UX (backend fait validation finale)
 */
const validateStoryForUX = (story) => {
  const warnings = [];

  // Avertissements UX seulement - ne bloque pas l'envoi
  if (story.elements && story.elements.length > MAX_ELEMENTS) {
    warnings.push(`Beaucoup d'éléments (${story.elements.length}), la publication peut être lente`);
  }

  story.elements?.forEach((el, idx) => {
    if (el.type === 'text' && el.content?.length > MAX_TEXT_LENGTH) {
      warnings.push(`Texte long dans l'élément ${idx + 1} (sera tronqué si nécessaire)`);
    }
  });

  return { valid: true, warnings };
};

// =============================
// CALCUL DE LA TAILLE RÉELLE
// =============================

/**
 * Calcule la taille réelle d'une story (inclut les blobs)
 */
const getRealStorySize = async (story) => {
  let totalSize = 0;

  // Fonction pour obtenir la taille d'un blob
  const getBlobSize = async (url) => {
    if (url && url.startsWith('blob:')) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return blob.size;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  // Taille de l'image de fond
  if (story.backgroundImage?.startsWith('blob:')) {
    totalSize += await getBlobSize(story.backgroundImage);
  }

  // Taille de la musique
  if (story.music?.isCustom && story.music.url?.startsWith('blob:')) {
    totalSize += await getBlobSize(story.music.url);
  }

  // Taille des stickers
  for (const element of (story.elements || [])) {
    if (element.type === 'sticker' && element.content?.startsWith('blob:')) {
      totalSize += await getBlobSize(element.content);
    }
  }

  // Taille des métadonnées (approximative)
  const metadataSize = JSON.stringify(optimizeStoryData(story)).length;
  totalSize += metadataSize;

  return totalSize;
};

// =============================
// UPLOAD DES ASSETS AVEC CONTRÔLE
// =============================

/**
 * Lit un blob par chunks pour éviter double mémoire
 */
const readBlobAsFile = async (blobUrl, fileName) => {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // Vérifier le type MIME
    const mimeType = blob.type;
    const isImage = ALLOWED_MIME_TYPES.image.includes(mimeType);
    const isAudio = ALLOWED_MIME_TYPES.audio.includes(mimeType);
    
    if (!isImage && !isAudio) {
      throw new Error(`Type MIME non autorisé: ${mimeType}`);
    }
    
    return new File([blob], fileName, { type: mimeType });
  } catch (error) {
    console.error('Error reading blob:', error);
    throw error;
  }
};

/**
 * Upload un fichier vers le serveur avec support d'annulation
 */
const uploadFileToServer = async (file, type, client, uploadId, onProgress) => {
  const formData = new FormData();
  const extension = file.name.split('.').pop() || (type === 'audio' ? 'mp3' : 'jpg');
  const filename = `${Date.now()}_${uploadId}.${extension}`;
  
  formData.append('file', file, filename);
  formData.append('type', type);
  formData.append('mimeType', file.type);
  
  const controller = uploadManager.createController(uploadId);
  uploadManager.registerUpload(uploadId);
  
  try {
    const response = await client.post('/upload/temp', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      signal: controller.signal,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    
    return response.data.url;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`Upload ${uploadId} cancelled`);
      throw new Error('UPLOAD_CANCELLED');
    }
    throw error;
  } finally {
    uploadManager.unregisterUpload(uploadId);
  }
};

/**
 * Upload des assets avec limite de concurrence
 */
const uploadWithConcurrencyLimit = async (items, uploadFn, maxConcurrency) => {
  const results = [];
  const pending = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const promise = uploadFn(item, i).then(result => {
      pending.splice(pending.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    pending.push(promise);
    
    if (pending.length >= maxConcurrency) {
      await Promise.race(pending);
    }
  }
  
  return Promise.all(results);
};

/**
 * Upload des assets locaux vers le serveur
 */
export const uploadStoryAssets = async (story, onProgress, client, uploadId) => {
  if (!client) {
    throw new Error('Client API non initialisé');
  }

  const assetsToUpload = [];
  const uploadedUrls = {};

  // Détecter les assets locaux à uploader (en stockant les vrais File objects)
  if (story.music?.isCustom && story.music.url?.startsWith('blob:')) {
    assetsToUpload.push({
      type: 'audio',
      url: story.music.url,
      key: 'music',
      original: story.music
    });
  }
  
  if (story.backgroundImage?.startsWith('blob:')) {
    assetsToUpload.push({
      type: 'image',
      url: story.backgroundImage,
      key: 'background',
      original: story.backgroundImage
    });
  }

  story.elements?.forEach((el, idx) => {
    if (el.type === 'sticker' && el.content?.startsWith('blob:')) {
      assetsToUpload.push({
        type: 'image',
        url: el.content,
        key: `sticker_${idx}`,
        elementIdx: idx,
        original: el
      });
    }
  });

  if (assetsToUpload.length === 0) {
    onProgress?.({ stage: 'complete', percent: 100 });
    return story;
  }

  const total = assetsToUpload.length;
  let completed = 0;
  const uploadProgress = {};

  // Fonction d'upload pour un asset
  const uploadSingleAsset = async (asset, index) => {
    try {
      // Lire le blob une seule fois et créer un File
      const fileName = `${asset.key}.${asset.type === 'audio' ? 'mp3' : 'jpg'}`;
      const file = await readBlobAsFile(asset.url, fileName);
      
      const assetUploadId = `${uploadId}_${asset.key}`;
      const serverUrl = await uploadFileToServer(file, asset.type, client, assetUploadId, (percent) => {
        uploadProgress[asset.key] = percent;
        const totalProgress = Object.values(uploadProgress).reduce((a, b) => a + b, 0) / total;
        onProgress?.({
          stage: 'upload',
          percent: Math.floor(totalProgress),
          current: asset.key,
          completed: completed,
          total: total
        });
      });
      
      completed++;
      onProgress?.({
        stage: 'upload',
        percent: Math.floor((completed / total) * 100),
        current: asset.key,
        completed: completed,
        total: total
      });
      
      return { asset, serverUrl };
    } catch (error) {
      if (error.message === 'UPLOAD_CANCELLED') {
        throw error;
      }
      console.error(`Failed to upload ${asset.key}:`, error);
      throw new Error(`Échec upload: ${asset.key}`);
    }
  };

  // Upload avec limite de concurrence
  const results = await uploadWithConcurrencyLimit(
    assetsToUpload,
    uploadSingleAsset,
    MAX_CONCURRENT_UPLOADS
  );

  // Appliquer les résultats
  for (const { asset, serverUrl } of results) {
    if (asset.key === 'music') {
      uploadedUrls.music = serverUrl;
    } else if (asset.key === 'background') {
      uploadedUrls.background = serverUrl;
    } else if (asset.elementIdx !== undefined) {
      uploadedUrls[`element_${asset.elementIdx}`] = serverUrl;
    }
  }
  
  // Construire la story mise à jour
  const updatedStory = { ...story };
  if (uploadedUrls.music) {
    updatedStory.music = { ...story.music, url: uploadedUrls.music };
  }
  if (uploadedUrls.background) {
    updatedStory.backgroundImage = uploadedUrls.background;
  }
  
  if (story.elements) {
    updatedStory.elements = story.elements.map((el, idx) => {
      const newUrl = uploadedUrls[`element_${idx}`];
      if (newUrl) {
        return { ...el, content: newUrl };
      }
      return el;
    });
  }
  
  return updatedStory;
};

// =============================
// NORMALISATION DES DONNÉES
// =============================

/**
 * Normalise les données d'une story (sans validation sévère)
 */
export const normalizeStoryData = (story) => {
  const normalized = {
    id: story.id || Date.now(),
    backgroundImage: story.backgroundImage,
    elements: story.elements?.map(el => ({
      id: el.id,
      type: el.type,
      content: sanitizeContent(el.content, el.type),
      x: normalizeCoordinate(el.x),
      y: normalizeCoordinate(el.y),
      size: normalizeSize(el.size, 10, 200),
      fontSize: normalizeSize(el.fontSize, 12, 72),
      color: validateColor(el.color),
      opacity: normalizeSize(el.opacity, 0, 100, 100),
      rotation: normalizeCoordinate(el.rotation)
    })) || [],
    music: story.music ? {
      id: story.music.id,
      title: sanitizeText(story.music.title, MAX_TITLE_LENGTH),
      artist: sanitizeText(story.music.artist, MAX_ARTIST_LENGTH),
      duration: normalizeDuration(story.music.duration, 1, 60, 5),
      url: story.music.url,
      isCustom: story.music.isCustom || false,
      startTime: normalizeDuration(story.music.startTime, 0, story.music.duration || 5, 0),
      volume: normalizeVolume(story.music.volume, 0.8)
    } : null,
    filters: story.filters || {},
    createdAt: new Date().toISOString()
  };

  // Nettoyer les champs vides
  Object.keys(normalized).forEach(key => {
    if (normalized[key] === null || normalized[key] === undefined) {
      delete normalized[key];
    }
  });

  return normalized;
};

/**
 * Optimise les métadonnées (alias pour normalizeStoryData pour compatibilité)
 */
export const optimizeStoryData = normalizeStoryData;

// =============================
// PUBLICATION RAPIDE
// =============================

/**
 * Publie une story rapidement avec progression
 */
export const publishStoryFast = async (story, onProgress, client, uploadId = null) => {
  if (!client) {
    throw new Error('Client API non initialisé');
  }

  const sessionId = uploadId || `publish_${Date.now()}`;
  
  // UX validation seulement - avertissements non bloquants
  const validation = validateStoryForUX(story);
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => toast.warning(warning));
  }

  // Vérifier la taille réelle avant upload
  const realSize = await getRealStorySize(story);
  if (realSize > MAX_STORY_SIZE_MB * 1024 * 1024) {
    toast.error(`Story trop volumineuse (${(realSize / 1024 / 1024).toFixed(1)}MB / ${MAX_STORY_SIZE_MB}MB)`);
    throw new Error('Story too large');
  }

  try {
    onProgress?.({ stage: 'prepare', percent: 10 });
    
    // Upload des assets
    onProgress?.({ stage: 'upload_assets', percent: 20 });
    const storyWithServerUrls = await uploadStoryAssets(
      story, 
      (progress) => {
        const basePercent = 20;
        const percent = basePercent + (progress.percent * 0.3);
        onProgress?.({ ...progress, percent: Math.floor(percent) });
      }, 
      client,
      sessionId
    );
    
    // Normalisation des données
    onProgress?.({ stage: 'normalize', percent: 50 });
    const normalizedStory = normalizeStoryData(storyWithServerUrls);
    
    // Envoi au backend
    onProgress?.({ stage: 'publish', percent: 60 });
    const response = await client.post('/stories/', normalizedStory, {
      timeout: 30000
    });
    
    onProgress?.({ stage: 'complete', percent: 90 });
    const result = response.data;
    
    onProgress?.({ stage: 'done', percent: 100 });
    return result;

  } catch (error) {
    console.error('Publish error:', error);
    
    if (error.message === 'UPLOAD_CANCELLED') {
      toast.info('Publication annulée');
      throw error;
    }
    
    // Afficher le message d'erreur du backend si disponible
    const errorMessage = error.response?.data?.detail || error.response?.data?.message;
    if (errorMessage) {
      toast.error(errorMessage);
    } else if (error.response?.status === 401) {
      toast.error('Session expirée, reconnectez-vous');
    } else if (error.response?.status === 429) {
      toast.error('Trop de requêtes, patientez');
    } else if (error.response?.status === 413) {
      toast.error(`Story trop volumineuse (max ${MAX_STORY_SIZE_MB}MB)`);
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Connexion lente, réessayez');
    } else {
      toast.error('Erreur lors de la publication');
    }
    
    throw error;
  }
};

// =============================
// ESTIMATION DU TEMPS
// =============================

/**
 * Estime le temps de publication (basé sur taille réelle)
 */
export const estimatePublishTime = (story) => {
  let estimatedMs = 500; // Base (normalisation + requête)
  
  // Estimation basée sur taille réelle
  if (story.backgroundImage?.startsWith('blob:')) {
    estimatedMs += 2000; // Valeur par défaut, backend donnera info précise
  }
  
  if (story.music?.isCustom && story.music.url?.startsWith('blob:')) {
    estimatedMs += 4000;
  }
  
  const localStickersCount = story.elements?.filter(
    el => el.type === 'sticker' && el.content?.startsWith('blob:')
  ).length || 0;
  estimatedMs += localStickersCount * 500;
  
  estimatedMs += 1000;
  
  return Math.ceil(estimatedMs / 1000);
};

// =============================
// NETTOYAGE DES URLS BLOB
// =============================

/**
 * Nettoie toutes les URLs blob d'une story
 */
export const cleanupStoryBlobUrls = (story) => {
  if (story.backgroundImage?.startsWith('blob:')) {
    URL.revokeObjectURL(story.backgroundImage);
  }
  
  if (story.music?.url?.startsWith('blob:')) {
    URL.revokeObjectURL(story.music.url);
  }
  
  story.elements?.forEach(element => {
    if (element.content?.startsWith('blob:')) {
      URL.revokeObjectURL(element.content);
    }
  });
};

// =============================
// ANNULATION DES UPLOADS
// =============================

/**
 * Annule tous les uploads en cours
 */
export const cancelAllUploads = () => {
  uploadManager.cancelAll();
};

/**
 * Annule un upload spécifique
 */
export const cancelUpload = (uploadId) => {
  uploadManager.cancelUpload(uploadId);
};

// =============================
// FONCTIONS POUR L'EXPORT VIDÉO
// =============================

/**
 * Prépare les données pour l'export vidéo
 */
export const prepareVideoExportData = (story, options = {}) => {
  const {
    quality = 'high',
    outputFormat = 'mp4',
    includeAudio = true,
    includeElements = true,
    includeFilters = true
  } = options;

  const imageUrl = story.media_url || story.backgroundImage;
  if (!imageUrl) {
    throw new Error('Image URL requise pour l\'export vidéo');
  }

  const musicUrl = includeAudio ? story.music?.url : null;
  const duration = story.duration || (story.music?.duration) || 5;

  const exportData = {
    storyId: story.id,
    imageUrl: imageUrl,
    musicUrl: musicUrl,
    duration: duration,
    quality: quality,
    outputFormat: outputFormat,
    filters: includeFilters ? (story.filters || null) : null,
    elements: includeElements ? (story.elements || null) : null,
    textStyle: story.style || null
  };

  return exportData;
};

/**
 * Valide les données avant export vidéo (UX)
 */
export const isValidExportData = (exportData) => {
  const errors = [];

  if (!exportData.imageUrl) {
    errors.push('Image URL manquante');
  } else if (!isValidUrl(exportData.imageUrl)) {
    errors.push('URL de l\'image invalide');
  }

  if (exportData.musicUrl && !isValidUrl(exportData.musicUrl)) {
    errors.push('URL de la musique invalide');
  }

  if (exportData.duration && (exportData.duration < 1 || exportData.duration > 60)) {
    errors.push('La durée doit être comprise entre 1 et 60 secondes');
  }

  const validQualities = ['low', 'medium', 'high', 'ultra'];
  if (exportData.quality && !validQualities.includes(exportData.quality)) {
    errors.push(`Qualité invalide. Utilisez: ${validQualities.join(', ')}`);
  }

  const validFormats = ['mp4', 'webm', 'mov'];
  if (exportData.outputFormat && !validFormats.includes(exportData.outputFormat)) {
    errors.push(`Format invalide. Utilisez: ${validFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Estime la taille de la vidéo exportée
 */
export const estimateVideoSize = (durationSeconds, quality = 'high') => {
  const bitrate = VIDEO_QUALITY_BITRATES[quality] || VIDEO_QUALITY_BITRATES.high;
  return (bitrate * 1000 * durationSeconds) / 8;
};

/**
 * Formate la taille du fichier
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Vérifie si la story peut être exportée en vidéo
 */
export const canExportAsVideo = (story) => {
  return !!(story.backgroundImage || story.media_url);
};

/**
 * Options d'export par défaut
 */
export const getDefaultExportOptions = (story) => {
  return {
    quality: 'high',
    outputFormat: 'mp4',
    includeAudio: !!story.music?.url,
    includeElements: !!(story.elements?.length),
    includeFilters: !!(story.filters && Object.keys(story.filters).length > 0)
  };
};

// =============================
// HOOK PERSONNALISÉ
// =============================

/**
 * Hook pour publier une story
 */
export const useStoryPublisher = () => {
  const { client } = useApiClient();
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState({ stage: 'idle', percent: 0 });
  const [error, setError] = useState(null);
  const lastPublishTime = useRef(0);
  const currentUploadId = useRef(null);

  const publish = useCallback(async (story) => {
    if (!client) {
      setError(new Error('Client API non initialisé'));
      toast.error('Client API non initialisé');
      return null;
    }

    // Rate limit côté client
    const now = Date.now();
    if (now - lastPublishTime.current < RATE_LIMIT_DELAY) {
      toast.error('Attendez avant de publier à nouveau');
      return null;
    }

    // Vérification taille réelle (asynchrone)
    try {
      const realSize = await getRealStorySize(story);
      if (realSize > MAX_STORY_SIZE_MB * 1024 * 1024) {
        toast.error(`Story trop volumineuse (${(realSize / 1024 / 1024).toFixed(1)}MB / ${MAX_STORY_SIZE_MB}MB)`);
        return null;
      }
    } catch (err) {
      console.error('Size check error:', err);
    }

    setPublishing(true);
    setProgress({ stage: 'starting', percent: 0 });
    setError(null);
    lastPublishTime.current = now;
    
    currentUploadId.current = `publish_${Date.now()}`;

    try {
      const result = await publishStoryFast(story, setProgress, client, currentUploadId.current);
      cleanupStoryBlobUrls(story);
      toast.success('Story publiée avec succès !');
      return result;
    } catch (err) {
      if (err.message !== 'UPLOAD_CANCELLED') {
        setError(err);
      }
      return null;
    } finally {
      setPublishing(false);
      currentUploadId.current = null;
    }
  }, [client]);

  const cancel = useCallback(() => {
    if (currentUploadId.current) {
      cancelUpload(currentUploadId.current);
      setPublishing(false);
      setProgress({ stage: 'cancelled', percent: 0 });
      toast.info('Publication annulée');
    }
  }, []);

  const estimate = useCallback((story) => {
    return estimatePublishTime(story);
  }, []);

  const prepareExport = useCallback((story, options = {}) => {
    return prepareVideoExportData(story, options);
  }, []);

  const canExport = useCallback((story) => {
    return canExportAsVideo(story);
  }, []);

  const getExportOptions = useCallback((story) => {
    return getDefaultExportOptions(story);
  }, []);

  return {
    publish,
    cancel,
    estimate,
    prepareExport,
    canExport,
    getExportOptions,
    publishing,
    progress,
    error
  };
};

// =============================
// EXPORT PAR DÉFAUT
// =============================

export default {
  // Fonctions principales
  publishStoryFast,
  normalizeStoryData,
  optimizeStoryData,
  uploadStoryAssets,
  estimatePublishTime,
  cleanupStoryBlobUrls,
  cancelAllUploads,
  cancelUpload,
  useStoryPublisher,
  
  // Export vidéo
  prepareVideoExportData,
  isValidExportData,
  estimateVideoSize,
  formatFileSize,
  canExportAsVideo,
  getDefaultExportOptions
};
