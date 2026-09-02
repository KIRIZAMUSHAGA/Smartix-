import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Award, Star, Users, Download, DollarSign,
  TrendingUp, ArrowRight, MapPin, Briefcase,
  Twitter, Github, Linkedin, Globe,
  CheckCircle, Plus, MessageSquare
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import PropTypes from 'prop-types';

const CreatorsSection = ({ creators = [] }) => {
  // État local pour gérer les abonnements
  const [following, setFollowing] = useState({});

  // Données de démonstration avec années 2025-2026
  const demoCreators = [
    {
      id: '1',
      name: 'Jean Dupont',
      username: '@jeandupont',
      avatar: null,
      role: 'Développeur Full-Stack',
      location: 'Kinshasa, RDC',
      products: 24,
      followers: 15400,
      earnings: 45600000, // 45.6M FC
      rating: 4.9,
      downloads: 34500,
      badges: ['Top Créateur', 'Expert React', 'Formateur'],
      social: {
        twitter: '@jeandupont',
        github: 'jeandupont',
        linkedin: 'jeandupont',
        website: 'https://jeandupont.cd'
      },
      topProducts: [
        { id: 'p1', name: 'Formation React Complète', price: 149500, sales: 1234 },
        { id: 'p2', name: 'Template Dashboard Pro', price: 49900, sales: 3456 }
      ],
      joinedAt: '2025-01-15'
    },
    {
      id: '2',
      name: 'Marie Martin',
      username: '@mariemartin',
      avatar: null,
      role: 'Designer UX/UI',
      location: 'Lubumbashi, RDC',
      products: 18,
      followers: 12300,
      earnings: 38400000, // 38.4M FC
      rating: 4.8,
      downloads: 28900,
      badges: ['Top Designer', 'Expert Figma'],
      social: {
        twitter: '@mariemartin',
        github: 'mariemartin',
        linkedin: 'mariemartin',
        website: 'https://mariemartin.cd'
      },
      topProducts: [
        { id: 'p3', name: 'UI Kit Mobile', price: 29900, sales: 2345 },
        { id: 'p4', name: 'Template Landing Page', price: 19900, sales: 4567 }
      ],
      joinedAt: '2025-03-20'
    },
    {
      id: '3',
      name: 'Pierre Durand',
      username: '@pierredurand',
      avatar: null,
      role: 'Formateur IA & Data Science',
      location: 'Goma, RDC',
      products: 15,
      followers: 9800,
      earnings: 32400000, // 32.4M FC
      rating: 4.9,
      downloads: 19800,
      badges: ['Expert IA', 'Top Formateur'],
      social: {
        twitter: '@pierredurand',
        github: 'pierredurand',
        linkedin: 'pierredurand',
        website: 'https://pierredurand.cd'
      },
      topProducts: [
        { id: 'p5', name: 'Formation Machine Learning', price: 199500, sales: 987 },
        { id: 'p6', name: 'Ebook Data Science', price: 39500, sales: 2345 }
      ],
      joinedAt: '2025-06-10'
    },
    {
      id: '4',
      name: 'Sophie Bernard',
      username: '@sophiebernard',
      avatar: null,
      role: 'Créatrice de Templates',
      location: 'Bukavu, RDC',
      products: 32,
      followers: 21100,
      earnings: 52300000, // 52.3M FC
      rating: 4.7,
      downloads: 56700,
      badges: ['Top Vendeur', 'Expert Templates'],
      social: {
        twitter: '@sophiebernard',
        github: 'sophiebernard',
        linkedin: 'sophiebernard',
        website: 'https://sophiebernard.cd'
      },
      topProducts: [
        { id: 'p7', name: 'Bundle Templates E-commerce', price: 89900, sales: 5678 },
        { id: 'p8', name: 'Pack Sites Vitrines', price: 59900, sales: 7890 }
      ],
      joinedAt: '2025-09-05'
    },
    {
      id: '5',
      name: 'Thomas Lukusa',
      username: '@thomaslukusa',
      avatar: null,
      role: 'Développeur Mobile',
      location: 'Matadi, RDC',
      products: 12,
      followers: 6700,
      earnings: 21800000, // 21.8M FC
      rating: 4.8,
      downloads: 12300,
      badges: ['Expert React Native'],
      social: {
        twitter: '@thomaslukusa',
        github: 'thomaslukusa',
        linkedin: 'thomaslukusa',
        website: 'https://thomaslukusa.cd'
      },
      topProducts: [
        { id: 'p9', name: 'Template App Météo', price: 34900, sales: 1234 },
        { id: 'p10', name: 'Formation React Native', price: 129500, sales: 567 }
      ],
      joinedAt: '2026-01-20'
    },
    {
      id: '6',
      name: 'Grace Mbuyi',
      username: '@gracembuyi',
      avatar: null,
      role: 'Marketing Digital',
      location: 'Kinshasa, RDC',
      products: 21,
      followers: 14200,
      earnings: 36700000, // 36.7M FC
      rating: 4.8,
      downloads: 23400,
      badges: ['Top Marketing', 'Stratège Digital'],
      social: {
        twitter: '@gracembuyi',
        github: 'gracembuyi',
        linkedin: 'gracembuyi',
        website: 'https://gracembuyi.cd'
      },
      topProducts: [
        { id: 'p11', name: 'Formation Marketing Digital', price: 89500, sales: 2345 },
        { id: 'p12', name: 'Template Stratégie Social Media', price: 29900, sales: 4567 }
      ],
      joinedAt: '2025-11-12'
    }
  ];

  const displayCreators = creators.length > 0 ? creators : demoCreators;

  // Fonction pour formater les nombres
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // Fonction pour formater l'argent en FC
  const formatMoney = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC';
  };

  // Fonction pour suivre/unfollow
  const toggleFollow = (creatorId) => {
    setFollowing(prev => ({
      ...prev,
      [creatorId]: !prev[creatorId]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">⭐ Créateurs populaires</h2>
            <p className="text-sm text-muted-foreground">Découvrez les talents de la communauté</p>
          </div>
        </div>
        <Link to="/creators">
          <Button variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 font-bold">
            Voir tout <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Tabs pour les catégories */}
      <Tabs defaultValue="top" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="top">Top créateurs</TabsTrigger>
          <TabsTrigger value="rising">En progression</TabsTrigger>
          <TabsTrigger value="following">Abonnements</TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayCreators.slice(0, 3).map((creator) => (
              <CreatorCard 
                key={creator.id} 
                creator={creator} 
                isFollowing={following[creator.id]}
                onFollow={toggleFollow}
                formatNumber={formatNumber}
                formatMoney={formatMoney}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rising">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayCreators.slice(3, 6).map((creator) => (
              <CreatorCard 
                key={creator.id} 
                creator={creator} 
                isFollowing={following[creator.id]}
                onFollow={toggleFollow}
                formatNumber={formatNumber}
                formatMoney={formatMoney}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="following">
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-bold text-foreground mb-2">Aucun abonnement</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Suivez des créateurs pour voir leurs publications
            </p>
            <Button variant="outline" className="border-purple-500/30 text-purple-400">
              Explorer les créateurs
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Section "Nouveaux créateurs" */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-foreground mb-4">🚀 Nouveaux créateurs 2026</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {displayCreators.slice(4, 8).map((creator) => (
            <Card key={creator.id} className="p-4 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
              <div className="text-center">
                <Avatar className="w-16 h-16 mx-auto mb-3">
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {creator.name.charAt(0)}
                  </div>
                </Avatar>
                <h4 className="font-bold text-foreground mb-1">{creator.name}</h4>
                <p className="text-xs text-muted-foreground mb-2">{creator.role}</p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
                  <MapPin className="w-3 h-3" />
                  <span>{creator.location}</span>
                </div>
                <Button 
                  size="sm" 
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                  onClick={() => toggleFollow(creator.id)}
                >
                  {following[creator.id] ? '✓ Abonné' : 'Suivre'} <Plus className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-purple-400">1 234</div>
          <div className="text-xs text-muted-foreground">Créateurs actifs</div>
        </Card>
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-green-400">45.6k</div>
          <div className="text-xs text-muted-foreground">Produits vendus</div>
        </Card>
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-yellow-400">4.8 ⭐</div>
          <div className="text-xs text-muted-foreground">Note moyenne</div>
        </Card>
        <Card className="p-4 bg-card/60 border border-border/30 text-center">
          <div className="text-2xl font-black text-blue-400">2.3M</div>
          <div className="text-xs text-muted-foreground">Téléchargements</div>
        </Card>
      </div>
    </div>
  );
};

// Composant CreatorCard interne
const CreatorCard = ({ creator, isFollowing, onFollow, formatNumber, formatMoney }) => {
  return (
    <Card className="p-5 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Avatar className="w-16 h-16 flex-shrink-0">
          {creator.avatar ? (
            <img src={creator.avatar} alt={creator.name} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {creator.name.charAt(0)}
            </div>
          )}
        </Avatar>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-bold text-foreground">{creator.name}</h3>
              <p className="text-xs text-muted-foreground">{creator.username}</p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
              {creator.rating} ⭐
            </Badge>
          </div>

          <p className="text-xs text-foreground mb-2">{creator.role}</p>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <MapPin className="w-3 h-3" />
            <span>{creator.location}</span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1 mb-3">
            {creator.badges.map((badge, index) => (
              <Badge key={index} variant="outline" className="text-[8px] px-1.5 py-0">
                {badge}
              </Badge>
            ))}
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div>
              <div className="text-sm font-bold text-foreground">{creator.products}</div>
              <div className="text-[10px] text-muted-foreground">Produits</div>
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{formatNumber(creator.followers)}</div>
              <div className="text-[10px] text-muted-foreground">Abonnés</div>
            </div>
            <div>
              <div className="text-sm font-bold text-green-400">{formatNumber(creator.downloads)}</div>
              <div className="text-[10px] text-muted-foreground">Téléch.</div>
            </div>
          </div>

          {/* Top produits */}
          <div className="space-y-1 mb-3">
            {creator.topProducts.slice(0, 2).map((product) => (
              <div key={product.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[120px]">{product.name}</span>
                <span className="font-bold text-green-400">{formatMoney(product.price)}</span>
              </div>
            ))}
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className={`flex-1 ${isFollowing ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-500 hover:bg-purple-600'} text-white`}
              onClick={() => onFollow(creator.id)}
            >
              {isFollowing ? '✓ Abonné' : 'Suivre'}
            </Button>
            <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400">
              <MessageSquare className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

// PropTypes
CreatorsSection.propTypes = {
  creators: PropTypes.array
};

export default CreatorsSection;
CreatorCard.propTypes = {
  creator: PropTypes.any.isRequired,
  isFollowing: PropTypes.bool.isRequired,
  onFollow: PropTypes.func.isRequired,
  formatNumber: PropTypes.any.isRequired,
  formatMoney: PropTypes.any.isRequired,
};
