import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useRegistrationFlow } from '../../hooks/useRegistrationFlow';
import { Dialog, DialogContent } from '../ui/dialog';
import { ChevronLeft, Loader2, X, Check } from 'lucide-react';

// Import des pages
import SignupMethodPage from './pages/SignupMethodPage';
import WelcomePage from './pages/WelcomePage';
import UsernamePage from './pages/UsernamePage';
import EmailPage from './pages/EmailPage';
import PasswordPage from './pages/PasswordPage';
import SchoolPage from './pages/SchoolPage';
import BirthdatePage from './pages/BirthdatePage';
import AvatarPage from './pages/AvatarPage';
import CoverPhotoPage from './pages/CoverPhotoPage';
import FinalPage from './pages/FinalPage';

import './RegistrationFlow.css';

const RegistrationFlow = ({ open, onOpenChange, onPhoneClick }) => {
  const flow = useRegistrationFlow();
  const [stepLoading, setStepLoading] = useState(false);

  // [SIGNUP_FLOW] Trace ouverture / changement d'étape du modal d'inscription
  useEffect(() => {
    console.log('[SIGNUP_FLOW] RegistrationFlow open=', open, '| currentStep=', flow.currentStep, '| stepName=', flow.currentStepName);
  }, [open, flow.currentStep, flow.currentStepName]);

  // Fermeture directe — plus de brouillon, plus de confirmation.
  const requestClose = useCallback(() => {
    flow.reset();
    onOpenChange(false);
  }, [flow, onOpenChange]);

  const handleOpenChange = useCallback((newOpen) => {
    if (!newOpen) {
      requestClose();
    } else {
      onOpenChange(true);
    }
  }, [requestClose, onOpenChange]);

  // ✅ Écouter l'événement de completion
  useEffect(() => {
    const handleRegistrationComplete = (event) => {
      if (event.detail?.success) {
        setTimeout(() => {
          onOpenChange(false);
        }, 500);
      }
    };

    window.addEventListener('registrationComplete', handleRegistrationComplete);
    return () => {
      window.removeEventListener('registrationComplete', handleRegistrationComplete);
    };
  }, [onOpenChange]);

  const handlePrevious = useCallback(() => {
    if (stepLoading) return;
    flow.goToPrevious();
  }, [flow, stepLoading]);

  // Rendu de l'étape
  const renderStep = () => {
    switch (flow.currentStepName) {
      case 'method':
        return <SignupMethodPage flow={flow} onPhoneClick={onPhoneClick} />;
      case 'welcome':
        return <WelcomePage flow={flow} onLoading={setStepLoading} onClose={() => handleOpenChange(false)} />;
      case 'username':
        return <UsernamePage flow={flow} onLoading={setStepLoading} />;
      case 'email':
        return <EmailPage flow={flow} onLoading={setStepLoading} />;
      case 'password':
        return <PasswordPage flow={flow} onLoading={setStepLoading} />;
      case 'school':
        return <SchoolPage flow={flow} onLoading={setStepLoading} />;
      case 'birthdate':
        return <BirthdatePage flow={flow} onLoading={setStepLoading} />;
      case 'avatar':
        return <AvatarPage flow={flow} onLoading={setStepLoading} />;
      case 'cover':
        return <CoverPhotoPage flow={flow} onLoading={setStepLoading} />;
      case 'confirm':
        return <FinalPage flow={flow} onLoading={setStepLoading} />;
      default:
        return <div className="text-center py-12 text-white/60">Étape non trouvée</div>;
    }
  };

  const totalSteps = flow.totalSteps;
  const currentStepNumber = flow.currentStep + 1;
  const isMethodStep = flow.currentStepName === 'method';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="registration-dialog w-full h-screen max-w-none max-h-screen overflow-hidden border-0 rounded-0 flex flex-col p-0">
        <div className="sr-only">
          <h2>Création de compte Smartix - Étape {currentStepNumber} sur {totalSteps}</h2>
        </div>

        <div className="registration-header sticky top-0 z-10 bg-gradient-to-b from-[#0f172a] to-transparent pb-2">
          <div className="flex items-center justify-between px-4 py-3">
            {!isMethodStep && flow.currentStep > 0 && (
              <button
                onClick={handlePrevious}
                disabled={stepLoading}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Étape précédente"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}

            <div className="flex-1 text-center">
              {!isMethodStep && (
                <span className="text-xs text-white/40 font-mono">
                  Étape {currentStepNumber}/{totalSteps}
                </span>
              )}
            </div>

            <button
              onClick={requestClose}
              disabled={stepLoading}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {!isMethodStep && (
            <>
              <div className="registration-progress-bar mx-4">
                <div
                  className="registration-progress-fill transition-all duration-500 ease-out"
                  style={{ width: `${flow.progress}%` }}
                />
              </div>

              <div className="registration-steps-dots mx-4 mt-2 flex items-center justify-between">
                {Array.from({ length: totalSteps }).map((_, idx) => {
                  const isCompleted = idx < flow.currentStep;
                  const isCurrent = idx === flow.currentStep;
                  const isClickable = isCompleted && !stepLoading;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => isClickable && flow.goToStep(idx)}
                      disabled={!isClickable}
                      aria-label={`Étape ${idx + 1}${isCompleted ? ' (complétée)' : isCurrent ? ' (en cours)' : ''}`}
                      className={`step-dot ${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-clickable' : ''} ${isClickable ? 'is-clickable' : ''}`}
                    >
                      {isCompleted ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <span>{idx + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="registration-content flex-1 overflow-y-auto px-6 pt-4 pb-16">
          {stepLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#00B894]" />
            </div>
          ) : (
            renderStep()
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

RegistrationFlow.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  onPhoneClick: PropTypes.func,
};

export default RegistrationFlow;
