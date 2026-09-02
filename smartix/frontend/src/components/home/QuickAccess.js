import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, Code2, Bell, DollarSign,
  BookOpen, Users, ShoppingBag, Newspaper
} from 'lucide-react';
import { Card } from '../ui/card';
import PropTypes from 'prop-types';

const QuickAccess = ({ user, lastCourse, creatorStats }) => {
  // Si l'utilisateur n'est pas connecté, on n'affiche pas la section
  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 -mt-8 mb-12 relative z-20">
      <Card className="p-4 bg-card/80 border border-border/50 shadow-2xl backdrop-blur-xl rounded-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          
          {/* Continuer mon cours */}
          <Link to="/courses/last" className="group">
            <div className="flex flex-col items-center p-3 hover:bg-card/80 rounded-xl transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#ff6b35]/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-[#ff6b35]" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">Continuer</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">
                  {lastCourse?.title || 'Aucun cours'}
                </div>
              </div>
            </div>
          </Link>

          {/* Dernier projet */}
          <Link to="/vibe/projects/last" className="group">
            <div className="flex flex-col items-center p-3 hover:bg-card/80 rounded-xl transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Code2 className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">Projet</div>
                <div className="text-[10px] text-muted-foreground">Ouvrir l'éditeur</div>
              </div>
            </div>
          </Link>

          {/* Notifications */}
          <Link to="/notifications" className="group">
            <div className="flex flex-col items-center p-3 hover:bg-card/80 rounded-xl transition-all relative">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              {/* Badge de notifications (exemple) */}
              {user?.notifications > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">
                  {user.notifications}
                </span>
              )}
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">Notifications</div>
                <div className="text-[10px] text-muted-foreground">
                  {user?.notifications || 0} non lues
                </div>
              </div>
            </div>
          </Link>

          {/* Mes ventes */}
          <Link to="/seller/dashboard" className="group">
            <div className="flex flex-col items-center p-3 hover:bg-card/80 rounded-xl transition-all">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">Ventes</div>
                <div className="text-[10px] text-muted-foreground">
                  {creatorStats?.totalEarnings || 0}€
                </div>
              </div>
            </div>
          </Link>

          {/* Accès rapide aux cours */}
          <Link to="/courses" className="group">
            <div className="flex flex-col items-center p-3 hover:bg-card/80 rounded-xl transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">Cours</div>
                <div className="text-[10px] text-muted-foreground">Explorer</div>
              </div>
            </div>
          </Link>

          {/* Communauté */}
          <Link to="/feed" className="group">
            <div className="flex flex-col items-center p-3 hover:bg-card/80 rounded-xl transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">Communauté</div>
                <div className="text-[10px] text-muted-foreground">Feed</div>
              </div>
            </div>
          </Link>

        </div>
      </Card>
    </div>
  );
};

// PropTypes pour la documentation (optionnel)
QuickAccess.propTypes = {
  user: PropTypes.object,
  lastCourse: PropTypes.shape({
    title: PropTypes.string
  }),
  creatorStats: PropTypes.shape({
    totalEarnings: PropTypes.number
  })
};

export default QuickAccess;
