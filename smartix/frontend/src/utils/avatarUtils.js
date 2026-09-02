const API_BASE_URL = '/api';

export const getAvatarUrl = (avatar) => {
  if (!avatar) return '/default-avatar.png';
  if (avatar.startsWith('http')) return avatar;
  
  // Extraire le nom du fichier si c'est un chemin
  let filename = avatar;
  if (avatar.includes('/')) {
    filename = avatar.split('/').pop();
  }
  
  return `${API_BASE_URL}/uploads/avatars/${filename}`;
};

export const handleAvatarError = (e) => {
  e.currentTarget.src = "/default-avatar.png";
};
