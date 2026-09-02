import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ChevronLeft, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { getImageUrl } from '../config/apiClient';
import ProductCanvas from '../components/ProductCanvas/ProductCanvas';
import './ProductCanvasPage.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 2000;
const POLLING_INTERVAL = 5000;

// =============================
// 2️⃣ STATE MACHINE
// =============================
const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  PROCESSING: 'processing',
  POLLING: 'polling'
};

const initialState = {
  status: STATUS.IDLE,
  product: null,
  error: null,
  saveError: null,
  generationStatus: null
};

function productReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: STATUS.LOADING, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, status: STATUS.SUCCESS, product: action.payload, error: null };
    case 'FETCH_ERROR':
      return { ...state, status: STATUS.ERROR, error: action.payload };
    case 'SAVE_START':
      return { ...state, status: STATUS.PROCESSING, saveError: null };
    case 'SAVE_SUCCESS':
      return { ...state, status: STATUS.SUCCESS, generationStatus: 'pending' };
    case 'SAVE_ERROR':
      return { ...state, status: STATUS.SUCCESS, saveError: action.payload };
    case 'POLLING_START':
      return { ...state, status: STATUS.POLLING };
    case 'POLLING_SUCCESS':
      return { ...state, status: STATUS.SUCCESS, product: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// =============================
// 3️⃣ HOOK PERSONNALISÉ OPTIMISÉ
// =============================
const useProductWithPolling = (productId, client, onUpdate) => {
  const [state, dispatch] = useReducer(productReducer, initialState);
  const abortControllerRef = useRef(null);
  const fetchingRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const retryCountRef = useRef(0);

  // ✅ Nettoyage des timeouts et intervals
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // ✅ Fonction de fetch avec protection contre les appels multiples
  const fetchProduct = useCallback(async (isRetry = false) => {
    // 🔒 Protection contre les appels simultanés
    if (fetchingRef.current) {
      console.log('Fetch already in progress, skipping');
      return null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    fetchingRef.current = true;

    if (!isRetry) {
      dispatch({ type: 'FETCH_START' });
    }

    try {
      const response = await client.get(`/marketplace/products/${productId}`, {
        signal: abortControllerRef.current.signal
      });
      
      const productData = response.data;
      
      dispatch({ type: 'FETCH_SUCCESS', payload: productData });
      retryCountRef.current = 0;
      
      // ✅ Vérifier si la génération est terminée
      if (productData.generation_status === 'completed' && onUpdate) {
        onUpdate(productData);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
      
      return productData;
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching product:', error);
        
        let errorMessage = 'Erreur lors du chargement du produit';
        
        if (error.response?.status === 401) {
          errorMessage = 'Session expirée, reconnectez-vous';
          toast.error(errorMessage);
        } else if (error.response?.status === 403) {
          errorMessage = 'Vous n\'êtes pas autorisé';
        } else if (error.response?.status === 404) {
          errorMessage = 'Produit non trouvé';
        } else if (error.response?.status === 429) {
          errorMessage = 'Trop de requêtes';
        } else if (!navigator.onLine) {
          errorMessage = 'Pas de connexion Internet';
        }
        
        dispatch({ type: 'FETCH_ERROR', payload: errorMessage });
        throw error;
      }
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, [client, productId, onUpdate]);

  // ✅ Retry avec timeout nettoyable
  const retry = useCallback(() => {
    if (retryCountRef.current < MAX_RETRY_COUNT) {
      retryCountRef.current++;
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      retryTimeoutRef.current = setTimeout(() => {
        fetchProduct(true);
      }, RETRY_DELAY);
      
      toast.info(`Tentative ${retryCountRef.current}/${MAX_RETRY_COUNT}...`);
    } else {
      toast.error('Échec du chargement après plusieurs tentatives');
    }
  }, [fetchProduct]);

  // ✅ Démarrer le polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    dispatch({ type: 'POLLING_START' });
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await client.get(`/marketplace/products/${productId}`);
        const productData = response.data;
        
        if (productData.generation_status === 'completed') {
          dispatch({ type: 'POLLING_SUCCESS', payload: productData });
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          toast.success('Génération terminée !', {
            description: 'Les pages de prévisualisation sont prêtes'
          });
          if (onUpdate) onUpdate(productData);
        } else if (productData.generation_status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          toast.error('Échec de la génération');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, POLLING_INTERVAL);
  }, [client, productId, onUpdate]);

  // ✅ Sauvegarder les pages
  const savePages = useCallback(async (selectedPages) => {
    dispatch({ type: 'SAVE_START' });
    
    try {
      const response = await client.post(`/marketplace/products/${productId}/generate-preview`, {
        selected_pages: selectedPages
      });
      
      dispatch({ type: 'SAVE_SUCCESS' });
      startPolling(); // ✅ Démarrer le polling après sauvegarde
      
      return { success: true, data: response.data };
      
    } catch (error) {
      let errorMessage = 'Erreur lors du lancement de la génération';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expirée';
      } else if (error.response?.status === 403) {
        errorMessage = 'Vous n\'êtes pas autorisé';
      } else if (error.response?.status === 404) {
        errorMessage = 'Produit non trouvé';
      } else if (error.response?.status === 429) {
        errorMessage = 'Trop de requêtes';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Sélection invalide';
      }
      
      dispatch({ type: 'SAVE_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [client, productId, startPolling]);

  // ✅ Nettoyage au unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    fetchProduct,
    retry,
    savePages,
    cleanup
  };
};

// =============================
// 4️⃣ COMPOSANTS UI MEMOIZÉS
// =============================
const LoadingSpinner = React.memo(() => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35] mx-auto mb-4" />
      <p className="text-gray-600">Chargement du produit...</p>
    </div>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

const ErrorDisplay = React.memo(({ error, onRetry, onBack }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Oups !</h2>
      <p className="text-gray-600 mb-6">{error}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff8c61] transition-colors"
        >
          Réessayer
        </button>
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Retour
        </button>
      </div>
    </div>
  </div>
));

ErrorDisplay.displayName = 'ErrorDisplay';

const Instructions = React.memo(({ maxPages, isPolling }) => (
  <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-start gap-3">
      {isPolling ? (
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
      ) : (
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <h3 className="font-semibold text-blue-800 mb-2">
          {isPolling ? '⚙️ Génération en cours...' : '📖 Comment ça marche ?'}
        </h3>
        {isPolling ? (
          <p className="text-sm text-blue-700">
            La génération des aperçus est en cours. Cela peut prendre quelques minutes.
            Vous serez notifié automatiquement une fois terminé.
          </p>
        ) : (
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Cliquez sur les pages que vous voulez offrir en aperçu gratuit</li>
            <li>• Les acheteurs pourront voir ces pages avant d'acheter</li>
            <li>• <span className="font-semibold">Maximum {maxPages} pages de prévisualisation</span></li>
            <li>• La génération peut prendre quelques minutes selon la taille du PDF</li>
          </ul>
        )}
      </div>
    </div>
  </div>
));

Instructions.displayName = 'Instructions';

// =============================
// 5️⃣ COMPOSANT PRINCIPAL
// =============================
const ProductCanvasPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();

  const {
    status,
    product,
    error,
    saveError,
    generationStatus,
    fetchProduct,
    retry,
    savePages
  } = useProductWithPolling(productId, client, (updatedProduct) => {
    // Callback quand le produit est mis à jour
    console.log('Product updated:', updatedProduct);
  });

  // ✅ Une seule source de vérité pour le PDF
  // (déplacé après la déstructuration de useProductWithPolling :
  // l'ancien `state.product` n'existait plus depuis la migration vers ce hook)
  const pdfUrl = useMemo(() => {
    return product?.pdf_file
      ? getImageUrl(product.pdf_file, 'uploads')
      : null;
  }, [product?.pdf_file]);

  const isProcessing = status === STATUS.PROCESSING;
  const isLoading = status === STATUS.LOADING;
  const isPolling = status === STATUS.POLLING;

  // ✅ Gestion de la sauvegarde avec cleanup propre
  const handleSave = useCallback(async (selectedPages) => {
    if (!selectedPages || selectedPages.length === 0) {
      toast.error('Veuillez sélectionner au moins une page');
      return;
    }

    const maxPages = product?.free_preview_pages || 5;
    if (selectedPages.length > maxPages) {
      toast.error(`Vous ne pouvez sélectionner que ${maxPages} pages maximum`);
      return;
    }
    
    const result = await savePages(selectedPages);
    
    if (result.success) {
      toast.success('Génération lancée !', {
        description: 'Les aperçus seront disponibles dans quelques instants'
      });
    }
  }, [savePages, product]);

  // ✅ Annulation simple et propre
  const handleCancel = useCallback(() => {
    if (isProcessing || isPolling) {
      toast.info('Génération en cours, veuillez patienter');
      return;
    }
    navigate('/seller/dashboard');
  }, [navigate, isProcessing, isPolling]);

  // ✅ Retour simple
  const handleBack = useCallback(() => {
    navigate('/seller/dashboard');
  }, [navigate]);

  // ✅ Vérification d'authentification
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProduct();
  }, [user, navigate, fetchProduct]);

  // États de chargement
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (status === STATUS.ERROR && error) {
    return <ErrorDisplay error={error} onRetry={retry} onBack={handleBack} />;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Produit non trouvé</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff8c61] transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const maxPreviewPages = product.free_preview_pages || 5;
  const hasExistingPreview = product.free_preview_pages > 0;
  const isGenerating = generationStatus === 'pending' || isPolling;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button 
            onClick={handleCancel}
            disabled={isProcessing || isPolling}
            className="flex items-center gap-2 text-gray-600 hover:text-[#ff6b35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Retour"
          >
            <ChevronLeft size={20} />
            Retour
          </button>
          
          {(isProcessing || isPolling) && (
            <div className="flex items-center gap-2 text-sm text-[#ff6b35] bg-orange-50 px-3 py-1.5 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isPolling ? 'Génération en cours...' : 'Traitement...'}</span>
            </div>
          )}
          
          {generationStatus === 'completed' && !isPolling && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <CheckCircle className="w-4 h-4" />
              <span>Génération terminée</span>
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {product.title}
            </h1>
            <p className="text-gray-500">
              {isGenerating 
                ? 'Génération des aperçus en cours...'
                : hasExistingPreview 
                  ? 'Modifiez les pages de prévisualisation gratuite'
                  : 'Sélectionnez les pages à offrir en prévisualisation gratuite'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1">
                <span className="font-semibold">{product.total_pages || 0}</span>
                <span>pages totales</span>
              </div>
              <div className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1 ${
                hasExistingPreview 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                <span className="font-semibold">{maxPreviewPages}</span>
                <span>pages gratuites {hasExistingPreview ? 'actuelles' : 'maximum'}</span>
              </div>
            </div>
          </div>

          {/* Product Canvas */}
          {pdfUrl ? (
            <ProductCanvas 
              productId={productId}
              pdfUrl={pdfUrl}
              onSave={handleSave}
              onCancel={handleCancel}
              isProcessing={isProcessing || isPolling}
              maxPages={maxPreviewPages}
              existingPages={product.selected_preview_pages || []}
            />
          ) : (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Aperçu du PDF non disponible</p>
              <p className="text-sm text-gray-500 mb-6">
                Le fichier PDF est en cours de traitement.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={fetchProduct}
                  className="px-6 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff8c61] transition-colors"
                >
                  Actualiser
                </button>
                <button
                  onClick={handleBack}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Retour
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {saveError && (
            <div className="mx-6 mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle size={16} />
                <span className="text-sm">{saveError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <Instructions maxPages={maxPreviewPages} isPolling={isPolling} />

        {/* Astuce */}
        {!hasExistingPreview && !isGenerating && (
          <div className="mt-4 text-center text-sm text-gray-500">
            💡 Astuce : Choisissez les pages les plus représentatives pour attirer les acheteurs
          </div>
        )}
      </div>
    </div>
  );
};

ProductCanvasPage.propTypes = {};

export default ProductCanvasPage;
