// =============================
// usePost.js - Version production
// Avec stale state protection, cache sync, error structuré
// =============================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

// Structure d'erreur standardisée
const createError = (message, code = 'UNKNOWN', status = null) => ({
  message,
  code,
  status,
  timestamp: Date.now()
});

export const usePost = (postId, options = {}) => {
  const { client } = useApiClient();
  const { getPostCache, updatePostCache, invalidatePostsList } = useGlobalCache();
  
  const { enableRetry = true } = options;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Refs pour stale state protection
  const postRef = useRef(post);
  useEffect(() => {
    postRef.current = post;
  }, [post]);
  
  // Verrous anti-race conditions
  const isLikingRef = useRef(false);
  const isBookmarkingRef = useRef(false);
  const isSharingRef = useRef(false);
  const isDeletingRef = useRef(false);

  // Fonction de retry avec backoff
  const withRetry = useCallback(async (fn, retryCount = 0) => {
    try {
      return await fn();
    } catch (err) {
      if (enableRetry && retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return withRetry(fn, retryCount + 1);
      }
      throw err;
    }
  }, [enableRetry]);

  // =============================
  // CHARGEMENT DU POST
  // =============================
  const fetchPost = useCallback(async (skipCache = false) => {
    if (!postId) return;

    try {
      setError(null);
      
      if (!skipCache) {
        const cached = getPostCache(postId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setPost(cached.post);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      const response = await withRetry(() => client.get(`/posts/${postId}`));
      const postData = response.data.post;

      setPost(postData);
      updatePostCache(postId, {
        post: postData,
        timestamp: Date.now()
      });

    } catch (err) {
      const errorObj = createError(
        err.response?.data?.message || err.message || 'Erreur de chargement',
        err.code || 'FETCH_ERROR',
        err.response?.status || null
      );
      setError(errorObj);
      console.error('Fetch post error:', errorObj);
    } finally {
      setLoading(false);
    }
  }, [postId, client, getPostCache, updatePostCache, withRetry]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // =============================
  // SYNC CACHE (sans side effect dans setState)
  // =============================
  const syncCache = useCallback((updatedPost) => {
    updatePostCache(postId, {
      post: updatedPost,
      timestamp: Date.now()
    });
    // Invalider les listes globales
    invalidatePostsList?.();
  }, [postId, updatePostCache, invalidatePostsList]);

  // =============================
  // LIKE / UNLIKE
  // =============================
  const toggleLike = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost || isLikingRef.current) {
      return { success: false, error: createError('Action en cours', 'ACTION_IN_PROGRESS') };
    }

    isLikingRef.current = true;
    const previousPost = currentPost;

    // Optimistic update
    setPost(prev => prev ? {
      ...prev,
      is_liked: !prev.is_liked,
      likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1
    } : prev);

    try {
      if (currentPost.is_liked) {
        await withRetry(() => client.delete(`/posts/${postId}/like`));
      } else {
        await withRetry(() => client.post(`/posts/${postId}/like`));
      }
      
      // Sync cache après succès
      const updatedPost = postRef.current;
      if (updatedPost) syncCache(updatedPost);
      
      return { success: true };
      
    } catch (err) {
      // Rollback avec stale state protection
      setPost(previousPost);
      const errorObj = createError(
        err.response?.data?.message || 'Erreur like/unlike',
        'LIKE_ERROR',
        err.response?.status
      );
      console.error('Toggle like error:', errorObj);
      return { success: false, error: errorObj };
    } finally {
      isLikingRef.current = false;
    }
  }, [postId, client, syncCache, withRetry]);

  // =============================
  // BOOKMARK / UNBOOKMARK
  // =============================
  const toggleBookmark = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost || isBookmarkingRef.current) {
      return { success: false, error: createError('Action en cours', 'ACTION_IN_PROGRESS') };
    }

    isBookmarkingRef.current = true;
    const previousPost = currentPost;

    setPost(prev => prev ? {
      ...prev,
      is_bookmarked: !prev.is_bookmarked
    } : prev);

    try {
      if (currentPost.is_bookmarked) {
        await withRetry(() => client.delete(`/posts/${postId}/bookmark`));
      } else {
        await withRetry(() => client.post(`/posts/${postId}/bookmark`));
      }
      
      const updatedPost = postRef.current;
      if (updatedPost) syncCache(updatedPost);
      
      return { success: true };
      
    } catch (err) {
      setPost(previousPost);
      const errorObj = createError(
        err.response?.data?.message || 'Erreur bookmark',
        'BOOKMARK_ERROR',
        err.response?.status
      );
      console.error('Toggle bookmark error:', errorObj);
      return { success: false, error: errorObj };
    } finally {
      isBookmarkingRef.current = false;
    }
  }, [postId, client, syncCache, withRetry]);

  // =============================
  // SHARE
  // =============================
  const share = useCallback(async (platform = 'internal') => {
    const currentPost = postRef.current;
    if (!currentPost || isSharingRef.current) {
      return { success: false, error: createError('Action en cours', 'ACTION_IN_PROGRESS') };
    }

    isSharingRef.current = true;
    const previousPost = currentPost;

    setPost(prev => prev ? {
      ...prev,
      shares_count: (prev.shares_count || 0) + 1
    } : prev);

    try {
      const response = await withRetry(() => client.post(`/posts/${postId}/share`, { platform }));
      
      const updatedPost = postRef.current;
      if (updatedPost) syncCache(updatedPost);
      
      return { 
        success: true, 
        shareUrl: response.data.share_url || null 
      };
      
    } catch (err) {
      setPost(previousPost);
      const errorObj = createError(
        err.response?.data?.message || 'Erreur de partage',
        'SHARE_ERROR',
        err.response?.status
      );
      console.error('Share error:', errorObj);
      return { success: false, error: errorObj };
    } finally {
      isSharingRef.current = false;
    }
  }, [postId, client, syncCache, withRetry]);

  // =============================
  // UPDATE POST
  // =============================
  const updatePost = useCallback(async (updates) => {
    const currentPost = postRef.current;
    if (!currentPost) {
      return { success: false, error: createError('Post introuvable', 'POST_NOT_FOUND') };
    }

    const previousPost = currentPost;
    setPost(prev => prev ? { ...prev, ...updates } : prev);

    try {
      const response = await withRetry(() => client.put(`/posts/${postId}`, updates));
      const updatedPost = response.data.post;
      setPost(updatedPost);
      syncCache(updatedPost);
      return { success: true, post: updatedPost };
      
    } catch (err) {
      setPost(previousPost);
      const errorObj = createError(
        err.response?.data?.message || 'Erreur de mise à jour',
        'UPDATE_ERROR',
        err.response?.status
      );
      console.error('Update post error:', errorObj);
      return { success: false, error: errorObj };
    }
  }, [postId, client, syncCache, withRetry]);

  // =============================
  // DELETE POST
  // =============================
  const deletePost = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost || isDeletingRef.current) {
      return { success: false, error: createError('Action en cours', 'ACTION_IN_PROGRESS') };
    }

    isDeletingRef.current = true;

    try {
      await withRetry(() => client.delete(`/posts/${postId}`));
      updatePostCache(postId, null); // Invalider cache
      invalidatePostsList?.(); // Invalider les listes globales
      return { success: true, deleted: true };
      
    } catch (err) {
      const errorObj = createError(
        err.response?.data?.message || 'Erreur de suppression',
        'DELETE_ERROR',
        err.response?.status
      );
      console.error('Delete post error:', errorObj);
      return { success: false, error: errorObj };
    } finally {
      isDeletingRef.current = false;
    }
  }, [postId, client, updatePostCache, invalidatePostsList, withRetry]);

  // =============================
  // REPORT POST
  // =============================
  const reportPost = useCallback(async (reason, details = '') => {
    const currentPost = postRef.current;
    if (!currentPost) {
      return { success: false, error: createError('Post introuvable', 'POST_NOT_FOUND') };
    }

    try {
      await withRetry(() => client.post(`/posts/${postId}/report`, { reason, details }));
      return { success: true };
      
    } catch (err) {
      const errorObj = createError(
        err.response?.data?.message || 'Erreur de signalement',
        'REPORT_ERROR',
        err.response?.status
      );
      console.error('Report post error:', errorObj);
      return { success: false, error: errorObj };
    }
  }, [postId, client, withRetry]);

  // =============================
  // PIN / UNPIN
  // =============================
  const togglePin = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost) {
      return { success: false, error: createError('Post introuvable', 'POST_NOT_FOUND') };
    }

    const previousPost = currentPost;
    setPost(prev => prev ? {
      ...prev,
      is_pinned: !prev.is_pinned
    } : prev);

    try {
      await withRetry(() => client.post(`/posts/${postId}/pin`, { pinned: !currentPost.is_pinned }));
      
      const updatedPost = postRef.current;
      if (updatedPost) syncCache(updatedPost);
      
      return { success: true };
      
    } catch (err) {
      setPost(previousPost);
      const errorObj = createError(
        err.response?.data?.message || 'Erreur d\'épinglage',
        'PIN_ERROR',
        err.response?.status
      );
      console.error('Toggle pin error:', errorObj);
      return { success: false, error: errorObj };
    }
  }, [postId, client, syncCache, withRetry]);

  // =============================
  // RETOUR
  // =============================
  return {
    // Données
    post,
    loading,
    error,
    
    // Dérivés
    isLiked: post?.is_liked || false,
    likeCount: post?.likes_count || 0,
    isBookmarked: post?.is_bookmarked || false,
    shareCount: post?.shares_count || 0,
    
    // Actions (retournent { success, error, data })
    toggleLike,
    toggleBookmark,
    share,
    updatePost,
    deletePost,
    reportPost,
    togglePin,
    
    // Rechargement
    refetch: () => fetchPost(true)
  };
};
