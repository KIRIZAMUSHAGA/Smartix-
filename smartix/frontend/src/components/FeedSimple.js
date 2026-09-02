import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../contexts/ApiClientContext';
import { toast } from 'sonner';
import PostItem from './PostItem';
import { VariableSizeList as List } from 'react-window';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';

// =============================
// CONFIG
// =============================

const OVERSCAN_COUNT = 5;
const MIN_POST_HEIGHT = 400;
const MAX_POST_HEIGHT = 1200;
const HEIGHT_CHANGE_THRESHOLD = 30; // ✅ Augmenté
const COMMENT_TIMEOUT = 15000;

// =============================
// HOOK WINDOW SIZE
// =============================
const useWindowSize = () => {
  const [size, setSize] = useState({
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    width: typeof window !== 'undefined' ? window.innerWidth : 600
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({ height: window.innerHeight, width: window.innerWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

// =============================
// POST ROW (hors composant)
// =============================
const PostRow = React.memo(({ data, index, style }) => {
  const { posts, selectedPostForComments, commentsByPost, toggleComments, onShareComplete, sizeMap, setSize } = data;
  const post = posts[index];
  const rowRef = useRef(null);

  useEffect(() => {
    if (rowRef.current) {
      const height = rowRef.current.getBoundingClientRect().height;
      if (height > 0 && sizeMap.current[index] !== height) {
        sizeMap.current[index] = height;
        setSize(index, height);
      }
    }
  }, [index, sizeMap, setSize, selectedPostForComments, commentsByPost[post?.id]]);

  if (!post) return null;

  return (
    <div style={style}>
      <div ref={rowRef}>
        <PostItem
          post={post}
          index={index}
          postsCount={posts.length}
          onShareComplete={onShareComplete}
          toggleComments={toggleComments}
          selectedPostForComments={selectedPostForComments}
          commentsByPost={commentsByPost}
        />
      </div>
    </div>
  );
});

PostRow.displayName = 'PostRow';

// =============================
// FEED SIMPLE
// =============================
const FeedSimple = ({ initialPosts }) => {
  const navigate = useNavigate();
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowSize();

  const [posts, setPosts] = useState(initialPosts || []);

  useEffect(() => {
    if (Array.isArray(initialPosts)) {
      setPosts(initialPosts);
    }
  }, [initialPosts]);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [loadingComments, setLoadingComments] = useState({});

  const sizeMap = useRef({});
  const listRef = useRef(null);
  const debouncedSetSize = useDebounce((index) => {
    if (listRef.current) listRef.current.resetAfterIndex(index);
  }, 100);

  // =============================
  // TOGGLE COMMENTS
  // =============================
  const toggleComments = useCallback(async (post) => {
    const postId = post.id || post._id;
    if (!postId) return;

    if (selectedPostForComments === postId) {
      setSelectedPostForComments(null);
      return;
    }
    setSelectedPostForComments(postId);

    if (!commentsByPost[postId]) {
      setLoadingComments(prev => ({ ...prev, [postId]: true }));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), COMMENT_TIMEOUT);

        const result = await queryClient.fetchQuery({
          queryKey: ['comments', postId],
          queryFn: async () => {
            const res = await client.get(`/posts/${postId}/comments?limit=10`, {
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return res.data.comments || [];
          },
          staleTime: 5 * 60 * 1000,
        });

        setCommentsByPost(prev => ({ ...prev, [postId]: result }));
      } catch (err) {
        console.error('❌ Comments error:', err);

        if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
          toast.error('Connexion trop lente, réessayez');
        } else if (err.response?.status === 429) {
          toast.error('Trop de requêtes, patientez');
        } else if (err.response?.status === 503) {
          toast.error('Service temporairement indisponible', {
            action: { label: 'Réessayer', onClick: () => toggleComments(post) }
          });
        } else {
          toast.error('Erreur chargement commentaires');
        }
      } finally {
        setLoadingComments(prev => ({ ...prev, [postId]: false }));
      }
    }

    setTimeout(() => {
      if (listRef.current) {
        const index = posts.findIndex(p => (p.id || p._id) === postId);
        if (index !== -1) listRef.current.resetAfterIndex(index);
      }
    }, 100);
  }, [selectedPostForComments, commentsByPost, posts, client, queryClient]);

  // =============================
  // PREFETCH COMMENTS ON HOVER
  // =============================
  const handleMouseEnter = useCallback((postId) => {
    if (!commentsByPost[postId] && !loadingComments[postId]) {
      queryClient.prefetchQuery({
        queryKey: ['comments', postId],
        queryFn: async () => {
          const res = await client.get(`/posts/${postId}/comments?limit=10`);
          return res.data.comments || [];
        },
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [commentsByPost, loadingComments, client, queryClient]);

  // =============================
  // HANDLE SHARE COMPLETE
  // =============================
  const handleShareComplete = useCallback((newPost) => {
    console.log('✅ Post partagé reçu:', newPost.id);
    setPosts(prev => [newPost, ...prev]);
  }, []);

  // =============================
  // HEIGHT MANAGEMENT
  // =============================
  const getItemSize = useCallback(index => sizeMap.current[index] || MIN_POST_HEIGHT, []);
  
  const setItemSize = useCallback((index, size) => {
    const currentSize = sizeMap.current[index] || 0;
    if (Math.abs(currentSize - size) > HEIGHT_CHANGE_THRESHOLD) {
      sizeMap.current[index] = Math.min(size, MAX_POST_HEIGHT);
      debouncedSetSize(index);
    }
  }, [debouncedSetSize]);

  // =============================
  // ITEM DATA FOR LIST
  // =============================
  const listData = useMemo(() => ({
    posts,
    selectedPostForComments,
    commentsByPost,
    toggleComments,
    onShareComplete: handleShareComplete,
    sizeMap,
    setSize: setItemSize
  }), [posts, selectedPostForComments, commentsByPost, toggleComments, handleShareComplete, setItemSize]);

  // =============================
  // RENDER
  // =============================
  if (!posts || posts.length === 0) return null;

  return (
    <div className="w-full max-w-[600px] mx-auto">
      {posts.length > 30 ? (
        <List
          ref={listRef}
          height={windowHeight - 200}
          itemCount={posts.length}
          itemSize={getItemSize}
          width="100%"
          itemData={listData}
          overscanCount={OVERSCAN_COUNT}
          itemKey={(index, data) => data.posts[index]?.id || data.posts[index]?._id || index}
          onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
            for (let i = visibleStartIndex; i <= visibleStopIndex; i++) {
              const post = posts[i];
              if (post) {
                const postId = post.id || post._id;
                if (postId && !commentsByPost[postId]) {
                  handleMouseEnter(postId);
                }
              }
            }
          }}
        >
          {PostRow}
        </List>
      ) : (
        <div className="flex flex-col gap-0">
          {posts.map((post, index) => {
            const postId = post.id || post._id;
            return (
              <div key={postId} onMouseEnter={() => handleMouseEnter(postId)}>
                <PostItem
                  post={post}
                  index={index}
                  postsCount={posts.length}
                  onShareComplete={handleShareComplete}
                  toggleComments={toggleComments}
                  selectedPostForComments={selectedPostForComments}
                  commentsByPost={commentsByPost}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="py-4 text-center text-gray-400 text-sm">
        Fin du fil d'actualités
      </div>
    </div>
  );
};

// =============================
// CUSTOM MEMO
// =============================
const areEqual = (prevProps, nextProps) => {
  // Si les références sont identiques
  if (prevProps.initialPosts === nextProps.initialPosts) return true;
  
  // Si les longueurs diffèrent
  if (prevProps.initialPosts?.length !== nextProps.initialPosts?.length) return false;
  
  // Comparer les IDs
  for (let i = 0; i < prevProps.initialPosts?.length; i++) {
    const prevId = prevProps.initialPosts[i]?.id || prevProps.initialPosts[i]?._id;
    const nextId = nextProps.initialPosts[i]?.id || nextProps.initialPosts[i]?._id;
    if (prevId !== nextId) return false;
  }
  
  return true;
};

FeedSimple.propTypes = {
  initialPosts: PropTypes.array
};

export default React.memo(FeedSimple, areEqual);
