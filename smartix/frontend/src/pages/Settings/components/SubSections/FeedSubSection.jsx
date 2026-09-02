// components/SubSections/FeedSubSection.jsx
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Sparkles, Loader2, Check, TrendingUp, Clock, Flame, Info } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import ToggleSwitch from '../ToggleSwitch';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT RÉUTILISABLE SettingRow
// =============================
const SettingRow = ({ label, value, onChange, description, disabled = false }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`
      flex items-center justify-between p-4 rounded-2xl border transition-all
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-foreground/10'}
      ${value 
        ? 'bg-gradient-to-r from-[#ff6b35]/10 to-transparent border-[#ff6b35]/20' 
        : 'bg-foreground/5 border-foreground/10'
      }
    `}>
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
        </div>
        {description && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {description}
          </p>
        )}
      </div>
      <ToggleSwitch 
        enabled={value} 
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
};

// =============================
// 2️⃣ CONFIGURATION
// =============================
const ORDER_OPTIONS = [
  { 
    id: 'relevance', 
    labelKey: 'settings.feed.order.relevance', 
    icon: Sparkles, 
    color: 'text-[#ff6b35]',
    descriptionKey: 'settings.feed.order.relevance.desc'
  },
  { 
    id: 'recent', 
    labelKey: 'settings.feed.order.recent', 
    icon: Clock, 
    color: 'text-blue-500',
    descriptionKey: 'settings.feed.order.recent.desc'
  },
  { 
    id: 'popular', 
    labelKey: 'settings.feed.order.popular', 
    icon: Flame, 
    color: 'text-orange-500',
    descriptionKey: 'settings.feed.order.popular.desc'
  }
];

const HIGHLIGHT_OPTIONS = [
  { 
    id: 'showEducational', 
    labelKey: 'settings.feed.priorities.educational',
    descriptionKey: 'settings.feed.priorities.educational.desc'
  },
  { 
    id: 'showPremium', 
    labelKey: 'settings.feed.priorities.premium',
    descriptionKey: 'settings.feed.priorities.premium.desc'
  },
  { 
    id: 'showFollowing', 
    labelKey: 'settings.feed.priorities.following',
    descriptionKey: 'settings.feed.priorities.following.desc'
  }
];

const AUTO_HIDE_OPTIONS = [
  { 
    id: 'hideRepetitive', 
    labelKey: 'settings.feed.avoid.repetitive',
    descriptionKey: 'settings.feed.avoid.repetitive.desc'
  },
  { 
    id: 'hideSeen', 
    labelKey: 'settings.feed.avoid.seen',
    descriptionKey: 'settings.feed.avoid.seen.desc'
  }
];

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================
const FeedSubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { feed, updateNested, isDirty, saveSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des valeurs
  const safeFeed = feed || {};
  const activeHighlightCount = HIGHLIGHT_OPTIONS.filter(opt => safeFeed[opt.id] === true).length;
  const activeAutoHideCount = AUTO_HIDE_OPTIONS.filter(opt => safeFeed[opt.id] === true).length;

  // =============================
  // 4️⃣ SAUVEGARDE AVEC DEBOUNCE
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
  // 5️⃣ GESTIONNAIRES
  // =============================
  const handleOrderChange = useCallback((orderId) => {
    updateNested('feed', 'order', orderId);
  }, [updateNested]);

  const handleToggle = useCallback((optionId, currentValue) => {
    updateNested('feed', optionId, !currentValue);
  }, [updateNested]);

  // =============================
  // 6️⃣ RENDU
  // =============================
  return (
    <div className="space-y-8">
      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#ff6b35] font-bold text-xs uppercase tracking-widest hover:opacity-70 transition-opacity group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          {t('common.back')}
        </button>
        
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

      {/* Section Ordre du fil */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
              {t('settings.feed.order.title')}
            </Label>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              {t('settings.feed.order.subtitle')}
            </p>
          </div>
          {safeFeed.order && (
            <span className="text-[10px] text-[#ff6b35]">
              {t(`settings.feed.order.${safeFeed.order}.short`)}
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ORDER_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = safeFeed.order === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => handleOrderChange(option.id)}
                className={`
                  group relative overflow-hidden p-4 rounded-2xl border transition-all
                  focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
                  ${isActive 
                    ? 'bg-gradient-to-r from-[#ff6b35]/15 to-transparent border-[#ff6b35]/40' 
                    : 'border-border bg-foreground/5 hover:bg-foreground/10'
                  }
                `}
                aria-label={t(option.labelKey)}
                aria-pressed={isActive}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${option.color}`} />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-bold">
                      {t(option.labelKey)}
                    </div>
                    {isActive && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {t(option.descriptionKey)}
                      </p>
                    )}
                  </div>
                  {isActive && <Sparkles className="w-4 h-4 text-[#ff6b35]" />}
                </div>
                
                {/* Effet de brillance au survol */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Priorités (anciennement "Mettre en avant") */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
              {t('settings.feed.priorities.title')}
            </Label>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              {t('settings.feed.priorities.subtitle')}
            </p>
          </div>
          {activeHighlightCount > 0 && (
            <span className="text-[10px] text-green-500">
              {activeHighlightCount} {activeHighlightCount === 1 ? 'priorité active' : 'priorités actives'}
            </span>
          )}
        </div>
        
        <div className="space-y-2">
          {HIGHLIGHT_OPTIONS.map((option) => (
            <SettingRow
              key={option.id}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              value={safeFeed[option.id] === true}
              onChange={() => handleToggle(option.id, safeFeed[option.id])}
            />
          ))}
        </div>
      </div>

      {/* Section À éviter (anciennement "Masquage automatique") */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
              {t('settings.feed.avoid.title')}
            </Label>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              {t('settings.feed.avoid.subtitle')}
            </p>
          </div>
          {activeAutoHideCount > 0 && (
            <span className="text-[10px] text-green-500">
              {activeAutoHideCount} {activeAutoHideCount === 1 ? 'filtre actif' : 'filtres actifs'}
            </span>
          )}
        </div>
        
        <div className="space-y-2">
          {AUTO_HIDE_OPTIONS.map((option) => (
            <SettingRow
              key={option.id}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              value={safeFeed[option.id] === true}
              onChange={() => handleToggle(option.id, safeFeed[option.id])}
            />
          ))}
        </div>
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
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('settings.saving')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

FeedSubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default FeedSubSection;
SettingRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  description: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
};
