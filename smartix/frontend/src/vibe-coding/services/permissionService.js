/**
 * Service de permissions pour le module Vibe-Coding
 * 
 * Rôle: Gérer les permissions des utilisateurs
 * - Vérifier les droits d'accès
 * - Gérer les rôles (admin, editor, viewer)
 * - Contrôler les actions autorisées
 * - Gérer les partages de projets
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { projectManager } from '../core/projectManager';
import { useState, useEffect, useCallback } from "react";
import { crypto } from '../utils/crypto';

// =============================
// CONFIGURATION
// =============================

// Rôles disponibles
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
  NONE: 'none'
};

// Actions disponibles
export const ACTIONS = {
  VIEW_PROJECT: 'view_project',
  EDIT_PROJECT: 'edit_project',
  DELETE_PROJECT: 'delete_project',
  SHARE_PROJECT: 'share_project',

  VIEW_FILE: 'view_file',
  EDIT_FILE: 'edit_file',
  CREATE_FILE: 'create_file',
  DELETE_FILE: 'delete_file',
  RENAME_FILE: 'rename_file',

  VIEW_MEMBERS: 'view_members',
  ADD_MEMBER: 'add_member',
  REMOVE_MEMBER: 'remove_member',
  CHANGE_ROLE: 'change_role',

  RUN_PROJECT: 'run_project',
  BUILD_PROJECT: 'build_project',
  PUBLISH_PROJECT: 'publish_project'
};

// Matrice des permissions
const PERMISSION_MATRIX = {
  [ROLES.OWNER]: Object.values(ACTIONS),

  [ROLES.ADMIN]: [
    ACTIONS.VIEW_PROJECT,
    ACTIONS.EDIT_PROJECT,
    ACTIONS.SHARE_PROJECT,
    ACTIONS.VIEW_FILE,
    ACTIONS.EDIT_FILE,
    ACTIONS.CREATE_FILE,
    ACTIONS.DELETE_FILE,
    ACTIONS.RENAME_FILE,
    ACTIONS.VIEW_MEMBERS,
    ACTIONS.ADD_MEMBER,
    ACTIONS.REMOVE_MEMBER,
    ACTIONS.CHANGE_ROLE,
    ACTIONS.RUN_PROJECT,
    ACTIONS.BUILD_PROJECT
  ],

  [ROLES.EDITOR]: [
    ACTIONS.VIEW_PROJECT,
    ACTIONS.EDIT_PROJECT,
    ACTIONS.VIEW_FILE,
    ACTIONS.EDIT_FILE,
    ACTIONS.CREATE_FILE,
    ACTIONS.DELETE_FILE,
    ACTIONS.RENAME_FILE,
    ACTIONS.RUN_PROJECT,
    ACTIONS.BUILD_PROJECT
  ],

  [ROLES.VIEWER]: [
    ACTIONS.VIEW_PROJECT,
    ACTIONS.VIEW_FILE
  ],

  [ROLES.NONE]: []
};

// Hiérarchie des rôles (pour comparaison)
const ROLE_HIERARCHY = {
  [ROLES.OWNER]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.EDITOR]: 60,
  [ROLES.VIEWER]: 40,
  [ROLES.NONE]: 0
};

// Constantes
const MAX_INVITES_PER_PROJECT = 50;
const INVITE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 jours
const MAX_AUDIT_LOG_SIZE = 1000;

// =============================
// CLASSE PERMISSION SERVICE
// =============================

class PermissionService {
  constructor() {
    this.projectRoles = new Map(); // projectId -> Map(userId -> role)
    this.userProjects = new Map();  // userId -> Set(projectId)
    this.pendingInvites = new Map(); // inviteId -> invite details
    this.auditLog = [];
    this.initialized = false;
  }

  /**
   * Initialise le service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await crypto.initialize();
      await this._loadFromStorage();
      await this.cleanExpiredInvites();
      this.initialized = true;
      console.log('✅ PermissionService initialized');
    } catch (error) {
      console.error('❌ PermissionService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Charge les données depuis localStorage
   * @private
   */
  async _loadFromStorage() {
    try {
      const saved = localStorage.getItem('vibe_coding_permissions');
      if (!saved) return;

      const data = JSON.parse(saved);

      // Restaurer projectRoles
      if (data.projectRoles) {
        this.projectRoles = new Map(
          Object.entries(data.projectRoles).map(
            ([projectId, roles]) => [
              projectId,
              new Map(Object.entries(roles))
            ]
          )
        );
      }

      // Restaurer userProjects
      if (data.userProjects) {
        this.userProjects = new Map(
          Object.entries(data.userProjects).map(
            ([userId, projects]) => [userId, new Set(projects)]
          )
        );
      }

      // Restaurer pendingInvites
      if (data.pendingInvites) {
        this.pendingInvites = new Map(Object.entries(data.pendingInvites));
      }

      // Restaurer auditLog
      if (data.auditLog) {
        this.auditLog = data.auditLog;
      }

      console.log('✅ Permissions chargées depuis localStorage');
    } catch (error) {
      console.warn('⚠️ Erreur chargement permissions:', error);
    }
  }

  /**
   * Sauvegarde les données dans localStorage
   * @private
   */
  async _saveToStorage() {
    try {
      const data = {
        projectRoles: Object.fromEntries(
          [...this.projectRoles].map(
            ([projectId, roles]) => [
              projectId,
              Object.fromEntries(roles)
            ]
          )
        ),
        userProjects: Object.fromEntries(
          [...this.userProjects].map(
            ([userId, projects]) => [userId, [...projects]]
          )
        ),
        pendingInvites: Object.fromEntries(this.pendingInvites),
        auditLog: this.auditLog.slice(-MAX_AUDIT_LOG_SIZE)
      };

      localStorage.setItem('vibe_coding_permissions', JSON.stringify(data));
    } catch (error) {
      console.warn('⚠️ Erreur sauvegarde permissions:', error);
    }
  }

  /**
   * Définit le rôle d'un utilisateur pour un projet
   */
  async setUserRole(projectId, userId, role, grantedBy = 'system') {
    if (!this.initialized) {
      throw new Error('PermissionService non initialisé');
    }

    // Valider les paramètres
    if (!projectId || !userId) {
      throw new Error('ProjectId et userId requis');
    }

    if (!Object.values(ROLES).includes(role)) {
      throw new Error(`Rôle invalide: ${role}`);
    }

    // Vérifier les permissions si ce n'est pas le système
    if (grantedBy !== 'system') {
      const hasPermission = await this.hasPermission(
        projectId,
        grantedBy,
        ACTIONS.CHANGE_ROLE
      );

      if (!hasPermission) {
        throw new Error("Permission refusée pour changer les rôles");
      }

      // Vérifier la hiérarchie (ne peut pas donner un rôle supérieur au sien)
      const granterRole = this.getUserRole(projectId, grantedBy);
      if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[granterRole]) {
        throw new Error("Impossible de donner un rôle supérieur au vôtre");
      }
    }

    // Vérifier que le projet existe
    try {
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }
    } catch (error) {
      throw new Error(`Projet invalide: ${error.message}`);
    }

    // Initialiser les maps si nécessaire
    if (!this.projectRoles.has(projectId)) {
      this.projectRoles.set(projectId, new Map());
    }

    const projectMap = this.projectRoles.get(projectId);
    const oldRole = projectMap.get(userId);

    // Mettre à jour le rôle
    if (role === ROLES.NONE) {
      projectMap.delete(userId);
    } else {
      projectMap.set(userId, role);
    }

    // Mettre à jour la liste des projets de l'utilisateur
    if (!this.userProjects.has(userId)) {
      this.userProjects.set(userId, new Set());
    }

    const userSet = this.userProjects.get(userId);
    if (role === ROLES.NONE) {
      userSet.delete(projectId);
    } else {
      userSet.add(projectId);
    }

    // Journaliser l'action
    this._addAuditLog({
      action: 'role_change',
      projectId,
      userId,
      oldRole,
      newRole: role,
      by: grantedBy,
      timestamp: Date.now()
    });

    await this._saveToStorage();

    console.log(`✅ Rôle ${role} défini pour ${userId} sur ${projectId}`);

    return {
      success: true,
      projectId,
      userId,
      role,
      oldRole
    };
  }

  /**
   * Récupère le rôle d'un utilisateur pour un projet
   */
  getUserRole(projectId, userId) {
    if (!this.initialized) return ROLES.NONE;

    const projectMap = this.projectRoles.get(projectId);
    if (!projectMap) return ROLES.NONE;

    return projectMap.get(userId) || ROLES.NONE;
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  hasPermission(projectId, userId, action) {
    const role = this.getUserRole(projectId, userId);

    if (role === ROLES.OWNER) return true;

    const permissions = PERMISSION_MATRIX[role] || [];
    return permissions.includes(action);
  }

  /**
   * Vérifie si un utilisateur a une permission (version async)
   */
  async can(projectId, userId, action) {
    return this.hasPermission(projectId, userId, action);
  }

  /**
   * Vérifie si un utilisateur peut éditer
   */
  canEdit(projectId, userId) {
    return this.hasPermission(projectId, userId, ACTIONS.EDIT_PROJECT);
  }

  /**
   * Vérifie si un utilisateur peut voir
   */
  canView(projectId, userId) {
    return this.hasPermission(projectId, userId, ACTIONS.VIEW_PROJECT);
  }

  /**
   * Récupère les membres d'un projet
   */
  async getProjectMembers(projectId) {
    if (!this.initialized) return [];

    const projectMap = this.projectRoles.get(projectId);
    if (!projectMap) return [];

    const members = [];
    const userIds = Array.from(projectMap.keys());

    for (const userId of userIds) {
      const role = projectMap.get(userId);
      const permissions = PERMISSION_MATRIX[role] || [];

      // Récupérer les infos utilisateur (simulé)
      const userInfo = await this._getUserInfo(userId);

      members.push({
        userId,
        email: userInfo.email,
        name: userInfo.name,
        role,
        canEdit: permissions.includes(ACTIONS.EDIT_PROJECT),
        canView: permissions.includes(ACTIONS.VIEW_PROJECT),
        canManage: permissions.includes(ACTIONS.ADD_MEMBER),
        joinedAt: userInfo.joinedAt
      });
    }

    // Trier par rôle (propriétaire en premier)
    return members.sort((a, b) => {
      const orderA = ROLE_HIERARCHY[a.role] || 0;
      const orderB = ROLE_HIERARCHY[b.role] || 0;
      return orderB - orderA;
    });
  }

  /**
   * Récupère les projets d'un utilisateur
   */
  async getUserProjects(userId) {
    if (!this.initialized) return [];

    const userSet = this.userProjects.get(userId);
    if (!userSet) return [];

    const projects = [];
    const projectIds = Array.from(userSet);

    for (const projectId of projectIds) {
      try {
        const role = this.getUserRole(projectId, userId);
        const project = await projectManager.getProjectById(projectId, userId);

        if (project) {
          projects.push({
            ...project,
            userRole: role,
            permissions: {
              canEdit: this.canEdit(projectId, userId),
              canShare: this.hasPermission(projectId, userId, ACTIONS.SHARE_PROJECT)
            }
          });
        }
      } catch (error) {
        console.warn(`⚠️ Impossible de charger ${projectId}:`, error.message);
      }
    }

    // Trier par date de mise à jour
    return projects.sort((a, b) => 
      new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );
  }

  /**
   * Invite un utilisateur par email
   */
  async inviteUser(projectId, email, role = ROLES.VIEWER, invitedBy) {
    if (!this.hasPermission(projectId, invitedBy, ACTIONS.ADD_MEMBER)) {
      throw new Error("Permission refusée pour inviter des membres");
    }

    if (![ROLES.ADMIN, ROLES.EDITOR, ROLES.VIEWER].includes(role)) {
      throw new Error('Rôle d\'invitation invalide');
    }

    // Valider l'email
    if (!this._isValidEmail(email)) {
      throw new Error('Email invalide');
    }

    // Vérifier la limite d'invitations
    const projectInvites = Array.from(this.pendingInvites.values())
      .filter(inv => inv.projectId === projectId);

    if (projectInvites.length >= MAX_INVITES_PER_PROJECT) {
      throw new Error(`Maximum ${MAX_INVITES_PER_PROJECT} invitations par projet`);
    }

    // Vérifier si déjà membre
    const members = await this.getProjectMembers(projectId);
    const existingMember = members.find(m => m.email === email);
    if (existingMember) {
      throw new Error('Cet utilisateur est déjà membre du projet');
    }

    // Vérifier si déjà invité
    const existingInvite = projectInvites.find(inv => inv.email === email);
    if (existingInvite) {
      throw new Error('Une invitation a déjà été envoyée à cet email');
    }

    const inviteId = await this._generateInviteId(projectId, email);
    const expiresAt = Date.now() + INVITE_EXPIRY;

    const invite = {
      id: inviteId,
      projectId,
      email,
      role,
      invitedBy,
      expiresAt,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.pendingInvites.set(inviteId, invite);

    this._addAuditLog({
      action: 'invite_sent',
      projectId,
      email,
      role,
      by: invitedBy,
      timestamp: Date.now()
    });

    await this._saveToStorage();

    console.log(`📧 Invitation envoyée à ${email}`);

    // TODO: Envoyer un vrai email
    await this._sendInviteEmail(email, invite);

    return {
      success: true,
      inviteId,
      projectId,
      email,
      role,
      expiresAt
    };
  }

  /**
   * Accepte une invitation
   */
  async acceptInvite(inviteId, userId, userEmail) {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      throw new Error('Invitation non trouvée');
    }

    if (invite.email !== userEmail) {
      throw new Error("Cette invitation n'est pas destinée à cet email");
    }

    if (Date.now() > invite.expiresAt) {
      this.pendingInvites.delete(inviteId);
      await this._saveToStorage();
      throw new Error('Invitation expirée');
    }

    if (invite.status !== 'pending') {
      throw new Error(`Invitation déjà ${invite.status}`);
    }

    // Ajouter l'utilisateur au projet
    await this.setUserRole(
      invite.projectId,
      userId,
      invite.role,
      invite.invitedBy
    );

    invite.status = 'accepted';
    invite.acceptedAt = Date.now();
    invite.acceptedBy = userId;

    this.pendingInvites.delete(inviteId);

    this._addAuditLog({
      action: 'invite_accepted',
      projectId: invite.projectId,
      userId,
      email: userEmail,
      role: invite.role,
      timestamp: Date.now()
    });

    await this._saveToStorage();

    return {
      success: true,
      projectId: invite.projectId,
      role: invite.role
    };
  }

  /**
   * Refuse une invitation
   */
  async declineInvite(inviteId, userId, userEmail) {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      throw new Error('Invitation non trouvée');
    }

    if (invite.email !== userEmail) {
      throw new Error("Cette invitation n'est pas destinée à cet email");
    }

    invite.status = 'declined';
    invite.declinedAt = Date.now();
    invite.declinedBy = userId;

    this.pendingInvites.delete(inviteId);

    this._addAuditLog({
      action: 'invite_declined',
      projectId: invite.projectId,
      userId,
      email: userEmail,
      timestamp: Date.now()
    });

    await this._saveToStorage();

    return { success: true };
  }

  /**
   * Annule une invitation
   */
  async cancelInvite(inviteId, cancelledBy) {
    const invite = this.pendingInvites.get(inviteId);
    if (!invite) {
      throw new Error('Invitation non trouvée');
    }

    if (!this.hasPermission(invite.projectId, cancelledBy, ACTIONS.REMOVE_MEMBER)) {
      throw new Error("Permission refusée pour annuler l'invitation");
    }

    invite.status = 'cancelled';
    invite.cancelledAt = Date.now();
    invite.cancelledBy = cancelledBy;

    this.pendingInvites.delete(inviteId);

    this._addAuditLog({
      action: 'invite_cancelled',
      projectId: invite.projectId,
      email: invite.email,
      by: cancelledBy,
      timestamp: Date.now()
    });

    await this._saveToStorage();

    return { success: true };
  }

  /**
   * Récupère les invitations en attente
   */
  getPendingInvites(projectId) {
    return Array.from(this.pendingInvites.values())
      .filter(inv => inv.projectId === projectId && inv.status === 'pending')
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invitedBy,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt
      }));
  }

  /**
   * Supprime un membre du projet
   */
  async removeMember(projectId, userId, removedBy) {
    if (!this.hasPermission(projectId, removedBy, ACTIONS.REMOVE_MEMBER)) {
      throw new Error("Permission refusée pour supprimer des membres");
    }

    const role = this.getUserRole(projectId, userId);
    if (role === ROLES.OWNER) {
      throw new Error('Impossible de retirer le propriétaire du projet');
    }

    if (userId === removedBy) {
      throw new Error('Vous ne pouvez pas vous retirer vous-même');
    }

    await this.setUserRole(projectId, userId, ROLES.NONE, removedBy);

    this._addAuditLog({
      action: 'member_removed',
      projectId,
      userId,
      by: removedBy,
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Vérifie si un utilisateur a accès à un projet (sans être propriétaire)
   */
  isShared(projectId, userId) {
    const role = this.getUserRole(projectId, userId);
    return role !== ROLES.NONE && role !== ROLES.OWNER;
  }

  /**
   * Nettoie les invitations expirées
   */
  async cleanExpiredInvites() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, invite] of this.pendingInvites.entries()) {
      if (now > invite.expiresAt) {
        this.pendingInvites.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this._saveToStorage();
      console.log(`🧹 ${cleaned} invitations expirées nettoyées`);
    }

    return cleaned;
  }

  /**
   * Récupère l'audit log
   */
  getAuditLog(projectId, limit = 100) {
    return this.auditLog
      .filter(entry => entry.projectId === projectId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Ajoute une entrée à l'audit log
   * @private
   */
  _addAuditLog(entry) {
    this.auditLog.push(entry);
    if (this.auditLog.length > MAX_AUDIT_LOG_SIZE) {
      this.auditLog = this.auditLog.slice(-MAX_AUDIT_LOG_SIZE);
    }
  }

  /**
   * Génère un ID d'invitation unique
   * @private
   */
  async _generateInviteId(projectId, email) {
    const random = crypto.randomToken(8);
    const timestamp = Date.now().toString(36);
    const data = `${projectId}_${email}_${timestamp}_${random}`;
    const hash = await crypto.createHash(data);
    return `inv_${timestamp}_${hash.substring(0, 8)}`;
  }

  /**
   * Valide un email
   * @private
   */
  _isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Récupère les infos d'un utilisateur (simulé)
   * @private
   */
  async _getUserInfo(userId) {
    // TODO: Remplacer par un vrai service utilisateur
    return {
      userId,
      email: `user_${userId}@example.com`,
      name: `User ${userId}`,
      joinedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
    };
  }

  /**
   * Envoie un email d'invitation (simulé)
   * @private
   */
  async _sendInviteEmail(email, invite) {
    console.log(`📧 Email d'invitation envoyé à ${email}`, {
      projectId: invite.projectId,
      role: invite.role,
      link: `https://app.smartix.com/invite/${invite.id}`
    });
    // TODO: Implémenter l'envoi réel d'email
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    return {
      totalProjects: this.projectRoles.size,
      totalUsers: this.userProjects.size,
      totalInvites: this.pendingInvites.size,
      auditLogSize: this.auditLog.length,
      initialized: this.initialized
    };
  }
}

// =============================
// HOOK PERSONNALISÉ
// =============================

export const usePermissions = (projectId, userId) => {
  const [permissionService, setPermissionService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(ROLES.NONE);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const service = new PermissionService();
        await service.initialize();
        setPermissionService(service);

        if (projectId && userId) {
          await refreshData(service);
        }

        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const refreshData = async (service) => {
      const role = service.getUserRole(projectId, userId);
      setUserRole(role);

      const projectMembers = await service.getProjectMembers(projectId);
      setMembers(projectMembers);

      const invites = service.getPendingInvites(projectId);
      setPendingInvites(invites);

      const log = service.getAuditLog(projectId, 50);
      setAuditLog(log);
    };

    init();
  }, [projectId, userId]);

  const refresh = useCallback(async () => {
    if (!permissionService || !projectId) return;
    const role = permissionService.getUserRole(projectId, userId);
    setUserRole(role);
    
    const projectMembers = await permissionService.getProjectMembers(projectId);
    setMembers(projectMembers);

    const invites = permissionService.getPendingInvites(projectId);
    setPendingInvites(invites);

    const log = permissionService.getAuditLog(projectId, 50);
    setAuditLog(log);
  }, [permissionService, projectId, userId]);

  const checkPermission = useCallback((action) => {
    if (!permissionService || !projectId || !userId) return false;
    return permissionService.hasPermission(projectId, userId, action);
  }, [permissionService, projectId, userId]);

  const inviteUser = useCallback(async (email, role) => {
    if (!checkPermission(ACTIONS.ADD_MEMBER)) {
      throw new Error('Permission refusée');
    }
    const result = await permissionService.inviteUser(projectId, email, role, userId);
    await refresh();
    return result;
  }, [permissionService, projectId, userId, checkPermission, refresh]);

  const removeMember = useCallback(async (targetUserId) => {
    if (!checkPermission(ACTIONS.REMOVE_MEMBER)) {
      throw new Error('Permission refusée');
    }
    const result = await permissionService.removeMember(projectId, targetUserId, userId);
    await refresh();
    return result;
  }, [permissionService, projectId, userId, checkPermission, refresh]);

  const changeRole = useCallback(async (targetUserId, newRole) => {
    if (!checkPermission(ACTIONS.CHANGE_ROLE)) {
      throw new Error('Permission refusée');
    }
    const result = await permissionService.setUserRole(projectId, targetUserId, newRole, userId);
    await refresh();
    return result;
  }, [permissionService, projectId, userId, checkPermission, refresh]);

  const cancelInvite = useCallback(async (inviteId) => {
    if (!checkPermission(ACTIONS.REMOVE_MEMBER)) {
      throw new Error('Permission refusée');
    }
    const result = await permissionService.cancelInvite(inviteId, userId);
    await refresh();
    return result;
  }, [permissionService, userId, checkPermission, refresh]);

  return {
    loading,
    error,
    userRole,
    members,
    pendingInvites,
    auditLog,
    
    // Vérifications
    can: checkPermission,
    canEdit: () => checkPermission(ACTIONS.EDIT_PROJECT),
    canView: () => checkPermission(ACTIONS.VIEW_PROJECT),
    canShare: () => checkPermission(ACTIONS.SHARE_PROJECT),
    canManageMembers: () => checkPermission(ACTIONS.ADD_MEMBER),
    
    // Actions
    inviteUser,
    removeMember,
    changeRole,
    cancelInvite,
    refresh,
    
    // Constantes
    ROLES,
    ACTIONS
  };
};

// =============================
// EXPORT
// =============================

export const permissionService = new PermissionService();
export default permissionService;
