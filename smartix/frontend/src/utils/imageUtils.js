import { API_BASE_URL } from '../config/api';

export const validateImageFile = (file, { maxSizeMB = 5, acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } = {}) => {
  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };
  if (!acceptedTypes.includes(file.type)) return { valid: false, error: `Type non supporté. Formats acceptés: ${acceptedTypes.join(', ')}` };
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) return { valid: false, error: `Fichier trop volumineux (max ${maxSizeMB} Mo)` };
  return { valid: true, error: null };
};

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE_URL || '';
  return `${base}/uploads/${path}`;
};

export const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  const base = API_BASE_URL || '';
  return `${base}/uploads/avatars/${avatar}`;
};

export const getMediaUrl = (filename, type = 'posts') => {
  if (!filename) return null;
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  const base = API_BASE_URL || '';
  return `${base}/uploads/${type}/${filename}`;
};

export const compressImage = async (file, maxSizeMB = 1) => {
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(file, { maxSizeMB, maxWidthOrHeight: 1920, useWebWorker: true });
};

export default { getImageUrl, getAvatarUrl, getMediaUrl };
