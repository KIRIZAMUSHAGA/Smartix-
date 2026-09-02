/**
 * Gestionnaire du cycle de vie des projets Vibe-Coding
 * 
 * Rôle: Gère les états et transitions des projets
 * États:
 * - draft : Brouillon, en cours de création
 * - generated : Généré par l'IA
 * - editing : En cours d'édition
 * - running : En cours d'exécution
 * - published : Publié
 * - archived : Archivé
 * - error : En erreur
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useCallback, useState, useEffect } from 'react';
import { projectManager } from './projectManager';

// =============================
// DÉFINITION DES ÉTATS
// =============================

export const PROJECT_STATES = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  EDITING: 'editing',
  RUNNING: 'running',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
  ERROR: 'error'
};

// Descriptifs des états (pour l'UI)
export const STATE_DESCRIPTIONS = {
  [PROJECT_STATES.DRAFT]: 'Brouillon - En cours de création',
  [PROJECT_STATES.GENERATED]: 'Généré par l\'IA - Prêt à être édité',
  [PROJECT_STATES.EDITING]: 'En cours d\'édition',
  [PROJECT_STATES.RUNNING]: 'En cours d\'exécution',
  [PROJECT_STATES.PUBLISHED]: 'Publié - Visible par d\'autres',
  [PROJECT_STATES.ARCHIVED]: 'Archivé - Non actif',
  [PROJECT_STATES.ERROR]: 'Erreur - Problème détecté'
};

// Couleurs associées (pour l'UI)
export const STATE_COLORS = {
  [PROJECT_STATES.DRAFT]: 'gray',
  [PROJECT_STATES.GENERATED]: 'blue',
  [PROJECT_STATES.EDITING]: 'green',
  [PROJECT_STATES.RUNNING]: 'purple',
  [PROJECT_STATES.PUBLISHED]: 'indigo',
  [PROJECT_STATES.ARCHIVED]: 'gray',
  [PROJECT_STATES.ERROR]: 'red'
};

// Icônes associées (pour l'UI)
export const STATE_ICONS = {
  [PROJECT_STATES.DRAFT]: '📝',
  [PROJECT_STATES.GENERATED]: '🤖',
  [PROJECT_STATES.EDITING]: '✏️',
  [PROJECT_STATES.RUNNING]: '▶️',
  [PROJECT_STATES.PUBLISHED]: '📦',
  [PROJECT_STATES.ARCHIVED]: '📁',
  [PROJECT_STATES.ERROR]: '⚠️'
};

// =============================
// MATRICE DE TRANSITION
// =============================

// Définit les transitions autorisées entre états
const TRANSITION_MATRIX = {
  // De DRAFT
  [PROJECT_STATES.DRAFT]: [
    PROJECT_STATES.GENERATED,  // IA a généré le projet
    PROJECT_STATES.EDITING,     // Édition manuelle
    PROJECT_STATES.ARCHIVED      // Abandon
  ],
  
  // De GENERATED
  [PROJECT_STATES.GENERATED]: [
    PROJECT_STATES.EDITING,     // Commencer l'édition
    PROJECT_STATES.RUNNING,      // Lancer directement
    PROJECT_STATES.ARCHIVED      // Archiver
  ],
  
  // De EDITING
  [PROJECT_STATES.EDITING]: [
    PROJECT_STATES.RUNNING,      // Lancer l'application
    PROJECT_STATES.GENERATED,    // Re-générer avec l'IA
    PROJECT_STATES.PUBLISHED,    // Publier
    PROJECT_STATES.ARCHIVED,     // Archiver
    PROJECT_STATES.ERROR         // Erreur détectée
  ],
  
  // De RUNNING
  [PROJECT_STATES.RUNNING]: [
    PROJECT_STATES.EDITING,      // Retour à l'édition
    PROJECT_STATES.PUBLISHED,    // Publier depuis l'exécution
    PROJECT_STATES.ERROR,        // Erreur d'exécution
    PROJECT_STATES.ARCHIVED       // Archiver
  ],
  
  // De PUBLISHED
  [PROJECT_STATES.PUBLISHED]: [
    PROJECT_STATES.EDITING,      // Mettre à jour
    PROJECT_STATES.ARCHIVED,      // Dépublier/Archiver
    PROJECT_STATES.ERROR          // Erreur de publication
  ],
  
  // De ARCHIVED
  [PROJECT_STATES.ARCHIVED]: [
    PROJECT_STATES.DRAFT,         // Réactiver (nouveau brouillon)
    PROJECT_STATES.EDITING,       // Réactiver pour édition
    PROJECT_STATES.PUBLISHED      // Réactiver et publier
  ],
  
  // De ERROR
  [PROJECT_STATES.ERROR]: [
    PROJECT_STATES.DRAFT,         // Recommencer
    PROJECT_STATES.EDITING,       // Corriger
    PROJECT_STATES.ARCHIVED       // Archiver (abandon)
  ]
};

// =============================
// CLASSE PROJECT LIFECYCLE
// =============================

class ProjectLifecycle {
  constructor() {
    this.listeners = new Map(); // Écouteurs d'événements
    this.stateHistory = new Map(); // Historique des états
  }

  /**
   * Vérifie si une transition est autorisée
   * @param {string} fromState - État de départ
   * @param {string} toState - État d'arrivée
   * @returns {Object} - { allowed: boolean, reason: string }
   */
  canTransition(fromState, toState) {
    // États identiques = toujours autorisé
    if (fromState === toState) {
      return { allowed: true, reason: 'same_state' };
    }

    // Vérifier que les états existent
    if (!PROJECT_STATES[fromState?.toUpperCase()] && fromState) {
      return { allowed: false, reason: `État source invalide: ${fromState}` };
    }
    if (!PROJECT_STATES[toState?.toUpperCase()]) {
      return { allowed: false, reason: `État cible invalide: ${toState}` };
    }

    // Vérifier la transition dans la matrice
    const allowedTransitions = TRANSITION_MATRIX[fromState] || [];
    if (allowedTransitions.includes(toState)) {
      return { allowed: true, reason: 'valid_transition' };
    }

    return {
      allowed: false,
      reason: `Transition non autorisée de ${fromState} vers ${toState}`
    };
  }

  /**
   * Transitionne un projet vers un nouvel état
   * @param {string} projectId - ID du projet
   * @param {string} newState - Nouvel état
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} metadata - Métadonnées supplémentaires
   * @returns {Promise<Object>} Projet mis à jour
   */
  async transitionTo(projectId, newState, userId, metadata = {}) {
    try {
      // Charger le projet
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      const fromState = project.state || PROJECT_STATES.DRAFT;

      // Vérifier la transition
      const transition = this.canTransition(fromState, newState);
      if (!transition.allowed) {
        throw new Error(transition.reason);
      }

      // Actions spécifiques selon la transition
      await this._handlePreTransition(project, fromState, newState, metadata);

      // Mettre à jour l'état
      const updated = await projectManager.updateProject(projectId, {
        state: newState,
        ...(metadata.stateMetadata && { stateMetadata: metadata.stateMetadata })
      }, userId);

      // Enregistrer dans l'historique
      this._recordStateChange(projectId, fromState, newState, metadata);

      // Actions post-transition
      await this._handlePostTransition(updated, fromState, newState, metadata);

      // Notifier les écouteurs
      this._notifyListeners(projectId, fromState, newState, updated);

      return updated;

    } catch (error) {
      console.error(`Erreur transition vers ${newState}:`, error);
      throw error;
    }
  }

  /**
   * Récupère l'historique des états d'un projet
   * @param {string} projectId - ID du projet
   * @returns {Array} Historique des changements d'état
   */
  getStateHistory(projectId) {
    return this.stateHistory.get(projectId) || [];
  }

  /**
   * Ajoute un écouteur pour les changements d'état
   * @param {string} projectId - ID du projet
   * @param {Function} callback - Fonction appelée lors du changement
   * @returns {Function} Fonction pour retirer l'écouteur
   */
  addStateListener(projectId, callback) {
    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Set());
    }
    this.listeners.get(projectId).add(callback);

    // Retourne une fonction pour retirer l'écouteur
    return () => {
      const listeners = this.listeners.get(projectId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(projectId);
        }
      }
    };
  }

  /**
   * Récupère le temps passé dans chaque état
   * @param {string} projectId - ID du projet
   * @returns {Object} Statistiques de temps par état
   */
  getStateTimeStats(projectId) {
    const history = this.getStateHistory(projectId);
    const stats = {};

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      const duration = new Date(next.timestamp) - new Date(current.timestamp);
      
      stats[current.toState] = (stats[current.toState] || 0) + duration;
    }

    return stats;
  }

  // =============================
  // FONCTIONS PRIVÉES
  // =============================

  /**
   * Actions avant transition
   * @private
   */
  async _handlePreTransition(project, fromState, toState, metadata) {
    switch (toState) {
      case PROJECT_STATES.RUNNING:
        // Vérifier que le projet peut être exécuté
        if (!project.files || Object.keys(project.files).length === 0) {
          throw new Error('Impossible d\'exécuter un projet sans fichiers');
        }
        break;

      case PROJECT_STATES.PUBLISHED:
        // Vérifier que le projet a une version
        if (!project.version || project.version === '0.0.0') {
          throw new Error('Une version valide est requise pour publier');
        }
        break;

      case PROJECT_STATES.ARCHIVED:
        // Pas de validation particulière
        break;
    }
  }

  /**
   * Actions après transition
   * @private
   */
  async _handlePostTransition(project, fromState, toState, metadata) {
    switch (toState) {
      case PROJECT_STATES.RUNNING:
        // Ici on pourrait lancer automatiquement le projet
        console.log(`Projet ${project.id} lancé`);
        break;

      case PROJECT_STATES.PUBLISHED:
        // Ici on pourrait notifier les services de publication
        console.log(`Projet ${project.id} publié`);
        break;

      case PROJECT_STATES.ARCHIVED:
        // Ici on pourrait nettoyer des ressources temporaires
        console.log(`Projet ${project.id} archivé`);
        break;
    }
  }

  /**
   * Enregistre un changement d'état dans l'historique
   * @private
   */
  _recordStateChange(projectId, fromState, toState, metadata) {
    if (!this.stateHistory.has(projectId)) {
      this.stateHistory.set(projectId, []);
    }

    const history = this.stateHistory.get(projectId);
    history.push({
      fromState,
      toState,
      timestamp: new Date().toISOString(),
      metadata,
      transitionId: `${projectId}_${history.length}`
    });

    // Garder seulement les 100 derniers événements
    if (history.length > 100) {
      this.stateHistory.set(projectId, history.slice(-100));
    }
  }

  /**
   * Notifie les écouteurs d'un changement d'état
   * @private
   */
  _notifyListeners(projectId, fromState, toState, project) {
    const listeners = this.listeners.get(projectId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback({ fromState, toState, project, timestamp: new Date().toISOString() });
        } catch (error) {
          console.error('Erreur dans un écouteur d\'état:', error);
        }
      });
    }
  }
}

// =============================
// HOOKS PERSONNALISÉS POUR REACT
// =============================

/**
 * Hook React pour utiliser le cycle de vie d'un projet
 * @param {string} projectId - ID du projet
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} État et fonctions
 */
export const useProjectLifecycle = (projectId, userId) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe;

    const loadProject = async () => {
      try {
        const project = await projectManager.getProjectById(projectId, userId);
        setState(project?.state || PROJECT_STATES.DRAFT);
        
        // S'abonner aux changements
        unsubscribe = projectLifecycle.addStateListener(projectId, ({ toState }) => {
          setState(toState);
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProject();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [projectId, userId]);

  const transitionTo = useCallback(async (newState, metadata) => {
    try {
      setLoading(true);
      const updated = await projectLifecycle.transitionTo(projectId, newState, userId, metadata);
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  return {
    state,
    loading,
    error,
    transitionTo,
    canTransitionTo: (newState) => projectLifecycle.canTransition(state, newState),
    getHistory: () => projectLifecycle.getStateHistory(projectId),
    getTimeStats: () => projectLifecycle.getStateTimeStats(projectId)
  };
};

// =============================
// EXPORT (SINGLETON)
// =============================
export const projectLifecycle = new ProjectLifecycle();

export default projectLifecycle;
