

// Constantes de configuration
export const FILE_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_SIZE_MB: 5,
  MAX_IMAGE_WIDTH: 5000,
  MAX_IMAGE_HEIGHT: 5000,
  MIN_IMAGE_WIDTH: 10,
  MIN_IMAGE_HEIGHT: 10,
  MAX_FILES: 10,
  PREVIEW_IMAGE_MAX_WIDTH: 800,
  PREVIEW_IMAGE_MAX_HEIGHT: 800,
  COMPRESSION_QUALITY: 0.8,
  THUMBNAIL_WIDTH: 150,
  THUMBNAIL_HEIGHT: 150,
  MAX_FILENAME_LENGTH: 50
};

// Extensions et types MIME (centralisés)
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mpeg'];
export const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'];
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv'
];

export const ALLOWED_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES, ...DOCUMENT_MIME_TYPES];
export const ALLOWED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...DOCUMENT_EXTENSIONS];

/**
 * Formate la taille d'un fichier en format lisible
 * @param {number} bytes - Taille en bytes
 * @returns {string} - Taille formatée (ex: "2.5 MB")
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  if (!bytes) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Obtient l'extension d'un fichier
 * @param {File} file - Le fichier
 * @returns {string} - Extension en minuscules (ex: '.jpg')
 */
export const getFileExtension = (file) => {
  if (!file || !file.name) return '';
  const lastDot = file.name.lastIndexOf('.');
  if (lastDot === -1) return '';
  return file.name.slice(lastDot).toLowerCase();
};

/**
 * Obtient le type de fichier (image, video, document)
 * @param {File} file - Le fichier
 * @returns {string} - 'image' | 'video' | 'document' | 'unknown'
 */
export const getFileType = (file) => {
  if (!file) return 'unknown';
  
  const ext = getFileExtension(file);
  
  // Vérification MIME en priorité (sécurité)
  if (IMAGE_MIME_TYPES.includes(file.type)) return 'image';
  if (VIDEO_MIME_TYPES.includes(file.type)) return 'video';
  if (DOCUMENT_MIME_TYPES.includes(file.type)) return 'document';
  
  // Fallback sur extension (secondaire)
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document';
  
  return 'unknown';
};

/**
 * Valide un fichier avant upload
 * @param {File} file - Le fichier à valider
 * @param {Object} options - Options de validation
 * @param {number} options.maxSize - Taille maximale en bytes
 * @param {Array} options.allowedTypes - Types MIME autorisés
 * @returns {Object} - { valid, error, fileType }
 */
export const validateFile = (file, options = {}) => {
  const maxSize = options.maxSize || FILE_CONFIG.MAX_SIZE;
  const allowedTypes = options.allowedTypes || ALLOWED_MIME_TYPES;
  
  if (!file) {
    return { valid: false, error: 'Aucun fichier sélectionné', fileType: null };
  }
  
  // Vérification de la taille
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `Fichier trop volumineux (max ${formatFileSize(maxSize)})`,
      fileType: getFileType(file)
    };
  }
  
  // Sécurité: vérification MIME en priorité (pas de fallback extension)
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Type de fichier non autorisé',
      fileType: 'unknown'
    };
  }
  
  return { 
    valid: true, 
    error: null,
    fileType: getFileType(file)
  };
};

/**
 * Valide une image spécifiquement (dimensions, ratio)
 * @param {File} file - Le fichier image
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<Object>} - { valid, error, width, height }
 */
export const validateImage = async (file, options = {}) => {
  const maxWidth = options.maxWidth || FILE_CONFIG.MAX_IMAGE_WIDTH;
  const maxHeight = options.maxHeight || FILE_CONFIG.MAX_IMAGE_HEIGHT;
  const minWidth = options.minWidth || FILE_CONFIG.MIN_IMAGE_WIDTH;
  const minHeight = options.minHeight || FILE_CONFIG.MIN_IMAGE_HEIGHT;
  
  const baseValidation = validateFile(file, {
    allowedTypes: IMAGE_MIME_TYPES
  });
  
  if (!baseValidation.valid) {
    return baseValidation;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Vérification des dimensions
      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({
          valid: false,
          error: `Image trop grande (max ${maxWidth}x${maxHeight}px)`,
          width: img.width,
          height: img.height,
          fileType: 'image'
        });
        return;
      }
      
      if (img.width < minWidth || img.height < minHeight) {
        resolve({
          valid: false,
          error: `Image trop petite (min ${minWidth}x${minHeight}px)`,
          width: img.width,
          height: img.height,
          fileType: 'image'
        });
        return;
      }
      
      resolve({
        valid: true,
        error: null,
        width: img.width,
        height: img.height,
        aspectRatio: img.width / img.height,
        fileType: 'image'
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: 'Image corrompue ou invalide',
        fileType: 'image'
      });
    };
    
    img.src = url;
  });
};

/**
 * Crée une miniature d'image (thumbnail)
 * @param {File} file - Le fichier image
 * @param {Object} options - Options de redimensionnement
 * @returns {Promise<string>} - DataURL de la miniature
 */
export const createImageThumbnail = async (file, options = {}) => {
  const maxWidth = options.maxWidth || FILE_CONFIG.THUMBNAIL_WIDTH;
  const maxHeight = options.maxHeight || FILE_CONFIG.THUMBNAIL_HEIGHT;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas non supporté'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL(file.type, 0.7);
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de créer la miniature'));
    };
    
    img.src = url;
  });
};

/**
 * Compresse une image avant upload
 * @param {File} file - Le fichier image
 * @param {Object} options - Options de compression
 * @returns {Promise<Blob>} - Image compressée
 */
export const compressImage = async (file, options = {}) => {
  const maxWidth = options.maxWidth || FILE_CONFIG.PREVIEW_IMAGE_MAX_WIDTH;
  const maxHeight = options.maxHeight || FILE_CONFIG.PREVIEW_IMAGE_MAX_HEIGHT;
  const quality = options.quality || FILE_CONFIG.COMPRESSION_QUALITY;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas non supporté'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Optimisation: convertir PNG en JPEG pour meilleure compression
      const outputType = file.type === 'image/png' ? 'image/jpeg' : file.type;
      const outputQuality = file.type === 'image/png' ? 0.9 : quality;
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Échec de la compression'));
          }
        },
        outputType,
        outputQuality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de charger l\'image'));
    };
    
    img.src = url;
  });
};

/**
 * Génère un nom de fichier unique
 * @param {File} file - Le fichier original
 * @returns {string} - Nom unique
 */
export const generateUniqueFileName = (file) => {
  const ext = getFileExtension(file);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const baseName = file.name.replace(ext, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const truncated = baseName.slice(0, FILE_CONFIG.MAX_FILENAME_LENGTH);
  return `${truncated}_${timestamp}_${random}${ext}`;
};

/**
 * Calcule le hash SHA-256 d'un fichier (anti-doublon)
 * @param {File} file - Le fichier
 * @returns {Promise<string>} - Hash hexadécimal
 */
export const computeFileHash = async (file) => {
  if (!file || !window.crypto?.subtle) {
    return null;
  }
  
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Erreur calcul hash:', err);
    return null;
  }
};

/**
 * Upload un fichier avec progression et annulation
 * @param {File} file - Le fichier
 * @param {Function} onProgress - Callback de progression (0-100)
 * @param {AbortSignal} signal - Signal d'annulation
 * @returns {Promise<Object>} - Réponse du serveur
 */
export const uploadFile = async (file, onProgress, signal) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          onProgress(percent);
        }
      });
    }
    
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload annulé'));
      });
    }
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({ success: true });
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
};

/**
 * Lit un fichier comme DataURL
 * @param {File} file - Le fichier
 * @returns {Promise<string>} - DataURL
 */
export const readAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsDataURL(file);
  });
};

/**
 * Lit un fichier comme texte
 * @param {File} file - Le fichier
 * @returns {Promise<string>} - Contenu texte
 */
export const readAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
};

/**
 * Extrait les fichiers d'un événement drag & drop
 * @param {DragEvent} event - Événement drag & drop
 * @returns {Array<File>} - Liste des fichiers
 */
export const extractFilesFromDragEvent = (event) => {
  event.preventDefault();
  const items = event.dataTransfer?.items;
  if (!items) return [];
  
  const files = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  
  return files;
};

/**
 * Nettoie les URLs objet créées (prévient les fuites mémoire)
 * @param {Array<string>} urls - Liste des URLs à révoquer
 */
export const revokeObjectURLs = (urls) => {
  if (!urls || !urls.length) return;
  urls.forEach(url => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
};

// Export par défaut
export default {
  FILE_CONFIG,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  formatFileSize,
  getFileExtension,
  getFileType,
  validateFile,
  validateImage,
  createImageThumbnail,
  compressImage,
  generateUniqueFileName,
  computeFileHash,
  uploadFile,
  readAsDataURL,
  readAsText,
  extractFilesFromDragEvent,
  revokeObjectURLs
};
