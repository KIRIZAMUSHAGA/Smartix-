// components/SubSections/FilteringSubSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Shield, Eye, GraduationCap, Loader2, Check, AlertTriangle, Sparkles } from 'lucide-react';
import ToggleSwitch from '../ToggleSwitch';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT D'OPTION DE FILTRAGE
// =============================
const FilterOption = ({ id, label, description, icon: Icon, value, onChange, isStrict = false }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`
      group relative p-4 rounded-2xl border transition-all
      ${value 
        ? 'bg-gradient-to-r from-[#ff6b35]/10 to-transparent border-[#ff6b35]/30' 
        : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'
      }
      ${isStrict && value ? 'border-red-500/50 bg-red-500/5' : ''}
    `}>
      <div className="flex items-start gap-4">
        {/* Icône */}
        <div className={`
          p-2 rounded-xl transition-all
          ${value ? 'bg-[#ff6b35]/20' : 'bg-foreground/5 group-hover:bg-[#ff6b35]/10'}
          ${isStrict && value ? 'bg-red-500/20' : ''}
        `}>
          <Icon className={`
            w-5 h-5 
            ${value ? 'text-[#ff6b35]' : 'text-muted-foreground'}
            ${isStrict && value ? 'text-red-500' : ''}
          `} />
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
            {isStrict && value && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 font-bold uppercase tracking-wider">
                Mode strict
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
// 2️⃣ COMPOSANT D'AVERTISSEMENT MODE STRICT
// =============================
const StrictModeWarning = () => {
  const { t } = useTranslation();
  
  return (
    <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-red-500">
            {t('settings.filter.strict.warning')}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {t('settings.filter.strict.description')}
          </p>
        </div>
      </div>
    </div>
  );
};

// =============================
// 3️⃣ COMPOSANT DE STATISTIQUES
// =============================
const FilterStats = ({ activeFilters, totalFilters }) => {
  const { t } = useTranslation();
  const percentage = totalFilters > 0 ? Math.round((activeFilters / totalFilters) * 100) : 0;
  
  return (
    <div className="p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#ff6b35]" />
          <span className="text-xs font-bold text-foreground">
            {t('settings.filter.stats.title')}
          </span>
        </div>
        <span className="text-xs font-bold text-[#ff6b35]">
          {activeFilters}/{totalFilters} {t('settings.filter.stats.active')}
        </span>
      </div>
      <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] rounded-full"
        />
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        {percentage}% {t('settings.filter.stats.description')}
      </p>
    </div>
  );
};

// =============================
// 4️⃣ CONFIGURATION
// =============================
const FILTER_OPTIONS = [
  { 
    id: 'filterLang', 
    icon: Shield,
    labelKey: 'settings.filter.language.label',
    descKey: 'settings.filter.language.desc',
    isStrict: false
  },
  { 
    id: 'hideOffTopic', 
    icon: Eye,
    labelKey: 'settings.filter.offTopic.label',
    descKey: 'settings.filter.offTopic.desc',
    isStrict: false
  },
  { 
    id: 'strictMode', 
    icon: GraduationCap,
    labelKey: 'settings.filter.strict.label',
    descKey: 'settings.filter.strict.desc',
    isStrict: true
  }
];

// =============================
// 5️⃣ COMPOSANT PRINCIPAL
// =============================
const FilteringSubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { filter, updateNested, isDirty, saveSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeFilter = filter || {};

  // =============================
  // 6️⃣ STATISTIQUES
  // =============================
  const activeCount = useMemo(() => {
    return FILTER_OPTIONS.filter(opt => safeFilter[opt.id] === true).length;
  }, [safeFilter]);

  const totalOptions = FILTER_OPTIONS.length;
  const isStrictModeActive = safeFilter.strictMode === true;

  // =============================
  // 7️⃣ SAUVEGARDE AVEC DEBOUNCE
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
  // 8️⃣ GESTIONNAIRES
  // =============================
  const handleToggle = useCallback((optionId, currentValue) => {
    const newValue = !currentValue;
    
    // Si on active le mode strict, on peut aussi activer les autres filtres
    if (optionId === 'strictMode' && newValue) {
      // Optionnel : activer automatiquement les autres filtres
      updateNested('filter', 'filterLang', true);
      updateNested('filter', 'hideOffTopic', true);
    }
    
    updateNested('filter', optionId, newValue);
  }, [updateNested]);

  // =============================
  // 9️⃣ RENDU
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
          <Shield className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.filter.title')}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('settings.filter.description')}
        </p>
      </div>

      {/* Statistiques */}
      {activeCount > 0 && (
        <FilterStats activeFilters={activeCount} totalFilters={totalOptions} />
      )}

      {/* Liste des options */}
      <div className="space-y-3">
        {FILTER_OPTIONS.map((option) => {
          const Icon = option.icon;
          const value = safeFilter[option.id] === true;
          
          return (
            <FilterOption
              key={option.id}
              id={option.id}
              icon={Icon}
              label={t(option.labelKey)}
              description={t(option.descKey)}
              value={value}
              onChange={() => handleToggle(option.id, value)}
              isStrict={option.isStrict}
            />
          );
        })}
      </div>

      {/* Avertissement mode strict */}
      {isStrictModeActive && (
        <StrictModeWarning />
      )}

      {/* Message d'information */}
      {!isStrictModeActive && (
        <div className="mt-4 p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.filter.info')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.filter.infoDetail')}
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

FilteringSubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default FilteringSubSection;
FilterOption.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isStrict: PropTypes.bool,
};
StrictModeWarning.propTypes = {};
FilterStats.propTypes = {
  activeFilters: PropTypes.any.isRequired,
  totalFilters: PropTypes.any.isRequired,
};
