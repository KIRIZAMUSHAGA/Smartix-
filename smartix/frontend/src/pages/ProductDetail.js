import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { getImageUrl } from '../config/apiClient';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import {
  ArrowLeft, Heart, Share2, Star, ShoppingCart, Check, AlertCircle,
  ChevronLeft, ChevronRight, Loader2, Minus, Plus, WifiOff, Eye, MessageCircle
} from 'lucide-react';
import './ProductDetail.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const DEFAULT_IMAGE = '/assets/placeholder-product.jpg';
const MAX_QUANTITY = 99;
const REVIEWS_PAGE_SIZE = 10;

// =============================
// 2️⃣ HOOKS MÉTIER (Séparation logique)
// =============================

// Hook pour la gestion du produit
const useProduct = (productId) => {
  const { client } = useApiClient();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    
    // Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);
    
    try {
      const response = await client.get(`/marketplace/products/${productId}`, {
        signal: abortControllerRef.current.signal
      });
      setProduct(response.data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error('Error loading product:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [client, productId]); // ✅ CORRIGÉ: plus de dépendance à quantity

  useEffect(() => {
    loadProduct();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadProduct]);

  return { product, loading, error, refetch: loadProduct };
};

// Hook pour la gestion des avis (avec pagination)
const useProductReviews = (productId) => {
  const { client } = useApiClient();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const abortControllerRef = useRef(null);

  const loadReviews = useCallback(async (pageToLoad = 1, append = false) => {
    if (!productId) return;
    
    // Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    
    try {
      const response = await client.get(`/marketplace/products/${productId}/reviews`, {
        params: {
          page: pageToLoad,
          limit: REVIEWS_PAGE_SIZE
        },
        signal: abortControllerRef.current.signal
      });
      
      const newReviews = response.data.data || response.data || [];
      const totalCount = response.data.total || response.data.length || 0;
      
      if (append) {
        setReviews(prev => [...prev, ...newReviews]);
      } else {
        setReviews(newReviews);
      }
      
      setTotal(totalCount);
      setHasMore(newReviews.length === REVIEWS_PAGE_SIZE);
      setPage(pageToLoad);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading reviews:', err);
        toast.error('Erreur lors du chargement des avis');
      }
    } finally {
      setLoading(false);
    }
  }, [client, productId]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadReviews(page + 1, true);
    }
  }, [loading, hasMore, page, loadReviews]);

  const resetReviews = useCallback(() => {
    setReviews([]);
    setPage(1);
    setHasMore(true);
    loadReviews(1, false);
  }, [loadReviews]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    reviews,
    loading,
    hasMore,
    total,
    loadMore,
    resetReviews
  };
};

// Hook pour la gestion de l'achat
const usePurchase = (product, quantity) => {
  const { client } = useApiClient();
  const { user } = useAuth();
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour acheter');
      return false;
    }
    
    if (!product) return false;
    
    // Vérification côté client (pour UX uniquement, backend fera la vraie vérification)
    if (quantity > product.quantity_available) {
      toast.error(`Stock insuffisant. Maximum: ${product.quantity_available}`);
      return false;
    }
    
    setPurchasing(true);
    
    try {
      // ⚠️ Le backend doit vérifier le stock et l'utilisateur authentifié
      const response = await client.post('/marketplace/purchase', {
        product_id: product.id,
        quantity: quantity
        // quantity est envoyé mais backend doit le valider
      });
      
      if (response.data.success) {
        setPurchased(true);
        toast.success('Achat réussi !');
        return true;
      } else {
        throw new Error(response.data.message || 'Erreur lors de l\'achat');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      
      if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Stock insuffisant');
      } else if (error.response?.status === 401) {
        toast.error('Veuillez vous reconnecter');
      } else {
        toast.error('Erreur lors du paiement');
      }
      return false;
    } finally {
      setPurchasing(false);
    }
  }, [client, user, product, quantity]);

  return { purchasing, purchased, handlePurchase };
};

// =============================
// 3️⃣ COMPOSANTS UI
// =============================

// Composant de notation
const RatingStars = ({ rating, size = 20, showValue = true }) => (
  <div className="rating-stars">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={size}
        className={star <= rating ? 'star-filled' : 'star-empty'}
        fill={star <= rating ? '#ff6b35' : 'none'}
      />
    ))}
    {showValue && <span className="rating-value">{rating.toFixed(1)}</span>}
  </div>
);

// Composant de galerie d'images
const ImageGallery = ({ images, productTitle }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState({});
  
  const mainImage = images?.[currentIndex] || images?.[0];
  const imageUrl = getImageUrl(mainImage, 'products') || DEFAULT_IMAGE;
  
  const handleImageError = useCallback((index) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  }, []);
  
  const getSafeImageUrl = useCallback((image, index) => {
    if (imageErrors[index]) return DEFAULT_IMAGE;
    return getImageUrl(image, 'products') || DEFAULT_IMAGE;
  }, [imageErrors]);
  
  if (!images?.length) {
    return (
      <div className="product-gallery">
        <div className="main-image">
          <img 
            src={DEFAULT_IMAGE} 
            alt={productTitle}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = DEFAULT_IMAGE;
            }}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="product-gallery">
      <div className="main-image">
        <img 
          src={imageUrl} 
          alt={`${productTitle} - image ${currentIndex + 1}`}
          onError={() => handleImageError(currentIndex)}
        />
        {images.length > 1 && (
          <>
            <button 
              className="gallery-nav prev"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              className="gallery-nav next"
              onClick={() => setCurrentIndex(prev => Math.min(images.length - 1, prev + 1))}
              disabled={currentIndex === images.length - 1}
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
      
      {images.length > 1 && (
        <div className="thumbnail-list">
          {images.map((img, idx) => (
            <button
              key={idx}
              className={`thumbnail ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
            >
              <img 
                src={getSafeImageUrl(img, idx)} 
                alt={`Miniature ${idx + 1}`}
                onError={() => handleImageError(idx)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Composant de sélecteur de quantité
const QuantitySelector = ({ quantity, available, onChange }) => {
  const handleDecrement = useCallback(() => {
    if (quantity > 1) {
      onChange(quantity - 1);
    }
  }, [quantity, onChange]);
  
  const handleIncrement = useCallback(() => {
    if (quantity < Math.min(MAX_QUANTITY, available)) {
      onChange(quantity + 1);
    }
  }, [quantity, available, onChange]);
  
  const handleChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      const newQuantity = Math.min(Math.max(1, value), Math.min(MAX_QUANTITY, available));
      onChange(newQuantity);
    }
  }, [available, onChange]);
  
  return (
    <div className="quantity-selector">
      <button 
        onClick={handleDecrement} 
        disabled={quantity <= 1}
        aria-label="Diminuer la quantité"
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        value={quantity}
        onChange={handleChange}
        min={1}
        max={Math.min(MAX_QUANTITY, available)}
        disabled={available === 0}
      />
      <button 
        onClick={handleIncrement} 
        disabled={quantity >= Math.min(MAX_QUANTITY, available)}
        aria-label="Augmenter la quantité"
      >
        <Plus size={16} />
      </button>
      <span className="stock-info">
        {available > 0 ? `${available} en stock` : 'Rupture de stock'}
      </span>
    </div>
  );
};

// Composant d'avis
const ReviewsSection = ({ productId, averageRating, totalReviews }) => {
  const { reviews, loading, hasMore, total, loadMore } = useProductReviews(productId);
  
  if (totalReviews === 0) {
    return (
      <Card className="reviews-section">
        <h3>Avis Clients</h3>
        <div className="no-reviews">
          <MessageCircle size={48} />
          <p>Aucun avis pour le moment</p>
          <Button variant="outline">Soyez le premier à donner votre avis</Button>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="reviews-section">
      <div className="reviews-header">
        <h3>Avis Clients</h3>
        <div className="rating-summary">
          <RatingStars rating={averageRating} size={24} />
          <span className="total-reviews">({totalReviews} avis)</span>
        </div>
      </div>
      
      <div className="reviews-list">
        {reviews.map((review, index) => (
          <div key={review.id || index} className="review-item">
            <div className="review-header">
              <div className="reviewer-info">
                <img 
                  src={review.user_avatar || DEFAULT_IMAGE} 
                  alt={review.user_name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = DEFAULT_IMAGE;
                  }}
                />
                <div>
                  <strong>{review.user_name}</strong>
                  <RatingStars rating={review.rating} size={14} showValue={false} />
                </div>
              </div>
              <span className="review-date">
                {new Date(review.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
            <p className="review-comment">{review.comment}</p>
          </div>
        ))}
      </div>
      
      {hasMore && (
        <div className="load-more-reviews">
          <Button 
            onClick={loadMore} 
            disabled={loading}
            variant="outline"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Voir plus d\'avis'}
          </Button>
        </div>
      )}
    </Card>
  );
};

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  
  // Hooks métier
  const { product, loading, error, refetch } = useProduct(productId);
  const { purchasing, purchased, handlePurchase } = usePurchase(product, quantity);
  
  // ✅ CORRIGÉ: Utilisation des données backend pour les notes
  const averageRating = product?.average_rating || 0;
  const totalReviews = product?.total_reviews || 0;
  
  // Gestionnaire d'ajout au panier (simulé)
  const handleAddToCart = useCallback(() => {
    if (!user) {
      toast.error('Veuillez vous connecter');
      navigate('/auth');
      return;
    }
    
    if (!product) return;
    
    // ✅ CORRIGÉ: Message informatif au lieu d'un faux paiement
    toast.info('Fonctionnalité de panier à venir');
  }, [user, product, navigate]);
  
  // Gestionnaire de partage
  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: product?.title,
        text: product?.description,
        url: window.location.href
      }).catch(() => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Lien copié !');
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Lien copié !');
    }
  }, [product]);
  
  // Gestionnaire de wishlist (simulé)
  const handleWishlist = useCallback(() => {
    if (!user) {
      toast.error('Veuillez vous connecter');
      navigate('/auth');
      return;
    }
    setIsWishlisted(prev => !prev);
    toast.success(isWishlisted ? 'Retiré des favoris' : 'Ajouté aux favoris');
  }, [user, navigate, isWishlisted]);
  
  if (loading) {
    return (
      <div className="product-detail-loading">
        <Loader2 className="animate-spin" size={48} />
        <p>Chargement du produit...</p>
      </div>
    );
  }
  
  if (error || !product) {
    return (
      <div className="product-detail-error">
        <AlertCircle size={48} />
        <h2>Produit non trouvé</h2>
        <p>Le produit que vous recherchez n'existe pas ou a été supprimé.</p>
        <Button onClick={() => navigate('/marketplace')}>
          Retour au marché
        </Button>
      </div>
    );
  }
  
  const isOutOfStock = product.quantity_available === 0;
  
  return (
    <div className="product-detail">
      <div className="product-detail-container">
        {/* Navigation */}
        <div className="product-navigation">
          <button onClick={() => navigate('/marketplace')} className="back-button">
            <ArrowLeft size={20} />
            Retour au marché
          </button>
        </div>
        
        {/* Contenu principal */}
        <div className="product-detail-content">
          {/* Galerie d'images */}
          <ImageGallery 
            images={product.images || [product.cover_image]} 
            productTitle={product.title}
          />
          
          {/* Informations produit */}
          <div className="product-info">
            <h1 className="product-title">{product.title}</h1>
            
            <div className="product-rating">
              <RatingStars rating={averageRating} />
              <span className="reviews-count">
                ({totalReviews} avis)
              </span>
            </div>
            
            <div className="product-price">
              <span className="price">{product.price} {product.currency}</span>
              {product.old_price && (
                <span className="old-price">{product.old_price} {product.currency}</span>
              )}
            </div>
            
            <div className="product-description">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
            
            <div className="product-meta">
              <div className="meta-item">
                <strong>Vendeur:</strong> {product.seller_name || 'Vendeur certifié'}
              </div>
              <div className="meta-item">
                <strong>Catégorie:</strong> {product.category_name || 'Non catégorisé'}
              </div>
              <div className="meta-item">
                <strong>Vendu:</strong> {product.quantity_sold || 0} unités
              </div>
            </div>
            
            {/* Actions produit */}
            <div className="product-actions">
              {!isOutOfStock ? (
                <>
                  <QuantitySelector
                    quantity={quantity}
                    available={product.quantity_available}
                    onChange={setQuantity}
                  />
                  
                  <div className="action-buttons">
                    <Button 
                      className="btn-purchase"
                      onClick={handlePurchase}
                      disabled={purchasing || purchased}
                    >
                      {purchasing ? (
                        <Loader2 className="animate-spin" />
                      ) : purchased ? (
                        <Check size={18} />
                      ) : (
                        <ShoppingCart size={18} />
                      )}
                      {purchased ? 'Acheté' : 'Acheter maintenant'}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="btn-cart"
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart size={18} />
                      Ajouter au panier
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      className="btn-wishlist"
                      onClick={handleWishlist}
                    >
                      <Heart 
                        size={20} 
                        fill={isWishlisted ? '#ff6b35' : 'none'}
                        color={isWishlisted ? '#ff6b35' : 'currentColor'}
                      />
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      className="btn-share"
                      onClick={handleShare}
                    >
                      <Share2 size={20} />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="out-of-stock">
                  <AlertCircle size={24} />
                  <p>Rupture de stock</p>
                  <Button 
                    variant="outline" 
                    onClick={() => toast.info('Notification à venir')}
                  >
                    M'avertir quand disponible
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Section des avis */}
        <ReviewsSection 
          productId={productId}
          averageRating={averageRating}
          totalReviews={totalReviews}
        />
        
        {/* Produits similaires (placeholder) */}
        <div className="similar-products">
          <h3>Produits similaires</h3>
          <div className="similar-products-grid">
            <p className="text-gray-500">Chargement...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

ProductDetail.propTypes = {};

export default ProductDetail;
RatingStars.propTypes = {
  rating: PropTypes.number.isRequired,
  size: PropTypes.number,
  showValue: PropTypes.bool,
};
ImageGallery.propTypes = {
  images: PropTypes.array.isRequired,
  productTitle: PropTypes.any.isRequired,
};
QuantitySelector.propTypes = {
  quantity: PropTypes.number.isRequired,
  available: PropTypes.any.isRequired,
  onChange: PropTypes.func.isRequired,
};
ReviewsSection.propTypes = {
  productId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  averageRating: PropTypes.any.isRequired,
  totalReviews: PropTypes.any.isRequired,
};
