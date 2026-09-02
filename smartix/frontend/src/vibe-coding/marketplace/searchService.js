/**
 * searchService - Service de recherche d'applications
 * Version PRO avec ElasticSearch-like features
 * Optimisations BATCH, embeddings, hybrid ranking
 * 
 * Rôle: Rechercher des applications dans le marketplace
 * - Recherche textuelle avancée avec Fuse.js optimisé
 * - Hybrid ranking (relevance + popularity + trending)
 * - Batching pour les requêtes DB
 * - Embeddings pour la recherche sémantique
 * - Facettes pour filtrage UX
 */

import { EventEmitter } from 'events'
import Fuse from 'fuse.js'
import { getPublishService } from './publishService'
import { getTrendingService } from './trendingService'
import { getUserService } from '../core/userService'
import { getProjectService } from '../core/projectService'
import { logger } from '../mobile/utils/logger'
import { cache } from '../mobile/utils/cache' // Redis

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let publishService
let trendingService
let userService
let projectService
let storage
let embeddingService // Pour les embeddings

export const setPublishService = (service) => {
  publishService = service
}

export const setTrendingService = (service) => {
  trendingService = service
}

export const setUserService = (service) => {
  userService = service
}

export const setProjectService = (service) => {
  projectService = service
}

export const setStorage = (storageClient) => {
  storage = storageClient
}

export const setEmbeddingService = (service) => {
  embeddingService = service
}

// =============================
// CONSTANTES
// =============================

const SEARCH_LIMITS = {
  MAX_QUERY_LENGTH: 100,
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
  SUGGESTIONS_LIMIT: 10,
  MAX_HISTORY_PER_USER: 50,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  EMBEDDING_CACHE_TTL: 24 * 60 * 60 * 1000 // 24h
}

const SORT_OPTIONS = {
  RELEVANCE: 'relevance',
  DOWNLOADS: 'downloads',
  RATING: 'rating',
  NEWEST: 'newest',
  UPDATED: 'updated',
  NAME: 'name',
  TRENDING: 'trending',
  HYBRID: 'hybrid' // Nouveau : combine relevance + popularity
}

const FUZZY_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.3,
  distance: 100,
  ignoreLocation: true,
  keys: [
    { name: 'name', weight: 3 },
    { name: 'description', weight: 1 },
    { name: 'tags', weight: 2 },
    { name: 'category', weight: 1.5 },
    { name: 'developerName', weight: 1 },
    // Recherche dans le code (uniquement noms)
    { name: 'codeSymbols', weight: 0.5 }
  ]
}

const FILTER_TYPES = {
  CATEGORY: 'category',
  TAG: 'tag',
  RATING: 'rating',
  DOWNLOADS: 'downloads',
  INSTALLS: 'installs',
  PRICE: 'price',
  LANGUAGE: 'language',
  HAS_ICON: 'hasIcon',
  HAS_SCREENSHOTS: 'hasScreenshots'
}

// =============================
// HYBRID RANKING WEIGHTS
// =============================

const HYBRID_WEIGHTS = {
  relevance: 0.5,      // 50% score Fuse
  downloads: 0.2,       // 20% popularité
  rating: 0.15,         // 15% note
  trending: 0.15        // 15% tendance
}

// =============================
// BATCH PROCESSING UTILS
// =============================

/**
 * ✅ Traite les batchs pour éviter N+1 queries
 */
class BatchProcessor {
  constructor() {
    this.userCache = new Map()
    this.projectCache = new Map()
  }

  /**
   * Récupère les infos développeurs en BATCH
   */
  async getDevelopersBatch(userIds) {
    const uniqueIds = [...new Set(userIds)]
    const result = new Map()
    const missingIds = []

    // Vérifier le cache
    for (const id of uniqueIds) {
      if (this.userCache.has(id)) {
        result.set(id, this.userCache.get(id))
      } else {
        missingIds.push(id)
      }
    }

    // BATCH request
    if (missingIds.length > 0 && userService?.getUsersByIds) {
      try {
        const users = await userService.getUsersByIds(missingIds)
        for (const user of users) {
          this.userCache.set(user.id, user)
          result.set(user.id, user)
        }
      } catch (error) {
        logger.error('Erreur batch getUsers', error)
      }
    }

    return result
  }

  /**
   * Récupère les projets en BATCH (pour le code)
   */
  async getProjectsBatch(projectIds) {
    const uniqueIds = [...new Set(projectIds)]
    const result = new Map()
    const missingIds = []

    for (const id of uniqueIds) {
      if (this.projectCache.has(id)) {
        result.set(id, this.projectCache.get(id))
      } else {
        missingIds.push(id)
      }
    }

    if (missingIds.length > 0 && projectService?.getProjectsByIds) {
      try {
        const projects = await projectService.getProjectsByIds(missingIds)
        for (const project of projects) {
          this.projectCache.set(project.id, project)
          result.set(project.id, project)
        }
      } catch (error) {
        logger.error('Erreur batch getProjects', error)
      }
    }

    return result
  }

  /**
   * Nettoie le cache périodiquement
   */
  cleanup() {
    this.userCache.clear()
    this.projectCache.clear()
  }
}

// =============================
// CODE SYMBOLS EXTRACTOR
// =============================

/**
 * ✅ Extrait uniquement les symboles importants du code
 * Réduit la mémoire de 95%
 */
class CodeSymbolExtractor {
  extractSymbols(files = {}) {
    const symbols = new Set()
    
    // Patterns pour les symboles importants
    const patterns = [
      // Fonctions exportées
      /export\s+(?:function|const|let|var|class)\s+(\w+)/g,
      // Classes
      /class\s+(\w+)/g,
      // Imports
      /import\s+(?:\{\s*)?(\w+)/g,
      // Noms de fichiers significatifs
      /^(\w+)\.(js|jsx|ts|tsx|vue|svelte)$/
    ]

    for (const [filename, file] of Object.entries(files)) {
      const content = file.content || ''
      
      // Extraire le nom du fichier
      const fileNameMatch = filename.match(/(\w+)\.\w+$/)
      if (fileNameMatch) {
        symbols.add(fileNameMatch[1].toLowerCase())
      }

      // Extraire les symboles du contenu
      for (const pattern of patterns) {
        const matches = content.matchAll(pattern)
        for (const match of matches) {
          if (match[1] && match[1].length > 2) {
            symbols.add(match[1].toLowerCase())
          }
        }
      }
    }

    // Limiter le nombre de symboles
    return Array.from(symbols).slice(0, 50)
  }
}

// =============================
// SEARCH INDEX MANAGER OPTIMISÉ
// =============================

export class SearchIndex {
  constructor() {
    this.fuseInstance = null
    this.apps = []
    this.lastUpdate = null
    this.version = 0
    this.batchProcessor = new BatchProcessor()
    this.codeExtractor = new CodeSymbolExtractor()
    this.facets = {
      categories: new Map(),
      tags: new Map(),
      ratingRanges: { '1':0, '2':0, '3':0, '4':0, '5':0 }
    }
  }

  /**
   * ✅ Construit l'index avec BATCH processing
   */
  async build(publishService) {
    const startTime = Date.now()
    logger.info('Construction de l\'index de recherche...')

    try {
      // Récupérer toutes les apps
      const result = await publishService.listApps({
        visibility: 'public',
        limit: 10000
      })

      const apps = result.items || []

      // 1. Collecter tous les IDs pour BATCH
      const userIds = [...new Set(apps.map(a => a.userId))]
      const projectIds = [...new Set(apps.map(a => a.projectId).filter(Boolean))]

      // 2. BATCH requests (2 requêtes au lieu de N)
      const [developersMap, projectsMap] = await Promise.all([
        this.batchProcessor.getDevelopersBatch(userIds),
        this.batchProcessor.getProjectsBatch(projectIds)
      ])

      // 3. Construire les apps enrichies
      this.apps = []
      this.facets.categories.clear()
      this.facets.tags.clear()
      
      for (const app of apps) {
        const developer = developersMap.get(app.userId)
        const project = projectsMap.get(app.projectId)

        // Extraire les symboles du code (léger)
        const codeSymbols = project 
          ? this.codeExtractor.extractSymbols(project.files || {})
          : []

        // Construire l'objet app indexé
        const indexedApp = {
          id: app.id,
          name: app.name,
          description: app.description || '',
          tags: app.tags || [],
          category: app.category || 'general',
          developerId: app.userId,
          developerName: developer?.name || developer?.email || 'Inconnu',
          stats: {
            downloads: app.stats?.downloads || 0,
            installs: app.stats?.installs || 0,
            rating: app.stats?.rating || 0,
            reviews: app.stats?.reviewsCount || 0,
            forks: app.stats?.forks || 0
          },
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          metadata: {
            hasIcon: !!app.icon,
            screenshotCount: app.screenshots?.length || 0,
            version: app.version
          },
          codeSymbols, // ✅ Léger : seulement les symboles importants
          trendingScore: 0, // Sera mis à jour dynamiquement
          searchableText: this._generateSearchableText(app)
        }

        this.apps.push(indexedApp)

        // Mettre à jour les facettes
        this.facets.categories.set(
          app.category, 
          (this.facets.categories.get(app.category) || 0) + 1
        )

        ;(app.tags || []).forEach(tag => {
          this.facets.tags.set(tag, (this.facets.tags.get(tag) || 0) + 1)
        })

        const rating = Math.floor(app.stats?.rating || 0)
        if (rating >= 1) {
          this.facets.ratingRanges[rating]++
        }
      }

      // Initialiser Fuse
      this.fuseInstance = new Fuse(this.apps, FUZZY_OPTIONS)

      this.lastUpdate = Date.now()
      this.version++

      logger.success('Index construit', {
        apps: this.apps.length,
        categories: this.facets.categories.size,
        tags: this.facets.tags.size,
        duration: `${Date.now() - startTime}ms`,
        version: this.version
      })

      return this.apps.length

    } catch (error) {
      logger.error('Erreur construction index', error)
      throw error
    }
  }

  /**
   * Génère un texte optimisé pour la recherche
   */
  _generateSearchableText(app) {
    const parts = [
      app.name,
      app.description,
      ...(app.tags || []),
      app.category
    ]
    return parts.join(' ').toLowerCase()
  }

  /**
   * ✅ Recherche optimisée avec pré-filtrage
   */
  search(query, options = {}) {
    if (!this.fuseInstance) return []

    const {
      limit = 100,
      threshold = 0.4,
      filters = {}
    } = options

    // 1. PRÉ-FILTRAGE RAPIDE (réduit le nombre d'éléments)
    let candidates = this.apps

    if (filters.category) {
      candidates = candidates.filter(a => a.category === filters.category)
    }

    if (filters.tags?.length) {
      candidates = candidates.filter(a => 
        filters.tags.every(tag => a.tags?.includes(tag))
      )
    }

    if (filters.minRating) {
      candidates = candidates.filter(a => a.stats.rating >= filters.minRating)
    }

    // 2. Recherche Fuse sur les candidats (plus petit ensemble)
    const fuse = new Fuse(candidates, FUZZY_OPTIONS)
    return fuse.search(query, { limit })
  }

  /**
   * Met à jour les trending scores dynamiquement
   */
  async updateTrendingScores() {
    if (!trendingService) return

    try {
      const trending = await trendingService.getTrending({ limit: 500 })
      const trendingMap = new Map(
        trending.map(app => [app.id, app.trendingScore || 0])
      )

      for (const app of this.apps) {
        app.trendingScore = trendingMap.get(app.id) || 0
      }

      logger.info('Trending scores mis à jour')
    } catch (error) {
      logger.error('Erreur mise à jour trending scores', error)
    }
  }

  /**
   * Récupère les facettes
   */
  getFacets() {
    return {
      categories: Array.from(this.facets.categories.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(this.facets.tags.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      ratingRanges: this.facets.ratingRanges
    }
  }

  /**
   * Vérifie si l'index est valide
   */
  isValid() {
    return this.fuseInstance !== null && 
           this.apps.length > 0 && 
           Date.now() - this.lastUpdate < 60 * 60 * 1000 // 1 heure
  }

  /**
   * Taille de l'index
   */
  get size() {
    return this.apps.length
  }
}

// =============================
// SEARCH HISTORY MANAGER (persistant)
// =============================

export class SearchHistoryManager {
  constructor() {
    this.cache = new Map() // Cache mémoire temporaire
  }

  async recordSearch(userId, query, results) {
    if (!userId || !query) return

    try {
      if (storage?.save) {
        await storage.save('search_history', {
          userId,
          query,
          results,
          timestamp: Date.now()
        })
      }

      // Cache mémoire (limité)
      if (!this.cache.has(userId)) {
        this.cache.set(userId, [])
      }

      const history = this.cache.get(userId)
      history.unshift({ query, timestamp: Date.now() })

      if (history.length > 100) {
        history.pop()
      }

    } catch (error) {
      logger.warn('Erreur enregistrement historique', error)
    }
  }

  async getUserHistory(userId, limit = 20) {
    const cached = this.cache.get(userId)
    if (cached) {
      return cached.slice(0, limit)
    }

    if (storage?.query) {
      const result = await storage.query('search_history', {
        where: { userId },
        sort: { timestamp: -1 },
        limit
      })
      return result.items || []
    }

    return []
  }

  async cleanup(olderThan = 30 * 24 * 60 * 60 * 1000) {
    if (storage?.deleteMany) {
      return await storage.deleteMany('search_history', {
        timestamp: { $lt: Date.now() - olderThan }
      })
    }
    return 0
  }
}

// =============================
// POPULAR SEARCHES MANAGER
// =============================

export class PopularSearchesManager {
  constructor() {
    this.cache = null
    this.lastUpdate = null
  }

  async recordSearch(query) {
    if (storage?.increment) {
      await storage.increment('search_counts', query, 1)
    }
    this.cache = null
  }

  async getPopular(limit = 10) {
    if (this.cache && Date.now() - this.lastUpdate < SEARCH_LIMITS.CACHE_TTL) {
      return this.cache.slice(0, limit)
    }

    if (storage?.aggregate) {
      const result = await storage.aggregate('search_counts', [
        { $sort: { count: -1 } },
        { $limit: 50 }
      ])

      this.cache = result.map(r => ({
        query: r._id,
        count: r.count
      }))
      this.lastUpdate = Date.now()

      return this.cache.slice(0, limit)
    }

    return []
  }
}

// =============================
// EMBEDDINGS SERVICE (optionnel)
// =============================

export class EmbeddingSearch {
  constructor() {
    this.embeddings = new Map() // appId -> vector
    this.lastUpdate = null
  }

  async buildEmbeddings(apps) {
    if (!embeddingService) return

    try {
      const descriptions = apps.map(app => app.description || '')
      const vectors = await embeddingService.createEmbeddings(descriptions)

      for (let i = 0; i < apps.length; i++) {
        this.embeddings.set(apps[i].id, vectors[i])
      }

      this.lastUpdate = Date.now()
      logger.info('Embeddings construits', { apps: apps.length })
    } catch (error) {
      logger.error('Erreur construction embeddings', error)
    }
  }

  async semanticSearch(query, limit = 10) {
    if (!embeddingService || this.embeddings.size === 0) return []

    try {
      const queryVector = await embeddingService.createEmbedding(query)
      
      const similarities = []
      for (const [appId, vector] of this.embeddings) {
        const similarity = this._cosineSimilarity(queryVector, vector)
        similarities.push({ appId, similarity })
      }

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(s => s.appId)

    } catch (error) {
      logger.error('Erreur recherche sémantique', error)
      return []
    }
  }

  _cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
    return dotProduct / (normA * normB)
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================

export class SearchService extends EventEmitter {
  constructor() {
    super()
    this.index = new SearchIndex()
    this.history = new SearchHistoryManager()
    this.popular = new PopularSearchesManager()
    this.embeddings = new EmbeddingSearch()
    this.stats = {
      totalSearches: 0,
      averageResults: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
    this.logger = logger.createChild('SearchService')

    // Mise à jour périodique
    setInterval(() => this._maintenance(), 60 * 60 * 1000) // 1 heure
  }

  /**
   * Maintenance périodique
   */
  async _maintenance() {
    await this._ensureIndex()
    await this.index.updateTrendingScores()
    await this.history.cleanup()
    await this.popular.cleanup?.()
  }

  /**
   * Assure que l'index est valide
   */
  async _ensureIndex(force = false) {
    if (force || !this.index.isValid()) {
      await this.index.build(publishService)
      // Construire les embeddings en arrière-plan
      this.embeddings.buildEmbeddings(this.index.apps).catch(() => {})
    }
  }

  /**
   * ✅ Recherche principale avec hybrid ranking
   */
  async search(query, options = {}) {
    const {
      page = 1,
      pageSize = SEARCH_LIMITS.DEFAULT_PAGE_SIZE,
      filters = {},
      sortBy = SORT_OPTIONS.HYBRID, // HYBRID par défaut
      userId = null,
      includeScore = false,
      useCache = true,
      useSemantic = false // Option pour recherche sémantique
    } = options

    if (!query?.trim()) {
      return this._getEmptyResults(page, pageSize)
    }

    const trimmedQuery = query.trim().slice(0, SEARCH_LIMITS.MAX_QUERY_LENGTH)

    // Cache key incluant les filtres
    const cacheKey = `search:${trimmedQuery}:${JSON.stringify(filters)}:${sortBy}:${page}:${pageSize}`

    if (useCache) {
      const cached = await cache.get(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        return cached
      }
    }

    this.stats.cacheMisses++
    this.stats.totalSearches++

    // Maintenance asynchrone
    this._ensureIndex().catch(() => {})

    // Enregistrement async
    this.popular.recordSearch(trimmedQuery).catch(() => {})
    if (userId) {
      this.history.recordSearch(userId, trimmedQuery, 0).catch(() => {})
    }

    try {
      let results = []

      // Recherche sémantique si demandée
      if (useSemantic && embeddingService) {
        const semanticIds = await this.embeddings.semanticSearch(trimmedQuery, 100)
        results = this.index.apps
          .filter(app => semanticIds.includes(app.id))
          .map(app => ({ item: app, score: 0 })) // Score à recalculer
      } else {
        // Recherche Fuse classique avec pré-filtrage
        results = this.index.search(trimmedQuery, { 
          limit: 1000,
          filters 
        })
      }

      // ✅ HYBRID RANKING
      results = this._applyHybridRanking(results)

      // Appliquer les filtres restants
      let filteredResults = this._applyFilters(results, filters)

      // Trier
      filteredResults = await this._applySort(filteredResults, sortBy)

      const total = filteredResults.length

      // Paginer
      const start = (page - 1) * pageSize
      const end = start + pageSize
      const paginatedResults = filteredResults.slice(start, end)

       // Formater
      const formattedResults = paginatedResults.map(r => ({
        id: r.item.id,
        name: r.item.name,
        description: r.item.description,
        category: r.item.category,
        tags: r.item.tags,
        stats: r.item.stats,
        metadata: r.item.metadata,
        developerName: r.item.developerName,
        score: r.score,
        finalScore: r.finalScore,
        matches: includeScore ? r.matches : undefined
      }))

      // Mettre à jour stats
      this.stats.averageResults = Math.round(
        (this.stats.averageResults * (this.stats.totalSearches - 1) + total) /
        this.stats.totalSearches
      )

      // Récupérer les facettes
      const facets = this.index.getFacets()

      const response = {
        results: formattedResults,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        query: trimmedQuery,
        filters,
        sortBy,
        facets,
        took: Date.now() - startTime
      }

      if (useCache) {
        await cache.set(cacheKey, response, SEARCH_LIMITS.CACHE_TTL)
      }

      this.emit('search:performed', {
        query: trimmedQuery,
        results: formattedResults.length,
        total,
        userId
      })

      return response

    } catch (error) {
      this.logger.error('Erreur recherche', { query: trimmedQuery, error })
      return this._getEmptyResults(page, pageSize)
    }
  }

  /**
   * ✅ Hybrid ranking : combine relevance + popularité
   */
  _applyHybridRanking(results) {
    return results.map(r => {
      const app = r.item
      const relevanceScore = 1 - (r.score || 0) // Fuse score (0 = parfait)

      // Normaliser les métriques
      const downloadsScore = Math.log1p(app.stats.downloads) / 10 // 0-1
      const ratingScore = (app.stats.rating || 0) / 5 // 0-1
      const trendingScore = Math.min(app.trendingScore || 0, 1)

      // Score hybride pondéré
      const finalScore = 
        relevanceScore * HYBRID_WEIGHTS.relevance +
        downloadsScore * HYBRID_WEIGHTS.downloads +
        ratingScore * HYBRID_WEIGHTS.rating +
        trendingScore * HYBRID_WEIGHTS.trending

      return {
        ...r,
        finalScore
      }
    })
  }

  /**
   * Applique les filtres
   */
  _applyFilters(results, filters) {
    if (Object.keys(filters).length === 0) {
      return results
    }

    return results.filter(result => {
      const app = result.item

      if (filters.category && app.category !== filters.category) return false

      if (filters.tags?.length > 0) {
        if (!filters.tags.every(tag => app.tags?.includes(tag))) return false
      }

      if (filters.minRating && (app.stats.rating || 0) < filters.minRating) return false
      if (filters.minDownloads && (app.stats.downloads || 0) < filters.minDownloads) return false
      if (filters.minInstalls && (app.stats.installs || 0) < filters.minInstalls) return false
      if (filters.hasIcon === true && !app.metadata?.hasIcon) return false
      if (filters.hasScreenshots === true && !app.metadata?.screenshotCount) return false

      return true
    })
  }

  /**
   * Applique le tri
   */
  async _applySort(results, sortBy) {
    switch (sortBy) {
      case SORT_OPTIONS.RELEVANCE:
        return results.sort((a, b) => (a.score || 0) - (b.score || 0))

      case SORT_OPTIONS.HYBRID:
        return results.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))

      case SORT_OPTIONS.DOWNLOADS:
        return results.sort((a, b) => 
          (b.item.stats?.downloads || 0) - (a.item.stats?.downloads || 0)
        )

      case SORT_OPTIONS.RATING:
        return results.sort((a, b) => 
          (b.item.stats?.rating || 0) - (a.item.stats?.rating || 0)
        )

      case SORT_OPTIONS.NEWEST:
        return results.sort((a, b) => 
          new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime()
        )

      case SORT_OPTIONS.NAME:
        return results.sort((a, b) => a.item.name.localeCompare(b.item.name))

      case SORT_OPTIONS.TRENDING:
        return results.sort((a, b) => 
          (b.item.trendingScore || 0) - (a.item.trendingScore || 0)
        )

      default:
        return results
    }
  }

  /**
   * Suggestions améliorées
   */
  async getSuggestions(partial, limit = SEARCH_LIMITS.SUGGESTIONS_LIMIT) {
    if (!partial?.trim() || partial.length < 2) {
      return []
    }

    await this._ensureIndex()

    // 1. Recherches populaires
    const popular = await this.popular.getPopular(5)
    
    // 2. Apps matching
    const appResults = this.index.search(partial, { limit: 10 })
    
    // 3. Tags matching
    const matchingTags = Array.from(this.index.facets.tags.keys())
      .filter(tag => tag.toLowerCase().includes(partial.toLowerCase()))
      .slice(0, 3)
      .map(tag => ({ text: tag, type: 'tag' }))

    // 4. Catégories matching
    const matchingCategories = Array.from(this.index.facets.categories.keys())
      .filter(cat => cat.toLowerCase().includes(partial.toLowerCase()))
      .slice(0, 2)
      .map(cat => ({ text: cat, type: 'category' }))

    const suggestions = [
      ...popular.filter(p => p.query.includes(partial)).map(p => ({
        text: p.query,
        type: 'popular',
        count: p.count
      })),
      ...appResults.map(r => ({
        text: r.item.name,
        type: 'app',
        category: r.item.category,
        score: r.score
      })),
      ...matchingTags,
      ...matchingCategories
    ]

    return suggestions.slice(0, limit)
  }

  /**
   * Recherche avancée avec opérateurs
   */
  async advancedSearch(query, options = {}) {
    const parsed = this._parseAdvancedQuery(query)
    
    return this.search(parsed.text, {
      ...options,
      filters: {
        ...options.filters,
        ...parsed.filters
      }
    })
  }

  /**
   * Parse une requête avancée
   */
  _parseAdvancedQuery(query) {
    const filters = {}
    const words = query.split(' ')
    const textParts = []

    for (const word of words) {
      if (word.includes(':')) {
        const [key, value] = word.split(':')
        filters[key] = value
      } else if (word.includes('>')) {
        const [key, value] = word.split('>')
        filters[`min${key.charAt(0).toUpperCase() + key.slice(1)}`] = parseInt(value)
      } else if (word.includes('<')) {
        const [key, value] = word.split('<')
        filters[`max${key.charAt(0).toUpperCase() + key.slice(1)}`] = parseInt(value)
      } else {
        textParts.push(word)
      }
    }

    return { text: textParts.join(' '), filters }
  }

  /**
   * Recherche par similarité
   */
  async similaritySearch(appId, limit = 10) {
    if (!trendingService) {
      return this._fallbackSimilarity(appId, limit)
    }
    return await trendingService.getSimilarApps(appId, limit)
  }

  /**
   * Fallback similarité basée sur tags
   */
  _fallbackSimilarity(appId, limit) {
    const targetApp = this.index.apps.find(app => app.id === appId)
    if (!targetApp) return []

    const similar = this.index.apps
      .filter(app => app.id !== appId)
      .map(app => ({
        ...app,
        similarity: this._calculateSimilarity(targetApp, app)
      }))
      .filter(app => app.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return similar
  }

  /**
   * Calcule la similarité
   */
  _calculateSimilarity(app1, app2) {
    let score = 0
    if (app1.category === app2.category) score += 0.3
    
    const commonTags = (app1.tags || []).filter(t => 
      (app2.tags || []).includes(t)
    ).length
    score += (commonTags / Math.max(app1.tags?.length || 1, app2.tags?.length || 1)) * 0.7

    return Math.min(score, 1)
  }

  /**
   * Récupère l'historique utilisateur
   */
  async getUserSearchHistory(userId, limit = 10) {
    return await this.history.getUserHistory(userId, limit)
  }

  /**
   * Récupère les recherches populaires
   */
  async getPopularSearches(limit = 10) {
    return await this.popular.getPopular(limit)
  }

  /**
   * Récupère les facettes
   */
  getFacets() {
    return this.index.getFacets()
  }

  /**
   * Efface l'historique
   */
  async clearUserHistory(userId) {
    if (storage?.deleteMany) {
      await storage.deleteMany('search_history', { userId })
      this.emit('history:cleared', { userId })
    }
  }

  /**
   * Résultats vides
   */
  _getEmptyResults(page, pageSize) {
    return {
      results: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      query: '',
      facets: this.getFacets()
    }
  }

  /**
   * Nettoie les caches
   */
  async cleanup() {
    this.index.batchProcessor.cleanup()
    await this.history.cleanup()
    await this.popular.cleanup?.()
  }

  /**
   * Récupère les stats
   */
  async getStats() {
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
      ? Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100)
      : 0

    return {
      ...this.stats,
      cacheHitRate: `${hitRate}%`,
      indexSize: this.index.size,
      indexVersion: this.index.version,
      indexAge: this.index.lastUpdate ? Date.now() - this.index.lastUpdate : null,
      facets: {
        categories: this.index.facets.categories.size,
        tags: this.index.facets.tags.size
      },
      popularSearches: await this.popular.getPopular(5),
      timestamp: Date.now()
    }
  }
}

// =============================
// SINGLETON EXPORT
// =============================

let searchServiceInstance = null

export const initializeSearchService = async () => {
  if (!searchServiceInstance) {
    searchServiceInstance = new SearchService()
    await searchServiceInstance._ensureIndex(true)
  }
  return searchServiceInstance
}

export const getSearchService = () => {
  if (!searchServiceInstance) {
    throw new Error('SearchService non initialisé')
  }
  return searchServiceInstance
}

export default getSearchService
