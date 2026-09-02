import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { Brain, ArrowLeft, Shield, Zap, Crown, CheckCircle2, MessageSquare, FileText, Settings, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONFIGURATION DES PLANS (mémorisée)
// =============================
const PLAN_INFO = {
  'Gratuit': {
    icon: Shield,
    iconColor: 'text-gray-400',
    gradient: 'from-gray-500/20 to-gray-700/20',
    textColor: 'text-gray-400',
    description: 'Idéal pour découvrir les capacités de l\'IA et poser quelques questions rapides chaque jour.',
    features: [
      '20 messages par jour',
      'Accès au modèle GPT-4o-mini',
      'Historique des discussions',
      'Support standard'
    ]
  },
  'Standard': {
    icon: Zap,
    iconColor: 'text-indigo-400',
    gradient: 'from-indigo-500/20 to-purple-500/20',
    textColor: 'text-indigo-400',
    description: 'Pour les étudiants et professionnels ayant besoin d’une assistance régulière et de l’analyse de fichiers.',
    features: [
      '120 messages par jour',
      'Analyse de fichiers (PDF, Images)',
      'Modèle haute performance GPT-4o',
      'Historique illimité',
      'Accès prioritaire'
    ]
  },
  'Premium': {
    icon: Crown,
    iconColor: 'text-amber-400',
    gradient: 'from-amber-500/20 to-orange-500/20',
    textColor: 'text-amber-400',
    description: 'Le plan ultime pour une productivité sans limites. Accès total à toutes les fonctionnalités avancées.',
    features: [
      'Messages illimités',
      'Analyses de fichiers complexes',
      'Modèle GPT-4o sans restriction',
      'Support VIP 24/7',
      'Nouvelles fonctionnalités en avant-première'
    ]
  }
};

// =============================
// 2️⃣ COMPOSANT DE CHARGEMENT
// =============================
const LoadingSpinner = () => (
  <div className="h-screen bg-[#212121] flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
  </div>
);

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================
const AIProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ Hook personnalisé
  const { client } = useApiClient(); // ✅ Client API
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Chargement des limites
  const fetchLimits = useCallback(async () => {
    try {
      setError(null);
      const response = await client.get('/subscriptions/limits');
      setLimits(response.data);
    } catch (error) {
      console.error('Failed to fetch limits:', error);
      setError(error.response?.data?.detail || 'Erreur de chargement');
      toast.error('Erreur de chargement', {
        description: 'Impossible de récupérer les informations d\'abonnement'
      });
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  // ✅ Plan actuel (mémorisé)
  const planName = limits?.plan_name || 'Gratuit';
  const currentPlan = useMemo(() => PLAN_INFO[planName] || PLAN_INFO['Gratuit'], [planName]);
  const CurrentPlanIcon = currentPlan.icon;

  // ✅ Affichage du nombre de messages
  const messagesDisplay = useMemo(() => {
    if (!limits) return 'Chargement...';
    if (limits.ai_messages_per_day === 99999) return 'ILLIMITÉ';
    return `${limits.ai_messages_per_day} messages`;
  }, [limits]);

  if (loading) return <LoadingSpinner />;

  // ✅ Fallback si erreur
  if (error && !limits) {
    return (
      <div className="min-h-screen bg-[#171717] text-white font-sans pb-20">
        <div className="sticky top-0 z-30 bg-[#171717]/80 backdrop-blur-lg border-b border-white/5 px-4 h-16 flex items-center justify-center relative">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-white/5 absolute left-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg text-center">Profil IA & Abonnement</h1>
        </div>
        <div className="max-w-xl mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Erreur de chargement</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <Button onClick={fetchLimits} className="bg-[#ff6b35] hover:bg-[#ff8c61]">
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#171717] text-white font-sans pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#171717]/80 backdrop-blur-lg border-b border-white/5 px-4 h-16 flex items-center justify-center relative">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)} 
          className="rounded-full hover:bg-white/5 absolute left-4 transition-all"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg text-center">Profil IA & Abonnement</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        {/* User Profile Card */}
        <div className="bg-[#212121] rounded-[2.5rem] p-8 border border-white/5 mb-8 shadow-2xl relative overflow-hidden group hover:shadow-indigo-500/10 transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold shadow-2xl mb-6 ring-4 ring-white/5">
              {user?.full_name?.[0] || user?.username?.[0] || 'U'}
            </div>
            <h2 className="text-2xl font-black mb-1">{user?.full_name || user?.username || 'Utilisateur'}</h2>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-6">Compte Personnel</p>
            
            <div className={`px-4 py-1.5 rounded-full border bg-white/5 flex items-center gap-2 ${currentPlan.textColor}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-tighter">Plan {planName}</span>
            </div>
          </div>
        </div>

        {/* Current Plan Details */}
        <div className={`bg-gradient-to-br ${currentPlan.gradient} rounded-[2.5rem] p-8 border border-white/10 mb-8`}>
          <div className="flex items-center gap-6 mb-6">
            <div className="p-4 bg-white/5 rounded-2xl shadow-xl">
              <CurrentPlanIcon className={`w-12 h-12 ${currentPlan.iconColor}`} />
            </div>
            <div>
              <h3 className="text-xl font-black mb-1">Détails du Plan</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{currentPlan.description}</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 px-1">Ce que vous avez :</h4>
            <div className="grid grid-cols-1 gap-3">
              {currentPlan.features.map((feature, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 transition-all hover:translate-x-1 hover:bg-white/10"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/20 rounded-2xl p-4 flex items-center justify-between border border-white/5">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-bold text-gray-300">Usage Quotidien</span>
            </div>
            <span className="text-sm font-black text-white">{messagesDisplay}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-4">
          <Button 
            className="w-full h-16 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-black text-lg rounded-[1.5rem] shadow-xl transition-all active:scale-95"
            onClick={() => navigate('/pricing')}
          >
            Changer de plan
          </Button>
          <p className="text-center text-gray-600 text-[10px] font-bold uppercase tracking-widest">
            Le changement de plan est effectif immédiatement
          </p>
        </div>
      </div>
    </div>
  );
};

AIProfilePage.propTypes = {};

export default AIProfilePage;
LoadingSpinner.propTypes = {};
