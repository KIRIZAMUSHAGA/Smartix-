/**
 * useMarketplace - Hook React pour le marketplace
 * Version PRO avec cache global, context provider et optimisations
 * 
 * Rôle: Interface React pour le module marketplace
 * - Recherche d'applications avec debounce
 * - Publication avec progression
 * - Fork
 * - Avis et notations
 * - Tendances et recommandations
 * - Cache avec TTL différenciés
 * - Context provider pour éviter les duplications
 */

import { useState, useEffect, useCallback, useMemo, useRef, startTransition, useContext, createContext } from 'react'
import { 

  searchApps, 
  getTrendingApps, 
  getRecommendations,
  getSimilarApps,
  publishApp,
  forkApp,
  addReview,
  getAppReviews,
  getApp,
  listApps,
  getPopularSearches,
  getAppGenealogy,
  getUserForks
} from '..'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const SEARCH_DEBOUNCE = 300 // ms
const TRENDING_REFRESH = 5 * 60 * 1000 // 5 minutes
const MAX_RETRY = 3

// 🔥 TTL différenciés par type de données
const CACHE_TTL = {
  TRENDING: 5 * 60 * 1000,      // 5 minutes
  APP: 10 * 60 * 1000,          // 10 minutes
  SEARCH: 60 * 1000,            // 1 minute
  RECOMMENDATIONS: 2 * 60 * 1000, // 2 minutes
  POPULAR: 30 * 60 * 1000,      // 30 minutes
  SIMILAR: 5 * 60 * 1000,        // 5 minutes
  FORKS: 5 * 60 * 1000,
  GENEALOGY: 60 * 60 * 1000      // 1 heure
}

// =============================
// CACHE GLOBAL (multi-instance safe)
// =============================

class SimpleCache {
  constructor() {
    this.cache = new Map()
    this.subscribers = new Map()
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set(key, data, ttl = CACHE_TTL.APP) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
    // Notifier les abonnés
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(cb => cb(data))
    }
  }

  invalidate(key) {
    this.cache.delete(key)
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(cb => cb(null))
    }
  }

  invalidatePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }
    this.subscribers.get(key).add(callback)
    return () => {
      this.subscribers.get(key)?.delete(callback)
    }
  }

  clear() {
    this.cache.clear()
    this.subscribers.clear()
  }
}

// 🔥 Cache global pour éviter les duplications en SSR/multi-instance
let globalCache

if (typeof window !== 'undefined' && !globalCache) {
  globalCache = new SimpleCache()
}

const cache = globalCache || new SimpleCache()

// =============================
// CONTEXT PROVIDER
// =============================

const MarketplaceContext = createContext(null)

export const MarketplaceProvider = ({ children, userId = null, options = {} }) => {
  const marketplace = useMarketplace(userId, options)
  
  return (
    <MarketplaceContext.Provider value={marketplace}>
      {children}
    </MarketplaceContext.Provider>
  )
}

export const useMarketplaceContext = () => {
  const context = useContext(MarketplaceContext)
  if (!context) {
    throw new Error('useMarketplaceContext must be used within MarketplaceProvider')
  }
  return context
}

// =============================
// HOOK PRINCIPAL
// =============================

export const useMarketplace = (userId = null, options = {}) => {
  const {
    initialLoad = true,
    cacheResults = true,
    retryCount = MAX_RETRY
  } = options

  const [apps, setApps] = useState([])
  const [trending, setTrending] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [popularSearches, setPopularSearches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchMeta, setSearchMeta] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    took: 0
  })
  const [isFirstSearch, setIsFirstSearch] = useState(true)

  const abortControllerRef = useRef(null)
  const retryCountRef = useRef(0)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      cancelPendingRequests()
    }
  }, [])

  // =============================
  // GESTION DES ABORT CONTROLLER
  // =============================

  const cancelPendingRequests = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  // =============================
  // CHARGEMENT DES TENDANCES
  // =============================

  useEffect(() => {
    if (initialLoad && mountedRef.current) {
      loadTrending()
      loadPopularSearches()
    }

    const interval = setInterval(() => {
      if (mountedRef.current) {
        loadTrending({ silent: true })
      }
    }, TRENDING_REFRESH)

    return () => {
      clearInterval(interval)
    }
  }, [initialLoad])

  // =============================
  // CHARGEMENT DES RECOMMANDATIONS
  // =============================

  useEffect(() => {
    if (userId && initialLoad && mountedRef.current) {
      loadRecommendations()
    }
  }, [userId, initialLoad])

  // =============================
  // RECHERCHE AVEC DEBOUNCE
  // =============================

  useEffect(() => {
    if (!searchQuery || !mountedRef.current) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery, searchMeta.page, {})
    }, SEARCH_DEBOUNCE)

    return () => {
      clearTimeout(timer)
      cancelPendingRequests()
    }
  }, [searchQuery, searchMeta.page])

  // =============================
  // FONCTIONS DE CHARGEMENT AVEC CACHE
  // =============================

  const loadTrending = async (options = {}) => {
    const { silent = false, forceRefresh = false } = options

    if (!silent) setLoading(true)
    
    try {
      const cacheKey = 'trending'
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setTrending(cached)
          if (!silent) setLoading(false)
          return cached
        }
      }

      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const results = await getTrendingApps({ 
        limit: 20,
        signal: abortControllerRef.current.signal 
      })

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, results, CACHE_TTL.TRENDING)
      }

      if (mountedRef.current) {
        startTransition(() => {
          setTrending(results)
        })
      }

      return results
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        console.error('Erreur chargement tendances:', err)
        setError(err.message)
      }
    } finally {
      if (!silent && mountedRef.current) setLoading(false)
    }
  }

  const loadRecommendations = async (options = {}) => {
    const { forceRefresh = false } = options

    if (!userId) return

    try {
      const cacheKey = `recommendations:${userId}`
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setRecommendations(cached)
          return cached
        }
      }

      const results = await getRecommendations(userId, { limit: 10 })

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, results, CACHE_TTL.RECOMMENDATIONS)
      }

      if (mountedRef.current) {
        setRecommendations(results)
      }
      
      return results
    } catch (err) {
      if (mountedRef.current) {
        console.error('Erreur chargement recommandations:', err)
        setError(err.message)
      }
    }
  }

  const loadPopularSearches = async (options = {}) => {
    const { forceRefresh = false } = options

    try {
      const cacheKey = 'popularSearches'
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setPopularSearches(cached)
          return cached
        }
      }

      const results = await getPopularSearches(10)

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, results, CACHE_TTL.POPULAR)
      }

      if (mountedRef.current) {
        setPopularSearches(results)
      }
      
      return results
    } catch (err) {
      if (mountedRef.current) {
        console.error('Erreur chargement recherches populaires:', err)
      }
    }
  }

  // =============================
  // RECHERCHE AVEC RETRY
  // =============================

  const performSearch = async (query, page = 1, filters = {}, retry = 0) => {
    if (!query) return

    // Loading seulement pour la première recherche
    if (isFirstSearch) {
      setLoading(true)
      setIsFirstSearch(false)
    }

    setError(null)

    try {
      const cacheKey = `search:${query}:${page}:${JSON.stringify(filters)}`
      
      // Vérifier le cache
      if (cacheResults && retry === 0) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          startTransition(() => {
            setSearchResults(cached.results)
            setSearchMeta({
              total: cached.total,
              page: cached.page,
              totalPages: cached.totalPages,
              took: cached.took || 0
            })
          })
          setLoading(false)
          return cached
        }
      }

      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const result = await searchApps(query, {
        page,
        pageSize: 20,
        filters,
        userId,
        signal: abortControllerRef.current.signal
      })

      // Reset retry counter on success
      retryCountRef.current = 0

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, result, CACHE_TTL.SEARCH)
      }

      if (mountedRef.current) {
        startTransition(() => {
          setSearchResults(result.results)
          setSearchMeta({
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            took: result.took || 0
          })
        })
      }

      setLoading(false)
      return result
    } catch (err) {
      if (err.name === 'AbortError' || !mountedRef.current) return

      // Retry logic
      if (retry < retryCount) {
        retryCountRef.current = retry + 1
        console.log(`Retry ${retry + 1}/${retryCount} for search`, query)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)))
        return performSearch(query, page, filters, retry + 1)
      }

      setError(err.message)
      setLoading(false)
      return null
    }
  }

  // =============================
  // ACTIONS OPTIMISÉES
  // =============================

  // 🔥 Correction : search gère la pagination correctement
  const search = useCallback((query, page = 1, filters = {}) => {
    setSearchQuery(query)
    setSearchMeta(prev => ({ ...prev, page }))
    return performSearch(query, page, filters)
  }, [])

  // 🔥 Correction : getAppDetails retourne déjà les reviews
  const getAppDetails = useCallback(async (appId) => {
    setLoading(true)
    setError(null)

    try {
      const cacheKey = `app:${appId}`
      if (cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached) {
          setLoading(false)
          return cached
        }
      }

      const [app, reviews] = await Promise.all([
        getApp(appId),
        getAppReviews(appId, { limit: 10 })
      ])

      const result = { app, reviews }

      if (cacheResults) {
        cache.set(cacheKey, result, CACHE_TTL.APP)
      }

      return result
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [cacheResults])

  // 🔥 Validation des paramètres
  const publish = useCallback(async (projectId, options) => {
    // Validation
    if (!projectId) throw new Error('Project ID is required')
    if (!options?.name) throw new Error('App name is required')
    if (!userId) throw new Error('User not authenticated')

    setLoading(true)
    setError(null)

    try {
      const result = await publishApp(projectId, userId, options)

      // Invalider les caches liés
      cache.invalidate('trending')
      if (userId) {
        cache.invalidate(`recommendations:${userId}`)
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fork = useCallback(async (appId, options) => {
    if (!userId) throw new Error('User not authenticated')
    if (!appId) throw new Error('App ID is required')

    setLoading(true)
    setError(null)

    try {
      const result = await forkApp(appId, userId, options)

      // Invalider les caches
      cache.invalidate('trending')
      cache.invalidate(`app:${appId}`)
      if (userId) {
        cache.invalidate(`recommendations:${userId}`)
        cache.invalidate(`forks:${userId}`)
      }

      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  const review = useCallback(async (appId, rating, comment, options = {}) => {
    if (!userId) throw new Error('User not authenticated')
    if (!appId) throw new Error('App ID is required')
    if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5')

    setLoading(true)
    setError(null)

    try {
      const result = await addReview(appId, userId, {
        rating,
        comment,
        ...options
      })

      // Invalider le cache de l'app
      cache.invalidate(`app:${appId}`)

      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  const getSimilar = useCallback(async (appId, limit = 10) => {
    try {
      const cacheKey = `similar:${appId}:${limit}`
      if (cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached) return cached
      }

      const results = await getSimilarApps(appId, limit)

      if (cacheResults) {
        cache.set(cacheKey, results, CACHE_TTL.SIMILAR)
      }

      return results
    } catch (err) {
      console.error('Erreur chargement apps similaires:', err)
      return []
    }
  }, [cacheResults])

  const list = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)

    try {
      const results = await listApps(filters)
      setApps(results.items)
      return results
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getUserForksList = useCallback(async (targetUserId = userId, options = {}) => {
    if (!targetUserId) return { forks: [], total: 0 }

    try {
      const cacheKey = `forks:${targetUserId}:${JSON.stringify(options)}`
      if (cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached) return cached
      }

      const result = await getUserForks(targetUserId, options)

      if (cacheResults) {
        cache.set(cacheKey, result, CACHE_TTL.FORKS)
      }

      return result
    } catch (err) {
      console.error('Erreur chargement forks:', err)
      return { forks: [], total: 0 }
    }
  }, [userId, cacheResults])

  const getGenealogy = useCallback(async (appId) => {
    try {
      const cacheKey = `genealogy:${appId}`
      if (cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached) return cached
      }

      const result = await getAppGenealogy(appId)

      if (cacheResults) {
        cache.set(cacheKey, result, CACHE_TTL.GENEALOGY)
      }

      return result
    } catch (err) {
      console.error('Erreur chargement généalogie:', err)
      return []
    }
  }, [cacheResults])

  // =============================
  // UTILITAIRES
  // =============================

  const filteredApps = useMemo(() => {
    if (!searchQuery) return apps
    return searchResults
  }, [apps, searchResults, searchQuery])

  const clearCache = useCallback(() => {
    cache.clear()
  }, [])

  const invalidateApp = useCallback((appId) => {
    cache.invalidate(`app:${appId}`)
    cache.invalidate(`similar:${appId}`)
    cache.invalidate(`genealogy:${appId}`)
  }, [])

  return {
    // États
    apps: filteredApps,
    trending,
    recommendations,
    popularSearches,
    loading,
    error,
    searchQuery,
    searchResults,
    searchMeta,

    // Actions de recherche
    search,
    getAppDetails,
    getSimilar,
    list,
    getUserForks: getUserForksList,
    getGenealogy,

    // Actions marketplace
    publish,
    fork,
    review,

    // Cache management
    clearCache,
    invalidateApp,

    // Rafraîchissement
    refreshTrending: () => loadTrending({ forceRefresh: true }),
    refreshRecommendations: () => loadRecommendations({ forceRefresh: true }),
    refreshPopularSearches: () => loadPopularSearches({ forceRefresh: true }),
    
    // Abort pending requests
    cancelRequests: cancelPendingRequests
  }
}

// =============================
// HOOK POUR UNE APPLICATION SPÉCIFIQUE
// =============================

export const useApp = (appId, userId = null, options = {}) => {
  const {
    loadSimilar = true,
    autoRefresh = false
  } = options

  const [app, setApp] = useState(null)
  const [reviews, setReviews] = useState([])
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const marketplace = useMarketplaceContext()

  useEffect(() => {
    if (!appId) return

    const loadApp = async () => {
      setLoading(true)
      try {
        // 🔥 Correction : getAppDetails retourne déjà les reviews
        const data = await marketplace.getAppDetails(appId)

        if (data) {
          setApp(data.app)
          setReviews(data.reviews || [])

          if (loadSimilar && data.app) {
            const similarData = await marketplace.getSimilar(appId, 5)
            setSimilar(similarData)
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadApp()

    if (autoRefresh) {
      const interval = setInterval(loadApp, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [appId, loadSimilar, autoRefresh])

  const addReview = useCallback(async (rating, comment, options) => {
    if (!userId) throw new Error('Utilisateur non connecté')

    const result = await marketplace.review(appId, rating, comment, options)
    if (result) {
      // Recharger les avis
      const newReviews = await getAppReviews(appId, { limit: 20 })
      setReviews(newReviews)
      marketplace.invalidateApp(appId)
    }
    return result
  }, [appId, userId, marketplace])

  const fork = useCallback(async (options) => {
    const result = await marketplace.fork(appId, options)
    if (result) {
      marketplace.invalidateApp(appId)
    }
    return result
  }, [appId, marketplace])

  return {
    app,
    reviews,
    similar,
    loading,
    error,
    addReview,
    fork,
    refresh: () => {
      marketplace.invalidateApp(appId)
      marketplace.cancelRequests()
      window.location.reload()
    }
  }
}

// =============================
// HOOK POUR LA RECHERCHE AVANCÉE
// =============================

export const useSearch = (initialQuery = '', options = {}) => {
  const {
    initialFilters = {},
    pageSize = 20
  } = options

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  const marketplace = useMarketplaceContext()

  // Recherche principale
  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    const performSearch = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await marketplace.search(query, page, filters)
        if (result) {
          setResults(result.results)
          setTotal(result.total)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(performSearch, SEARCH_DEBOUNCE)
    return () => clearTimeout(timer)
  }, [query, page, JSON.stringify(filters)])

  // Suggestions en temps réel
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    const getSuggestions = async () => {
      const popular = await marketplace.refreshPopularSearches()
      const filtered = popular
        .filter(p => p.query.toLowerCase().includes(query.toLowerCase()))
        .map(p => p.query)

      setSuggestions(filtered.slice(0, 5))
    }

    const timer = setTimeout(getSuggestions, 100)
    return () => clearTimeout(timer)
  }, [query])

  const applyFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const removeFilter = useCallback((key) => {
    setFilters(prev => {
      const { [key]: _, ...rest } = prev
      return rest
    })
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
    setPage(1)
  }, [])

  const nextPage = useCallback(() => {
    if (page * pageSize < total) {
      setPage(p => p + 1)
    }
  }, [page, pageSize, total])

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage(p => p - 1)
    }
  }, [page])

  return {
    query,
    setQuery,
    results,
    filters,
    setFilters,
    applyFilter,
    removeFilter,
    clearFilters,
    page,
    setPage,
    total,
    loading,
    error,
    suggestions,
    hasMore: page * pageSize < total,
    nextPage,
    prevPage,
    totalPages: Math.ceil(total / pageSize)
  }
}

// =============================
// HOOK POUR LA PUBLICATION AVEC PROGRESSION
// =============================

export const usePublish = (projectId, userId) => {
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])

  const marketplace = useMarketplaceContext()

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    }])
  }, [])

  const publish = useCallback(async (options) => {
    // Validation
    if (!projectId) throw new Error('Projet ID manquant')
    if (!userId) throw new Error('Utilisateur non connecté')
    if (!options?.name) throw new Error('Nom de l\'application requis')

    setLoading(true)
    setError(null)
    setStatus('starting')
    setProgress(0)
    setLogs([])

    addLog('Démarrage de la publication...', 'info')

    try {
      // Simuler les étapes
      const steps = [
        { progress: 10, message: 'Analyse du projet...', type: 'info' },
        { progress: 30, message: 'Construction de l\'APK...', type: 'info' },
        { progress: 60, message: 'Upload vers le CDN...', type: 'info' },
        { progress: 80, message: 'Génération du QR code...', type: 'info' },
        { progress: 90, message: 'Finalisation...', type: 'info' }
      ]

      for (const step of steps) {
        setProgress(step.progress)
        addLog(step.message, step.type)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      const publishResult = await marketplace.publish(projectId, options)

      setProgress(100)
      setStatus('completed')
      setResult(publishResult)
      addLog('Publication terminée avec succès !', 'success')

      return publishResult

    } catch (err) {
      setStatus('failed')
      setError(err.message)
      addLog(`Erreur: ${err.message}`, 'error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [projectId, userId, marketplace])

  return {
    publish,
    status,
    progress,
    result,
    loading,
    error,
    logs,
    clearLogs: () => setLogs([])
  }
}

// =============================
// HOOK POUR LES TENDANCES EN TEMPS RÉEL
// =============================

export const useTrending = (options = {}) => {
  const {
    limit = 10,
    category = null,
    autoRefresh = true
  } = options

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const marketplace = useMarketplaceContext()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const results = await marketplace.refreshTrending()
      const filtered = category 
        ? results.filter(app => app.category === category)
        : results
      setData(filtered.slice(0, limit))
      setLastUpdate(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [category, limit])

  useEffect(() => {
    load()

    if (autoRefresh) {
      const interval = setInterval(load, TRENDING_REFRESH)
      return () => clearInterval(interval)
    }
  }, [load, autoRefresh])

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh: load
  }
}

// =============================
// HOOK POUR LES RECOMMANDATIONS PERSONNALISÉES
// =============================

export const useRecommendations = (userId, options = {}) => {
  const {
    limit = 10,
    excludeIds = []
  } = options

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const marketplace = useMarketplaceContext()

  useEffect(() => {
    if (!userId) {
      setData([])
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        const results = await marketplace.refreshRecommendations()
        // 🔥 Utilisation de JSON.stringify pour la comparaison
        const filtered = results.filter(r => !excludeIds.includes(r.id))
        setData(filtered.slice(0, limit))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [userId, limit, JSON.stringify(excludeIds)])

  return { data, loading, error }
}

export default useMarketplace
MarketplaceProvider.propTypes = {
  children: PropTypes.node.isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.object,
};
