/**
 * Gestionnaire principal des projets Vibe-Coding
 * 
 * Rôle: Contrôleur principal des opérations sur les projets
 * Fonctions:
 * - createProject() : Créer un nouveau projet
 * - duplicateProject() : Dupliquer un projet existant
 * - renameProject() : Renommer un projet
 * - deleteProject() : Supprimer un projet
 * - getUserProjects() : Récupérer tous les projets d'un utilisateur
 * - getProjectById() : Récupérer un projet spécifique
 * - updateProject() : Mettre à jour un projet
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { generateProjectId, isValidId } from '../utils/idGenerator';
import { validateProject, validateProjectName, isProjectRunnable } from '../utils/projectValidator';
import * as projectStorage from '../storage/projectStorage';
import { projectLifecycle } from './projectLifecycle';

// =============================
// CONFIGURATION
// =============================

// Types de projets disponibles
export const PROJECT_TYPES = {
  REACT: 'react',
  REACT_NATIVE: 'react_native',
  NODE: 'node',
  HTML: 'html',
  UNKNOWN: 'unknown'
};

// États de projet
export const PROJECT_STATES = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  EDITING: 'editing',
  RUNNING: 'running',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

// Templates par défaut
const DEFAULT_TEMPLATES = {
  [PROJECT_TYPES.REACT]: 'react-base',
  [PROJECT_TYPES.REACT_NATIVE]: 'react-native-base',
  [PROJECT_TYPES.NODE]: 'node-base',
  [PROJECT_TYPES.HTML]: 'html-base'
};

// =============================
// CLASSE PROJECT MANAGER
// =============================

class ProjectManager {
  constructor() {
    this.projects = new Map(); // Cache mémoire
    this.userProjects = new Map(); // Cache par utilisateur
    this.initialized = false;
  }

  /**
   * Initialise le gestionnaire
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Vérifier que le stockage est accessible
      await projectStorage.getStorageStats();
      this.initialized = true;
      console.log('✅ ProjectManager initialized');
    } catch (error) {
      console.error('❌ ProjectManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Crée un nouveau projet
   * @param {Object} params - Paramètres du projet
   * @param {string} params.name - Nom du projet
   * @param {string} params.userId - ID de l'utilisateur
   * @param {string} params.type - Type de projet (react, react_native, etc.)
   * @param {string} params.templateId - ID du template à utiliser (optionnel)
   * @param {Object} params.config - Configuration initiale (optionnel)
   * @returns {Promise<Object>} Projet créé
   */
  async createProject({ name, userId, type = PROJECT_TYPES.REACT, templateId = null, config = {} }) {
    try {
      // Validation
      if (!userId) throw new Error('userId requis');
      
      const nameValidation = validateProjectName(name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.errors.join(', '));
      }

      // Générer l'ID
      const projectId = generateProjectId();
      const now = new Date().toISOString();

      // Construire le projet
      const project = {
        id: projectId,
        name: name.trim(),
        userId,
        type,
        state: PROJECT_STATES.DRAFT,
        description: config.description || '',
        tags: config.tags || [],
        
        // Structure
        files: {},
        config: {
          packageJson: config.packageJson || this._getDefaultPackageJson(name, type),
          ...config
        },
        dependencies: config.dependencies || this._getDefaultDependencies(type),
        assets: {},
        
        // Métadonnées
        templateId: templateId || DEFAULT_TEMPLATES[type],
        version: '0.1.0',
        
        // Timeline
        createdAt: now,
        updatedAt: now,
        lastOpened: now,
        
        // Statistiques
        stats: {
          fileCount: 0,
          lineCount: 0,
          size: 0
        }
      };

      // Sauvegarder
      const saved = await projectStorage.saveProject(project, userId);
      
      // Mettre en cache
      this.projects.set(projectId, saved);
      
      if (!this.userProjects.has(userId)) {
        this.userProjects.set(userId, new Set());
      }
      this.userProjects.get(userId).add(projectId);

      return saved;

    } catch (error) {
      console.error('Erreur createProject:', error);
      throw error;
    }
  }

  /**
   * Duplique un projet existant
   * @param {string} projectId - ID du projet à dupliquer
   * @param {string} userId - ID de l'utilisateur
   * @param {string} newName - Nouveau nom (optionnel)
   * @returns {Promise<Object>} Projet dupliqué
   */
  async duplicateProject(projectId, userId, newName = null) {
    try {
      // Charger le projet original
      const original = await this.getProjectById(projectId, userId);
      if (!original) {
        throw new Error('Projet non trouvé');
      }

      // Générer nouveau nom
      const baseName = newName || `${original.name} (copie)`;
      
      // Créer la copie
      const copy = await this.createProject({
        name: baseName,
        userId,
        type: original.type,
        templateId: original.templateId,
        config: {
          ...original.config,
          description: `Copie de ${original.name}`
        }
      });

      // Copier les fichiers importants
      if (original.files) {
        copy.files = { ...original.files };
        await this.updateProject(copy.id, { files: copy.files }, userId);
      }

      return copy;

    } catch (error) {
      console.error('Erreur duplicateProject:', error);
      throw error;
    }
  }

  /**
   * Renomme un projet
   * @param {string} projectId - ID du projet
   * @param {string} newName - Nouveau nom
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Projet mis à jour
   */
  async renameProject(projectId, newName, userId) {
    try {
      const nameValidation = validateProjectName(newName);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.errors.join(', '));
      }

      return await this.updateProject(projectId, { name: newName.trim() }, userId);

    } catch (error) {
      console.error('Erreur renameProject:', error);
      throw error;
    }
  }

  /**
   * Supprime un projet
   * @param {string} projectId - ID du projet
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<boolean>} True si supprimé
   */
  async deleteProject(projectId, userId) {
    try {
      const result = await projectStorage.deleteProject(projectId, userId);
      
      if (result) {
        // Nettoyer le cache
        this.projects.delete(projectId);
        const userSet = this.userProjects.get(userId);
        if (userSet) {
          userSet.delete(projectId);
          if (userSet.size === 0) {
            this.userProjects.delete(userId);
          }
        }
      }
      
      return result;

    } catch (error) {
      console.error('Erreur deleteProject:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les projets d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options de filtrage/pagination
   * @returns {Promise<Array>} Liste des projets
   */
  async getUserProjects(userId, options = {}) {
    try {
      const result = await projectStorage.listProjects(userId, options);
      
      // Mettre à jour le cache
      result.projects.forEach(project => {
        this.projects.set(project.id, project);
      });
      
      return result;

    } catch (error) {
      console.error('Erreur getUserProjects:', error);
      throw error;
    }
  }

  /**
   * Récupère un projet par son ID
   * @param {string} projectId - ID du projet
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Projet
   */
  async getProjectById(projectId, userId) {
    try {
      // Vérifier le cache
      if (this.projects.has(projectId)) {
        const cached = this.projects.get(projectId);
        // Vérifier que l'utilisateur a le droit
        if (cached.userId === userId) {
          return cached;
        }
      }

      // Charger depuis le stockage
      const project = await projectStorage.loadProject(projectId, userId);
      
      if (project) {
        this.projects.set(projectId, project);
      }
      
      return project;

    } catch (error) {
      console.error('Erreur getProjectById:', error);
      throw error;
    }
  }

  /**
   * Met à jour un projet
   * @param {string} projectId - ID du projet
   * @param {Object} updates - Mises à jour
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Projet mis à jour
   */
  async updateProject(projectId, updates, userId) {
    try {
      // Charger le projet
      const project = await this.getProjectById(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      // Appliquer les mises à jour
      const updated = {
        ...project,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Re-valider si nécessaire
      if (updates.name || updates.type || updates.files) {
        const validation = validateProject(updated);
        if (!validation.isValid) {
          throw new Error('Projet invalide après modifications');
        }
      }

      // Sauvegarder
      const saved = await projectStorage.saveProject(updated, userId);
      
      // Mettre à jour le cache
      this.projects.set(projectId, saved);

      return saved;

    } catch (error) {
      console.error('Erreur updateProject:', error);
      throw error;
    }
  }

  /**
   * Change l'état d'un projet
   * @param {string} projectId - ID du projet
   * @param {string} newState - Nouvel état
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Projet mis à jour
   */
  async changeProjectState(projectId, newState, userId) {
    try {
      const project = await this.getProjectById(projectId, userId);
      
      // Vérifier la transition
      const transition = projectLifecycle.canTransition(project.state, newState);
      if (!transition.allowed) {
        throw new Error(transition.reason || 'Transition d\'état invalide');
      }

      // Actions spécifiques à l'état
      if (newState === PROJECT_STATES.RUNNING) {
        // Vérifier que le projet est exécutable
        if (!isProjectRunnable(project)) {
          throw new Error('Le projet n\'est pas prêt à être exécuté');
        }
      }

      return await this.updateProject(projectId, { state: newState }, userId);

    } catch (error) {
      console.error('Erreur changeProjectState:', error);
      throw error;
    }
  }

  /**
   * Recherche des projets
   * @param {string} userId - ID de l'utilisateur
   * @param {string} query - Terme de recherche
   * @param {Object} options - Options
   * @returns {Promise<Array>} Projets trouvés
   */
  async searchProjects(userId, query, options = {}) {
    try {
      return await projectStorage.searchProjects(userId, query, options);
    } catch (error) {
      console.error('Erreur searchProjects:', error);
      throw error;
    }
  }

  /**
   * Archive un projet
   * @param {string} projectId - ID du projet
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Projet archivé
   */
  async archiveProject(projectId, userId) {
    return await this.changeProjectState(projectId, PROJECT_STATES.ARCHIVED, userId);
  }

  /**
   * Restaure un projet depuis l'archive
   * @param {string} projectId - ID du projet
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Projet restauré
   */
  async restoreProject(projectId, userId) {
    return await this.changeProjectState(projectId, PROJECT_STATES.EDITING, userId);
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.projects.clear();
    this.userProjects.clear();
  }

  // =============================
  // FONCTIONS PRIVÉES
  // =============================

  /**
   * Génère un package.json par défaut
   * @private
   */
  _getDefaultPackageJson(name, type) {
    const base = {
      name: name.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true
    };

    switch (type) {
      case PROJECT_TYPES.REACT:
        return {
          ...base,
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1'
          },
          scripts: {
            'start': 'react-scripts start',
            'build': 'react-scripts build',
            'test': 'react-scripts test'
          }
        };
      
      case PROJECT_TYPES.REACT_NATIVE:
        return {
          ...base,
          dependencies: {
            'react': '18.2.0',
            'react-native': '0.72.0'
          }
        };
      
      case PROJECT_TYPES.NODE:
        return {
          ...base,
          dependencies: {},
          scripts: {
            'start': 'node index.js'
          }
        };
      
      default:
        return base;
    }
  }

  /**
   * Génère les dépendances par défaut
   * @private
   */
  _getDefaultDependencies(type) {
    switch (type) {
      case PROJECT_TYPES.REACT:
        return {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        };
      case PROJECT_TYPES.REACT_NATIVE:
        return {
          'react': '18.2.0',
          'react-native': '0.72.0'
        };
      default:
        return {};
    }
  }
}

// =============================
// EXPORT (SINGLETON)
// =============================
export const projectManager = new ProjectManager();

// Initialisation automatique
if (typeof window !== 'undefined') {
  projectManager.initialize().catch(console.error);
}

export default projectManager;
