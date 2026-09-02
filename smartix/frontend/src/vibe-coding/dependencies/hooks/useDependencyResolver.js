/**
 * useDependencyResolver
 * Hook React pour utiliser le résolveur de dépendances
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DependencyResolver } from '../core/DependencyResolver';

export const useDependencyResolver = (options = {}) => {
  const [resolver] = useState(() => new DependencyResolver(options));
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dependencies, setDependencies] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState(null);
  
  const resolverRef = useRef(resolver);

  // Initialisation
  useEffect(() => {
    const init = async () => {
      await resolverRef.current.initialize();
      setInitialized(true);
      
      // Récupérer les dépendances installées
      const installedDeps = resolverRef.current.getInstalledDependencies?.() || [];
      setInstalled(installedDeps);
      
      // Récupérer les stats
      setStats(resolverRef.current.getStats?.());
    };

    init();

    // Écouter les événements
    resolverRef.current.on('install:progress', (progress) => {
      // Mettre à jour la progression
    });

    resolverRef.current.on('install:completed', (result) => {
      setInstalled(resolverRef.current.getInstalledDependencies?.() || []);
      setStats(resolverRef.current.getStats?.());
    });

    resolverRef.current.on('conflict:detected', (data) => {
      setConflicts(data.conflicts || []);
    });

    return () => {
      resolverRef.current.removeAllListeners();
    };
  }, []);

  /**
   * Analyse un projet
   */
  const analyzeProject = useCallback(async (files) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await resolverRef.current.analyzeProject(files);
      setDependencies(result.dependencies || []);
      setConflicts(result.conflicts || []);
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  /**
   * Installe des dépendances
   */
  const installDependencies = useCallback(async (deps, options = {}) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await resolverRef.current.installDependencies(deps, options);
      setInstalled(resolverRef.current.getInstalledDependencies?.() || []);
      setStats(resolverRef.current.getStats?.());
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  /**
   * Désinstalle des dépendances
   */
  const uninstall = useCallback(async (names) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await resolverRef.current.uninstall?.(names);
      setInstalled(resolverRef.current.getInstalledDependencies?.() || []);
      setStats(resolverRef.current.getStats?.());
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  /**
   * Met à jour une dépendance
   */
  const updateDependency = useCallback(async (name, version) => {
    if (!initialized) return;
    
    setLoading(true);
    try {
      const result = await resolverRef.current.updateDependency(name, version);
      setInstalled(resolverRef.current.getInstalledDependencies?.() || []);
      setStats(resolverRef.current.getStats?.());
      return result;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  /**
   * Recherche des dépendances
   */
  const searchDependencies = useCallback(async (query, options = {}) => {
    if (!initialized || !query) {
      setSearchResults([]);
      return [];
    }
    
    try {
      const results = await resolverRef.current.searchDependencies(query, options);
      setSearchResults(results);
      return results;
    } catch (error) {
      console.error('Erreur recherche:', error);
      return [];
    }
  }, [initialized]);

  /**
   * Vérifie les mises à jour
   */
  const checkForUpdates = useCallback(async () => {
    if (!initialized) return [];
    return resolverRef.current.checkForUpdates();
  }, [initialized]);

  /**
   * Génère un package.json
   */
  const generatePackageJson = useCallback((deps, options = {}) => {
    if (!initialized) return '';
    return resolverRef.current.generatePackageJson(deps, options);
  }, [initialized]);

  /**
   * Nettoie le cache
   */
  const clearCache = useCallback(() => {
    if (!initialized) return;
    resolverRef.current.clearCache();
    setStats(resolverRef.current.getStats?.());
  }, [initialized]);

  return {
    // État
    initialized,
    loading,
    dependencies,
    installed,
    conflicts,
    searchResults,
    stats,
    
    // Analyse
    analyzeProject,
    
    // Installation
    installDependencies,
    uninstall,
    updateDependency,
    
    // Recherche
    searchDependencies,
    
    // Utilitaires
    checkForUpdates,
    generatePackageJson,
    clearCache,
    
    // Accès direct au résolveur
    resolver: resolverRef.current
  };
};

export default useDependencyResolver;
