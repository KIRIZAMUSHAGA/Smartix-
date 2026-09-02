import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Code2, Users, ShoppingBag, Newspaper,
  ArrowRight, Sparkles
} from 'lucide-react';
import { Card } from '../ui/card';
import PropTypes from 'prop-types';

const PillarsSection = () => {
  // Les 5 piliers de Smartix
  const pillars = [
    {
      id: 'learn',
      icon: BookOpen,
      title: '📚 Apprendre',
      description: 'Cours en ligne, exercices pratiques, quiz, progression personnalisée',
      color: '#ff6b35',
      bgColor: 'bg-[#ff6b35]/10',
      path: '/courses'
    },
    {
      id: 'create',
      icon: Code2,
      title: '⚡ Créer',
      description: 'IDE intégré, vibe-coding avec IA, templates, build mobile et web',
      color: '#a78bfa',
      bgColor: 'bg-purple-500/10',
      path: '/vibe'
    },
    {
      id: 'community',
      icon: Users,
      title: '👥 Communauté',
      description: 'Publications, discussions, commentaires, partage de projets',
      color: '#60a5fa',
      bgColor: 'bg-blue-500/10',
      path: '/feed'
    },
    {
      id: 'marketplace',
      icon: ShoppingBag,
      title: '🛒 Marketplace',
      description: 'Vendez vos ebooks, formations, templates, outils et ressources',
      color: '#34d399',
      bgColor: 'bg-green-500/10',
      path: '/smartix-store'
    },
    {
      id: 'news',
      icon: Newspaper,
      title: '📰 Actualités',
      description: 'Flux d\'actualités BBC, RFI, Reuters, Le Monde sur la tech',
      color: '#fbbf24',
      bgColor: 'bg-yellow-500/10',
      path: '/news'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-3">
          L'écosystème <span className="text-[#ff6b35]">Smartix</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Une plateforme tout-en-un qui couvre tous les aspects de votre vie numérique
        </p>
      </div>

      {/* Grille des 5 piliers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          
          return (
            <Link to={pillar.path} key={pillar.id}>
              <Card className="p-6 bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 text-center group cursor-pointer h-full flex flex-col">
                {/* Icône avec fond coloré */}
                <div 
                  className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${pillar.bgColor} group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-8 h-8" style={{ color: pillar.color }} />
                </div>
                
                {/* Titre */}
                <h3 className="font-bold text-foreground mb-2 text-lg">
                  {pillar.title}
                </h3>
                
                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {pillar.description}
                </p>
                
                {/* Lien "Découvrir" */}
                <div className="flex items-center justify-center gap-1 text-sm font-medium transition-all group-hover:gap-2">
                  <span style={{ color: pillar.color }}>Découvrir</span>
                  <ArrowRight className="w-4 h-4" style={{ color: pillar.color }} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Message de synthèse (optionnel) */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 bg-card/40 px-4 py-2 rounded-full">
          <Sparkles className="w-4 h-4 text-[#ff6b35]" />
          <span className="text-sm text-muted-foreground">
            Apprendre → Créer → Partager → Vendre → S'informer
          </span>
          <Sparkles className="w-4 h-4 text-[#ff6b35]" />
        </div>
      </div>
    </div>
  );
};

PillarsSection.propTypes = {};

export default PillarsSection;
