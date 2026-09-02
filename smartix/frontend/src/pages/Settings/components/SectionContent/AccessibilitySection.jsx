// components/SectionContent/AccessibilitySection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Eye, Type, MousePointer, Volume2, ZoomIn, Mic, 
  Loader2, Check, Sparkles, Shield, Accessibility as AccessibilityIcon,
  Contrast, AlignJustify, Headphones, Keyboard
} from 'lucide-react';
import { Label } from '../../../../components/ui/label';
import ToggleSwitch from '../ToggleSwitch';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT D'OPTION ACCESSIBILITÉ
// =============================
const AccessibilityOption = ({ id, label, description, icon: Icon, value, onChange, isPremium = false }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`
      group relative p-4 rounded-2xl border transition-all
      ${value 
        ? 'bg-gradient-to-r from-[#ff6b35]/10 to-transparent border-[#ff6b35]/30' 
        : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'
      }
    `}>
      <div className="flex items-start gap-4">
        {/* Icône */}
        <div className={`
          p-2 rounded-xl transition-all
          ${value ? 'bg-[#ff6b35]/20' : 'bg-foreground/5 group-hover:bg-[#ff6b35]/10'}
        `}>
          <Icon className={`w-5 h-5 ${value ? 'text-[#ff6b35]' : 'text-muted-foreground'}`} />
        </div>
        
        {/* Contenu */}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">
              {label}
            </span>
            {value && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#ff6b35]/20 text-[#ff6b35] font-bold uppercase tracking-wider">
                Actif
              </span>
            )}
            {isPremium && !value && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white font-bold uppercase tracking-wider">
                Premium
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {description}
          </p>
          {isPremium && !value && (
            <div className="mt-2">
              <span className="text-[8px] text-muted-foreground/40 flex items-center gap-1">
                <Sparkles className="w-2 h-2" />
                {t('settings.accessibility.premiumFeature')}
              </span>
            </div>
          )}
        </div>
        
        {/* Toggle */}
        <ToggleSwitch 
          enabled={value} 
          onChange={onChange}
          aria-label={label}
        />
      </div>
      
      {/* Effet de brillance */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl" />
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT DE PRÉVISUALISATION
// =============================
const PreviewCard = ({ highContrast, readableText }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`
      p-5 rounded-2xl border transition-all
      ${highContrast 
        ? 'bg-black text-yellow-300 border-yellow-500' 
        : readableText 
          ? 'bg-card text-foreground border-border text-lg' 
          : 'bg-foreground/5 border-foreground/10'
      }
    `}>
      <div className="flex items-center gap-3 mb-3">
        <AccessibilityIcon className={`w-5 h-5 ${highContrast ? 'text-yellow-300' : 'text-[#ff6b35]'}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${highContrast ? 'text-yellow-300' : 'text-muted-foreground'}`}>
          {t('settings.accessibility.preview')}
        </span>
      </div>
      <p className={`text-sm ${readableText ? 'leading-loose' : 'leading-normal'}`}>
        {t('settings.accessibility.previewText')}
      </p>
    </div>
  );
};

// =============================
// 3️⃣ CONFIGURATION
// =============================
const ACCESSIBILITY_OPTIONS = [
  { 
    id: 'highContrast', 
    icon: Contrast,
    labelKey: 'settings.accessibility.highContrast.label',
    descKey: 'settings.accessibility.highContrast.desc',
    isPremium: false
  },
  { 
    id: 'readableText', 
    icon: Type,
    labelKey: 'settings.accessibility.readableText.label',
    descKey: 'settings.accessibility.readableText.desc',
    isPremium: false
  },
  { 
    id: 'reduceMotion', 
    icon: MousePointer,
    labelKey: 'settings.accessibility.reduceMotion.label',
    descKey: 'settings.accessibility.reduceMotion.desc',
    isPremium: false
  },
  { 
    id: 'screenReaderOptimized', 
    icon: Headphones,
    labelKey: 'settings.accessibility.screenReader.label',
    descKey: 'settings.accessibility.screenReader.desc',
    isPremium: true
  },
  { 
    id: 'keyboardNavigation', 
    icon: Keyboard,
    labelKey: 'settings.accessibility.keyboard.label',
    descKey: 'settings.accessibility.keyboard.desc',
    isPremium: true
  },
  { 
    id: 'voiceCommands', 
    icon: Mic,
    labelKey: 'settings.accessibility.voice.label',
    descKey: 'settings.accessibility.voice.desc',
    isPremium: true
  }
];

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const AccessibilitySection = () => {
  const { t } = useTranslation();
  const { accessibility, updateNested, isDirty, saveSettings, isUserPremium = false } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeAccessibility = accessibility || { 
    highContrast: false, 
    readableText: false,
    reduceMotion: false,
    screenReaderOptimized: false,
    keyboardNavigation: false,
    voiceCommands: false
  };

  // =============================
  // 5️⃣ STATISTIQUES
  // =============================
  const activeCount = useMemo(() => {
    return ACCESSIBILITY_OPTIONS.filter(opt => safeAccessibility[opt.id] === true).length;
  }, [safeAccessibility]);

  // =============================
  // 6️⃣ SAUVEGARDE AVEC DEBOUNCE
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
        toast.success(t('settings.saved'));
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
  // 7️⃣ GESTIONNAIRES
  // =============================
  const handleToggle = useCallback((optionId, currentValue) => {
    const option = ACCESSIBILITY_OPTIONS.find(opt => opt.id === optionId);
    if (option?.isPremium && !isUserPremium) {
      toast.info(t('settings.accessibility.premiumRequired'));
      return;
    }
    updateNested('accessibility', optionId, !currentValue);
  }, [updateNested, isUserPremium, t]);

  // =============================
  // 8️⃣ RENDU
  // =============================
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AccessibilityIcon className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.accessibility.title')}
          </h3>
        </div>
        
        <div aria-live="polite">
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

      <p className="text-xs text-muted-foreground/70 leading-relaxed -mt-4">
        {t('settings.accessibility.description')}
      </p>

      {/* Prévisualisation en direct */}
      <PreviewCard 
        highContrast={safeAccessibility.highContrast}
        readableText={safeAccessibility.readableText}
      />

      {/* Statistiques */}
      {activeCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff6b35]" />
              <span className="text-xs font-bold text-foreground">
                {t('settings.accessibility.stats.title')}
              </span>
            </div>
            <span className="text-xs font-bold text-[#ff6b35]">
              {activeCount} {activeCount === 1 ? 'option active' : 'options actives'}
            </span>
          </div>
          <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(activeCount / ACCESSIBILITY_OPTIONS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] rounded-full"
            />
          </div>
        </div>
      )}

      {/* Options Accessibilité */}
      <div className="space-y-3">
        <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
          {t('settings.accessibility.options')}
        </Label>
        {ACCESSIBILITY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const value = safeAccessibility[option.id] === true;
          
          return (
            <AccessibilityOption
              key={option.id}
              id={option.id}
              icon={Icon}
              label={t(option.labelKey)}
              description={t(option.descKey)}
              value={value}
              onChange={() => handleToggle(option.id, value)}
              isPremium={option.isPremium}
            />
          );
        })}
      </div>

      {/* Message d'information premium */}
      {!isUserPremium && (
        <div className="p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.accessibility.premiumHint')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.accessibility.premiumHintDetail')}
              </p>
            </div>
          </div>
        </div>
      )}

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
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('settings.saving')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

AccessibilitySection.propTypes = {};

export default AccessibilitySection;
AccessibilityOption.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isPremium: PropTypes.bool,
};
PreviewCard.propTypes = {
  highContrast: PropTypes.any.isRequired,
  readableText: PropTypes.any.isRequired,
};
