import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { imagePreloader } from '../services/imagePreloader';
import BottomNav from '../components/BottomNav';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useTranslation } from 'react-i18next';
import { Search, Newspaper, Calendar, RefreshCw, ChevronRight, Filter, Globe, MapPin, Tag } from 'lucide-react';
import { toast } from 'sonner';
import PullToRefresh from '../components/PullToRefresh';
import PropTypes from 'prop-types';

// ========== CONSTANTES ==========
const LANGUAGES = [
  { value: 'all', label: 'Toutes les langues', flag: '🌐' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ln', label: 'Lingala', flag: '🇨🇩' },
  { value: 'sw', label: 'Swahili', flag: '🇨🇩' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' }
];

const COUNTRIES = [
  { value: 'all', label: 'Tous les pays', flag: '🌍' },
  { value: 'cd', label: 'République Démocratique du Congo', flag: '🇨🇩' },
  { value: 'fr', label: 'France', flag: '🇫🇷' },
  { value: 'be', label: 'Belgique', flag: '🇧🇪' },
  { value: 'ch', label: 'Suisse', flag: '🇨🇭' },
  { value: 'ca', label: 'Canada', flag: '🇨🇦' },
  { value: 'us', label: 'États-Unis', flag: '🇺🇸' },
  { value: 'gb', label: 'Royaume-Uni', flag: '🇬🇧' }
];

const CATEGORIES = [
  { value: 'all', label: 'Toutes les catégories' },
  { value: 'politique', label: 'Politique' },
  { value: 'economie', label: 'Économie' },
  { value: 'societe', label: 'Société' },
  { value: 'culture', label: 'Culture' },
  { value: 'sport', label: 'Sport' },
  { value: 'technologie', label: 'Technologie' },
  { value: 'sante', label: 'Santé' },
  { value: 'education', label: 'Éducation' },
  { value: 'environnement', label: 'Environnement' }
];

const countryFlags = {
  'fr': '🇫🇷', 'cd': '🇨🇩', 'be': '🇧🇪', 
  'ch': '🇨🇭', 'ca': '🇨🇦', 'us': '🇺🇸', 
  'gb': '🇬🇧', 'pt': '🇵🇹', 'all': '🌍'
};

const languageNames = {
  'fr': 'FR', 'en': 'EN', 'ln': 'LN', 
  'sw': 'SW', 'pt': 'PT', 'all': '🌐'
};

// ========== COMPOSANT IMAGE AVEC FALLBACK (MÉMOÏSÉ) ==========
const NewsImage = memo(({ src, alt, title }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [fallbackColor, setFallbackColor] = useState('#ff6b35');

  useEffect(() => {
    if (!src || imgError) {
      const hash = title.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0);
      const hue = Math.abs(hash % 360);
      setFallbackColor(`hsl(${hue}, 70%, 50%)`);
    }
  }, [title, src, imgError]);

  if (!src || imgError) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: `${fallbackColor}20` }}
      >
        <div className="text-center">
          <Newspaper className="w-16 h-16 mx-auto mb-2" style={{ color: fallbackColor }} />
          <p className="text-xs font-medium opacity-60" style={{ color: fallbackColor }}>
            {title?.substring(0, 30)}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
      />
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="w-8 h-8 border-2 border-[#ff6b35]/20 border-t-[#ff6b35] rounded-full animate-spin"></div>
        </div>
      )}
    </>
  );
});

NewsImage.displayName = 'NewsImage';

// ========== COMPOSANT FILTRES (MÉMOÏSÉ) ==========
const FilterBar = memo(({ filters, onFilterChange, showFilters, setShowFilters, totalResults }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-background border-b border-border sticky top-[120px] z-40 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-foreground/60 hover:text-[#ff6b35] transition-colors group"
          >
            <Filter className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
            <span className="text-xs font-black uppercase tracking-widest">
              {showFilters ? t('news.hide_filters') : t('news.show_filters')}
            </span>
          </button>
          
          {totalResults > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {totalResults} article{totalResults > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 animate-slideDown">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Globe className="w-4 h-4" />
                {t('news.language')}
              </label>
              <select
                value={filters.language}
                onChange={(e) => onFilterChange('language', e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {t('news.country')}
              </label>
              <select
                value={filters.country}
                onChange={(e) => onFilterChange('country', e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all"
              >
                {COUNTRIES.map(country => (
                  <option key={country.value} value={country.value}>
                    {country.flag} {country.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Tag className="w-4 h-4" />
                {t('news.category')}
              </label>
              <select
                value={filters.category}
                onChange={(e) => onFilterChange('category', e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

FilterBar.displayName = 'FilterBar';

// ========== COMPOSANT DE CARD NEWS (MÉMOÏSÉ) ==========
const NewsCard = memo(({ item, onClick }) => {
  const { i18n } = useTranslation();

  const formattedDate = useMemo(() => {
    return new Date(item.published_at || Date.now()).toLocaleDateString(
      i18n.language === 'fr' ? 'fr-FR' : 'en-US', 
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
  }, [item.published_at, i18n.language]);

  return (
    <Card 
      className="bg-card backdrop-blur-xl border border-border shadow-sm overflow-hidden group hover:bg-accent/50 transition-all hover:-translate-y-2 rounded-[40px] flex flex-col cursor-pointer"
      onClick={() => onClick(item.id)}
    >
      <div className="relative h-64 overflow-hidden bg-gray-100 dark:bg-gray-800">
        <NewsImage src={item.image_url} alt={item.title} title={item.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60" />
      </div>
      
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          <Calendar className="w-4 h-4 text-[#ff6b35]" />
          <span>{formattedDate}</span>
        </div>
        
        <h3 className="text-xl font-black text-foreground mb-4 group-hover:text-[#ff6b35] transition-colors leading-tight line-clamp-2">
          {item.title}
        </h3>
        
        <p className="text-muted-foreground text-sm font-medium mb-8 line-clamp-3 leading-relaxed">
          {item.summary || item.description || 'Pas de description disponible'}
        </p>
        
        <div className="mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {item.country && countryFlags[item.country] && (
                <span className="bg-card border border-border px-3 py-1.5 rounded-lg text-sm" title={COUNTRIES.find(c => c.value === item.country)?.label}>
                  {countryFlags[item.country]}
                </span>
              )}
              {item.language && languageNames[item.language] && (
                <span className="bg-card border border-border px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">
                  {languageNames[item.language]}
                </span>
              )}
              <span className="bg-[#ff6b35]/10 text-[#ff6b35] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">
                {item.source_name || item.source || 'Actualité'}
              </span>
            </div>
            <div className="flex items-center text-[#ff6b35] font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
              <span>Lire</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});

NewsCard.displayName = 'NewsCard';

// ========== COMPOSANT PRINCIPAL ==========
const News = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth(); // ✅ Hook personnalisé
  const { client } = useApiClient(); // ✅ Client API
  const navigate = useNavigate();
  const {
    cacheNewsDetail,
    setNewsScrollOffset,
    getNewsScrollOffset,
    setNewsPage,
    getNewsPage
  } = useGlobalCache();

  // États
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  
  // Filtres
  const [filters, setFilters] = useState({
    language: i18n.language || 'fr',
    country: 'all',
    category: 'all'
  });

  // Réf pour éviter les doubles appels
  const fetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // ========== FONCTION PRINCIPALE DE CHARGEMENT ==========
  const fetchNews = useCallback(async (pageNum = 1, append = false, newFilters = filters) => {
    if (fetchingRef.current) return [];
    fetchingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (pageNum === 1 && !append) setLoading(true);
      else if (append) setLoadingMore(true);
      
      const params = {
        limit: 20,
        page: pageNum,
        ...(newFilters.language !== 'all' && { language: newFilters.language }),
        ...(newFilters.country !== 'all' && { country: newFilters.country }),
        ...(newFilters.category !== 'all' && { category: newFilters.category })
      };
      
      const response = await client.get('/news/', { 
        params,
        signal: abortControllerRef.current.signal
      });
      
      const responseData = response.data;
      const newsData = Array.isArray(responseData) ? responseData : (responseData?.data || []);
      const total = responseData?.total || newsData.length;
      
      if (total > 0) setTotalResults(total);
      
      if (newsData.length > 0) {
        imagePreloader.preloadNewsImages(newsData);
        newsData.forEach(item => {
          if (item && item.id) cacheNewsDetail(item.id, item);
        });
      }

      setNews(prev => append ? [...prev, ...newsData] : newsData);
      setHasMore(newsData.length === 20);
      setPage(pageNum);
      setNewsPage('main', pageNum);
      
      return newsData;
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching news:', error);
        if (error.status !== 401) {
          toast.error(t('news.load_error'));
        }
      }
      return [];
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [client, cacheNewsDetail, setNewsPage, t]);

  // ========== GESTION DES FILTRES ==========
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      setPage(1);
      fetchNews(1, false, newFilters);
      return newFilters;
    });
  }, [fetchNews]);

  // ========== PULL TO REFRESH ==========
  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      const response = await client.get('/news/', {
        params: {
          limit: 20,
          page: 1,
          ...(filters.language !== 'all' && { language: filters.language }),
          ...(filters.country !== 'all' && { country: filters.country }),
          ...(filters.category !== 'all' && { category: filters.category })
        }
      });
      
      const newNewsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      
      if (newNewsData.length > 0) {
        const existingIds = new Set(news.map(n => n.id));
        const trulyNewNews = newNewsData.filter(n => n && n.id && !existingIds.has(n.id));
        
        if (trulyNewNews.length > 0) {
          setNews(prev => [...trulyNewNews, ...prev]);
          imagePreloader.preloadNewsImages(trulyNewNews);
          toast.success(
            trulyNewNews.length === 1 
              ? '1 nouvel article disponible' 
              : `${trulyNewNews.length} nouveaux articles disponibles`
          );
        } else {
          toast.info('Aucun nouvel article');
        }
      }
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Erreur lors du rafraîchissement');
    } finally {
      setIsRefreshing(false);
    }
  }, [client, news, filters]);

  // ========== CHARGER PLUS ==========
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchNews(page + 1, true);
    }
  }, [fetchNews, page, loadingMore, hasMore]);

  // ========== CHARGEMENT INITIAL ==========
  useEffect(() => {
    if (user) {
      const savedPage = getNewsPage('main') || 1;
      setPage(savedPage);
      fetchNews(savedPage, false);
    } else {
      navigate('/auth');
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user, navigate, getNewsPage, fetchNews]);

  // ========== SAUVEGARDE DU SCROLL ==========
  useEffect(() => {
    const handleScroll = () => {
      setNewsScrollOffset('main', window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setNewsScrollOffset]);

  useEffect(() => {
    const savedScroll = getNewsScrollOffset('main');
    if (savedScroll && !loading) {
      setTimeout(() => {
        window.scrollTo({ top: savedScroll, behavior: 'instant' });
      }, 100);
    }
  }, [loading, getNewsScrollOffset]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
          {/* Header */}
      <div className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#ff8b5c] flex items-center justify-center shadow-2xl shadow-[#ff6b35]/20">
              <Newspaper className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-black text-foreground tracking-tight">{t('news.title')}</h1>
              <p className="text-muted-foreground font-medium">{t('news.subtitle')}</p>
            </div>
            {isRefreshing && <RefreshCw className="w-6 h-6 animate-spin text-[#ff6b35]" />}
            {user?.isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-[#ff6b35]"
                onClick={() => navigate('/news-raw')}
              >
                Debug
              </Button>
            )}
          </div>
        </div>
      </div>

      <FilterBar 
        filters={filters}
        onFilterChange={handleFilterChange}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        totalResults={totalResults}
      />

      <PullToRefresh 
        onRefresh={handlePullToRefresh}
        pullingContent={<div className="text-center py-4 text-muted-foreground">↓ Relâcher pour rafraîchir</div>}
        refreshingContent={
          <div className="text-center py-4 text-[#ff6b35] flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Rafraîchissement...</span>
          </div>
        }
      >
        <div className="max-w-6xl mx-auto px-4 py-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="w-16 h-16 border-4 border-[#ff6b35]/20 border-t-[#ff6b35] rounded-full animate-spin"></div>
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">{t('news.loading')}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-32 bg-card rounded-[48px] border border-border shadow-sm">
              <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-[#ff6b35]/10 flex items-center justify-center">
                <Newspaper className="w-12 h-12 text-[#ff6b35]/40" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-2">{t('news.empty.title')}</h3>
              <p className="text-muted-foreground font-medium max-w-md mx-auto">{t('news.empty.desc')}</p>
              
              {filters.language !== 'all' || filters.country !== 'all' || filters.category !== 'all' ? (
                <Button
                  onClick={() => {
                    setFilters({ language: i18n.language || 'fr', country: 'all', category: 'all' });
                    fetchNews(1, false, { language: i18n.language || 'fr', country: 'all', category: 'all' });
                  }}
                  className="mt-8 bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm"
                >
                  Réinitialiser les filtres
                </Button>
              ) : (
                <Button onClick={handlePullToRefresh} className="mt-8 bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm">
                  <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {news.map(item => (
                  <NewsCard key={item.id} item={item} onClick={(id) => navigate(`/news/${id}`)} />
                ))}
              </div>
              {hasMore && (
                <div className="text-center mt-16">
                  <Button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="bg-card border border-border hover:bg-accent/50 text-foreground px-10 py-6 rounded-full font-black uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      'Charger plus d\'articles'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </PullToRefresh>

      <BottomNav />
    </div>
  );
};

News.propTypes = {};

export default News;
