import React, { useState, useCallback, Suspense, lazy, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { 

  Sparkles, BookOpen, Brain, Users, Trophy, Smartphone,
  ArrowLeft, Check, Target, Shield, Zap
} from 'lucide-react';
import PropTypes from 'prop-types';

// Lazy loading du modal d'inscription (gros gain de performance)
const RegistrationFlow = lazy(() => import('../components/RegistrationFlow/RegistrationFlow'));

// =============================
// 1️⃣ DONNÉES STATIQUES (extraites du composant)
// =============================

const FEATURES = [
  {
    icon: BookOpen,
    title: "Apprentissage intelligent",
    description: "Sciences, Maths, Littérature, Informatique, Comptabilité et bien plus encore. Tous les domaines d'études sont couverts.",
    color: "from-blue-500 to-cyan-500",
    delay: 0
  },
  {
    icon: Brain,
    title: "Assistance IA adaptative",
    description: "Notre intelligence artificielle s'adapte à ta matière pour te fournir des explications personnalisées et pertinentes.",
    color: "from-purple-500 to-pink-500",
    delay: 100
  },
  {
    icon: Users,
    title: "Communauté active",
    description: "Connecte-toi avec d'autres étudiants de ton option et de ton niveau pour échanger et progresser ensemble.",
    color: "from-green-500 to-teal-500",
    delay: 200
  },
  {
    icon: Trophy,
    title: "Suivi personnalisé",
    description: "Mesure tes progrès avec des quiz interactifs, des exercices pratiques, un classement et des badges de réussite.",
    color: "from-orange-500 to-red-500",
    delay: 300
  },
  {
    icon: Smartphone,
    title: "Multi-plateforme",
    description: "Mobile, tablette, ordinateur - apprends où tu veux, quand tu veux avec une expérience optimisée.",
    color: "from-[#00B894] to-[#0984E3]",
    delay: 400
  },
  {
    icon: Zap,
    title: "Apprentissage personnalisé",
    description: "Nos algorithmes adaptent le contenu à ton niveau et à tes objectifs pour un apprentissage optimal.",
    color: "from-yellow-500 to-orange-500",
    delay: 500
  }
];

const COURSE_TYPES = [
  { icon: "📹", title: "Cours vidéo", description: "Des vidéos explicatives claires et concises" },
  { icon: "✍️", title: "Exercices pratiques", description: "Mets en pratique ce que tu apprends" },
  { icon: "🎯", title: "Quiz interactifs", description: "Évalue ta compréhension en temps réel" },
  { icon: "📝", title: "Fiches de révision", description: "Résumés synthétiques pour réviser efficacement" },
  { icon: "🚀", title: "Projets pratiques", description: "Applique tes connaissances sur des cas réels" },
  { icon: "🎥", title: "Sessions en direct", description: "Participe à des cours en direct avec des experts" }
];

const BENEFITS = [
  "Contenu 100% adapté aux programmes africains",
  "Assistance IA disponible 24/7",
  "Communauté active de milliers d'étudiants",
  "Suivi personnalisé de ta progression",
  "Badges et certifications valorisants",
  "Accès illimité à tous les cours",
  "Exercices corrigés en détail",
  "Mises à jour régulières du contenu",
  "Apprentissage à ton rythme",
  "Tutoriels pas à pas"
];

const STATS = [
  { value: "500+", label: "Cours disponibles", icon: BookOpen },
  { value: "10k+", label: "Étudiants actifs", icon: Users },
  { value: "95%", label: "Taux de réussite", icon: Trophy },
  { value: "24/7", label: "Assistance IA", icon: Brain }
];

const LEARNING_STEPS = [
  { step: "1", title: "Inscris-toi", description: "Crée ton compte gratuitement", icon: "🎓" },
  { step: "2", title: "Choisis tes matières", description: "Sélectionne tes domaines d'intérêt", icon: "📚" },
  { step: "3", title: "Apprends à ton rythme", description: "Cours, quiz, exercices interactifs", icon: "⚡" },
  { step: "4", title: "Obtiens tes badges", description: "Valide tes compétences", icon: "🏆" }
];

// =============================
// 2️⃣ COMPOSANTS RÉUTILISABLES (avec React.memo)
// =============================

const FeatureCard = React.memo(({ icon: Icon, title, description, color, delay = 0 }) => (
  <div 
    className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fadeInUp"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="w-7 h-7 text-white" aria-hidden="true" />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </div>
));
FeatureCard.displayName = 'FeatureCard';

const CourseTypeCard = React.memo(({ icon, title, description }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
    <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
  </div>
));
CourseTypeCard.displayName = 'CourseTypeCard';

const BenefitItem = React.memo(({ text }) => (
  <div className="flex items-center gap-3 group">
    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
      <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
    </div>
    <span className="text-gray-700 group-hover:text-gray-900 transition-colors">{text}</span>
  </div>
));
BenefitItem.displayName = 'BenefitItem';

const StatCard = React.memo(({ icon: Icon, value, label }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center hover:shadow-lg transition-all hover:-translate-y-1">
    <Icon className="w-8 h-8 text-[#00B894] mx-auto mb-3" aria-hidden="true" />
    <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
    <div className="text-sm text-gray-500">{label}</div>
  </div>
));
StatCard.displayName = 'StatCard';

const LearningStep = React.memo(({ step, icon, title, description }) => (
  <div className="text-center group">
    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#00B894] to-[#0984E3] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
      <span className="text-3xl" aria-hidden="true">{icon}</span>
    </div>
    <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 text-sm">{description}</p>
  </div>
));
LearningStep.displayName = 'LearningStep';

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================

const CoursesInfo = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(false); // ← loading state pour UX

  const handleStart = useCallback(() => {
    if (user) {
      setLoading(true);
      // Petite simulation pour éviter un flicker (optionnel)
      setTimeout(() => {
        navigate('/courses');
      }, 100);
    } else {
      setShowRegister(true);
    }
  }, [user, navigate]);

  const handleCloseRegistration = useCallback(() => {
    setShowRegister(false);
  }, []);

  return (
    <>
      <main className="min-h-screen bg-gray-50">
        {/* Header Hero Section */}
        <header className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white py-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg px-2 py-1"
              aria-label="Retour à l'accueil"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              <span>Retour à l'accueil</span>
            </Link>
            
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-12 h-12" aria-hidden="true" />
              <h1 className="text-4xl md:text-5xl font-bold">Nos Cours</h1>
            </div>
            <p className="text-xl text-white/90 max-w-3xl leading-relaxed">
              Smartix est bien plus qu'une simple plateforme de cours - c'est un écosystème éducatif global conçu pour ta réussite !
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Introduction Section */}
          <section aria-labelledby="intro-heading" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-12 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-[#00B894]" aria-hidden="true" />
              <h2 id="intro-heading" className="text-3xl font-bold text-gray-900">Un écosystème éducatif complet</h2>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Smartix te propose une expérience d'apprentissage unique qui combine technologie de pointe, 
              contenu pédagogique de qualité et une communauté active d'apprenants. Notre mission est de rendre 
              l'éducation accessible, engageante et efficace pour tous les étudiants africains.
            </p>
          </section>

          {/* Stats Section */}
          <section aria-labelledby="stats-heading" className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            <h2 id="stats-heading" className="sr-only">Statistiques clés</h2>
            {STATS.map((stat, idx) => (
              <StatCard key={idx} {...stat} />
            ))}
          </section>

          {/* Features Section */}
          <section aria-labelledby="features-heading" className="mb-16">
            <h2 id="features-heading" className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Ce qui rend Smartix unique
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feature, idx) => (
                <FeatureCard key={idx} {...feature} />
              ))}
            </div>
          </section>

          {/* Course Types Section */}
          <section aria-labelledby="course-types-heading" className="mb-16">
            <h2 id="course-types-heading" className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Types de contenus disponibles
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {COURSE_TYPES.map((type, idx) => (
                <CourseTypeCard key={idx} {...type} />
              ))}
            </div>
          </section>

          {/* Learning Path Section */}
          <section aria-labelledby="learning-path-heading" className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 md:p-12 mb-16">
            <h2 id="learning-path-heading" className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Ton parcours d'apprentissage
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
              {LEARNING_STEPS.map((item, idx) => (
                <LearningStep key={idx} {...item} />
              ))}
            </div>
          </section>

          {/* Benefits Section */}
          <section aria-labelledby="benefits-heading" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-8 h-8 text-[#00B894]" aria-hidden="true" />
              <h2 id="benefits-heading" className="text-3xl font-bold text-gray-900">Pourquoi choisir Smartix ?</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {BENEFITS.map((benefit, idx) => (
                <BenefitItem key={idx} text={benefit} />
              ))}
            </div>
          </section>

          {/* Call to Action Section */}
          <section aria-labelledby="cta-heading" className="bg-gradient-to-r from-[#00B894] to-[#0984E3] rounded-3xl p-8 md:p-12 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" aria-hidden="true">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            </div>
            
            <Target className="w-16 h-16 mx-auto mb-6 opacity-90 relative z-10" aria-hidden="true" />
            
            <h2 id="cta-heading" className="text-2xl md:text-3xl font-bold mb-4 relative z-10">
              Commence ton parcours d'excellence !
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto relative z-10">
              Rejoins des milliers d'étudiants qui transforment leur avenir avec Smartix
            </p>
            
            <Button 
              onClick={handleStart}
              disabled={loading}
              size="lg" 
              className="bg-white text-[#00B894] hover:bg-gray-50 shadow-xl px-6 md:px-8 py-6 text-base md:text-lg relative z-10 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#00B894] disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={user ? 'Accéder aux cours' : 'Commencer gratuitement'}
            >
              <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
              {loading ? "Chargement..." : (user ? 'Accéder aux cours' : 'Commencer gratuitement')}
            </Button>
          </section>
        </div>
      </main>

      {/* Lazy loading du modal d'inscription */}
      <Suspense fallback={null}>
        <RegistrationFlow 
          open={showRegister} 
          onOpenChange={handleCloseRegistration}
        />
      </Suspense>
    </>
  );
};

export default React.memo(CoursesInfo);
CoursesInfo.propTypes = {};
