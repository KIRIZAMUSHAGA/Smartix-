import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  BarChart3, DollarSign, Package, ShoppingBag, TrendingUp,
  Plus, Edit, Trash2, Download, Menu, X, FileText, Loader2, 
  AlertCircle, WifiOff, RefreshCw, Eye, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useOfflineStatus } from '../contexts/OfflineContext';
import { getImageUrl } from '../config/apiClient';
import { useDebounce } from '../hooks/useDebounce';
import { ErrorBoundary } from '../components/ErrorBoundary';
import './SellerDashboard.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES & CONFIGURATION
// =============================
const DEFAULT_IMAGE = '/assets/placeholder-product.jpg';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const REFRESH_DEBOUNCE_MS = 2000;

// Configuration des onglets
const TABS = {
  OVERVIEW: 'overview',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  WALLET: 'wallet'
};

// =============================
// 2️⃣ HOOKS PERSONNALISÉS
// =============================

// Hook pour la gestion du cache
const useCache = (ttl) => {
  const cache = useRef(new Map());
  
  const get = useCallback((key) => {
    const cached = cache.current.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  }, [ttl]);
  
  const set = useCallback((key, data) => {
    cache.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);
  
  const remove = useCallback((key) => {
    cache.current.delete(key);
  }, []);
  
  const clear = useCallback(() => {
    cache.current.clear();
  }, []);
  
  return { get, set, remove, clear };
};

// Hook pour la gestion des requêtes avec retry
const useApiWithRetry = () => {
  const { client } = useApiClient();
  
  const executeWithRetry = useCallback(async (apiCall, attempts = RETRY_ATTEMPTS) => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        if (error.name === 'AbortError') throw error;
        if (error.response?.status === 404) throw error;
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }, [client]);
  
  return { executeWithRetry };
};

// Hook pour la gestion de l'état de chargement par ressource
const useResourceLoading = () => {
  const [loadingState, setLoadingState] = useState({
    stats: false,
    products: false,
    orders: false,
    delete: false,
    buyers: false
  });
  
  const [errors, setErrors] = useState({});
  
  const setLoading = useCallback((resource, isLoading) => {
    setLoadingState(prev => ({ ...prev, [resource]: isLoading }));
  }, []);
  
  const setError = useCallback((resource, error) => {
    setErrors(prev => ({ ...prev, [resource]: error }));
    setLoading(resource, false);
  }, [setLoading]);
  
  const clearError = useCallback((resource) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[resource];
      return newErrors;
    });
  }, []);
  
  return {
    loadingState,
    errors,
    setLoading,
    setError,
    clearError,
    isAnyLoading: Object.values(loadingState).some(state => state === true)
  };
};

// =============================
// 3️⃣ COMPOSANTS MÉTIER
// =============================

// Composant StatsCard amélioré avec gestion d'erreur
const StatsCard = React.memo(({ icon: Icon, label, value, color, isLoading, error, onRetry }) => (
  <Card className={`stat-card stat-${color} ${error ? 'stat-error' : ''}`}>
    <div className="stat-icon">
      <Icon size={24} />
    </div>
    <div className="stat-content">
      <p className="stat-label">{label}</p>
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : error ? (
        <div className="stat-error-content">
          <AlertCircle size={16} />
          <button onClick={onRetry} className="stat-retry">Réessayer</button>
        </div>
      ) : (
        <h3 className="stat-value">{value}</h3>
      )}
    </div>
  </Card>
));

StatsCard.displayName = 'StatsCard';

// Composant ProductCard avec gestion robuste des images
const ProductCard = React.memo(({ product, onEdit, onDelete, onViewBuyers, isLoading }) => {
  const coverImage = getImageUrl(product.cover_image, 'products') || DEFAULT_IMAGE;
  const [imageError, setImageError] = useState(false);
  
  const handleImageError = useCallback((e) => {
    if (!imageError) {
      e.target.onerror = null; // Évite les boucles infinies
      e.target.src = DEFAULT_IMAGE;
      setImageError(true);
    }
  }, [imageError]);
  
  return (
    <Card className="product-item">
      <div className="product-item-image">
        <img 
          src={imageError ? DEFAULT_IMAGE : coverImage} 
          alt={product.title}
          onError={handleImageError}
          loading="lazy"
        />
      </div>
      <div className="product-item-info">
        <h4>{product.title}</h4>
        <p className="product-price">{product.price} {product.currency}</p>
        <div className="product-stats">
          <span>📊 Vendus: {product.quantity_sold || 0}</span>
          <span>📦 Stock: {product.quantity_available || 0}</span>
          <span>⭐ {(product.rating || 0).toFixed(1)}</span>
        </div>
        {product.quantity_sold > 0 && (
          <button 
            className="btn-view-buyers"
            onClick={() => onViewBuyers(product.id)}
            disabled={isLoading}
          >
            <Eye size={14} /> Voir les acheteurs ({product.quantity_sold})
          </button>
        )}
      </div>
      <div className="product-actions">
        <button 
          className="action-btn edit"
          onClick={() => onEdit(product.id)}
          disabled={isLoading}
          aria-label="Modifier"
        >
          <Edit size={18} />
        </button>
        <button 
          className="action-btn delete" 
          onClick={() => onDelete(product.id)}
          disabled={isLoading}
          aria-label="Supprimer"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

// Composant ConfirmModal
const ConfirmModal = React.memo(({ isOpen, onClose, onConfirm, title, message, isLoading }) => {
  if (!isOpen) return null;
  
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={onConfirm} 
            className="bg-red-500 hover:bg-red-600 text-white"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
});

ConfirmModal.displayName = 'ConfirmModal';

// Composant OfflineIndicator
const OfflineIndicator = ({ isOnline }) => {
  if (isOnline) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50 flex items-center justify-center gap-2 animate-slide-down">
      <WifiOff size={16} />
      <span>Mode hors-ligne - Données en cache uniquement</span>
    </div>
  );
};

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const SellerDashboard = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const { executeWithRetry } = useApiWithRetry();
  const navigate = useNavigate();
  const cache = useCache(CACHE_TTL);
  
  // États
  const [activeTab, setActiveTab] = useState(TABS.OVERVIEW);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOnline } = useOfflineStatus();
  const [stats, setStats] = useState({
    total_products: 0,
    total_sales: 0,
    total_revenue: 0,
    wallet_balance: 0,
    average_rating: 0,
    total_reviews: 0
  });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedProductBuyers, setSelectedProductBuyers] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  const { loadingState, errors, setLoading, setError, clearError } = useResourceLoading();
  const abortControllersRef = useRef({});
  const lastRefreshRef = useRef(0);
  
  // Sidebar responsive
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Redirection si non connecté (corrigé: plus de loading inutile)
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);
  
  // Cleanup des requêtes
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        controller?.abort();
      });
    };
  }, []);
  
  // Fonctions de chargement des données (sans dépendance à dataLoaded)
  const loadStats = useCallback(async () => {
    if (!user) return;
    
    const cacheKey = `stats_${user.id}`;
    const cached = cache.get(cacheKey);
    
    if (cached && !loadingState.stats) {
      setStats(cached);
      return;
    }
    
    // Évite les doubles appels
    if (loadingState.stats) return;
    
    if (abortControllersRef.current.stats) {
      abortControllersRef.current.stats.abort();
    }
    abortControllersRef.current.stats = new AbortController();
    
    setLoading('stats', true);
    clearError('stats');
    
    try {
      const response = await executeWithRetry(() => 
        client.get(`/marketplace/sellers/stats/${user.id}`, {
          signal: abortControllersRef.current.stats.signal
        })
      );
      setStats(response.data);
      cache.set(cacheKey, response.data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading stats:', error);
        setError('stats', error.message);
        if (isOnline) {
          toast.error('Erreur chargement statistiques');
        }
      }
    } finally {
      setLoading('stats', false);
    }
  }, [user, client, executeWithRetry, cache, loadingState.stats, setLoading, setError, clearError, isOnline]);
  
  const loadProducts = useCallback(async () => {
    if (!user) return;
    
    const cacheKey = `products_${user.id}`;
    const cached = cache.get(cacheKey);
    
    if (cached && !loadingState.products) {
      setProducts(cached);
      return;
    }
    
    // Évite les doubles appels
    if (loadingState.products) return;
    
    if (abortControllersRef.current.products) {
      abortControllersRef.current.products.abort();
    }
    abortControllersRef.current.products = new AbortController();
    
    setLoading('products', true);
    clearError('products');
    
    try {
      // Normalisation des données API
      const response = await executeWithRetry(() =>
        client.get('/marketplace/products', {
          params: { seller_id: user.id },
          signal: abortControllersRef.current.products.signal
        })
      );
      
      // Gestion robuste des réponses API
      let productsData = [];
      if (response.data?.success === true) {
        productsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
      } else if (response.data?.data) {
        productsData = response.data.data;
      } else {
        productsData = [];
      }
      
      setProducts(productsData);
      cache.set(cacheKey, productsData);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading products:', error);
        setError('products', error.message);
      }
    } finally {
      setLoading('products', false);
    }
  }, [user, client, executeWithRetry, cache, loadingState.products, setLoading, setError, clearError]);
  
  const loadOrders = useCallback(async () => {
    if (!user) return;
    
    const cacheKey = `orders_${user.id}`;
    const cached = cache.get(cacheKey);
    
    if (cached && !loadingState.orders) {
      setOrders(cached);
      return;
    }
    
    // Évite les doubles appels
    if (loadingState.orders) return;
    
    if (abortControllersRef.current.orders) {
      abortControllersRef.current.orders.abort();
    }
    abortControllersRef.current.orders = new AbortController();
    
    setLoading('orders', true);
    clearError('orders');
    
    try {
      const response = await executeWithRetry(() =>
        client.get(`/marketplace/orders/seller/${user.id}`, {
          signal: abortControllersRef.current.orders.signal
        })
      );
      const ordersData = response.data || [];
      setOrders(ordersData);
      cache.set(cacheKey, ordersData);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading orders:', error);
        setError('orders', error.message);
      }
    } finally {
      setLoading('orders', false);
    }
  }, [user, client, executeWithRetry, cache, loadingState.orders, setLoading, setError, clearError]);
  
  // Chargement initial avec préchargement intelligent
  useEffect(() => {
    if (user && isOnline) {
      loadStats();
      
      // Chargement lazy des données selon l'onglet actif
      if (activeTab === TABS.PRODUCTS) {
        loadProducts();
      }
      if (activeTab === TABS.ORDERS) {
        loadOrders();
      }
    }
  }, [user, isOnline, activeTab, loadStats, loadProducts, loadOrders]);
  
  // Gestionnaires d'actions avec invalidation de cache
  const handleDeleteProduct = useCallback(async () => {
    if (!productToDelete) return;
    
    setLoading('delete', true);
    try {
      await executeWithRetry(() =>
        client.delete(`/marketplace/products/${productToDelete}`)
        // ⚠️ IMPORTANT: seller_id ne doit PAS être envoyé par le client
        // Le backend doit utiliser req.user.id pour la sécurité
      );
      
      // Mise à jour de l'état local
      setProducts(prev => prev.filter(p => p.id !== productToDelete));
      
      // Invalidation du cache (corrigé)
      cache.remove(`products_${user.id}`);
      cache.remove(`stats_${user.id}`);
      
      toast.success('Produit supprimé avec succès');
      setDeleteModalOpen(false);
      setProductToDelete(null);
      
      // Mettre à jour les stats
      loadStats();
    } catch (error) {
      console.error('Error deleting product:', error);
      
      if (!isOnline) {
        toast.error('Pas de connexion Internet');
      } else if (error.response?.status === 409) {
        toast.error('Ce produit a des commandes en cours, suppression impossible');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } finally {
      setLoading('delete', false);
    }
  }, [client, user, productToDelete, isOnline, executeWithRetry, cache, loadStats]);
  
  const handleViewBuyers = useCallback(async (productId) => {
    setLoading('buyers', true);
    try {
      const response = await executeWithRetry(() =>
        client.get(`/marketplace/products/${productId}/buyers`)
        // ⚠️ Le backend doit utiliser l'ID du vendeur authentifié
      );
      setSelectedProductBuyers({ productId, buyers: response.data });
    } catch (error) {
      console.error('Error loading buyers:', error);
      toast.error('Erreur lors du chargement des acheteurs');
    } finally {
      setLoading('buyers', false);
    }
  }, [client, executeWithRetry]);
  
  // Refresh avec debounce (corrigé)
  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_DEBOUNCE_MS) {
      toast.info('Veuillez patienter avant de rafraîchir');
      return;
    }
    lastRefreshRef.current = now;
    
    // Invalider tout le cache
    cache.clear();
    
    // Recharger toutes les données
    await Promise.allSettled([
      loadStats(),
      loadProducts(),
      loadOrders()
    ]);
    
    toast.success('Données actualisées');
  }, [cache, loadStats, loadProducts, loadOrders]);
  
  const handleRetry = useCallback((dataType) => {
    switch(dataType) {
      case 'stats':
        loadStats();
        break;
      case 'products':
        loadProducts();
        break;
      case 'orders':
        loadOrders();
        break;
      default:
        break;
    }
  }, [loadStats, loadProducts, loadOrders]);
  
  // Redirection si non connecté (corrigé)
  if (!user) return null;
  
  return (
    <ErrorBoundary fallback={<DashboardErrorFallback />}>
      <div className="seller-dashboard">
        <OfflineIndicator isOnline={isOnline} />
        
        <div className="seller-header">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <button 
            className="menu-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>
          <h1>Dashboard Vendeur</h1>
          <div className="user-menu">
            <span>{user?.full_name}</span>
          </div>
        </div>
        
        <div className="seller-container">
          {/* Sidebar */}
          <aside className={`seller-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <button 
              className="close-sidebar" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            
            <nav className="nav-menu">
              <button
                className={`nav-item ${activeTab === TABS.OVERVIEW ? 'active' : ''}`}
                onClick={() => setActiveTab(TABS.OVERVIEW)}
              >
                📊 Aperçu
              </button>
              <button
                className={`nav-item ${activeTab === TABS.PRODUCTS ? 'active' : ''}`}
                onClick={() => setActiveTab(TABS.PRODUCTS)}
              >
                📦 Mes Produits
              </button>
              <button
                className={`nav-item ${activeTab === TABS.ORDERS ? 'active' : ''}`}
                onClick={() => setActiveTab(TABS.ORDERS)}
              >
                🛒 Commandes
              </button>
              <button
                className={`nav-item ${activeTab === TABS.WALLET ? 'active' : ''}`}
                onClick={() => setActiveTab(TABS.WALLET)}
              >

                  💰 Portefeuille
              </button>
            </nav>
          </aside>
          
          {/* Content */}
          <main className="seller-content">
            {activeTab === TABS.OVERVIEW && (
              <OverviewTab 
                stats={stats}
                isLoading={loadingState.stats}
                error={errors.stats}
                onRetry={() => handleRetry('stats')}
                onRefresh={handleRefresh}
                isOnline={isOnline}
              />
            )}
            {activeTab === TABS.PRODUCTS && (
              <ProductsTab
                products={products}
                isLoading={loadingState.products}
                error={errors.products}
                onRetry={() => handleRetry('products')}
                onEdit={(id) => navigate(`/marketplace/product/${id === 'new' ? 'add' : id}/edit`)}
                onDelete={setProductToDelete}
                onViewBuyers={handleViewBuyers}
                selectedProductBuyers={selectedProductBuyers}
                setSelectedProductBuyers={setSelectedProductBuyers}
                isLoadingAction={loadingState.delete || loadingState.buyers}
                isOnline={isOnline}
              />
            )}
            {activeTab === TABS.ORDERS && (
              <OrdersTab
                orders={orders}
                isLoading={loadingState.orders}
                error={errors.orders}
                onRetry={() => handleRetry('orders')}
                isOnline={isOnline}
              />
            )}
            {activeTab === TABS.WALLET && (
              <WalletTab
                walletBalance={stats.wallet_balance}
                isOnline={isOnline}
              />
            )}
          </main>
        </div>
        
        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setProductToDelete(null);
          }}
          onConfirm={handleDeleteProduct}
          title="Supprimer le produit"
          message="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
          isLoading={loadingState.delete}
        />
      </div>
    </ErrorBoundary>
  );
};

// =============================
// 5️⃣ COMPOSANTS D'ONGLETS EXTERNALISÉS
// =============================

const OverviewTab = ({ stats, isLoading, error, onRetry, onRefresh, isOnline }) => (
  <div className="overview-content">
    <div className="flex justify-between items-center mb-4">
      <h2>Aperçu</h2>
      <button
        onClick={onRefresh}
        className="text-sm text-[#ff6b35] hover:underline flex items-center gap-1"
        disabled={!isOnline}
      >
        <RefreshCw size={14} />
        Actualiser
      </button>
    </div>
    
    <div className="stats-grid">
      <StatsCard
        icon={Package}
        label="Produits Publiés"
        value={stats.total_products}
        color="blue"
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
      <StatsCard
        icon={ShoppingBag}
        label="Ventes Totales"
        value={stats.total_sales}
        color="green"
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
      <StatsCard
        icon={DollarSign}
        label="Revenus Totaux"
        value={`${stats.total_revenue} USD`}
        color="purple"
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
      <StatsCard
        icon={TrendingUp}
        label="Solde Portefeuille"
        value={`${stats.wallet_balance} USD`}
        color="orange"
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
    </div>
    
    <div className="charts-section">
      <Card className="chart-card">
        <h3>Statistiques de Vente</h3>
        <div className="chart-placeholder">
          <BarChart3 size={48} />
          <p>Graphique des ventes (derniers 30 jours)</p>
        </div>
      </Card>
      
      <Card className="chart-card">
        <h3>Évaluation Moyenne</h3>
        <div className="rating-display">
          <div className="rating-big">{stats.average_rating.toFixed(1)}</div>
          <p>sur {stats.total_reviews} avis</p>
        </div>
      </Card>
    </div>
  </div>
);

const ProductsTab = ({ 
  products, isLoading, error, onRetry, onEdit, onDelete, onViewBuyers, 
  selectedProductBuyers, setSelectedProductBuyers, isLoadingAction, isOnline 
}) => (
  <div className="products-content">
    <div className="tab-header">
      <h2>Mes Produits</h2>
      <Button
        onClick={() => onEdit('new')}
        className="btn-add-product"
        disabled={isLoadingAction || !isOnline}
      >
        <Plus size={18} /> Ajouter Produit
      </Button>
    </div>
    
    {isLoading ? (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
      </div>
    ) : error ? (
      <div className="error-state">
        <AlertCircle size={48} />
        <p>Erreur de chargement des produits</p>
        <Button onClick={onRetry}>Réessayer</Button>
      </div>
    ) : products.length > 0 ? (
      <div className="products-list">
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewBuyers={onViewBuyers}
            isLoading={isLoadingAction}
          />
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <Package size={48} />
        <p>Aucun produit publié</p>
        <Button onClick={() => onEdit('new')}>
          Créer votre premier produit
        </Button>
      </div>
    )}
    
    {/* Modal acheteurs */}
    {selectedProductBuyers && (
      <BuyersModal 
        buyers={selectedProductBuyers.buyers}
        onClose={() => setSelectedProductBuyers(null)}
        isLoading={isLoadingAction}
      />
    )}
  </div>
);

const BuyersModal = ({ buyers, onClose, isLoading }) => {
  const handleImageError = useCallback((e) => {
    e.target.onerror = null;
    e.target.src = DEFAULT_IMAGE;
  }, []);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <Card className="buyers-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👥 Liste des Acheteurs</h3>
          <button onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="buyers-list">
            {buyers?.length > 0 ? (
              buyers.map((buyer, idx) => (
                <div key={idx} className="buyer-item">
                  <img 
                    src={buyer.buyer_avatar || DEFAULT_IMAGE} 
                    alt={buyer.buyer_name}
                    onError={handleImageError}
                  />
                  <div>
                    <strong>{buyer.buyer_name}</strong>
                    <p>Qté: {buyer.quantity} | {buyer.total_paid} USD</p>
                    <small>{new Date(buyer.purchase_date).toLocaleDateString('fr-FR')}</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">Aucun acheteur pour ce produit</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

const OrdersTab = ({ orders, isLoading, error, onRetry, isOnline }) => {
  const navigate = useNavigate();
  
  return (
    <div className="orders-content">
      <h2>Commandes Reçues</h2>
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
        </div>
      ) : error ? (
        <div className="error-state">
          <AlertCircle size={48} />
          <p>Erreur de chargement des commandes</p>
          <Button onClick={onRetry}>Réessayer</Button>
        </div>
      ) : orders.length > 0 ? (
        <div className="orders-list">
          {orders.map(order => (
            <Card key={order.id} className="order-item">
              <div className="order-header">
                <span className="order-number">{order.order_number}</span>
                <span className={`order-status ${order.status}`}>{order.status}</span>
              </div>
              <div className="order-details">
                <p><strong>Acheteur:</strong> {order.buyer_name || order.buyer_id}</p>
                <p><strong>Montant:</strong> {order.total_amount} {order.currency}</p>
                <p><strong>Méthode:</strong> {order.payment_method}</p>
                <p><strong>Date:</strong> {new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <Button 
                size="sm" 
                className="btn-details"
                onClick={() => navigate(`/marketplace/orders/${order.id}`)}
              >
                <FileText size={16} /> Voir Détails
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={48} />
          <p>Aucune commande reçue</p>
        </div>
      )}
    </div>
  );
};

const WalletTab = ({ walletBalance, isOnline }) => (
  <div className="wallet-content">
    <Card className="wallet-card">
      <h2>Mon Portefeuille</h2>
      <div className="wallet-balance">
        <span className="label">Solde Disponible</span>
        <span className="balance">{walletBalance} USD</span>
      </div>
      <Button 
        className="btn-withdraw"
        onClick={() => toast.info('Fonctionnalité à venir')}
        disabled={walletBalance <= 0 || !isOnline}
      >
        <Download size={18} /> Retirer des Fonds
      </Button>
    </Card>
    
    <Card className="wallet-history">
      <h3>Historique des Transactions</h3>
      <div className="transaction-list">
        <p className="text-gray-500 text-center py-8">Chargement des transactions...</p>
      </div>
    </Card>
  </div>
);

// Composant de fallback pour ErrorBoundary
const DashboardErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
    <AlertCircle size={48} className="text-red-500 mb-4" />
    <h2 className="text-xl font-bold mb-2">Une erreur est survenue</h2>
    <p className="text-gray-600 mb-4">{error?.message || "Erreur inattendue"}</p>
    <Button onClick={resetErrorBoundary}>Réessayer</Button>
  </div>
);

SellerDashboard.propTypes = {};

export default SellerDashboard;
OfflineIndicator.propTypes = {
  isOnline: PropTypes.bool.isRequired,
};
OverviewTab.propTypes = {
  stats: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  error: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  isOnline: PropTypes.bool.isRequired,
};
ProductsTab.propTypes = {
  products: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  error: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onViewBuyers: PropTypes.func.isRequired,
  selectedProductBuyers: PropTypes.any.isRequired,
  setSelectedProductBuyers: PropTypes.any.isRequired,
  isLoadingAction: PropTypes.bool.isRequired,
  isOnline: PropTypes.bool.isRequired,
};
BuyersModal.propTypes = {
  buyers: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
OrdersTab.propTypes = {
  orders: PropTypes.any.isRequired,
  isLoading: PropTypes.bool.isRequired,
  error: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  isOnline: PropTypes.bool.isRequired,
};
WalletTab.propTypes = {
  walletBalance: PropTypes.any.isRequired,
  isOnline: PropTypes.bool.isRequired,
};
DashboardErrorFallback.propTypes = {
  error: PropTypes.bool.isRequired,
  resetErrorBoundary: PropTypes.any.isRequired,
};
