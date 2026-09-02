// components/SubSections/StudySubSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronLeft, GraduationCap, Brain, BookOpen, Loader2, Check, 
  Zap, Timer, Target, Sparkles, Moon, Sun, BellOff, EyeOff 
} from 'lucide-react';
import ToggleSwitch from '../ToggleSwitch';
import { Label } from '../../../../components/ui/label';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT DE CARD MODE ÉTUDE
// =============================
const StudyModeCard = ({ enabled, onToggle }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`
      relative overflow-hidden p-6 rounded-2xl transition-all cursor-pointer
      ${enabled 
        ? 'bg-gradient-to-br from-[#ff6b35]/20 via-[#ff6b35]/10 to-transparent border-2 border-[#ff6b35]' 
        : 'bg-foreground/5 border border-foreground/10 hover:bg-foreground/10'
      }
    `} onClick={onToggle}>
      {/* Effet de brillance */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`
            p-3 rounded-xl transition-all
            ${enabled ? 'bg-[#ff6b35]/20' : 'bg-foreground/5'}
          `}>
            <GraduationCap className={`w-6 h-6 ${enabled ? 'text-[#ff6b35]' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h4 className="text-lg font-black tracking-tight text-foreground">
              {t('settings.study.mode.title')}
            </h4>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {enabled 
                ? t('settings.study.mode.activeDesc') 
                : t('settings.study.mode.inactiveDesc')}
            </p>
          </div>
        </div>
        <ToggleSwitch 
          enabled={enabled} 
          onChange={onToggle}
          aria-label={t('settings.study.mode.toggle')}
        />
      </div>
      
      {/* Indicateur de session */}
      {enabled && (
        <div className="mt-4 pt-4 border-t border-[#ff6b35]/20">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
            <div className="flex items-center gap-1">
              <Timer className="w-3 h-3 text-[#ff6b35]" />
              <span>{t('settings.study.mode.focusTime')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-[#ff6b35]" />
              <span>{t('settings.study.mode.dailyGoal')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#ff6b35]" />
              <span>{t('settings.study.mode.productivity')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT D'OPTION ÉTUDE
// =============================
const StudyOption = ({ id, label, description, icon: Icon, value, onChange, isActive }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`
      group relative p-4 rounded-2xl border transition-all
      ${value 
        ? 'bg-gradient-to-r from-[#ff6b35]/10 to-transparent border-[#ff6b35]/30' 
        : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'
      }
      ${isActive && !value ? 'opacity-60' : ''}
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
            {isActive && !value && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-500 font-bold uppercase tracking-wider">
                Mode étude inactif
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
          disabled={isActive && !value}
          aria-label={label}
        />
      </div>
      
      {/* Effet de brillance */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl" />
    </div>
  );
};

// =============================
// 3️⃣ CONFIGURATION
// =============================
const STUDY_OPTIONS = [
  { 
    id: 'hideNonEdu', 
    icon: EyeOff,
    labelKey: 'settings.study.options.hideNonEdu.label',
    descKey: 'settings.study.options.hideNonEdu.desc'
  },
  { 
    id: 'priorityExercises', 
    icon: Brain,
    labelKey: 'settings.study.options.priorityExercises.label',
    descKey: 'settings.study.options.priorityExercises.desc'
  },
  { 
    id: 'focusMode', 
    icon: Moon,
    labelKey: 'settings.study.options.focusMode.label',
    descKey: 'settings.study.options.focusMode.desc'
  },
  { 
    id: 'blockNotifications', 
    icon: BellOff,
    labelKey: 'settings.study.options.blockNotifications.label',
    descKey: 'settings.study.options.blockNotifications.desc'
  }
];

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const StudySubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { study, updateNested, isDirty, saveSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeStudy = study || { studyMode: false };

  // =============================
  // 5️⃣ STATISTIQUES
  // =============================
  const isStudyModeActive = safeStudy.studyMode === true;
  const activeCount = useMemo(() => {
    if (!isStudyModeActive) return 0;
    return STUDY_OPTIONS.filter(opt => safeStudy[opt.id] === true).length;
  }, [safeStudy, isStudyModeActive]);

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
  const handleStudyModeToggle = useCallback((newValue) => {
    updateNested('study', 'studyMode', newValue);
    
    // Si on désactive le mode étude, on désactive aussi les options associées
    if (!newValue) {
      STUDY_OPTIONS.forEach(opt => {
        if (safeStudy[opt.id]) {
          updateNested('study', opt.id, false);
        }
      });
    }
  }, [updateNested, safeStudy]);

  const handleOptionToggle = useCallback((optionId, currentValue) => {
    if (!isStudyModeActive) {
      toast.info(t('settings.study.activateModeFirst'));
      return;
    }
    updateNested('study', optionId, !currentValue);
  }, [isStudyModeActive, updateNested, t]);

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
          <BookOpen className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.study.title')}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('settings.study.description')}
        </p>
      </div>

      {/* Carte Mode Étude */}
      <StudyModeCard 
        enabled={isStudyModeActive}
        onToggle={() => handleStudyModeToggle(!isStudyModeActive)}
      />

      {/* Options avancées */}
      {isStudyModeActive && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
              {t('settings.study.options.title')}
            </Label>
            {activeCount > 0 && (
              <span className="text-[10px] text-green-500">
                {activeCount} {activeCount === 1 ? 'option active' : 'options actives'}
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            {STUDY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const value = safeStudy[option.id] === true;
              
              return (
                <StudyOption
                  key={option.id}
                  id={option.id}
                  icon={Icon}
                  label={t(option.labelKey)}
                  description={t(option.descKey)}
                  value={value}
                  onChange={() => handleOptionToggle(option.id, value)}
                  isActive={isStudyModeActive}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Message d'information */}
      {!isStudyModeActive && (
        <div className="mt-4 p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.study.hint')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.study.hintDetail')}
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

StudySubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default StudySubSection;
StudyModeCard.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};
StudyOption.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isActive: PropTypes.bool.isRequired,
};
