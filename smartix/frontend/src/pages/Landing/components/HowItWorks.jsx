// frontend/src/pages/Landing/components/HowItWorks.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, BookOpen, Sparkles, Star, ArrowRight, Zap, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import PropTypes from 'prop-types';

// =============================
// ✅ ÉTAPES OPTIMISÉES - VERSION EXPERT
// =============================
const STEPS = [
  {
    step: "1",
    icon: User,
    title: "Crée ton compte",
    description: "Inscris-toi gratuitement en quelques secondes. Aucun engagement, accès immédiat.",
    color: "from-[#00B894] to-[#00D2A5]",
    delay: "0s",
    hoverEffect: "hover:shadow-[0_20px_40px_-15px_rgba(0,184,148,0.3)]"
  },
  {
    step: "2",
    icon: BookOpen,
    title: "Apprends et maîtrise des compétences",
    description: "Suis des cours interactifs, fais des exercices et progresse avec l'aide de l'IA.",
    color: "from-[#0984E3] to-[#74B9FF]",
    delay: "0.1s",
    hoverEffect: "hover:shadow-[0_20px_40px_-15px_rgba(9,132,227,0.3)]"
  },
  {
    step: "3",
    icon: Sparkles,
    title: "Crée des projets concrets",
    description: "Applique ce que tu apprends en construisant des projets réels. Code, design, rédaction...",
    color: "from-purple-500 to-pink-500",
    delay: "0.2s",
    hoverEffect: "hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.3)]"
  },
  {
    step: "4",
    icon: Star,
    title: "Publie, partage et génère des revenus",
    description: "Partage tes projets, reçois des retours de la communauté et commence à gagner de l'argent.",
    color: "from-orange-500 to-[#ff6b35]",
    delay: "0.3s",
    hoverEffect: "hover:shadow-[0_20px_40px_-15px_rgba(255,107,53,0.3)]"
  }
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const HowItWorks = ({ onRegisterClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="pt-24 pb-6 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre avec badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-6 animate-pulse-slow">
            <Zap className="w-4 h-4 text-[#ff6b35]" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Le processus Smartix</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Apprends, <span className="gradient-text">crée et gagne</span> en 4 étapes
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Une méthode simple pour apprendre, créer et générer des revenus
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-4 gap-6 relative mt-12">
          {/* ✅ LIGNE DE CONNEXION AVEC ANIMATION */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 overflow-hidden" style={{ transform: 'translateY(-50%)' }}>
            <div className="w-full h-full bg-gradient-to-r from-[#00B894] via-[#0984E3] to-orange-500 animate-gradient-x opacity-30" />
          </div>
          
          {STEPS.map((step, index) => (
            <div 
              key={index} 
              className={`relative group transition-all duration-500 ${step.hoverEffect}`}
              style={{ animationDelay: step.delay }}
            >
              {/* ✅ CARTE AVEC ANIMATION AU HOVER (translation + scale) */}
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-lg transition-all duration-500 hover:translate-y-[-8px] hover:scale-[1.02] hover:bg-white/10 relative z-10 h-full">
                {/* Step Number (floating) avec pulse au hover */}
                <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg z-20 group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-white font-bold text-sm">{step.step}</span>
                </div>
                
                {/* Icon avec animation au hover */}
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${step.color} bg-opacity-20 flex items-center justify-center mb-5 mx-auto shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                
                {/* Title */}
                <h3 className="text-lg font-bold text-white mb-3 text-center group-hover:text-[#ff6b35] transition-colors duration-300">
                  {step.title}
                </h3>
                
                {/* Description */}
                <p className="text-white/60 text-sm text-center leading-relaxed group-hover:text-white/80 transition-colors duration-300">
                  {step.description}
                </p>
                
                {/* ✅ FLÈCHE D'INDICATION ANIMÉE */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1">
                  <ArrowRight className="w-4 h-4 text-[#ff6b35]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ✅ MICRO-PHRASE DE BOUCLE (très important pour l'UX) */}
        <div className="text-center mt-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-sm">
            <RefreshCw className="w-4 h-4 text-[#ff6b35] animate-spin-slow" />
            <span className="text-xs text-white/50">
              Et recommence la boucle pour progresser encore plus
            </span>
          </div>
        </div>

        {/* ✅ CTA OPTIMISÉ - Version "Créer mon compte gratuitement" */}
        <div className="text-center mt-12 flex flex-col items-center gap-4">
          <Button
            onClick={(e) => { console.log('[SIGNUP_FLOW] click detected — source: HowItWorks button'); onRegisterClick(e); }}
            size="lg"
            className="btn-modern bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff8c61] hover:to-[#ff6b35] text-white shadow-lg hover:shadow-xl px-8 py-6 text-lg rounded-2xl font-bold transition-all duration-300 hover:scale-105 group"
          >
            <User className="w-5 h-5 mr-2 group-hover:animate-bounce" />
            Créer mon compte gratuitement
          </Button>
          <div className="flex items-center gap-2 text-sm text-white/40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6-4h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4V8a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Aucune carte bancaire requise • Accès immédiat • Annulation à tout moment</span>
          </div>
        </div>

        {/* ✅ Badges de confiance additionnels */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 text-center">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">Accès illimité</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">Progression visible</span>
          </div>
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">Monétise ton travail</span>
          </div>
        </div>
      </div>

      {/* ✅ STYLES D'ANIMATION */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease-in-out infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

HowItWorks.propTypes = {
  onRegisterClick: PropTypes.func.isRequired,
};

export default HowItWorks;
