// components/SectionContent/PerformanceSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Database, Zap, Loader2, Check, Info, 
  Battery, Wifi, Cpu, HardDrive, Trash2,
  RefreshCw, AlertTriangle, Sparkles, Shield
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Label } from '../../../../components/ui/label';
import ToggleSwitch from '../ToggleSwitch';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT DE CARD CACHE
// =============================
const CacheCard = ({ cacheSize, onClear, isLoading }) => {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  
  const formatSize = (size) => {
    if (typeof size !== 'string') return size;
    return size;
  };
  
  const handleClear = () => {
    if (showConfirm) {
      onClear();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 5000);
    }
  };
  
  return (
    <div className="p-5 bg-foreground/5 rounded-2xl border border-foreground/10">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-[#ff6b35]/10 rounded-xl">
          <HardDrive className="w-5 h-5 text-[#ff6b35]" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-foreground">
            {t('settings.performance.cache.title')}
          </h4>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {t('settings.performance.cache.description')}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-mono text-foreground/40">
              {formatSize(cacheSize)}
            </span>
            <div className="h-1 flex-1 bg-foreground/10 rounded-full overflow-hidden">
              <div className="w-1/2 h-full bg-[#ff6b35]/30 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      
      {!showConfirm ? (
        <Button 
          variant="outline" 
          onClick={handleClear}
          disabled={isLoading}
          className="w-full mt-4 py-3 border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 rounded-xl font-bold text-xs tracking-widest transition-all group"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('settings.performance.cache.clearing')}
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              {t('settings.performance.cache.clear')}
            </>
          )}
        </Button>
      ) : (
        <div className="mt-4 p-3 bg-red-500/5 rounded-xl border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <p className="text-[10px] font-bold text-red-500">
              {t('settings.performance.cache.confirm')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleClear}
              className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold"
            >
              {t('common.confirm')}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 rounded-lg text-xs font-bold"
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT D'OPTION PERFORMANCE
// =============================
const PerformanceOption = ({ id, label, description, icon: Icon, value, onChange, isPremium = false }) => {
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
        <div className={`
          p-2 rounded-xl transition-all
          ${value ? 'bg-[#ff6b35]/20' : 'bg-foreground/5 group-hover:bg-[#ff6b35]/10'}
        `}>
          <Icon className={`w-5 h-5 ${value ? 'text-[#ff6b35]' : 'text-muted-foreground'}`} />
        </div>
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
                {t('settings.performance.premiumFeature')}
              </span>
            </div>
          )}
        </div>
        <ToggleSwitch 
          enabled={value} 
          onChange={onChange}
          aria-label={label}
        />
      </div>
      
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl" />
    </div>
  );
};

// =============================
// 3️⃣ CONFIGURATION
// =============================
const PERFORMANCE_OPTIONS = [
  { 
    id: 'dataSaver', 
    icon: Battery,
    labelKey: 'settings.performance.dataSaver.label',
    descKey: 'settings.performance.dataSaver.desc',
    isPremium: false
  },
  { 
    id: 'preloadImages', 
    icon: Wifi,
    labelKey: 'settings.performance.preload.label',
    descKey: 'settings.performance.preload.desc',
    isPremium: false
  },
  { 
    id: 'hardwareAcceleration', 
    icon: Cpu,
    labelKey: 'settings.performance.hardware.label',
    descKey: 'settings.performance.hardware.desc',
    isPremium: true
  },
  { 
    id: 'backgroundSync', 
    icon: RefreshCw,
    labelKey: 'settings.performance.sync.label',
    descKey: 'settings.performance.sync.desc',
    isPremium: true
  }
];

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const PerformanceSection = () => {
  const { t } = useTranslation();
  const { performance, updateNested, isDirty, saveSettings, cache, isUserPremium = false } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safePerformance = performance || { dataSaver: false, preloadImages: true, cacheSize: 'auto' };

  // =============================
  // 5️⃣ STATISTIQUES
  // =============================
  const activeCount = useMemo(() => {
    return PERFORMANCE_OPTIONS.filter(opt => safePerformance[opt.id] === true).length;
  }, [safePerformance]);

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
    const option = PERFORMANCE_OPTIONS.find(opt => opt.id === optionId);
    if (option?.isPremium && !isUserPremium) {
      toast.info(t('settings.performance.premiumRequired'));
      return;
    }
    updateNested('performance', optionId, !currentValue);
  }, [updateNested, isUserPremium, t]);

  const handleClearCache = useCallback(async () => {
    try {
      await cache.clear();
      toast.success(t('settings.performance.cache.cleared'));
    } catch (error) {
      toast.error(t('settings.performance.cache.error'));
    }
  }, [cache, t]);

  // =============================
  // 8️⃣ RENDU
  // =============================
  return (
    <div className="space-y-8">
      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.performance.title')}
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
        {t('settings.performance.description')}
      </p>

      {/* Carte Cache */}
      <CacheCard 
        cacheSize={cache.size}
        onClear={handleClearCache}
        isLoading={cache.loading}
      />

      {/* Statistiques */}
      {activeCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ff6b35]" />
              <span className="text-xs font-bold text-foreground">
                {t('settings.performance.stats.title')}
              </span>
            </div>
            <span className="text-xs font-bold text-[#ff6b35]">
              {activeCount} {activeCount === 1 ? 'option active' : 'options actives'}
            </span>
          </div>
          <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(activeCount / PERFORMANCE_OPTIONS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] rounded-full"
            />
          </div>
        </div>
      )}

      {/* Options Performance */}
      <div className="space-y-3">
        <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
          {t('settings.performance.options')}
        </Label>
        {PERFORMANCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const value = safePerformance[option.id] === true;
          
          return (
            <PerformanceOption
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
            <Shield className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.performance.premiumHint')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.performance.premiumHintDetail')}
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

PerformanceSection.propTypes = {};

export default PerformanceSection;
CacheCard.propTypes = {
  cacheSize: PropTypes.any.isRequired,
  onClear: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
PerformanceOption.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isPremium: PropTypes.bool,
};
