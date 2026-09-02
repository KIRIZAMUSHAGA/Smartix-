// SettingsPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, X, ChevronLeft, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import BottomNav from '../../components/BottomNav';
import NeoGlassHeader from '../../components/NeoGlassHeader';
import useSettings from './hooks/useSettings';
import { useUIEffects } from './hooks/useUIEffects';
import { useCacheManager } from './hooks/useCacheManager';
import SettingsMainMenu from './components/SettingsMainMenu';
import AppearanceSection from './components/SectionContent/AppearanceSection';
import LanguageSection from './components/SectionContent/LanguageSection';
import NotificationsSection from './components/SectionContent/NotificationsSection';
import ContentSection from './components/SectionContent/ContentSection';
import PerformanceSection from './components/SectionContent/PerformanceSection';
import AccessibilitySection from './components/SectionContent/AccessibilitySection';
import { useAuth } from '../../hooks/useAuth';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONFIGURATION DES SECTIONS (déclarative)
// =============================
const SECTION_CONFIG = {
  appearance: {
    component: AppearanceSection,
    hasSubSections: false
  },
  language: {
    component: LanguageSection,
    hasSubSections: false
  },
  notifications: {
    component: NotificationsSection,
    hasSubSections: false
  },
  content: {
    component: ContentSection,
    hasSubSections: true
  },
  performance: {
    component: PerformanceSection,
    hasSubSections: false
  },
  accessibility: {
    component: AccessibilitySection,
    hasSubSections: false
  }
};

// =============================
// 2️⃣ COMPOSANT PRINCIPAL
// =============================
const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user } = useAuth(); // ✅ Récupération de l'utilisateur connecté
  const settings = useSettings();
  const cacheManager = useCacheManager();
  
  // Applique les effets UI (police, animations, langue)
  useUIEffects(settings);
  
  // État pour l'UI
  const [activeSection, setActiveSection] = useState(() => searchParams.get('section') || null);
  const [activeSubSection, setActiveSubSection] = useState(() => searchParams.get('sub') || null);
  const [isSaving, setIsSaving] = useState(false);
  
  // ✅ État pour les compteurs (badges)
  const [badgeValues, setBadgeValues] = useState({
    notifications: 0,
    messages: 0,
    friendRequests: 0
  });
  
  // Ref pour l'auto-save
  const saveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);

  // =============================
  // 3️⃣ RÉCUPÉRATION DES COMPTEURS POUR LES BADGES
  // =============================
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Simuler une récupération des compteurs
        // À remplacer par tes appels API réels
        setBadgeValues({
          notifications: 3,
          messages: 2,
          friendRequests: 1
        });
      } catch (error) {
        console.error('Erreur récupération compteurs:', error);
      }
    };
    
    fetchCounts();
  }, []);

  // =============================
  // 4️⃣ SYNC URL → STATE (source unique)
  // =============================
  useEffect(() => {
    const section = searchParams.get('section');
    const sub = searchParams.get('sub');
    
    if (section !== activeSection) {
      setActiveSection(section || null);
    }
    if (sub !== activeSubSection) {
      setActiveSubSection(sub || null);
    }
  }, [searchParams, activeSection, activeSubSection]);

  // =============================
  // 5️⃣ MISE À JOUR URL (source unique)
  // =============================
  const updateURL = useCallback((section, sub) => {
    const params = {};
    if (section) params.section = section;
    if (sub) params.sub = sub;
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // =============================
  // 6️⃣ AUTO-SAVE ROBUSTE AVEC UI
  // =============================
  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      await settings.saveSettings();
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [settings.saveSettings]);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings, handleSave]);

  // =============================
  // 7️⃣ GESTIONNAIRES DE NAVIGATION (source unique = URL)
  // =============================
  const handleSelectSection = useCallback((sectionId) => {
    updateURL(sectionId, null);
  }, [updateURL]);

  const handleSelectSubSection = useCallback((subSectionId) => {
    updateURL(activeSection, subSectionId);
  }, [activeSection, updateURL]);

  const handleBack = useCallback(() => {
    if (activeSubSection) {
      updateURL(activeSection, null);
    } else {
      updateURL(null, null);
    }
  }, [activeSection, activeSubSection, updateURL]);

  // =============================
  // 8️⃣ RENDU DES SECTIONS (déclaratif)
  // =============================
  const sectionProps = {
    // État
    ...settings,
    
    // Cache
    cache: cacheManager,
    
    // Actions spécialisées
    updateNotifications: settings.updateNotifications,
    updateContent: settings.updateContent,
    updatePerformance: settings.updatePerformance,
    updateAccessibility: settings.updateAccessibility,
    
    // Actions génériques (pour les sections qui en ont besoin)
    updateField: settings.updateField,
    updateCategory: settings.updateCategory,
    updateNested: settings.updateNested,
    
    // Navigation
    onSelectSubSection: handleSelectSubSection,
    activeSubSection
  };

  const currentConfig = SECTION_CONFIG[activeSection];
  const SectionComponent = currentConfig?.component;

  // =============================
  // 9️⃣ RENDU PRINCIPAL
  // =============================
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
      <NeoGlassHeader onMenuClick={() => navigate(-1)} />
      
      <div className="max-w-4xl mx-auto px-4 pt-8">
        {/* Header principal */}
        {!activeSection && (
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#ff6b35]/10 rounded-2xl">
                <SettingsIcon className="w-8 h-8 text-[#ff6b35]" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">{t('settings.title')}</h1>
                <p className="text-foreground/40 text-xs font-bold uppercase tracking-widest">
                  {t('settings.tagline')}
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="p-3 bg-foreground/5 hover:bg-foreground/10 rounded-2xl border border-foreground/10 shadow-sm transition-all text-foreground/60 hover:text-white"
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Indicateur de sauvegarde */}
        {isSaving && (
          <div className="fixed bottom-20 right-8 z-50">
            <div className="bg-[#ff6b35] text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sauvegarde...
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Menu principal */}
          {!activeSection && (
            <div className="md:col-span-3">
              <SettingsMainMenu 
                onSelectSection={handleSelectSection}
                activeSectionId={activeSection}
                badgeValues={{
                  notifications: badgeValues.notifications,
                  messages: badgeValues.messages,
                  friendRequests: badgeValues.friendRequests
                }}
                isUserPremium={user?.isPremium || false}
                userRoles={user?.roles || []}
              />
            </div>
          )}

          {/* Contenu de la section active */}
          {activeSection && SectionComponent && (
            <div className="md:col-span-3">
              <Card className="bg-card border-border p-6 rounded-[32px] shadow-xl">
                <motion.div
                  key={activeSection + (activeSubSection || '')}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <button 
                    onClick={handleBack}
                    className="flex items-center gap-2 text-[#ff6b35] font-bold text-xs uppercase tracking-widest mb-8 hover:opacity-70 transition-opacity"
                    aria-label="Retour"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour aux paramètres
                  </button>
                  <SectionComponent {...sectionProps} />
                </motion.div>
              </Card>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

SettingsPage.propTypes = {};

export default SettingsPage;
