// frontend/src/pages/Landing/components/CTASection.jsx
import React from 'react';
import { Button } from '../../../components/ui/button';
import { Sparkles, Lock, Shield, Rocket, TrendingUp, Users, ArrowRight, CheckCircle, School, Brain } from 'lucide-react';
import PropTypes from 'prop-types';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CTASection = ({ onRegisterClick }) => {
  return (
    <div className="py-12 bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white relative overflow-hidden">
      {/* Effets de fond */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl animate-pulse animation-delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#ff6b35] rounded-full blur-3xl opacity-20 animate-pulse" />
      </div>

      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        {/* Icône principale */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm mb-4 animate-bounce-slow">
          <Rocket className="w-7 h-7 text-white" />
        </div>

        {/* Titre */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 leading-tight">
          Prêt à apprendre, créer et <span className="text-[#ff6b35]">générer tes premiers revenus</span> ?
        </h2>

        {/* Sous-titre */}
        <p className="text-lg mb-5 opacity-90 max-w-2xl mx-auto">
          Rejoins les premiers étudiants sur Smartix. Commence maintenant avant que tout le monde arrive.
        </p>

        {/* Boutons CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Button
            data-testid="cta-join-btn"
            onClick={(e) => { console.log('[SIGNUP_FLOW] click detected — source: CTASection button'); onRegisterClick(e); }}
            size="lg"
            className="bg-white text-[#00B894] hover:bg-gray-50 shadow-xl hover:shadow-2xl px-8 py-5 text-base rounded-2xl font-bold transition-all duration-300 hover:scale-105 group"
          >
            <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
            Créer mon compte gratuitement
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm px-6 py-5 text-base rounded-2xl font-semibold transition-all duration-300 hover:scale-105"
          >
            <Users className="w-5 h-5 mr-2" />
            Voir comment ça marche
          </Button>
        </div>

        {/* Badges de confiance */}
        <div className="flex flex-wrap justify-center gap-4 text-sm mb-5">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
            <Lock className="w-4 h-4" />
            <span>Aucune carte bancaire</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
            <CheckCircle className="w-4 h-4" />
            <span>Accès immédiat</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
            <TrendingUp className="w-4 h-4" />
            <span>Gagne dès maintenant</span>
          </div>
        </div>

        {/* Preuve sociale */}
        <div className="pt-4 border-t border-white/20">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <School className="w-4 h-4 text-white" />
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <Users className="w-4 h-4 text-white" />
                </div>
              </div>
              <span className="text-xs text-white/70">
                Utilisé par les élèves du <strong>Lycée Hélène de Chappotin</strong>
              </span>
            </div>
            <div className="w-px h-6 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff6b35]" />
              <span className="text-xs text-white/70">
                Partenaire pédagogique – élèves actifs sur la plateforme
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Styles d'animation */}
      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};

CTASection.propTypes = {
  onRegisterClick: PropTypes.func.isRequired,
};

export default CTASection;
