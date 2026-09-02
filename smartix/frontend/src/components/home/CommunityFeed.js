import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Newspaper, Clock, Eye, ArrowRight, 
  ExternalLink, TrendingUp, Globe,
  Twitter, Facebook, Linkedin, Share2
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import PropTypes from 'prop-types';

const NewsSection = ({ news = [] }) => {
  // Données de démonstration avec années 2025-2026
  const demoNews = [
    {
      id: '1',
      title: 'OpenAI dévoile GPT-5 avec des capacités multimodales avancées',
      source: 'TechCrunch',
      sourceIcon: '📱',
      category: 'IA',
      image: null,
      readTime: 5,
      url: '#',
      publishedAt: '2026-03-15T08:30:00Z',
      trending: true
    },
    {
      id: '2',
      title: 'La RDC lance un programme national de formation au numérique',
      source: 'RFI',
      sourceIcon: '📻',
      category: 'Tech',
      image: null,
      readTime: 4,
      url: '#',
      publishedAt: '2026-03-14T14:20:00Z',
      trending: true
    },
    {
      id: '3',
      title: 'Les startups africaines lèvent 2,5 milliards $ au premier trimestre 2026',
      source: 'Reuters',
      sourceIcon: '📰',
      category: 'Économie',
      image: null,
      readTime: 6,
      url: '#',
      publishedAt: '2026-03-13T11:45:00Z',
      trending: false
    },
    {
      id: '4',
      title: 'React 19 introduit le compilateur natif et améliore les performances',
      source: 'Dev.to',
      sourceIcon: '💻',
      category: 'Développement',
      image: null,
      readTime: 7,
      url: '#',
      publishedAt: '2026-03-12T09:15:00Z',
      trending: true
    },
    {
      id: '5',
      title: 'L\'intelligence artificielle générative crée 2 millions d\'emplois en Afrique',
      source: 'Le Monde',
      sourceIcon: '📰',
      category: 'IA',
      image: null,
      readTime: 8,
      url: '#',
      publishedAt: '2026-03-11T16:30:00Z',
      trending: false
    },
    {
      id: '6',
      title: 'Google annonce Android 16 avec des fonctionnalités IA natives',
      source: 'The Verge',
      sourceIcon: '📱',
      category: 'Mobile',
      image: null,
      readTime: 5,
      url: '#',
      publishedAt: '2026-03-10T10:00:00Z',
      trending: false
    },
    {
      id: '7',
      title: 'Kinshasa accueille le premier sommet africain de l\'innovation numérique',
      source: 'BBC',
      sourceIcon: '📺',
      category: 'Événement',
      image: null,
      readTime: 6,
      url: '#',
      publishedAt: '2025-12-05T13:20:00Z',
      trending: false
    },
    {
      id: '8',
      title: 'Les universités congolaises lancent des cursus spécialisés en IA',
      source: 'Actualité.cd',
      sourceIcon: '📰',
      category: 'Éducation',
      image: null,
      readTime: 4,
      url: '#',
      publishedAt: '2025-11-28T09:45:00Z',
      trending: false
    }
  ];

  const displayNews = news.length > 0 ? news : demoNews;

  // Fonction pour formater la date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    
    if (diffDays === 0) {
      return "Aujourd'hui";
    } else if (diffDays === 1) {
      return "Hier";
    } else if (diffDays < 7) {
      return `Il y a ${diffDays} jours`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    } else if (diffMonths < 12) {
      return `Il y a ${diffMonths} mois`;
    } else {
      return date.toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  // Catégories disponibles
  const categories = ['Toutes', 'IA', 'Tech', 'Développement', 'Mobile', 'Économie', 'Éducation', 'Événement'];

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">📰 Actualités Tech</h2>
            <p className="text-sm text-muted-foreground">Les dernières nouvelles de la tech en 2025-2026</p>
          </div>
        </div>
        <Link to="/news">
          <Button variant="ghost" className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 font-bold">
            Voir tout <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Sources d'actualités */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['BBC', 'RFI', 'Reuters', 'Le Monde', 'TechCrunch', 'The Verge', 'Actualité.cd'].map((source) => (
          <Badge key={source} variant="outline" className="px-3 py-1 text-xs cursor-pointer hover:bg-yellow-500/10 hover:border-yellow-500/30 transition-colors">
            {source}
          </Badge>
        ))}
      </div>

      {/* Tabs par catégorie */}
      <Tabs defaultValue="Toutes" className="w-full">
        <TabsList className="mb-6 flex flex-wrap h-auto">
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayNews
                .filter(item => cat === 'Toutes' || item.category === cat)
                .slice(0, 4)
                .map((item) => (
                  <NewsCard key={item.id} item={item} formatDate={formatDate} />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Article à la une */}
      <div className="mt-8">
        <Card className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Badge className="mb-3 bg-yellow-500/20 text-yellow-400 border-0">À LA UNE</Badge>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                L'écosystème tech africain en plein essor : 5 tendances majeures pour 2026
              </h3>
              <p className="text-muted-foreground mb-4">
                De Lagos à Nairobi en passant par Kinshasa, l'Afrique devient un hub technologique mondial. 
                Découvrez les innovations qui transforment le continent en 2026.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" /> 8 min de lecture
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="w-4 h-4" /> 12.5k vues
                </span>
                <Button variant="link" className="text-yellow-400 p-0">
                  Lire l'article <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="w-full h-32 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                <Newspaper className="w-12 h-12 text-yellow-400/50" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Newsletter */}
      <div className="mt-8 text-center">
        <Card className="p-6 bg-card/60 border border-border/30">
          <h3 className="font-bold text-foreground mb-2">📬 Restez informé</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Recevez chaque semaine les actualités tech de 2025-2026
          </p>
          <div className="flex max-w-md mx-auto gap-2">
            <input
              type="email"
              placeholder="Votre email"
              className="flex-1 px-4 py-2 bg-card/40 border border-border/30 rounded-lg text-foreground placeholder:text-muted-foreground/50"
            />
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white whitespace-nowrap">
              S'abonner
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            En vous abonnant, vous acceptez de recevoir notre newsletter
          </p>
        </Card>
      </div>
    </div>
  );
};

// Composant NewsCard interne
const NewsCard = ({ item, formatDate }) => {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer">
      <Card className="bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 h-full flex flex-col">
        <div className="h-32 bg-gradient-to-br from-gray-700 to-gray-900 rounded-t-xl relative">
          {item.trending && (
            <div className="absolute top-3 right-3">
              <Badge variant="outline" className="bg-orange-500/80 text-white border-0 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Tendance
              </Badge>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="text-2xl">{item.sourceIcon}</span>
          </div>
        </div>
        
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {item.category}
            </Badge>
            <span className="text-xs text-muted-foreground">{item.source}</span>
          </div>
          
          <h3 className="font-bold text-foreground text-sm mb-2 line-clamp-2 flex-1">
            {item.title}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {item.readTime} min
            </span>
            <span>{formatDate(item.publishedAt)}</span>
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-yellow-400">Lire l'article</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
      </Card>
    </a>
  );
};

// PropTypes
NewsSection.propTypes = {
  news: PropTypes.array
};

export default NewsSection;
NewsCard.propTypes = {
  item: PropTypes.object.isRequired,
  formatDate: PropTypes.any.isRequired,
};
