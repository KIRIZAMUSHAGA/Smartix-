// components/SectionContent/ContentSection.jsx
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Check } from 'lucide-react';
import { SUB_SECTIONS } from '../../constants/subSections';
import useSettings from '../../hooks/useSettings';

// =============================
// 1️⃣ COMPOSANT PRINCIPAL
// =============================
const ContentSection = memo(({ onSelectSubSection, activeSubSection = null }) => {
  const { t } = useTranslation();
  const { 
    feed,        // Vrai objet feed settings
    interests,   // Vrai objet interests settings
    hidden,      // Vrai objet hidden content settings
    fav          // Vrai objet favorites settings
  } = useSettings();

  // =============================
  // 2️⃣ RÉCUPÉRATION DES VRAIES DONNÉES
  // =============================
  const getSubSectionStatus = (id) => {
    // VRAIES données provenant du hook useSettings
    const statusMap = {
      feed: {
        isConfigured: feed?.enabled !== false,
        count: feed?.count || 0
      },
      interests: {
        isConfigured: interests?.tags?.length > 0,
        count: interests?.tags?.length || 0
      },
      favorites: {
        isConfigured: fav?.items?.length > 0,
        count: fav?.items?.length || 0
      },
      filtering: {
        isConfigured: feed?.filtering?.enabled === true,
        count: feed?.filtering?.activeFilters || 0
      },
      hidden: {
        isConfigured: hidden?.items?.length > 0,
        count: hidden?.items?.length || 0
      }
    };
    
    return statusMap[id] || { isConfigured: false, count: 0 };
  };

  // =============================
  // 3️⃣ COMPTEUR TOTAL D'ÉLÉMENTS ACTIFS
  // =============================
  const totalActiveItems = useMemo(() => {
    const feedCount = feed?.count || 0;
    const interestsCount = interests?.tags?.length || 0;
    const favCount = fav?.items?.length || 0;
    const hiddenCount = hidden?.items?.length || 0;
    return feedCount + interestsCount + favCount + hiddenCount;
  }, [feed, interests, fav, hidden]);

  // =============================
  // 4️⃣ RENDU
  // =============================
  return (
    <div className="space-y-8">
      {/* En-tête avec description améliorée */}
      <div className="space-y-2">
        <h3 className="text-2xl font-black tracking-tight text-foreground">
          {t('settings.content.title')}
        </h3>
        <p className="text-sm text-muted-foreground/70 leading-relaxed">
          {t('settings.content.description')}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">
            {t('settings.content.customize')}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        </div>
      </div>

      {/* Liste des sous-sections avec hiérarchie visuelle */}
      <div className="grid grid-cols-1 gap-4">
        {SUB_SECTIONS.map((sub, index) => {
          const Icon = sub.icon;
          const status = getSubSectionStatus(sub.id);
          const isActive = activeSubSection === sub.id;
          const isFirst = index === 0;
          
          return (
            <button
              key={sub.id}
              onClick={() => onSelectSubSection(sub.id)}
              aria-label={t(sub.labelKey)}
              aria-describedby={sub.descriptionKey ? `desc-${sub.id}` : undefined}
              className={`
                group relative w-full text-left
                transform transition-all duration-300 ease-out
                hover:scale-[1.01] active:scale-[0.98]
                focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2 focus:ring-offset-background
                ${isActive 
                  ? 'bg-gradient-to-r from-[#ff6b35]/15 to-transparent border-[#ff6b35]/40' 
                  : isFirst 
                    ? 'bg-gradient-to-r from-[#ff6b35]/5 to-transparent border-[#ff6b35]/20' 
                    : 'bg-foreground/5 border-foreground/10'
                }
                rounded-2xl border shadow-sm hover:shadow-md transition-all
              `}
            >
              <div className="flex items-center justify-between p-5">
                {/* Partie gauche : icône + texte */}
                <div className="flex items-center gap-4 flex-1">
                  {/* Conteneur icône avec animation */}
                  <div className={`
                    p-3 rounded-xl transition-all duration-300
                    ${isActive 
                      ? 'bg-[#ff6b35]/20' 
                      : 'bg-[#ff6b35]/10 group-hover:bg-[#ff6b35]/20'
                    }
                    group-hover:rotate-6
                  `}>
                    <Icon className={`
                      w-6 h-6 transition-all duration-300
                      ${isActive ? 'text-[#ff6b35]' : 'text-[#ff6b35]'}
                      group-hover:scale-110
                    `} />
                  </div>
                  
                  {/* Texte et description */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black tracking-tight text-foreground">
                        {t(sub.labelKey)}
                      </span>
                      
                      {/* Badge "Recommandé" pour la première section */}
                      {isFirst && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#ff6b35]/20 text-[#ff6b35] font-bold uppercase tracking-wider">
                          {t('common.recommended')}
                        </span>
                      )}
                      
                      {/* Badge d'état basé sur les vraies données */}
                      {status.isConfigured && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                          {t('common.configured')}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1 mt-1">
                      <p id={`desc-${sub.id}`} className="text-xs text-muted-foreground/60">
                        {t(sub.descriptionKey)}
                      </p>
                      
                      {/* Indicateur de contenu basé sur les vraies données */}
                      {status.count > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                          <span>{status.count} {status.count === 1 ? 'élément actif' : 'éléments actifs'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Partie droite : indicateur et flèche */}
                <div className="flex items-center gap-3">
                  {/* Indicateur visuel de configuration basé sur les vraies données */}
                  {status.isConfigured && (
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                  
                  {/* Flèche animée */}
                  <ChevronLeft 
                    className={`
                      w-5 h-5 transition-all duration-300
                      rotate-180 opacity-40 
                      group-hover:translate-x-1 group-hover:opacity-100
                    `} 
                  />
                </div>
              </div>
              
              {/* Effet de bordure subtil */}
              {isActive && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-[#ff6b35]/30" />
              )}
            </button>
          );
        })}
      </div>

      {/* Mini dashboard avec vraies données */}
      <div className="mt-8 p-5 bg-gradient-to-br from-foreground/5 to-transparent rounded-2xl border border-foreground/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#ff6b35] rounded-full" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">
            {t('settings.content.preview')}
          </span>
        </div>
        
        <div className="space-y-3">
          {/* Aperçu du feed basé sur les vraies données */}
          <div className="flex items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c61]" />
            <div className="flex-1">
              <div className="h-2 w-32 bg-foreground/20 rounded-full" />
              <div className="h-2 w-48 bg-foreground/10 rounded-full mt-1" />
            </div>
            <div className="w-12 h-8 bg-foreground/10 rounded-lg flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {feed?.count || 0}
            </div>
          </div>
          
          {/* Aperçu des intérêts */}
          {interests?.tags?.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-foreground/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500" />
              <div className="flex-1">
                <div className="h-2 w-24 bg-foreground/20 rounded-full" />
                <div className="flex gap-1 mt-1">
                  {interests.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[8px] text-muted-foreground/40">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="w-12 h-8 bg-foreground/10 rounded-lg flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {interests.tags.length}
              </div>
            </div>
          )}
        </div>
        
        <p className="text-[10px] text-muted-foreground/40 text-center mt-4">
          {totalActiveItems} {totalActiveItems === 1 ? 'élément personnalisé' : 'éléments personnalisés'} • {t('settings.content.previewHint')}
        </p>
      </div>

      {/* Indicateur de navigation */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-[10px] text-muted-foreground/40 bg-foreground/5 px-4 py-2 rounded-full">
          <span>✨</span>
          <span>{t('settings.content.navigateHint')}</span>
          <span>→</span>
        </div>
      </div>
    </div>
  );
});

ContentSection.displayName = 'ContentSection';

export default ContentSection;
