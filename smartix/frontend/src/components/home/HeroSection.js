import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, BookOpen, Code2, Users, ShoppingBag, 
  Play, Brain, ArrowRight 
} from 'lucide-react';
import { Button } from '../ui/button';
import PropTypes from 'prop-types';

const HeroSection = () => {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-background dark:to-card text-white px-4 py-16 sm:py-20 relative overflow-hidden">
      {/* Éléments de fond décoratifs */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-0 w-64 h-64 bg-[#ff6b35] rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center">
          {/* Logo / Titre principal */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-4 text-white">
            Smartix
          </h1>
          
          {/* Les 5 piliers */}
          <p className="text-2xl sm:text-3xl font-bold mb-3 text-[#ff6b35]">
            Apprendre • Créer • Partager • Vendre • S’informer
          </p>
          
          {/* Sous-titre */}
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-8">
            Plateforme tout-en-un pour apprendre, créer des projets, 
            partager avec une communauté et vendre des produits numériques.
          </p>
          
          {/* Boutons d'action */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/courses">
              <Button 
                size="lg" 
                className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-bold px-8 py-6 text-lg rounded-xl transition-all hover:scale-105"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Commencer à apprendre
              </Button>
            </Link>
            
            <Link to="/vibe/projects/create">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 font-bold px-8 py-6 text-lg rounded-xl transition-all hover:scale-105"
              >
                <Code2 className="w-5 h-5 mr-2" />
                Créer un projet
              </Button>
            </Link>
            
            <Link to="/feed">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 font-bold px-8 py-6 text-lg rounded-xl transition-all hover:scale-105"
              >
                <Users className="w-5 h-5 mr-2" />
                Explorer la communauté
              </Button>
            </Link>
            
            <Link to="/smartix-store">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 font-bold px-8 py-6 text-lg rounded-xl transition-all hover:scale-105"
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                Voir la marketplace
              </Button>
            </Link>
          </div>
          
          {/* Flèche de scroll (optionnel) */}
          <div className="mt-12 animate-bounce">
            <ArrowRight className="w-6 h-6 mx-auto text-white/50 rotate-90" />
          </div>
        </div>
      </div>
    </div>
  );
};

HeroSection.propTypes = {};

export default HeroSection;
