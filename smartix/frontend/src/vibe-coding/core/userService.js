/**
 * userService - Gestion des utilisateurs pour Vibe-Coding
 * Stub: à implémenter
 */
let instance = null;

class UserService {
  async getUser(userId) { return null; }
  async updateUser(userId, data) { return null; }
  async getUserProjects(userId) { return []; }
}

export const getUserService = () => {
  if (!instance) instance = new UserService();
  return instance;
};

export default getUserService;
