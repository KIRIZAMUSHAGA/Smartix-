import React, { useState, useEffect } from 'react';
import { 
  Info, 
  Target, 
  ShieldCheck, 
  FileText, 
  Code2, 
  Mail, 
  ArrowLeft,
  Heart,
  Globe,
  Github,
  ExternalLink,
  BookOpen,
  Zap,
  Users,
  ShoppingBag,
  Newspaper,
  Star,
  TrendingUp,
  Award,
  Rocket
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const AboutPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    courses: 0,
    projects: 0,
    users: 0,
    products: 0
  });

  // ✅ Version dynamique
  const appVersion = '2.0.26';

  // ✅ Chiffres clés (à remplacer par des données API réelles)
  useEffect(() => {
    // Simulation de données (à remplacer par appel API)
    setStats({
      courses: 500,
      projects: 1200,
      users: 10000,
      products: 350
    });
  }, []);

  // ✅ Les 5 piliers de Smartix
  const pillars = [
    {
      icon: BookOpen,
      title: "Apprendre",
      description: "Acquiers de nouvelles compétences avec des cours interactifs, exercices pratiques et progression personnalisée.",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-500"
    },
    {
      icon: Zap,
      title: "Créer",
      description: "Transforme ton apprentissage en création réelle avec l'IDE intégré, vibe-coding IA et templates de projets.",
      color: "from-orange-500 to-yellow-500",
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-500"
    },
    {
      icon: Users,
      title: "Communauté",
      description: "Rejoins une communauté active, partage tes projets, collabore et apprends des autres créateurs.",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-500"
    },
    {
      icon: ShoppingBag,
      title: "Marketplace",
      description: "Monétise tes créations : vends tes ebooks, formations, templates et ressources numériques.",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      iconColor: "text-green-500"
    },
    {
      icon: Newspaper,
      title: "Actualités",
      description: "Reste informé sur la technologie, l'IA et l'innovation avec notre flux d'actualités agrégé.",
      color: "from-red-500 to-rose-500",
      bgColor: "bg-red-500/10",
      iconColor: "text-red-500"
    }
  ];

  // ✅ Statistiques clés
  const keyStats = [
    { value: stats.courses, label: "Cours disponibles", icon: BookOpen, suffix: "+" },
    { value: stats.projects, label: "Projets créés", icon: Code2, suffix: "+" },
    { value: stats.users, label: "Utilisateurs actifs", icon: Users, suffix: "+" },
    { value: stats.products, label: "Produits vendus", icon: ShoppingBag, suffix: "+" }
  ];

  // ✅ Inspirations produit
  const inspirations = [
    { name: "GitHub", description: "Gestion de projets", icon: Code2 },
    { name: "Udemy", description: "Plateforme d'apprentissage", icon: BookOpen },
    { name: "Gumroad", description: "Vente de produits numériques", icon: ShoppingBag },
    { name: "Facebook", description: "Réseau social", icon: Users },
    { name: "Google News", description: "Agrégation d'actualités", icon: Newspaper }
  ];

  // ✅ Roadmap
  const roadmap = [
    { quarter: "Q1 2025", title: "Vibe-Coding IA", description: "Création de projets assistée par IA", status: "en_cours", icon: Zap },
    { quarter: "Q2 2025", title: "Mobile App", description: "Application mobile iOS et Android", status: "a_venir", icon: Rocket },
    { quarter: "Q3 2025", title: "API Publique", description: "Intégrations tierces", status: "a_venir", icon: Code2 },
    { quarter: "Q4 2025", title: "Certifications", description: "Certificats officiels", status: "a_venir", icon: Award }
  ];

  const sections = [
    {
      title: "Notre Histoire",
      icon: Heart,
      color: "text-rose-500",
      content: [
        "Smartix est née de la volonté de connecter les talents et les savoirs sans barrières.",
        "Notre mission : démocratiser l'accès à la connaissance et permettre à chaque créateur de transformer son apprentissage en création réelle.",
        "Aujourd'hui, Smartix est une super-plateforme qui combine apprentissage, création, réseau social, marketplace et actualités."
      ]
    },
    {
      title: "Les 5 Piliers",
      icon: Target,
      color: "text-orange-500",
      isPillars: true
    },
    {
      title: "Notre Vision",
      icon: Rocket,
      color: "text-purple-500",
      content: [
        "Créer le premier Creator Learning Network où chaque interaction génère de la valeur éducative.",
        "Permettre à chaque utilisateur de passer de l'apprentissage à la création réelle.",
        "Construire une communauté mondiale de créateurs et d'apprenants."
      ]
    },
    {
      title: "Chiffres Clés",
      icon: TrendingUp,
      color: "text-green-500",
      isStats: true
    },
    {
      title: "Inspirations",
      icon: Star,
      color: "text-yellow-500",
      isInspirations: true
    },
    {
      title: "Roadmap",
      icon: Rocket,
      color: "text-cyan-500",
      isRoadmap: true
    },
    {
      title: "Technique",
      icon: Code2,
      color: "text-purple-500",
      content: [
        { label: "Frontend", value: "React, Tailwind CSS, Lucide Icons" },
        { label: "Backend", value: "FastAPI, MongoDB, Redis" },
        { label: "Infrastructure", value: "Cloud, CDN, WebSockets" },
        { label: "IA", value: "Modèles LLM pour vibe-coding" },
        { label: "Contact", value: "support@smartix.app", isEmail: true }
      ]
    },
    {
      title: "Légal",
      icon: ShieldCheck,
      color: "text-green-500",
      content: [
        { label: "Conditions", value: "Conditions Générales d'Utilisation", path: "/conditions-utilisation" },
        { label: "Confidentialité", value: "Politique de protection des données", path: "/politique-confidentialite" },
        { label: "Mentions", value: "Mentions Légales & Crédits", path: "/mentions-legales" }
      ],
      isLink: true
    }
  ];

  const handleLinkClick = (path) => {
    navigate(path);
  };

  const handleEmailClick = (email) => {
    window.location.href = `mailto:${email}`;
  };

  const handleExternalLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copié !', {
      description: `${email} a été copié dans le presse-papier`
    });
  };

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <button 
            onClick={() => navigate('/auth', { replace: true, state: { openMenu: true } })}
            className="p-2 hover:bg-accent rounded-full transition-all"
            aria-label="Retour au menu"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tight">À Propos</h1>
        </div>

        {/* Hero Section */}
        <div className="relative mb-12 p-8 rounded-[40px] bg-gradient-to-br from-[#ff6b35] to-[#ff9f1c] overflow-hidden group cursor-pointer"
             onClick={() => navigate('/')}>
          <div className="relative z-10 text-white text-center flex flex-col items-center">
            <h2 className="text-4xl font-black mb-4 tracking-tighter">Smartix</h2>
            <p className="text-lg font-bold opacity-90 leading-relaxed max-w-md">
              Apprendre • Créer • Partager • Vendre • S'informer
            </p>
            <p className="text-sm opacity-80 mt-4 max-w-md">
              Le Creator Learning Network : plateforme tout-en-un pour apprendre, créer des projets, 
              partager avec une communauté et vendre des produits numériques.
            </p>
          </div>
          <Heart className="absolute -bottom-8 -right-8 w-48 h-48 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 gap-6">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-accent/30 rounded-[32px] border border-border/50 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl bg-secondary ${section.color}`}>
                  <section.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest">{section.title}</h3>
              </div>
              
              {/* Contenu texte */}
              {section.content && Array.isArray(section.content) && !section.isPillars && !section.isStats && !section.isInspirations && !section.isRoadmap && (
                <div className="space-y-4">
                  {section.content.map((item, i) => (
                    typeof item === 'string' ? (
                      <p key={i} className="text-foreground/80 leading-relaxed">
                        {item}
                      </p>
                    ) : (
                      <div 
                        key={i} 
                        className={`flex flex-col gap-1 ${section.isLink || item.isEmail ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (item.path) handleLinkClick(item.path);
                          if (item.isEmail) handleEmailClick(item.value);
                        }}
                      >
                        <span className="text-xs font-black uppercase tracking-widest text-[#ff6b35]/60">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <p className={`font-bold ${section.isLink || item.isEmail ? 'text-blue-400 hover:underline' : 'text-foreground'}`}>
                            {item.value}
                          </p>
                          {(section.isLink || item.isEmail) && (
                            <ExternalLink className="w-3 h-3 text-blue-400 opacity-60" />
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* ✅ Les 5 Piliers */}
              {section.isPillars && (
                <div className="grid grid-cols-1 gap-4">
                  {pillars.map((pillar, i) => (
                    <div key={i} className={`flex gap-4 p-4 rounded-xl ${pillar.bgColor} border border-white/5`}>
                      <div className={`p-2 rounded-lg ${pillar.bgColor}`}>
                        <pillar.icon className={`w-5 h-5 ${pillar.iconColor}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{pillar.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{pillar.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ Chiffres Clés */}
              {section.isStats && (
                <div className="grid grid-cols-2 gap-4">
                  {keyStats.map((stat, i) => (
                    <div key={i} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex justify-center mb-2">
                        <stat.icon className="w-6 h-6 text-[#ff6b35]" />
                      </div>
                      <div className="text-2xl font-black text-white">
                        {stat.value.toLocaleString()}{stat.suffix}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ Inspirations */}
              {section.isInspirations && (
                <div className="grid grid-cols-2 gap-3">
                  {inspirations.map((insp, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <insp.icon className="w-4 h-4 text-[#ff6b35]" />
                        <span className="font-bold text-sm text-white">{insp.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{insp.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ✅ Roadmap */}
              {section.isRoadmap && (
                <div className="space-y-4">
                  {roadmap.map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${item.status === 'en_cours' ? 'from-green-500/20 to-green-500/5' : 'from-white/10 to-white/5'}`}>
                        <item.icon className={`w-5 h-5 ${item.status === 'en_cours' ? 'text-green-500' : 'text-white/40'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-foreground">{item.title}</h4>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        <p className="text-xs text-muted-foreground/40 mt-2">{item.quarter}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center space-y-4">
          <div className="flex justify-center gap-6">
            <button
              onClick={() => handleExternalLink('https://smartix.app')}
              className="p-2 hover:bg-accent rounded-full transition-all group"
              aria-label="Site web"
            >
              <Globe className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
            <button
              onClick={() => handleExternalLink('https://github.com/smartix')}
              className="p-2 hover:bg-accent rounded-full transition-all group"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
            <button
              onClick={() => handleCopyEmail('support@smartix.app')}
              className="p-2 hover:bg-accent rounded-full transition-all group"
              aria-label="Copier l'email"
            >
              <Mail className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30">
            Fait avec passion • © {new Date().getFullYear()} Smartix
          </p>
        </div>
      </div>
    </div>
  );
};

AboutPage.propTypes = {};

export default AboutPage;
