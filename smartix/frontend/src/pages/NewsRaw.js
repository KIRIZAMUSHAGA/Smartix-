import React, { useEffect, useState, useContext, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from '../contexts/AuthContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';  // ← Corrigé
import { imagePreloader } from '../services/ImagePreloaderService';
import axiosInstance from "../config/axiosConfig";
import PropTypes from 'prop-types';

export default function NewsUserSegmented({ debug = false }) {
  const { user } = useContext(AuthContext);
  const { getNewsCache, updateNewsCache, isNewsCacheValid } = useGlobalCache();
  const navigate = useNavigate();

  const [payload, setPayload] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [responseInfo, setResponseInfo] = useState({});
  const [filters, setFilters] = useState({
    country: user?.country || 'all',
    language: user?.language || 'all'
  });
  
  const observer = useRef();
  const limit = 20;

  // Clé de cache intelligente
  const cacheKey = user?.id 
    ? `user_${user.id}_${filters.country}_${filters.language}`
    : `guest_${filters.country}_${filters.language}`;

  // Redirection si pas connecté
  useEffect(() => {
    if (!user) navigate('/news');
  }, [user, navigate]);

  const fetchNews = useCallback(async (currentPage, controller) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Vérifier le cache pour la page 1 seulement
      if (currentPage === 1) {
        const cached = getNewsCache(cacheKey);
        if (cached && isNewsCacheValid(cacheKey)) {
          if (debug) console.log("📦 Using cached news for", cacheKey);
          setPayload(cached.items || []);
          setHasMore(cached.hasMore ?? true);
          setPage(cached.page || 1);
          setLoading(false);
          return;
        }
      }

      const params = new URLSearchParams({
        limit,
        page: currentPage,
        country: filters.country,
        language: filters.language
      });

      if (debug) console.log(`🔍 Fetching news ${cacheKey} page ${currentPage}...`);

      const response = await axiosInstance.get(`/news?${params.toString()}`, { 
        signal: controller.signal 
      });

      const newArticles = response.data?.data || response.data || [];
      
      setPayload(prev => currentPage === 1 ? newArticles : [...prev, ...newArticles]);
      
      const moreAvailable = newArticles.length === limit;
      setHasMore(moreAvailable);

      // Mettre en cache seulement pour la page 1
      if (currentPage === 1) {
        updateNewsCache(cacheKey, {
          items: newArticles,
          lastFetch: Date.now(),
          page: currentPage,
          hasMore: moreAvailable
        });
      }

      // Préchargement images
      if (newArticles.length > 0) {
        imagePreloader.preloadNewsImages(newArticles);
      }

      setResponseInfo({
        status: response.status,
        timestamp: new Date().toISOString(),
        url: response.config.url,
        count: newArticles.length
      });
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error("❌ News fetch error:", err);
      setError(err.message);
      setResponseInfo({ error: err.message, timestamp: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [cacheKey, filters, getNewsCache, isNewsCacheValid, updateNewsCache, user, debug]);

  // Infinite scroll
  const lastArticleRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prev => prev + 1);
      }
    }, {
      threshold: 0.5,
      rootMargin: '100px'
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Chargement initial et page change
  useEffect(() => {
    const controller = new AbortController();
    fetchNews(page, controller);
    return () => controller.abort();
  }, [page, fetchNews]);

  // Gestion du rafraîchissement
  const handleRefresh = useCallback(() => {
    setPage(1);
    setPayload([]);
    // Optionnel: forcer le rechargement en vidant le cache
    // updateNewsCache(cacheKey, null);
  }, []);

  // Gestion des changements de filtres
  const handleFilterChange = useCallback((type, value) => {
    setFilters(prev => ({ ...prev, [type]: value }));
    setPage(1);  // Reset à la page 1
    setPayload([]);  // Vider les articles
  }, []);

  const styles = {
    container: { 
      padding: 20, 
      maxWidth: 1200, 
      margin: '0 auto', 
      fontFamily: 'system-ui, -apple-system, sans-serif' 
    },
    header: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20 
    },
    filters: {
      display: 'flex',
      gap: 10,
      marginBottom: 20
    },
    select: {
      padding: 8,
      borderRadius: 4,
      border: '1px solid #ddd'
    },
    articleCard: { 
      border: '1px solid #ddd', 
      padding: 15, 
      marginBottom: 10, 
      borderRadius: 8,
      transition: 'all 0.2s',
      cursor: 'pointer'
    },
    button: { 
      padding: '8px 16px', 
      background: '#ff6b35', 
      color: 'white', 
      border: 'none', 
      borderRadius: 4, 
      cursor: 'pointer', 
      fontSize: 14,
      transition: 'background 0.2s'
    },
    errorBox: { 
      background: '#ffebee', 
      color: '#c62828', 
      padding: 15, 
      borderRadius: 8, 
      marginBottom: 20 
    },
    infoBox: {
      background: '#e3f2fd',
      padding: 10,
      borderRadius: 4,
      marginBottom: 20,
      fontSize: 12
    },
    pre: { 
      background: '#1e1e1e', 
      color: '#d4d4d4', 
      padding: 20, 
      borderRadius: 8, 
      overflow: 'auto', 
      fontSize: 12, 
      maxHeight: 400 
    }
  };

  if (!user) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>📰 News Segmentées + Cache + Infinite Scroll</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={styles.button} onClick={handleRefresh}>
            🔄 Rafraîchir
          </button>
          <button 
            style={{...styles.button, background: '#666'}} 
            onClick={() => navigate('/news')}
          >
            ← Retour
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div style={styles.filters}>
        <select 
          style={styles.select}
          value={filters.country}
          onChange={(e) => handleFilterChange('country', e.target.value)}
        >
          <option value="all">🌍 Tous pays</option>
          <option value="cd">🇨🇩 RDC</option>
          <option value="fr">🇫🇷 France</option>
          <option value="be">🇧🇪 Belgique</option>
          <option value="ch">🇨🇭 Suisse</option>
          <option value="ca">🇨🇦 Canada</option>
        </select>

        <select 
          style={styles.select}
          value={filters.language}
          onChange={(e) => handleFilterChange('language', e.target.value)}
        >
          <option value="all">🌐 Toutes langues</option>
          <option value="fr">🇫🇷 Français</option>
          <option value="en">🇬🇧 English</option>
          <option value="ln">🇨🇩 Lingala</option>
          <option value="sw">🇨🇩 Swahili</option>
        </select>

        <span style={{ alignSelf: 'center', fontSize: 12, color: '#666' }}>
          Cache: {cacheKey}
        </span>
      </div>

      {/* Infos de debug */}
      {debug && responseInfo.timestamp && (
        <div style={styles.infoBox}>
          <strong>Cache Key:</strong> {cacheKey}<br/>
          <strong>Page:</strong> {page}<br/>
          <strong>Articles:</strong> {payload.length}<br/>
          <strong>Has More:</strong> {hasMore ? 'Oui' : 'Non'}<br/>
          <strong>Status:</strong> {responseInfo.status}<br/>
          <strong>Timestamp:</strong> {responseInfo.timestamp}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={styles.errorBox}>
          <strong>❌ Erreur:</strong> {error}
        </div>
      )}

      {/* Liste des articles */}
      {payload.map((article, i) => {
        const isLast = i === payload.length - 1;
        return (
          <div 
            key={article.id || i} 
            ref={isLast ? lastArticleRef : null} 
            style={styles.articleCard}
            onClick={() => navigate(`/news/${article.id}`)}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <h4>{article.title || 'Sans titre'}</h4>
            <p><strong>Source:</strong> {article.source_name || article.source || 'N/A'}</p>
            <p><strong>Publié:</strong> {article.published_at ? new Date(article.published_at).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Pays:</strong> {article.country || 'N/A'}</p>
            <p><strong>Langue:</strong> {article.language || 'N/A'}</p>
            <p><strong>Catégorie:</strong> {article.category || 'N/A'}</p>
            <p><strong>Résumé:</strong> {article.summary || article.description || 'Pas de résumé'}</p>
          </div>
        );
      })}

      {/* États de chargement */}
      {loading && <p style={{ textAlign: 'center', color: '#666' }}>Chargement…</p>}
      {!hasMore && payload.length > 0 && (
        <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>
          📌 Fin des articles
        </p>
      )}
    </div>
  );
  }
NewsUserSegmented.propTypes = {
  debug: PropTypes.any,
};
