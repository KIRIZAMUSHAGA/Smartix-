// =============================
// CONFIGURATION
// =============================
const API_BASE = '/api';
const DEFAULT_TIMEOUT = 30000; // 30 secondes

// =============================
// UTILITAIRES
// =============================
const getToken = () => localStorage.getItem('access_token');

// =============================
// STOCKAGE LOCAL (fallback si API indisponible)
// =============================
const MEMORY_STORAGE_KEY = 'ai_conversation_memory';

/**
 * Sauvegarde un résumé en local (fallback)
 */
const saveMemoryLocally = (threadId, summary) => {
  try {
    const memories = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '{}');
    memories[threadId] = {
      summary,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    return true;
  } catch (error) {
    console.error('Error saving memory locally:', error);
    return false;
  }
};

/**
 * Récupère un résumé local
 */
const getMemoryLocally = (threadId) => {
  try {
    const memories = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '{}');
    const memory = memories[threadId];
    
    // Expiration après 7 jours
    if (memory && Date.now() - memory.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return memory.summary;
    }
    return null;
  } catch (error) {
    console.error('Error getting memory locally:', error);
    return null;
  }
};

// =============================
// API DE MÉMOIRE
// =============================

/**
 * Résume une conversation
 * @param {Array} messages - Liste des messages à résumer
 * @param {string} threadId - ID de la conversation
 * @returns {Promise<string>} Résumé de la conversation
 */
export const summarizeConversation = async (messages, threadId) => {
  if (!messages || messages.length === 0) {
    return '';
  }

  const token = getToken();
  if (!token) {
    throw new Error('Non authentifié');
  }

  try {
    const response = await fetch(`${API_BASE}/api/ai/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        messages,
        threadId,
        action: 'summarize'
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();
    
    // Sauvegarder en local pour fallback
    if (data.summary) {
      saveMemoryLocally(threadId, data.summary);
    }

    return data.summary || '';
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    
    // Fallback: résumé local simple
    const localSummary = generateLocalSummary(messages);
    saveMemoryLocally(threadId, localSummary);
    return localSummary;
  }
};

/**
 * Récupère le résumé d'une conversation
 * @param {string} threadId - ID de la conversation
 * @returns {Promise<string>} Résumé stocké
 */
export const getConversationMemory = async (threadId) => {
  const token = getToken();

  try {
    const response = await fetch(`${API_BASE}/api/ai/memory/${threadId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.summary || '';
    }
  } catch (error) {
    console.error('Error fetching memory from API:', error);
  }

  // Fallback: mémoire locale
  return getMemoryLocally(threadId) || '';
};

/**
 * Met à jour la mémoire avec un nouveau message
 * @param {string} threadId - ID de la conversation
 * @param {Object} message - Nouveau message
 * @returns {Promise<boolean>} Succès de l'opération
 */
export const updateMemory = async (threadId, message) => {
  const token = getToken();

  try {
    const response = await fetch(`${API_BASE}/api/ai/memory/${threadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating memory:', error);
    return false;
  }
};

/**
 * Supprime la mémoire d'une conversation
 * @param {string} threadId - ID de la conversation
 * @returns {Promise<boolean>} Succès de l'opération
 */
export const deleteMemory = async (threadId) => {
  const token = getToken();

  try {
    const response = await fetch(`${API_BASE}/api/ai/memory/${threadId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Supprimer aussi la mémoire locale
    try {
      const memories = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '{}');
      delete memories[threadId];
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch (e) {}

    return response.ok;
  } catch (error) {
    console.error('Error deleting memory:', error);
    return false;
  }
};

// =============================
// UTILITAIRES LOCAUX (FALLBACK)
// =============================

/**
 * Génère un résumé local simple (fallback)
 * @param {Array} messages - Messages à résumer
 * @returns {string} Résumé basique
 */
const generateLocalSummary = (messages) => {
  if (!messages || messages.length === 0) return '';

  // Compter les messages par rôle
  const userCount = messages.filter(m => m.role === 'user').length;
  const assistantCount = messages.filter(m => m.role === 'assistant').length;

  // Dernier sujet (basé sur le dernier message utilisateur)
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const lastTopic = lastUserMessage?.content?.substring(0, 50) + '...';

  return `Conversation avec ${userCount} questions et ${assistantCount} réponses. Dernier sujet: ${lastTopic}`;
};

/**
 * Extrait les mots-clés d'un message (fallback)
 * @param {string} content - Contenu du message
 * @returns {Array} Mots-clés extraits
 */
export const extractKeywords = (content) => {
  if (!content) return [];

  // Supprimer la ponctuation et les mots courants
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['pour', 'avec', 'dans', 'cette', 'comment', 'pourquoi'].includes(word));

  // Compter les occurrences
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Retourner les mots les plus fréquents
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
};

// =============================
// EXPORT PAR DÉFAUT
// =============================
export default {
  summarizeConversation,
  getConversationMemory,
  updateMemory,
  deleteMemory,
  extractKeywords
};
