// components/SectionContent/AppearanceSection.jsx
import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Label } from '../../../../components/ui/label';
import ToggleSwitch from '../ToggleSwitch';
import { Sun, Moon, Monitor, Sparkles, Check } from 'lucide-react';
import useSettings from '../../hooks/useSettings';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONFIGURATION
// =============================
const TEXT_SIZES = [
  { key: 'small', labelKey: 'settings.appearance.textSmall', value: 'petit' },
  { key: 'normal', labelKey: 'settings.appearance.textNormal', value: 'normal' },
  { key: 'large', labelKey: 'settings.appearance.textLarge', value: 'grand' }
];

const THEME_OPTIONS = [
  { 
    key: 'light', 
    icon: Sun, 
    color: 'text-orange-500',
    bgPreview: 'bg-gradient-to-br from-gray-100 to-gray-200',
    textPreview: 'text-gray-900',
    labelKey: 'settings.appearance.light'
  },
  { 
    key: 'dark', 
    icon: Moon, 
    color: 'text-blue-500',
    bgPreview: 'bg-gradient-to-br from-gray-800 to-gray-900',
    textPreview: 'text-white',
    labelKey: 'settings.appearance.dark'
  },
  { 
    key: 'system', 
    icon: Monitor, 
    color: 'text-slate-500',
    bgPreview: 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900',
    textPreview: 'text-gray-900 dark:text-white',
    labelKey: 'settings.appearance.system'
  }
];

// =============================
// 2️⃣ COMPOSANT PRINCIPAL
// =============================
const AppearanceSection = () => {
  const { t } = useTranslation();
  const { 
    theme, 
    updateField, 
    fontSize, 
    animationsEnabled,
    isDirty,
    saveSettings
  } = useSettings();

  // État local pour le feedback de sauvegarde
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // =============================
  // 3️⃣ GESTIONNAIRES
  // =============================
  const handleFontSizeChange = useCallback((size) => {
    updateField('fontSize', size);
  }, [updateField]);

  const handleAnimationsChange = useCallback((enabled) => {
    updateField('animationsEnabled', enabled);
  }, [updateField]);

  const handleThemeChange = useCallback((newTheme) => {
    // ✅ UNE SEULE SOURCE DE VÉRITÉ
    updateField('theme', newTheme);
  }, [updateField]);

  // =============================
  // 4️⃣ SAUVEGARDE AVEC FEEDBACK
  // =============================
  useEffect(() => {
    if (isDirty) {
      const timeout = setTimeout(async () => {
        setSaving(true);
        try {
          await saveSettings();
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 2000);
        } catch (error) {
          toast.error(t('settings.saveError'));
        } finally {
          setSaving(false);
        }
      }, 800);
      
      return () => clearTimeout(timeout);
    }
  }, [isDirty, saveSettings, t]);

  // =============================
  // 5️⃣ OPTIONS D'ANIMATION
  // =============================
  const shouldAnimate = animationsEnabled;

  // =============================
  // 6️⃣ RENDU
  // =============================
  return (
    <div className="space-y-8">
      {/* Section Thème avec preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
            {t('settings.appearance.displayMode')}
          </Label>
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
        
        <div className="grid grid-cols-3 gap-4">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.key;
            
            return (
              <button
                key={option.key}
                onClick={() => handleThemeChange(option.key)}
                className={`
                  group relative flex flex-col items-center gap-3 p-4 rounded-2xl
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
                  ${isActive 
                    ? 'bg-[#ff6b35]/10 border-2 border-[#ff6b35]' 
                    : 'bg-card border border-border/50 hover:bg-accent'
                  }
                `}
                aria-label={t(option.labelKey)}
                aria-pressed={isActive}
              >
                {/* Preview visuel */}
                <div className={`
                  w-full h-20 rounded-lg overflow-hidden shadow-sm transition-all
                  ${option.bgPreview}
                  group-hover:scale-[1.02]
                `}>
                  <div className="flex items-center justify-center h-full">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${option.bgPreview} border border-white/20
                    `}>
                      <Icon className={`w-4 h-4 ${option.color}`} />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${option.color}`} />
                  <span className="text-xs font-bold">{t(option.labelKey)}</span>
                </div>
                
                {/* Indicateur actif */}
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff6b35] rounded-full border-2 border-background">
                    <Check className="w-2 h-2 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-muted-foreground/60 mt-2">
          {t('settings.appearance.themeDescription')}
        </p>
      </div>

      {/* Section Taille de texte */}
      <div className="space-y-4">
        <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
          {t('settings.appearance.textSize')}
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {TEXT_SIZES.map((size) => {
            const isActive = fontSize === size.value;
            
            return (
              <button
                key={size.key}
                onClick={() => handleFontSizeChange(size.value)}
                className={`
                  py-3 border rounded-xl text-xs font-black transition-all
                  focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
                  ${isActive 
                    ? 'border-[#ff6b35] bg-[#ff6b35]/10 text-[#ff6b35]' 
                    : 'bg-background border-border text-muted-foreground hover:bg-accent'
                  }
                `}
                aria-label={t(size.labelKey)}
                aria-pressed={isActive}
              >
                {t(size.labelKey)}
              </button>
            );
          })}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <span className="text-[#ff6b35]">Aa</span>
          <span>Exemple de texte</span>
          <span className="text-[#ff6b35]">{fontSize === 'petit' ? '🔤' : fontSize === 'normal' ? '🔠' : '🔡'}</span>
        </div>
      </div>

      {/* Section Animations */}
      <div className="p-5 bg-foreground/5 rounded-2xl border border-foreground/10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <div>
              <span className="text-sm font-bold">{t('settings.appearance.animations')}</span>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {t('settings.appearance.animationsDesc')}
              </p>
            </div>
          </div>
          <ToggleSwitch 
            enabled={animationsEnabled} 
            onChange={handleAnimationsChange}
            aria-label={t('settings.appearance.animationsToggle')}
          />
        </div>
        
        {/* Aperçu de l'animation (si activée) */}
        {animationsEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 pt-4 border-t border-border/50"
          >
            <div className="flex gap-2 items-center">
              <div className="w-8 h-8 bg-[#ff6b35]/20 rounded-full animate-pulse" />
              <div className="h-2 w-24 bg-[#ff6b35]/30 rounded-full animate-pulse" />
              <div className="h-2 w-16 bg-[#ff6b35]/20 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground/40">
                {t('settings.appearance.animationPreview')}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Indicateur de sauvegarde */}
      {saving && (
        <div className="fixed bottom-20 right-8 z-50">
          <div className="bg-[#ff6b35] text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t('settings.saving')}
          </div>
        </div>
      )}
    </div>
  );
};

AppearanceSection.propTypes = {};

export default AppearanceSection;
