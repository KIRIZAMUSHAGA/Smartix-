// =============================
// CONSTANTES
// =============================
const STORAGE_KEY = 'ai_chat_threads';
const MESSAGES_PREFIX = 'ai_chat_messages_';

// =============================
// UTILITAIRES
// =============================
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// =============================
// GESTION DES THREADS
// =============================

/**
 * Récupère tous les threads
 */
export const getThreads = async () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const threads = stored ? JSON.parse(stored) : [];
    return { threads };
  } catch (error) {
    console.error('Error loading threads:', error);
    return { threads: [] };
  }
};

/**
 * Crée un nouveau thread
 */
export const createThread = async ({ name }) => {
  const thread = {
    id: generateId(),
    title: name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0
  };

  try {
    const { threads } = await getThreads();
    const updatedThreads = [thread, ...threads];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedThreads));
    return { thread };
  } catch (error) {
    console.error('Error creating thread:', error);
    throw new Error('Failed to create thread');
  }
};

/**
 * Renomme un thread
 */
export const renameThread = async (threadId, newName) => {
  try {
    const { threads } = await getThreads();
    const updatedThreads = threads.map(t =>
      t.id === threadId
        ? { ...t, title: newName, updatedAt: new Date().toISOString() }
        : t
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedThreads));
    return { success: true };
  } catch (error) {
    console.error('Error renaming thread:', error);
    throw new Error('Failed to rename thread');
  }
};

/**
 * Supprime un thread et ses messages
 */
export const deleteThread = async (threadId) => {
  try {
    // Supprimer les messages associés
    localStorage.removeItem(`${MESSAGES_PREFIX}${threadId}`);

    // Supprimer le thread
    const { threads } = await getThreads();
    const updatedThreads = threads.filter(t => t.id !== threadId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedThreads));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting thread:', error);
    throw new Error('Failed to delete thread');
  }
};

/**
 * Récupère les messages d'un thread
 */
export const getMessages = async (threadId) => {
  try {
    const stored = localStorage.getItem(`${MESSAGES_PREFIX}${threadId}`);
    const messages = stored ? JSON.parse(stored) : [];
    return { messages };
  } catch (error) {
    console.error('Error loading messages:', error);
    return { messages: [] };
  }
};

/**
 * Sauvegarde un message dans un thread
 */
export const saveMessage = async (threadId, message) => {
  try {
    const { messages } = await getMessages(threadId);
    const updatedMessages = [...messages, message];
    localStorage.setItem(`${MESSAGES_PREFIX}${threadId}`, JSON.stringify(updatedMessages));

    // Mettre à jour le compteur et la date du thread
    const { threads } = await getThreads();
    const updatedThreads = threads.map(t =>
      t.id === threadId
        ? { 
            ...t, 
            updatedAt: new Date().toISOString(),
            messageCount: updatedMessages.length 
          }
        : t
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedThreads));

    return { success: true };
  } catch (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
};

/**
 * Supprime tous les threads (pour debug)
 */
export const clearAllThreads = async () => {
  try {
    const { threads } = await getThreads();
    threads.forEach(t => {
      localStorage.removeItem(`${MESSAGES_PREFIX}${t.id}`);
    });
    localStorage.removeItem(STORAGE_KEY);
    return { success: true };
  } catch (error) {
    console.error('Error clearing threads:', error);
    throw new Error('Failed to clear threads');
  }
};
