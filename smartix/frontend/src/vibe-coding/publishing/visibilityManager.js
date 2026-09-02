/**
 * Gestionnaire de visibilité pour le module Vibe-Coding
 * 
 * Rôle: Gérer la visibilité des projets publiés
 * - Public / Privé
 * - Marketplace
 * - Team / Organisation
 * - Permissions d'accès
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useState, useEffect, useCallback } from 'react';
import { projectManager } from '../core/projectManager';
import { permissionService } from '../services/permissionService';
import { crypto } from '../utils/crypto';

// =============================
// CONFIGURATION
// =============================

const BASE_URL = process.env.APP_URL || 'https://app.smartix.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Niveaux de visibilité
export const VISIBILITY_LEVELS = {
  PRIVATE: 'private',
  TEAM: 'team',
  ORGANIZATION: 'organization',
  PUBLIC: 'public',
  MARKETPLACE: 'marketplace'
};

// Descriptions des niveaux
export const VISIBILITY_DESCRIPTIONS = {
  [VISIBILITY_LEVELS.PRIVATE]: 'Visible uniquement par vous',
  [VISIBILITY_LEVELS.TEAM]: 'Visible par votre équipe',
  [VISIBILITY_LEVELS.ORGANIZATION]: 'Visible par votre organisation',
  [VISIBILITY_LEVELS.PUBLIC]: 'Visible par tout le monde (lien public)',
  [VISIBILITY_LEVELS.MARKETPLACE]: 'Publié sur le marketplace Smartix'
};

// Icônes pour l'UI
export const VISIBILITY_ICONS = {
  [VISIBILITY_LEVELS.PRIVATE]: '🔒',
  [VISIBILITY_LEVELS.TEAM]: '👥',
  [VISIBILITY_LEVELS.ORGANIZATION]: '🏢',
  [VISIBILITY_LEVELS.PUBLIC]: '🌍',
  [VISIBILITY_LEVELS.MARKETPLACE]: '🛒'
};

// Couleurs pour l'UI
export const VISIBILITY_COLORS = {
  [VISIBILITY_LEVELS.PRIVATE]: '#f44336',
  [VISIBILITY_LEVELS.TEAM]: '#ff9800',
  [VISIBILITY_LEVELS.ORGANIZATION]: '#2196f3',
  [VISIBILITY_LEVELS.PUBLIC]: '#4caf50',
  [VISIBILITY_LEVELS.MARKETPLACE]: '#9c27b0'
};

// =============================
// TEAM SERVICE SIMULÉ
// =============================

// Simule un service d'équipe (à remplacer par un vrai service)
const teamService = {
  async getUserTeams(userId) {
    // TODO: Appel API réel
    return [
      { id: 'team_1', name: 'Équipe Mobile', role: 'developer' }
    ];
  },

  async getTeamMembers(teamId) {
    // TODO: Appel API réel
    return [
      { id: 'user_1', name: 'Alice', role: 'lead' },
      { id: 'user_2', name: 'Bob', role: 'developer' }
    ];
  },

  async isUserInTeam(userId, teamId) {
    const members = await this.getTeamMembers(teamId);
    return members.some(m => m.id === userId);
  },

  async getUserOrganizations(userId) {
    // TODO: Appel API réel
    return [
      { id: 'org_1', name: 'Smartix', role: 'member' }
    ];
  },

  async getOrganizationMembers(orgId) {
    // TODO: Appel API réel
    return [
      { id: 'user_1', name: 'Alice', role: 'admin' },
      { id: 'user_2', name: 'Bob', role: 'member' },
      { id: 'user_3', name: 'Charlie', role: 'member' }
    ];
  },

  async isUserInOrganization(userId, orgId) {
    const members = await this.getOrganizationMembers(orgId);
    return members.some(m => m.id === userId);
  }
};

// =============================
// MARKETPLACE SERVICE SIMULÉ
// =============================

const marketplaceService = {
  async checkPublishPermissions(projectId, userId) {
    // TODO: Vérifier si l'utilisateur a un compte validé, des crédits, etc.
    return {
      canPublish: true,
      reasons: [],
      requirements: [
        'Compte développeur vérifié',
        'Politique de confidentialité',
        'Captures d\'écran'
      ]
    };
  },

  async getPublishRequirements(store = 'internal') {
    return {
      requiredFields: ['name', 'description', 'screenshots', 'icon'],
      maxSize: 100 * 1024 * 1024,
      reviewTime: '24-48h'
    };
  }
};

// =============================
// CLASSE VISIBILITY MANAGER
// =============================

class VisibilityManager {
  constructor() {
    this.initialized = false;
    this.currentUser = null;
    this.visibilityCache = new Map();
    this.shareTokens = new Map(); // Stockage des tokens actifs
    this.maxCacheSize = MAX_CACHE_SIZE;
  }

  /**
   * Initialise le gestionnaire
   */
  async initialize(userId) {
    if (this.initialized && this.currentUser?.id === userId) return;

    try {
      // Initialiser crypto si nécessaire
      await crypto.initialize();

      // Charger les informations de l'utilisateur
      const user = await this._fetchUser(userId);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      this.currentUser = user;
      this.initialized = true;

      // Charger les équipes/organisations de l'utilisateur
      await this._loadUserContext(userId);

      console.log(`✅ VisibilityManager initialisé pour ${userId}`);
    } catch (error) {
      console.error('❌ VisibilityManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Charge le contexte utilisateur (équipes, organisations)
   * @private
   */
  async _loadUserContext(userId) {
    this.userTeams = await teamService.getUserTeams(userId);
    this.userOrganizations = await teamService.getUserOrganizations(userId);
  }

  /**
   * Récupère les informations utilisateur
   * @private
   */
  async _fetchUser(userId) {
    // TODO: Appel API réel
    return {
      id: userId,
      name: 'Utilisateur',
      email: 'user@example.com'
    };
  }

  /**
   * Définit la visibilité d'un projet
   */
  async setVisibility(projectId, visibility, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('VisibilityManager non initialisé');
      }

      if (!this.currentUser) {
        throw new Error('Utilisateur non connecté');
      }

      const project = await projectManager.getProjectById(projectId, this.currentUser.id);

      if (!project) {
        throw new Error('Projet non trouvé');
      }

      const hasPermission = await this._checkVisibilityPermission(project, visibility);
      if (!hasPermission) {
        throw new Error(`Vous n'avez pas la permission de définir la visibilité ${visibility}`);
      }

      if (!Object.values(VISIBILITY_LEVELS).includes(visibility)) {
        throw new Error(`Niveau de visibilité invalide: ${visibility}`);
      }

      // Appliquer les règles spécifiques
      const validationResult = await this._applyVisibilityRules(project, visibility, options);
      if (!validationResult.valid) {
        throw new Error(validationResult.error);
      }

      const updatedProject = await projectManager.updateProject(
        projectId,
        {
          visibility,
          visibilityUpdatedAt: new Date().toISOString(),
          visibilityMetadata: {
            ...options,
            setBy: this.currentUser.id,
            setAt: new Date().toISOString(),
            teamId: options.teamId,
            organizationId: options.organizationId
          }
        },
        this.currentUser.id
      );

      // Mettre en cache
      this._setCache(projectId, {
        visibility,
        updatedAt: Date.now(),
        metadata: options
      });

      // Générer les URLs selon la visibilité
      const urls = {};
      if (visibility === VISIBILITY_LEVELS.PUBLIC) {
        urls.publicUrl = this._generatePublicUrl(projectId);
      }
      if (visibility === VISIBILITY_LEVELS.MARKETPLACE) {
        urls.marketplaceUrl = this._generateMarketplaceUrl(projectId);
      }

      await this._notifyVisibilityChange(projectId, visibility, options);

      return {
        success: true,
        projectId,
        visibility,
        ...urls
      };

    } catch (error) {
      console.error('❌ Erreur setVisibility:', error);
      throw error;
    }
  }

  /**
   * Récupère la visibilité d'un projet
   */
  async getVisibility(projectId) {
    try {
      // Vérifier le cache
      const cached = this._getFromCache(projectId);
      if (cached) {
        return cached.visibility;
      }

      const project = await projectManager.getProjectById(projectId, this.currentUser?.id);
      
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      const visibility = project.visibility || VISIBILITY_LEVELS.PRIVATE;

      // Mettre en cache
      this._setCache(projectId, {
        visibility,
        updatedAt: Date.now(),
        metadata: project.visibilityMetadata
      });

      return visibility;

    } catch (error) {
      console.error('❌ Erreur getVisibility:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un projet est accessible par un utilisateur
   */
  async canAccess(projectId, userId) {
    try {
      // Si même utilisateur, accès direct
      if (this.currentUser?.id === userId) {
        return true;
      }

      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) return false;

      const visibility = project.visibility || VISIBILITY_LEVELS.PRIVATE;

      // Propriétaire du projet
      if (project.userId === userId) return true;

      switch (visibility) {
        case VISIBILITY_LEVELS.PUBLIC:
        case VISIBILITY_LEVELS.MARKETPLACE:
          return true;

        case VISIBILITY_LEVELS.TEAM:
          if (!project.teamId) return false;
          return await teamService.isUserInTeam(userId, project.teamId);

        case VISIBILITY_LEVELS.ORGANIZATION:
          if (!project.organizationId) return false;
          return await teamService.isUserInOrganization(userId, project.organizationId);

        default:
          return false;
      }

    } catch (error) {
      console.error('❌ Erreur canAccess:', error);
      return false;
    }
  }

  /**
   * Récupère la liste des utilisateurs autorisés
   */
  async getAllowedUsers(projectId) {
    try {
      const visibility = await this.getVisibility(projectId);
      const project = await projectManager.getProjectById(projectId, this.currentUser?.id);

      const users = [];

      switch (visibility) {
        case VISIBILITY_LEVELS.PRIVATE:
          users.push({
            id: project.userId,
            role: 'owner',
            access: 'full'
          });
          break;

        case VISIBILITY_LEVELS.TEAM:
          if (project.teamId) {
            const teamMembers = await teamService.getTeamMembers(project.teamId);
            users.push(...teamMembers.map(m => ({
              id: m.id,
              name: m.name,
              role: m.role,
              access: m.role === 'admin' ? 'full' : 'read'
            })));
          }
          break;

        case VISIBILITY_LEVELS.ORGANIZATION:
          if (project.organizationId) {
            const orgMembers = await teamService.getOrganizationMembers(project.organizationId);
            users.push(...orgMembers.map(m => ({
              id: m.id,
              name: m.name,
              role: m.role,
              access: m.role === 'admin' ? 'full' : 'read'
            })));
          }
          break;

        case VISIBILITY_LEVELS.PUBLIC:
        case VISIBILITY_LEVELS.MARKETPLACE:
          users.push({
            id: '*',
            role: 'public',
            access: 'read'
          });
          break;
      }

      return users;

    } catch (error) {
      console.error('❌ Erreur getAllowedUsers:', error);
      throw error;
    }
  }

  /**
   * Vérifie les permissions de publication sur le marketplace
   */
  async canPublishToMarketplace(projectId) {
    try {
      if (!this.currentUser) {
        return { canPublish: false, error: 'Utilisateur non connecté' };
      }

      const project = await projectManager.getProjectById(projectId, this.currentUser.id);
      if (!project) {
        return { canPublish: false, error: 'Projet non trouvé' };
      }

      // Vérifier si l'utilisateur a les permissions
      const permissions = await marketplaceService.checkPublishPermissions(
        projectId,
        this.currentUser.id
      );

      // Vérifier si le projet a tous les champs requis
      const requirements = await marketplaceService.getPublishRequirements();
      const missingFields = requirements.requiredFields.filter(
        field => !project[field] && !project.metadata?.[field]
      );

      if (missingFields.length > 0) {
        return {
          canPublish: false,
          error: `Champs requis manquants: ${missingFields.join(', ')}`,
          missingFields
        };
      }

      return permissions;

    } catch (error) {
      console.error('❌ Erreur canPublishToMarketplace:', error);
      return { canPublish: false, error: error.message };
    }
  }

  /**
   * Génère un lien de partage
   */
  async generateShareLink(projectId, options = {}) {
    try {
      if (!this.currentUser) {
        throw new Error('Utilisateur non connecté');
      }

      const allowed = await this.canAccess(projectId, this.currentUser.id);
      if (!allowed) {
        throw new Error("Accès refusé");
      }

      const visibility = await this.getVisibility(projectId);
      const project = await projectManager.getProjectById(projectId, this.currentUser.id);

      switch (visibility) {
        case VISIBILITY_LEVELS.PRIVATE: {
          const shareToken = await this._generateShareToken(projectId);
          const expiresIn = options.expiresIn || 24 * 60 * 60 * 1000;
          
          // Stocker le token
          this.shareTokens.set(shareToken, {
            projectId,
            createdBy: this.currentUser.id,
            expiresAt: Date.now() + expiresIn,
            options
          });

          return {
            url: `${BASE_URL}/shared/${shareToken}`,
            expiresIn,
            token: shareToken,
            type: 'temporary'
          };
        }

        case VISIBILITY_LEVELS.PUBLIC:
          return {
            url: this._generatePublicUrl(projectId),
            type: 'public',
            projectName: project.name
          };

        case VISIBILITY_LEVELS.MARKETPLACE:
          return {
            url: this._generateMarketplaceUrl(projectId),
            type: 'marketplace',
            projectName: project.name
          };

        default:
          throw new Error('Impossible de générer un lien de partage pour cette visibilité');
      }

    } catch (error) {
      console.error('❌ Erreur generateShareLink:', error);
      throw error;
    }
  }

  /**
   * Valide un token de partage
   */
  async validateShareToken(token) {
    const share = this.shareTokens.get(token);
    
    if (!share) {
      return { valid: false, error: 'Token invalide' };
    }

    if (Date.now() > share.expiresAt) {
      this.shareTokens.delete(token);
      return { valid: false, error: 'Token expiré' };
    }

    return {
      valid: true,
      projectId: share.projectId,
      expiresAt: share.expiresAt
    };
  }

  /**
   * Vérifie les permissions de changement de visibilité
   * @private
   */
  async _checkVisibilityPermission(project, newVisibility) {
    try {
      // Vérifier si l'utilisateur peut éditer le projet
      const canEdit = await permissionService.canEditProject(
        this.currentUser.id,
        project.id
      );

      if (!canEdit) return false;

      // Vérifications spécifiques pour le marketplace
      if (newVisibility === VISIBILITY_LEVELS.MARKETPLACE) {
        const canPublish = await this.canPublishToMarketplace(project.id);
        return canPublish.canPublish;
      }

      return true;

    } catch (error) {
      console.error('❌ Erreur _checkVisibilityPermission:', error);
      return false;
    }
  }

  /**
   * Applique les règles de visibilité
   * @private
   */
  async _applyVisibilityRules(project, visibility, options) {
    const result = { valid: true };

    switch (visibility) {
      case VISIBILITY_LEVELS.TEAM:
        if (!options.teamId && !project.teamId) {
          result.valid = false;
          result.error = 'Équipe requise pour la visibilité TEAM';
        }
        break;

      case VISIBILITY_LEVELS.ORGANIZATION:
        if (!options.organizationId && !project.organizationId) {
          result.valid = false;
          result.error = 'Organisation requise pour la visibilité ORGANIZATION';
        }
        break;

      case VISIBILITY_LEVELS.MARKETPLACE:
        const canPublish = await this.canPublishToMarketplace(project.id);
        if (!canPublish.canPublish) {
          result.valid = false;
          result.error = canPublish.error;
        }
        break;
    }

    return result;
  }

  /**
   * Génère un token de partage sécurisé (version asynchrone)
   * @private
   */
  async _generateShareToken(projectId) {
    const random = crypto.randomBytes(16);
    const timestamp = Date.now().toString(36);
    const data = `${projectId}_${timestamp}_${random}`;
    
    // Utiliser createHash asynchrone de notre utilitaire crypto
    const hash = await crypto.createHash(data);
    const shortHash = hash.substring(0, 16);
    
    return `${timestamp}_${shortHash}`;
  }

  /**
   * Version synchrone pour la rétrocompatibilité (si nécessaire)
   * @private
   */
  _generateShareTokenSync(projectId) {
    const random = crypto.randomBytes(16);
    const timestamp = Date.now().toString(36);
    return `${projectId}_${timestamp}_${random}`;
  }

  /**
   * Vérifie un token avec hash (version sécurisée)
   * @private
   */
  async _verifyShareToken(token, expectedHash) {
    const hash = await crypto.createHash(token);
    return crypto.secureCompare(hash, expectedHash);
  }

  /**
   * Notifie un changement de visibilité
   * @private
   */
  async _notifyVisibilityChange(projectId, visibility, options) {
    // TODO: Envoyer notification aux membres concernés
    console.log(`📢 Visibilité changée pour ${projectId}: ${visibility}`);
  }

  /**
   * Génère l'URL publique d'un projet
   * @private
   */
  _generatePublicUrl(projectId) {
    return `${BASE_URL}/p/${projectId}`;
  }

  /**
   * Génère l'URL marketplace d'un projet
   * @private
   */
  _generateMarketplaceUrl(projectId) {
    return `https://marketplace.smartix.com/project/${projectId}`;
  }

  /**
   * Récupère depuis le cache
   * @private
   */
  _getFromCache(key) {
    const cached = this.visibilityCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.updatedAt > CACHE_TTL) {
      this.visibilityCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Stocke dans le cache
   * @private
   */
  _setCache(key, value) {
    if (this.visibilityCache.size >= this.maxCacheSize) {
      // Supprimer l'entrée la plus ancienne
      const oldestKey = this.visibilityCache.keys().next().value;
      this.visibilityCache.delete(oldestKey);
    }
    this.visibilityCache.set(key, value);
  }

  /**
   * Vérifie si un utilisateur est dans une équipe
   * @private
   */
  async _isUserInTeam(userId, teamId) {
    return teamService.isUserInTeam(userId, teamId);
  }

  /**
   * Vérifie si un utilisateur est dans une organisation
   * @private
   */
  async _isUserInOrganization(userId, orgId) {
    return teamService.isUserInOrganization(userId, orgId);
  }

  /**
   * Récupère les membres d'une équipe
   * @private
   */
  async _getTeamMembers(teamId) {
    return teamService.getTeamMembers(teamId);
  }

  /**
   * Récupère les membres d'une organisation
   * @private
   */
  async _getOrganizationMembers(orgId) {
    return teamService.getOrganizationMembers(orgId);
  }

  /**
   * Nettoie les tokens expirés
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of this.shareTokens.entries()) {
      if (now > data.expiresAt) {
        this.shareTokens.delete(token);
      }
    }
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    return {
      cacheSize: this.visibilityCache.size,
      activeTokens: this.shareTokens.size,
      userTeams: this.userTeams?.length || 0,
      userOrganizations: this.userOrganizations?.length || 0
    };
  }

  
  /**
   * Nettoie les ressources
   */
  cleanup() {
    this.visibilityCache.clear();
    this.shareTokens.clear();
    this.initialized = false;
    this.currentUser = null;
  }
}

// =============================
// HOOK REACT
// =============================

export const useVisibilityManager = (projectId) => {
  const [manager] = useState(() => new VisibilityManager());
  const [visibility, setVisibility] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Récupérer l'utilisateur courant depuis le contexte
        // TODO: Remplacer par vrai contexte d'authentification
        const userId = 'current_user_id'; 
        
        await manager.initialize(userId);
        
        if (projectId) {
          const vis = await manager.getVisibility(projectId);
          setVisibility(vis);
          
          const users = await manager.getAllowedUsers(projectId);
          setAllowedUsers(users);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      manager.cleanup();
    };
  }, [projectId, manager]);

  const setProjectVisibility = useCallback(async (newVisibility, options) => {
    try {
      setLoading(true);
      const result = await manager.setVisibility(projectId, newVisibility, options);
      setVisibility(newVisibility);
      
      // Rafraîchir la liste des utilisateurs autorisés
      const users = await manager.getAllowedUsers(projectId);
      setAllowedUsers(users);
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, manager]);

  const generateLink = useCallback(async (options) => {
    return manager.generateShareLink(projectId, options);
  }, [projectId, manager]);

  const checkAccess = useCallback(async (userId) => {
    return manager.canAccess(projectId, userId);
  }, [projectId, manager]);

  return {
    loading,
    error,
    visibility,
    allowedUsers,
    setVisibility: setProjectVisibility,
    generateLink,
    checkAccess,
    canPublishToMarketplace: useCallback(() => manager.canPublishToMarketplace(projectId), [projectId, manager]),
    VISIBILITY_LEVELS,
    VISIBILITY_DESCRIPTIONS,
    VISIBILITY_ICONS,
    VISIBILITY_COLORS
  };
};

// =============================
// EXPORT
// =============================

export const visibilityManager = new VisibilityManager();
export default visibilityManager;
