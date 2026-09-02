// frontend/src/pages/Landing/components/FeaturesCarousel.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, BookOpen, Brain, Users, ShoppingBag, Sparkles, Target, MessageCircle, TrendingUp, Award, Zap } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import PropTypes from 'prop-types';

// =============================
// ✅ 4 PILIERS STRATÉGIQUES (Learn → Create → Share → Sell)
// =============================
const CORE_PILLARS = [
  {
    icon: BookOpen,
    title: "Apprentissage interactif",
    description: "Cours, exercices et progression pour apprendre en pratiquant.",
    color: "border-[#ff6b35]/50",
    bg: "bg-[#ff6b35]/20",
    iconColor: "text-[#ff6b35]",
    order: 1,
    narrativeStep: "Apprendre"
  },
  {
    icon: Target,
    title: "Création de projets",
    description: "Construis des projets concrets et développe tes compétences.",
    color: "border-blue-500/50",
    bg: "bg-blue-500/20",
    iconColor: "text-blue-500",
    order: 2,
    narrativeStep: "Créer"
  },
  {
    icon: Users,
    title: "Communauté active",
    description: "Partage, échange et collabore avec d'autres créateurs.",
    color: "border-purple-500/50",
    bg: "bg-purple-500/20",
    iconColor: "text-purple-500",
    order: 3,
    narrativeStep: "Partager"
  },
  {
    icon: ShoppingBag,
    title: "Génération de revenus",
    description: "Vends tes projets, templates et ressources numériques.",
    color: "border-green-500/50",
    bg: "bg-green-500/20",
    iconColor: "text-green-500",
    order: 4,
    narrativeStep: "Gagner"
  }
];

// =============================
// ✅ DÉTAILS UX (CAROUSEL PRINCIPAL)
// =============================
const UX_DETAILS = [
  {
    icon: Brain,
    title: "Assistant IA",
    description: "Un assistant pour t'aider à apprendre, créer et avancer plus vite.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Sparkles,
    title: "Gamification & progression",
    description: "Niveaux, badges et défis pour rester motivé.",
    color: "from-green-500 to-teal-500"
  },
  {
    icon: MessageCircle,
    title: "Messagerie & collaboration",
    description: "Discute avec d'autres créateurs et travaille en équipe.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: TrendingUp,
    title: "Suivi de progression",
    description: "Visualise tes progrès et célèbre tes réussites.",
    color: "from-orange-500 to-red-500"
  },
  {
    icon: Award,
    title: "Certification",
    description: "Valide tes compétences avec des certificats reconnus.",
    color: "from-yellow-500 to-orange-500"
  },
  {
    icon: Zap,
    title: "Projets en temps réel",
    description: "Crée et partage tes projets instantanément.",
    color: "from-cyan-500 to-blue-500"
  }
];

const PILLAR_CARD_WIDTH = 320;
const PILLAR_AUTO_PLAY = 4000;

const FeaturesCarousel = ({ onRegisterClick }) => {
  const navigate = useNavigate();

  // =============================
  // CAROUSEL UX DETAILS
  // =============================
  const carouselRef = useRef(null);
  const [activeUX, setActiveUX] = useState(0);
  const [isUXHovering, setIsUXHovering] = useState(false);
  const uxAutoPlayRef = useRef(null);

  const scrollUX = useCallback((direction) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -320 : 320,
        behavior: 'smooth'
      });
      setActiveUX(prev =>
        direction === 'left'
          ? Math.max(0, prev - 1)
          : Math.min(UX_DETAILS.length - 1, prev + 1)
      );
    }
  }, []);

  const scrollUXTo = useCallback((index) => {
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: index * 320, behavior: 'smooth' });
      setActiveUX(index);
    }
  }, []);

  const goToNextUX = useCallback(() => scrollUX('right'), [scrollUX]);

  const handleUXScroll = useCallback((e) => {
    const newIndex = Math.round(e.target.scrollLeft / 320);
    if (newIndex !== activeUX && newIndex >= 0 && newIndex < UX_DETAILS.length) {
      setActiveUX(newIndex);
    }
  }, [activeUX]);

  useEffect(() => {
    if (uxAutoPlayRef.current) clearInterval(uxAutoPlayRef.current);
    if (!isUXHovering) {
      uxAutoPlayRef.current = setInterval(() => {
        if (activeUX < UX_DETAILS.length - 1) {
          goToNextUX();
        } else {
          scrollUXTo(0);
        }
      }, 4000);
    }
    return () => { if (uxAutoPlayRef.current) clearInterval(uxAutoPlayRef.current); };
  }, [isUXHovering, activeUX, goToNextUX, scrollUXTo]);

  // =============================
  // CAROUSEL DES 4 PILIERS
  // =============================
  const pillarsRef = useRef(null);
  const [activePillar, setActivePillar] = useState(0);
  const [isPillarsHovering, setIsPillarsHovering] = useState(false);
  const autoPlayRef = useRef(null);

  const scrollPillar = useCallback((direction) => {
    if (pillarsRef.current) {
      pillarsRef.current.scrollBy({
        left: direction === 'left' ? -PILLAR_CARD_WIDTH : PILLAR_CARD_WIDTH,
        behavior: 'smooth'
      });
      setActivePillar(prev =>
        direction === 'left'
          ? Math.max(0, prev - 1)
          : Math.min(CORE_PILLARS.length - 1, prev + 1)
      );
    }
  }, []);

  const scrollPillarTo = useCallback((index) => {
    if (pillarsRef.current) {
      pillarsRef.current.scrollTo({ left: index * PILLAR_CARD_WIDTH, behavior: 'smooth' });
      setActivePillar(index);
    }
  }, []);

  const goToNextPillar = useCallback(() => scrollPillar('right'), [scrollPillar]);

  const handlePillarScroll = useCallback((e) => {
    const newIndex = Math.round(e.target.scrollLeft / PILLAR_CARD_WIDTH);
    if (newIndex !== activePillar && newIndex >= 0 && newIndex < CORE_PILLARS.length) {
      setActivePillar(newIndex);
    }
  }, [activePillar]);

  useEffect(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    if (!isPillarsHovering) {
      autoPlayRef.current = setInterval(() => {
        if (activePillar < CORE_PILLARS.length - 1) {
          goToNextPillar();
        } else {
          scrollPillarTo(0);
        }
      }, PILLAR_AUTO_PLAY);
    }
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [isPillarsHovering, activePillar, goToNextPillar, scrollPillarTo]);

  return (
    <div id="features" className="py-16 bg-[#0f172a] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ✅ TITRE OPTIMISÉ (avec "partager") */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Tout pour <span className="text-[#ff6b35]">apprendre, créer, partager et générer des revenus</span>
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto text-lg">
            Apprends en pratiquant, crée des projets concrets,
            partage avec la communauté et transforme tes compétences en revenus.
          </p>
        </div>

        {/* ✅ NARRATIVE FLOW VISUAL (Apprendre → Créer → Partager → Gagner) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 mb-12">
          {CORE_PILLARS.map((pillar, idx) => (
            <React.Fragment key={pillar.order}>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-full ${pillar.bg} flex items-center justify-center`}>
                  <pillar.icon className={`w-6 h-6 ${pillar.iconColor}`} />
                </div>
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  {pillar.narrativeStep}
                </span>
              </div>
              {idx < CORE_PILLARS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-white/20 hidden sm:block" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ✅ CAROUSEL DES 4 PILIERS */}
        <div
          className="relative mb-16"
          onMouseEnter={() => setIsPillarsHovering(true)}
          onMouseLeave={() => setIsPillarsHovering(false)}
        >
          <div
            ref={pillarsRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-8"
            style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
            onScroll={handlePillarScroll}
          >
            {CORE_PILLARS.map((pillar) => (
              <div
                key={pillar.order}
                className={`min-w-[280px] sm:min-w-[320px] w-[280px] sm:w-[320px] p-8 rounded-[32px] bg-white/5 border border-white/10 hover:${pillar.color} transition-all duration-300 group cursor-pointer text-center snap-start hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className={`w-14 h-14 rounded-xl ${pillar.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform mx-auto`}>
                  <pillar.icon className={`w-7 h-7 ${pillar.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{pillar.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>

          {/* Boutons de navigation */}
          <button
            onClick={() => scrollPillar('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 z-10 border border-gray-200 hidden md:flex"
            aria-label="Pilier précédent"
          >
            <ChevronRight className="w-6 h-6 text-[#ff6b35] rotate-180" />
          </button>
          <button
            onClick={() => scrollPillar('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 z-10 border border-gray-200 hidden md:flex"
            aria-label="Pilier suivant"
          >
            <ChevronRight className="w-6 h-6 text-[#ff6b35]" />
          </button>

          {/* Dots indicateurs */}
          <div className="flex justify-center gap-2 mt-2">
            {CORE_PILLARS.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollPillarTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activePillar === index
                    ? 'w-6 bg-[#ff6b35]'
                    : 'w-2 bg-white/30 hover:bg-[#ff6b35]/50'
                }`}
                aria-label={`Aller au pilier ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ✅ CAROUSEL UX AVEC TITRE OPTIMISÉ */}
        <div
          className="relative mt-8"
          onMouseEnter={() => setIsUXHovering(true)}
          onMouseLeave={() => setIsUXHovering(false)}
        >
          <h3 className="text-2xl font-bold text-white text-center mb-8">
            Des outils pour apprendre, créer et progresser plus vite
          </h3>

          <div
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-8"
            style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
            onScroll={handleUXScroll}
          >
            {UX_DETAILS.map((feature, index) => (
              <div
                key={index}
                className="min-w-[280px] sm:min-w-[320px] w-[280px] sm:w-[320px] p-8 rounded-2xl bg-white/5 border border-white/10 snap-start flex flex-col items-center text-center hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group"
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Boutons de navigation */}
          <button
            onClick={() => scrollUX('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 z-10 border border-gray-200 hidden md:flex"
            aria-label="Précédent"
          >
            <ChevronRight className="w-6 h-6 text-[#ff6b35] rotate-180" />
          </button>
          <button
            onClick={() => scrollUX('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 z-10 border border-gray-200 hidden md:flex"
            aria-label="Suivant"
          >
            <ChevronRight className="w-6 h-6 text-[#ff6b35]" />
          </button>

          {/* Dots indicateurs */}
          <div className="flex justify-center gap-2 mt-2">
            {UX_DETAILS.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollUXTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeUX === index
                    ? 'w-6 bg-[#ff6b35]'
                    : 'w-2 bg-white/30 hover:bg-[#ff6b35]/50'
                }`}
                aria-label={`Aller à la carte ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ✅ CTA FINAL */}
        <div className="text-center mt-16">
          <Button
            onClick={onRegisterClick}
            size="lg"
            className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff8c61] hover:to-[#ff9c71] text-white shadow-2xl shadow-[#ff6b35]/20 px-10 py-6 text-lg rounded-2xl font-black transition-all hover:scale-105"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Commencer gratuitement
          </Button>
          <p className="text-xs text-white/30 mt-4">
            Gratuit • Sans carte bancaire • Accès immédiat
          </p>
        </div>
      </div>
    </div>
  );
};

FeaturesCarousel.propTypes = {
  onRegisterClick: PropTypes.func.isRequired,
};

export default FeaturesCarousel;
