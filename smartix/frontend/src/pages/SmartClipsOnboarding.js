import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ChevronRight, Sparkles, Check, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MAX_TAGS = 5;
const CACHE_TTL = 60 * 60 * 1000; // 1 heure
const DEFAULT_TAGS = ['education', 'technology', 'science'];

// Icônes par tag (extensible)
const TAG_ICONS = {
  education: '📚',
  science: '🔬',
  technology: '💻',
  nature: '🌿',
  art: '🎨',
  music: '🎵',
  sport: '⚽',
  travel: '✈️',
  food: '🍕',
  fashion: '👗',
  gaming: '🎮',
  news: '📰',
  business: '💼',
  health: '💪',
  comedy: '😂',
  programming: '👨‍💻',
  design: '🎨',
  photography: '📷',
  fitness: '🏋️',
  meditation: '🧘',
  default: '📌'
};

// Messages personnalisés selon le nombre de tags sélectionnés
const getTagMessage = (count) => {
  if (count === 0) return 'Sélectionnez vos catégories préférées';
  if (count === 1) return '1 catégorie sélectionnée';
  if (count < MAX_TAGS) return `${count} catégories sélectionnées`;
  return `Maximum ${MAX_TAGS} catégories atteint`;
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SmartClipsOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getTagsCache, updateTagsCache } = useGlobalCache();

  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(DEFAULT_TAGS); // ✅ Pré-sélection intelligente
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const initialized = useRef(false); // ✅ Évite les appels multiples

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // VÉRIFICATION ONBOARDING
  // =============================
  const checkOnboarding = useCallback(async () => {
    if (!user?.id) return true;

    try {
      const response = await client.get(`/smartclips/v2/onboarding-required`);
      
      if (!response.data.required) {
        navigate('/smartclips');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking onboarding:', error);
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
        return false;
      }
      return true;
    }
  }, [user, client, navigate]);

  // =============================
  // CHARGEMENT DES TAGS
  // =============================
  const fetchTags = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Vérifier le cache
      const cached = getTagsCache(user.id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setAvailableTags(cached.data);
        setLoading(false);
        return;
      }

      const response = await client.get('/smartclips/v2/available-tags');
      const tags = response.data.tags || [];
      
      setAvailableTags(tags);
      
      // Mettre en cache
      updateTagsCache(user.id, {
        data: tags,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError(error);
      setAvailableTags(DEFAULT_TAGS);
      
      if (error.response?.status !== 401) {
        toast.error('Erreur chargement des catégories', {
          description: 'Utilisation des catégories par défaut'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, client, getTagsCache, updateTagsCache]);

  // =============================
  // INITIALISATION (avec flag anti-double appel)
  // =============================
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const shouldShow = await checkOnboarding();
      if (shouldShow) {
        await fetchTags();
      }
    };

    init();
  }, [checkOnboarding, fetchTags]);

  // =============================
  // GESTION DES TAGS
  // =============================
  const toggleTag = useCallback((tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        const newTags = prev.filter(t => t !== tag);
        // Message de confirmation
        toast.info(`Catégorie "${tag}" retirée`, { duration: 1500 });
        return newTags;
      }
      if (prev.length >= MAX_TAGS) {
        toast.info(`Maximum ${MAX_TAGS} catégories`, {
          description: 'Retirez une catégorie pour en ajouter une nouvelle'
        });
        return prev;
      }
      toast.success(`Catégorie "${tag}" ajoutée`, { duration: 1500 });
      return [...prev, tag];
    });
  }, []);

  // =============================
  // SAUVEGARDE DES PRÉFÉRENCES
  // =============================
  const handleContinue = useCallback(async () => {
    if (selectedTags.length === 0) {
      toast.error('Sélectionnez au moins une catégorie', {
        description: 'Pour personnaliser votre fil de vidéos'
      });
      return;
    }

    setSaving(true);
    try {
      // ✅ Plus d'ID utilisateur envoyé côté frontend
      await client.post('/smartclips/v2/preferences', {
        favorite_tags: selectedTags
      });

      toast.success('Préférences enregistrées !', {
        description: 'Votre fil est maintenant personnalisé'
      });
      navigate('/smartclips');
    } catch (error) {
      console.error('Error saving preferences:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors de la sauvegarde des préférences');
      }
    } finally {
      setSaving(false);
    }
  }, [selectedTags, client, navigate]);

  // =============================
  // PASSER L'ONBOARDING
  // =============================
  const skipOnboarding = useCallback(async () => {
    setSaving(true);
    try {
      // ✅ Plus d'ID utilisateur envoyé côté frontend
      await client.post('/smartclips/v2/preferences', {
        favorite_tags: DEFAULT_TAGS
      });
    } catch (error) {
      console.error('Error saving default preferences:', error);
      // On ignore l'erreur, on navigue quand même
    } finally {
      navigate('/smartclips');
      setSaving(false);
    }
  }, [client, navigate]);

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#1A1A2E] to-[#16213E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-12 h-12 animate-spin text-[#005CFF]" />
          <p className="text-white/50 text-sm animate-pulse">
            Chargement des catégories...
          </p>
        </div>
      </div>
    );
  }

  const tagMessage = getTagMessage(selectedTags.length);
  const isMaxReached = selectedTags.length === MAX_TAGS;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#1A1A2E] to-[#16213E] overflow-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] blur-2xl opacity-50 animate-pulse"></div>
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#005CFF] to-[#44B0FF] flex items-center justify-center shadow-xl">
                <Play className="w-10 h-10 text-white" fill="white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">
              Bienvenue sur SmartClips
            </h1>
            <p className="text-white/60">
              Personnalisez votre fil de vidéos
            </p>
          </div>

          {/* Sélection des tags */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#44B0FF]" />
              <h2 className="text-lg font-semibold text-white">
                Vos centres d'intérêt
              </h2>
            </div>
            
            <p className="text-white/50 text-sm mb-4">
              Sélectionnez jusqu'à {MAX_TAGS} catégories qui vous intéressent
            </p>

            {/* Tags grid */}
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                const icon = TAG_ICONS[tag] || TAG_ICONS.default;
                
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    disabled={!isSelected && isMaxReached}
                    className={`
                      px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200
                      flex items-center gap-2
                      ${isSelected
                        ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white shadow-lg shadow-[#005CFF]/30'
                        : isMaxReached
                          ? 'bg-white/5 text-white/30 cursor-not-allowed'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }
                    `}
                    aria-label={`Ajouter la catégorie ${tag}`}
                    aria-pressed={isSelected}
                  >
                    <span>{icon}</span>
                    <span className="capitalize">{tag}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>

            {/* Indicateur de sélection */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-white/40">
                {tagMessage}
              </span>
              <div className="flex items-center gap-1">
                {[...Array(MAX_TAGS)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i < selectedTags.length
                        ? 'bg-[#005CFF]'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="space-y-3">
            <button
              onClick={handleContinue}
              disabled={saving}
              className={`
                w-full py-4 rounded-2xl font-semibold text-lg
                flex items-center justify-center gap-2
                transition-all duration-200
                ${selectedTags.length > 0 && !saving
                  ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white shadow-xl shadow-[#005CFF]/30 hover:shadow-2xl hover:shadow-[#005CFF]/40'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
                }
              `}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  {selectedTags.length > 0 ? 'Continuer' : 'Sélectionnez des catégories'}
                  {selectedTags.length > 0 && <ChevronRight className="w-5 h-5" />}
                </>
              )}
            </button>

            <button
              onClick={skipOnboarding}
              disabled={saving}
              className="w-full py-3 text-white/50 text-sm hover:text-white/70 transition-colors disabled:opacity-50"
            >
              Passer cette étape
            </button>
          </div>

          <p className="text-center text-white/30 text-xs mt-6">
            Vous pourrez modifier vos préférences plus tard dans les paramètres
          </p>
        </div>
      </div>
    </div>
  );
};

SmartClipsOnboarding.propTypes = {};

export default SmartClipsOnboarding;
