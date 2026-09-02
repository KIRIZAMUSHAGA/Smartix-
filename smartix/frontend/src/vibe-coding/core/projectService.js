/**
 * projectService - Gestion des projets pour Vibe-Coding
 * Délègue vers projectStorage (IndexedDB local)
 */
import {
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
} from '../storage/projectStorage';

let instance = null;

class ProjectService {
  /**
   * Récupère un projet par son ID
   * @param {string} projectId
   * @param {string} [userId]
   * @returns {Promise<Object|null>}
   */
  async getProject(projectId, userId = null) {
    try {
      return await loadProject(projectId, userId);
    } catch (error) {
      console.error('[ProjectService] getProject error:', error);
      return null;
    }
  }

  /**
   * Liste les projets d'un utilisateur
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async listProjects(userId) {
    try {
      const result = await listProjects(userId);
      return result || [];
    } catch (error) {
      console.error('[ProjectService] listProjects error:', error);
      return [];
    }
  }

  /**
   * Sauvegarde un projet
   * @param {Object} data - données du projet (doit contenir id et userId)
   * @returns {Promise<Object|null>}
   */
  async saveProject(data) {
    try {
      return await saveProject(data, data.userId);
    } catch (error) {
      console.error('[ProjectService] saveProject error:', error);
      return null;
    }
  }

  /**
   * Supprime un projet
   * @param {string} projectId
   * @param {string} [userId]
   * @returns {Promise<boolean>}
   */
  async deleteProject(projectId, userId = null) {
    try {
      await deleteProject(projectId, userId);
      return true;
    } catch (error) {
      console.error('[ProjectService] deleteProject error:', error);
      return false;
    }
  }
}

export const getProjectService = () => {
  if (!instance) instance = new ProjectService();
  return instance;
};

export default getProjectService;
