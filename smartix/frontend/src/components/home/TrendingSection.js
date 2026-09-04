import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Flame, TrendingUp, ArrowRight, Eye, ThumbsUp, 
  Download, MessageSquare, Star, Clock, Users,
  BookOpen, Code2, ShoppingBag, Newspaper
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import PropTypes from 'prop-types';

const TrendingSection = ({ items = [], showViewAll = true }) => {
  // Données de démonstration si aucune donnée n'est fournie
  const demoItems = [
    {
       id: '1',
      type: 'course',
      title: 'Introduction à React 18',
      subtitle: 'Par Jean Dupont',
      image: null,
      stats: { views: 1234, likes: 89, comments: 23 },
       trend: 59,
       ageLabel: 'Il y a 2h',
       interactions: 24,
       link: '/courses/1'
    },
    {
      id: '2',
      type: 'project',
      title: 'Application Météo',
      subtitle: 'Projet React + API',
      image: null,
      stats: { views: 3456, likes: 234, downloads: 56 },
       trend: 31,
       ageLabel: 'Il y a 5h',
       interactions: 43,
       link: '/vibe/projects'
    },
    {
      id: '3',
      type: 'product',
      title: 'Template Dashboard',
      subtitle: 'Admin panel responsive',
      image: null,
      stats: { views: 567, downloads: 89, rating: 4.8 },
       trend: 42,
       ageLabel: 'Il y a 6h',
       interactions: 18,
       link: '/marketplace'
    },
    {
      id: '4',
      type: 'post',
      title: 'Comment améliorer ses compétences en IA ?',
      subtitle: 'Discussion communautaire',
      image: null,
      stats: { likes: 456, comments: 78, shares: 23 },
       trend: 27,
       ageLabel: 'Il y a 8h',
       interactions: 36,
       link: '/feed'
    }
  ];

  const displayItems = items.length > 0 ? items : demoItems;

  // Fonction pour obtenir l'icône selon le type
  const getTypeIcon = (type) => {
    switch (type) {
      case 'course': return BookOpen;
      case 'project': return Code2;
      case 'product': return ShoppingBag;
      case 'post': return Users;
      case 'news': return Newspaper;
      default: return Flame;
    }
  };

  // Fonction pour obtenir la couleur selon le type
  const getTypeColor = (type) => {
    switch (type) {
      case 'course': return 'text-orange-400';
      case 'project': return 'text-purple-400';
      case 'product': return 'text-green-400';
      case 'post': return 'text-blue-400';
      case 'news': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  // Fonction pour obtenir le libellé selon le type
  const getTypeLabel = (type) => {
    switch (type) {
      case 'course': return '📚 Cours';
      case 'project': return '⚡ Projet';
      case 'product': return '🛒 Produit';
      case 'post': return '👥 Post';
      case 'news': return '📰 Actualité';
      default: return '🔥 Tendance';
    }
  };

  const getImageUrl = (item) =>
    item.coverImage ||
    item.cover_image ||
    item.coverUrl ||
    item.image ||
    item.image_url ||
    item.image_thumbnail_url ||
    item.image_original_url ||
    item.thumbnail_url ||
    item.cover_image ||
    item.preview_image ||
    item.thumbnail ||
    null;

  const getFallbackVisual = (type) => {
    switch (type) {
      case 'course':
        return 'from-orange-500/80 via-rose-500/60 to-slate-950';
      case 'project':
        return 'from-blue-600/85 via-purple-500/65 to-slate-950';
      case 'product':
        return 'from-emerald-500/80 via-cyan-500/55 to-slate-950';
      case 'post':
        return 'from-sky-500/80 via-indigo-500/55 to-slate-950';
      case 'news':
        return 'from-amber-500/80 via-orange-500/55 to-slate-950';
      default:
        return 'from-slate-600 via-slate-700 to-slate-950';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">🔥 Tendances sur Smartix</h2>
            <p className="text-sm text-muted-foreground">Ce qui est populaire en ce moment</p>
          </div>
        </div>
        {showViewAll && (
          <Link to="/trending">
            <Button variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 font-bold">
              Voir tout <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>

      {/* Grille des tendances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayItems.map((item) => {
          const TypeIcon = getTypeIcon(item.type);
          const typeColor = getTypeColor(item.type);
          const imageUrl = getImageUrl(item);
          const stats = item.stats || {};
          const trend = item.trend ?? 20;
          
          return (
            <Link to={item.link} key={item.id}>
              <Card className="bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 overflow-hidden group">
                
                {/* Image/En-tête avec dégradé */}
                <div 
                  className={`h-32 bg-gradient-to-br ${imageUrl ? 'from-slate-800 to-slate-950' : getFallbackVisual(item.type)} relative overflow-hidden`}
                  style={imageUrl ? {
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  } : undefined}
                >
                  {!imageUrl && (
                    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                      <div className="absolute -right-5 -bottom-8 h-32 w-32 rounded-full border-[18px] border-white/10" />
                      <TypeIcon className="absolute -right-3 -bottom-7 h-28 w-28 text-white/20" />
                      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />
                    </div>
                  )}
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                  
                  {/* Badge de type */}
                  <div className="absolute top-3 left-3">
                    <Badge variant="outline" className="bg-black/50 text-white border-0 backdrop-blur-sm flex items-center gap-1">
                      <TypeIcon className={`w-3 h-3 ${typeColor}`} />
                      <span>{getTypeLabel(item.type)}</span>
                    </Badge>
                  </div>
                  
                  {/* Icône de tendance */}
                  <div className="absolute bottom-3 right-3">
                    <div className="flex items-center gap-1 text-white/80 text-xs">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{trend}%</span>
                    </div>
                  </div>
                </div>

                {/* Contenu */}
                <div className="p-4">
                  <h3 className="font-bold text-foreground mb-1 line-clamp-1 group-hover:text-[#ff6b35] transition-colors">
                    {item.title}
                  </h3>
                  
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                      {item.subtitle}
                    </p>
                  )}

                  {/* Statistiques */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {stats.views !== undefined && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {stats.views.toLocaleString()}
                      </span>
                    )}
                    {stats.likes !== undefined && (
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" /> {stats.likes}
                      </span>
                    )}
                    {stats.downloads !== undefined && (
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" /> {stats.downloads}
                      </span>
                    )}
                    {stats.comments !== undefined && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {stats.comments}
                      </span>
                    )}
                    {stats.rating !== undefined && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400" /> {stats.rating}
                      </span>
                    )}
                  </div>

                  {/* Métadonnées supplémentaires */}
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{item.ageLabel || 'Mis à jour récemment'}</span>
                    <Users className="w-3 h-3 ml-2" />
                    <span>{item.interactions ?? '—'} interactions</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Message de tendance (optionnel) */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Les tendances sont mises à jour toutes les heures • 
          <span className="text-[#ff6b35] ml-1">Dernière mise à jour il y a 5 min</span>
        </p>
      </div>
    </div>
  );
};

// PropTypes pour la documentation
TrendingSection.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['course', 'project', 'product', 'post', 'news']).isRequired,
      title: PropTypes.string.isRequired,
      subtitle: PropTypes.string,
      image: PropTypes.string,
      stats: PropTypes.shape({
        views: PropTypes.number,
        likes: PropTypes.number,
        downloads: PropTypes.number,
        comments: PropTypes.number,
        rating: PropTypes.number
      }),
       link: PropTypes.string.isRequired,
       trend: PropTypes.number,
       ageLabel: PropTypes.string,
       interactions: PropTypes.number
    })
  ),
  showViewAll: PropTypes.bool
};

export default TrendingSection;
