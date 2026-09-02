// components/SettingsMainMenu.jsx
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { SECTIONS } from '../constants/sections';

// =============================
// 1️⃣ STYLES DE BADGES (design system)
// =============================
const BADGE_STYLES = {
  danger: 'bg-red-500 text-white',
  info: 'bg-blue-500 text-white',
  neutral: 'bg-gray-200 text-black dark:bg-gray-700 dark:text-white',
  warning: 'bg-yellow-500 text-black',
  success: 'bg-green-500 text-white',
  premium: 'bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white'
};

// =============================
// 2️⃣ COMPOSANT PRINCIPAL
// =============================
const SettingsMainMenu = memo(({ 
  onSelectSection, 
  activeSectionId = null,
  // Badges dynamiques (props passées par le parent)
  badgeValues = {},
  // Accessibilité
  isUserPremium = false,
  userRoles = []
}) => {
  const { t, i18n } = useTranslation();
  
  // =============================
  // 3️⃣ RÉCUPÉRATION DES VALEURS DE BADGES
  // =============================
  const getBadgeValue = (section) => {
    if (!section.badge) return null;
    
    // Badges dynamiques
    switch (section.badge) {
      case 'notifications':
        return badgeValues.notifications;
      case 'language':
        return i18n.language.toUpperCase();
      case 'premium':
        return isUserPremium ? '⭐' : null;
      case 'beta':
        return 'BETA';
      default:
        return section.badge;
    }
  };
  
  // =============================
  // 4️⃣ FILTRAGE DES SECTIONS (contrôle d'accès)
  // =============================
  const visibleSections = useMemo(() => {
    return SECTIONS.filter(section => {
      // Vérification des prérequis
      if (section.requiresAuth) {
        // À implémenter avec l'état d'auth
        return true;
      }
      
      if (section.premium && !isUserPremium) {
        return false;
      }
      
      if (section.roles && section.roles.length > 0) {
        const hasRequiredRole = section.roles.some(role => userRoles.includes(role));
        if (!hasRequiredRole) return false;
      }
      
      // Vérification des flags de feature
      if (section.featureFlag && !window.featureFlags?.[section.featureFlag]) {
        return false;
      }
      
      return true;
    });
  }, [isUserPremium, userRoles]);
  
  // =============================
  // 5️⃣ TRI DES SECTIONS (par ordre)
  // =============================
  const sortedSections = useMemo(() => {
    return [...visibleSections].sort((a, b) => (a.order || 999) - (b.order || 999));
  }, [visibleSections]);

  return (
    <div className="space-y-3">
      {/* Groupes de sections */}
      {Object.entries(
        sortedSections.reduce((acc, section) => {
          const group = section.group || 'general';
          if (!acc[group]) acc[group] = [];
          acc[group].push(section);
          return acc;
        }, {})
      ).map(([group, sections]) => (
        <div key={group} className="space-y-2">
          {group !== 'general' && (
            <div className="px-4 pt-2 pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
                {t(`settings.groups.${group}`, group)}
              </span>
            </div>
          )}
          
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSectionId === section.id;
            const badgeValue = getBadgeValue(section);
            const badgeStyle = section.badgeType ? BADGE_STYLES[section.badgeType] : BADGE_STYLES.neutral;
            
            return (
              <button
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={`
                  w-full flex items-center justify-between p-6 rounded-[24px]
                  transition-all duration-200 group
                  focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2 focus:ring-offset-background
                  active:scale-95
                  ${isActive 
                    ? 'bg-[#ff6b35]/10 border border-[#ff6b35]/30' 
                    : 'bg-card border border-border/50 hover:bg-accent hover:border-[#ff6b35]/20'
                  }
                  ${section.premium ? 'relative overflow-hidden' : ''}
                `}
                aria-label={t(section.labelKey)}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Badge Premium en arrière-plan */}
                {section.premium && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#ff6b35]/20 to-transparent rounded-full -translate-y-10 translate-x-10" />
                  </div>
                )}
                
                <div className="flex items-center gap-4 relative">
                  {/* Icône avec fond dynamique */}
                  <div className={`
                    p-3 rounded-2xl transition-colors duration-200
                    ${isActive 
                      ? 'bg-[#ff6b35]/20' 
                      : 'bg-[#ff6b35]/10 group-hover:bg-[#ff6b35]/20'
                    }
                  `}>
                    <Icon className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  
                  {/* Texte et description */}
                  <div className="text-left">
                    <div className="text-lg font-black uppercase tracking-tight text-foreground">
                      {t(section.labelKey)}
                    </div>
                    {section.descriptionKey && (
                      <div className="text-xs text-muted-foreground/60 mt-0.5">
                        {t(section.descriptionKey)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Badge et flèche */}
                <div className="flex items-center gap-3 relative">
                  {badgeValue && (
                    <span className={`
                      px-2 py-1 rounded-full text-xs font-bold
                      ${badgeStyle}
                    `}>
                      {badgeValue}
                    </span>
                  )}
                  <ChevronLeft className="w-5 h-5 rotate-180 opacity-40 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

SettingsMainMenu.displayName = 'SettingsMainMenu';

export default SettingsMainMenu;
