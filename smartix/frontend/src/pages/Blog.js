import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Sparkles, BookOpen, TrendingUp, Lightbulb, Clock,
  ArrowLeft, ArrowRight, Search, Calendar, User, Loader2,
  Zap, Users, ShoppingBag, Newspaper, Brain, Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const Blog = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { key: 'all', label: 'Tous les articles', icon: Sparkles, color: 'bg-gray-100 text-gray-700' },
    { key: 'apprentissage', label: 'Apprendre', icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
    { key: 'creation', label: 'Créer', icon: Zap, color: 'bg-orange-100 text-orange-700' },
    { key: 'communauté', label: 'Communauté', icon: Users, color: 'bg-purple-100 text-purple-700' },
    { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, color: 'bg-green-100 text-green-700' },
    { key: 'actualites', label: 'Actualités', icon: Newspaper, color: 'bg-red-100 text-red-700' },
    { key: 'ia', label: 'Intelligence Artificielle', icon: Brain, color: 'bg-indigo-100 text-indigo-700' }
  ];

  // ✅ Images réelles (Unsplash)
  const articleImages = {
    "💼": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop",
    "📚": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=300&fit=crop",
    "🤖": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop",
    "🔢": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop",
    "⭐": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=300&fit=crop",
    "🌍": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop",
    "⏰": "https://images.unsplash.com/photo-1506784693919-8dbba1bb9439?w=400&h=300&fit=crop",
    "💻": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop",
    "🚀": "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=400&h=300&fit=crop",
    "🎨": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
    "💡": "https://images.unsplash.com/photo-1453738773917-9c3eff1db985?w=400&h=300&fit=crop",
    "👥": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop",
    "🛒": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop",
    "📰": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=300&fit=crop",
    "🧠": "https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=400&h=300&fit=crop"
  };

  // ✅ Articles enrichis avec les 5 piliers de Smartix
  const articles = [
    // Apprendre
    {
      id: 1,
      title: "Les 5 erreurs courantes en comptabilité OHADA",
      excerpt: "Découvre les erreurs les plus fréquentes que font les étudiants en comptabilité OHADA et comment les éviter pour réussir tes examens.",
      category: "apprentissage",
      author: "Kiriza Mushaga",
      date: "8 Nov 2025",
      readTime: "5 min",
      image: "💼",
      slug: "erreurs-comptabilite-ohada",
      pillar: "apprendre"
    },
    {
      id: 2,
      title: "Comment réviser efficacement pour ton examen OHADA",
      excerpt: "Une méthode éprouvée pour maximiser ta rétention et obtenir d'excellents résultats à tes examens de comptabilité.",
      category: "apprentissage",
      author: "Équipe Smartix",
      date: "6 Nov 2025",
      readTime: "8 min",
      image: "📚",
      slug: "reviser-efficacement-examen-ohada",
      pillar: "apprendre"
    },
    {
      id: 8,
      title: "Maîtriser la programmation Python en 30 jours",
      excerpt: "Un plan d'apprentissage structuré pour passer de débutant à intermédiaire en Python en un mois.",
      category: "apprentissage",
      author: "Dev. Hassan Omar",
      date: "26 Oct 2025",
      readTime: "9 min",
      image: "💻",
      slug: "maitriser-python-30-jours",
      pillar: "apprendre"
    },
    
    // Créer
    {
      id: 10,
      title: "Créer ta première application avec l'IA",
      excerpt: "Guide complet pour créer ton premier projet avec l'assistant IA de Smartix, même sans expérience en programmation.",
      category: "creation",
      author: "Équipe Smartix",
      date: "12 Nov 2025",
      readTime: "12 min",
      image: "🤖",
      slug: "creer-premiere-application-ia",
      pillar: "creer"
    },
    {
      id: 11,
      title: "Vibe-Coding : La nouvelle façon de coder",
      excerpt: "Découvre comment le vibe-coding transforme l'expérience de développement et rend la programmation accessible à tous.",
      category: "creation",
      author: "Tech Team",
      date: "10 Nov 2025",
      readTime: "8 min",
      image: "🎨",
      slug: "vibe-coding-nouvelle-facon-coder",
      pillar: "creer"
    },
    {
      id: 12,
      title: "10 templates de projets pour booster ta productivité",
      excerpt: "Des templates prêts à l'emploi pour démarrer rapidement tes projets sur Smartix.",
      category: "creation",
      author: "Dev. Sarah",
      date: "5 Nov 2025",
      readTime: "6 min",
      image: "💡",
      slug: "templates-projets-productivite",
      pillar: "creer"
    },
    
    // Communauté
    {
      id: 5,
      title: "Témoignage : De la 3ème à Major de promotion",
      excerpt: "L'histoire inspirante de Marie qui est passée de la dernière de sa classe à major grâce à Smartix.",
      category: "temoignages",
      author: "Marie Dubois",
      date: "1 Nov 2025",
      readTime: "4 min",
      image: "⭐",
      slug: "temoignage-major-promotion",
      pillar: "communauté"
    },
    {
      id: 13,
      title: "Comment trouver des partenaires d'étude sur Smartix",
      excerpt: "Astuces pour te connecter avec d'autres étudiants et créer des groupes d'étude efficaces.",
      category: "communauté",
      author: "Community Team",
      date: "3 Nov 2025",
      readTime: "5 min",
      image: "👥",
      slug: "trouver-partenaires-etude",
      pillar: "communauté"
    },
    
    // Marketplace
    {
      id: 14,
      title: "Vendre tes premiers produits numériques",
      excerpt: "Guide étape par étape pour lancer ta boutique et vendre tes créations sur le marketplace Smartix.",
      category: "marketplace",
      author: "Business Team",
      date: "7 Nov 2025",
      readTime: "10 min",
      image: "🛒",
      slug: "vendre-premiers-produits-numeriques",
      pillar: "marketplace"
    },
    {
      id: 15,
      title: "Comment fixer le prix de tes formations en ligne",
      excerpt: "Stratégies de pricing pour maximiser tes revenus tout en restant accessible.",
      category: "marketplace",
      author: "Expert Marketing",
      date: "9 Nov 2025",
      readTime: "7 min",
      image: "💡",
      slug: "fixer-prix-formations",
      pillar: "marketplace"
    },
    
    // Actualités
    {
      id: 3,
      title: "L'impact de l'IA dans la formation comptable",
      excerpt: "Comment l'intelligence artificielle révolutionne l'apprentissage de la comptabilité en Afrique et prépare les étudiants au futur.",
      category: "actualites",
      author: "Équipe Smartix",
      date: "4 Nov 2025",
      readTime: "6 min",
      image: "🤖",
      slug: "impact-ia-formation-comptable",
      pillar: "actualites"
    },
    {
      id: 6,
      title: "Les nouvelles tendances de l'enseignement en Afrique",
      excerpt: "Exploration des innovations pédagogiques qui transforment l'éducation sur le continent africain.",
      category: "actualites",
      author: "Dr. Amadou Diallo",
      date: "30 Oct 2025",
      readTime: "10 min",
      image: "🌍",
      slug: "tendances-enseignement-afrique",
      pillar: "actualites"
    },
    {
      id: 9,
      title: "Les métiers d'avenir dans la comptabilité digitale",
      excerpt: "Découvre les opportunités professionnelles offertes par la transformation numérique du secteur comptable.",
      category: "actualites",
      author: "Équipe Smartix",
      date: "24 Oct 2025",
      readTime: "7 min",
      image: "🚀",
      slug: "metiers-avenir-comptabilite-digitale",
      pillar: "actualites"
    },
    
    // IA
    {
      id: 16,
      title: "Comment l'IA personnalise ton apprentissage",
      excerpt: "Découvre comment notre assistant IA adapte les contenus à ton niveau et ton rythme.",
      category: "ia",
      author: "AI Team",
      date: "15 Nov 2025",
      readTime: "8 min",
      image: "🧠",
      slug: "ia-personnalise-apprentissage",
      pillar: "ia"
    },
    {
      id: 17,
      title: "Prompt Engineering : Les meilleures pratiques",
      excerpt: "Maîtrise l'art de communiquer avec l'IA pour obtenir des réponses précises et pertinentes.",
      category: "ia",
      author: "AI Expert",
      date: "14 Nov 2025",
      readTime: "9 min",
      image: "💡",
      slug: "prompt-engineering-meilleures-pratiques",
      pillar: "ia"
    }
  ];

  // ✅ Conseils pour la communauté
  const tips = [
    { title: "Partage tes projets", description: "Gagne en visibilité et reçois des retours constructifs", icon: Rocket },
    { title: "Aide les autres", description: "Plus tu aides, plus tu es visible", icon: Users },
    { title: "Crée du contenu", description: "Devient créateur sur Smartix", icon: Sparkles },
    { title: "Participe aux défis", description: "Des challenges chaque mois", icon: Zap }
  ];

  const handleArticleClick = (slug) => {
    navigate(`/blog/${slug}`);
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    
    if (!newsletterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail)) {
      toast.error('Email invalide', {
        description: 'Veuillez entrer une adresse email valide'
      });
      return;
    }
    
    setIsSubscribing(true);
    
    setTimeout(() => {
      toast.success('Inscription réussie !', {
        description: 'Vous recevrez nos prochains articles par email'
      });
      setNewsletterEmail('');
      setIsSubscribing(false);
    }, 1000);
  };

  // ✅ Filtrer par catégorie et recherche
  const filteredArticles = articles.filter(article => {
    const matchCategory = selectedCategory === 'all' || article.category === selectedCategory;
    const matchSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getCategoryIcon = (categoryKey) => {
    const cat = categories.find(c => c.key === categoryKey);
    if (!cat) return Sparkles;
    switch (cat.icon) {
      case BookOpen: return BookOpen;
      case Zap: return Zap;
      case Users: return Users;
      case ShoppingBag: return ShoppingBag;
      case Newspaper: return Newspaper;
      case Brain: return Brain;
      default: return Sparkles;
    }
  };

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
            <BookOpen className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold">Blog & Actualités</h1>
          </div>
          <p className="text-xl text-white/90 max-w-3xl">
            Découvre les dernières actualités, conseils et ressources pour réussir sur Smartix
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Search Bar */}
        <div className="mb-12">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00B894] focus:border-transparent"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Catégories</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                    selectedCategory === cat.key
                      ? 'bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white shadow-lg scale-105'
                      : `${cat.color} hover:shadow-md`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-gradient-to-r from-[#00B894]/10 to-[#0984E3]/10 rounded-3xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">💡 Conseils pour réussir sur Smartix</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {tips.map((tip, i) => (
              <div key={i} className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-[#00B894]/20 flex items-center justify-center mx-auto mb-3">
                  <tip.icon className="w-6 h-6 text-[#00B894]" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">{tip.title}</h3>
                <p className="text-sm text-gray-600">{tip.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {filteredArticles.map((article) => {
            const CategoryIcon = getCategoryIcon(article.category);
            return (
              <div 
                key={article.id} 
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer"
                onClick={() => handleArticleClick(article.slug)}
              >
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                  <img 
                    src={articleImages[article.image] || articleImages["📚"]} 
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                  />
                  <Badge className={`absolute top-4 right-4 ${categories.find(c => c.key === article.category)?.color || 'bg-gray-100 text-gray-700'}`}>
                    <CategoryIcon className="w-3 h-3 inline mr-1" />
                    {categories.find(c => c.key === article.category)?.label || article.category}
                  </Badge>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#00B894] transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="truncate max-w-[100px]">{article.author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{article.readTime}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full group-hover:bg-[#00B894] group-hover:text-white group-hover:border-[#00B894] transition-all">
                    Lire la suite
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredArticles.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucun article ne correspond à ta recherche</p>
          </div>
        )}

        {/* Newsletter */}
        <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] rounded-3xl p-12 text-white text-center">
          <Lightbulb className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">Reste informé</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Reçois nos meilleurs articles, conseils et actualités directement dans ta boîte mail
          </p>
          <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto flex gap-3">
            <input
              type="email"
              placeholder="ton.email@example.com"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="flex-1 px-6 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <Button 
              type="submit"
              disabled={isSubscribing}
              size="lg" 
              className="bg-white text-[#00B894] hover:bg-gray-50 px-8 disabled:opacity-50"
            >
              {isSubscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : "S'abonner"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

Blog.propTypes = {};

export default Blog;
