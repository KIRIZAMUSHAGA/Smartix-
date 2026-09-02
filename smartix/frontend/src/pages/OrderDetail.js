import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ChevronLeft, Download, Eye, Share2, MessageCircle, 
  Loader2, AlertCircle, CheckCircle, Clock, XCircle,
  FileText, Printer, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { orderService } from '../services/orderService';
import { handleApiError, showErrorToast } from '../utils/errorHandler';
import './OrderDetail.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'bg-yellow-500', icon: Clock },
  processing: { label: 'En traitement', color: 'bg-blue-500', icon: Loader2 },
  completed: { label: 'Complété', color: 'bg-green-500', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-500', icon: XCircle },
  refunded: { label: 'Remboursé', color: 'bg-gray-500', icon: AlertCircle }
};

// =============================
// 2️⃣ STATE MACHINE (CORRIGÉE)
// =============================
const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

const initialState = {
  status: STATUS.IDLE,
  order: null,
  error: null,
  isDownloading: false, // ✅ Séparé du statut global
  shareSuccess: false
};

function orderReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: STATUS.LOADING, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, status: STATUS.SUCCESS, order: action.payload };
    case 'FETCH_ERROR':
      return { ...state, status: STATUS.ERROR, error: action.payload };
    case 'DOWNLOAD_START':
      return { ...state, isDownloading: true };
    case 'DOWNLOAD_END':
      return { ...state, isDownloading: false };
    case 'SHARE_SUCCESS':
      return { ...state, shareSuccess: true };
    case 'SHARE_RESET':
      return { ...state, shareSuccess: false };
    default:
      return state;
  }
}

// =============================
// 3️⃣ COMPOSANT DE STATUT (MEMOIZED)
// =============================
const StatusBadge = React.memo(({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium ${config.color}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

// =============================
// 4️⃣ COMPOSANT D'ACTION (MEMOIZED)
// =============================
const ActionButton = React.memo(({ onClick, disabled, icon: Icon, children, variant = 'primary', isLoading = false }) => {
  const baseClasses = "w-full justify-center gap-2 transition-colors";
  const variantClasses = variant === 'primary' 
    ? "bg-[#ff6b35] hover:bg-[#ff8c61] text-white disabled:opacity-50"
    : "border border-gray-300 text-gray-700 hover:bg-gray-50";
  
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses}`}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon size={18} />}
      {children}
    </Button>
  );
});

ActionButton.displayName = 'ActionButton';

// =============================
// 5️⃣ HOOK PERSONNALISÉ AVEC SERVICE LAYER
// =============================
const useOrder = (orderNumber, client, user, navigate) => {
  const [state, dispatch] = useReducer(orderReducer, initialState);
  const abortControllerRef = useRef(null);
  const fetchingRef = useRef(false);
  const shareTimeoutRef = useRef(null);

  // ✅ Stabilisé avec useCallback et dépendances minimales
  const loadOrder = useCallback(async () => {
    if (!user || !orderNumber) return;
    
    // 🔒 Protection contre les appels multiples
    if (fetchingRef.current) {
      console.log('Fetch already in progress');
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    fetchingRef.current = true;
    dispatch({ type: 'FETCH_START' });
    
    try {
      // ✅ Utilisation du service layer
      const response = await orderService.getOrder(client, orderNumber, {
        signal: abortControllerRef.current.signal
      });
      
      dispatch({ type: 'FETCH_SUCCESS', payload: response });
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading order:', error);
        
        // ✅ Centralisation de la gestion d'erreur
        const errorMessage = handleApiError(error, {
          404: 'Commande non trouvée',
          403: 'Vous n\'êtes pas autorisé à voir cette commande',
          401: 'Session expirée'
        });
        
        dispatch({ type: 'FETCH_ERROR', payload: errorMessage });
        showErrorToast(error);
        
        // ✅ Redirection conditionnelle
        if (error.response?.status === 403 || error.response?.status === 401) {
          navigate('/buyer/orders');
        }
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [client, orderNumber, user, navigate]);

  // ✅ Téléchargement PDF avec vérification robuste
  const downloadPDF = useCallback(async () => {
    // ✅ Vérification basée sur une propriété explicite
    if (!state.order?.download_available) {
      toast.error('PDF non disponible pour cette commande');
      return;
    }
    
    dispatch({ type: 'DOWNLOAD_START' });
    
    try {
      const blob = await orderService.downloadOrderPDF(client, orderNumber);
      
      // ✅ Vérification que le blob est valide
      if (!blob || blob.size === 0) {
        throw new Error('Fichier vide');
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `smartix_order_${orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Téléchargement démarré !');
      
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = handleApiError(error, {
        404: 'PDF non trouvé',
        403: 'Accès non autorisé au PDF'
      });
      toast.error(errorMessage);
    } finally {
      dispatch({ type: 'DOWNLOAD_END' });
    }
  }, [client, orderNumber, state.order?.download_available]);

  // ✅ Partage avec timeout nettoyable
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Commande ${orderNumber}`,
          text: `Détails de ma commande Smartix`,
          url: shareUrl
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        dispatch({ type: 'SHARE_SUCCESS' });
        toast.success('Lien copié dans le presse-papier !');
        
        // ✅ Nettoyage du timeout
        if (shareTimeoutRef.current) {
          clearTimeout(shareTimeoutRef.current);
        }
        
        shareTimeoutRef.current = setTimeout(() => {
          dispatch({ type: 'SHARE_RESET' });
        }, 2000);
        
      } catch (error) {
        toast.error('Impossible de copier le lien');
      }
    }
  }, [orderNumber]);

  // ✅ Cleanup des timeouts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    loadOrder,
    downloadPDF,
    handleShare
  };
};

// =============================
// 6️⃣ COMPOSANT D'ERREUR (MEMOIZED)
// =============================
const ErrorDisplay = React.memo(({ error, onBack }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Oups !</h2>
      <p className="text-gray-600 mb-6">{error}</p>
      <Button onClick={onBack} className="bg-[#ff6b35] hover:bg-[#ff8c61]">
        Retour à mes commandes
      </Button>
    </div>
  </div>
));

ErrorDisplay.displayName = 'ErrorDisplay';

// =============================
// 7️⃣ COMPOSANT DE FACTURE (MEMOIZED)
// =============================
const InvoiceSection = React.memo(({ order, user, onPrint }) => {
  const unitPrice = useMemo(() => {
    if (order.unit_price) return order.unit_price;
    if (order.total_amount && order.quantity) {
      return (order.total_amount / order.quantity).toFixed(2);
    }
    return 0;
  }, [order]);

  return (
    <Card className="p-6 print:shadow-none">
      <h3 className="font-bold text-lg mb-4 text-gray-900">📄 Facture</h3>
      
      <div className="invoice-preview border border-gray-200 rounded-xl p-6 bg-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">FACTURE</h2>
            <p className="text-gray-500 text-sm mt-1">Smartix Store</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">N° Facture</p>
            <p className="font-mono text-sm">{order.order_number}</p>
          </div>
        </div>

        {/* Info */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-2">Vendeur</p>
            <p className="font-medium">{order.seller_name || order.seller_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Acheteur</p>
            <p className="font-medium">{user?.full_name || user?.email || 'Client'}</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right py-3 font-semibold text-gray-600">Quantité</th>
                <th className="text-right py-3 font-semibold text-gray-600">Prix unitaire</th>
                <th className="text-right py-3 font-semibold text-gray-600">Total</th>
                </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3">
                  {order.product_name || `Produit #${order.product_id}`}
                </td>
                <td className="text-right py-3">{order.quantity}</td>
                <td className="text-right py-3">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: order.currency || 'EUR'
                  }).format(unitPrice)}
                </td>
                <td className="text-right py-3 font-medium">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: order.currency || 'EUR'
                  }).format(order.total_amount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan="3" className="text-right py-3 font-semibold">Total</td>
                <td className="text-right py-3 font-bold text-lg">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: order.currency || 'EUR'
                  }).format(order.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Merci de votre confiance ! Pour toute question, contactez-nous à support@smartix.com
          </p>
        </div>

        {/* Print button */}
        <div className="text-center mt-6 print:hidden">
          <Button
            onClick={onPrint}
            variant="outline"
            className="gap-2"
          >
            <Printer size={18} />
            Imprimer la facture
          </Button>
        </div>
      </div>
    </Card>
  );
});

InvoiceSection.displayName = 'InvoiceSection';

// =============================
// 8️⃣ COMPOSANT PRINCIPAL
// =============================
const OrderDetail = () => {
  const { orderNumber } = useParams();
  const { user } = useAuth();
  const { client } = useApiClient();
  const navigate = useNavigate();
  
  const { 
    status, 
    order, 
    error, 
    isDownloading, 
    shareSuccess, 
    loadOrder, 
    downloadPDF, 
    handleShare 
  } = useOrder(orderNumber, client, user, navigate);

  // ✅ Effet sans dépendance problématique (loadOrder stable)
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadOrder();
// [eslint-disable removed: react-hooks plugin not installed]
  }, [user, navigate, orderNumber]); // ✅ loadOrder est stable, pas besoin dans les dépendances

  // ✅ Contacter le vendeur avec service centralisé
  const handleContactSeller = useCallback(() => {
    if (order?.seller_id) {
      const messageUrl = orderService.getSellerContactUrl(order.seller_id, orderNumber);
      navigate(messageUrl);
    } else {
      toast.info('Fonctionnalité bientôt disponible');
    }
  }, [order?.seller_id, navigate, orderNumber]);

  // ✅ Voir l'aperçu
  const handlePreview = useCallback(() => {
    if (order?.product_id) {
      navigate(`/marketplace/product/${order.product_id}`, {
        state: { 
          isPreview: true,
          fromOrder: orderNumber 
        }
      });
    } else {
      toast.error('Produit non disponible');
    }
  }, [order?.product_id, navigate, orderNumber]);

  // ✅ Imprimer
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ✅ Retour
  const handleBack = useCallback(() => {
    navigate('/buyer/orders');
  }, [navigate]);

  // États de chargement
  if (status === STATUS.LOADING) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35] mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  if (status === STATUS.ERROR || !order) {
    return <ErrorDisplay error={error || 'Commande non trouvée'} onBack={handleBack} />;
  }

  const isCompleted = order.status === 'completed';
  const canDownload = isCompleted && order.download_available;

  return (
    <div className="min-h-screen bg-gray-50 pb-16 print:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-6 print:px-0">
        {/* Back button */}
        <button 
          className="flex items-center gap-2 text-gray-600 hover:text-[#ff6b35] transition-colors mb-6 print:hidden"
          onClick={handleBack}
          aria-label="Retour aux commandes"
        >
          <ChevronLeft size={20} />
          <span>Retour à mes commandes</span>
        </button>

        {/* Order Header */}
        <Card className="p-6 mb-6 print:shadow-none">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                📦 {order.order_number}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {new Date(order.created_at).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Order Details */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-900">📋 Détails de la Commande</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Montant Total</span>
                <strong className="text-gray-900">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: order.currency || 'EUR'
                  }).format(order.total_amount)}
                </strong>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Quantité</span>
                <span className="text-gray-900">{order.quantity}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Vendeur</span>
                <span className="text-gray-900">{order.seller_name || order.seller_id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Méthode de Paiement</span>
                <span className="text-gray-900">{order.payment_method || 'M-Pesa'}</span>
              </div>
              {order.paid_at && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Payé le</span>
                  <span className="text-gray-900">
                    {new Date(order.paid_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {order.completed_at && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Complété le</span>
                  <span className="text-gray-900">
                    {new Date(order.completed_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-900">⚙️ Actions</h3>
            <div className="space-y-3">
              <ActionButton
                onClick={downloadPDF}
                disabled={!canDownload}
                icon={Download}
                variant="primary"
                isLoading={isDownloading}
              >
                {isDownloading ? 'Téléchargement...' : 'Télécharger le PDF'}
              </ActionButton>
              
              <ActionButton
                onClick={handlePreview}
                disabled={!order.product_id}
                icon={Eye}
                variant="secondary"
              >
                  Aperçu du produit
              </ActionButton>
              
              <ActionButton
                onClick={handleShare}
                icon={shareSuccess ? Check : Share2}
                variant="secondary"
              >
                {shareSuccess ? 'Lien copié !' : 'Partager'}
              </ActionButton>
              
              <ActionButton
                onClick={handleContactSeller}
                icon={MessageCircle}
                variant="secondary"
              >
                Contacter le vendeur
              </ActionButton>
            </div>
          </Card>
        </div>

        {/* Invoice Section */}
        <InvoiceSection 
          order={order} 
          user={user} 
          onPrint={handlePrint} 
        />
      </div>
    </div>
  );
};

OrderDetail.propTypes = {};

export default OrderDetail;
