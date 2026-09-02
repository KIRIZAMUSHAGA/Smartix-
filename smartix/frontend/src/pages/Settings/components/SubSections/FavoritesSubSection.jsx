// components/SubSections/FavoritesSubSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Star, Sparkles, Loader2, Check, Heart, Bell, RefreshCw, Info } from 'lucide-react';
import ToggleSwitch from '../ToggleSwitch';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT RÉUTILISABLE FavorisRow
// =============================
const FavoritesRow = ({ id, label, description, icon: Icon, value, onChange, isPremium = false }) => {
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
            {isPremium && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white font-bold uppercase tracking-wider">
                Premium
              </span>
            )}
            {value && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#ff6b35]/20 text-[#ff6b35] font-bold uppercase tracking-wider">
                Actif
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
      
      {/* Effet de brillance au survol */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl" />
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT DE STATISTIQUES
// =============================
const FavoritesStats = ({ count, total }) => {
  const { t } = useTranslation();
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-[#ff6b35]" />
          <span className="text-xs font-bold text-foreground">
            {t('settings.favorites.stats.title')}
          </span>
        </div>
        <span className="text-xs font-bold text-[#ff6b35]">
          {count}/{total} {t('settings.favorites.stats.active')}
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
        {percentage}% {t('settings.favorites.stats.description')}
      </p>
    </div>
  );
};

// =============================
// 3️⃣ CONFIGURATION
// =============================
const FAVORITES_OPTIONS = [
  { 
    id: 'priorityFavs', 
    icon: Star,
    labelKey: 'settings.favorites.priority.label',
    descKey: 'settings.favorites.priority.desc',
    isPremium: false
  },
  { 
    id: 'similarNotifs', 
    icon: Bell,
    labelKey: 'settings.favorites.similar.label',
    descKey: 'settings.favorites.similar.desc',
    isPremium: true
  },
  { 
    id: 'autoSync', 
    icon: RefreshCw,
    labelKey: 'settings.favorites.sync.label',
    descKey: 'settings.favorites.sync.desc',
    isPremium: false
  },
  { 
    id: 'favoritesFeed', 
    icon: Heart,
    labelKey: 'settings.favorites.feed.label',
    descKey: 'settings.favorites.feed.desc',
    isPremium: true
  }
];

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const FavoritesSubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { fav, updateNested, isDirty, saveSettings, isUserPremium = false } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeFav = fav || {};

  // =============================
  // 5️⃣ STATISTIQUES
  // =============================
  const activeCount = useMemo(() => {
    return FAVORITES_OPTIONS.filter(opt => safeFav[opt.id] === true).length;
  }, [safeFav]);

  const totalOptions = FAVORITES_OPTIONS.length;

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
    // Vérification premium
    const option = FAVORITES_OPTIONS.find(opt => opt.id === optionId);
    if (option?.isPremium && !isUserPremium) {
      toast.info(t('settings.favorites.premiumRequired'));
      return;
    }
    updateNested('fav', optionId, !currentValue);
  }, [updateNested, isUserPremium, t]);

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
          <Star className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.favorites.title')}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('settings.favorites.description')}
        </p>
      </div>

      {/* Statistiques */}
      {activeCount > 0 && (
        <FavoritesStats count={activeCount} total={totalOptions} />
      )}

      {/* Liste des options */}
      <div className="space-y-3">
        {FAVORITES_OPTIONS.map((option) => {
          const Icon = option.icon;
          const value = safeFav[option.id] === true;
          
          return (
            <FavoritesRow
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
        <div className="mt-4 p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.favorites.premiumHint')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.favorites.premiumHintDetail')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Message d'information sur la synchronisation */}
      {safeFav.autoSync && (
        <div className="mt-2 p-3 bg-green-500/5 rounded-xl border border-green-500/20">
          <div className="flex items-start gap-2">
            <RefreshCw className="w-3 h-3 text-green-500 mt-0.5" />
            <p className="text-[10px] text-muted-foreground/60">
              {t('settings.favorites.sync.activeHint')}
            </p>
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

FavoritesSubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default FavoritesSubSection;
FavoritesRow.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isPremium: PropTypes.bool,
};
FavoritesStats.propTypes = {
  count: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
};
