
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Search, X, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';
import { useApiClient } from '../contexts/ApiClientContext';

// =============================
// CONSTANTES
// =============================

const IMAGES_PER_PAGE = 20;
const SEARCH_DEBOUNCE_DELAY = 500;
const UNSPLASH_ACCESS_KEY = process.env.REACT_APP_UNSPLASH_ACCESS_KEY || '';

// =============================
// COMPOSANT IMAGE CARD (MEMOIZED)
// =============================
const ImageCard = React.memo(({ image, onSelect, isSelected, onPreview }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer rounded-xl overflow-hidden bg-gray-100 aspect-square transition-all duration-200 ${
        isSelected ? 'ring-2 ring-[#ff6b35] shadow-lg scale-[1.02]' : 'hover:scale-105'
      }`}
      onClick={() => onSelect(image)}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}
      
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
          <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
          <span className="text-xs text-gray-400">Erreur</span>
        </div>
      ) : (
        <img
          src={image.urls.small}
          alt={image.alt_description || 'Image'}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-[#ff6b35] rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      
      {/* Overlay au survol */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(image); }}
          className="px-3 py-1.5 bg-[#ff6b35] text-white rounded-lg font-semibold text-sm"
        >
          Sélectionner
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(image); }}
          className="px-3 py-1.5 bg-white/20 backdrop-blur text-white rounded-lg font-semibold text-sm flex items-center gap-1"
        >
          <ZoomIn className="w-4 h-4" />
          Zoom
        </button>
      </div>
    </div>
  );
});

ImageCard.displayName = 'ImageCard';

// =============================
// COMPOSANT MODAL PREVIEW
// =============================
const ImagePreviewModal = ({ image, onClose }) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-white" />
          </div>
        )}
        <img
          src={image.urls.regular}
          alt={image.alt_description || 'Image'}
          className={`max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        <div className="absolute bottom-4 left-0 right-0 text-center text-white/60 text-sm">
          {image.user?.name && <span>📷 {image.user.name}</span>}
          {image.likes > 0 && <span className="ml-4">❤️ {image.likes}</span>}
        </div>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ImageSearch = ({ onClose, onSelect, initialQuery = '' }) => {
  const { client } = useApiClient();
  const [images, setImages] = useState([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  
  const searchInputRef = useRef(null);
  const resultsContainerRef = useRef(null);
  const controllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_DELAY);
  
  // =============================
  // RECHERCHE D'IMAGES AVEC CACHE + ABORT
  // =============================
  const searchImages = useCallback(async (query, pageNum = 1, reset = false) => {
    if (!query.trim()) {
      setImages([]);
      setHasMore(false);
      return;
    }
    
    if (pageNum > 1 && !hasMore) return;
    
    // Vérifier le cache
    const cacheKey = `${query}:${pageNum}`;
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      setImages(prev => reset ? cached.images : [...prev, ...cached.images]);
      setTotalResults(cached.total);
      setHasMore(cached.hasMore);
      setPage(pageNum);
      return;
    }
    
    // Annuler la requête précédente
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      
      const response = await client.get('https://api.unsplash.com/search/photos', {
        params: {
          query: query.trim(),
          page: pageNum,
          per_page: IMAGES_PER_PAGE,
          client_id: UNSPLASH_ACCESS_KEY
        },
        headers: {
          'Accept-Version': 'v1'
        },
        signal: controllerRef.current.signal
      });
      
      const newImages = response.data.results || [];
      const total = response.data.total || 0;
      const more = newImages.length === IMAGES_PER_PAGE && (reset ? newImages.length === IMAGES_PER_PAGE : images.length + newImages.length < total);
      
      // Mettre à jour les images
      setImages(prev => reset ? newImages : [...prev, ...newImages]);
      setTotalResults(total);
      setHasMore(more);
      setPage(pageNum);
      
      // Mettre en cache
      cacheRef.current.set(cacheKey, {
        images: reset ? newImages : [...(cacheRef.current.get(`${query}:${pageNum - 1}`)?.images || []), ...newImages],
        total,
        hasMore: more
      });
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error searching images:', error);
        
        if (error.response?.status === 401) {
          toast.error('Clé API Unsplash invalide');
        } else if (error.response?.status === 429) {
          toast.error('Trop de requêtes, patientez');
        } else {
          toast.error('Erreur lors de la recherche d\'images');
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [client, hasMore, images.length]);
  
  // =============================
  // EFFET DE RECHERCHE (debounced)
  // =============================
  useEffect(() => {
    if (debouncedSearch) {
      searchImages(debouncedSearch, 1, true);
      // Scroll en haut
      resultsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setImages([]);
      setHasMore(false);
      setTotalResults(0);
    }
  }, [debouncedSearch, searchImages]);
  
  // =============================
  // CHARGER PLUS
  // =============================
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && debouncedSearch) {
      searchImages(debouncedSearch, page + 1);
    }
  }, [loadingMore, hasMore, debouncedSearch, page, searchImages]);
  
  // =============================
  // SÉLECTIONNER UNE IMAGE
  // =============================
  const handleSelect = useCallback((image) => {
    setSelectedImage(image);
    onSelect(image);
    toast.success('Image sélectionnée');
    // Optionnel : fermer automatiquement
    // setTimeout(() => onClose(), 500);
  }, [onSelect]);
  
  // =============================
  // RECHERCHE RAPIDE
  // =============================
  const quickSearch = useCallback((query) => {
    setSearchQuery(query);
    searchInputRef.current?.focus();
  }, []);
  
  // =============================
  // EFFACER LA RECHERCHE
  // =============================
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);
  
  // =============================
  // RECHERCHE INSTANTANÉE (Enter)
  // =============================
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      searchImages(searchQuery, 1, true);
    }
  }, [searchQuery, searchImages]);
  
  // =============================
  // RENDU
  // =============================
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-4xl bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-white font-bold text-lg">Rechercher une image</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
          
          {/* Barre de recherche */}
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher des images (nature, technologie, éducation...)"
                className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-12 pr-12 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              )}
            </div>
            
            {/* Suggestions rapides */}
            <div className="flex flex-wrap gap-2 mt-3">
              {['nature', 'technology', 'education', 'science', 'art', 'business'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => quickSearch(tag)}
                  className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-white/60 rounded-full transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          
          {/* Résultats */}
          <div ref={resultsContainerRef} className="flex-1 overflow-y-auto p-4">
            {loading && images.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-20">
                <ImageIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/40">
                  {searchQuery ? 'Aucune image trouvée' : 'Recherchez des images ci-dessus'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-white/60 text-sm">
                    {totalResults} résultat{totalResults > 1 ? 's' : ''}
                  </p>
                  {selectedImage && (
                    <div className="text-[#ff6b35] text-sm flex items-center gap-2">
                      <span>✓ Image sélectionnée</span>
                      <button
                        onClick={() => setSelectedImage(null)}
                        className="text-white/40 hover:text-white/60"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <ImageCard
                      key={image.id}
                      image={image}
                      onSelect={handleSelect}
                      onPreview={setPreviewImage}
                      isSelected={selectedImage?.id === image.id}
                    />
                  ))}
                </div>
                
                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Charger plus'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex justify-between items-center">
            <p className="text-xs text-white/30">
              Images fournies par <span className="text-white/50">Unsplash</span>
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
      
      {/* Modal preview */}
      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
  );
};

ImageSearch.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  initialQuery: PropTypes.string
};

export default ImageSearch;
ImagePreviewModal.propTypes = {
  image: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};
