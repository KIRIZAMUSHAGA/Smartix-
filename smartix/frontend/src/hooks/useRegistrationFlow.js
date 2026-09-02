import { useState, useCallback } from 'react';

const REGISTRATION_STEPS = [
  'method',
  'welcome',
  'username',
  'email',
  'password',
  'school',
  'birthdate',
  'avatar',
  'cover',
  'confirm'
];

const INITIAL_FORM_DATA = {
  full_name: '',
  username: '',
  email: '',
  password: '',
  confirm_password: '',
  school: '',
  level: '',
  date_of_birth: '',
  avatar_url: '',
  cover_url: '',
  avatar_file: null,
  cover_file: null,
  accept_terms: false,
  accept_privacy: false,
};

export const useRegistrationFlow = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const updateFormData = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateMultipleFields = useCallback((updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const goToNextStep = useCallback(() => {
    setCurrentStep((prev) =>
      prev < REGISTRATION_STEPS.length - 1 ? prev + 1 : prev
    );
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const goToStep = useCallback((stepIndex) => {
    if (stepIndex >= 0 && stepIndex < REGISTRATION_STEPS.length) {
      setCurrentStep(stepIndex);
    }
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const getCurrentStepName = useCallback(() => {
    return REGISTRATION_STEPS[currentStep];
  }, [currentStep]);

  const completeRegistration = useCallback(() => {
    setCurrentStep(0);
    setFormData(INITIAL_FORM_DATA);

    window.dispatchEvent(new CustomEvent('registrationComplete', {
      detail: { success: true }
    }));
  }, []);

  return {
    currentStep,
    currentStepName: REGISTRATION_STEPS[currentStep],
    totalSteps: REGISTRATION_STEPS.length,
    stepsNames: REGISTRATION_STEPS,
    progress: ((currentStep + 1) / REGISTRATION_STEPS.length) * 100,

    formData,
    updateFormData,
    updateMultipleFields,
    // Compat : plus de brouillon, donc toujours false
    draftRestored: false,

    goToNextStep,
    goToPreviousStep,
    goToStep,
    goToNext: goToNextStep,
    goToPrevious: goToPreviousStep,
    canGoBack: currentStep > 0,
    canGoNext: currentStep < REGISTRATION_STEPS.length - 1,
    isLastStep: currentStep === REGISTRATION_STEPS.length - 1,
    isFirstStep: currentStep === 0,

    // Compat : alias conservés mais ne touchent plus à localStorage
    clearDraft: reset,
    reset,
    getCurrentStepName,
    completeRegistration,
  };
};
