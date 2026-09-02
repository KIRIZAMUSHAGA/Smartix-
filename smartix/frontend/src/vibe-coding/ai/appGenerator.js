/**
 * Générateur d'applications pour le module Vibe-Coding
 * Version corrigée avec:
 * - Imports React ajoutés
 * - Variables cohérentes
 * - Cache robuste
 * - Chargement complet des templates
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { projectManager } from '../core/projectManager';
import { generateProjectId } from '../utils/idGenerator';
import { parsePrompt } from './promptParser';
import { templateSelector } from './templateSelector';
import { templatesIndex } from '../templates/templatesIndex';
import { codeGenerator } from './codeGenerator';

// =============================
// APPEL API IA (backend proxy — clé OpenAI jamais exposée côté client)
// =============================

const _getAuthToken = () =>
  localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;

/**
 * Génère du code via le backend OpenAI proxy.
 * Retourne null si le service est indisponible (fallback templates).
 * @param {string} prompt
 * @param {string} projectType
 * @param {string[]} features
 * @param {string} name
 * @returns {Promise<{files: Object, description: string}|null>}
 */
const _generateViaAPI = async (prompt, projectType = 'react', features = [], name = '') => {
  try {
    const token = _getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, project_type: projectType, features, name }),
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.files && Object.keys(data.files).length > 0 ? data : null;
  } catch {
    return null;
  }
};

// Imports React pour le hook
import { useState, useEffect, useRef, useCallback } from 'react';

// =============================
// CONFIGURATION
// =============================

// Variables à remplacer dans les templates (format cohérent)
const TEMPLATE_VARIABLES = {
  projectName: '{{PROJECT_NAME}}',
  projectId: '{{PROJECT_ID}}',
  appName: '{{APP_NAME}}',
  currentYear: '{{CURRENT_YEAR}}',
  author: '{{AUTHOR}}',
  description: '{{DESCRIPTION}}',
  userId: '{{USER_ID}}',
  timestamp: '{{TIMESTAMP}}'
};

// Extensions de fichiers à traiter
const PROCESSABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md'];

// Cache des projets générés
const generationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Statistiques de génération
const stats = {
  totalGenerations: 0,
  successfulGenerations: 0,
  failedGenerations: 0,
  byTemplate: {}
};

// =============================
// CLASSE APP GENERATOR
// =============================

class AppGenerator {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialise le générateur
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.initialized = true;
      console.log('✅ AppGenerator initialized');
    } catch (error) {
      console.error('❌ AppGenerator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Génère une application à partir d'un prompt
   * @param {string} prompt - Prompt utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Object>} Projet généré
   */
  async generateFromPrompt(prompt, userId, options = {}) {
    try {
      stats.totalGenerations++;

      const analysis  = parsePrompt(prompt);
      const projectName = options.name || this._extractName(prompt, analysis);
      const projectType = options.type || analysis.type || 'react';

      // ── Tentative 1 : Génération via API OpenAI (backend proxy) ──────────────
      const aiResult = await _generateViaAPI(
        prompt,
        projectType,
        analysis.features || [],
        projectName
      );

      if (aiResult?.files && Object.keys(aiResult.files).length > 0) {
        console.log('✅ AppGenerator: code généré via IA');

        const projectId = generateProjectId();
        const project   = await projectManager.createProject({
          name:        projectName,
          userId,
          type:        projectType,
          templateId:  'ai-generated',
          config: {
            description:   aiResult.description || prompt,
            generatedFrom: 'openai',
            entryPoint:    aiResult.entryPoint || null
          },
          files: aiResult.files
        });

        stats.successfulGenerations++;
        stats.byTemplate['ai-generated'] = (stats.byTemplate['ai-generated'] || 0) + 1;
        return project;
      }

      // ── Fallback : templates locaux ───────────────────────────────────────────
      console.log('ℹ️ AppGenerator: API IA indisponible — fallback templates locaux');
      const template = await templateSelector.selectTemplate(prompt, options);
      const project  = await this.generateFromTemplate(template, {
        ...options,
        name: projectName,
        description: prompt,
        userId,
        analysis
      });

      stats.successfulGenerations++;
      stats.byTemplate[template.id] = (stats.byTemplate[template.id] || 0) + 1;
      return project;

    } catch (error) {
      stats.failedGenerations++;
      console.error('Erreur generateFromPrompt:', error);
      throw error;
    }
  }

  /**
   * Génère une application à partir d'un template
   * @param {Object} template - Template à utiliser
   * @param {Object} options - Options de génération
   * @returns {Promise<Object>} Projet généré
   */
  async generateFromTemplate(template, options = {}) {
    try {
      const {
        name = 'Nouveau projet',
        description = '',
        userId,
        analysis = null,
        customVariables = {}
      } = options;

      // Vérifier le cache
      const cacheKey = this._getCacheKey(template.id, name, userId);
      const cached = generationCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.project;
      }

      // ✅ Charger le template complet
      const fullTemplate = await templatesIndex.getTemplate(template.id);
      if (!fullTemplate) {
        throw new Error(`Template ${template.id} non trouvé`);
      }

      // Charger les fichiers du template
      const templateFiles = await this._loadTemplateFiles(fullTemplate);
      
      // Générer l'ID du projet
      const projectId = generateProjectId();
      
      // Préparer les variables de remplacement (format cohérent)
      const variables = this._prepareVariables({
        projectName: name,
        projectId,
        appName: name.replace(/\s+/g, ''),
        currentYear: new Date().getFullYear().toString(),
        author: userId || 'anonymous',
        description,
        userId,
        timestamp: Date.now().toString()
      }, customVariables);
      
      // Traiter les fichiers (remplacer les variables)
      const processedFiles = await this._processFiles(templateFiles, variables);
      
      // Créer la structure initiale
      const initialFiles = {
        'package.json': await this._generatePackageJson(fullTemplate, variables),
        ...processedFiles
      };
      
      // Ajouter les fichiers générés par l'IA si nécessaire
      if (analysis?.features?.length > 0) {
        const generatedFiles = await codeGenerator.generateFeatures(
          analysis.features,
          fullTemplate.type,
          variables
        );
        Object.assign(initialFiles, generatedFiles);
      }
      
      // Créer le projet
      const project = await projectManager.createProject({
        name,
        userId,
        type: fullTemplate.type,
        templateId: fullTemplate.id,
        config: {
          ...fullTemplate.config,
          description,
          generatedFrom: 'template',
          templateVersion: fullTemplate.version
        },
        files: initialFiles
      });
      
      // Mettre en cache
      generationCache.set(cacheKey, {
        project,
        timestamp: Date.now()
      });

      return project;

    } catch (error) {
      console.error('Erreur generateFromTemplate:', error);
      throw error;
    }
  }

  /**
   * Régénère une application (mise à jour)
   * @param {string} projectId - ID du projet
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} updates - Mises à jour
   * @returns {Promise<Object>} Projet mis à jour
   */
  async regenerateProject(projectId, userId, updates = {}) {
    try {
      // Charger le projet existant
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error('Projet non trouvé');
      }

      // ✅ Charger le template complet
      const fullTemplate = await templatesIndex.getTemplate(project.templateId);
      if (!fullTemplate) {
        throw new Error(`Template ${project.templateId} non trouvé`);
      }

      // Re-générer avec les mises à jour
      const updated = await this.generateFromTemplate(
        fullTemplate,
        {
          name: updates.name || project.name,
          description: updates.description || project.description,
          userId,
          customVariables: {
            ...project,
            ...updates
          }
        }
      );

      return updated;

    } catch (error) {
      console.error('Erreur regenerateProject:', error);
      throw error;
    }
  }

  /**
   * Valide qu'un projet peut être généré
   * @param {Object} template - Template à valider
   * @returns {Object} Résultat de la validation
   */
  async validateTemplate(template) {
    const errors = [];
    const warnings = [];

    if (!template) {
      errors.push('Template requis');
      return { isValid: false, errors, warnings };
    }

    if (!template.id) {
      errors.push('ID de template requis');
    }

    const fullTemplate = await templatesIndex.getTemplate(template.id);
    if (!fullTemplate) {
      errors.push(`Template ${template.id} non trouvé dans l'index`);
    }

    if (!fullTemplate?.files || Object.keys(fullTemplate.files).length === 0) {
      errors.push('Le template doit contenir des fichiers');
    }

    if (!fullTemplate?.type) {
      warnings.push('Type de template non spécifié');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    generationCache.clear();
  }

  /**
   * Obtient les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...stats,
      cacheSize: generationCache.size,
      successRate: stats.totalGenerations > 0
        ? (stats.successfulGenerations / stats.totalGenerations) * 100
        : 0
    };
  }

  // =============================
  // FONCTIONS PRIVÉES
  // =============================

  /**
   * Génère une clé de cache robuste
   * @private
   */
  _getCacheKey(templateId, name, userId) {
    // Utiliser une combinaison stable pour la clé
    return `${templateId}:${name}:${userId}:${Date.now()}`;
  }

  /**
   * Charge les fichiers d'un template
   * @private
   */
  async _loadTemplateFiles(template) {
    try {
      // Utiliser templatesIndex pour charger les fichiers
      return await templatesIndex.loadTemplateFiles(template.id);
    } catch (error) {
      console.warn(`Impossible de charger les fichiers du template ${template.id}:`, error);
      return {};
    }
  }

  /**
   * Prépare les variables de remplacement
   * @private
   */
  _prepareVariables(baseVars, customVars = {}) {
    return {
      ...baseVars,
      ...customVars
    };
  }

  /**
   * Traite les fichiers en remplaçant les variables
   * @private
   */
  async _processFiles(files, variables) {
    const processed = {};

    for (const [path, content] of Object.entries(files)) {
      if (this._shouldProcessFile(path)) {
        processed[path] = this._replaceVariables(content, variables);
      } else {
        processed[path] = content;
      }
    }

    return processed;
  }

  /**
   * Vérifie si un fichier doit être traité
   * @private
   */
  _shouldProcessFile(path) {
    const ext = path.substring(path.lastIndexOf('.'));
    return PROCESSABLE_EXTENSIONS.includes(ext);
  }

  /**
   * Remplace les variables dans un contenu
   * @private
   */
  _replaceVariables(content, variables) {
    if (typeof content !== 'string') return content;

    let result = content;
    
    // Remplacer toutes les variables du template
    Object.entries(variables).forEach(([key, value]) => {
      // Format: {{KEY}} ou {{key}} - on remplace les deux
      const patterns = [
        new RegExp(`{{${key.toUpperCase()}}}`, 'g'),
        new RegExp(`{{${key.toLowerCase()}}}`, 'g'),
        new RegExp(`{{${key}}}`, 'g')
      ];
      
      patterns.forEach(pattern => {
        result = result.replace(pattern, value);
      });
    });

    return result;
  }

  /**
   * Génère un package.json
   * @private
   */
  async _generatePackageJson(template, variables) {
    const defaultPackage = {
      name: variables.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      description: variables.description || '',
      author: variables.author || '',
      license: 'MIT',
      dependencies: template.dependencies || {},
      devDependencies: template.devDependencies || {},
      scripts: template.scripts || {
        'start': 'react-scripts start',
        'build': 'react-scripts build',
        'test': 'react-scripts test'
      }
    };

    return JSON.stringify(defaultPackage, null, 2);
  }

  /**
   * Extrait un nom de projet du prompt
   * @private
   */
  _extractName(prompt, analysis) {
    // Prendre les premiers mots significatifs
    const words = prompt.split(' ').filter(w => w.length > 3);
    let name = words.slice(0, 3).join(' ');
    
    // Capitaliser
    name = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return name || 'Nouveau projet';
  }
}

// =============================
// HOOKS REACT (AVEC IMPORTS CORRIGÉS)
// =============================

/**
 * Hook React pour utiliser le générateur d'applications
 */
export const useAppGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastGenerated, setLastGenerated] = useState(null);
  const generator = useRef(null);

  useEffect(() => {
    generator.current = new AppGenerator();
    generator.current.initialize().catch(console.error);
  }, []);

  const generateFromPrompt = useCallback(async (prompt, userId, options) => {
    setLoading(true);
    setError(null);
    
    try {
      const project = await generator.current.generateFromPrompt(prompt, userId, options);
      setLastGenerated(project);
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateFromTemplate = useCallback(async (template, options) => {
    setLoading(true);
    setError(null);
    
    try {
      const project = await generator.current.generateFromTemplate(template, options);
      setLastGenerated(project);
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    lastGenerated,
    generateFromPrompt,
    generateFromTemplate,
    validateTemplate: useCallback((template) => generator.current?.validateTemplate(template), []),
    getStats: useCallback(() => generator.current?.getStats(), [])
  };
};

// =============================
// EXPORT (SINGLETON)
// =============================
export const appGenerator = new AppGenerator();

// Initialisation automatique
if (typeof window !== 'undefined') {
  appGenerator.initialize().catch(console.error);
}

export default appGenerator;
