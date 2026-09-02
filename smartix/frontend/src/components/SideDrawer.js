import React from 'react';
import { Link } from 'react-router-dom';
import {
  X, User, Settings, LogOut, BookOpen, Code2,
  Users, ShoppingBag, Newspaper, Award, DollarSign,
  Heart, MessageSquare, Bell, Moon, Sun
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar } from './ui/avatar';
import PropTypes from 'prop-types';

const SideDrawer = ({ isOpen, onClose, user, onLogout }) => {
  if (!isOpen) return null;

  const menuItems = [
    { section: 'Principal' },
    { icon: BookOpen, label: 'Mes cours', path: '/courses' },
    { icon: Code2, label: 'Mes projets', path: '/vibe/projects' },
    { icon: Users, label: 'Ma communauté', path: '/feed' },
    { icon: ShoppingBag, label: 'Mes achats', path: '/purchases' },
    { icon: Newspaper, label: 'Mes actualités', path: '/news' },
    
    { section: 'Créateur' },
    { icon: DollarSign, label: 'Tableau de bord', path: '/creator/dashboard' },
    { icon: Award, label: 'Mes produits', path: '/creator/products' },
    { icon: Heart, label: 'Mes abonnés', path: '/creator/followers' },
    
    { section: 'Compte' },
    { icon: User, label: 'Profil', path: '/profile' },
    { icon: Settings, label: 'Paramètres', path: '/settings' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border/50 z-50 overflow-y-auto animate-slide-left">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-foreground">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-card/80 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-4 p-4 bg-card/40 rounded-xl mb-6">
              <Avatar className="w-14 h-14">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                )}
              </Avatar>
              <div className="flex-1">
                <h3 className="font-bold text-foreground">{user.name || 'Utilisateur'}</h3>
                <p className="text-xs text-muted-foreground">{user.email || ''}</p>
              </div>
            </div>
          )}

          {/* Menu items */}
          <div className="space-y-6">
            {menuItems.map((item, index) => {
              if (item.section) {
                return (
                  <div key={index} className="mt-6 first:mt-0">
                    <p className="text-xs font-bold text-muted-foreground mb-2 px-2">
                      {item.section}
                    </p>
                  </div>
                );
              }

              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 p-3 hover:bg-card/80 rounded-lg transition-colors group"
                  onClick={onClose}
                >
                  <Icon className="w-5 h-5 text-muted-foreground group-hover:text-[#ff6b35]" />
                  <span className="flex-1 text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground group-hover:text-[#ff6b35]">→</span>
                </Link>
              );
            })}
          </div>

          {/* Theme toggle (placeholder) */}
          <div className="mt-6 p-3 flex items-center justify-between bg-card/40 rounded-lg">
            <span className="text-sm text-foreground">Thème sombre</span>
            <button className="p-2 hover:bg-card/60 rounded-lg transition-colors">
              <Moon className="w-4 h-4" />
            </button>
          </div>

          {/* Logout */}
          {user && (
            <Button
              variant="destructive"
              className="w-full mt-6"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

SideDrawer.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default SideDrawer;
