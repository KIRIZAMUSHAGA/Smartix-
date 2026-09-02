import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  ShoppingCart, Search, Filter, Star, Heart, Eye, 
  BookOpen, Zap, TrendingUp, Award, Menu, X, ChevronDown, Loader2, WifiOff
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { getImageUrl } from '../config/apiClient';
import './MarketplaceV2.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const MAX_PRICE = 10000;
const ITEMS_PER_PAGE = 12;
const DEBOUNCE_DELAY = 400;
const DEFAULT_IMAGE = '/assets/placeholder-product.jpg';
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const sortOptions = [
  { value: 'newest', label: 'Les plus récents', icon: Zap },
  { value: 'popular', label: 'Les plus populaires', icon: TrendingUp },
  { value: 'top_rated', label: 'Les mieux notés', icon: Award },
  { value: 'price_low', label: 'Prix: Bas à haut', icon: ChevronDown },
  { value: 'price_high', label: 'Prix: Haut à bas', icon: ChevronDown }
];

// =============================
// 2️⃣ CACHE LRU AVEC NETTOYAGE
// =============================
class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Vérifier TTL
    if (Date.now() - item.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // Mettre à jour l'ordre (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key, value) {
    // Nettoyer si trop grand
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data: value.data,
      hasMore: value.hasMore,
      total: value.total,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const apiCache = new LRUCache();

// =============================
// 3️⃣ COMPOSANT PRODUIT CARD
// =============================
const ProductCard = ({ product, onBuy, onWishlist, onQuickView }) => {
  const [imageError, setImageError] = useState(false);
  
  const coverImage = useMemo(() => {
    if (imageError) return DEFAULT_IMAGE;
    const url = getImageUrl(product.cover_image, 'products');
    return url || DEFAULT_IMAGE;
  }, [product.cover_image, imageError]);

  return (
    <Card className="product-card group hover:shadow-xl transition-all duration-300">
      <div className="product-image relative overflow-hidden rounded-t-xl">
        <img 
          src={coverImage} 
          alt={product.title} 
          loading="lazy"
          className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImageError(true)}
        />
        
        {/* Overlay au survol */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={() => onQuickView(product)}
            className="p-2.5 bg-white rounded-full hover:bg-gray-100 transition-all hover:scale-110"
            aria-label="Voir aperçu"
          >
            <Eye size={18} className="text-gray-800" />
          </button>
          <button
            onClick={() => onBuy(product)}
            className="p-2.5 bg-[#ff6b35] rounded-full hover:bg-[#ff8c61] transition-all hover:scale-110"
            aria-label="Acheter"
          >
            <ShoppingCart size={18} className="text-white" />
          </button>
        </div>

        {/* Badge */}
        <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#ff6b35] text-white text-xs font-medium rounded-full shadow-md">
          {product.quantity_sold > 100 ? '🔥 Populaire' : '✨ Nouveau'}
        </span>

        {/* Wishlist button */}
        <button
          onClick={() => onWishlist(product.id)}
          className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-all hover:scale-110"
          aria-label="Ajouter aux favoris"
        >
          <Heart size={16} className="text-gray-600" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-gray-900 line-clamp-1 flex-1 text-lg" title={product.title}>
            {product.title}
          </h3>
          <div className="flex items-center gap-1 ml-2 bg-gray-100 px-2 py-0.5 rounded-full">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-gray-700">
              {(product.rating || 0).toFixed(1)}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-2 truncate">
          Par: {product.seller_name || product.seller?.username || 'Vendeur'}
        </p>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">
          {product.description}
        </p>

        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-xl font-bold text-[#ff6b35]">
              {product.price} {product.currency}
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              Stock: {product.quantity_available}
            </p>
          </div>
          <Button
            onClick={() => onBuy(product)}
            size="sm"
            className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-full px-5 py-2 transition-all hover:scale-105"
          >
            <ShoppingCart size={14} className="mr-1" />
            Acheter
          </Button>
        </div>
      </div>
    </Card>
  );
};

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const MarketplaceV2 = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, MAX_PRICE]);
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Refs
  const debounceTimerRef = useRef(null);
  const observerRef = useRef(null);
  const lastProductRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  // Détection connexion
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sidebar responsive
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fonction de chargement avec cache amélioré
  const loadProducts = useCallback(async (reset = false, isLoadMore = false) => {
    if (!isOnline) {
      toast.error('Pas de connexion Internet', {
        icon: <WifiOff className="w-4 h-4" />
      });
      setLoading(false);
      return;
    }
    
    if (!reset && loadingMore) return;
    if (!hasMore && !reset) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        sort_by: sortBy,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
        max_price: priceRange[1] < MAX_PRICE ? priceRange[1] : undefined,
        search: searchQuery || undefined
      };

      // Vérifier le cache
      const cacheKey = JSON.stringify({ ...params, page: currentPage });
      const cached = apiCache.get(cacheKey);
      
      if (cached && reset) {
        setProducts(cached.data);
        setHasMore(cached.hasMore);
        setTotalProducts(cached.total);
        setLoading(false);
        return;
      }

      const response = await client.get('/marketplace/products', { 
        params,
        signal: abortControllerRef.current.signal
      });
      
      const data = Array.isArray(response?.data) ? response.data : [];
      const total = response?.meta?.pagination?.total ?? 0;
      const hasMoreData = data.length === ITEMS_PER_PAGE;

      // Mise à jour des produits
      if (reset) {
        setProducts(data);
        setPage(2);
      } else {
        setProducts(prev => [...prev, ...data]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(hasMoreData);
      setTotalProducts(total);
      
      // Mettre en cache
      apiCache.set(cacheKey, {
        data: reset ? data : [...(cached?.data || []), ...data],
        hasMore: hasMoreData,
        total
      });

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading products:', error);
        
        // ✅ Gestion d'erreur fine
        if (!navigator.onLine) {
          toast.error('Pas de connexion Internet', {
            icon: <WifiOff className="w-4 h-4" />
          });
        } else if (error.status === 429) {
          toast.error('Trop de requêtes, patientez un instant');
        } else if (error.status >= 500) {
          toast.error('Service temporairement indisponible');
        } else if (error.code === 'ECONNABORTED') {
          toast.error('Connexion trop lente, réessayez');
        } else {
          toast.error('Erreur lors du chargement des produits');
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      abortControllerRef.current = null;
    }
  }, [client, page, sortBy, selectedCategory, priceRange, searchQuery, hasMore, loadingMore, isOnline]);

  // Charger les catégories
  const loadCategories = useCallback(async () => {
    try {
      const response = await client.get('/marketplace/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [client]);

  // Debounce pour la recherche
  const debouncedLoad = useCallback((reset = true) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      loadProducts(reset);
    }, DEBOUNCE_DELAY);
  }, [loadProducts]);

  // ✅ Éviter double fetch au démarrage
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      loadCategories();
      loadProducts(true);
      return;
    }
    debouncedLoad(true);
  }, [searchQuery, sortBy, selectedCategory, priceRange, debouncedLoad, loadCategories, loadProducts]);

  // Actions
  const handleBuyProduct = useCallback((product) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour acheter');
      navigate('/auth');
      return;
    }
    navigate(`/marketplace/product/${product.id}`);
  }, [user, navigate]);

  const handleAddToWishlist = useCallback(async (productId) => {
    if (!user) {
      toast.error('Veuillez vous connecter');
      navigate('/auth');
      return;
    }

    try {
      await client.post(`/marketplace/wishlist/${productId}`);
      toast.success('Ajouté à votre liste de souhaits ❤️');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Erreur lors de l\'ajout');
    }
  }, [user, client, navigate]);

  const handleQuickView = useCallback((product) => {
    navigate(`/marketplace/product/${product.id}`);
  }, [navigate]);

  // Intersection Observer pour scroll infini
  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loadingMore && !loading) {
      loadProducts(false, true);
    }
  }, [hasMore, loadingMore, loading, loadProducts]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px'
    });
    
    if (lastProductRef.current) {
      observerRef.current.observe(lastProductRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver, products]);

  // Réinitialiser les filtres
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setPriceRange([0, MAX_PRICE]);
    setSortBy('newest');
  }, []);

  if (loading && page === 1) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Smartix Store</h1>
          <p className="text-white/90">Découvrez des formations, livres et cours numériques</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Indicateur hors ligne */}
        {!isOnline && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-2 text-yellow-500 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>Mode hors-ligne - Données en cache uniquement</span>
          </div>
        )}

        {/* Barre de recherche et filtres */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher des produits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-shadow"
              disabled={!isOnline}
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Filter size={20} />
            Filtres
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar filtres */}
          {(sidebarOpen || showFilters) && (
            <div className={`md:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden md:block'}`}>
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
                <div className="flex justify-between items-center mb-4 md:hidden">
                  <h3 className="font-bold text-lg">Filtres</h3>
                  <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X size={20} />
                  </button>
                </div>

                {/* Catégories */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-gray-700">Catégories</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="radio"
                        value="all"
                        checked={selectedCategory === 'all'}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-4 h-4 text-[#ff6b35]"
                      />
                      <span className="text-sm">Tous les produits</span>
                    </label>
                    {categories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="radio"
                          value={cat.id}
                          checked={selectedCategory === cat.id}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-4 h-4 text-[#ff6b35]"
                        />
                        <span className="text-sm">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Prix */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-gray-700">Prix</h4>
                  <div className="space-y-3">
                    <input
                      type="range"
                      min="0"
                      max={MAX_PRICE}
                      value={priceRange[0]}
                      onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                      className="w-full accent-[#ff6b35]"
                      disabled={!isOnline}
                    />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{priceRange[0]} FC</span>
                      <span className="text-gray-400">—</span>
                      <span>{priceRange[1]} FC</span>
                    </div>
                  </div>
                </div>

                {/* Tri */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-gray-700">Trier par</h4>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6b35] disabled:opacity-50"
                    disabled={!isOnline}
                  >
                    {sortOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Reset button */}
                <button
                  onClick={resetFilters}
                  className="w-full mt-4 py-2 text-sm text-[#ff6b35] hover:underline"
                  disabled={!isOnline}
                >
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          )}

          {/* Liste des produits */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedCategory === 'all' ? 'Tous les produits' : `Produits: ${selectedCategory}`}
                <span className="text-gray-500 text-sm ml-2">({totalProducts})</span>
              </h2>
            </div>

            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product, index) => {
                    const isLast = index === products.length - 1;
                    return (
                      <div
                        key={product.id}
                        ref={isLast ? lastProductRef : null}
                      >
                        <ProductCard
                          product={product}
                          onBuy={handleBuyProduct}
                          onWishlist={handleAddToWishlist}
                          onQuickView={handleQuickView}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#ff6b35]" />
                  </div>
                )}

                {/* End of list */}
                {!hasMore && products.length > 0 && (
                  <p className="text-center text-gray-500 py-8 text-sm">
                    Vous avez atteint la fin du catalogue
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm">
                <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun produit trouvé</h3>
                <p className="text-gray-500 mb-4">Essayez de modifier vos filtres</p>
                <button
                  onClick={resetFilters}
                  className="text-[#ff6b35] hover:underline font-medium"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

MarketplaceV2.propTypes = {};

export default MarketplaceV2;
ProductCard.propTypes = {
  product: PropTypes.object.isRequired,
  onBuy: PropTypes.func.isRequired,
  onWishlist: PropTypes.func.isRequired,
  onQuickView: PropTypes.func.isRequired,
};
