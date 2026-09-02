// =============================
// useComments - Version fusionnée
// Virtualisation + Optimistic updates
// =============================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FixedSizeList as List, VariableSizeList as VariableList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

const PAGE_SIZE = 20;
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes

// =============================
// NORMALIZED STORE
// =============================
const createStore = () => ({ 
  byId: {}, 
  rootIds: [], 
  childrenMap: {} 
});

const mergeStore = (prev, incoming, reset = false) => {
  const next = reset ? createStore() : {
    byId: { ...prev.byId },
    rootIds: [...prev.rootIds],
    childrenMap: { ...prev.childrenMap }
  };

  const sortedIncoming = [...incoming].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );

  sortedIncoming.forEach(c => {
    next.byId[c.id] = { ...c };

    if (c.parent_comment_id) {
      if (!next.childrenMap[c.parent_comment_id]) {
        next.childrenMap[c.parent_comment_id] = [];
      }
      if (!next.childrenMap[c.parent_comment_id].includes(c.id)) {
        next.childrenMap[c.parent_comment_id].push(c.id);
      }
    } else {
      if (!next.rootIds.includes(c.id)) {
        next.rootIds.push(c.id);
      }
    }
  });

  return next;
};

const buildFlatList = (store) => {
  const result = [];
  const visited = new Set();

  const dfs = (id, depth = 0) => {
    if (visited.has(id)) return;
    visited.add(id);

    const node = store.byId[id];
    if (!node) return;

    result.push({ ...node, depth });

    const children = store.childrenMap[id] || [];
    for (const childId of children) {
      dfs(childId, depth + 1);
    }
  };

  store.rootIds.forEach(id => dfs(id));
  return result;
};

// =============================
// HOOK PRINCIPAL
// =============================
export const useComments = (postId, currentUser) => {
  const { client } = useApiClient();
  const { getCommentsCache, updateCommentsCache } = useGlobalCache();
  
  const [store, setStore] = useState(createStore());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const loadingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Chargement des commentaires
  const fetchComments = useCallback(async (reset = false, pageOverride = 1) => {
    if (!postId) return;
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      
      if (reset) {
        setLoading(true);
        const cached = getCommentsCache(postId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setStore(cached.store);
          setHasMore(cached.hasMore);
          setLoading(false);
          return;
        }
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : pageOverride;

      const res = await client.get(`/posts/${postId}/comments`, {
        params: { page: currentPage, limit: PAGE_SIZE }
      });

      const incoming = res.data.comments || [];

      const newStore = mergeStore(store, incoming, reset);
      setStore(newStore);

      const more = incoming.length === PAGE_SIZE;
      setHasMore(more);

      if (reset) {
        updateCommentsCache(postId, {
          store: newStore,
          hasMore: more,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      console.error('Fetch comments error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [postId, client, getCommentsCache, updateCommentsCache, store]);

  useEffect(() => {
    fetchComments(true);
  }, [fetchComments]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current || loadingMore) return;

    setPage(prev => {
      const next = prev + 1;
      fetchComments(false, next);
      return next;
    });
  }, [hasMore, loadingMore, fetchComments]);

  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const list = document.querySelector('[data-comments-list]');
      if (list) {
        const scrollTop = list.scrollTop;
        const scrollHeight = list.scrollHeight;
        const clientHeight = list.clientHeight;
        
        if (scrollHeight - scrollTop - clientHeight < clientHeight * 0.2) {
          loadMore();
        }
      }
    }, 100);
  }, [loadMore]);

  // =============================
  // OPTIMISTIC UPDATES (depuis fichier 2)
  // =============================

  const addComment = useCallback(async (content, parentId = null, userInfo = {}) => {
    const tempId = `temp-${Date.now()}`;
    const newComment = {
      id: tempId,
      content,
      author: {
        id: userInfo.userId || currentUser?.id,
        full_name: userInfo.userName || currentUser?.full_name || 'Anonyme',
        avatar: userInfo.userAvatar || currentUser?.avatar
      },
      created_at: new Date().toISOString(),
      reactions: {},
      parent_comment_id: parentId,
      isTemp: true
    };

    // Optimistic update
    setStore(prevStore => {
      const newStore = mergeStore(prevStore, [newComment], false);
      return newStore;
    });

    try {
      const response = await client.post(`/posts/${postId}/comments`, {
        content,
        parent_comment_id: parentId
      });

      const realComment = response.data.comment;
      
      setStore(prevStore => {
        // Supprimer le temporaire et ajouter le vrai
        const withoutTemp = { ...prevStore };
        delete withoutTemp.byId[tempId];
        
        // Retirer tempId des childrenMap si nécessaire
        if (parentId && withoutTemp.childrenMap[parentId]) {
          withoutTemp.childrenMap[parentId] = withoutTemp.childrenMap[parentId].filter(id => id !== tempId);
        } else {
          withoutTemp.rootIds = withoutTemp.rootIds.filter(id => id !== tempId);
        }
        
        return mergeStore(withoutTemp, [realComment], false);
      });

      return true;
    } catch (err) {
      // Rollback
      setStore(prevStore => {
        const rolledBack = { ...prevStore };
        delete rolledBack.byId[tempId];
        if (parentId && rolledBack.childrenMap[parentId]) {
          rolledBack.childrenMap[parentId] = rolledBack.childrenMap[parentId].filter(id => id !== tempId);
        } else {
          rolledBack.rootIds = rolledBack.rootIds.filter(id => id !== tempId);
        }
        return rolledBack;
      });
      return false;
    }
  }, [postId, client, currentUser]);

  const deleteComment = useCallback(async (commentId) => {
    let deletedComment = null;
    
    // Sauvegarde pour rollback
    setStore(prevStore => {
      deletedComment = prevStore.byId[commentId];
      
      const newStore = { ...prevStore };
      delete newStore.byId[commentId];
      
      // Retirer des childrenMap
      Object.keys(newStore.childrenMap).forEach(parentId => {
        newStore.childrenMap[parentId] = newStore.childrenMap[parentId].filter(id => id !== commentId);
      });
      
      // Retirer des rootIds
      newStore.rootIds = newStore.rootIds.filter(id => id !== commentId);
      
      return newStore;
    });

    try {
      await client.delete(`/posts/${postId}/comments/${commentId}`);
      return true;
    } catch (err) {
      // Rollback
      if (deletedComment) {
        setStore(prevStore => mergeStore(prevStore, [deletedComment], false));
      }
      return false;
    }
  }, [postId, client]);

  const addReaction = useCallback(async (commentId, reactionType) => {
    let previousComment = null;
    
    setStore(prevStore => {
      previousComment = prevStore.byId[commentId];
      if (!previousComment) return prevStore;
      
      const reactions = { ...previousComment.reactions };
      const current = reactions[reactionType] || [];
      const userId = currentUser?.id;
      
      if (!userId) return prevStore;
      
      if (current.includes(userId)) {
        reactions[reactionType] = current.filter(id => id !== userId);
      } else {
        Object.keys(reactions).forEach(key => {
          reactions[key] = (reactions[key] || []).filter(id => id !== userId);
        });
        reactions[reactionType] = [...current, userId];
      }
      
      const newStore = { ...prevStore };
      newStore.byId[commentId] = { ...previousComment, reactions };
      
      return newStore;
    });

    try {
      await client.post(`/comments/${commentId}/react`, { type: reactionType });
      return true;
    } catch (err) {
      // Rollback
      if (previousComment) {
        setStore(prevStore => {
          const newStore = { ...prevStore };
          newStore.byId[commentId] = previousComment;
          return newStore;
        });
      }
      return false;
    }
  }, [client, currentUser]);

  const flatComments = useMemo(() => buildFlatList(store), [store]);

  return { 
    flatComments,
    loadMore, 
    loading,
    loadingMore,
    hasMore,
    handleScroll,
    addComment,
    deleteComment,
    addReaction
  };
};

// =============================
// VIRTUALIZED UI COMPONENT
// =============================

const CommentRow = ({ index, style, data, setRowHeight }) => {
  const comment = data[index];
  const rowRef = useRef(null);

  useEffect(() => {
    if (rowRef.current && setRowHeight) {
      setRowHeight(index, rowRef.current.clientHeight);
    }
  }, [index, setRowHeight, comment]);

  if (!comment) return null;

  return (
    <div style={style}>
      <div 
        ref={rowRef}
        style={{ 
          paddingLeft: Math.min(comment.depth * 20, 100),
          borderBottom: '1px solid #eee',
          paddingTop: '10px',
          paddingBottom: '10px',
          paddingRight: '10px'
        }}
      >
        <strong>{comment.author?.full_name || 'Anonyme'}</strong>
        <p style={{ 
          margin: '8px 0 0 0',
          wordBreak: 'break-word'
        }}>
          {comment.content}
        </p>
      </div>
    </div>
  );
};

export const CommentsList = ({ comments, onScroll, loadingMore }) => {
  const rowHeights = useRef({});
  
  const getRowHeight = useCallback((index) => {
    return rowHeights.current[index] || 80;
  }, []);

  const setRowHeight = useCallback((index, height) => {
    if (rowHeights.current[index] !== height) {
      rowHeights.current[index] = height;
    }
  }, []);

  if (!comments || comments.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Aucun commentaire pour le moment</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh' }}>
      <AutoSizer>
        {({ height, width }) => (
          <VariableList
            height={height}
            itemCount={comments.length}
            itemSize={getRowHeight}
            width={width}
            itemData={comments}
            onScroll={onScroll}
            outerElementType="div"
            outerRef={(ref) => {
              if (ref) {
                ref.setAttribute('data-comments-list', 'true');
              }
            }}
          >
            {({ index, style, data }) => (
              <CommentRow 
                index={index} 
                style={style} 
                data={data} 
                setRowHeight={setRowHeight}
              />
            )}
          </VariableList>
        )}
      </AutoSizer>
      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          Chargement...
        </div>
      )}
    </div>
  );
};
CommentRow.propTypes = {
  index: PropTypes.number.isRequired,
  style: PropTypes.object.isRequired,
  data: PropTypes.array.isRequired,
  setRowHeight: PropTypes.any.isRequired,
};
CommentsList.propTypes = {
  comments: PropTypes.array.isRequired,
  onScroll: PropTypes.func.isRequired,
  loadingMore: PropTypes.any.isRequired,
};
