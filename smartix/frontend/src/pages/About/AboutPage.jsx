import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, Brain, BookOpen, Users, Target, Zap, 
  Shield, Award, Globe, MessageSquare, ChevronRight,
  ArrowLeft, Laptop, GraduationCap, Heart,
  Lock, FileText, Mail, Phone, Star, TrendingUp, Rocket, Code2,
  ShoppingBag, Newspaper
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const AboutPage = () => {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ✅ Stats dynamiques (à connecter à l'API)
  const [stats, setStats] = useState({
    courses: 500,
    projects: 1200,
    users: 10000,
    products: 350
  });

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ Les 5 piliers de Smartix
  const pillars = [
    {
      icon: BookOpen,
      title: "Apprendre",
      description: "Acquiers de nouvelles compétences avec des cours interactifs, exercices pratiques et progression personnalisée.",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      icon: Zap,
      title: "Créer",
      description: "Transforme ton apprentissage en création réelle avec l'IDE intégré, vibe-coding IA et templates de projets.",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    {
      icon: Users,
      title: "Communauté",
      description: "Rejoins une communauté active, partage tes projets, collabore et apprends des autres créateurs.",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      icon: ShoppingBag,
      title: "Marketplace",
      description: "Monétise tes créations : vends tes ebooks, formations, templates et ressources numériques.",
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    {
      icon: Newspaper,
      title: "Actualités",
      description: "Reste informé sur la technologie, l'IA et l'innovation avec notre flux d'actualités agrégé.",
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    }
  ];

  // ✅ Features (améliorées)
  const features = [
    {
      icon: <Brain className="w-8 h-8 text-[#ff6b35]" />,
      title: "Intelligence Artificielle",
      description: "Un tuteur personnel disponible 24/7 pour répondre à toutes vos questions académiques."
    },
    {
      icon: <BookOpen className="w-8 h-8 text-[#00B894]" />,
      title: "Cours Interactifs",
      description: "Des milliers de leçons structurées, du collège à l'université, couvrant toutes les matières."
    },
    {
      icon: <Users className="w-8 h-8 text-[#0984E3]" />,
      title: "Réseau Social Éducatif",
      description: "Connectez-vous avec d'autres étudiants, partagez vos connaissances et progressez ensemble."
    },
    {
      icon: <Target className="w-8 h-8 text-[#6C5CE7]" />,
      title: "Apprentissage Adaptatif",
      description: "Des parcours personnalisés qui s'adaptent à votre rythme et à vos besoins spécifiques."
    }
  ];

  // ✅ Key Stats
  const keyStats = [
    { value: stats.courses, label: "Cours disponibles", icon: BookOpen, suffix: "+" },
    { value: stats.projects, label: "Projets créés", icon: Code2, suffix: "+" },
    { value: stats.users, label: "Utilisateurs actifs", icon: Users, suffix: "+" },
    { value: stats.products, label: "Produits vendus", icon: ShoppingBag, suffix: "+" }
  ];

  // ✅ Roadmap
  const roadmap = [
    { quarter: "Q1 2025", title: "Vibe-Coding IA", description: "Création de projets assistée par IA", status: "en_cours", icon: Zap },
    { quarter: "Q2 2025", title: "Mobile App", description: "Application mobile iOS et Android", status: "a_venir", icon: Rocket },
    { quarter: "Q3 2025", title: "API Publique", description: "Intégrations tierces", status: "a_venir", icon: Code2 },
    { quarter: "Q4 2025", title: "Certifications", description: "Certificats officiels", status: "a_venir", icon: Award }
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'en_cours':
        return <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-green-500/20 text-green-500 rounded-full">En cours</span>;
      case 'a_venir':
        return <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-white/10 text-white/60 rounded-full">À venir</span>;
      default:
        return null;
    }
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copié !', {
      description: `${email} a été copié dans le presse-papier`
    });
  };

  return (
    <div className="about-page min-h-screen bg-[#0f172a] text-white overflow-x-hidden relative">
      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 p-3 rounded-full text-white/30 transition-all duration-300 hover:text-[#ff6b35] hover:scale-110 active:scale-95 group ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        aria-label="Retour en haut"
      >
        <ChevronRight className="w-8 h-8 -rotate-90 transition-transform group-hover:-translate-y-1" />
      </button>

      {/* Back Button */}
      <button 
        onClick={() => navigate('/auth', { replace: true, state: { openMenu: true } })}
        className="absolute top-6 left-6 z-[100] w-12 h-12 bg-white/10 hover:bg-[#ff6b35] border border-white/10 hover:border-[#ff6b35] rounded-full flex items-center justify-center transition-all duration-300 group shadow-2xl backdrop-blur-md"
        aria-label="Retour au menu"
      >
        <ArrowLeft className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ff6b35]/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-sm mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-[#ff6b35]" />
            <span className="font-medium text-white/80 tracking-wide uppercase text-[10px]">Creator Learning Network</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight tracking-tight">
            Apprendre • Créer • Partager <br />
            <span className="text-[#ff6b35]">Vendre • S'informer</span>
          </h1>
          <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-12">
            Smartix est une super-plateforme qui combine apprentissage, création de projets, réseau social, 
            marketplace et actualités technologiques.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={() => navigate('/auth?mode=signup')}
              size="lg"
              className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white px-8 h-14 rounded-full text-lg font-bold shadow-xl shadow-[#ff6b35]/20 transition-all hover:scale-105"
            >
              Découvrir Smartix <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* ✅ Les 5 Piliers */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Les <span className="text-[#ff6b35]">5 piliers</span> de Smartix</h2>
            <p className="text-white/40 text-lg">Un écosystème complet pour votre réussite</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pillars.map((pillar, i) => (
              <div key={i} className={`p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-[#ff6b35]/30 transition-all hover:-translate-y-2 group`}>
                <div className={`w-12 h-12 rounded-2xl ${pillar.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <pillar.icon className={`w-6 h-6 ${pillar.color}`} />
                </div>
                <h3 className="text-xl font-bold mb-4">{pillar.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-white/5 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Une plateforme, <span className="text-[#ff6b35]">infinies possibilités.</span></h2>
            <p className="text-white/40 text-lg">Tout ce dont vous avez besoin pour exceller dans vos études.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <div key={i} className="feature-card p-8 rounded-3xl bg-[#1e293b] border border-white/5 hover:border-[#ff6b35]/30 transition-all hover:-translate-y-2 group text-center flex flex-col items-center">
                <div className="mb-6 p-4 bg-white/5 rounded-2xl inline-flex items-center justify-center group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                <p className="text-white/50 leading-relaxed text-sm">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ✅ Chiffres Clés */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Smartix en <span className="text-[#ff6b35]">chiffres</span></h2>
            <p className="text-white/40 text-lg">Une communauté qui grandit chaque jour</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {keyStats.map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex justify-center mb-3">
                  <stat.icon className="w-8 h-8 text-[#ff6b35]" />
                </div>
                <div className="text-3xl font-black text-white">
                  {stat.value.toLocaleString()}{stat.suffix}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-32 px-6 bg-white/5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <div className="absolute -inset-10 bg-[#ff6b35]/20 blur-3xl rounded-full opacity-30" />
            <div className="relative aspect-square rounded-[40px] overflow-hidden border border-white/10 bg-[#1e293b] flex items-center justify-center p-12">
              <GraduationCap className="w-48 h-48 text-[#ff6b35] opacity-20 absolute" />
              <div className="relative z-10 text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-[#ff6b35] rounded-3xl flex items-center justify-center rotate-12 shadow-2xl">
                    <Zap className="w-10 h-10 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4">L'excellence pour tous</h3>
                <p className="text-white/50">Smartix est né d'une vision simple : utiliser la technologie pour briser les barrières de l'éducation en Afrique et au-delà.</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-bold mb-8 leading-tight">Pourquoi choisir <span className="text-[#ff6b35]">Smartix ?</span></h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Accès Partout</h4>
                  <p className="text-white/50">Une connexion internet suffit pour accéder à la plus grande bibliothèque de savoir.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Contenu Certifié</h4>
                  <p className="text-white/50">Nos cours sont rédigés et validés par des experts et professeurs qualifiés.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Engagement Social</h4>
                  <p className="text-white/50">Rejoignez une communauté bienveillante d'étudiants qui s'entraident chaque jour.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Roadmap */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Feuille de <span className="text-[#ff6b35]">route</span></h2>
            <p className="text-white/40 text-lg">Les évolutions à venir sur Smartix</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roadmap.map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <item.icon className={`w-6 h-6 ${item.status === 'en_cours' ? 'text-green-500' : 'text-white/40'}`} />
                  {getStatusBadge(item.status)}
                </div>
                <h4 className="text-lg font-bold mb-2">{item.title}</h4>
                <p className="text-sm text-white/50 mb-3">{item.description}</p>
                <p className="text-xs text-white/30">{item.quarter}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8 tracking-tighter opacity-80">SMARTIX</h2>
          <p className="text-white/30 text-sm mb-12">© {new Date().getFullYear()} Smartix Platform. Tous droits réservés.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
            <Link 
              to="/conditions-utilisation"
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <FileText className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Conditions d'utilisation</span>
            </Link>
            <Link 
              to="/mentions-legales"
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <Lock className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Mentions légales</span>
            </Link>
            <button 
              onClick={() => setActiveModal('contact')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <Mail className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Contact</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <Dialog open={activeModal !== null} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="bg-[#1e293b] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              {activeModal === 'privacy' && <><Lock className="text-[#ff6b35]" /> Politique de Confidentialité</>}
              {activeModal === 'terms' && <><FileText className="text-[#ff6b35]" /> Conditions d'Utilisation</>}
              {activeModal === 'contact' && <><Mail className="text-[#ff6b35]" /> Contactez-nous</>}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 space-y-4 text-white/70 leading-relaxed">
            {activeModal === 'privacy' && (
              <>
                <p>Chez Smartix, nous prenons votre vie privée très au sérieux. Vos données personnelles sont protégées et ne sont jamais partagées sans votre consentement explicite.</p>
                <h4 className="text-white font-bold mt-4">Collecte des données</h4>
                <p>Nous collectons uniquement les informations nécessaires à votre progression pédagogique : nom, email et parcours scolaire.</p>
                <h4 className="text-white font-bold mt-4">Utilisation</h4>
                <p>Vos données servent à personnaliser votre expérience d'apprentissage et à vous connecter avec notre tuteur IA.</p>
              </>
            )}

            {activeModal === 'terms' && (
              <>
                <p>En utilisant Smartix, vous acceptez de respecter nos règles communautaires pour garantir un environnement d'apprentissage bienveillant et productif.</p>
                <h4 className="text-white font-bold mt-4">Engagement de l'utilisateur</h4>
                <p>L'utilisateur s'engage à utiliser la plateforme à des fins éducatives uniquement et à respecter les droits de propriété intellectuelle des contenus proposés.</p>
                <h4 className="text-white font-bold mt-4">Accès au service</h4>
                <p>Smartix se réserve le droit de suspendre tout compte ne respectant pas les présentes conditions.</p>
              </>
            )}

            {activeModal === 'contact' && (
              <div className="space-y-8 py-4">
                <p>Notre équipe est à votre disposition pour toute question ou suggestion.</p>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-12 h-12 bg-[#ff6b35]/20 rounded-xl flex items-center justify-center">
                      <Mail className="text-[#ff6b35]" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Email Direct</p>
                      <button 
                        onClick={() => handleCopyEmail('kirizamushaga01@gmail.com')}
                        className="text-lg font-medium text-white hover:text-[#ff6b35] transition-colors"
                      >
                        kirizamushaga01@gmail.com
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-12 h-12 bg-[#ff6b35]/20 rounded-xl flex items-center justify-center">
                      <Phone className="text-[#ff6b35]" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Téléphone / WhatsApp</p>
                      <a href="tel:+243820740027" className="text-lg font-medium text-white hover:text-[#ff6b35] transition-colors">
                        +243 820 740 027
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

AboutPage.propTypes = {};

export default AboutPage;
