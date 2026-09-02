import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Download, Maximize, Share2, ZoomIn, ZoomOut, Loader2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { pdfService } from '../services/pdfService';
import { handleApiError, showErrorToast, retryWithBackoff } from '../utils/errorHandler';
import './PDFViewer.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const DEFAULT_ZOOM = 100;
const PRELOAD_OFFSET = 1; // Précharger la page suivante

// =============================
// 2️⃣ STATE MACHINE
// =============================
const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  DOWNLOADING: 'downloading'
};

const initialState = {
  status: STATUS.IDLE,
  pdfUrl: null,
  totalPages: 0,
  error: null,
  isDownloading: false,
  shareSuccess: false
};

function pdfReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: STATUS.LOADING, error: null };
    case 'LOAD_SUCCESS':
      return { 
        ...state, 
        status: STATUS.SUCCESS, 
        pdfUrl: action.payload.url,
        totalPages: action.payload.totalPages || 0
      };
    case 'LOAD_ERROR':
      return { ...state, status: STATUS.ERROR, error: action.payload };
    case 'DOWNLOAD_START':
      return { ...state, isDownloading: true };
    case 'DOWNLOAD_END':
      return { ...state, isDownloading: false };
    case 'SHARE_SUCCESS':
      return { ...state, shareSuccess: true };
    case 'SHARE_RESET':
      return { ...state, shareSuccess: false };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// =============================
// 3️⃣ HOOK PERSONNALISÉ AVEC CACHE ET PRÉCHARGEMENT
// =============================
const usePDFViewer = (orderId, isPreview, client, user, navigate) => {
  const [state, dispatch] = useReducer(pdfReducer, initialState);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  
  const abortControllerRef = useRef(null);
  const loadingRef = useRef(false);
  const shareTimeoutRef = useRef(null);
  const blobUrlRef = useRef(null);
  const containerRef = useRef(null);
  
  // ✅ Cache des pages PDF
  const cacheRef = useRef(new Map());

  // ✅ Nettoyage des URLs blob
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // ✅ Fonction de chargement découplée (stable)
  const loadPDF = useCallback(async (page, forceRefresh = false) => {
    if (!user) return null;
    
    // 🔒 Protection contre les appels multiples
    if (loadingRef.current) {
      console.log('Loading already in progress');
      return null;
    }
    
    // ✅ Vérifier le cache
    const cacheKey = `${orderId}-${page}`;
    if (!forceRefresh && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      dispatch({ 
        type: 'LOAD_SUCCESS', 
        payload: { 
          url: cached.url, 
          totalPages: cached.totalPages 
        } 
      });
      return cached;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    loadingRef.current = true;
    dispatch({ type: 'LOAD_START' });
    
    // ✅ Nettoyer l'ancienne URL blob
    cleanupBlobUrl();
    
    try {
      let result;
      
      if (isPreview) {
        result = await pdfService.getPreviewPDF(client, orderId, page, {
          signal: abortControllerRef.current.signal
        });
      } else {
        result = await pdfService.getPurchasedPDF(client, orderId, {
          signal: abortControllerRef.current.signal
        });
      }
      
      // ✅ Mettre en cache
      cacheRef.current.set(cacheKey, {
        url: result.url,
        totalPages: result.totalPages
      });
      
      dispatch({ 
        type: 'LOAD_SUCCESS', 
        payload: { 
          url: result.url, 
          totalPages: result.totalPages 
        } 
      });
      
      // Stocker l'URL blob pour nettoyage
      if (result.url && result.url.startsWith('blob:')) {
        blobUrlRef.current = result.url;
      }
      
      return result;
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading PDF:', error);
        
        const errorMessage = handleApiError(error, {
          401: 'Session expirée, veuillez vous reconnecter',
          403: 'Vous n\'avez pas accès à ce document',
          404: 'Document non trouvé'
        });
        
        dispatch({ type: 'LOAD_ERROR', payload: errorMessage });
        showErrorToast(error);
        
        if (error.response?.status === 401) {
          navigate('/auth');
        } else if (error.response?.status === 403) {
          navigate(isPreview ? '/marketplace' : '/buyer/orders');
        }
      }
      return null;
    } finally {
      loadingRef.current = false;
    }
  }, [user, client, orderId, isPreview, navigate, cleanupBlobUrl]);

  // ✅ Préchargement intelligent
  const preloadNextPage = useCallback(async () => {
    if (!isPreview || !state.totalPages) return;
    
    const nextPage = currentPage + PRELOAD_OFFSET;
    if (nextPage <= state.totalPages) {
      const cacheKey = `${orderId}-${nextPage}`;
      if (!cacheRef.current.has(cacheKey)) {
        console.log(`Preloading page ${nextPage}...`);
        try {
          await pdfService.getPreviewPDF(client, orderId, nextPage, {
            signal: abortControllerRef.current?.signal
          });
        } catch (error) {
          // Silently fail for preloading
          console.debug('Preload failed:', error);
        }
      }
    }
  }, [isPreview, state.totalPages, currentPage, orderId, client]);

  // ✅ Téléchargement via service centralisé
  const handleDownload = useCallback(async () => {
    if (!user) return;
    
    dispatch({ type: 'DOWNLOAD_START' });
    
    try {
      let blob;
      
      if (isPreview) {
        blob = await pdfService.downloadPreviewPDF(client, orderId);
      } else {
        blob = await pdfService.downloadPurchasedPDF(client, orderId);
      }
      
      if (!blob || blob.size === 0) {
        throw new Error('Fichier vide');
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `document-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Téléchargement démarré !');
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const errorMessage = handleApiError(error, {
        404: 'PDF non trouvé',
        403: 'Accès non autorisé au téléchargement'
      });
      toast.error(errorMessage);
    } finally {
      dispatch({ type: 'DOWNLOAD_END' });
    }
  }, [user, client, orderId, isPreview]);

  // ✅ Partage avec fallback pour HTTP
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: isPreview ? 'Aperçu Smartix' : 'Document Smartix',
          text: isPreview ? 'Découvrez cet aperçu' : 'Mon document Smartix',
          url: shareUrl
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
          // Fallback clipboard
          await handleClipboardCopy(shareUrl);
        }
      }
    } else {
      await handleClipboardCopy(shareUrl);
    }
  }, [isPreview]);

  // ✅ Copie clipboard avec fallback
  const handleClipboardCopy = useCallback(async (text) => {
    try {
      // Méthode moderne
      await navigator.clipboard.writeText(text);
      dispatch({ type: 'SHARE_SUCCESS' });
      toast.success('Lien copié dans le presse-papier !');
      
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      
      shareTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'SHARE_RESET' });
      }, 2000);
      
    } catch (clipboardError) {
      // Fallback pour HTTP
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
          dispatch({ type: 'SHARE_SUCCESS' });
          toast.success('Lien copié !');
          setTimeout(() => dispatch({ type: 'SHARE_RESET' }), 2000);
        } else {
          throw new Error('execCommand failed');
        }
      } catch (fallbackError) {
        toast.error('Impossible de copier le lien');
      }
    }
  }, []);

  // ✅ Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  // ✅ Page navigation avec préchargement
  const handlePageChange = useCallback(async (newPage) => {
    if (newPage >= 1 && newPage <= state.totalPages) {
      setCurrentPage(newPage);
      await loadPDF(newPage);
    }
  }, [state.totalPages, loadPDF]);

  // ✅ Plein écran avec ref
  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
        toast.error('Impossible de passer en plein écran');
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      cleanupBlobUrl();
      // Nettoyer le cache
      cacheRef.current.clear();
    };
  }, [cleanupBlobUrl]);

  // ✅ Chargement initial et changement de page (CORRIGÉ - sans boucle)
  useEffect(() => {
    if (isPreview) {
      loadPDF(currentPage);
    } else {
      loadPDF(1);
    }
// [eslint-disable removed: react-hooks plugin not installed]
  }, [currentPage, isPreview]); // ✅ Plus de dépendance à state.status

  // ✅ Préchargement intelligent
  useEffect(() => {
    if (isPreview && state.totalPages > 0) {
      preloadNextPage();
    }
  }, [currentPage, isPreview, state.totalPages, preloadNextPage]);

  return {
    ...state,
    currentPage,
    zoom,
    containerRef,
    loadPDF,
    handleDownload,
    handleShare,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handlePageChange,
    setCurrentPage,
    handleFullscreen
  };
};

// =============================
// 4️⃣ COMPOSANTS UI MEMOIZÉS
// =============================
const ToolbarButton = React.memo(({ onClick, disabled, icon: Icon, label, isLoading = false }) => (
  <button
    onClick={onClick}
    disabled={disabled || isLoading}
    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
    aria-label={label}
    title={label}
  >
    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon size={18} />}
  </button>
));

ToolbarButton.displayName = 'ToolbarButton';

const LoadingSpinner = React.memo(() => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
    <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35] mb-4" />
    <p className="text-gray-400">Chargement du document...</p>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

const ErrorDisplay = React.memo(({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
    <p className="text-gray-400 mb-4">{error}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff8c61] transition-colors"
    >
      Réessayer
    </button>
  </div>
));

ErrorDisplay.displayName = 'ErrorDisplay';

// ✅ PDF Frame avec gestion du zoom via iframe natif
const PDFFrame = React.memo(({ pdfUrl, onError, zoom }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.onerror = onError;
    }
  }, [onError]);

  // ✅ Style avec zoom natif pour iframe
  const iframeStyle = {
    width: '100%',
    height: 'calc(100vh - 100px)',
    border: 'none',
    zoom: zoom / 100,
    MozTransform: `scale(${zoom / 100})`,
    transform: `scale(${zoom / 100})`,
    transformOrigin: 'top left'
  };

  return (
    <iframe
      ref={iframeRef}
      src={pdfUrl}
      title="Visionneuse PDF - Smartix"
      style={iframeStyle}
      onError={onError}
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
    />
  );
});

PDFFrame.displayName = 'PDFFrame';

// =============================
// 5️⃣ COMPOSANT PRINCIPAL
// =============================
const PDFViewer = () => {
  const { orderId } = useParams();
  const { user } = useAuth();
  const { client } = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isPreview = location.state?.isPreview || false;
  const initialPage = location.state?.initialPage || 1;
  
  const {
    status,
    pdfUrl,
    totalPages,
    error,
    isDownloading,
    shareSuccess,
    currentPage,
    zoom,
    containerRef,
    loadPDF,
    handleDownload,
    handleShare,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handlePageChange,
    handleFullscreen
  } = usePDFViewer(orderId, isPreview, client, user, navigate);

  // ✅ Initialisation de la page
  useEffect(() => {
    if (initialPage !== currentPage) {
      handlePageChange(initialPage);
    }
  }, [initialPage, currentPage, handlePageChange]);

  // ✅ Vérification d'authentification
  useEffect(() => {
    if (!user) {
      toast.error('Veuillez vous connecter pour accéder au document');
      navigate('/auth');
      return;
    }
  }, [user, navigate]);

  if (!user) return null;

  const isLoading = status === STATUS.LOADING;
  const hasError = status === STATUS.ERROR;
  const hasSuccess = status === STATUS.SUCCESS;

  return (
    <div className="pdf-viewer min-h-screen bg-gray-900">
      {/* Toolbar */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-10 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ToolbarButton
            onClick={() => navigate(-1)}
            icon={ChevronLeft}
            label="Retour"
          />
          <h1 className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
            {isPreview ? 'Aperçu du document' : 'Document Smartix'}
          </h1>
        </div>
        
        {/* Page controls - uniquement si preview et pages connues */}
        {isPreview && totalPages > 0 && (
          <div className="flex items-center gap-2">
            <ToolbarButton
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              icon={() => <span className="text-lg">←</span>}
              label="Page précédente"
            />
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
              className="w-16 text-center py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
              disabled={isLoading}
              aria-label="Numéro de page"
            />
            <span className="text-sm text-gray-600">/ {totalPages}</span>
            <ToolbarButton
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              icon={() => <span className="text-lg">→</span>}
              label="Page suivante"
            />
          </div>
        )}
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <ToolbarButton
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            icon={ZoomOut}
            label="Dézoomer"
          />
          <button
            onClick={handleZoomReset}
            className="text-sm w-12 text-center hover:bg-gray-100 rounded-lg py-1 transition-colors"
            aria-label="Réinitialiser le zoom"
          >
            {zoom}%
          </button>
          <ToolbarButton
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            icon={ZoomIn}
            label="Zoomer"
          />
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <ToolbarButton
            onClick={handleDownload}
            disabled={!hasSuccess || isDownloading}
            icon={Download}
            label="Télécharger"
            isLoading={isDownloading}
          />
          <ToolbarButton
            onClick={handleShare}
            icon={shareSuccess ? Check : Share2}
            label="Partager"
          />
          <ToolbarButton
            onClick={handleFullscreen}
            icon={Maximize}
            label="Plein écran"
          />
        </div>
      </div>

      {/* PDF Container avec ref pour fullscreen */}
      <div 
        ref={containerRef}
        className="pt-16 px-4 pb-4 pdf-container"
      >
        <div className="bg-gray-800 rounded-lg overflow-auto">
          {isLoading && <LoadingSpinner />}
          
          {hasError && (
            <ErrorDisplay error={error} onRetry={() => loadPDF(currentPage)} />
          )}
          
          {hasSuccess && pdfUrl && (
            <PDFFrame 
              pdfUrl={pdfUrl} 
              zoom={zoom}
              onError={() => {
                toast.error('Erreur de rendu du PDF');
              }}
            />
          )}
          
          {hasSuccess && !pdfUrl && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
              <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
              <p className="text-gray-400">Aucun document à afficher</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

PDFViewer.propTypes = {};

export default PDFViewer;
