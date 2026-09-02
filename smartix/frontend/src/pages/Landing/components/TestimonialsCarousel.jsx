// frontend/src/pages/Landing/components/TestimonialsCarousel.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import PropTypes from 'prop-types';

// =============================
// TÉMOIGNAGES - VERSION OPTIMISÉE AVEC MICRO-IMPERFECTIONS
// =============================
const TESTIMONIALS = [
  {
    name: "Marie K.",
    role: "Étudiante en Sciences, Terminale",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    content: "L'IA m'aide vraiment à mieux comprendre mes cours, surtout quand je bloque sur certains concepts. C'est beaucoup plus clair qu'avant.",
    type: "apprentissage",
    rating: 4
  },
  {
    name: "Jean-Paul M.",
    role: "Étudiant en Informatique, L2",
    avatar: "https://randomuser.me/api/portraits/men/45.jpg",
    content: "J'ai publié mon premier projet sur Smartix et j'ai reçu des retours super utiles de la communauté. Ça m'a vraiment motivé à continuer.",
    type: "création",
    rating: 5
  },
  {
    name: "Aïcha D.",
    role: "Étudiante en Comptabilité, 1ère",
    avatar: "https://randomuser.me/api/portraits/women/50.jpg",
    content: "Je progresse beaucoup plus vite qu'avant, surtout en compta où j'avais du mal. Les exercices sont bien expliqués.",
    type: "apprentissage",
    rating: 4
  },
  {
    name: "Patrick N.",
    role: "Étudiant en Mathématiques, 2nde",
    avatar: "https://randomuser.me/api/portraits/men/23.jpg",
    content: "C'est vraiment utile, même si j'aimerais encore plus de contenu dans certaines matières comme la physique.",
    type: "communauté",
    rating: 3  // ✅ MICRO-IMPERFECTION : 3 étoiles
  },
  {
    name: "Sarah M.",
    role: "Étudiante en Littérature, 1ère",
    avatar: "https://randomuser.me/api/portraits/women/29.jpg",
    content: "J'ai commencé à vendre mes fiches de révision sur la marketplace. Ça motive vraiment à créer plus de contenu.",
    type: "vente",
    rating: 5
  },
  {
    name: "David K.",
    role: "Étudiant en Économie, L1",
    avatar: "https://randomuser.me/api/portraits/men/36.jpg",
    content: "L'IA répond vite et les explications sont simples. Parfait quand je révise tard le soir et que personne n'est là pour m'aider.",
    type: "apprentissage",
    rating: 4
  }
];

// =============================
// AUTO-PLAY CONFIGURATION
// =============================
const AUTO_PLAY_INTERVAL = 5000; // 5 secondes

// =============================
// COMPOSANT PRINCIPAL
// =============================
const TestimonialsCarousel = ({ onRegisterClick }) => {
  const carouselRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const autoPlayRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);

  // =============================
  // SCROLL FUNCTIONS
  // =============================
  const scroll = useCallback((direction) => {
    if (carouselRef.current) {
      const scrollAmount = 350;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      
      let newIndex = direction === 'left' 
        ? Math.max(0, activeIndex - 1) 
        : Math.min(TESTIMONIALS.length - 1, activeIndex + 1);
      setActiveIndex(newIndex);
    }
  }, [activeIndex]);

  const scrollTo = useCallback((index) => {
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: index * 350, behavior: 'smooth' });
      setActiveIndex(index);
    }
  }, []);

  const goToNext = useCallback(() => scroll('right'), [scroll]);
  const goToPrev = useCallback(() => scroll('left'), [scroll]);

  // =============================
  // AUTO-PLAY LOGIC
  // =============================
  useEffect(() => {
    if (!isHovering && autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    
    if (!isHovering) {
      autoPlayRef.current = setInterval(() => {
        if (activeIndex < TESTIMONIALS.length - 1) {
          goToNext();
        } else {
          // Revenir au début
          scrollTo(0);
        }
      }, AUTO_PLAY_INTERVAL);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isHovering, activeIndex, goToNext, scrollTo]);

  // =============================
  // TRACK SCROLL POSITION
  // =============================
  const handleScroll = useCallback((e) => {
    const newIndex = Math.round(e.target.scrollLeft / 350);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < TESTIMONIALS.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex]);

  // =============================
  // RENDU DES ÉTOILES
  // =============================
  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  // =============================
  // BADGE STYLES - VERSION CLEAN
  // =============================
  const getBadgeStyles = (type) => {
    const baseStyles = "inline-block px-2 py-1 rounded-full text-xs font-medium";
    switch (type) {
      case 'apprentissage':
        return `${baseStyles} bg-blue-50 text-blue-600`;
      case 'création':
        return `${baseStyles} bg-purple-50 text-purple-600`;
      case 'communauté':
        return `${baseStyles} bg-green-50 text-green-600`;
      case 'vente':
        return `${baseStyles} bg-orange-50 text-orange-600`;
      default:
        return `${baseStyles} bg-gray-50 text-gray-600`;
    }
  };

  const getBadgeIcon = (type) => {
    switch (type) {
      case 'apprentissage':
        return '📚';
      case 'création':
        return '🎨';
      case 'communauté':
        return '👥';
      case 'vente':
        return '💰';
      default:
        return '⭐';
    }
  };

  return (
    <div className="py-4 bg-transparent backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ✅ TITRE OPTIMISÉ - Plus engageant */}
        <div className="text-center mb-2">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Pourquoi ils <span className="gradient-text">utilisent Smartix</span>
          </h2>
          {/* ✅ SOUS-TITRE OPTIMISÉ - Avec "génèrent des revenus" */}
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Des étudiants comme toi qui apprennent, créent, partagent et génèrent des revenus
          </p>
        </div>

        {/* Carousel */}
        <div 
          className="relative"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            ref={carouselRef}
            id="testimonials-carousel"
            className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-8"
            style={{
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch'
            }}
            onScroll={handleScroll}
          >
            {TESTIMONIALS.map((testimonial, index) => (
              <div
                key={index}
                className="min-w-[300px] sm:min-w-[350px] w-[300px] sm:w-[350px] p-8 rounded-2xl border border-gray-100 hover:border-transparent hover:shadow-xl bg-gradient-to-br from-gray-50 to-white transition-all duration-300 hover:-translate-y-1 snap-start flex flex-col h-full"
              >
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full shadow-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 break-words">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600 break-words">{testimonial.role}</p>
                  </div>
                </div>
                
                {/* Étoiles */}
                {renderStars(testimonial.rating)}
                
                {/* Témoignage */}
                <p className="text-gray-700 italic break-words overflow-hidden text-sm leading-relaxed mt-4 flex-1">
                  "{testimonial.content}"
                </p>
                
                {/* ✅ Badge CLEAN (sans surcharge visuelle) */}
                <div className="mt-4">
                  <span className={getBadgeStyles(testimonial.type)}>
                    {getBadgeIcon(testimonial.type)} {testimonial.type === 'apprentissage' && 'Apprentissage'}
                    {testimonial.type === 'création' && 'Création'}
                    {testimonial.type === 'communauté' && 'Communauté'}
                    {testimonial.type === 'vente' && 'Vente'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation buttons (visible sur desktop) */}
          <button
            onClick={goToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 z-10 border border-gray-200 hidden md:flex"
            aria-label="Témoignage précédent"
          >
            <ChevronRight className="w-6 h-6 text-[#00B894] rotate-180" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 z-10 border border-gray-200 hidden md:flex"
            aria-label="Témoignage suivant"
          >
            <ChevronRight className="w-6 h-6 text-[#00B894]" />
          </button>

          {/* Dots indicators avec animation */}
          <div className="flex justify-center gap-2 mt-8">
            {TESTIMONIALS.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeIndex === index 
                    ? 'w-6 bg-[#00B894]' 
                    : 'w-2 bg-gray-300 hover:bg-[#00B894]/50'
                }`}
                aria-label={`Aller au témoignage ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Trust badge - Version finale */}
        <div className="text-center mt-12">
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-r from-[#ff6b35]/10 to-orange-500/10 px-8 py-5 rounded-2xl border border-[#ff6b35]/20 backdrop-blur-sm">
            <div className="flex items-center gap-10">
              <div className="flex -space-x-2">
                {TESTIMONIALS.slice(0, 4).map((t, idx) => (
                  <img
                    key={idx}
                    src={t.avatar}
                    alt="Utilisateur"
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                  />
                ))}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-white">
                  Des créateurs rejoignent Smartix chaque jour
                </span>
                <span className="text-xs text-white/50">
                  Rejoins les premiers utilisateurs de Smartix
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20 hidden sm:block" />
            <Button
              onClick={onRegisterClick}
              size="lg"
              className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff8c61] hover:to-[#ff6b35] text-white shadow-lg px-8 py-5 rounded-xl font-bold transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Commencer gratuitement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

TestimonialsCarousel.propTypes = {
  onRegisterClick: PropTypes.func.isRequired,
};

export default TestimonialsCarousel;
