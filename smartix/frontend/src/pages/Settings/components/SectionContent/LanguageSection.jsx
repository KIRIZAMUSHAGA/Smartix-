// components/SectionContent/LanguageSection.jsx
import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '../../../../components/ui/label';
import { Globe, MapPin, Check, Languages, Sparkles, Search, X } from 'lucide-react';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// =============================
// 1️⃣ CONFIGURATION (importée depuis fichiers séparés)
// =============================
// Idéalement, ces données devraient être dans :
// - /config/i18n/languages.js
// - /config/i18n/regions.js
import { LANGUAGES, REGIONS, REGION_GROUPS } from '../../../../config/i18n/languages';
import PropTypes from 'prop-types';

// =============================
// 2️⃣ COMPOSANT PRINCIPAL
// =============================
const LanguageSection = () => {
  const { t, i18n } = useTranslation();
  const { language, region, updateField, isDirty, saveSettings } = useSettings();
  
  // États locaux
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoDetected, setAutoDetected] = useState(null);
  const saveTimeoutRef = useRef(null);
  
  // =============================
  // 3️⃣ AUTO-DÉTECTION DE LA LANGUE
  // =============================
  useEffect(() => {
    const browserLang = navigator.language.split('-')[0];
    const availableLang = LANGUAGES.find(l => l.code === browserLang);
    
    if (availableLang && !language) {
      setAutoDetected(availableLang);
    }
  }, [language]);

  // =============================
  // 4️⃣ GROUPES DE RÉGIONS FILTRÉS (memoïsés)
  // =============================
  const filteredRegionGroups = useMemo(() => {
    if (!searchTerm) return REGION_GROUPS;
    
    return REGION_GROUPS
      .map(group => ({
        ...group,
        countries: group.countries.filter(countryCode => {
          const country = REGIONS.find(r => r.code === countryCode);
          return country?.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 country?.code.includes(searchTerm.toLowerCase());
        })
      }))
      .filter(group => group.countries.length > 0);
  }, [searchTerm]);

  // =============================
  // 5️⃣ SAUVEGARDE AVEC DEBOUNCE STABLE
  // =============================
  useEffect(() => {
    if (!isDirty) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveSettings();
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
        toast.success(t('settings.languageSaved'));
      } catch (error) {
        toast.error(t('settings.saveError'));
      } finally {
        setSaving(false);
      }
    }, 800);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isDirty, saveSettings, t]);

  // =============================
  // 6️⃣ GESTIONNAIRES
  // =============================
  const handleLanguageChange = useCallback((langCode) => {
    updateField('language', langCode);
    // Changer la langue i18n immédiatement
    i18n.changeLanguage(langCode);
    // Proposer une région par défaut
    const defaultRegion = LANGUAGES.find(l => l.code === langCode)?.region || 'fr';
    if (defaultRegion !== region) {
      updateField('region', defaultRegion);
    }
  }, [updateField, i18n, region]);

  const handleRegionChange = useCallback((regionCode) => {
    updateField('region', regionCode);
  }, [updateField]);

  const acceptAutoDetect = useCallback(() => {
    if (autoDetected) {
      handleLanguageChange(autoDetected.code);
      setAutoDetected(null);
    }
  }, [autoDetected, handleLanguageChange]);

  const rejectAutoDetect = useCallback(() => {
    setAutoDetected(null);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  // =============================
  // 7️⃣ RENDU
  // =============================
  return (
    <div className="space-y-8">
      {/* Auto-détection banner */}
      <AnimatePresence>
        {autoDetected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-gradient-to-r from-[#ff6b35]/10 to-[#ff6b35]/5 rounded-2xl border border-[#ff6b35]/20"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#ff6b35]" />
                <div>
                  <p className="text-sm font-bold">
                    {t('settings.language.autoDetected')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {autoDetected.name} ({autoDetected.nativeName})
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={acceptAutoDetect}
                  className="px-3 py-1.5 bg-[#ff6b35] text-white text-xs font-bold rounded-full hover:bg-[#ff8c61] transition-colors"
                >
                  {t('common.apply')}
                </button>
                <button
                  onClick={rejectAutoDetect}
                  className="px-3 py-1.5 bg-foreground/10 text-xs font-bold rounded-full hover:bg-foreground/20 transition-colors"
                >
                  {t('common.dismiss')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section Langue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-[#ff6b35]" />
            <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
              {t('settings.language.label')}
            </Label>
          </div>
          <div aria-live="polite" className="flex items-center gap-2">
            {showSaved && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-green-500 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {t('settings.saved')}
              </motion.span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.code;
            
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`
                  flex items-center gap-3 p-4 rounded-2xl border transition-all
                  focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
                  ${isActive 
                    ? 'border-[#ff6b35] bg-[#ff6b35]/10' 
                    : 'border-border bg-card hover:bg-accent'
                  }
                `}
                aria-label={lang.name}
                aria-pressed={isActive}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left flex-1">
                  <div className="font-bold text-sm">{lang.name}</div>
                  <div className="text-xs text-muted-foreground">{lang.nativeName}</div>
                </div>
                {isActive && (
                  <Check className="w-4 h-4 text-[#ff6b35]" />
                )}
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-muted-foreground/60">
          {t('settings.language.description')}
        </p>
      </div>

      {/* Section Région */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#ff6b35]" />
          <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
            {t('settings.region.label')}
          </Label>
        </div>
        
        {/* Barre de recherche avec sticky */}
        <div className="sticky top-0 bg-background z-10 pt-2 pb-4">
          <div className="relative">
            <input
              type="text"
              placeholder={t('settings.region.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl p-4 pl-10 pr-10 text-sm outline-none focus:border-[#ff6b35] transition-all"
              aria-label={t('settings.region.search')}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-foreground/10 rounded-full transition-colors"
                aria-label={t('common.clear')}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        
        {/* Régions groupées avec résultat de recherche */}
        <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
          {filteredRegionGroups.map((group) => {
            const groupRegions = REGIONS.filter(r => group.countries.includes(r.code));
            
            return (
              <div key={group.name} className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">
                  {group.name}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {groupRegions.map((r) => {
                    const isActive = region === r.code;
                    
                    return (
                      <button
                        key={r.code}
                        onClick={() => handleRegionChange(r.code)}
                        className={`
                          flex items-center gap-2 p-3 rounded-xl border transition-all
                          focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
                          ${isActive 
                            ? 'border-[#ff6b35] bg-[#ff6b35]/10' 
                            : 'border-border bg-card hover:bg-accent'
                          }
                        `}
                        aria-label={r.label}
                        aria-pressed={isActive}
                      >
                        <span>{r.flag}</span>
                        <span className="text-sm font-medium truncate">{r.label}</span>
                        {isActive && (
                          <Check className="w-3 h-3 text-[#ff6b35] ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredRegionGroups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t('settings.region.noResults')}
          </div>
        )}
      </div>

      {/* Indicateur de sauvegarde */}
      <AnimatePresence>
        {saving && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-8 z-50"
          >
            <div className="bg-[#ff6b35] text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('settings.saving')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

LanguageSection.propTypes = {};

export default LanguageSection;
