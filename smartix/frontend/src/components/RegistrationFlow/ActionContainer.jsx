import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

/**
 * Composant de navigation pour les étapes d'inscription
 * Responsive, accessible, sécurisé et optimisé
 */
const ActionContainer = ({ 
  onBack, 
  onNext, 
  isLoading = false,
  isValid = false,
  nextLabel = 'Continuer',
  showBack = true,
  allowNextWhenInvalid = false
}) => {
  const buttonEnabled = (isValid || allowNextWhenInvalid) && !isLoading;
  // ✅ Guard interne pour éviter les appels accidentels
  const handleNext = useCallback(() => {
    if (!buttonEnabled) return;
    
    // ✅ Micro-feedback haptique (optionnel)
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    onNext();
  }, [isValid, isLoading, onNext]);

  const handleBack = useCallback(() => {
    if (isLoading) return;
    
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }
    
    onBack();
  }, [isLoading, onBack]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {/* ✅ Gradient overlay pour transition douce */}
      <div className="absolute bottom-full left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      
      <div className="bg-background/95 backdrop-blur-xl border-t border-border px-4 py-4 sm:py-5">
        <div className="max-w-md mx-auto flex items-center gap-3 sm:gap-4">
          
          {/* ✅ Bouton Retour - flex layout (espacement garanti par gap) */}
          {showBack && (
            <Button
              onClick={handleBack}
              disabled={isLoading}
              variant="ghost"
              className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-accent/5 hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Étape précédente"
              aria-disabled={isLoading}
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          )}
          
          {/* ✅ Bouton Suivant - prend l'espace restant */}
          <Button
            onClick={handleNext}
            disabled={!buttonEnabled}
            className={`flex-1 min-w-0 h-12 sm:h-14 bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff5a24] hover:to-[#ff7a4a] text-white rounded-full font-bold text-base sm:text-lg transition-all duration-200 ease-out transform ${
              buttonEnabled
                ? 'opacity-100 translate-y-0' 
                : 'opacity-50 translate-y-0'
            }`}
            aria-label={isLoading ? 'Chargement en cours' : nextLabel}
            aria-disabled={!buttonEnabled}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto" />
            ) : (
              <span className="truncate">{nextLabel}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

ActionContainer.propTypes = {
  onBack: PropTypes.func,
  onNext: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  isValid: PropTypes.bool,
  nextLabel: PropTypes.string,
  showBack: PropTypes.bool,
  allowNextWhenInvalid: PropTypes.bool,
};

export default ActionContainer;
