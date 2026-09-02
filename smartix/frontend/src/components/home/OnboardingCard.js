import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  X, BookOpen, Code2, Users, ShoppingBag, Newspaper,
  CheckCircle, ArrowRight, Rocket, Sparkles,
  ChevronRight, Play, Download, Award
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import PropTypes from 'prop-types';

const OnboardingCard = ({ onComplete, user }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState({});

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

  const handleStepComplete = (stepId) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepId]: true
    }));

    if (stepId < totalSteps) {
      setCurrentStep(stepId + 1);
    }
  };

  const handleSkip = () => {
    if (onComplete) {
      onComplete();
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
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
          onClick={handleSkip}
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
            {currentStepData.path ? (
              <Link to={currentStepData.path} onClick={() => handleStepComplete(currentStep)}>
                <Button className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff8c61] hover:to-[#ff6b35] text-white font-bold py-6 transition-all hover:scale-105">
                  {currentStepData.action}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Button 
                className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff8c61] hover:to-[#ff6b35] text-white font-bold py-6"
                onClick={() => handleStepComplete(currentStep)}
              >
                {currentStepData.action}
              </Button>
            )}

            {/* Boutons additionnels selon l'étape */}
            {currentStep === 1 && (
              <Button 
                variant="outline" 
                className="w-full border-[#ff6b35]/30 text-[#ff6b35] hover:bg-[#ff6b35]/10"
                onClick={() => handleStepComplete(1)}
              >
                Découvrir plus tard
              </Button>
            )}

            {currentStep === totalSteps && (
              <Button 
                variant="outline" 
                className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={handleComplete}
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
