import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  Sparkles, Atom, Calculator, Code, BookOpen, Briefcase,
  ChevronRight, ArrowLeft, Trophy, Users, Brain, Loader2,
  Zap, Rocket, Music, Palette, Gamepad, Mic, Video, Sparkle,
  Gift, Star, Award, Heart, Lightbulb, Wand2, Gem, Crown
} from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures (données statiques)

// Icônes par catégorie
const CATEGORY_ICONS = {
  'Scientifique': Atom,
  'Mathématique': Calculator,
  'Informatique': Code,
  'Littéraire': BookOpen,
  'Comptabilité / Économie': Briefcase,
  'Vibe Coding': Zap
};

// Couleurs par catégorie
const CATEGORY_COLORS = {
  'Scientifique': 'from-purple-500 to-pink-500',
  'Mathématique': 'from-blue-500 to-cyan-500',
  'Informatique': 'from-green-500 to-teal-500',
  'Littéraire': 'from-orange-500 to-red-500',
  'Comptabilité / Économie': 'from-[#00B894] to-[#0984E3]',
  'Vibe Coding': 'from-fuchsia-500 to-amber-500'
};

// Fonctionnalités Vibe Coding
const VIBE_FEATURES = [
  {
    id: 'music-generation',
    name: 'Génération Musicale IA',
    icon: Music,
    description: 'Crée des beats et mélodies avec l\'IA',
    level: 'Débutant - Avancé',
    color: 'from-pink-500 to-rose-500',
    route: '/vibe-coding/music',
    badges: ['🎵 IA', '✨ Créatif', '🎹 Studio']
  },
  {
    id: 'visual-art',
    name: 'Art Visuel Génératif',
    icon: Palette,
    description: 'Génère des images, logos et illustrations',
    level: 'Tous niveaux',
    color: 'from-purple-500 to-indigo-500',
    route: '/vibe-coding/art',
    badges: ['🎨 IA', '🖼️ Génération', '✨ Créatif']
  },
  {
    id: 'game-dev',
    name: 'Développement de Jeux',
    icon: Gamepad,
    description: 'Crée des jeux sans code avec l\'IA',
    level: 'Débutant - Avancé',
    color: 'from-green-500 to-emerald-500',
    route: '/vibe-coding/games',
    badges: ['🎮 IA', '👾 No Code', '🚀 Rapide']
  },
  {
    id: 'voice-synth',
    name: 'Synthèse Vocale',
    icon: Mic,
    description: 'Génère des voix et dialogues',
    level: 'Intermédiaire - Avancé',
    color: 'from-cyan-500 to-blue-500',
    route: '/vibe-coding/voice',
    badges: ['🗣️ IA', '🎤 Voix', '🎧 Audio']
  },
  {
    id: 'video-edit',
    name: 'Montage Vidéo IA',
    icon: Video,
    description: 'Édite des vidéos automatiquement',
    level: 'Débutant - Intermédiaire',
    color: 'from-red-500 to-orange-500',
    route: '/vibe-coding/video',
    badges: ['🎬 IA', '✂️ Montage', '🎥 Pro']
  },
  {
    id: 'code-assistant',
    name: 'Assistant de Code',
    icon: Wand2,
    description: 'Génère et corrige du code',
    level: 'Tous niveaux',
    color: 'from-blue-500 to-cyan-500',
    route: '/vibe-coding/code',
    badges: ['🤖 IA', '💻 Code', '⚡ Auto']
  }
];

// =============================
// COMPOSANT VIBE CARD
// =============================
const VibeCard = ({ feature, onClick }) => {
  const Icon = feature.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`group border border-gray-200 rounded-xl p-6 transition-all duration-300 cursor-pointer ${
        isHovered ? 'shadow-xl -translate-y-2 border-transparent' : 'hover:shadow-md hover:-translate-y-1'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(feature.route)}
    >
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#ff6b35] transition-colors">
          {feature.name}
        </h3>
        <Sparkle className={`w-5 h-5 text-purple-400 transition-all duration-300 ${isHovered ? 'opacity-100 rotate-12' : 'opacity-0'}`} />
      </div>
      
      <p className="text-gray-600 text-sm mb-3">{feature.description}</p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {feature.badges.map((badge, idx) => (
          <span key={idx} className="px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
            {badge}
          </span>
        ))}
      </div>
      
      <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
        {feature.level}
      </span>
      
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Zap className="w-3 h-3" />
          <span>IA générative</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-all duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
      </div>
    </div>
  );
};

// =============================
// COMPOSANT STAT CARD
// =============================
const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
      </div>
    </div>
  </div>
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Features = () => {
  const navigate = useNavigate();
  const { client } = useApiClient();
  const { getFeaturesCache, updateFeaturesCache } = useGlobalCache();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    subjects: 0,
    courses: 0,
    students: 0,
    vibeFeatures: VIBE_FEATURES.length
  });

  // =============================
  // CHARGEMENT DES DONNÉES
  // =============================
  const fetchFeatures = useCallback(async () => {
    try {
      const cached = getFeaturesCache();
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setCategories(cached.categories);
        setStats(cached.stats);
        setLoading(false);
        return;
      }

      const response = await client.get('/features');
      const data = response.data;

      // Ajouter la catégorie Vibe Coding si non présente
      const allCategories = [...(data.categories || []), {
        name: "Vibe Coding",
        icon: Zap,
        color: "from-fuchsia-500 to-amber-500",
        subjects: VIBE_FEATURES.map(f => ({
          id: f.id,
          name: f.name,
          level: f.level,
          description: f.description,
          route: f.route,
          vibe: true,
          badges: f.badges
        }))
      }];

      setCategories(allCategories);
      setStats({
        subjects: (data.stats?.subjects || 15) + VIBE_FEATURES.length,
        courses: (data.stats?.courses || 500) + VIBE_FEATURES.length,
        students: data.stats?.students || 10000,
        vibeFeatures: VIBE_FEATURES.length
      });

      updateFeaturesCache({
        categories: allCategories,
        stats: {
          subjects: (data.stats?.subjects || 15) + VIBE_FEATURES.length,
          courses: (data.stats?.courses || 500) + VIBE_FEATURES.length,
          students: data.stats?.students || 10000,
          vibeFeatures: VIBE_FEATURES.length
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error fetching features:', error);
      setError('Impossible de charger les fonctionnalités');
      
      setCategories(getFallbackCategoriesWithVibe());
      setStats({
        subjects: 15 + VIBE_FEATURES.length,
        courses: 500 + VIBE_FEATURES.length,
        students: 10000,
        vibeFeatures: VIBE_FEATURES.length
      });
    } finally {
      setLoading(false);
    }
  }, [client, getFeaturesCache, updateFeaturesCache]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // =============================
  // FALLBACK AVEC VIBE CODING
  // =============================
  const getFallbackCategoriesWithVibe = () => [
    {
      name: "Scientifique",
      icon: Atom,
      color: "from-purple-500 to-pink-500",
      subjects: [
        { id: "physics", name: "Physique", level: "1re - Terminale", description: "Mécanique, électricité, optique", route: "/courses?subject=physics" },
        { id: "chemistry", name: "Chimie", level: "1re - Terminale", description: "Chimie organique, réactions", route: "/courses?subject=chemistry" },
        { id: "biology", name: "Biologie", level: "1re - Terminale", description: "Génétique, écologie, anatomie", route: "/courses?subject=biology" }
      ]
    },
    {
      name: "Mathématique",
      icon: Calculator,
      color: "from-blue-500 to-cyan-500",
      subjects: [
        { id: "algebra", name: "Algèbre", level: "Tous niveaux", description: "Équations, polynômes, fonctions", route: "/courses?subject=algebra" },
        { id: "geometry", name: "Géométrie", level: "Tous niveaux", description: "Figures planes, solides", route: "/courses?subject=geometry" },
        { id: "probability", name: "Probabilités", level: "1re - Terminale", description: "Statistiques, probabilités", route: "/courses?subject=probability" }
      ]
    },
    {
      name: "Informatique",
      icon: Code,
      color: "from-green-500 to-teal-500",
      subjects: [
        { id: "programming", name: "Programmation", level: "Débutant - Avancé", description: "Python, JavaScript, algorithmique", route: "/courses?subject=programming" },
        { id: "office", name: "Bureautique", level: "Tous niveaux", description: "Word, Excel, PowerPoint", route: "/courses?subject=office" },
        { id: "networks", name: "Réseaux", level: "Intermédiaire - Avancé", description: "Internet, protocoles, sécurité", route: "/courses?subject=networks" }
      ]
    },
    {
      name: "Littéraire",
      icon: BookOpen,
      color: "from-orange-500 to-red-500",
      subjects: [
        { id: "french", name: "Français", level: "Tous niveaux", description: "Grammaire, orthographe, littérature", route: "/courses?subject=french" },
        { id: "philosophy", name: "Philosophie", level: "Terminale", description: "Méthodologie, dissertations", route: "/courses?subject=philosophy" },
        { id: "culture", name: "Culture générale", level: "Tous niveaux", description: "Histoire, géographie, société", route: "/courses?subject=culture" }
      ]
    },
    {
      name: "Comptabilité / Économie",
      icon: Briefcase,
      color: "from-[#00B894] to-[#0984E3]",
      subjects: [
        { id: "accounting", name: "Comptabilité OHADA", level: "1re - Terminale", description: "Système comptable OHADA", route: "/courses?subject=accounting" },
        { id: "management", name: "Gestion", level: "1re - Terminale", description: "Gestion d'entreprise, marketing", route: "/courses?subject=management" },
        { id: "finance", name: "Finance", level: "Terminale", description: "Finance d'entreprise", route: "/courses?subject=finance" }
      ]
    },
    {
      name: "Vibe Coding",
      icon: Zap,
      color: "from-fuchsia-500 to-amber-500",
      subjects: VIBE_FEATURES.map(f => ({
        id: f.id,
        name: f.name,
        level: f.level,
        description: f.description,
        route: f.route,
        vibe: true,
        badges: f.badges
      }))
    }
  ];

  // =============================
  // GESTIONNAIRE DE NAVIGATION
  // =============================
  const handleSubjectClick = useCallback((route) => {
    navigate(route);
  }, [navigate]);

  const handleVibeClick = useCallback((route) => {
    navigate(route);
  }, [navigate]);

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#00B894] mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Chargement des fonctionnalités...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour à l'accueil</span>
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold">Fonctionnalités</h1>
          </div>
          <p className="text-xl text-white/90 max-w-3xl">
            Découvre toutes les matières et options disponibles sur Smartix. Un écosystème éducatif complet pour exceller dans tes études !
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <StatCard icon={BookOpen} value={`${stats.subjects}+`} label="Matières disponibles" color="from-[#00B894] to-[#0984E3]" />
          <StatCard icon={Trophy} value={`${stats.courses}+`} label="Cours interactifs" color="from-purple-500 to-pink-500" />
          <StatCard icon={Users} value={`${stats.students.toLocaleString()}+`} label="Étudiants actifs" color="from-blue-500 to-cyan-500" />
          <StatCard icon={Zap} value={`${stats.vibeFeatures}+`} label="Fonctionnalités Vibe" color="from-fuchsia-500 to-amber-500" />
        </div>

        {/* Categories */}
        <div className="space-y-12">
          {categories.map((category, idx) => {
            const Icon = CATEGORY_ICONS[category.name] || BookOpen;
            const color = CATEGORY_COLORS[category.name] || 'from-gray-500 to-gray-600';
            const isVibe = category.name === 'Vibe Coding';
            
            return (
              <div key={idx} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow ${isVibe ? 'relative overflow-hidden' : ''}`}>
                {isVibe && (
                  <>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-fuchsia-500/10 to-amber-500/10 rounded-full blur-3xl -z-0" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl -z-0" />
                  </>
                )}
                
                <div className={`bg-gradient-to-r ${color} p-6 text-white relative z-10`}>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold mb-1">
                        {category.name}
                        {isVibe && (
                          <span className="ml-2 text-sm bg-white/20 px-2 py-0.5 rounded-full">
                            Nouveau 🔥
                          </span>
                        )}
                      </h2>
                      <p className="text-white/90">{category.subjects.length} matières disponibles</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {isVibe ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {VIBE_FEATURES.map((feature) => (
                        <VibeCard key={feature.id} feature={feature} onClick={() => handleVibeClick(feature.route)} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-6">
                      {category.subjects.map((subject, subIdx) => (
                        <div 
                          key={subIdx} 
                          className="group border border-gray-200 rounded-xl p-5 hover:border-transparent hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                          onClick={() => handleSubjectClick(subject.route || `/courses?subject=${subject.id}`)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#00B894] transition-colors">
                              {subject.name}
                            </h3>
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                              {subject.level}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-4">{subject.description}</p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="w-full group-hover:bg-gradient-to-r group-hover:from-[#00B894] group-hover:to-[#0984E3] group-hover:text-white group-hover:border-transparent transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubjectClick(subject.route || `/courses?subject=${subject.id}`);
                            }}
                          >
                            Découvrir
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vibe Coding Promo Section */}
        <div className="mt-16 bg-gradient-to-r from-fuchsia-600 to-amber-600 rounded-3xl p-12 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Sparkle className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">Nouveau Module</span>
            </div>
            
            <h2 className="text-4xl font-bold mb-4">
              Vibe Coding — Crée avec l'IA
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Transforme tes idées en réalité ! Musique, art, jeux, vidéos... Laisse parler ta créativité avec nos outils IA.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              {VIBE_FEATURES.slice(0, 3).map((feature) => (
                <div key={feature.id} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                  <feature.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{feature.name}</span>
                </div>
              ))}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-sm font-medium">+{VIBE_FEATURES.length - 3} autres</span>
              </div>
            </div>
            
            <Link to="/vibe-coding">
              <Button size="lg" className="bg-white text-fuchsia-600 hover:bg-gray-50 shadow-xl px-8 py-6 text-lg transition-all hover:scale-105">
                <Zap className="w-5 h-5 mr-2" />
                Explorer Vibe Coding
              </Button>
            </Link>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-r from-[#00B894] to-[#0984E3] rounded-3xl p-12 text-white text-center">
          <Brain className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">Prêt à commencer ton apprentissage ?</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Rejoins Smartix et accède à toutes ces matières avec l'assistance d'une IA intelligente !
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="bg-white text-[#00B894] hover:bg-gray-50 shadow-xl px-8 py-6 text-lg transition-all hover:scale-105">
              <Sparkles className="w-5 h-5 mr-2" />
              Commencer gratuitement
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

Features.propTypes = {};

export default Features;
VibeCard.propTypes = {
  feature: PropTypes.any.isRequired,
  onClick: PropTypes.func.isRequired,
};
StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};
