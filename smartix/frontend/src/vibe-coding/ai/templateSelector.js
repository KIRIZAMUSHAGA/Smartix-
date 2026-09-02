/**
 * Sélecteur de templates pour le module Vibe-Coding
 * Version corrigée avec:
 * - Accès correct aux structures de données
 * - Imports React ajoutés
 * - Compatibilité avec promptParser.js
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { templatesIndex } from '../templates/templatesIndex';
import { parsePrompt, suggestTemplate } from './promptParser';

// Imports React pour le hook
import { useState, useEffect, useRef, useCallback } from 'react';

// =============================
// CONFIGURATION
// =============================

// Poids des critères pour le scoring
const WEIGHTS = {
  type: 0.4,
  features: 0.3,
  complexity: 0.2,
  popularity: 0.1
};

// Cache des résultats récents
const recommendationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Statistiques de sélection
const stats = {
  totalSelections: 0,
  cacheHits: 0,
  byCategory: {},
  byType: {}
};

// =============================
// CLASSE TEMPLATE SELECTOR
// =============================

class TemplateSelector {
  constructor() {
    this.templates = [];
    this.initialized = false;
  }

  /**
   * Initialise le sélecteur
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Charger tous les templates
      this.templates = await templatesIndex.getAllTemplates();
      this.initialized = true;
      console.log(`✅ TemplateSelector initialisé avec ${this.templates.length} templates`);
    } catch (error) {
      console.error('❌ TemplateSelector initialization failed:', error);
      throw error;
    }
  }

  /**
   * Sélectionne le meilleur template pour un prompt
   * @param {string} prompt - Prompt utilisateur
   * @param {Object} options - Options supplémentaires
   * @returns {Object} Template sélectionné
   */
  async selectTemplate(prompt, options = {}) {
    try {
      // Vérifier le cache
      const cacheKey = this._getCacheKey(prompt, options);
      const cached = recommendationCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        stats.cacheHits++;
        return cached.result;
      }

      // Analyser le prompt
      const analysis = parsePrompt(prompt);
      
      // Obtenir les suggestions du promptParser
      const suggestions = suggestTemplate(analysis);
      
      // Filtrer les templates disponibles
      const candidates = this._filterTemplates(analysis, suggestions);
      
      // Calculer les scores
      const scored = await this._scoreTemplates(candidates, analysis, options);
      
      // Sélectionner le meilleur
      const selected = this._selectBest(scored);
      
      // Enrichir avec les métadonnées
      const result = this._enrichTemplate(selected, analysis);
      
      // Mettre en cache
      recommendationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Mettre à jour les stats
      this._updateStats(result);

      return result;

    } catch (error) {
      console.error('Erreur selectTemplate:', error);
      // Fallback sur le template par défaut
      return this._getDefaultTemplate();
    }
  }

  /**
   * Sélectionne plusieurs templates (top N)
   * @param {string} prompt - Prompt utilisateur
   * @param {number} count - Nombre de templates
   * @returns {Array} Liste des templates
   */
  async selectTopTemplates(prompt, count = 3) {
    try {
      const analysis = parsePrompt(prompt);
      const suggestions = suggestTemplate(analysis);
      const candidates = this._filterTemplates(analysis, suggestions);
      const scored = await this._scoreTemplates(candidates, analysis);
      
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(t => this._enrichTemplate(t, analysis));

    } catch (error) {
      console.error('Erreur selectTopTemplates:', error);
      return [this._getDefaultTemplate()];
    }
  }

  /**
   * Obtient des recommandations personnalisées
   * @param {string} userId - ID utilisateur
   * @param {Object} preferences - Préférences utilisateur
   * @returns {Array} Templates recommandés
   */
  async getPersonalizedRecommendations(userId, preferences = {}) {
    try {
      // Filtrer par préférences
      let candidates = this.templates;
      
      if (preferences.categories) {
        candidates = candidates.filter(t => 
          preferences.categories.includes(t.category)
        );
      }
      
      if (preferences.types) {
        candidates = candidates.filter(t => 
          preferences.types.includes(t.type)
        );
      }
      
      // Trier par popularité et date
      candidates.sort((a, b) => {
        const scoreA = (a.popularity || 0) + (this._getRecencyScore(a));
        const scoreB = (b.popularity || 0) + (this._getRecencyScore(b));
        return scoreB - scoreA;
      });
      
      return candidates.slice(0, 10);

    } catch (error) {
      console.error('Erreur getPersonalizedRecommendations:', error);
      return [];
    }
  }

  /**
   * Rafraîchit la liste des templates
   */
  async refreshTemplates() {
    this.templates = await templatesIndex.getAllTemplates();
    recommendationCache.clear();
  }

  // =============================
  // FONCTIONS PRIVÉES
  // =============================

  /**
   * Génère une clé de cache
   * @private
   */
  _getCacheKey(prompt, options) {
    return `${prompt}:${JSON.stringify(options)}`;
  }

  /**
   * Filtre les templates disponibles
   * @private
   */
  _filterTemplates(analysis, suggestions) {
    // ✅ CORRIGÉ: Utiliser analysis.type.type au lieu de analysis.types.primary.type
    const primaryType = analysis.type?.type || suggestions.type;
    
    return this.templates.filter(template => {
      // Correspondance par type
      if (template.type === primaryType) return true;
      
      // Correspondance par catégorie
      if (template.category === analysis.category?.category) return true;
      
      // ✅ CORRIGÉ: analysis.features est un tableau de strings
      const hasFeatures = analysis.features?.some(feature => 
        template.supportedFeatures?.includes(feature)
      );
      
      return hasFeatures;
    });
  }

  /**
   * Calcule les scores des templates
   * @private
   */
  async _scoreTemplates(candidates, analysis, options = {}) {
    const scored = [];
    
    for (const template of candidates) {
      let score = 0;
      
      // ✅ CORRIGÉ: Utiliser analysis.type au lieu de analysis.types
      if (template.type === analysis.type?.type) {
        score += WEIGHTS.type * (analysis.type?.score || 0.5);
      }
      
      // ✅ CORRIGÉ: analysis.features est un tableau de strings
      const featureMatch = analysis.features?.filter(feature =>
        template.supportedFeatures?.includes(feature)
      ).length || 0;
      
      if (analysis.features?.length > 0) {
        score += WEIGHTS.features * (featureMatch / analysis.features.length);
      }
      
      // Score basé sur la complexité
      const complexityMatch = template.complexity === analysis.complexity?.level ? 1 : 0.5;
      score += WEIGHTS.complexity * complexityMatch;
      
      // Score basé sur la popularité
      const popularityScore = (template.popularity || 0) / 100;
      score += WEIGHTS.popularity * Math.min(popularityScore, 1);
      
      // Bonus pour les templates récents
      if (this._isRecent(template)) {
        score += 0.05;
      }
      
      scored.push({
        ...template,
        score: Math.min(score, 1)
      });
    }
    
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Sélectionne le meilleur template
   * @private
   */
  _selectBest(scored) {
    if (scored.length === 0) {
      return this._getDefaultTemplate();
    }
    
    return scored[0];
  }

  /**
   * Enrichit un template avec des métadonnées
   * @private
   */
  _enrichTemplate(template, analysis) {
    return {
      ...template,
      matchScore: template.score,
      confidence: analysis.confidence || 0.5,
      recommendedFor: {
        // ✅ CORRIGÉ: Utiliser analysis.type au lieu de analysis.types
        type: analysis.type?.type || 'unknown',
        features: analysis.features || [],
        complexity: analysis.complexity?.level || 'medium'
      },
      estimatedTime: analysis.complexity?.estimatedMinutes || 15,
      // ✅ CORRIGÉ: analysis.type.all au lieu de analysis.types.all
      alternatives: analysis.type?.alternatives?.slice(0, 3) || []
    };
  }

  /**
   * Vérifie si un template est récent
   * @private
   */
  _isRecent(template) {
    if (!template.createdAt) return false;
    
    const created = new Date(template.createdAt);
    const now = new Date();
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    
    return daysDiff < 30; // Moins de 30 jours
  }

  /**
   * Calcule un score de récence
   * @private
   */
  _getRecencyScore(template) {
    if (!template.updatedAt) return 0;
    
    const updated = new Date(template.updatedAt);
    const now = new Date();
    const daysDiff = (now - updated) / (1000 * 60 * 60 * 24);
    
    return Math.max(0, 1 - daysDiff / 90); // Score décroissant sur 90 jours
  }

  /**
   * Met à jour les statistiques
   * @private
   */
  _updateStats(template) {
    stats.totalSelections++;
    
    if (template.category) {
      stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;
    }
    
    if (template.type) {
      stats.byType[template.type] = (stats.byType[template.type] || 0) + 1;
    }
  }

  /**
   * Template par défaut (fallback)
   * @private
   */
  _getDefaultTemplate() {
    return {
      id: 'default-todo',
      name: 'Todo App Basique',
      type: 'todo',
      category: 'productivity',
      description: 'Application de tâches simple et efficace',
      complexity: 'simple',
      estimatedTime: 5,
      score: 0.5,
      isDefault: true
    };
  }
}

// =============================
// HOOKS REACT (AVEC IMPORTS CORRIGÉS)
// =============================

/**
 * Hook React pour utiliser le sélecteur de templates
 */
export const useTemplateSelector = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const selector = useRef(null);

  useEffect(() => {
    selector.current = new TemplateSelector();
    selector.current.initialize().then(() => {
      setTemplates(selector.current.templates);
      setLoading(false);
    });
  }, []);

  const selectTemplate = useCallback(async (prompt, options) => {
    if (!selector.current) throw new Error('Selector not initialized');
    return selector.current.selectTemplate(prompt, options);
  }, []);

  const selectTopTemplates = useCallback(async (prompt, count) => {
    if (!selector.current) throw new Error('Selector not initialized');
    return selector.current.selectTopTemplates(prompt, count);
  }, []);

  return {
    loading,
    templates,
    selectTemplate,
    selectTopTemplates,
    refresh: useCallback(() => selector.current?.refreshTemplates(), [])
  };
};

// =============================
// EXPORT (SINGLETON)
// =============================
export const templateSelector = new TemplateSelector();

// Initialisation automatique
if (typeof window !== 'undefined') {
  templateSelector.initialize().catch(console.error);
}

export default templateSelector;
