/**
 * Service de gestion des projets pour le module Vibe-Coding
 * 
 * Rôle: Interface entre le frontend et les projets
 * - CRUD des projets
 * - Gestion des accès et permissions
 * - Statistiques et métriques
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useState, useEffect, useCallback, useRef } from 'react';
import { projectManager } from '../core/projectManager';
import { projectStorage } from '../storage/projectStorage';
import { permissionService } from './permissionService';
import { generateProjectId } from '../utils/idGenerator';

// =============================
// CONFIGURATION
// =============================

const PROJECT_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  EDITING: 'editing',
  RUNNING: 'running',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Schéma de validation
const PROJECT_SCHEMA = {
  name: { type: 'string', required: true, maxLength: 100 },
  description: { type: 'string', maxLength: 500 },
  type: { type: 'string', required: true, enum: ['react', 'react-native', 'node', 'html', 'vue', 'angular'] },
  files: { type: 'object' },
  config: { type: 'object' },
  tags: { type: 'array', items: { type: 'string' } }
};

// =============================
// SERVICE PROJET
// =============================

class ProjectService {
  constructor() {
    this.initialized = false;
    this.projectCache = new Map(); // id -> { project, timestamp }
    this.listCache = new Map(); // cache des listes (récents, favoris)
    this.eventListeners = new Map();
  }

  /**
   * Initialise le service
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.initialized = true;
      console.log('✅ ProjectService initialized');
    } catch (error) {
      console.error('❌ ProjectService initialization failed:', error);
      throw error;
    }
  }

  // =============================
  // VALIDATION
  // =============================

  /**
   * Valide les données d'un projet
   */
  validateProject(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate || data.name !== undefined) {
      if (!data.name) errors.push('Le nom est requis');
      else if (data.name.length > PROJECT_SCHEMA.name.maxLength) {
        errors.push(`Le nom ne doit pas dépasser ${PROJECT_SCHEMA.name.maxLength} caractères`);
      }
    }

    if (data.description && data.description.length > PROJECT_SCHEMA.description.maxLength) {
      errors.push(`La description ne doit pas dépasser ${PROJECT_SCHEMA.description.maxLength} caractères`);
    }

    if (!isUpdate || data.type !== undefined) {
      if (!data.type) errors.push('Le type est requis');
      else if (!PROJECT_SCHEMA.type.enum.includes(data.type)) {
        errors.push(`Type invalide: ${data.type}`);
      }
    }

    if (data.tags && !Array.isArray(data.tags)) {
      errors.push('Les tags doivent être un tableau');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // =============================
  // GESTION DU CACHE
  // =============================

  /**
   * Récupère du cache projet
   */
  _getFromCache(projectId) {
    const cached = this.projectCache.get(projectId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.projectCache.delete(projectId);
      return null;
    }

    return cached.project;
  }

  /**
   * Stocke dans le cache projet
   */
  _setCache(projectId, project) {
    // Éviction LRU si nécessaire
    if (this.projectCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.projectCache.keys().next().value;
      this.projectCache.delete(oldestKey);
    }

    this.projectCache.set(projectId, {
      project,
      timestamp: Date.now()
    });
  }

  /**
   * Invalide le cache projet et les listes associées
   */
  _invalidateCache(projectId) {
    this.projectCache.delete(projectId);
    this.listCache.clear(); // Invalide toutes les listes
  }

  // =============================
  // ÉVÉNEMENTS
  // =============================

  /**
   * Ajoute un écouteur d'événement
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Supprime un écouteur
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  /**
   * Émet un événement
   */
  _emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          console.error(`Erreur dans l'écouteur ${event}:`, error);
        }
      });
    }
  }

  // =============================
  // CRUD PRINCIPAL
  // =============================

  /**
   * Crée un nouveau projet
   */
  async createProject(userId, projectData) {
    try {
      // Valider les données
      const validation = this.validateProject(projectData);
      if (!validation.valid) {
        throw new Error(`Données invalides: ${validation.errors.join(', ')}`);
      }

      // Vérifier les permissions
      const canCreate = await permissionService.checkPermission(userId, 'project:create');
      if (!canCreate) {
        throw new Error('Permission refusée pour créer un projet');
      }

      // Générer l'ID
      const projectId = generateProjectId();
      
      // Structure de base
      const project = {
        id: projectId,
        userId,
        name: projectData.name || 'Nouveau projet',
        description: projectData.description || '',
        type: projectData.type || 'react',
        status: PROJECT_STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        files: projectData.files || {},
        config: projectData.config || {},
        metadata: {
          template: projectData.template,
          generatedFrom: projectData.generatedFrom,
          tags: projectData.tags || [],
          favorite: false,
          stats: null // Pour cache des stats
        }
      };

      // Sauvegarder
      const saved = await projectStorage.saveProject(project, userId);
      
      // Mettre en cache
      this._setCache(projectId, saved);

      this._emit('project:created', { projectId, userId });

      return saved;

    } catch (error) {
      console.error('❌ Erreur createProject:', error);
      throw new Error(`Création impossible: ${error.message}`);
    }
  }

  /**
   * Récupère un projet par son ID
   */
  async getProject(projectId, userId) {
    try {
      if (!projectId || !userId) {
        throw new Error('projectId et userId requis');
      }

      // Vérifier le cache
      const cached = this._getFromCache(projectId);
      if (cached && cached.userId === userId) {
        return cached;
      }

      // Charger depuis le storage
      const project = await projectStorage.loadProject(projectId, userId);
      
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      // Mettre en cache
      this._setCache(projectId, project);

      return project;

    } catch (error) {
      console.error('❌ Erreur getProject:', error);
      throw new Error(`Chargement impossible: ${error.message}`);
    }
  }

  /**
   * Met à jour un projet
   */
  async updateProject(projectId, userId, updates) {
    try {
      if (!projectId || !userId) {
        throw new Error('projectId et userId requis');
      }

      // Valider les mises à jour
      const validation = this.validateProject(updates, true);
      if (!validation.valid) {
        throw new Error(`Données invalides: ${validation.errors.join(', ')}`);
      }

      // Vérifier les permissions
      const canEdit = await permissionService.checkPermission(userId, 'project:edit', projectId);
      if (!canEdit) {
        throw new Error('Permission refusée pour modifier ce projet');
      }

      // Récupérer le projet existant
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      // Appliquer les mises à jour
      const updated = {
        ...project,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Sauvegarder
      const saved = await projectStorage.saveProject(updated, userId);
      
      // Mettre à jour le cache
      this._setCache(projectId, saved);
      this.listCache.clear(); // Invalider les listes

      this._emit('project:updated', { projectId, userId, updates: Object.keys(updates) });

      return saved;

    } catch (error) {
      console.error('❌ Erreur updateProject:', error);
      throw new Error(`Mise à jour impossible: ${error.message}`);
    }
  }

  /**
   * Supprime un projet
   */
  async deleteProject(projectId, userId) {
    try {
      if (!projectId || !userId) {
        throw new Error('projectId et userId requis');
      }

      // Vérifier les permissions
      const canDelete = await permissionService.checkPermission(userId, 'project:delete', projectId);
      if (!canDelete) {
        throw new Error('Permission refusée pour supprimer ce projet');
      }

      // Supprimer
      await projectStorage.deleteProject(projectId, userId);
      
      // Nettoyer le cache
      this._invalidateCache(projectId);

      this._emit('project:deleted', { projectId, userId });

      return { success: true };

    } catch (error) {
      console.error('❌ Erreur deleteProject:', error);
      throw new Error(`Suppression impossible: ${error.message}`);
    }
  }

  // =============================
  // LISTES ET RECHERCHE
  // =============================

  /**
   * Liste les projets d'un utilisateur
   */
  async listUserProjects(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        status,
        type,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = options;

      const result = await projectStorage.listProjects(userId, {
        limit,
        offset,
        status,
        type,
        sortBy,
        sortOrder
      });

      // Mettre à jour le cache
      result.projects.forEach(project => {
        this._setCache(project.id, project);
      });

      return result;

    } catch (error) {
      console.error('❌ Erreur listUserProjects:', error);
      throw new Error(`Liste impossible: ${error.message}`);
    }
  }

  /**
   * Recherche des projets
   */
  async searchProjects(userId, query, options = {}) {
    try {
      if (!query || query.trim().length < 2) {
        return { projects: [], total: 0 };
      }

      const { limit = 20 } = options;
      return await projectStorage.searchProjects(userId, query, { limit });

    } catch (error) {
      console.error('❌ Erreur searchProjects:', error);
      throw new Error(`Recherche impossible: ${error.message}`);
    }
  }

  /**
   * Récupère les projets récents
   */
  async getRecentProjects(userId, limit = 10) {
    try {
      // Vérifier le cache des listes
      const cacheKey = `recent_${userId}_${limit}`;
      const cached = this.listCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.projects;
      }

      const { projects } = await this.listUserProjects(userId, {
        limit,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      });

      // Mettre en cache
      this.listCache.set(cacheKey, {
        projects,
        timestamp: Date.now()
      });

      return projects;

    } catch (error) {
      console.error('❌ Erreur getRecentProjects:', error);
      throw new Error(`Impossible de récupérer les projets récents: ${error.message}`);
    }
  }

  /**
   * Récupère les projets favoris
   */
  async getFavoriteProjects(userId) {
    try {
      // Vérifier le cache des listes
      const cacheKey = `favorites_${userId}`;
      const cached = this.listCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.projects;
      }

      const { projects } = await this.listUserProjects(userId, { limit: 100 });
      const favorites = projects.filter(p => p.metadata?.favorite);

      // Mettre en cache
      this.listCache.set(cacheKey, {
        projects: favorites,
        timestamp: Date.now()
      });

      return favorites;

    } catch (error) {
      console.error('❌ Erreur getFavoriteProjects:', error);
      throw new Error(`Impossible de récupérer les favoris: ${error.message}`);
    }
  }

  // =============================
  // OPÉRATIONS SUR LES PROJETS
  // =============================

  /**
   * Clone un projet (avec deep copy)
   */
  async cloneProject(projectId, userId, newName = null) {
    try {
      // Récupérer le projet original
      const original = await this.getProject(projectId, userId);
      if (!original) {
        throw new Error('Projet original non trouvé');
      }

      // Deep copy des fichiers et config
      const filesCopy = original.files ? JSON.parse(JSON.stringify(original.files)) : {};
      const configCopy = original.config ? JSON.parse(JSON.stringify(original.config)) : {};

      // Créer une copie
      const clone = await this.createProject(userId, {
        name: newName || `${original.name} (copie)`,
        description: original.description,
        type: original.type,
        files: filesCopy,
        config: configCopy,
        template: original.metadata?.template,
        tags: original.metadata?.tags || []
      });

      this._emit('project:cloned', { originalId: projectId, cloneId: clone.id, userId });

      return clone;

    } catch (error) {
      console.error('❌ Erreur cloneProject:', error);
      throw new Error(`Clonage impossible: ${error.message}`);
    }
  }

  /**
   * Archive un projet
   */
  async archiveProject(projectId, userId) {
    try {
      const result = await this.updateProject(projectId, userId, {
        status: PROJECT_STATUS.ARCHIVED
      });

      this._emit('project:archived', { projectId, userId });

      return result;

    } catch (error) {
      console.error('❌ Erreur archiveProject:', error);
      throw new Error(`Archivage impossible: ${error.message}`);
    }
  }

  /**
   * Restaure un projet archivé
   */
  async restoreProject(projectId, userId) {
    try {
      const result = await this.updateProject(projectId, userId, {
        status: PROJECT_STATUS.DRAFT
      });

      this._emit('project:restored', { projectId, userId });

      return result;

    } catch (error) {
      console.error('❌ Erreur restoreProject:', error);
      throw new Error(`Restauration impossible: ${error.message}`);
    }
  }

  /**
   * Marque un projet comme favori
   */
  async toggleFavorite(projectId, userId) {
    try {
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      const isFavorite = project.metadata?.favorite || false;
      
      const result = await this.updateProject(projectId, userId, {
        metadata: {
          ...project.metadata,
          favorite: !isFavorite
        }
      });

      // Invalider le cache des favoris
      this.listCache.delete(`favorites_${userId}`);

      this._emit('project:favorite', { 
        projectId, 
        userId, 
        favorite: !isFavorite 
      });

      return result;

    } catch (error) {
      console.error('❌ Erreur toggleFavorite:', error);
      throw new Error(`Impossible de modifier le favori: ${error.message}`);
    }
  }

  // =============================
  // STATISTIQUES
  // =============================

  /**
   * Récupère les statistiques d'un projet
   */
  async getProjectStats(projectId, userId) {
    try {
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      // Vérifier si les stats sont en cache dans metadata
      if (project.metadata?.stats && Date.now() - project.metadata.stats.timestamp < CACHE_TTL) {
        return project.metadata.stats.data;
      }

      const files = project.files || {};
      let totalSize = 0;
      let totalLines = 0;
      const extensions = {};

      Object.entries(files).forEach(([path, content]) => {
        const size = content?.length || 0;
        totalSize += size;
        totalLines += (content?.split('\n').length || 0);
        
        const ext = path.split('.').pop();
        if (ext) {
          extensions[ext] = (extensions[ext] || 0) + 1;
        }
      });

      const stats = {
        projectId,
        name: project.name,
        type: project.type,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        filesCount: Object.keys(files).length,
        totalSize,
        totalSizeFormatted: this._formatSize(totalSize),
        totalLines,
        averageFileSize: Object.keys(files).length > 0 
          ? Math.round(totalSize / Object.keys(files).length) 
          : 0,
        extensions
      };

      // Mettre en cache dans metadata
      await this.updateProject(projectId, userId, {
        metadata: {
          ...project.metadata,
          stats: {
            data: stats,
            timestamp: Date.now()
          }
        }
      });

      return stats;

    } catch (error) {
      console.error('❌ Erreur getProjectStats:', error);
      throw new Error(`Statistiques indisponibles: ${error.message}`);
    }
  }

  /**
   * Récupère les statistiques globales de l'utilisateur
   */
  async getUserStats(userId) {
    try {
      const { projects } = await this.listUserProjects(userId, { limit: 1000 });
      
      const stats = {
        totalProjects: projects.length,
        byStatus: {},
        byType: {},
        totalFiles: 0,
        totalSize: 0,
        activeProjects: 0,
        archivedProjects: 0,
        favoriteProjects: 0
      };

      projects.forEach(project => {
        // Par statut
        stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1;
        
        // Par type
        stats.byType[project.type] = (stats.byType[project.type] || 0) + 1;

        // Fichiers et taille
        const filesCount = Object.keys(project.files || {}).length;
        stats.totalFiles += filesCount;

        // Calculer la taille
        Object.values(project.files || {}).forEach(content => {
          stats.totalSize += content?.length || 0;
        });

        // Stats spéciales
        if (project.status === PROJECT_STATUS.ARCHIVED) {
          stats.archivedProjects++;
        } else {
          stats.activeProjects++;
        }

        if (project.metadata?.favorite) {
          stats.favoriteProjects++;
        }
      });

      stats.totalSizeFormatted = this._formatSize(stats.totalSize);
      stats.averageProjectSize = stats.totalProjects > 0 
        ? this._formatSize(Math.round(stats.totalSize / stats.totalProjects))
        : '0 B';

      return stats;

    } catch (error) {
      console.error('❌ Erreur getUserStats:', error);
      throw new Error(`Statistiques utilisateur indisponibles: ${error.message}`);
    }
  }

  // =============================
  // UTILITAIRES
  // =============================

  /**
   * Formate la taille
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.projectCache.clear();
    this.listCache.clear();
    console.log('🧹 Cache projet vidé');
  }

    /**
   * Rafraîchit un projet dans le cache
   */
  async refreshProject(projectId, userId) {
    try {
      const project = await projectStorage.loadProject(projectId, userId);
      if (project) {
        this._setCache(projectId, project);
      }
      return project;

    } catch (error) {
      console.error('❌ Erreur refreshProject:', error);
      throw new Error(`Rafraîchissement impossible: ${error.message}`);
    }
  }

  // =============================
  // EXPORT / IMPORT
  // =============================

  /**
   * Exporte un projet au format JSON
   */
  async exportProject(projectId, userId) {
    try {
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      // Nettoyer les données sensibles
      const exportData = {
        ...project,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      delete exportData.userId; // Ne pas exporter l'ID utilisateur
      delete exportData._id; // Si présent

      return exportData;

    } catch (error) {
      console.error('❌ Erreur exportProject:', error);
      throw new Error(`Export impossible: ${error.message}`);
    }
  }

  /**
   * Importe un projet depuis JSON
   */
  async importProject(userId, importData) {
    try {
      // Valider les données
      if (!importData.name || !importData.type) {
        throw new Error('Données de projet invalides');
      }

      // Créer le projet
      const project = await this.createProject(userId, {
        name: importData.name,
        description: importData.description || '',
        type: importData.type,
        files: importData.files || {},
        config: importData.config || {},
        tags: importData.metadata?.tags || [],
        template: importData.metadata?.template,
        importedFrom: importData.exportedAt
      });

      this._emit('project:imported', { 
        projectId: project.id, 
        userId,
        originalName: importData.name 
      });

      return project;

    } catch (error) {
      console.error('❌ Erreur importProject:', error);
      throw new Error(`Import impossible: ${error.message}`);
    }
  }
    }
// =============================
// HOOK PERSONNALISÉ (avec mounted)
// =============================
export const useProjectService = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const service = useRef(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const instance = new ProjectService();
      await instance.initialize();

      if (!mounted) return;

      service.current = instance;
      setInitialized(true);
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const createProject = useCallback(async (userId, data) => {
    if (!initialized) throw new Error('Service non initialisé');
    
    setLoading(true);
    setError(null);
    try {
      return await service.current.createProject(userId, data);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const getProject = useCallback(async (projectId, userId) => {
    if (!initialized) throw new Error('Service non initialisé');
    
    setLoading(true);
    setError(null);
    try {
      return await service.current.getProject(projectId, userId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const updateProject = useCallback(async (projectId, userId, updates) => {
    if (!initialized) throw new Error('Service non initialisé');
    
    setLoading(true);
    setError(null);
    try {
      return await service.current.updateProject(projectId, userId, updates);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const deleteProject = useCallback(async (projectId, userId) => {
    if (!initialized) throw new Error('Service non initialisé');
    
    setLoading(true);
    setError(null);
    try {
      return await service.current.deleteProject(projectId, userId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const listUserProjects = useCallback(async (userId, options) => {
    if (!initialized) throw new Error('Service non initialisé');
    
    setLoading(true);
    setError(null);
    try {
      return await service.current.listUserProjects(userId, options);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  return {
    loading,
    error,
    initialized,
    createProject,
    getProject,
    updateProject,
    deleteProject,
    listUserProjects,
    searchProjects: useCallback((userId, query, options) => 
      service.current?.searchProjects(userId, query, options), [initialized]),
    getRecentProjects: useCallback((userId, limit) => 
      service.current?.getRecentProjects(userId, limit), [initialized]),
    getFavoriteProjects: useCallback((userId) => 
      service.current?.getFavoriteProjects(userId), [initialized]),
    toggleFavorite: useCallback((projectId, userId) => 
      service.current?.toggleFavorite(projectId, userId), [initialized]),
    cloneProject: useCallback((projectId, userId, newName) => 
      service.current?.cloneProject(projectId, userId, newName), [initialized]),
    archiveProject: useCallback((projectId, userId) => 
      service.current?.archiveProject(projectId, userId), [initialized]),
    restoreProject: useCallback((projectId, userId) => 
      service.current?.restoreProject(projectId, userId), [initialized]),
    getProjectStats: useCallback((projectId, userId) => 
      service.current?.getProjectStats(projectId, userId), [initialized]),
    getUserStats: useCallback((userId) => 
      service.current?.getUserStats(userId), [initialized]),
    exportProject: useCallback((projectId, userId) => 
      service.current?.exportProject(projectId, userId), [initialized]),
    importProject: useCallback((userId, data) => 
      service.current?.importProject(userId, data), [initialized]),
    on: useCallback((event, callback) => 
      service.current?.on(event, callback), [initialized])
  };
};

// =============================
// EXPORT (SINGLETON)
// =============================
export const projectService = new ProjectService();
export default projectService;
