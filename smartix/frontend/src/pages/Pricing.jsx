import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, X, AlertCircle, Loader, Phone, CreditCard, Shield, Zap, Crown, 
  Building, Database, Cloud, Users, Code, BarChart, Award, Gift, 
  Rocket, Star, TrendingUp, FileCode, BookOpen, ShoppingBag, Bell, Mail,
  MessageCircle, Heart, Brain, Download
} from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';

// Composants UI
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

import './Pricing.css';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PHONE_REGEX = /^0[89]\d{8}$/;

// Configuration des plans
const PLANS = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    billing: 'pour toujours',
    description: 'Découvrez l\'écosystème Smartix',
    icon: Shield,
    color: 'from-gray-500 to-gray-600',
    badge: null,
    popular: false,
    features: [
      { text: 'Chat IA (5-10 msg/jour)', included: true, icon: Zap },
      { text: 'Réponses simples', included: true, icon: MessageCircle },
      { text: 'Vendre 1 produit', included: true, icon: ShoppingBag },
      { text: 'Cours de base (Intro)', included: true, icon: BookOpen },
      { text: 'Templates basiques (3)', included: true, icon: FileCode, new: true },
      { text: 'Builds (3/mois)', included: true, icon: Rocket, new: true },
      { text: 'Stockage (50MB)', included: true, icon: Database, new: true },
      { text: 'Accès marketplace (achats)', included: true, icon: ShoppingBag, new: true },
      { text: '1 fork par mois', included: true, icon: Code, new: true },
      { text: 'Profil public de base', included: true, icon: Users, new: true },
      { text: 'Notifications basiques', included: true, icon: Bell, new: true },
      { text: 'Support email (72h)', included: true, icon: Mail, new: true },
      { text: 'Badge "Découvreur"', included: true, icon: Award, new: true },
      { text: 'Upload de fichiers IA', included: false, icon: Cloud },
      { text: 'Contenu Premium/Expert', included: false, icon: Star },
      { text: 'Priorité dans le feed', included: false, icon: TrendingUp },
      { text: 'IA Génération de code', included: false, icon: FileCode },
      { text: 'Analytics avancés', included: false, icon: BarChart }
    ],
    upgradeMessage: '🔥 Passez à Standard pour 100 messages/jour, 10 produits et des templates premium !'
  },
  {
    id: 'monthly',
    name: 'Standard',
    price: 25000,
    billing: '/mois',
    description: 'Le meilleur rapport valeur / prix',
    icon: Zap,
    color: 'from-[#ff6b35] to-[#ff8c61]',
    badge: 'POPULAIRE 🔥',
    popular: true,
    features: [
      { text: 'Chat IA (100 msg/jour)', included: true, icon: Zap },
      { text: 'Upload de fichiers IA', included: true, icon: Cloud },
      { text: 'Vendre jusqu\'à 10 produits', included: true, icon: ShoppingBag },
      { text: 'Tous les cours standards', included: true, icon: BookOpen },
      { text: 'Statistiques de base', included: true, icon: BarChart },
      { text: 'Builds illimités', included: true, icon: Rocket, new: true, highlight: true },
      { text: 'Templates premium (5)', included: true, icon: FileCode, new: true },
      { text: 'Forks illimités', included: true, icon: Code, new: true },
      { text: 'Analytics avancés (7j)', included: true, icon: TrendingUp, new: true },
      { text: 'Badge "Créateur"', included: true, icon: Award, new: true },
      { text: 'Support prioritaire (24h)', included: true, icon: Mail, new: true },
      { text: 'Mise en avant marketplace', included: true, icon: Star, new: true },
      { text: 'Export des données', included: true, icon: Database, new: true },
      { text: 'Favoris illimités', included: true, icon: Heart, new: true },
      { text: 'Accès API basique', included: true, icon: Code, new: true },
      { text: 'IA Avancée (Raisonnement)', included: false, icon: Brain },
      { text: 'Produits illimités', included: false, icon: ShoppingBag },
      { text: 'Mise en avant feed', included: false, icon: TrendingUp },
      { text: 'Stockage illimité', included: false, icon: Database }
    ],
    upgradeMessage: '👑 Passez à Premium pour l\'IA illimitée, les produits illimités et le support 24/7 !'
  },
  {
    id: 'yearly',
    name: 'Premium',
    price: 250000,
    billing: '/an',
    description: 'Exclusivité + Puissance maximale',
    icon: Crown,
    color: 'from-purple-500 to-pink-500',
    badge: 'PUISSANCE MAX',
    popular: false,
    features: [
      { text: 'Chat IA Illimité', included: true, icon: Zap, highlight: true },
      { text: 'IA Avancée & Historique long', included: true, icon: Brain, highlight: true },
      { text: 'Produits illimités & Boost', included: true, icon: ShoppingBag, highlight: true },
      { text: 'Accès TOTAL (Premium/Expert)', included: true, icon: Star, highlight: true },
      { text: 'Téléchargement ressources (PDF)', included: true, icon: Download },
      { text: 'Badge Membre Premium', included: true, icon: Award },
      { text: 'Support prioritaire 24/7', included: true, icon: Mail },
      { text: 'IA Génération de code avancée', included: true, icon: FileCode, new: true, highlight: true },
      { text: 'Templates premium illimités', included: true, icon: FileCode, new: true },
      { text: 'Stockage illimité (10GB)', included: true, icon: Database, new: true },
      { text: 'Analytics avancés (90j)', included: true, icon: TrendingUp, new: true },
      { text: 'Badge "Expert"', included: true, icon: Award, new: true },
      { text: 'Accès API illimité', included: true, icon: Code, new: true },
      { text: 'Mise en avant feed', included: true, icon: Rocket, new: true },
      { text: 'Bêta des nouvelles features', included: true, icon: Gift, new: true },
      { text: 'Certification Smartix', included: true, icon: Award, new: true },
      { text: 'Webinaire mensuel privé', included: true, icon: Users, new: true },
      { text: 'Rapport personnalisé', included: true, icon: BarChart, new: true },
      { text: 'Accès aux stats globales', included: true, icon: TrendingUp, new: true }
    ],
    upgradeMessage: null
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    billing: 'Sur devis',
    description: 'Solutions sur mesure pour équipes',
    icon: Building,
    color: 'from-blue-500 to-cyan-500',
    badge: 'ENTERPRISE',
    popular: false,
    isEnterprise: true,
    features: [
      { text: 'Équipes illimitées', included: true, icon: Users, highlight: true },
      { text: 'SSO / LDAP', included: true, icon: Shield, highlight: true },
      { text: 'SLA 99.9%', included: true, icon: Shield, highlight: true },
      { text: 'Formation sur mesure', included: true, icon: BookOpen, highlight: true },
      { text: 'Déploiement on-premise', included: true, icon: Database, highlight: true },
      { text: 'Support dédié 24/7', included: true, icon: Mail, highlight: true },
      { text: 'API personnalisée', included: true, icon: Code, highlight: true },
      { text: 'Audit de sécurité', included: true, icon: Shield, highlight: true },
      { text: 'Facturation sur mesure', included: true, icon: CreditCard, highlight: true },
      { text: 'Comptes multiples', included: true, icon: Users, highlight: true },
      { text: 'Toutes les fonctionnalités Premium', included: true, icon: Crown }
    ],
    upgradeMessage: null
  }
];

const OPERATORS = [
  { id: 'orange', name: 'Orange Money', code: 'OM' },
  { id: 'airtel', name: 'Airtel Money', code: 'AM' },
  { id: 'mpesa', name: 'M-Pesa', code: 'MP' },
];

// =============================
// HOOK PERSONNALISÉ POUR LES ABONNEMENTS
// =============================
const useSubscription = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getSubscriptionCache, updateSubscriptionCache, clearUserCache } = useGlobalCache();

  const [subscription, setSubscription] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    if (!user) return;

    try {
      if (!force) {
        const cached = getSubscriptionCache(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setSubscription(cached.subscription);
          setPaymentHistory(cached.paymentHistory || []);
          setLoading(false);
          return;
        }
      }

      const [subRes, histRes] = await Promise.all([
        client.get('/subscriptions/status'),
        client.get('/subscriptions/history')
      ]);

      setSubscription(subRes);
      setPaymentHistory(histRes || []);
      setError(null);

      updateSubscriptionCache(user.id, {
        subscription: subRes,
        paymentHistory: histRes || [],
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Error fetching subscription data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, client, getSubscriptionCache, updateSubscriptionCache]);

  const createSubscription = useCallback(async (planId, paymentData = null) => {
    if (!user) throw new Error('Not authenticated');

    const payload = { plan_id: planId };
    if (paymentData && planId !== 'free') {
      payload.payment_method = 'mobile_money';
      payload.operator = paymentData.operator;
      payload.phone_number = paymentData.phoneNumber;
    }

    const response = await client.post('/subscriptions/create', payload);
    await fetchData(true);
    return response;
  }, [user, client, fetchData]);

  const cancelSubscription = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    const response = await client.post('/subscriptions/cancel');
    await fetchData(true);
    return response;
  }, [user, client, fetchData]);

  const clearCache = useCallback(() => {
    if (user) {
      clearUserCache(user.id);
    }
  }, [user, clearUserCache]);

  return {
    subscription,
    paymentHistory,
    loading,
    error,
    fetchData,
    createSubscription,
    cancelSubscription,
    clearCache
  };
};

// =============================
// COMPOSANT MODAL MOBILE MONEY
// =============================
const MobileMoneyModal = ({ isOpen, onClose, plan, onSubmit, processing }) => {
  const [operator, setOperator] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validatePhoneNumber = (number) => PHONE_REGEX.test(number);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    if (!operator) {
      setError('Veuillez choisir un opérateur');
      return;
    }
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Numéro invalide (ex: 08XXXXXXXX ou 09XXXXXXXX)');
      return;
    }
    
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(operator, phoneNumber);
      onClose();
    } catch (err) {
      // Error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-foreground">Paiement Mobile Money</h3>
          <button onClick={handleClose} className="p-1 hover:bg-accent rounded-full transition-all" disabled={submitting}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="bg-accent/30 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Plan choisi</span>
            <span className="text-xl font-black text-foreground">{plan?.name}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-medium text-muted-foreground">Montant</span>
            <span className="text-2xl font-black text-[#ff6b35]">{plan?.price?.toLocaleString()} FC</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Opérateur
            </Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {OPERATORS.map(op => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setOperator(op.id)}
                  disabled={submitting}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    operator === op.id
                      ? 'border-[#ff6b35] bg-[#ff6b35]/10 text-foreground'
                      : 'border-border hover:border-[#ff6b35]/50 text-muted-foreground'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Phone className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-bold">{op.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Numéro de téléphone
            </Label>
            <div className="relative mt-2">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="08XXXXXXXX ou 09XXXXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="pl-12 h-12 bg-background border-border focus:border-[#ff6b35]"
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Format attendu: 08XXXXXXXX ou 09XXXXXXXX (10 chiffres)
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 rounded-xl text-red-500 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white font-black h-12 rounded-xl"
          >
            {submitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Envoi de la demande...
              </>
            ) : (
              'Demander le paiement'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Une demande de confirmation sera envoyée sur votre téléphone. <br />
            Validez sur votre application Mobile Money.
          </p>
        </form>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT CONFIRMATION D'ANNULATION
// =============================
const CancelConfirmDialog = ({ isOpen, onClose, onConfirm, processing }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent className="bg-card border-border rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-foreground">Annuler l'abonnement ?</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          Êtes-vous sûr de vouloir annuler votre abonnement ? Vous perdrez l'accès aux fonctionnalités premium.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-secondary text-foreground hover:bg-accent">
          Non, garder
        </AlertDialogCancel>
        <AlertDialogAction 
          onClick={onConfirm}
          disabled={processing}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          {processing ? <Loader className="w-4 h-4 animate-spin mr-2" /> : null}
          Oui, annuler
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// =============================
// COMPOSANT FEATURE ITEM
// =============================
const FeatureItem = ({ feature }) => {
  const Icon = feature.icon;
  
  return (
    <div className="flex items-start gap-3">
      {feature.included ? (
        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-3.5 h-3.5 ${feature.included ? 'text-muted-foreground' : 'text-muted-foreground/30'}`} />}
          <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground/50'} ${feature.highlight ? 'font-bold text-[#ff6b35]' : ''}`}>
            {feature.text}
          </span>
          {feature.new && (
            <span className="px-1.5 py-0.5 bg-[#ff6b35]/20 text-[#ff6b35] text-[9px] font-black rounded-full uppercase tracking-wider">
              Nouveau
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PLAN CARD
// =============================
const PlanCard = ({ plan, isCurrentPlan, onSelect, processing, selectedPlanId }) => {
  const Icon = plan.icon;
  const isSelectedPlan = selectedPlanId === plan.id;
  const [isHovered, setIsHovered] = useState(false);
  const isEnterprise = plan.isEnterprise;

  
  // Filtrer les features (afficher les plus importantes d'abord)
  const displayedFeatures = plan.features
    .filter(f => f.included)
    .slice(0, isEnterprise ? 8 : 10);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        isCurrentPlan ? 'ring-2 ring-[#ff6b35] scale-[1.02]' : 'hover:scale-[1.01]'
      } ${plan.popular ? 'hover:shadow-2xl hover:shadow-[#ff6b35]/20' : ''} ${
        isEnterprise ? 'hover:shadow-2xl hover:shadow-blue-500/20' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`bg-gradient-to-br ${plan.color} p-0.5`}>
        <Card className="bg-card border-0 rounded-2xl overflow-hidden h-full flex flex-col">
          {plan.badge && (
            <div className="absolute top-4 right-4">
              <div className={`text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg animate-pulse ${
                plan.id === 'enterprise' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-r from-[#ff6b35] to-[#ff8c61]'
              }`}>
                {plan.badge}
              </div>
            </div>
          )}

          <div className="p-8 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground">{plan.name}</h3>
                {plan.popular && (
                  <span className="text-xs text-[#ff6b35] font-black">⭐ Recommandé</span>
                )}
              </div>
            </div>

            <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>

            <div className="mb-6">
              {plan.isEnterprise ? (
                <button
                  onClick={() => window.location.href = 'mailto:enterprise@smartix.com?subject=Demande%20devis%20Enterprise'}
                  className="text-2xl font-black text-blue-500 hover:text-blue-600 transition-colors"
                >
                  Sur devis →
                </button>
              ) : (
                <>
                  <span className="text-4xl font-black text-foreground">{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground"> {plan.billing}</span>
                </>
              )}
            </div>

            {!plan.isEnterprise && (
              <Button
                onClick={() => onSelect(plan.id)}
                disabled={isCurrentPlan || processing}
                className={`w-full font-black rounded-xl h-12 transition-all ${
                  isCurrentPlan
                    ? 'bg-green-500/20 text-green-500 border border-green-500/30 cursor-default'
                    : `bg-gradient-to-r ${plan.color} hover:from-[#ff6b35]/90 hover:to-[#ff8c61]/90 text-white hover:scale-105`
                } ${isSelectedPlan && processing ? 'opacity-70' : ''}`}
              >
                {isSelectedPlan && processing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    Traitement...
                  </>
                ) : isCurrentPlan ? (
                  <><Check className="w-4 h-4 mr-2" /> Plan actuel</>
                ) : (
                  plan.price === 0 ? 'Commencer gratuitement' : 'S\'abonner'
                )}
              </Button>
            )}

            {plan.isEnterprise && (
              <Button
                onClick={() => window.location.href = 'mailto:enterprise@smartix.com?subject=Demande%20devis%20Enterprise'}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-black rounded-xl h-12"
              >
                Contacter les ventes
              </Button>
            )}

            {plan.upgradeMessage && isCurrentPlan && plan.id !== 'enterprise' && (
              <div className="mt-4 p-3 bg-blue-500/10 rounded-xl">
                <p className="text-xs text-blue-500 font-medium flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {plan.upgradeMessage}
                </p>
              </div>
            )}

            <div className="mt-8 space-y-3">
              {displayedFeatures.map((feature, idx) => (
                <FeatureItem key={idx} feature={feature} />
              ))}
              {plan.features.filter(f => f.included).length > displayedFeatures.length && (
                <p className="text-xs text-muted-foreground pt-2">
                  + {plan.features.filter(f => f.included).length - displayedFeatures.length} autres fonctionnalités
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showMobileMoney, setShowMobileMoney] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const {
    subscription,
    paymentHistory,
    loading,
    fetchData,
    createSubscription,
    cancelSubscription,
    clearCache
  } = useSubscription();

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =============================
  // PLAN ACTUEL (mémorisé)
  // =============================
  const currentPlanId = subscription?.plan_id || 'free';
  const currentPlan = useMemo(
    () => PLANS.find(p => p.id === currentPlanId),
    [currentPlanId]
  );

  // =============================
  // INITIER PAIEMENT
  // =============================
  const handleSelectPlan = useCallback(async (planId) => {
    if (processing) return;
    
    const plan = PLANS.find(p => p.id === planId);
    if (plan.isEnterprise) {
      // Rediriger vers contact commercial
      window.location.href = 'mailto:enterprise@smartix.com?subject=Demande%20devis%20Enterprise';
      return;
    }
    
    if (plan.price === 0) {
      setProcessing(true);
      setSelectedPlan(plan);
      try {
        await createSubscription(planId);
        toast.success('Plan gratuit activé !');
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Erreur lors de l\'activation');
      } finally {
        setProcessing(false);
        setSelectedPlan(null);
      }
    } else {
      setSelectedPlan(plan);
      setShowMobileMoney(true);
    }
  }, [processing, createSubscription]);

  // =============================
  // PAIEMENT MOBILE MONEY
  // =============================
  const handleMobileMoneyPayment = useCallback(async (operator, phoneNumber) => {
    if (processing) return;
    setProcessing(true);
    try {
      await createSubscription(selectedPlan.id, { operator, phoneNumber });
      toast.success('Demande de paiement envoyée ! Confirmez sur votre téléphone.');
      setShowMobileMoney(false);
      setSelectedPlan(null);
    } catch (err) {
      console.error('Error subscribing:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors du paiement');
    } finally {
      setProcessing(false);
    }
  }, [processing, selectedPlan, createSubscription]);

  // =============================
  // ANNULER ABONNEMENT
  // =============================
  const handleCancelSubscription = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await cancelSubscription();
      toast.success('Abonnement annulé');
    } catch (err) {
      console.error('Error canceling:', err);
      toast.error('Erreur lors de l\'annulation');
    } finally {
      setProcessing(false);
      setShowCancelDialog(false);
    }
  }, [processing, cancelSubscription]);

  // =============================
  // NETTOYAGE CACHE AU LOGOUT
  // =============================
  useEffect(() => {
    return () => {
      if (!user) {
        clearCache();
      }
    };
  }, [user, clearCache]);

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-12 h-12 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  const isActive = subscription && subscription.status === 'active';

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-foreground mb-4">
            Gestion des <span className="text-[#ff6b35]">Abonnements</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Débloquez tout le potentiel de Smartix avec nos formules flexibles
          </p>
        </div>

        {/* Statut actuel */}
        {isActive && currentPlanId !== 'free' && (
          <div className="mb-8 p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-black text-foreground">Plan actif</h3>
                <p className="text-2xl font-black text-green-500">
                  {currentPlan?.name}
                </p>
                {subscription?.expiry_date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Expire le {new Date(subscription.expiry_date).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
              <div className="px-4 py-2 bg-green-500/20 rounded-full">
                <span className="text-green-500 font-black text-sm uppercase tracking-wider">Actif</span>
              </div>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={currentPlanId === plan.id}
              onSelect={handleSelectPlan}
              processing={processing}
              selectedPlanId={selectedPlan?.id}
            />
          ))}
        </div>

        {/* Annulation abonnement */}
        {isActive && currentPlanId !== 'free' && !PLANS.find(p => p.id === currentPlanId)?.isEnterprise && (
          <div className="text-center mb-12">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              disabled={processing}
              className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-600"
            >
              Annuler l'abonnement
            </Button>
          </div>
        )}

        {/* Historique des paiements */}
        {paymentHistory.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl font-black text-foreground mb-6">Historique des paiements</h3>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 bg-accent/30 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <div>Date</div>
                <div>Plan</div>
                <div>Montant</div>
                <div>Statut</div>
              </div>
              {paymentHistory.map((payment, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-4 p-4 border-t border-border text-sm">
                  <div className="text-foreground">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</div>
                  <div className="text-foreground">{PLANS.find(p => p.id === payment.plan_id)?.name}</div>
                  <div className="font-bold text-[#ff6b35]">{payment.amount.toLocaleString()} FC</div>
                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      payment.status === 'success' 
                        ? 'bg-green-500/20 text-green-500' 
                        : payment.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {payment.status === 'success' ? 'Réussi' : payment.status === 'pending' ? 'En attente' : 'Échoué'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Mobile Money */}
      <MobileMoneyModal
        isOpen={showMobileMoney}
        onClose={() => {
          setShowMobileMoney(false);
          setSelectedPlan(null);
        }}
        plan={selectedPlan}
        onSubmit={handleMobileMoneyPayment}
        processing={processing}
      />

      {/* Dialog confirmation annulation */}
      <CancelConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelSubscription}
        processing={processing}
      />
    </div>
  );
};

Pricing.propTypes = {};

export default Pricing;
MobileMoneyModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  plan: PropTypes.any.isRequired,
  onSubmit: PropTypes.func.isRequired,
  processing: PropTypes.bool.isRequired,
};
CancelConfirmDialog.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  processing: PropTypes.bool.isRequired,
};
FeatureItem.propTypes = {
  feature: PropTypes.any.isRequired,
};
PlanCard.propTypes = {
  plan: PropTypes.any.isRequired,
  isCurrentPlan: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  processing: PropTypes.bool.isRequired,
  selectedPlanId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
