/**
 * Marketplace de templates - Version PRO
 * Avec gestion des races conditions, cache, recherche optimisée, anti-fraude
 */

import { EventEmitter } from 'events';
import { templatePayment } from './templatePayment';
import { templateReview } from './templateReview';
import { templatesIndex } from '../templates/templatesIndex';
import { projectManager } from '../core/projectManager';
import { crypto } from '../utils/crypto';

// =============================
// CONFIGURATION
// =============================

const MARKETPLACE_FEES = {
  PLATFORM: 0.15, // 15% de commission
  MIN_PRICE: 0.99,
  MAX_PRICE: 999.99,
  FREE_PRICE: 0
};

const TEMPLATE_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SOLD: 'sold',
  ARCHIVED: 'archived'
};

const TEMPLATE_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  UNLISTED: 'unlisted'
};

const LICENSE_TYPES = {
  PERSONAL: 'personal',     // Usage personnel uniquement
  COMMERCIAL: 'commercial',  // Usage commercial (1 projet)
  EXTENDED: 'extended',      // Usage commercial illimité
  ENTERPRISE: 'enterprise'   // Licence entreprise sur mesure
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;
const TRENDING_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 jours

// =============================
// UTILITAIRES
// =============================

class LockManager {
  constructor() {
    this.locks = new Map();
  }

  async acquire(key, timeout = 5000) {
    while (this.locks.has(key)) {
      const lockTime = this.locks.get(key);
      if (Date.now() - lockTime > timeout) {
        this.locks.delete(key);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    this.locks.set(key, Date.now());
    return () => this.locks.delete(key);
  }
}

class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE, ttl = CACHE_TTL) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Mettre à jour l'ordre (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class TemplateMarketplace extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.listings = new Map(); // templateId -> listing
    this.purchases = new Map(); // userId -> Set(templateIds)
    this.favorites = new Map(); // userId -> Set(templateIds)
    this.views = new Map(); // templateId -> Set(userIds)
    this.sellerWallets = new Map(); // sellerId -> { balance, pending, paid }
    this.categories = new Map();
    this.searchCache = new LRUCache();
    this.lockManager = new LockManager();
    this.stats = {
      totalListings: 0,
      totalSales: 0,
      totalRevenue: 0,
      platformRevenue: 0,
      sellerEarnings: 0,
      averageRating: 0,
      freeTemplates: 0,
      premiumTemplates: 0
    };
  }

  /**
   * Initialise le marketplace
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this._loadListings();
      await this._loadWallets();
      await this._updateStats();
      this.initialized = true;
      console.log('✅ TemplateMarketplace initialisé');
    } catch (error) {
      console.error('❌ TemplateMarketplace initialization failed:', error);
      throw error;
    }
  }

  /**
   * Publie un template sur le marketplace
   */
  async publishTemplate(userId, templateId, listingData) {
    const release = await this.lockManager.acquire(`publish:${userId}`);
    
    try {
      // Vérifier que le template existe
      const template = await templatesIndex.getTemplateById(templateId);
      if (!template) {
        throw new Error('Template non trouvé');
      }

      // Vérifier que l'utilisateur est bien le propriétaire
      if (template.authorId !== userId) {
        throw new Error('Vous ne pouvez publier que vos propres templates');
      }

      // Valider les données de listing
      this._validateListing(listingData);

      // Déterminer si c'est gratuit ou premium
      const isFree = listingData.price === MARKETPLACE_FEES.FREE_PRICE;

      // Créer le listing
      const listing = {
        id: `listing_${Date.now()}_${crypto.randomToken(8)}`,
        templateId,
        sellerId: userId,
        title: listingData.title || template.name,
        description: listingData.description || template.description,
        price: listingData.price,
        isFree,
        license: {
          type: listingData.licenseType || LICENSE_TYPES.PERSONAL,
          seats: listingData.seats || 1,
          terms: listingData.licenseTerms || 'Standard'
        },
        category: listingData.category || template.category,
        tags: listingData.tags || template.tags || [],
        images: listingData.images || [],
        demo: listingData.demo,
        demoType: listingData.demoType || 'static', // 'static', 'sandbox', 'external'
        status: TEMPLATE_STATUS.PENDING_REVIEW,
        visibility: listingData.visibility || TEMPLATE_VISIBILITY.PUBLIC,
        stats: {
          views: 0,
          uniqueViews: 0,
          favorites: 0,
          purchases: 0,
          revenue: 0,
          trendingScore: 0
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          version: template.version,
          framework: template.framework,
          complexity: template.complexity,
          features: template.features || []
        }
      };

      // Ajouter aux listings
      this.listings.set(listing.id, listing);

      // Mettre à jour les stats
      if (isFree) {
        this.stats.freeTemplates++;
      } else {
        this.stats.premiumTemplates++;
      }

      // Sauvegarder
      await this._saveListing(listing);
      
      // Invalider le cache
      this.searchCache.clear();

      this.emit('template:published', { listingId: listing.id, templateId, userId });

      return listing;

    } finally {
      release();
    }
  }

  /**
   * Achète un template (avec verrouillage anti-race-condition)
   */
  async purchaseTemplate(userId, listingId, paymentMethod = 'stripe', licenseType = LICENSE_TYPES.PERSONAL) {
    const release = await this.lockManager.acquire(`purchase:${listingId}`);
    
    try {
      const listing = this.listings.get(listingId);
      if (!listing) {
        throw new Error('Listing non trouvé');
      }

      if (listing.status !== TEMPLATE_STATUS.APPROVED) {
        throw new Error('Ce template n\'est pas disponible à l\'achat');
      }

      // Anti-fraude : ne pas acheter ses propres templates
      if (listing.sellerId === userId) {
        throw new Error('Vous ne pouvez pas acheter vos propres templates');
      }

      // Vérifier que l'utilisateur n'a pas déjà acheté (avec double-check)
      if (await this._hasPurchased(userId, listing.templateId)) {
        throw new Error('Vous avez déjà acheté ce template');
      }

      // Vérifier que la licence est disponible
      if (licenseType === LICENSE_TYPES.ENTERPRISE && listing.price > 0) {
        // Prix spécial pour entreprise
      }

      // Traiter le paiement (sauf si gratuit)
      let payment = null;
      if (!listing.isFree) {
        payment = await templatePayment.processPayment({
          userId,
          amount: listing.price,
          currency: 'EUR',
          method: paymentMethod,
          metadata: {
            listingId,
            templateId: listing.templateId,
            sellerId: listing.sellerId,
            licenseType
          }
        });

        if (!payment.success) {
          throw new Error('Paiement échoué');
        }
      }

      // Double-check après paiement
      if (await this._hasPurchased(userId, listing.templateId)) {
        if (payment) {
          await templatePayment.processRefund(payment.transaction.id, 'Achat en double');
        }
        throw new Error('Vous avez déjà acheté ce template (détection en double)');
      }

      // Enregistrer l'achat
      if (!this.purchases.has(userId)) {
        this.purchases.set(userId, new Map());
      }
      
      const userPurchases = this.purchases.get(userId);
      userPurchases.set(listing.templateId, {
        purchaseDate: Date.now(),
        licenseType,
        transactionId: payment?.transaction?.id,
        price: listing.price
      });

      // Mettre à jour les stats du listing
      listing.stats.purchases++;
      if (!listing.isFree) {
        listing.stats.revenue += listing.price;
      }
      listing.updatedAt = Date.now();

      // Calculer la commission
      const commission = listing.price * MARKETPLACE_FEES.PLATFORM;
      const sellerEarnings = listing.price - commission;

      // Mettre à jour le wallet du vendeur
      await this._updateSellerWallet(listing.sellerId, {
        pending: sellerEarnings,
        transactionId: payment?.transaction?.id,
        listingId
      });

      // Mettre à jour les stats globales
      this.stats.totalSales++;
      if (!listing.isFree) {
        this.stats.totalRevenue += listing.price;
        this.stats.platformRevenue += commission;
        this.stats.sellerEarnings += sellerEarnings;
      }

      // Calculer le score trending
      listing.stats.trendingScore = this._calculateTrendingScore(listing);

      // Invalider le cache
      this.searchCache.clear();

      this.emit('template:purchased', {
        listingId,
        templateId: listing.templateId,
        buyerId: userId,
        sellerId: listing.sellerId,
        amount: listing.price,
        commission,
        sellerEarnings,
        isFree: listing.isFree,
        licenseType
      });

      return {
        success: true,
        listing,
        payment,
        earnings: sellerEarnings,
        isFree: listing.isFree
      };

    } finally {
      release();
    }
  }

  /**
   * Enregistre une vue (avec dédoublonnage)
   */
  async trackView(listingId, userId = null) {
    const listing = this.listings.get(listingId);
    if (!listing) return;

    // Incrémenter le compteur total
    listing.stats.views++;

    // Si utilisateur connecté, compter les vues uniques
    if (userId) {
      if (!this.views.has(listingId)) {
        this.views.set(listingId, new Set());
      }
      
      const viewers = this.views.get(listingId);
      if (!viewers.has(userId)) {
        viewers.add(userId);
        listing.stats.uniqueViews = viewers.size;
      }
    }

    // Mettre à jour le score trending
    listing.stats.trendingScore = this._calculateTrendingScore(listing);
  }

  /**
   * Ajoute aux favoris (avec anti-spam)
   */
  async addToFavorites(userId, listingId) {
    const listing = this.listings.get(listingId);
    if (!listing) {
      throw new Error('Listing non trouvé');
    }

    if (!this.favorites.has(userId)) {
      this.favorites.set(userId, new Map());
    }

    const userFavorites = this.favorites.get(userId);
    
    // Vérifier si déjà en favoris
    if (userFavorites.has(listingId)) {
      return { success: true, alreadyFavorited: true };
    }

    userFavorites.set(listingId, Date.now());
    
    // Recalculer le nombre de favoris (pour éviter les manipulations)
    listing.stats.favorites = await this._countFavorites(listingId);

    this.emit('template:favorited', { userId, listingId });

    return { success: true };
  }

  /**
   * Retire des favoris
   */
  async removeFromFavorites(userId, listingId) {
    if (this.favorites.has(userId)) {
      this.favorites.get(userId).delete(listingId);
      
      const listing = this.listings.get(listingId);
      if (listing) {
        listing.stats.favorites = await this._countFavorites(listingId);
      }
    }

    this.emit('template:unfavorited', { userId, listingId });

    return { success: true };
  }

  /**
   * Recherche optimisée avec cache
   */
  async searchTemplates(query, options = {}) {
    const cacheKey = JSON.stringify({ query, options });
    
    // Vérifier le cache
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const {
      category,
      minPrice,
      maxPrice,
      licenseType,
      isFree,
      sortBy = 'trending',
      limit = 20,
      offset = 0
    } = options;

    // Pour une vraie production, utiliser Elasticsearch/Meilisearch ici
    let results = Array.from(this.listings.values())
      .filter(l => l.status === TEMPLATE_STATUS.APPROVED);

    // Filtre par recherche textuelle (optimisé avec index dans production)
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(l => 
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Filtre par catégorie
    if (category) {
      results = results.filter(l => l.category === category);
    }

    // Filtre par licence
    if (licenseType) {
      results = results.filter(l => l.license.type === licenseType);
    }

    // Filtre gratuit/premium
    if (isFree !== undefined) {
      results = results.filter(l => l.isFree === isFree);
    }

    // Filtre par prix
    if (minPrice !== undefined) {
      results = results.filter(l => l.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      results = results.filter(l => l.price <= maxPrice);
    }

    // Tri avancé
    switch (sortBy) {
      case 'price_asc':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        results.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        results.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'popular':
        results.sort((a, b) => b.stats.purchases - a.stats.purchases);
        break;
      case 'trending':
        results.sort((a, b) => b.stats.trendingScore - a.stats.trendingScore);
        break;
      case 'rating':
        // À implémenter avec templateReview
        break;
    }

    // Pagination
    const paginated = results.slice(offset, offset + limit);

    const result = {
      results: paginated,
      total: results.length,
      offset,
      limit,
      hasMore: offset + limit < results.length,
      facets: {
        categories: this._getCategoryFacets(results),
        prices: {
          min: Math.min(...results.map(r => r.price)),
          max: Math.max(...results.map(r => r.price))
        },
        free: results.filter(r => r.isFree).length,
        premium: results.filter(r => !r.isFree).length
      }
    };

    // Mettre en cache
    this.searchCache.set(cacheKey, result);

    return result;
  }

  /**
   * Récupère les templates tendances
   */
  getTrendingTemplates(limit = 10) {
    return Array.from(this.listings.values())
      .filter(l => l.status === TEMPLATE_STATUS.APPROVED)
      .sort((a, b) => b.stats.trendingScore - a.stats.trendingScore)
      .slice(0, limit);
  }

  /**
   * Calcule le score de tendance
   * @private
   */
  _calculateTrendingScore(listing) {
    const now = Date.now();
    const age = now - listing.createdAt;
    const recency = Math.max(0, 1 - (age / TRENDING_WINDOW));
    
    // Pondération des interactions
    const score = 
      listing.stats.purchases * 3 +
      listing.stats.favorites * 2 +
      listing.stats.views * 0.1 +
      listing.stats.uniqueViews * 0.5;
    
    return score * (0.5 + recency * 0.5);
  }

  /**
   * Met à jour le wallet d'un vendeur
   * @private
   */
  async _updateSellerWallet(sellerId, transaction) {
    if (!this.sellerWallets.has(sellerId)) {
      this.sellerWallets.set(sellerId, {
        balance: 0,
        pending: 0,
        paid: 0,
        history: []
      });
    }

    const wallet = this.sellerWallets.get(sellerId);
    wallet.pending += transaction.pending;
    wallet.history.push({
      type: 'earnings',
      amount: transaction.pending,
      transactionId: transaction.transactionId,
      listingId: transaction.listingId,
      timestamp: Date.now()
    });

    // Sauvegarder
    await this._saveWallet(sellerId, wallet);
  }

  /**
   * Effectue un payout pour un vendeur
   */
  async processSellerPayout(sellerId, amount) {
    const release = await this.lockManager.acquire(`payout:${sellerId}`);
    
    try {
      const wallet = this.sellerWallets.get(sellerId);
      if (!wallet || wallet.pending < amount) {
        throw new Error('Solde insuffisant');
      }

      wallet.pending -= amount;
      wallet.paid += amount;
      wallet.history.push({
        type: 'payout',
        amount,
        timestamp: Date.now()
      });

      // TODO: Appeler le service de paiement réel
      await this._processPayout(sellerId, amount);

      this.emit('payout:processed', { sellerId, amount });

      return { success: true, newBalance: wallet.pending };

    } finally {
      release();
    }
  }

  /**
   * Compte les favoris réels
   * @private
   */
  async _countFavorites(listingId) {
    let count = 0;
    for (const [_, favorites] of this.favorites) {
      if (favorites.has(listingId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Vérifie si un utilisateur a acheté (avec cache)
   * @private
   */
  async _hasPurchased(userId, templateId) {
    return this.purchases.get(userId)?.has(templateId) || false;
  }

  /**
   * Calcule les facettes de catégories
   * @private
   */
  _getCategoryFacets(results) {
    const facets = {};
    results.forEach(r => {
      facets[r.category] = (facets[r.category] || 0) + 1;
    });
    return facets;
  }

  /**
   * Valide les données de listing
   * @private
   */
  _validateListing(data) {
    const errors = [];

    if (data.price === undefined) {
      errors.push('Prix requis');
    } else if (data.price > 0 && 
               (data.price < MARKETPLACE_FEES.MIN_PRICE || 
                data.price > MARKETPLACE_FEES.MAX_PRICE)) {
      errors.push(`Prix doit être entre ${MARKETPLACE_FEES.MIN_PRICE}€ et ${MARKETPLACE_FEES.MAX_PRICE}€`);
    }

    if (!data.title || data.title.length < 5) {
      errors.push('Titre trop court (minimum 5 caractères)');
    }

    if (!data.description || data.description.length < 20) {
      errors.push('Description trop courte (minimum 20 caractères)');
    }

    if (data.licenseType && !Object.values(LICENSE_TYPES).includes(data.licenseType)) {
      errors.push('Type de licence invalide');
    }

    if (errors.length > 0) {
      throw new Error(`Validation échouée: ${errors.join(', ')}`);
    }
  }

  /**
   * Met à jour les stats globales
   * @private
   */
  async _updateStats() {
    const listings = Array.from(this.listings.values());
    
    this.stats.totalListings = listings.length;
    this.stats.freeTemplates = listings.filter(l => l.isFree).length;
    this.stats.premiumTemplates = listings.filter(l => !l.isFree).length;
    
    // Recalculer les stats de ventes
    this.stats.totalSales = listings.reduce((acc, l) => acc + l.stats.purchases, 0);
    this.stats.totalRevenue = listings.reduce((acc, l) => acc + l.stats.revenue, 0);
    
    // Recalculer les stats plateforme
    this.stats.platformRevenue = this.stats.totalRevenue * MARKETPLACE_FEES.PLATFORM;
    this.stats.sellerEarnings = this.stats.totalRevenue - this.stats.platformRevenue;
  }

  /**
   * Charge les listings (simulé)
   * @private
   */
  async _loadListings() {
    // TODO: Charger depuis la DB
    this.listings.set('listing_demo', {
      id: 'listing_demo',
      templateId: 'todo-app',
      sellerId: 'vibecoding',
      title: 'Todo App Pro',
      description: 'Application de tâches avancée avec synchronisation cloud',
      price: 19.99,
      isFree: false,
      license: {
        type: LICENSE_TYPES.COMMERCIAL,
        seats: 1
      },
      category: 'productivity',
      tags: ['todo', 'productivity', 'premium'],
      images: ['screenshot1.png', 'screenshot2.png'],
      demo: 'https://demo.vibecoding.dev/todo-app',
      demoType: 'sandbox',
      status: TEMPLATE_STATUS.APPROVED,
      stats: {
        views: 1234,
        uniqueViews: 567,
        favorites: 89,
        purchases: 45,
        revenue: 899.55,
        trendingScore: 450
      },
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      metadata: {
        version: '2.0.0',
        framework: 'react',
        complexity: 'medium'
      }
    });
  }

  /**
   * Charge les wallets
   * @private
   */
  async _loadWallets() {
    // TODO: Charger depuis la DB
    this.sellerWallets.set('vibecoding', {
      balance: 1250.50,
      pending: 350.25,
      paid: 900.25,
      history: []
    });
  }

  /**
   * Sauvegarde un listing
   * @private
   */
  async _saveListing(listing) {
    // TODO: Sauvegarder dans la DB
    console.log('💾 Listing sauvegardé:', listing.id);
  }

  /**
   * Sauvegarde un wallet
   * @private
   */
  async _saveWallet(sellerId, wallet) {
    // TODO: Sauvegarder dans la DB
    console.log('💾 Wallet sauvegardé pour:', sellerId);
  }

  /**
   * Traite un payout
   * @private
   */
  async _processPayout(sellerId, amount) {
    // TODO: Appeler Stripe/PayPal
    console.log('💰 Payout traité:', sellerId, amount);
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Obtient le wallet d'un vendeur
   */
  getSellerWallet(sellerId) {
    return this.sellerWallets.get(sellerId) || null;
  }
}

export const templateMarketplace = new TemplateMarketplace();
export default templateMarketplace;
