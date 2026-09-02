/**
 * Auto Store Optimization (ASO)
 * 
 * Rôle: Optimiser automatiquement les fiches stores
 * - génération description optimisée
 * - génération mots clés
 * - suggestion screenshots
 * - optimisation titre
 */

import { appGenerator } from '../ai/appGenerator'

export const ASO_STORES = {
  GOOGLE_PLAY: 'google_play',
  APP_STORE: 'app_store',
  INTERNAL: 'internal'
}

// Configuration des prompts par store
const STORE_PROMPTS = {
  [ASO_STORES.GOOGLE_PLAY]: `
    Optimise pour le Google Play Store:
    - Titre: 50 caractères max
    - Description courte: 80 caractères max
    - Description longue: 4000 caractères max
    - Mots-clés: séparés par des virgules
  `,
  [ASO_STORES.APP_STORE]: `
    Optimise pour l'Apple App Store:
    - Titre: 30 caractères max
    - Sous-titre: 30 caractères max
    - Description: 4000 caractères max
    - Mots-clés: 100 caractères max
  `,
  [ASO_STORES.INTERNAL]: `
    Optimise pour le marketplace interne:
    - Titre: 50 caractères max
    - Description: 2000 caractères max
    - Tags: 5-10 tags pertinents
  `
}

// Cache simple pour éviter les appels IA redondants
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

class ASOOptimizer {
  constructor() {
    this.initialized = false
    this.cache = new Map()
    this.stats = {
      totalGenerations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    }
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    console.log("✅ ASO Optimizer initialisé")
  }

  /**
   * Génère une fiche store optimisée
   */
  async generateOptimizedMetadata(project, store) {
    if (!project || !store) {
      throw new Error("Projet et store requis")
    }

    // Vérifier le cache
    const cacheKey = `metadata_${project.id || project.name}_${store}`
    const cached = this._getFromCache(cacheKey)
    if (cached) return cached

    const prompt = this._buildPrompt(project, store)
    
    try {
      const result = await appGenerator.generateText({
        prompt,
        temperature: 0.7,
        maxTokens: 1000
      })

      const parsed = this._parseOptimizedMetadata(result, project, store)
      
      // Mettre en cache
      this._setCache(cacheKey, parsed)
      
      return parsed
    } catch (error) {
      this.stats.errors++
      console.error("❌ Erreur génération ASO:", error)
      
      // Fallback aux données du projet
      return this._getFallbackMetadata(project, store)
    }
  }

  /**
   * Génère les mots clés ASO
   */
  async generateKeywords(project, count = 20) {
    if (!project) throw new Error("Projet requis")

    const cacheKey = `keywords_${project.id || project.name}`
    const cached = this._getFromCache(cacheKey)
    if (cached) return cached

    const prompt = `
    Génère ${count} mots clés ASO pour une application mobile.
    
    Format: liste séparée par des virgules, pas de numérotation.
    
    Nom: ${project.name}
    
    Description:
    ${project.description || ''}
    
    Fonctionnalités:
    ${project.features?.join(", ") || 'non spécifiées'}
    
    Catégorie: ${project.category || 'générale'}
    `

    try {
      const result = await appGenerator.generateText({ 
        prompt,
        temperature: 0.5
      })

      const keywords = result
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k && k.length > 2)
        .slice(0, count)

      // Nettoyer et dédupliquer
      const uniqueKeywords = [...new Set(keywords)]
      
      this._setCache(cacheKey, uniqueKeywords)
      
      return uniqueKeywords
    } catch (error) {
      this.stats.errors++
      console.error("❌ Erreur génération keywords:", error)
      return project.keywords || []
    }
  }

  /**
   * Génère une description store optimisée
   */
  async generateDescription(project, store = ASO_STORES.INTERNAL) {
    if (!project) throw new Error("Projet requis")

    const cacheKey = `description_${project.id || project.name}_${store}`
    const cached = this._getFromCache(cacheKey)
    if (cached) return cached

    const prompt = `
    Rédige une description optimisée pour le store mobile (${store}).

    Application: ${project.name}

    Description actuelle:
    ${project.description || ''}

    Fonctionnalités principales:
    ${project.features?.slice(0, 5).join("\n- ") || 'non spécifiées'}

    Public cible: ${project.targetAudience || 'grand public'}

    Points forts uniques:
    ${project.usp?.join("\n- ") || 'à définir'}

    Instructions:
    - Ton professionnel et engageant
    - Mettre en avant les bénéfices utilisateur
    - Inclure un appel à l'action
    - Format: 3-4 paragraphes
    `

    try {
      const description = await appGenerator.generateText({ 
        prompt,
        temperature: 0.7
      })

      const cleaned = this._cleanDescription(description)
      this._setCache(cacheKey, cleaned)
      
      return cleaned
    } catch (error) {
      this.stats.errors++
      console.error("❌ Erreur génération description:", error)
      return project.description || ''
    }
  }

  /**
   * Génère les suggestions screenshots
   */
  async generateScreenshotIdeas(project, count = 5) {
    if (!project) throw new Error("Projet requis")

    const cacheKey = `screenshots_${project.id || project.name}`
    const cached = this._getFromCache(cacheKey)
    if (cached) return cached

    const prompt = `
    Génère ${count} idées de screenshots pour présenter une application mobile.

    Application: ${project.name}

    Fonctionnalités principales:
    ${project.features?.slice(0, 5).map(f => `- ${f}`).join('\n') || 'non spécifiées'}

    Pour chaque idée, décris:
    - Ce qui est montré à l'écran
    - La valeur utilisateur démontrée
    - Un titre accrocheur

    Format: une idée par ligne, séparée par "---"
    `

    try {
      const result = await appGenerator.generateText({ 
        prompt,
        temperature: 0.8
      })

      const ideas = result
        .split('---')
        .map(i => i.trim())
        .filter(i => i && i.length > 20)
        .slice(0, count)

      const formattedIdeas = ideas.map(idea => {
        const lines = idea.split('\n').filter(l => l.trim())
        return {
          title: lines[0] || 'Capture d\'écran',
          description: lines.slice(1).join(' '),
          raw: idea
        }
      })

      this._setCache(cacheKey, formattedIdeas)
      
      return formattedIdeas
    } catch (error) {
      this.stats.errors++
      console.error("❌ Erreur génération screenshots:", error)
      return []
    }
  }

  /**
   * Génère un titre optimisé store
   */
  async generateTitle(project, store = ASO_STORES.INTERNAL) {
    if (!project) throw new Error("Projet requis")

    const cacheKey = `title_${project.id || project.name}_${store}`
    const cached = this._getFromCache(cacheKey)
    if (cached) return cached

    const maxLength = store === ASO_STORES.APP_STORE ? 30 : 50

    const prompt = `
    Génère un titre optimisé ASO pour une application mobile.

    Titre actuel: ${project.name}

    Description:
    ${project.description || ''}

    Fonctionnalités clés:
    ${project.features?.slice(0, 3).join(", ") || 'non spécifiées'}

    Contraintes:
    - Maximum ${maxLength} caractères
    - Inclure les mots-clés principaux
    - Accrocheur et mémorable
    - Pas de numéros ou symboles spéciaux

    Génère UNIQUEMENT le titre, sans guillemets.
    `

    try {
      const title = await appGenerator.generateText({ 
        prompt,
        temperature: 0.6,
        maxTokens: 50
      })

      const cleaned = title
        .trim()
        .replace(/["']/g, '')
        .slice(0, maxLength)

      this._setCache(cacheKey, cleaned)
      
      return cleaned
    } catch (error) {
      this.stats.errors++
      console.error("❌ Erreur génération titre:", error)
      return project.name
    }
  }

  /**
   * Construit le prompt IA optimisé
   * @private
   */
  _buildPrompt(project, store) {
    const storePrompt = STORE_PROMPTS[store] || STORE_PROMPTS[ASO_STORES.INTERNAL]

    return `
    ${storePrompt}

    Informations de l'application:
    ============================
    Nom: ${project.name}
    Description: ${project.description || 'À définir'}
    Catégorie: ${project.category || 'générale'}
    
    Fonctionnalités principales:
    ${project.features?.slice(0, 5).map(f => `- ${f}`).join('\n') || '- À définir'}

    Public cible: ${project.targetAudience || 'grand public'}

    Tags existants: ${project.tags?.join(', ') || 'aucun'}

    Génère une fiche complète avec tous ces éléments au format JSON.
    `
  }

  /**
   * Parse la réponse IA pour les métadonnées
   * @private
   */
  _parseOptimizedMetadata(text, project, store) {
    // Essayer de parser du JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          title: parsed.title || project.name,
          subtitle: parsed.subtitle || '',
          description: parsed.description || text,
          shortDescription: parsed.shortDescription || (parsed.description || text).slice(0, 80),
          keywords: parsed.keywords || [],
          category: parsed.category || project.category || 'productivity',
          tags: parsed.tags || project.tags || [],
          screenshots: parsed.screenshots || [],
          optimized: true,
          store
        }
      }
    } catch {
      // Ignorer, on utilisera le parsing simple
    }

    // Parsing simple
    const lines = text.split('\n').filter(l => l.trim())
    
    return {
      title: project.name,
      description: text,
      shortDescription: text.slice(0, 80),
      keywords: this._extractKeywords(text),
      category: project.category || 'productivity',
      tags: project.tags || [],
      optimized: true,
      store
    }
  }

  /**
   * Extrait les mots clés du texte
   * @private
   */
  _extractKeywords(text) {
    // Chercher des sections "mots-clés" ou "keywords"
    const keywordMatch = text.match(/(?:mots[-\s]clés?|keywords?)[\s:]+([^\n]+)/i)
    if (keywordMatch) {
      return keywordMatch[1]
        .split(/[,;]/)
        .map(k => k.trim().toLowerCase())
        .filter(k => k && k.length > 2)
    }

    // Sinon, extraire les mots significatifs
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3 && !this._isCommonWord(w))
      .slice(0, 20)

    return [...new Set(words)]
  }

  /**
   * Nettoie une description
   * @private
   */
  _cleanDescription(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  }

  /**
   * Vérifie si un mot est commun
   * @private
   */
  _isCommonWord(word) {
    const commonWords = new Set([
      'avec', 'cette', 'notre', 'votre', 'pour', 'dans', 
      'cela', 'cette', 'tous', 'leur', 'sont', 'plus'
    ])
    return commonWords.has(word)
  }

  /**
   * Récupère les métadonnées de fallback
   * @private
   */
  _getFallbackMetadata(project, store) {
    return {
      title: project.name,
      description: project.description || 'Application mobile',
      shortDescription: (project.description || 'Application').slice(0, 80),
      keywords: project.keywords || [],
      category: project.category || 'productivity',
      tags: project.tags || [],
      optimized: false,
      store
    }
  }

  /**
   * Récupère depuis le cache
   * @private
   */
  _getFromCache(key) {
    const cached = this.cache.get(key)
    if (!cached) {
      this.stats.cacheMisses++
      return null
    }

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(key)
      this.stats.cacheMisses++
      return null
    }

    this.stats.cacheHits++
    return cached.data
  }

  /**
   * Stocke dans le cache
   * @private
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    this.stats.totalGenerations++
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear()
    console.log("🧹 Cache ASO vidé")
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: totalRequests > 0 
        ? (this.stats.cacheHits / totalRequests * 100).toFixed(2) 
        : 0
    }
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    this.cache.clear()
    this.stats = {
      totalGenerations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    }
  }
}

export const asoOptimizer = new ASOOptimizer()
export default asoOptimizer
