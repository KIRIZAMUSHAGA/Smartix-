// frontend/src/pages/Landing/components/HeroSection.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronRight, Brain, TrendingUp, Users, BookOpen } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import PropTypes from 'prop-types';

const HeroSection = ({ onRegisterClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-x-hidden pt-0 mt-0">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-0 w-[500px] h-[500px] bg-[#ff6b35]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-0">
        <div className="flex flex-col items-center justify-center max-w-6xl mx-auto">
          <div className="text-center space-y-4 sm:space-y-8 animate-slideUp max-w-4xl px-2">
            
            {/* ✅ BADGE OPTIMISÉ */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-xs sm:text-sm backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-[#ff6b35]" />
              <span className="font-medium text-white/80 tracking-wide uppercase text-[10px]">
                Apprendre • Créer • Partager • Vendre
              </span>
            </div>

            {/* ✅ TITRE ULTRA STRATÉGIQUE */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight">
              Apprends. Crée. Partage. Vends.
              <span className="block mt-1 sm:mt-2 text-[#ff6b35] italic">
                La plateforme tout-en-un des créateurs 
              </span>

            </h1>

            {/* ✅ DESCRIPTION OPTIMISÉE */}
            <p className="text-sm sm:text-lg md:text-xl text-white/50 leading-relaxed max-w-2xl mx-auto">
              Apprends en pratiquant, crée des projets concrets,
              <br />
              partage avec la communauté et monétise ton travail —
              <br />
              tout au même endroit.
            </p>

            {/* ✅ MICRO-FLOW (Apprendre → Créer → Partager → Gagner) */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
              <span className="text-[#ff6b35]">Apprendre</span>
              <ChevronRight className="w-3 h-3 text-white/30" />
              <span className="text-blue-400">Créer</span>
              <ChevronRight className="w-3 h-3 text-white/30" />
              <span className="text-purple-400">Partager</span>
              <ChevronRight className="w-3 h-3 text-white/30" />
              <span className="text-green-400">Gagner</span>
            </div>

            {/* ✅ CTA OPTIMISÉS */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center pt-4">
              <Button
                onClick={(e) => { console.log('[SIGNUP_FLOW] click detected — source: HeroSection CTA button'); onRegisterClick(e); }}
                size="lg"
                className="text-white shadow-2xl px-10 py-7 text-lg rounded-2xl font-black transition-all hover:scale-105 w-full sm:w-auto"
                style={{ backgroundColor: '#ff6b35', boxShadow: '0 25px 50px -12px rgba(255,107,53,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ff8c61'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ff6b35'}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Commencer gratuitement
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const featuresSection = document.getElementById('features');
                  if (featuresSection) {
                    featuresSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white px-10 py-7 text-lg rounded-2xl font-bold backdrop-blur-md w-full sm:w-auto transition-all hover:scale-105 active:scale-95"
              >
                <ChevronRight className="w-5 h-5 mr-2" />
                Voir comment ça marche
              </Button>
            </div>

            {/* ✅ MICRO-CONFIANCE (Gratuit • Sans carte bancaire) */}
            <div className="flex items-center justify-center gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-green-400" />
                Gratuit
              </span>
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Sans carte bancaire
              </span>
            </div>

            {/* ✅ NOUVELLES STATS (qualitatives au lieu de quantitatives) */}
            <div className="flex flex-col xs:flex-row flex-wrap gap-6 sm:gap-12 pt-8 justify-center border-t border-white/10 mt-4 pt-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff6b35]/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#ff6b35]" />
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">Projets publiés</div>
                  <div className="text-white/40 text-xs">chaque jour</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">Créateurs actifs</div>
                  <div className="text-white/40 text-xs">dans la communauté</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left">
                  <div className="text-white font-bold text-sm">Ressources</div>
                  <div className="text-white/40 text-xs">en expansion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

HeroSection.propTypes = {
  onRegisterClick: PropTypes.func.isRequired,
};

export default HeroSection;
