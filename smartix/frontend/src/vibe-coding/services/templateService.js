/**
 * Service de gestion des templates pour le module Vibe-Coding
 * 
 * Rôle: Interface entre le frontend et les templates
 * - Récupérer la liste des templates
 * - Rechercher des templates
 * - Obtenir les détails d'un template
 * - Télécharger un template
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAllTemplates as indexGetAllTemplates,
  getTemplateById as indexGetTemplateById
} from '../templates/templatesIndex';
import { projectManager } from '../core/projectManager';
import { generateProjectId } from '../utils/idGenerator';

// Event emitter simple pour les notifications
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}

// Toast optionnel (si sonner est installé)
let toast;
try {
  toast = require('sonner').toast;
} catch {
  toast = {
    success: (msg) => console.log('✅', msg),
    error: (msg) => console.error('❌', msg),
    info: (msg) => console.info('ℹ️', msg)
  };
}

// =============================
// CONFIGURATION
// =============================

// Cache des templates
let templatesCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// =============================
// VALIDATION
// =============================

const validateTemplate = (template) => {
  const errors = [];
  
  if (!template.id) errors.push('ID manquant');
  if (!template.name) errors.push('Nom manquant');
  if (!template.category) errors.push('Catégorie manquante');
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// =============================
// CLASSE TEMPLATE SERVICE
// =============================

class TemplateService extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.popularTemplates = [];
    this.recentTemplates = [];
    this.featuredTemplates = [];
    this.templatesById = new Map(); // Index O(1)
    this.userHistory = new Map(); // userId -> Set(templateIds)
    this.statsCache = null; // Cache des stats
    this.stats = {
      totalUsage: 0,
      byTemplate: new Map(),
      byDay: new Map(),
      byUser: new Map()
    };
  }

  /**
   * Initialise le service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this._loadTemplates();
      this.initialized = true;
      console.log('✅ TemplateService initialisé');
      this.emit('initialized');
    } catch (error) {
      console.error('❌ TemplateService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Charge tous les templates
   * @private
   */
  async _loadTemplates() {
    // Vérifier le cache
    const now = Date.now();
    if (templatesCache && now - cacheTimestamp < CACHE_TTL) {
      return templatesCache;
    }

    try {
      // Charger depuis templatesIndex
      const templates = indexGetAllTemplates();
      
      // Valider les templates
      const validTemplates = templates.filter(t => validateTemplate(t).valid);
      
      if (validTemplates.length < templates.length) {
        console.warn(`⚠️ ${templates.length - validTemplates.length} templates invalides ignorés`);
      }

      templatesCache = validTemplates;
      cacheTimestamp = now;

      // Construire l'index O(1)
      this.templatesById.clear();
      validTemplates.forEach(t => {
        this.templatesById.set(t.id, t);
      });

      // Calculer les statistiques (en copiant les tableaux)
      this.popularTemplates = [...validTemplates]
        .filter(t => (t.popularity || 0) > 50)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 10);

      this.recentTemplates = [...validTemplates]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10);

      this.featuredTemplates = [...validTemplates]
        .filter(t => t.featured)
        .slice(0, 5);

      // Invalider le cache des stats
      this.statsCache = null;

      this.emit('templatesLoaded', { count: validTemplates.length });
      
      return validTemplates;
    } catch (error) {
      console.error('❌ Erreur chargement templates:', error);
      
      // Fallback au cache existant
      if (templatesCache) {
        return templatesCache;
      }
      
      throw error;
    }
  }

  /**
   * Récupère tous les templates
   */
  async getAllTemplates(options = {}) {
    await this.initialize();

    const {
      category,
      type,
      complexity,
      search,
      limit = DEFAULT_LIMIT,
      offset = 0,
      sortBy = 'popularity' // popularity, date, name
    } = options;

    if (limit > MAX_LIMIT) {
      throw new Error(`Limit maximum: ${MAX_LIMIT}`);
    }

    // ✅ Copie avant de modifier
    let templates = [...(templatesCache || [])];

    // Filtres
    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    if (type) {
      templates = templates.filter(t => t.type === type);
    }

    if (complexity) {
      templates = templates.filter(t => t.complexity === complexity);
    }

    if (search) {
      const query = search.toLowerCase().trim();
      templates = templates.filter(t => 
        t.name?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Tri
    switch (sortBy) {
      case 'date':
        templates.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'name':
        templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      default: // popularity
        templates.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }

    // Pagination
    const paginated = templates.slice(offset, offset + limit);

    return {
      templates: paginated,
      total: templates.length,
      offset,
      limit,
      hasMore: offset + limit < templates.length
    };
  }

  /**
   * Récupère un template par son ID (O(1))
   */
  async getTemplateById(templateId) {
    if (!templateId) {
      throw new Error('templateId requis');
    }

    await this.initialize();

    const template = this.templatesById.get(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" non trouvé`);
    }

    return template;
  }

  /**
   * Récupère les templates populaires
   */
  async getPopularTemplates(limit = 10) {
    await this.initialize();
    return this.popularTemplates.slice(0, Math.min(limit, MAX_LIMIT));
  }

  /**
   * Récupère les templates récents
   */
  async getRecentTemplates(limit = 10) {
    await this.initialize();
    return this.recentTemplates.slice(0, Math.min(limit, MAX_LIMIT));
  }

  /**
   * Récupère les templates mis en avant
   */
  async getFeaturedTemplates(limit = 5) {
    await this.initialize();
    return this.featuredTemplates.slice(0, Math.min(limit, MAX_LIMIT));
  }

  /**
   * Récupère les templates par catégorie
   */
  async getTemplatesByCategory(category, limit = DEFAULT_LIMIT) {
    if (!category) {
      throw new Error('catégorie requise');
    }

    return this.getAllTemplates({ category, limit });
  }

  /**
   * Recherche des templates
   */
  async searchTemplates(query, options = {}) {
    if (!query || query.trim().length < 2) {
      return { templates: [], total: 0, hasMore: false };
    }

    return this.getAllTemplates({ ...options, search: query });
  }

  /**
   * Télécharge et crée un projet à partir d'un template
   */
  async createProjectFromTemplate(templateId, userId, projectName = null, options = {}) {
    if (!templateId || !userId) {
      throw new Error('templateId et userId requis');
    }

    try {
      const template = await this.getTemplateById(templateId);

      // Générer un nom de projet si non fourni
      if (!projectName) {
        const date = new Date().toLocaleDateString('fr-FR');
        projectName = `${template.name} - ${date}`;
      }

      // Créer le projet via projectManager
      const project = await projectManager.createProject({
        name: projectName,
        userId,
        type: template.type,
        templateId: template.id,
        config: {
          description: template.description,
          generatedFrom: 'template',
          templateVersion: template.version,
          createdAt: new Date().toISOString(),
          ...options
        }
      });

      // ✅ Une seule update pour tous les fichiers
      const files = template.files || {};
      const fileCount = Object.keys(files).length;

      if (fileCount > 0) {
        await projectManager.updateProject(project.id, {
          files
        }, userId);
      }

      // Enregistrer l'utilisation
      await this.incrementTemplateUsage(templateId, userId);

      this.emit('projectCreated', {
        projectId: project.id,
        templateId,
        userId
      });

      toast.success('✅ Projet créé avec succès !');
      
      return {
        ...project,
        templateInfo: {
          name: template.name,
          filesCreated: fileCount
        }
      };

    } catch (error) {
      console.error('❌ Erreur création projet depuis template:', error);
      toast.error(`Erreur: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtient les statistiques des templates (avec cache)
   */
  async getTemplateStats() {
    await this.initialize();

    // ✅ Utiliser le cache si disponible
    if (this.statsCache) {
      return this.statsCache;
    }

    const templates = templatesCache || [];
    
    const stats = {
      total: templates.length,
      byCategory: {},
      byComplexity: {},
      byType: {},
      byDay: {},
      byUser: {},
      mostPopular: this.popularTemplates[0]?.name || null,
      totalUsage: this.stats.totalUsage,
      categories: [],
      usageByDay: Array.from(this.stats.byDay.entries()).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30) // 30 derniers jours
    };

    templates.forEach(t => {
      // Par catégorie
      const cat = t.category || 'uncategorized';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // Par complexité
      const comp = t.complexity || 'unknown';
      stats.byComplexity[comp] = (stats.byComplexity[comp] || 0) + 1;

      // Par type
      const type = t.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    // Liste des catégories avec compteurs
    stats.categories = Object.entries(stats.byCategory).map(([id, count]) => ({
      id,
      count,
      name: this._getCategoryName(id)
    }));

    // Mettre en cache
    this.statsCache = stats;

    return stats;
  }

  /**
   * Recommande des templates basés sur l'historique
   */
  async getRecommendedTemplates(userId, limit = 5) {
    await this.initialize();

    if (!userId) {
      return this.popularTemplates.slice(0, limit);
    }

    // Récupérer l'historique de l'utilisateur
    const history = this.userHistory.get(userId) || new Set();
    const usedTemplates = Array.from(history);

    if (usedTemplates.length === 0) {
      // Pas d'historique -> retourner les populaires
      return this.popularTemplates.slice(0, limit);
    }

    // Analyser les préférences basées sur l'historique
    const preferences = this._analyzeUserPreferences(usedTemplates);

    // Trouver des templates similaires non utilisés
    const recommended = [...templatesCache]
      .filter(t => !usedTemplates.includes(t.id))
      .map(t => ({
        ...t,
        score: this._calculateRecommendationScore(t, preferences)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...t }) => t); // Enlever le score

    this.emit('recommendationsGenerated', {
      userId,
      count: recommended.length
    });

    return recommended;
  }

  /**
   * Analyse les préférences utilisateur
   * @private
   */
  _analyzeUserPreferences(usedTemplateIds) {
    const preferences = {
      categories: {},
      complexities: {},
      types: {}
    };

    usedTemplateIds.forEach(id => {
      const template = this.templatesById.get(id);
      if (template) {
        preferences.categories[template.category] = (preferences.categories[template.category] || 0) + 1;
        preferences.complexities[template.complexity] = (preferences.complexities[template.complexity] || 0) + 1;
        preferences.types[template.type] = (preferences.types[template.type] || 0) + 1;
      }
    });

    return preferences;
  }

  /**
   * Calcule le score de recommandation
   * @private
   */
  _calculateRecommendationScore(template, preferences) {
    let score = 0;

    // Score basé sur la catégorie
    if (preferences.categories[template.category]) {
      score += preferences.categories[template.category] * 10;
    }

    // Score basé sur la complexité
    if (preferences.complexities[template.complexity]) {
      score += preferences.complexities[template.complexity] * 5;
    }

    // Score basé sur le type
    if (preferences.types[template.type]) {
      score += preferences.types[template.type] * 3;
    }

    // Bonus de popularité
    score += (template.popularity || 0) / 10;

    return score;
  }

  /**
   * Incrémente le compteur d'utilisation d'un template
   */
  async incrementTemplateUsage(templateId, userId = null) {
    const template = await this.getTemplateById(templateId);

    // Mettre à jour le template
    template.usageCount = (template.usageCount || 0) + 1;
    template.popularity = Math.min(100, (template.popularity || 0) + 0.5);

    // Statistiques globales
    this.stats.totalUsage++;
    this.stats.byTemplate.set(templateId, (this.stats.byTemplate.get(templateId) || 0) + 1);

    // Stats par jour
    const today = new Date().toISOString().split('T')[0];
    this.stats.byDay.set(today, (this.stats.byDay.get(today) || 0) + 1);

    // Historique utilisateur
    if (userId) {
      if (!this.userHistory.has(userId)) {
        this.userHistory.set(userId, new Set());
      }
      this.userHistory.get(userId).add(templateId);
      
      // Stats par utilisateur
      this.stats.byUser.set(userId, (this.stats.byUser.get(userId) || 0) + 1);
    }

    // Mettre à jour les listes populaires
    this._updatePopularTemplates();

    // Invalider le cache des stats
    this.statsCache = null;

    this.emit('templateUsed', {
      templateId,
      userId,
      usageCount: template.usageCount
    });

    console.log(`📊 Template ${templateId} utilisé ${template.usageCount} fois`);
  }

  /**
   * Met à jour la liste des templates populaires
   * @private
   */
  _updatePopularTemplates() {
    this.popularTemplates = [...templatesCache]
      .filter(t => (t.popularity || 0) > 50)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);
  }

  /**
   * Rafraîchit le cache
   */
  async refreshCache() {
    templatesCache = null;
    cacheTimestamp = 0;
    this.statsCache = null;
    await this._loadTemplates();
    this.emit('cacheRefreshed');
    toast.info('🔄 Cache des templates rafraîchi');
    return true;
  }

  /**
   * Récupère les templates publics (alias de getAllTemplates)
   */
  async getPublicTemplates(options = {}) {
    return this.getAllTemplates({ ...options, limit: options.limit || 50 });
  }

  /**
   * Vérifie si un template existe
   */
  async templateExists(templateId) {
    try {
      await this.getTemplateById(templateId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtient le nom d'une catégorie
   * @private
   */
  _getCategoryName(categoryId) {
    const names = {
      productivity: 'Productivité',
      social: 'Social',
      lifestyle: 'Lifestyle',
      finance: 'Finance',
      education: 'Éducation',
      utilities: 'Utilitaires',
      games: 'Jeux',
      uncategorized: 'Non catégorisé'
    };
    return names[categoryId] || categoryId;
  }
}

// =============================
// HOOK PERSONNALISÉ (avec protection mounted)
// =============================
export const useTemplateService = () => {
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  
  const service = useRef(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const serviceInstance = new TemplateService();
      await serviceInstance.initialize();

      if (!mounted) return;

      service.current = serviceInstance;
      
      setPopular(await serviceInstance.getPopularTemplates());
      setRecent(await serviceInstance.getRecentTemplates());
      setFeatured(await serviceInstance.getFeaturedTemplates());
      setStats(await serviceInstance.getTemplateStats());
      setInitialized(true);
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const getAllTemplates = useCallback(async (options) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await service.current.getAllTemplates(options);
      setTemplates(result.templates);
      setTotalResults(result.total);
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const searchTemplates = useCallback(async (query, options) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await service.current.searchTemplates(query, options);
      setTemplates(result.templates);
      setTotalResults(result.total);
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const getTemplatesByCategory = useCallback(async (category, limit) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await service.current.getTemplatesByCategory(category, limit);
      setTemplates(result.templates);
      setTotalResults(result.total);
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const createProjectFromTemplate = useCallback(async (templateId, userId, projectName, options) => {
    if (!initialized) throw new Error('Service non initialisé');
    
    setLoading(true);
    try {
      const result = await service.current.createProjectFromTemplate(
        templateId, userId, projectName, options
      );
      
      // Mettre à jour les stats après création
      setStats(await service.current.getTemplateStats());
      
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  const refreshCache = useCallback(async () => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      await service.current.refreshCache();
      setPopular(await service.current.getPopularTemplates());
      setRecent(await service.current.getRecentTemplates());
      setFeatured(await service.current.getFeaturedTemplates());
      setStats(await service.current.getTemplateStats());
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  return {
    loading,
    initialized,
    templates,
    popular,
    recent,
    featured,
    stats,
    totalResults,
    getAllTemplates,
    searchTemplates,
    getTemplatesByCategory,
    getTemplateById: useCallback(async (id) => {
      if (!initialized) return null;
      return service.current.getTemplateById(id);
    }, [initialized]),
    getPopularTemplates: useCallback(async (limit) => {
      if (!initialized) return [];
      return service.current.getPopularTemplates(limit);
    }, [initialized]),
    getRecentTemplates: useCallback(async (limit) => {
      if (!initialized) return [];
      return service.current.getRecentTemplates(limit);
    }, [initialized]),
    getFeaturedTemplates: useCallback(async (limit) => {
      if (!initialized) return [];
      return service.current.getFeaturedTemplates(limit);
    }, [initialized]),
    getRecommendedTemplates: useCallback(async (userId, limit) => {
      if (!initialized) return [];
      return service.current.getRecommendedTemplates(userId, limit);
    }, [initialized]),
    createProjectFromTemplate,
    incrementTemplateUsage: useCallback(async (id, userId) => {
      if (!initialized) return;
      await service.current.incrementTemplateUsage(id, userId);
    }, [initialized]),
    refreshCache,
    on: useCallback((event, callback) => {
      if (!initialized) return () => {};
      return service.current.on(event, callback);
    }, [initialized])
  };
};

// =============================
// EXPORT (SINGLETON)
// =============================
export const templateService = new TemplateService();

// Initialisation automatique (seulement côté client)
if (typeof window !== 'undefined') {
  templateService.initialize().catch(console.error);
}

export default templateService;
