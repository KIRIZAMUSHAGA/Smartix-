import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, BookOpen, Code2, Users, ShoppingBag,
  CheckCircle, ArrowRight, Rocket, Sparkles
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import PropTypes from 'prop-types';
import { updateOnboardingProgress } from '../../services/authService';

const OnboardingCard = ({ onComplete, user }) => {
  const navigate = useNavigate();
  const storedProgress = user?.onboardingProgress || {};
  const initialCompletedSteps = (storedProgress.completedSteps || []).reduce(
    (completed, stepId) => ({ ...completed, [stepId]: true }),
    {}
  );
  const [currentStep, setCurrentStep] = useState(
    Math.min(Math.max(Number(storedProgress.currentStep) || 1, 1), 5)
  );
  const [completedSteps, setCompletedSteps] = useState(initialCompletedSteps);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Étapes de l'onboarding
  const steps = [
    {
      id: 1,
      title: 'Bienvenue sur Smartix !',
      description: 'Découvrez une plateforme tout-en-un pour apprendre, créer et vendre.',
      icon: Rocket,
      color: 'from-purple-500 to-pink-500',
      action: 'Commencer',
      path: null
    },
    {
      id: 2,
      title: '📚 Suivez votre premier cours',
      description: 'Apprenez les bases du développement avec nos cours interactifs.',
      icon: BookOpen,
      color: 'from-orange-500 to-red-500',
      action: 'Explorer les cours',
      path: '/courses',
      tips: 'Plus de 500 cours disponibles'
    },
    {
      id: 3,
      title: '⚡ Créez votre premier projet',
      description: 'Mettez en pratique vos connaissances avec notre éditeur intégré.',
      icon: Code2,
      color: 'from-blue-500 to-cyan-500',
      action: 'Créer un projet',
      path: '/vibe/projects/create',
      tips: 'Templates disponibles'
    },
    {
      id: 4,
      title: '👥 Rejoignez la communauté',
      description: 'Partagez vos créations et échangez avec d\'autres apprenants.',
      icon: Users,
      color: 'from-green-500 to-emerald-500',
      action: 'Voir le feed',
      path: '/feed',
      tips: '45k membres actifs'
    },
    {
      id: 5,
      title: '💰 Devenez créateur',
      description: 'Monétisez vos compétences en vendant vos créations.',
      icon: ShoppingBag,
      color: 'from-yellow-500 to-orange-500',
      action: 'Découvrir la marketplace',
      path: '/smartix-store',
      tips: 'Déjà 1 200 créateurs'
    }
  ];

  const totalSteps = steps.length;
  const progress = (Object.keys(completedSteps).length / totalSteps) * 100;

  const persistProgress = useCallback(async ({
    nextStep,
    nextCompletedSteps,
    hasSeenOnboarding,
    status,
  }) => {
    if (!user?.id) {
      throw new Error('Utilisateur non identifié');
    }

    const updatedUser = await updateOnboardingProgress({
      currentStep: nextStep,
      completedSteps: Object.keys(nextCompletedSteps)
        .map(Number)
        .sort((a, b) => a - b),
      hasSeenOnboarding,
      status,
    });

    const persistedProgress = updatedUser.onboardingProgress;
    if (persistedProgress) {
      setCurrentStep(
        Math.min(Math.max(Number(persistedProgress.currentStep) || nextStep, 1), totalSteps)
      );
      setCompletedSteps(
        (persistedProgress.completedSteps || []).reduce(
          (completed, stepId) => ({ ...completed, [stepId]: true }),
          {}
        )
      );
    }

    return updatedUser;
  }, [totalSteps, user?.id]);

  const handleStepComplete = async (stepId, destination = null) => {
    if (isSaving) return;

    const nextCompletedSteps = {
      ...completedSteps,
      [stepId]: true,
    };
    const isLastStep = stepId === totalSteps;

    setIsSaving(true);
    setError(null);

    try {
      const updatedUser = await persistProgress({
        nextStep: isLastStep ? stepId : stepId + 1,
        nextCompletedSteps,
        hasSeenOnboarding: isLastStep,
        status: isLastStep ? 'completed' : 'in_progress',
      });

      if (isLastStep) {
        onComplete?.(updatedUser);
      } else if (destination) {
        navigate(destination);
      }
    } catch (saveError) {
      console.error('Erreur de sauvegarde de l’onboarding:', saveError);
      setError('Impossible d’enregistrer votre progression. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismiss = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const updatedUser = await persistProgress({
        nextStep: currentStep,
        nextCompletedSteps: completedSteps,
        hasSeenOnboarding: true,
        status: 'dismissed',
      });
      onComplete?.(updatedUser);
    } catch (saveError) {
      console.error('Erreur de fermeture de l’onboarding:', saveError);
      setError('Impossible de fermer définitivement ce parcours. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentStepData = steps[currentStep - 1];
  const CurrentIcon = currentStepData.icon;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 animate-slide-up">
      <Card className="relative overflow-hidden border-2 border-[#ff6b35]/20 shadow-2xl">
        {/* Barre de progression */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-card/40">
          <div 
            className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={handleDismiss}
          disabled={isSaving}
          aria-label="Fermer l’onboarding"
          className="absolute top-3 right-3 p-1 hover:bg-card/80 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="p-6">
          {/* Indicateur de progression */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                Étape {currentStep}/{totalSteps}
              </p>
            </div>
            <div className="flex gap-1">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full transition-all ${
                    completedSteps[step.id] 
                      ? 'bg-green-500' 
                      : step.id === currentStep
                      ? 'bg-[#ff6b35] scale-125'
                      : 'bg-card/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Contenu de l'étape */}
          <div className="text-center mb-6">
            {/* Icône animée */}
            <div className="relative mb-4">
              <div className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${currentStepData.color} flex items-center justify-center animate-bounce-slow shadow-xl`}>
                <CurrentIcon className="w-10 h-10 text-white" />
              </div>
              
              {/* Confettis si étape complétée */}
              {completedSteps[currentStep] && (
                <div className="absolute -top-2 -right-2">
                  <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                </div>
              )}
            </div>

            <h3 className="text-xl font-black text-foreground mb-2">
              {currentStepData.title}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-3">
              {currentStepData.description}
            </p>

            {currentStepData.tips && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-card/40 rounded-full text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>{currentStepData.tips}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              type="button"
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff8c61] hover:to-[#ff6b35] text-white font-bold py-6 transition-all hover:scale-105 disabled:cursor-wait disabled:opacity-70"
              onClick={() => handleStepComplete(currentStep, currentStepData.path)}
            >
              {isSaving ? 'Enregistrement...' : currentStepData.action}
              {!isSaving && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>

            {/* Boutons additionnels selon l'étape */}
            {currentStep === 1 && (
              <Button 
                type="button"
                variant="outline" 
                disabled={isSaving}
                className="w-full border-[#ff6b35]/30 text-[#ff6b35] hover:bg-[#ff6b35]/10"
                onClick={handleDismiss}
              >
                Revenir plus tard
              </Button>
            )}

            {currentStep === totalSteps && (
              <Button 
                type="button"
                variant="outline" 
                disabled={isSaving}
                className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={() => handleStepComplete(currentStep)}
              >
                Terminer l'onboarding
                <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Indicateur de progression restante */}
          {currentStep < totalSteps && (
            <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Rocket className="w-3 h-3" />
              <span>
                {totalSteps - currentStep} étape{totalSteps - currentStep > 1 ? 's' : ''} restante{totalSteps - currentStep > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {error && (
            <p className="mt-4 text-center text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Éléments décoratifs */}
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-[#ff6b35]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      </Card>
    </div>
  );
};

// PropTypes
OnboardingCard.propTypes = {
  onComplete: PropTypes.func,
  user: PropTypes.object
};

export default OnboardingCard;
