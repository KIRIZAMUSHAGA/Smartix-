/**
 * Gestionnaire de stockage des projets Vibe-Coding
 * 
 * Fonctions:
 * - saveProject() : Sauvegarde un projet
 * - loadProject() : Charge un projet
 * - deleteProject() : Supprime un projet
 * - listProjects() : Liste tous les projets d'un utilisateur
 * - searchProjects() : Recherche des projets
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { generateProjectId, isValidId, parseId } from '../utils/idGenerator';
import { validateProject } from '../utils/projectValidator';

// =============================
// CONFIGURATION
// =============================

// Clé de stockage pour IndexedDB
const DB_NAME = 'VibeCodingDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

// Cache mémoire pour les projets fréquemment accédés
const projectCache = new Map();
const CACHE_MAX_SIZE = 50;

// Statistiques de stockage
let storageStats = {
  totalProjects: 0,
  totalSize: 0,
  lastBackup: null,
  cacheHits: 0,
  cacheMisses: 0
};

// =============================
// INDEXEDDB INITIALIZATION
// =============================

let dbInstance = null;

/**
 * Initialise la connexion IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (!window.indexedDB) {
      reject(new Error('IndexedDB non supporté'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      
      // Gestion de la fermeture de la DB
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Créer le store des projets
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        
        // Créer les index
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('state', 'state', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        
        console.log('✅ IndexedDB store created');
      }
    };
  });
};

// =============================
// GESTION DU CACHE
// =============================

/**
 * Ajoute un projet au cache
 * @param {string} projectId - ID du projet
 * @param {Object} project - Données du projet
 */
const addToCache = (projectId, project) => {
  if (projectCache.size >= CACHE_MAX_SIZE) {
    // Supprimer la plus ancienne entrée (simple LRU)
    const oldestKey = projectCache.keys().next().value;
    projectCache.delete(oldestKey);
  }
  projectCache.set(projectId, {
    data: project,
    timestamp: Date.now()
  });
};

/**
 * Récupère un projet du cache
 * @param {string} projectId - ID du projet
 * @returns {Object|null} Projet ou null
 */
const getFromCache = (projectId) => {
  const cached = projectCache.get(projectId);
  if (cached) {
    storageStats.cacheHits++;
    return cached.data;
  }
  storageStats.cacheMisses++;
  return null;
};

/**
 * Invalide le cache pour un projet
 * @param {string} projectId - ID du projet
 */
const invalidateCache = (projectId) => {
  projectCache.delete(projectId);
};

/**
 * Nettoie le cache complet
 */
const clearCache = () => {
  projectCache.clear();
  storageStats.cacheHits = 0;
  storageStats.cacheMisses = 0;
};

// =============================
// FONCTIONS PRINCIPALES DE STOCKAGE
// =============================

/**
 * Sauvegarde un projet
 * @param {Object} project - Données du projet
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} Projet sauvegardé
 */
export const saveProject = async (project, userId) => {
  try {
    // Validation
    if (!userId) {
      throw new Error('userId requis');
    }
    
    if (!project) {
      throw new Error('Projet requis');
    }
    
    // Générer un ID si nécessaire
    if (!project.id) {
      project.id = generateProjectId();
    } else if (!isValidId(project.id, 'proj')) {
      throw new Error('ID de projet invalide');
    }
    
    // Ajouter les métadonnées
    const now = new Date().toISOString();
    const projectToSave = {
      ...project,
      userId,
      updatedAt: now,
      ...(!project.createdAt && { createdAt: now })
    };
    
    // Valider le projet
    const validation = validateProject(projectToSave);
    if (!validation.isValid) {
      throw new Error(`Projet invalide: ${validation.structure.errors.join(', ')}`);
    }
    
    // Sauvegarder dans IndexedDB
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.put(projectToSave);
      
      request.onsuccess = () => {
        // Mettre à jour le cache
        addToCache(project.id, projectToSave);
        
        // Mettre à jour les stats
        storageStats.totalProjects++;
        
        resolve({
          ...projectToSave,
          _stored: true,
          _timestamp: now
        });
      };
      
      request.onerror = () => {
        reject(new Error('Erreur lors de la sauvegarde'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
    
  } catch (error) {
    console.error('Erreur saveProject:', error);
    throw error;
  }
};

/**
 * Charge un projet par son ID
 * @param {string} projectId - ID du projet
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 * @returns {Promise<Object|null>} Projet ou null
 */
export const loadProject = async (projectId, userId) => {
  try {
    if (!projectId) {
      throw new Error('projectId requis');
    }
    
    if (!isValidId(projectId, 'proj')) {
      throw new Error('ID de projet invalide');
    }
    
    // Vérifier le cache d'abord
    const cached = getFromCache(projectId);
    if (cached) {
      if (!userId || cached.userId === userId) {
        return cached;
      }
      // Si l'utilisateur ne correspond pas, ignorer le cache
    }
    
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(projectId);
      
      request.onsuccess = () => {
        const project = request.result;
        
        if (!project) {
          resolve(null);
          return;
        }
        
        // Vérifier les permissions
        if (userId && project.userId !== userId) {
          reject(new Error('Accès non autorisé'));
          return;
        }
        
        // Mettre en cache
        addToCache(projectId, project);
        
        resolve(project);
      };
      
      request.onerror = () => {
        reject(new Error('Erreur lors du chargement'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
    
  } catch (error) {
    console.error('Erreur loadProject:', error);
    throw error;
  }
};

/**
 * Supprime un projet
 * @param {string} projectId - ID du projet
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 * @returns {Promise<boolean>} True si supprimé
 */
export const deleteProject = async (projectId, userId) => {
  try {
    if (!projectId) {
      throw new Error('projectId requis');
    }
    
    if (!userId) {
      throw new Error('userId requis');
    }
    
    // Vérifier d'abord que le projet appartient à l'utilisateur
    const project = await loadProject(projectId, userId);
    if (!project) {
      throw new Error('Projet non trouvé');
    }
    
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(projectId);
      
      request.onsuccess = () => {
        // Invalider le cache
        invalidateCache(projectId);
        
        // Mettre à jour les stats
        storageStats.totalProjects = Math.max(0, storageStats.totalProjects - 1);
        
        resolve(true);
      };
      
      request.onerror = () => {
        reject(new Error('Erreur lors de la suppression'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
    
  } catch (error) {
    console.error('Erreur deleteProject:', error);
    throw error;
  }
};

/**
 * Liste tous les projets d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} options - Options de filtrage/pagination
 * @returns {Promise<Array>} Liste des projets
 */
export const listProjects = async (userId, options = {}) => {
  try {
    if (!userId) {
      throw new Error('userId requis');
    }
    
    const {
      limit = 50,
      offset = 0,
      type = null,
      state = null,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;
    
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    
    return new Promise((resolve, reject) => {
      const projects = [];
      const range = IDBKeyRange.only(userId);
      
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const project = cursor.value;
          
          // Appliquer les filtres
          let include = true;
          if (type && project.type !== type) include = false;
          if (state && project.state !== state) include = false;
          
          if (include) {
            projects.push(project);
          }
          
          cursor.continue();
        } else {
          // Trier
          projects.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            
            if (sortOrder === 'desc') {
              return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            } else {
              return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            }
          });
          
          // Paginer
          const paginated = projects.slice(offset, offset + limit);
          
          resolve({
            projects: paginated,
            total: projects.length,
            offset,
            limit,
            hasMore: offset + limit < projects.length
          });
        }
      };
      
      request.onerror = () => {
        reject(new Error('Erreur lors de la liste des projets'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
    
  } catch (error) {
    console.error('Erreur listProjects:', error);
    throw error;
  }
};

/**
 * Recherche des projets
 * @param {string} userId - ID de l'utilisateur
 * @param {string} query - Terme de recherche
 * @param {Object} options - Options
 * @returns {Promise<Array>} Projets correspondants
 */
export const searchProjects = async (userId, query, options = {}) => {
  try {
    if (!userId) {
      throw new Error('userId requis');
    }
    
    if (!query || query.length < 2) {
      return { projects: [], total: 0 };
    }
    
    const { limit = 20 } = options;
    const lowerQuery = query.toLowerCase();
    
    // Récupérer tous les projets (on peut optimiser avec un index de recherche plus tard)
    const { projects } = await listProjects(userId, { limit: 1000 });
    
    // Filtrer par nom, description ou tags
    const filtered = projects.filter(project => {
      const nameMatch = project.name?.toLowerCase().includes(lowerQuery);
      const descMatch = project.description?.toLowerCase().includes(lowerQuery);
      const tagsMatch = project.tags?.some(tag => 
        tag.toLowerCase().includes(lowerQuery)
      );
      
      return nameMatch || descMatch || tagsMatch;
    });
    
    return {
      projects: filtered.slice(0, limit),
      total: filtered.length,
      query
    };
    
  } catch (error) {
    console.error('Erreur searchProjects:', error);
    throw error;
  }
};

// =============================
// FONCTIONS DE MAINTENANCE
// =============================

/**
 * Sauvegarde de tous les projets (export)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} Données exportées
 */
export const backupProjects = async (userId) => {
  try {
    const { projects } = await listProjects(userId, { limit: 1000 });
    
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId,
      count: projects.length,
      projects
    };
    
    storageStats.lastBackup = backup.timestamp;
    
    return backup;
    
  } catch (error) {
    console.error('Erreur backupProjects:', error);
    throw error;
  }
};

/**
 * Restaure des projets depuis une sauvegarde
 * @param {Object} backup - Données de sauvegarde
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<number>} Nombre de projets restaurés
 */
export const restoreProjects = async (backup, userId) => {
  try {
    if (!backup || !backup.projects || !Array.isArray(backup.projects)) {
      throw new Error('Sauvegarde invalide');
    }
    
    let restored = 0;
    
    for (const project of backup.projects) {
      try {
        await saveProject(project, userId);
        restored++;
      } catch (e) {
        console.warn('Échec restauration projet:', project.id);
      }
    }
    
    return restored;
    
  } catch (error) {
    console.error('Erreur restoreProjects:', error);
    throw error;
  }
};

/**
 * Nettoie les anciens projets
 * @param {string} userId - ID de l'utilisateur
 * @param {number} days - Âge maximum en jours
 * @returns {Promise<number>} Nombre de projets supprimés
 */
export const cleanupOldProjects = async (userId, days = 30) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const { projects } = await listProjects(userId, { limit: 1000 });
    
    let deleted = 0;
    for (const project of projects) {
      const updatedAt = new Date(project.updatedAt);
      if (updatedAt < cutoff && project.state === 'archived') {
        await deleteProject(project.id, userId);
        deleted++;
      }
    }
    
    return deleted;
    
  } catch (error) {
    console.error('Erreur cleanupOldProjects:', error);
    throw error;
  }
};

/**
 * Obtient les statistiques de stockage
 * @returns {Object} Statistiques
 */
export const getStorageStats = () => {
  return {
    ...storageStats,
    cacheSize: projectCache.size,
    cacheHitRate: storageStats.cacheHits + storageStats.cacheMisses > 0
      ? Math.round((storageStats.cacheHits / (storageStats.cacheHits + storageStats.cacheMisses)) * 100)
      : 0
  };
};

/**
 * Réinitialise le stockage (pour tests)
 */
export const resetStorage = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      
      request.onsuccess = () => {
        clearCache();
        storageStats = {
          totalProjects: 0,
          totalSize: 0,
          lastBackup: null,
          cacheHits: 0,
          cacheMisses: 0
        };
        resolve(true);
      };
      
      request.onerror = () => {
        reject(new Error('Erreur lors du reset'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
    
  } catch (error) {
    console.error('Erreur resetStorage:', error);
    throw error;
  }
};

// =============================
// EXPORT PAR DÉFAUT
// =============================
export default {
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  searchProjects,
  backupProjects,
  restoreProjects,
  cleanupOldProjects,
  getStorageStats,
  resetStorage
};

export const projectStorage = { saveProject, loadProject, deleteProject, listProjects, searchProjects, backupProjects, restoreProjects, cleanupOldProjects, getStorageStats, resetStorage };
