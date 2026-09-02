import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import {
  Download, FileText, Eye, RotateCcw, ChevronDown,
  Loader2, AlertCircle, CheckCircle, XCircle, Clock, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import './BuyerOrderHistory.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const ORDERS_PER_PAGE = 10;

const STATUS_CONFIG = {
  completed: {
    label: 'Complété',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  pending: {
    label: 'En attente',
    icon: Clock,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
  },
  failed: {
    label: 'Échoué',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  refunded: {
    label: 'Remboursé',
    icon: AlertCircle,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  }
};

// =============================
// 2️⃣ COMPOSANT STATUT
// =============================
const StatusBadge = React.memo(({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon size={12} />
      <span>{config.label}</span>
    </div>
  );
});

StatusBadge.displayName = 'StatusBadge';

// =============================
// 3️⃣ COMPOSANT ORDRE (MEMOIZED)
// =============================
const OrderCard = React.memo(({ 
  order, 
  onDownload, 
  onViewInvoice, 
  onRetry, 
  onView, 
  expanded, 
  onToggle,
  isLast,
  lastOrderRef
}) => {
  const [downloading, setDownloading] = useState(false);
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const handleDownload = useCallback(async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await onDownload(order.id);
      toast.success('Téléchargement démarré');
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloading(false);
    }
  }, [onDownload, order.id]);

  const handleViewInvoice = useCallback((e) => {
    e.stopPropagation();
    onViewInvoice(order);
  }, [onViewInvoice, order]);

  const handleRetry = useCallback((e) => {
    e.stopPropagation();
    onRetry(order.id);
  }, [onRetry, order.id]);

  const handleView = useCallback((e) => {
    e.stopPropagation();
    onView(order);
  }, [onView, order]);

  return (
    <Card 
      className="order-card bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      ref={isLast ? lastOrderRef : null}
    >
      <div
        className="order-header p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => onToggle(order.id)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onToggle(order.id);
          }
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm font-semibold text-gray-900">
                #{order.order_number}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{new Date(order.created_at).toLocaleDateString('fr-FR')}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <StatusIcon size={12} />
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-lg font-bold text-gray-900">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: order.currency || 'EUR'
                }).format(order.total_amount)}
              </span>
              <p className="text-xs text-gray-500">Total TTC</p>
            </div>
            <ChevronDown
              size={20}
              className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="order-details border-t border-gray-100 p-4 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Informations
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vendeur:</span>
                  <span className="font-medium text-gray-900">{order.seller_name || order.seller_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Méthode de paiement:</span>
                  <span className="font-medium text-gray-900">{order.payment_method || 'Non spécifié'}</span>
                </div>
                {order.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Complété le:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(order.completed_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Produits ({order.items?.length || 0})
              </h4>
              <div className="space-y-2">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.product_name}</span>
                    <span className="font-medium text-gray-900">
                      {item.quantity} x {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: order.currency || 'EUR'
                      }).format(item.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200">
            {order.status === 'completed' && (
              <>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff8c61] transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Télécharger PDF
                </button>
                <button
                  onClick={handleViewInvoice}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText size={16} />
                  Voir Facture
                </button>
                <button
                  onClick={handleView}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Eye size={16} />
                  Aperçu
                </button>
              </>
            )}
            {order.status === 'pending' && (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg cursor-not-allowed opacity-70"
              >
                <Clock size={16} />
                En attente
              </button>
            )}
            {order.status === 'failed' && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <RotateCcw size={16} />
                Réessayer
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
});

OrderCard.displayName = 'OrderCard';

// =============================
// 4️⃣ HOOK PERSONNALISÉ OPTIMISÉ
// =============================
const useBuyerOrders = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const abortControllerRef = useRef(null);
  const fetchingRef = useRef(false); // 🔒 Lock pour éviter double fetch

  const fetchOrders = useCallback(async (page, reset = false) => {
    // 🔒 Protection race condition
    if (fetchingRef.current) return null;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    fetchingRef.current = true;
    
    try {
      const response = await client.get('/marketplace/orders/buyer', {
        params: {
          page,
          limit: ORDERS_PER_PAGE,
          status: filterStatus !== 'all' ? filterStatus : undefined
        },
        signal: abortControllerRef.current.signal
      });

      // ✅ Structure API standardisée
      const newOrders = response.data?.orders || response.data?.data || [];
      const total = response.data?.total || 0;
      const counts = response.data?.by_status || {};
      
      if (reset) {
        setOrders(newOrders);
        setCurrentPage(page + 1);
      } else {
        setOrders(prev => [...prev, ...newOrders]);
        setCurrentPage(page + 1);
      }
      
      setTotalCount(total);
      setStatusCounts(counts);
      setHasMore(newOrders.length === ORDERS_PER_PAGE);
      
      return newOrders;
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading orders:', error);
        setError(error);
        
        if (!navigator.onLine) {
          toast.error('Pas de connexion Internet');
        } else if (error.response?.status === 401) {
          toast.error('Session expirée');
          navigate('/auth');
        } else {
          toast.error('Erreur de chargement');
        }
      }
      return null;
    } finally {
      fetchingRef.current = false;
      if (!reset) {
        setLoadingMore(false);
      }
    }
  }, [client, filterStatus, navigate]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasMore(true);
    setCurrentPage(1);
    
    await fetchOrders(1, true);
    
    setLoading(false);
  }, [fetchOrders]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || fetchingRef.current) return;
    
    setLoadingMore(true);
    await fetchOrders(currentPage, false);
  }, [hasMore, loadingMore, loading, currentPage, fetchOrders]);

  const refresh = useCallback(() => {
    loadInitial();
  }, [loadInitial]);

  const changeFilter = useCallback((newFilter) => {
    setFilterStatus(newFilter);
    setHasMore(true); // ✅ Reset hasMore
    setCurrentPage(1);
    setOrders([]);
    setLoading(true);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    orders,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    statusCounts,
    filterStatus,
    loadMore,
    refresh,
    changeFilter
  };
};

// =============================
// 5️⃣ COMPOSANT PRINCIPAL
// =============================
const BuyerOrderHistory = () => {
  const navigate = useNavigate();
  const { client } = useApiClient();
  
  const {
    orders,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    statusCounts,
    filterStatus,
    loadMore,
    refresh,
    changeFilter
  } = useBuyerOrders();
  
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const observerRef = useRef(null);
  const lastOrderRef = useRef(null);
  const loadingTriggeredRef = useRef(false); // 🔒 Double trigger protection

  // ✅ Actions
  const handleDownloadPDF = useCallback(async (orderId) => {
    try {
      const response = await client.get(`/marketplace/orders/${orderId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `commande-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF téléchargé');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur de téléchargement');
    }
  }, [client]);

  const handleViewInvoice = useCallback((order) => {
    navigate(`/invoices/${order.id}`);
  }, [navigate]);

  const handleRetryPayment = useCallback(async (orderId) => {
    try {
      await client.post(`/marketplace/orders/${orderId}/retry`);
      toast.success('Paiement relancé');
      refresh();
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Erreur de relance');
    }
  }, [client, refresh]);

  const handleView = useCallback((order) => {
    navigate(`/marketplace/product/${order.product_id}`);
  }, [navigate]);

  const handleToggleOrder = useCallback((orderId) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  }, []);

  // ✅ Observer avec protection double trigger
  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loadingMore && !loading && !loadingTriggeredRef.current) {
      loadingTriggeredRef.current = true;
      loadMore().finally(() => {
        setTimeout(() => {
          loadingTriggeredRef.current = false;
        }, 500);
      });
    }
  }, [hasMore, loadingMore, loading, loadMore]);

  // ✅ Observer ne dépend que de handleObserver (fix instabilité)
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px'
    });
    
    if (lastOrderRef.current) {
      observerRef.current.observe(lastOrderRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]); // ✅ Plus de dépendance à orders

  // ✅ Filtres avec compteurs backend (fix double filtrage)
  const filters = [
    { value: 'all', label: 'Tous', count: totalCount },
    { value: 'completed', label: 'Complétés', count: statusCounts.completed || 0 },
    { value: 'pending', label: 'En attente', count: statusCounts.pending || 0 },
    { value: 'failed', label: 'Échoués', count: statusCounts.failed || 0 },
    { value: 'refunded', label: 'Remboursés', count: statusCounts.refunded || 0 }
  ];

  // ✅ Recherche frontend (uniquement pour affichage, pas pour pagination)
  const displayedOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    
    const term = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.order_number?.toLowerCase().includes(term) ||
      o.seller_name?.toLowerCase().includes(term) ||
      o.items?.some(item => item.product_name?.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  // Chargement initial
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset expanded on filter change
  useEffect(() => {
    setExpandedOrder(null);
  }, [filterStatus]);

  if (error && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Erreur de chargement</h2>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-[#ff6b35] text-white rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📦 Mes Commandes
          </h1>
          <p className="text-gray-600">
            Historique de vos achats
            {totalCount > 0 && (
              <span className="ml-2 text-sm">
                ({totalCount} commande{totalCount > 1 ? 's' : ''})
              </span>
            )}
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par n° commande, vendeur ou produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
            />
          </div>
        </div>

        {/* Filters - avec compteurs backend */}
        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map(filter => (
            <button
              key={filter.value}
              onClick={() => changeFilter(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filterStatus === filter.value
                  ? 'bg-[#ff6b35] text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {filter.label}
              {filter.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  filterStatus === filter.value
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>

            {/* Orders List */}
        {displayedOrders.length > 0 ? (
          <div className="space-y-4">
            {displayedOrders.map((order, index) => {
              const isLast = index === displayedOrders.length - 1;
              return (
                <OrderCard
                  key={order.id}
                  order={order}
                  onDownload={handleDownloadPDF}
                  onViewInvoice={handleViewInvoice}
                  onRetry={handleRetryPayment}
                  onView={handleView}
                  onToggle={handleToggleOrder}
                  expanded={expandedOrder === order.id}
                  isLast={isLast}
                  lastOrderRef={lastOrderRef}
                />
              );
            })}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#ff6b35]" />
              </div>
            )}

            {!hasMore && displayedOrders.length > 0 && (
              <p className="text-center text-gray-500 py-4 text-sm">
                Fin de l'historique
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'Aucun résultat' : 'Aucune commande'}
            </h2>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? `Aucune commande pour "${searchTerm}"`
                : filterStatus === 'all' 
                  ? 'Vous n\'avez pas encore effectué d\'achat'
                  : `Aucune commande ${filterStatus}`}
            </p>
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg"
              >
                Effacer la recherche
              </button>
            ) : (
              <button
                onClick={() => navigate('/marketplace')}
                className="px-6 py-3 bg-[#ff6b35] text-white rounded-lg"
              >
                Découvrir le Marketplace
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

BuyerOrderHistory.propTypes = {};

export default BuyerOrderHistory;
