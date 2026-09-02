// components/SubSections/InterestsSubSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Sparkles, Loader2, Check, Search, X } from 'lucide-react';
import { Label } from '../../../components/ui/label';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT DE BADGE POUR LES INTÉRÊTS SÉLECTIONNÉS
// =============================
const SelectedBadge = ({ label, onRemove }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#ff6b35]/20 text-[#ff6b35] text-xs font-bold rounded-full">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-[#ff6b35]/30 rounded-full p-0.5 transition-colors"
        aria-label={`Retirer ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
};

// =============================
// 2️⃣ COMPOSANT D'INTÉRÊT (réutilisable)
// =============================
const InterestItem = ({ interest, onToggle, isSelected }) => {
  const { t } = useTranslation();
  
  return (
    <button
      onClick={() => onToggle(interest.id)}
      className={`
        group relative overflow-hidden p-4 rounded-2xl border transition-all
        focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:ring-offset-2
        ${isSelected 
          ? 'border-[#ff6b35] bg-gradient-to-r from-[#ff6b35]/15 to-transparent' 
          : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10'
        }
      `}
      aria-label={interest.label}
      aria-pressed={isSelected}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-foreground">
            {interest.label}
          </span>
          {interest.description && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {interest.description}
            </p>
          )}
        </div>
        <div className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
          ${isSelected 
            ? 'bg-[#ff6b35] border-[#ff6b35]' 
            : 'border-foreground/20 group-hover:border-[#ff6b35]/50'
          }
        `}>
          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
      </div>
      
      {/* Effet de brillance au survol */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </button>
  );
};

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================
const InterestsSubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { interests, updateCategory, isDirty, saveSettings } = useSettings();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeInterests = useMemo(() => {
    if (!interests || !Array.isArray(interests)) return [];
    return interests;
  }, [interests]);

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
  const toggleInterest = useCallback((id) => {
    const newInterests = safeInterests.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    );
    updateCategory('interests', newInterests);
  }, [safeInterests, updateCategory]);

  const removeInterest = useCallback((id) => {
    const newInterests = safeInterests.map(item => 
      item.id === id ? { ...item, selected: false } : item
    );
    updateCategory('interests', newInterests);
  }, [safeInterests, updateCategory]);

  // =============================
  // 6️⃣ FILTRAGE ET STATISTIQUES
  // =============================
  const selectedCount = useMemo(() => {
    return safeInterests.filter(i => i.selected === true).length;
  }, [safeInterests]);

  const filteredInterests = useMemo(() => {
    if (!searchTerm) return safeInterests;
    return safeInterests.filter(interest =>
      interest.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interest.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [safeInterests, searchTerm]);

  const selectedInterests = useMemo(() => {
    return safeInterests.filter(i => i.selected === true);
  }, [safeInterests]);

  // =============================
  // 7️⃣ RENDU
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

      {/* Section sélection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
              {t('settings.interests.title')}
            </Label>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              {t('settings.interests.subtitle')}
            </p>
          </div>
          {selectedCount > 0 && (
            <span className="text-[10px] text-[#ff6b35]">
              {selectedCount} {selectedCount === 1 ? 'thème sélectionné' : 'thèmes sélectionnés'}
            </span>
          )}
        </div>

        {/* Badges des intérêts sélectionnés */}
        {selectedInterests.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-foreground/5 rounded-xl border border-foreground/10">
            {selectedInterests.map(interest => (
              <SelectedBadge
                key={interest.id}
                label={interest.label}
                onRemove={() => removeInterest(interest.id)}
              />
            ))}
          </div>
        )}

        {/* Barre de recherche */}
        <div className="relative">
          <input
            type="text"
            placeholder={t('settings.interests.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-border rounded-2xl p-3 pl-9 text-sm outline-none focus:border-[#ff6b35] transition-all"
            aria-label={t('settings.interests.search')}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-foreground/10 rounded-full transition-colors"
              aria-label={t('common.clear')}
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Liste des intérêts */}
        <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
          {filteredInterests.length > 0 ? (
            filteredInterests.map((interest) => (
              <InterestItem
                key={interest.id}
                interest={interest}
                onToggle={toggleInterest}
                isSelected={interest.selected === true}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('settings.interests.noResults')}</p>
            </div>
          )}
        </div>

        {/* Message d'explication */}
        <div className="mt-4 p-4 bg-gradient-to-r from-[#ff6b35]/5 to-transparent rounded-xl border border-[#ff6b35]/10">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#ff6b35] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">
                {t('settings.interests.hint')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {t('settings.interests.hintDetail')}
              </p>
            </div>
          </div>
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

InterestsSubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default InterestsSubSection;
SelectedBadge.propTypes = {
  label: PropTypes.string.isRequired,
  onRemove: PropTypes.func.isRequired,
};
InterestItem.propTypes = {
  interest: PropTypes.any.isRequired,
  onToggle: PropTypes.func.isRequired,
  isSelected: PropTypes.bool.isRequired,
};
