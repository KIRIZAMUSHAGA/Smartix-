// components/SubSections/AiPreferencesSubSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Sparkles, Brain, Lightbulb, Loader2, Check, Zap, Star, TrendingUp } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import ToggleSwitch from '../ToggleSwitch';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT D'OPTION AI
// =============================
const AiOption = ({ id, label, description, icon: Icon, value, onChange, isPremium = false }) => {
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
// 2️⃣ COMPOSANT DE NIVEAU DE DIFFICULTÉ
// =============================
const DifficultyLevel = ({ level, label, description, icon: Icon, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        group relative p-4 rounded-2xl border transition-all text-left
        focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
        ${isSelected 
          ? 'border-[#ff6b35] bg-gradient-to-r from-[#ff6b35]/15 to-transparent' 
          : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10'
        }
      `}
      aria-label={label}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-3">
        <div className={`
          p-2 rounded-xl transition-all
          ${isSelected ? 'bg-[#ff6b35]/20' : 'bg-foreground/5 group-hover:bg-[#ff6b35]/10'}
        `}>
          <Icon className={`w-5 h-5 ${isSelected ? 'text-[#ff6b35]' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{label}</span>
            {isSelected && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#ff6b35]/20 text-[#ff6b35] font-bold uppercase tracking-wider">
                Actif
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {description}
          </p>
        </div>
        {isSelected && <Check className="w-4 h-4 text-[#ff6b35]" />}
      </div>
      
      {/* Effet de brillance */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl" />
    </button>
  );
};

// =============================
// 3️⃣ CONFIGURATION
// =============================
const AI_OPTIONS = [
  { 
    id: 'aiSuggestions', 
    icon: Sparkles,
    labelKey: 'settings.ai.suggestions.label',
    descKey: 'settings.ai.suggestions.desc',
    isPremium: false
  },
  { 
    id: 'aiExplanations', 
    icon: Lightbulb,
    labelKey: 'settings.ai.explanations.label',
    descKey: 'settings.ai.explanations.desc',
    isPremium: false
  },
  { 
    id: 'aiPersonalization', 
    icon: TrendingUp,
    labelKey: 'settings.ai.personalization.label',
    descKey: 'settings.ai.personalization.desc',
    isPremium: true
  },
  { 
    id: 'aiVoiceAssistant', 
    icon: Zap,
    labelKey: 'settings.ai.voice.label',
    descKey: 'settings.ai.voice.desc',
    isPremium: true
  }
];

const DIFFICULTY_OPTIONS = [
  { 
    id: 'beginner', 
    icon: Star,
    labelKey: 'settings.ai.difficulty.beginner',
    descKey: 'settings.ai.difficulty.beginner.desc'
  },
  { 
    id: 'intermediate', 
    icon: TrendingUp,
    labelKey: 'settings.ai.difficulty.intermediate',
    descKey: 'settings.ai.difficulty.intermediate.desc'
  },
  { 
    id: 'advanced', 
    icon: Brain,
    labelKey: 'settings.ai.difficulty.advanced',
    descKey: 'settings.ai.difficulty.advanced.desc'
  }
];

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const AiPreferencesSubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { ai, updateNested, isDirty, saveSettings, isUserPremium = false } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeAi = ai || { difficulty: 'intermediate' };
  const currentDifficulty = safeAi.difficulty || 'intermediate';

  // =============================
  // 5️⃣ STATISTIQUES
  // =============================
  const activeCount = useMemo(() => {
    return AI_OPTIONS.filter(opt => safeAi[opt.id] === true).length;
  }, [safeAi]);

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
    const option = AI_OPTIONS.find(opt => opt.id === optionId);
    if (option?.isPremium && !isUserPremium) {
      toast.info(t('settings.ai.premiumRequired'));
      return;
    }
    updateNested('ai', optionId, !currentValue);
  }, [updateNested, isUserPremium, t]);

  const handleDifficultyChange = useCallback((level) => {
    updateNested('ai', 'difficulty', level);
  }, [updateNested]);

  // =============================
  // 8️⃣ RENDU
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

      {/* En-tête avec description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.ai.title')}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('settings.ai.description')}
        </p>
      </div>

      {/* Statistiques */}
      {activeCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff6b35]" />
              <span className="text-xs font-bold text-foreground">
                {t('settings.ai.stats.title')}
              </span>
            </div>
            <span className="text-xs font-bold text-[#ff6b35]">
              {activeCount} {t('settings.ai.stats.active')}
            </span>
          </div>
          <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(activeCount / AI_OPTIONS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] rounded-full"
            />
          </div>
        </div>
      )}

      {/* Options AI */}
      <div className="space-y-3">
        <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
          {t('settings.ai.features')}
        </Label>
        {AI_OPTIONS.map((option) => {
          const Icon = option.icon;
          const value = safeAi[option.id] === true;
          
          return (
            <AiOption
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

      {/* Niveau de difficulté */}
      <div className="space-y-4">
        <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
          {t('settings.ai.difficulty.title')}
        </Label>
        <div className="grid grid-cols-1 gap-3">
          {DIFFICULTY_OPTIONS.map((level) => {
            const Icon = level.icon;
            const isSelected = currentDifficulty === level.id;
            
            return (
              <DifficultyLevel
                key={level.id}
                level={level.id}
                icon={Icon}
                label={t(level.labelKey)}
                description={t(level.descKey)}
                isSelected={isSelected}
                onClick={() => handleDifficultyChange(level.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Message d'information premium */}
      {!isUserPremium && (
        <div className="mt-4 p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.ai.premiumHint')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.ai.premiumHintDetail')}
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

AiPreferencesSubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default AiPreferencesSubSection;
AiOption.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isPremium: PropTypes.bool,
};
DifficultyLevel.propTypes = {
  level: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};
