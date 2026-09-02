import React, { useState, useEffect, useMemo, useCallback, useReducer } from 'react';
import { SkeletonSmartixStore, useSkeletonLoader } from '../components/SkeletonComplete';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Star, Zap, Award, Search, Trash2, ArrowRight, Filter, TrendingUp, Loader2, Plus, Minus } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const CART_VERSION = 1;
const STORAGE_KEY = 'smartix_cart';

// =============================
// 3️⃣ REDUCER POUR LE PANIER (optimisé)
// =============================
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find(item => item.productId === action.productId);
      const newQuantity = action.quantity || 1;
      
      if (existing) {
        return state.map(item =>
          item.productId === action.productId
            ? { ...item, quantity: item.quantity + newQuantity }
            : item
        );
      }
      return [...state, { productId: action.productId, quantity: newQuantity }];
    }
    
    case 'UPDATE_QUANTITY': {
      const existing = state.find(item => item.productId === action.productId);
      if (!existing) return state;
      
      const newQuantity = existing.quantity + action.delta;
      if (newQuantity <= 0) {
        return state.filter(item => item.productId !== action.productId);
      }
      return state.map(item =>
        item.productId === action.productId
          ? { ...item, quantity: newQuantity }
          : item
      );
    }
    
    case 'REMOVE':
      return state.filter(item => item.productId !== action.productId);
    
    case 'CLEAR':
      return [];
    
    default:
      return state;
  }
};

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const SmartixStore = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { isLoading: skeletonLoading } = useSkeletonLoader(2000);
  
  const [products, setProducts] = useState([]);
  const [cart, dispatchCart] = useReducer(cartReducer, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [isRefreshingPoints, setIsRefreshingPoints] = useState(false);

  // ✅ Calculs optimisés avec useMemo
  const cartItemsWithDetails = useMemo(() => {
    return cart.map(cartItem => {
      const product = products.find(p => p.id === cartItem.productId);
      return {
        ...cartItem,
        name: product?.name || 'Produit inconnu',
        price: product?.price || 0,
        product
      };
    });
  }, [cart, products]);

  const totalPrice = useMemo(() => 
    cartItemsWithDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    [cartItemsWithDetails]
  );

  // ✅ Vérification globale du budget (CORRIGÉ)
  const canAffordProduct = useCallback((product) => {
    const currentQuantity = cart.find(item => item.productId === product.id)?.quantity || 0;
    const projectedTotal = totalPrice + product.price;
    return projectedTotal <= userPoints;
  }, [cart, totalPrice, userPoints]);

  // ✅ Vérification pour le panier entier
  const hasEnoughPoints = totalPrice <= userPoints;

  // ✅ Charger les produits
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await client.get('/marketplace/products');
        setProducts(response.data);
      } catch (error) {
        console.error('Erreur chargement produits:', error);
        setProducts([
          {
            id: 1,
            name: t('store.products.premium.name'),
            price: 500,
            icon: 'Star',
            description: t('store.products.premium.desc'),
            category: 'badges'
          },
          {
            id: 2,
            name: t('store.products.speed.name'),
            price: 1000,
            icon: 'Zap',
            description: t('store.products.speed.desc'),
            category: 'boosters'
          },
          {
            id: 3,
            name: t('store.products.success.name'),
            price: 750,
            icon: 'Award',
            description: t('store.products.success.desc'),
            category: 'customization'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [client]);

  // ✅ Charger les points utilisateur
  const fetchUserPoints = useCallback(async () => {
    if (!user) return;
    try {
      const response = await client.get('/user/points');
      setUserPoints(response.data.points);
    } catch (error) {
      console.error('Erreur chargement points:', error);
    }
  }, [user, client]);

  useEffect(() => {
    fetchUserPoints();
  }, [fetchUserPoints]);

  // ✅ Charger le panier depuis localStorage (versionné)
  useEffect(() => {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    if (savedCart) {
      try {
        const data = JSON.parse(savedCart);
        if (data.version === CART_VERSION && Array.isArray(data.items)) {
          // Réinitialiser le panier avec les données sauvegardées
          data.items.forEach(item => {
            dispatchCart({ type: 'ADD', productId: item.productId, quantity: item.quantity });
          });
        }
      } catch (e) {
        console.warn('Erreur chargement panier:', e);
      }
    }
  }, []);

  // ✅ Sauvegarder le panier dans localStorage (versionné)
  useEffect(() => {
    const storageData = {
      version: CART_VERSION,
      items: cart
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
  }, [cart]);

  // ✅ Filtrer les produits
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    return filtered;
  }, [products, searchQuery, selectedCategory]);

  // ✅ Actions panier
  const handleAddToCart = useCallback((product) => {
    if (!canAffordProduct(product)) {
      toast.error(`Points insuffisants pour ${product.name}`);
      return;
    }
    
    dispatchCart({ type: 'ADD', productId: product.id });
    toast.success(`${product.name} ajouté au panier`);
  }, [canAffordProduct]);

  const handleUpdateQuantity = useCallback((productId, delta) => {
    dispatchCart({ type: 'UPDATE_QUANTITY', productId, delta });
  }, []);

  const handleRemoveFromCart = useCallback((productId, productName) => {
    dispatchCart({ type: 'REMOVE', productId });
    toast.info(`${productName} retiré du panier`);
  }, []);

  // ✅ Passer la commande avec anti-double click et refresh points
  const handleCheckout = useCallback(async () => {
    if (!user) {
      toast.error('Connectez-vous pour acheter');
      return;
    }
    
    if (checkoutLoading) return; // ✅ Anti-double click
    
    if (!hasEnoughPoints) {
      toast.error(`Points insuffisants. Il vous manque ${totalPrice - userPoints} points`);
      return;
    }
    
    setCheckoutLoading(true);
    
    try {
      // ✅ Envoi normalisé (seulement les IDs)
      const response = await client.post('/marketplace/checkout', {
        items: cart.map(item => ({ id: item.productId, quantity: item.quantity }))
      });
      
      // ✅ Mise à jour des points depuis le backend
      if (response.data.updatedPoints !== undefined) {
        setUserPoints(response.data.updatedPoints);
      } else {
        await fetchUserPoints(); // Fallback
      }
      
      toast.success('Achat effectué avec succès !');
      dispatchCart({ type: 'CLEAR' });
      
    } catch (error) {
      console.error('Erreur checkout:', error);
      toast.error('Erreur lors de l\'achat');
    } finally {
      setCheckoutLoading(false);
    }
  }, [user, checkoutLoading, hasEnoughPoints, totalPrice, userPoints, cart, client, fetchUserPoints]);

  // ✅ Icônes
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'Star': return Star;
      case 'Zap': return Zap;
      case 'Award': return Award;
      default: return ShoppingBag;
    }
  };

  // ✅ Catégories uniques
  const categories = useMemo(() => {
    const cats = ['all', ...new Set(products.map(p => p.category))];
    return cats;
  }, [products]);

  if (skeletonLoading || loading) {
    return (
      <div className="min-h-screen bg-background pb-24 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 py-8">
           <SkeletonSmartixStore isLoading={true} />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-[#ff6b35]/20 to-background pt-12 pb-8 px-4 text-center">
        <h1 className="text-5xl font-black text-foreground mb-6 tracking-tight">{t('store.title')}</h1>
        <p className="text-muted-foreground font-medium max-w-md mx-auto mb-10 text-lg leading-relaxed">
          {t('store.subtitle')}
        </p>

        {/* Points display avec refresh */}
        {user && (
          <div className="inline-flex items-center gap-2 bg-card/50 backdrop-blur-2xl border border-border rounded-full px-6 py-3 mb-8">
            <Star className="w-5 h-5 text-[#ff6b35]" />
            <span className="font-black text-foreground">{userPoints} points</span>
            {isRefreshingPoints && (
              <Loader2 className="w-4 h-4 animate-spin text-[#ff6b35]" />
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto relative mb-12">
          <div className="bg-card/50 backdrop-blur-2xl border border-border rounded-full flex items-center px-8 py-5 shadow-xl group focus-within:border-[#ff6b35] transition-all">
            <Search className="w-6 h-6 text-muted-foreground/40 mr-4 group-focus-within:text-[#ff6b35] transition-colors" />
            <input 
              type="text" 
              placeholder={t('store.searchPlaceholder')} 
              className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 font-bold text-lg flex-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mb-12 text-muted-foreground/50 font-black uppercase tracking-widest text-xs">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#ff6b35]" />
            <span>{cart.reduce((sum, i) => sum + i.quantity, 0)} {t('store.stats.products')}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ff6b35]" />
            <span>{t('store.stats.trending')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#ff6b35]" />
            <span>{t('store.stats.topRated')}</span>
          </div>
        </div>

        {/* Filter Button */}
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="w-full bg-foreground text-background font-black py-5 rounded-2xl flex items-center px-8 shadow-xl hover:opacity-90 transition-all"
          >
            <Filter className="w-6 h-6 mr-4" />
            <span className="text-lg">{t('store.filters')}</span>
            <span className="ml-auto text-sm">{selectedCategory !== 'all' ? `• ${selectedCategory}` : ''}</span>
          </button>
          
          {/* Filters panel */}
          {showFilters && (
            <div className="mt-4 bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#ff6b35] text-white'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {cat === 'all' ? 'Tous' : cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Products List */}
          <div className="lg:col-span-2 space-y-8">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <ShoppingBag className="w-24 h-24 text-muted-foreground/20 mx-auto mb-6" />
                <p className="text-muted-foreground">Aucun produit trouvé</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-8">
                {filteredProducts.map((product) => {
                  const Icon = getIcon(product.icon);
                  const cartItem = cart.find(item => item.productId === product.id);
                  const quantity = cartItem?.quantity || 0;
                  const canAfford = canAffordProduct(product);
                  
                  return (
                    <Card key={product.id} className="p-8 bg-card border border-border rounded-[40px] hover:bg-accent/50 transition-all shadow-xl group flex flex-col">
                      <div className="flex items-start justify-between mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-[#ff6b35]/10 flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                          <Icon className="w-7 h-7 text-[#ff6b35]" />
                        </div>
                        <Badge className="bg-[#ff6b35] text-white font-black px-4 py-1.5 rounded-full border-none text-xs">
                          {product.price} pts
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-black text-foreground mb-3 tracking-tight">{product.name}</h3>
                      <p className="text-muted-foreground text-sm font-medium mb-8 leading-relaxed flex-1">{product.description}</p>
                      
                      {quantity > 0 ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleUpdateQuantity(product.id, -1)}
                              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                              aria-label="Diminuer la quantité"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-bold">{quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(product.id, 1)}
                              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                              aria-label="Augmenter la quantité"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => handleRemoveFromCart(product.id, product.name)}
                            variant="ghost"
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleAddToCart(product)}
                          disabled={!canAfford}
                          className={`w-full font-black h-14 rounded-2xl transition-all active:scale-95 ${
                            !canAfford
                              ? 'bg-gray-500 cursor-not-allowed opacity-50'
                              : 'bg-card border border-border hover:bg-[#ff6b35] hover:border-[#ff6b35] hover:text-white text-foreground'
                          }`}
                        >
                          {!canAfford ? 'Points insuffisants' : t('store.addToCart')}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-8 bg-card border border-border rounded-[40px] shadow-xl sticky top-32">
              <h2 className="text-2xl font-black text-foreground mb-8 tracking-tight flex items-center gap-3">
                {t('store.cart.title')}
                {cart.length > 0 && <span className="text-[10px] bg-[#ff6b35] text-white px-2 py-0.5 rounded-full">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
              </h2>
              
              {cart.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                    {cartItemsWithDetails.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border group">
                        <div className="flex-1">
                          <p className="font-black text-foreground text-sm">{item.name}</p>
                          <p className="text-[#ff6b35] text-xs font-black">{item.price} pts x {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateQuantity(item.productId, -1)}
                            className="p-2 text-muted-foreground/50 hover:text-white transition-all"
                            aria-label="Diminuer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.productId, 1)}
                            className="p-2 text-muted-foreground/50 hover:text-white transition-all"
                            aria-label="Augmenter"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveFromCart(item.productId, item.name)}
                            className="p-2 text-muted-foreground/50 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-border/50">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-muted-foreground/50 font-black uppercase tracking-widest text-[10px]">Total</span>
                      <span className="text-3xl font-black text-foreground tracking-tighter">{totalPrice} <span className="text-xs text-[#ff6b35]">pts</span></span>
                    </div>
                    
                    {!hasEnoughPoints && (
                      <div className="mb-4 p-3 bg-red-500/10 rounded-xl text-red-500 text-sm text-center">
                        Points insuffisants. Il vous manque {totalPrice - userPoints} points
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleCheckout}
                      disabled={checkoutLoading || !hasEnoughPoints || cart.length === 0}
                      className="w-full bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black h-16 rounded-2xl shadow-xl shadow-[#ff6b35]/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkoutLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {t('store.cart.checkout')}
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground/10 mx-auto mb-6" />
                  <p className="text-muted-foreground/30 font-black uppercase tracking-widest text-[10px]">{t('store.cart.empty')}</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

SmartixStore.propTypes = {};

export default SmartixStore;
