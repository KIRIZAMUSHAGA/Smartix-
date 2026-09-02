// =============================
// CONFIGURATION
// =============================
const API_BASE = '/api';
const DEFAULT_TIMEOUT = 30000; // 30 secondes

// =============================
// UTILITAIRES
// =============================
const getToken = () => localStorage.getItem('access_token');

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La requête a pris trop de temps');
    }
    throw error;
  }
};

// =============================
// ENVOI DE MESSAGE
// =============================
export const sendMessageAPI = async (message, signal) => {
  return fetchWithTimeout('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
    signal
  });
};

// =============================
// UPLOAD DE FICHIER (existant)
// =============================
export const uploadFile = async (file, onProgress) => {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve({ success: true });
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `${API_BASE}/api/ai/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

// =============================
// ✅ NOUVEAU : UPLOAD DE FICHIER À L'IA (endpoint spécifique)
// =============================
export const uploadFileToAI = async (file, onProgress) => {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve({ success: true, text: '' });
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `${API_BASE}/api/ai/file`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

// =============================
// RÉCUPÉRATION DES MESSAGES D'UN THREAD
// =============================
export const getMessagesAPI = async (threadId) => {
  return fetchWithTimeout(`/api/ai/threads/${threadId}/messages`, {
    method: 'GET'
  });
};

// =============================
// ÉDITION D'UN MESSAGE
// =============================
export const editMessageAPI = async (messageId, newContent) => {
  return fetchWithTimeout(`/api/ai/messages/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify({ content: newContent })
  });
};

// =============================
// RÉGÉNÉRATION D'UN MESSAGE
// =============================
export const regenerateMessageAPI = async (messageId) => {
  return fetchWithTimeout(`/api/ai/messages/${messageId}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({})
  });
};

// =============================
// VÉRIFICATION DES QUOTAS (avec cache)
// =============================
let quotaCache = null;
let quotaCacheTime = 0;
const QUOTA_CACHE_TTL = 60000; // 1 minute

export const getQuota = async (forceRefresh = false) => {
  const now = Date.now();

  if (!forceRefresh && quotaCache && (now - quotaCacheTime < QUOTA_CACHE_TTL)) {
    return quotaCache;
  }

  const data = await fetchWithTimeout('/api/ai/check-quota', {
    method: 'GET'
  });

  quotaCache = data;
  quotaCacheTime = now;
  return data;
};

// =============================
// STREAMING (pour réponses en temps réel)
// =============================
export const streamMessageAPI = async (message, onChunk, signal) => {
  const token = getToken();

  const response = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Stream error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    onChunk(chunk);
  }
};
