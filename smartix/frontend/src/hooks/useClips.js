import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export function useClips({ user, isOnline } = {}) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const abortRef = useRef(null);

  const token = user?.token || localStorage.getItem('access_token');

  const fetchClips = useCallback(async (reset = false) => {
    if (!isOnline) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const currentPage = reset ? 1 : page;
      const res = await axios.get('/api/smartclips', {
        params: { page: currentPage, limit: 10 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: abortRef.current.signal,
      });
      const data = res.data?.clips || res.data || [];
      if (reset) { setClips(data); setPage(2); }
      else { setClips(prev => [...prev, ...data]); setPage(p => p + 1); }
      setHasMore(data.length >= 10);
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, isOnline, token]);

  useEffect(() => {
    fetchClips(true);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  const refresh = useCallback(() => fetchClips(true), [fetchClips]);
  const loadMore = useCallback(() => { if (hasMore && !loading && !loadingMore) fetchClips(); }, [hasMore, loading, loadingMore, fetchClips]);

  const handleLike = useCallback(async (clipId) => {
    if (!token) return;
    try {
      await axios.post(`/api/smartclips/${clipId}/like`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, liked: !c.liked, likes_count: (c.likes_count || 0) + (c.liked ? -1 : 1) } : c));
    } catch (e) { console.error('Like error:', e); }
  }, [token]);

  const handleSave = useCallback(async (clipId) => {
    if (!token) return;
    try {
      await axios.post(`/api/smartclips/${clipId}/save`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, saved: !c.saved } : c));
    } catch (e) { console.error('Save error:', e); }
  }, [token]);

  const handleFollow = useCallback(async (userId) => {
    if (!token) return;
    try {
      await axios.post(`/api/users/${userId}/follow`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) { console.error('Follow error:', e); }
  }, [token]);

  const handleDownload = useCallback((clip) => {
    if (clip?.video_url) window.open(clip.video_url, '_blank');
  }, []);

  const updateCommentCount = useCallback((clipId, delta = 1) => {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, comments_count: (c.comments_count || 0) + delta } : c));
  }, []);

  const isValidVideoUrl = useCallback((url) => {
    if (!url) return false;
    return url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg') || url.includes('video');
  }, []);

  const getClipById = useCallback((id) => clips.find(c => c.id === id) || null, [clips]);

  return { clips, loading, loadingMore, error, hasMore, refresh, loadMore, handleLike, handleSave, handleFollow, handleDownload, updateCommentCount, isValidVideoUrl, getClipById };
}

export default useClips;
