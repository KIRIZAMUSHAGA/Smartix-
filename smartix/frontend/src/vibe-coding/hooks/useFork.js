/**
 * useFork - Hook React pour le fork d'applications
 * Version ULTIME avec corrections architecture, performance et UX
 * 
 * Rôle: Interface React pour le fork d'applications
 * - Fork d'une application avec progression réelle
 * - Généalogie des forks en arbre
 * - Statistiques enrichies
 * - Historique avec filtres
 * - Cache LRU avec TTL
 */

import { useState, useEffect, useCallback, useMemo, useRef, startTransition, useContext, createContext } from 'react'
import { forkService, getForkService, setPublishService } from '../marketplace/forkService'
import { getPublishService } from '../../marketplace/publishService'
import { useMarketplaceContext } from '../marketplace/hooks/useMarketplace'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const FORK_STATUS = {
  IDLE: 'idle',
  FORKING: 'forking',
  SUCCESS: 'success',
  FAILED: 'failed'
}

const FORK_STEPS = [
  { progress: 10, phase: 'checking', message: 'Vérification des permissions...' },
  { progress: 30, phase: 'fetching', message: 'Récupération du projet original...' },
  { progress: 50, phase: 'cloning', message: 'Clonage du projet...' },
  { progress: 70, phase: 'creating', message: 'Création du fork...' },
  { progress: 90, phase: 'finalizing', message: 'Finalisation...' }
]

const CACHE_TTL = {
  USER_FORKS: 5 * 60 * 1000,     // 5 minutes
  APP_FORKS: 5 * 60 * 1000,      // 5 minutes
  GENEALOGY: 60 * 60 * 1000,     // 1 heure
  STATS: 60 * 1000,              // 1 minute
  APP_DETAILS: 10 * 60 * 1000    // 10 minutes
}

const LRU_MAX_SIZE = 500

// =============================
// CACHE LRU (évite la croissance infinie)
// =============================

class LRUCache {
  constructor(maxSize = LRU_MAX_SIZE) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    // LRU: déplacer à la fin (le plus récent)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.data
  }

  set(key, data, ttl) {
    // Si le cache est plein, supprimer le plus ancien (premier élément)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  // 🔥 Correction: startsWith pour éviter les collisions
  invalidateStartsWith(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  invalidate(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  get size() {
    return this.cache.size
  }
}

let globalForkCache

if (typeof window !== 'undefined' && !globalForkCache) {
  globalForkCache = new LRUCache()
}

const cache = globalForkCache || new LRUCache()

// =============================
// BATCH LOADER POUR LES APPLICATIONS
// =============================

class AppBatchLoader {
  constructor() {
    this.queue = new Set()
    this.pending = null
    this.cache = new Map() // Cache local des apps
  }

  async load(appId) {
    // Vérifier le cache local d'abord
    if (this.cache.has(appId)) {
      return this.cache.get(appId)
    }

    this.queue.add(appId)

    if (!this.pending) {
      this.pending = Promise.resolve().then(() => this.flush())
    }

    return this.pending.then(() => this.cache.get(appId))
  }

  async flush() {
    const ids = Array.from(this.queue)
    this.queue.clear()
    this.pending = null

    if (ids.length === 0) return

    try {
      // Batch load
      const apps = await getPublishService().getAppsByIds(ids)
      
      // Mettre en cache
      for (const app of apps) {
        this.cache.set(app.id, app)
      }

      // Pour les IDs non trouvés, mettre null
      for (const id of ids) {
        if (!this.cache.has(id)) {
          this.cache.set(id, null)
        }
      }
    } catch (error) {
      console.error('Batch load error:', error)
    }
  }

  clear() {
    this.cache.clear()
  }
}

const appLoader = new AppBatchLoader()

// =============================
// CONTEXT PROVIDER
// =============================

const ForkContext = createContext(null)

export const ForkProvider = ({ children, userId = null, options = {} }) => {
  const fork = useFork(userId, options)
  
  return (
    <ForkContext.Provider value={fork}>
      {children}
    </ForkContext.Provider>
  )
}

export const useForkContext = () => {
  const context = useContext(ForkContext)
  if (!context) {
    throw new Error('useForkContext must be used within ForkProvider')
  }
  return context
}

// =============================
// HOOK PRINCIPAL
// =============================

export const useFork = (userId = null, options = {}) => {
  const {
    initialLoad = true,
    cacheResults = true,
    autoRefresh = false
  } = options

  const [userForks, setUserForks] = useState([])
  const [forkHistory, setForkHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [forkStatus, setForkStatus] = useState(FORK_STATUS.IDLE)
  const [currentFork, setCurrentFork] = useState(null)
  const [progress, setProgress] = useState(0)
  const [currentPhase, setCurrentPhase] = useState('')
  const [currentStep, setCurrentStep] = useState('')

  const marketplace = useMarketplaceContext()
  const abortControllerRef = useRef(null)
  const mountedRef = useRef(true)
  const expandedNodesRef = useRef(new Set()) // 🔥 Performance: useRef au lieu de useState

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // =============================
  // CHARGEMENT DES DONNÉES
  // =============================

  useEffect(() => {
    if (userId && initialLoad) {
      loadUserForks()
      loadForkStats()
    }

    if (autoRefresh && userId) {
      const interval = setInterval(() => {
        loadUserForks({ silent: true })
      }, CACHE_TTL.USER_FORKS)

      return () => clearInterval(interval)
    }
  }, [userId, initialLoad, autoRefresh])

  const cancelPendingRequests = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const loadUserForks = async (options = {}) => {
    const { silent = false, forceRefresh = false } = options

    if (!userId) return
    if (!silent) setLoading(true)

    try {
      const cacheKey = `userForks:${userId}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setUserForks(cached)
          if (!silent) setLoading(false)
          
          // Enrichir en arrière-plan
          enrichForks(cached).catch(console.error)
          
          return cached
        }
      }

      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const service = getForkService()
      const forks = await service.getForksByUser(userId, {
        signal: abortControllerRef.current.signal
      })

      const forksList = forks.forks || []

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, forksList, CACHE_TTL.USER_FORKS)
      }

      if (mountedRef.current) {
        startTransition(() => {
          setUserForks(forksList)
        })
      }

      // Enrichir en arrière-plan
      enrichForks(forksList).catch(console.error)

      return forksList
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        console.error('Erreur chargement forks:', err)
        setError(err.message)
      }
    } finally {
      if (!silent && mountedRef.current) setLoading(false)
    }
  }

  // 🔥 Optimisation: batch loading des apps
  const enrichForks = async (forks) => {
    if (!forks.length) return

    try {
      // Précharger tous les IDs en batch
      const allIds = forks.flatMap(f => [f.originalAppId, f.newAppId].filter(Boolean))
      await Promise.all(allIds.map(id => appLoader.load(id)))

      const enriched = await Promise.all(
        forks.map(async (fork) => {
          const [original, forked] = await Promise.all([
            appLoader.load(fork.originalAppId),
            fork.newAppId ? appLoader.load(fork.newAppId) : null
          ])

          return {
            ...fork,
            originalName: original?.name || 'Application originale',
            forkedName: forked?.name || 'Non publiée',
            originalIcon: original?.icon,
            forkedIcon: forked?.icon,
            originalStats: original?.stats,
            forkedStats: forked?.stats,
            originalCategory: original?.category
          }
        })
      )

      if (mountedRef.current) {
        startTransition(() => {
          setForkHistory(enriched)
        })
      }
    } catch (err) {
      console.error('Erreur enrichissement forks:', err)
    }
  }

  const loadForkStats = async (options = {}) => {
    const { forceRefresh = false } = options

    try {
      const cacheKey = 'forkStats'
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setStats(cached)
          return cached
        }
      }

      const service = getForkService()
      const stats = await service.getStats()

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, stats, CACHE_TTL.STATS)
      }

      if (mountedRef.current) {
        setStats(stats)
      }

      return stats
    } catch (err) {
      console.error('Erreur chargement stats forks:', err)
    }
  }

  // =============================
  // ACTIONS
  // =============================

  /**
   * Fork une application avec progression
   */
  const fork = useCallback(async (originalAppId, options = {}) => {
    if (!userId) {
      throw new Error('Utilisateur non connecté')
    }

    if (!originalAppId) {
      throw new Error('ID de l\'application requis')
    }

    setForkStatus(FORK_STATUS.FORKING)
    setError(null)
    setCurrentFork(null)
    setProgress(0)
    setCurrentPhase('')
    setCurrentStep('')

    try {
      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const service = getForkService()
      
      // Écouter les événements de progression réelle
      const unsubscribe = service.on('fork:progress', (data) => {
        if (mountedRef.current) {
          setProgress(data.progress)
          setCurrentPhase(data.phase)
          setCurrentStep(data.message)
        }
      })

      const result = await service.forkApp(originalAppId, userId, {
        ...options,
        signal: abortControllerRef.current.signal
      })

      unsubscribe()

      setProgress(100)
      setCurrentPhase('completed')
      setCurrentStep('Fork terminé !')
      
      if (mountedRef.current) {
        setForkStatus(FORK_STATUS.SUCCESS)
        setCurrentFork(result)

        // Invalider les caches avec startsWith
        cache.invalidateStartsWith(`userForks:${userId}`)
        cache.invalidate('forkStats')
        cache.invalidateStartsWith(`appForks:${originalAppId}`)
        cache.invalidateStartsWith(`genealogy:${originalAppId}`)

        // Recharger
        await Promise.all([
          loadUserForks({ silent: true }),
          loadForkStats({ forceRefresh: true })
        ])
      }

      return result
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        setForkStatus(FORK_STATUS.FAILED)
        setError(err.message)
      }
      throw err
    }
  }, [userId])

  /**
   * Récupère les forks d'une application
   */
  const getAppForks = useCallback(async (appId, options = {}) => {
    if (!appId) return { forks: [], total: 0 }

    const {
      limit = 20,
      offset = 0,
      forceRefresh = false
    } = options

    setLoading(true)

    try {
      const cacheKey = `appForks:${appId}:${offset}:${limit}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached) {
          setLoading(false)
          return cached
        }
      }

      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const service = getForkService()
      const result = await service.getForksOfApp(appId, {
        limit,
        offset,
        signal: abortControllerRef.current.signal
      })

      // Précharger les apps en batch
      const appIds = result.forks?.map(f => f.newAppId).filter(Boolean) || []
      await Promise.all(appIds.map(id => appLoader.load(id)))

      // Enrichir avec les détails
      const enriched = await Promise.all(
        (result.forks || []).map(async (fork) => {
          const forked = fork.newAppId 
            ? await appLoader.load(fork.newAppId)
            : null

          return {
            ...fork,
            forkedName: forked?.name,
            forkedIcon: forked?.icon,
            forkedStats: forked?.stats,
            forkedCategory: forked?.category
          }
        })
      )

      const enrichedResult = {
        ...result,
        forks: enriched
      }

      if (cacheResults) {
        cache.set(cacheKey, enrichedResult, CACHE_TTL.APP_FORKS)
      }

      return enrichedResult
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
      return { forks: [], total: 0 }
    } finally {
      setLoading(false)
    }
  }, [cacheResults])

  /**
   * Récupère la généalogie d'une application
   */
  const getGenealogy = useCallback(async (appId, options = {}) => {
    if (!appId) return []

    const { forceRefresh = false } = options

    setLoading(true)

    try {
      const cacheKey = `genealogy:${appId}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached) {
          setLoading(false)
          return cached
        }
      }

      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const service = getForkService()
      const genealogy = await service.getAppGenealogy(appId, {
        signal: abortControllerRef.current.signal
      })

      // Précharger les apps en batch
      const appIds = genealogy.map(node => node.id).filter(Boolean)
      await Promise.all(appIds.map(id => appLoader.load(id)))

      // Enrichir avec les noms
      const enriched = await Promise.all(
        genealogy.map(async (node) => {
          if (node.id) {
            const app = await appLoader.load(node.id)
            return {
              ...node,
              name: app?.name || node.name,
              icon: app?.icon,
              category: app?.category,
              stats: app?.stats
            }
          }
          return node
        })
      )

      if (cacheResults) {
        cache.set(cacheKey, enriched, CACHE_TTL.GENEALOGY)
      }

      return enriched
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [cacheResults])

  /**
   * Récupère les statistiques
   */
  const getStats = useCallback(async (forceRefresh = false) => {
    return loadForkStats({ forceRefresh })
  }, [])

  /**
   * Rafraîchit toutes les données
   */
  const refresh = useCallback(() => {
    return Promise.all([
      loadUserForks({ forceRefresh: true }),
      loadForkStats({ forceRefresh: true })
    ])
  }, [])

  // =============================
  // UTILITAIRES
  // =============================

  const canFork = useCallback((app) => {
    if (!userId) return false
    if (!app) return false
    if (app.userId === userId) return false
    if (forkStatus === FORK_STATUS.FORKING) return false
    if (app.visibility === 'private') return false
    return true
  }, [userId, forkStatus])

  const hasUserForked = useCallback((appId) => {
    return userForks.some(f => f.originalAppId === appId)
  }, [userForks])

  // 🔥 Correction: pas de useMemo car dépend de userForks qui change
  const getUserForkForApp = useCallback((appId) => {
    return userForks.find(f => f.originalAppId === appId)
  }, [userForks])

  // 🔥 Correction: pas de useMemo car dépend de userForks qui change
  const getForkById = useCallback((forkId) => {
    return userForks.find(f => f.id === forkId) || forkHistory.find(f => f.id === forkId)
  }, [userForks, forkHistory])

  // Statistiques enrichies
  const enrichedStats = useMemo(() => {
    if (!stats) return null

    const userForksCount = userForks.length
    const publishedForks = userForks.filter(f => f.newAppId).length
    const unpublishedForks = userForks.filter(f => !f.newAppId).length

    return {
      ...stats,
      userForksCount,
      publishedForks,
      unpublishedForks,
      publishRate: userForksCount > 0 
        ? Math.round((publishedForks / userForksCount) * 100) 
        : 0
    }
  }, [stats, userForks])

  // Forks par catégorie
  const forksByCategory = useMemo(() => {
    const categories = {}
    forkHistory.forEach(fork => {
      const cat = fork.originalCategory || 'other'
      categories[cat] = (categories[cat] || 0) + 1
    })
    return categories
  }, [forkHistory])

  return {
    // États
    userForks,
    forkHistory,
    stats: enrichedStats,
    forksByCategory,
    loading,
    error,
    forkStatus,
    currentFork,
    progress,
    currentPhase,
    currentStep,
    isForking: forkStatus === FORK_STATUS.FORKING,
    isSuccess: forkStatus === FORK_STATUS.SUCCESS,
    isFailed: forkStatus === FORK_STATUS.FAILED,

    // Actions
    fork,
    getAppForks,
    getGenealogy,
    getStats,
    refresh,
    cancelRequests: cancelPendingRequests,
    invalidateCache: () => cache.invalidateStartsWith(`userForks:${userId}`),

    // Utilitaires
    canFork,
    hasUserForked,
    getUserForkForApp,
    getForkById
  }
}

// =============================
// HOOK POUR L'HISTORIQUE DES FORKS
// =============================

export const useForkHistory = (options = {}) => {
  const {
    initialFilters = {
      published: 'all', // all, published, unpublished
      search: '',
      sortBy: 'date' // date, name
    }
  } = options

  const [history, setHistory] = useState([])
  const [filteredHistory, setFilteredHistory] = useState([])
  const [filters, setFilters] = useState(initialFilters)

  // 🔥 Correction: utiliser le context, pas le hook
  const fork = useForkContext()

  useEffect(() => {
    setHistory(fork.forkHistory)
  }, [fork.forkHistory])

  useEffect(() => {
    if (!history.length) {
      setFilteredHistory([])
      return
    }

    let filtered = [...history]

    // Filtre par publication
    if (filters.published === 'published') {
      filtered = filtered.filter(f => f.newAppId)
    } else if (filters.published === 'unpublished') {
      filtered = filtered.filter(f => !f.newAppId)
    }

    // Recherche textuelle
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(f => 
        f.originalName?.toLowerCase().includes(searchLower) ||
        f.forkedName?.toLowerCase().includes(searchLower)
      )
    }

     // Tri
    filtered.sort((a, b) => {
      if (filters.sortBy === 'date') {
        return new Date(b.forkedAt) - new Date(a.forkedAt)
      } else if (filters.sortBy === 'name') {
        return (a.originalName || '').localeCompare(b.originalName || '')
      }
      return 0
    })

    setFilteredHistory(filtered)
  }, [history, filters])

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  return {
    history: filteredHistory,
    total: history.length,
    filters,
    updateFilter,
    resetFilters,
    ...fork
  }
}

// =============================
// HOOK POUR L'ARBRE GÉNÉALOGIQUE
// =============================

export const useForkTree = (appId, options = {}) => {
  const {
    autoLoad = true,
    maxDepth = 10
  } = options

  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // 🔥 Performance: useRef pour éviter les re-rendus
  const expandedNodesRef = useRef(new Set())

  // 🔥 Correction: utiliser le context
  const fork = useForkContext()

  useEffect(() => {
    if (appId && autoLoad) {
      loadTree()
    }
  }, [appId, autoLoad])

  const loadTree = useCallback(async () => {
    if (!appId) return

    setLoading(true)
    try {
      const genealogy = await fork.getGenealogy(appId)
      
      // Construire l'arbre récursivement
      const buildNode = (nodes, depth = 0) => {
        if (depth > maxDepth) return null

        return nodes.map((node, index) => ({
          id: node.id,
          name: node.name,
          icon: node.icon,
          category: node.category,
          forkedAt: node.forkedAt,
          forkId: node.forkId,
          level: depth,
          isLast: index === nodes.length - 1,
          children: node.children ? buildNode(node.children, depth + 1) : []
        }))
      }

      const treeData = {
        id: 'root',
        name: 'Racine',
        children: buildNode(genealogy)
      }

      setTree(treeData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [appId, fork, maxDepth])

  const toggleNode = useCallback((nodeId) => {
    const newSet = new Set(expandedNodesRef.current)
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId)
    } else {
      newSet.add(nodeId)
    }
    expandedNodesRef.current = newSet
    // Forcer le re-rendu
    setTree(prev => ({ ...prev }))
  }, [])

  const expandAll = useCallback(() => {
    const newSet = new Set()
    
    const traverse = (node) => {
      if (!node) return
      if (node.id && node.id !== 'root') {
        newSet.add(node.id)
      }
      if (node.children) {
        node.children.forEach(traverse)
      }
    }
    
    if (tree) {
      traverse(tree)
      expandedNodesRef.current = newSet
      setTree(prev => ({ ...prev }))
    }
  }, [tree])

  const collapseAll = useCallback(() => {
    expandedNodesRef.current.clear()
    setTree(prev => ({ ...prev }))
  }, [])

  const isExpanded = useCallback((nodeId) => {
    return expandedNodesRef.current.has(nodeId)
  }, [])

  return {
    tree,
    loading,
    error,
    expandedNodes: expandedNodesRef.current,
    isExpanded,
    toggleNode,
    expandAll,
    collapseAll,
    refresh: loadTree
  }
}

// =============================
// HOOK POUR LA PUBLICATION APRÈS FORK
// =============================

export const useForkPublish = (forkId, userId) => {
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  // 🔥 Correction: utiliser le context
  const fork = useForkContext()
  const marketplace = useMarketplaceContext()

  // 🔥 Correction: pas de useMemo, simple accès direct
  const forkData = fork.getForkById(forkId)

  const publishFork = useCallback(async (options = {}) => {
    if (!forkData) {
      throw new Error('Fork non trouvé')
    }

    if (!forkData.forkedProjectId) {
      throw new Error('Projet forké non trouvé')
    }

    setPublishing(true)
    setError(null)
    setProgress(0)

    try {
      // Écouter les événements de progression réelle
      const unsubscribe = marketplace.on('publish:progress', (data) => {
        setProgress(data.progress)
      })

      const result = await marketplace.publish(
        forkData.forkedProjectId,
        {
          name: options.name || forkData.forkedName || `${forkData.originalName} (fork)`,
          description: options.description || forkData.description || `Fork de ${forkData.originalName}`,
          visibility: options.visibility || 'public',
          category: options.category || forkData.originalCategory,
          tags: options.tags || forkData.tags || [],
          version: options.version || '1.0.0',
          ...options
        }
      )

      unsubscribe()

      setProgress(100)
      setResult(result)
      
      // Rafraîchir les forks
      await fork.refresh()
      
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setPublishing(false)
    }
  }, [forkData, marketplace, fork])

  return {
    publishFork,
    publishing,
    result,
    error,
    progress,
    forkData
  }
}

export default useFork
ForkProvider.propTypes = {
  children: PropTypes.node.isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.object,
};
