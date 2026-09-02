// hooks/useCacheManager.js
import { useState, useEffect, useCallback } from 'react';
import { cacheManager } from '../../../services/cacheManager';
import { toast } from 'sonner';

export const useCacheManager = () => {
  const [cacheState, setCacheState] = useState({
    size: '...',
    loading: false
  });

  useEffect(() => {
    const updateCacheSize = async () => {
      const size = await cacheManager.calculateCacheSize();
      setCacheState(prev => ({ ...prev, size: cacheManager.formatSize(size) }));
    };
    updateCacheSize();
  }, []);

  const clearCache = useCallback(async () => {
    setCacheState(prev => ({ ...prev, loading: true }));
    await cacheManager.clearAll();
    const size = await cacheManager.calculateCacheSize();
    setCacheState({ size: cacheManager.formatSize(size), loading: false });
    toast.success('Cache vidé avec succès !');
  }, []);

  return {
    size: cacheState.size,
    loading: cacheState.loading,
    clearCache
  };
};

export default useCacheManager;
