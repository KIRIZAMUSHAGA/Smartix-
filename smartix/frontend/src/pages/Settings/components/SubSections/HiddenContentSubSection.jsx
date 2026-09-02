// components/SubSections/HiddenContentSubSection.jsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, EyeOff, User, Hash, Trash2, Loader2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT DE STATISTIQUE
// =============================
const StatCard = ({ icon: Icon, label, count, color = "text-[#ff6b35]" }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-foreground/5 rounded-2xl border border-foreground/10 hover:bg-foreground/10 transition-colors group">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#ff6b35]/10 rounded-xl group-hover:bg-[#ff6b35]/20 transition-colors">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <span className="text-sm font-bold text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black text-foreground/30">{count}</span>
        {count > 0 && (
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT DE LISTE D'ÉLÉMENTS MASQUÉS
// =============================
const HiddenItemsList = ({ title, items, icon: Icon, onUnhide, emptyMessage }) => {
  const { t } = useTranslation();
  
  if (!items || items.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground/60" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
          {title} ({items.length})
        </h4>
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((item, index) => (
          <div key={item.id || index} className="flex items-center justify-between p-3 bg-foreground/5 rounded-xl border border-foreground/10">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{item.name || item.title || item}</p>
              {item.reason && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{item.reason}</p>
              )}
            </div>
            <button
              onClick={() => onUnhide(item.id || item)}
              className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors group"
              aria-label={`Débloquer ${item.name || item}`}
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground/40 group-hover:text-green-500 transition-colors" />
            </button>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-[10px] text-muted-foreground/40 text-center">
            +{items.length - 5} autres éléments masqués
          </p>
        )}
      </div>
    </div>
  );
};

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================
const HiddenContentSubSection = ({ onBack }) => {
  const { t } = useTranslation();
  const { hidden, resetContentPreferences, updateNested, isDirty, saveSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ✅ Sécurisation des données
  const safeHidden = hidden || { posts: [], authors: [], themes: [] };
  
  const stats = useMemo(() => [
    { 
      id: 'posts', 
      label: t('settings.hidden.posts'), 
      count: safeHidden.posts?.length || 0, 
      icon: EyeOff,
      color: 'text-red-500'
    },
    { 
      id: 'authors', 
      label: t('settings.hidden.authors'), 
      count: safeHidden.authors?.length || 0, 
      icon: User,
      color: 'text-orange-500'
    },
    { 
      id: 'themes', 
      label: t('settings.hidden.themes'), 
      count: safeHidden.themes?.length || 0, 
      icon: Hash,
      color: 'text-blue-500'
    }
  ], [safeHidden, t]);

  const totalHidden = useMemo(() => {
    return (safeHidden.posts?.length || 0) + 
           (safeHidden.authors?.length || 0) + 
           (safeHidden.themes?.length || 0);
  }, [safeHidden]);

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
  const handleUnhidePost = useCallback((postId) => {
    const newPosts = (safeHidden.posts || []).filter(p => p.id !== postId && p !== postId);
    updateNested('hidden', 'posts', newPosts);
    toast.success(t('settings.hidden.postUnhidden'));
  }, [safeHidden.posts, updateNested, t]);

  const handleUnhideAuthor = useCallback((authorId) => {
    const newAuthors = (safeHidden.authors || []).filter(a => a.id !== authorId && a !== authorId);
    updateNested('hidden', 'authors', newAuthors);
    toast.success(t('settings.hidden.authorUnhidden'));
  }, [safeHidden.authors, updateNested, t]);

  const handleUnhideTheme = useCallback((themeId) => {
    const newThemes = (safeHidden.themes || []).filter(t => t.id !== themeId && t !== themeId);
    updateNested('hidden', 'themes', newThemes);
    toast.success(t('settings.hidden.themeUnhidden'));
  }, [safeHidden.themes, updateNested, t]);

  const handleResetAll = useCallback(() => {
    resetContentPreferences();
    setShowConfirmReset(false);
    toast.success(t('settings.hidden.allReset'));
  }, [resetContentPreferences, t]);

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

      {/* En-tête avec description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <EyeOff className="w-5 h-5 text-[#ff6b35]" />
          <h3 className="text-lg font-bold text-foreground">
            {t('settings.hidden.title')}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('settings.hidden.description')}
        </p>
      </div>

      {/* Statistiques */}
      <div className="space-y-3">
        <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
          {t('settings.hidden.stats')}
        </Label>
        <div className="grid grid-cols-1 gap-2">
          {stats.map((stat) => (
            <StatCard
              key={stat.id}
              icon={stat.icon}
              label={stat.label}
              count={stat.count}
              color={stat.color}
            />
          ))}
        </div>
      </div>

      {/* Liste des contenus masqués */}
      {totalHidden > 0 && (
        <div className="space-y-6">
          <Label className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">
            {t('settings.hidden.items')}
          </Label>
          
          <HiddenItemsList
            title={t('settings.hidden.posts')}
            items={safeHidden.posts}
            icon={EyeOff}
            onUnhide={handleUnhidePost}
            emptyMessage={t('settings.hidden.noPosts')}
          />
          
          <HiddenItemsList
            title={t('settings.hidden.authors')}
            items={safeHidden.authors}
            icon={User}
            onUnhide={handleUnhideAuthor}
            emptyMessage={t('settings.hidden.noAuthors')}
          />
          
          <HiddenItemsList
            title={t('settings.hidden.themes')}
            items={safeHidden.themes}
            icon={Hash}
            onUnhide={handleUnhideTheme}
            emptyMessage={t('settings.hidden.noThemes')}
          />
        </div>
      )}

      {/* Message si rien n'est masqué */}
      {totalHidden === 0 && (
        <div className="p-8 text-center bg-foreground/5 rounded-2xl border border-foreground/10">
          <EyeOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('settings.hidden.empty')}
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">
            {t('settings.hidden.emptyHint')}
          </p>
        </div>
      )}

      {/* Bouton de réinitialisation avec confirmation */}
      {totalHidden > 0 && (
        <div className="pt-4">
          {!showConfirmReset ? (
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmReset(true)}
              className="w-full py-6 border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 rounded-2xl font-black uppercase text-xs tracking-widest transition-all group"
            >
              <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              {t('settings.hidden.resetButton')}
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-red-500/5 rounded-2xl border border-red-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="text-xs font-bold text-red-500">
                  {t('settings.hidden.confirmTitle')}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {t('settings.hidden.confirmDescription')}
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={handleResetAll}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold"
                >
                  {t('common.confirm')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
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

HiddenContentSubSection.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default HiddenContentSubSection;
StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  color: PropTypes.string,
};
HiddenItemsList.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  onUnhide: PropTypes.func.isRequired,
  emptyMessage: PropTypes.any.isRequired,
};
