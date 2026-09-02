// frontend/src/services/uploadService.js

/**
 * Service générique d'upload d'images
 * Ne contient aucun hook React (architecture pure)
 */

// =============================
// 1️⃣ SERVICE GÉNÉRIQUE D'UPLOAD
// =============================

/**
 * Upload une image vers un endpoint
 * @param {Object} client - Client API (axios instance)
 * @param {string} url - Endpoint d'upload (/upload/cover, /upload/avatar, etc.)
 * @param {FormData} formData - Données du formulaire contenant le fichier
 * @param {Function} onProgress - Callback de progression (reçoit progressEvent)
 * @param {AbortSignal} signal - Signal pour annuler la requête
 * @returns {Promise} Réponse de l'API
 */
export const uploadImage = async (client, url, formData, onProgress, signal) => {
  return client.post(url, formData, {
    onUploadProgress: onProgress,
    signal
  });
};

// =============================
// 2️⃣ SERVICES SPÉCIFIQUES
// =============================

/**
 * Upload une photo de couverture
 * @param {Object} client - Client API
 * @param {FormData} formData - Données du formulaire
 * @param {Function} onProgress - Callback de progression (reçoit progressEvent)
 * @param {AbortSignal} signal - Signal pour annuler
 * @returns {Promise} Réponse de l'API
 */
export const uploadCover = (client, formData, onProgress, signal) => {
  return uploadImage(client, '/upload/cover', formData, onProgress, signal);
};

/**
 * Upload un avatar
 * @param {Object} client - Client API
 * @param {FormData} formData - Données du formulaire
 * @param {Function} onProgress - Callback de progression (reçoit progressEvent)
 * @param {AbortSignal} signal - Signal pour annuler
 * @returns {Promise} Réponse de l'API
 */
export const uploadAvatar = (client, formData, onProgress, signal) => {
  return uploadImage(client, '/upload/avatar', formData, onProgress, signal);
};

/**
 * Upload une image de post
 * @param {Object} client - Client API
 * @param {FormData} formData - Données du formulaire
 * @param {Function} onProgress - Callback de progression
 * @param {AbortSignal} signal - Signal pour annuler
 * @returns {Promise} Réponse de l'API
 */
export const uploadPostImage = (client, formData, onProgress, signal) => {
  return uploadImage(client, '/upload/post', formData, onProgress, signal);
};

// =============================
// 3️⃣ UTILITAIRES D'ANNULATION
// =============================

/**
 * Annule un upload en cours
 * @param {AbortController} controller - Contrôleur d'annulation
 */
export const cancelUpload = (controller) => {
  if (controller && typeof controller.abort === 'function') {
    controller.abort();
  }
};

/**
 * Crée un nouveau contrôleur d'annulation
 * @returns {AbortController} Nouveau contrôleur
 */
export const createUploadController = () => {
  return new AbortController();
};

// =============================
// 4️⃣ ROLLBACK - SUPPRESSION DE FICHIERS
// =============================

/**
 * Supprime un fichier uploadé (rollback en cas d'échec)
 * @param {Object} client - Client API
 * @param {string} fileUrl - URL du fichier à supprimer
 * @returns {Promise}
 */
export const deleteUploadedFile = async (client, fileUrl) => {
  if (!fileUrl) return;
  
  try {
    // Extraire l'ID du fichier depuis l'URL
    // Format attendu: /uploads/avatar/xxx.jpg ou /uploads/cover/xxx.jpg
    const urlParts = fileUrl.split('/');
    const fileId = urlParts[urlParts.length - 1];
    const folder = urlParts[urlParts.length - 2]; // 'avatar' ou 'cover'
    
    await client.delete(`/upload/${folder}/${fileId}`);
    console.log(`✅ Fichier supprimé: ${fileUrl}`);
  } catch (err) {
    console.error('❌ Erreur suppression fichier:', err);
    // Ne pas propager l'erreur - on veut que l'inscription continue même si la suppression échoue
  }
};

/**
 * Supprime un fichier par son ID (alternative)
 * @param {Object} client - Client API
 * @param {string} fileId - ID du fichier
 * @param {string} type - Type de fichier ('avatar', 'cover', 'post')
 * @returns {Promise}
 */
export const deleteUploadedFileById = async (client, fileId, type = 'uploads') => {
  if (!fileId) return;
  
  try {
    await client.delete(`/upload/${type}/${fileId}`);
    console.log(`✅ Fichier supprimé: ${type}/${fileId}`);
  } catch (err) {
    console.error('❌ Erreur suppression fichier:', err);
  }
};

// =============================
// 5️⃣ EXPORT PAR DÉFAUT
// =============================

export default {
  uploadImage,
  uploadCover,
  uploadAvatar,
  uploadPostImage,
  cancelUpload,
  createUploadController,
  deleteUploadedFile,
  deleteUploadedFileById
};
