import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Label } from '../../ui/label';
import { Loader2, Cake, AlertCircle } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import '../styles/BirthdatePage.css';
import { MIN_AGE, MAX_AGE } from '../../../config/appConfig';

// =============================
// 1️⃣ VALIDATION DE LA DATE (CORRECTION TIMEZONE)
// =============================
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-');
  return new Date(year, month - 1, day);
};

const validateBirthdate = (birthdate) => {
  if (!birthdate) return { valid: false, error: '', age: null, date: null };
  
  // ✅ Parser en local (pas de timezone)
  const birth = parseLocalDate(birthdate);
  
  // Vérifier si la date est valide
  if (isNaN(birth.getTime())) {
    return { valid: false, error: 'Date invalide', age: null, date: null };
  }
  
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  // Vérifier que la date n'est pas dans le futur
  if (birth > todayLocal) {
    return { valid: false, error: 'La date ne peut pas être dans le futur', age: null, date: null };
  }
  
  // Calcul de l'âge (précis, sans timezone)
  let age = todayLocal.getFullYear() - birth.getFullYear();
  const monthDiff = todayLocal.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && todayLocal.getDate() < birth.getDate())) {
    age--;
  }
  
  // Vérifier les limites d'âge
  if (age < MIN_AGE) {
    return { valid: false, error: `Tu dois avoir au moins ${MIN_AGE} ans`, age, date: birth };
  }
  if (age > MAX_AGE) {
    return { valid: false, error: `Âge maximum ${MAX_AGE} ans`, age, date: birth };
  }
  
  return { valid: true, error: '', age, date: birth };
};

// =============================
// 2️⃣ FORMATAGE PROPRE DE LA DATE
// =============================
const formatDateForDisplay = (date) => {
  if (!date) return '';
  const day = date.getDate();
  const month = date.toLocaleString('fr-FR', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const BirthdatePage = ({ flow, onLoading }) => {
  const [localBirthdate, setLocalBirthdate] = useState(flow.formData.date_of_birth || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ✅ Validation mémoïsée
  const validation = useMemo(
    () => validateBirthdate(localBirthdate),
    [localBirthdate]
  );
  
  const isValid = validation.valid;
  const age = validation.age;
  const error = validation.error;
  const birthDate = validation.date;

  const handleContinue = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      flow.updateFormData('date_of_birth', localBirthdate);
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving birthdate:', err);
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [isValid, isSubmitting, localBirthdate, flow, onLoading]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && isValid && !isSubmitting) {
      handleContinue();
    }
  }, [isValid, isSubmitting, handleContinue]);

  // ✅ Valeurs dynamiques pour l'input
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MIN_AGE);
    return date.toISOString().split('T')[0];
  }, []);

  const minDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MAX_AGE);
    return date.toISOString().split('T')[0];
  }, []);

  // ✅ Message simplifié et utile
  const getSuccessMessage = () => {
    if (!birthDate) return null;
    const formattedDate = formatDateForDisplay(birthDate);
    return (
      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
        <Cake className="w-4 h-4 text-green-500" />
        <div>
          <p className="text-xs text-green-500">
            Né(e) le {formattedDate} • {age} ans
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="birthdate-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      {/* Container responsive */}
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Header */}
        <div className="birthdate-header text-center mb-8 sm:mb-12">
          <div className="birthdate-icon-wrapper inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-4">
            <Cake className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff6b35]" />
          </div>
          <h2 className="birthdate-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Quand es-tu né ?
          </h2>
          <p className="birthdate-subtitle text-sm sm:text-base text-white/60">
            Pour vérifier ton âge et personnaliser ton expérience
          </p>
        </div>

        {/* Form */}
        <div className="birthdate-form space-y-6">
          <div className="form-group">
            <Label htmlFor="birthdate" className="birthdate-label block text-sm font-medium text-white/80 mb-2">
              Date de naissance
            </Label>
            <input
              id="birthdate"
              type="date"
              value={localBirthdate}
              onChange={(e) => setLocalBirthdate(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              min={minDate}
              max={maxDate}
              aria-invalid={!!error && localBirthdate.length > 0}
              aria-describedby={error ? "birthdate-error" : undefined}
              className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                error && localBirthdate ? 'border-red-500 focus:ring-red-500' : 'border-white/10'
              } text-white focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all`}
              autoFocus
            />
            
            {/* Messages dynamiques avec aria-live */}
            <div aria-live="polite" className="mt-1 min-h-[40px]">
              {error && (
                <div id="birthdate-error" className="flex items-center gap-1 text-red-500 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  <span>{error}</span>
                </div>
              )}
              {isValid && getSuccessMessage()}
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="birthdate-info mt-8 text-center">
          <p className="birthdate-info-text text-xs text-white/40">
            Cette information reste privée et nous aide à personnaliser ton expérience
          </p>
        </div>
      </div>

      {/* Action Container */}
      <ActionContainer
        onBack={flow.goToPreviousStep}
        onNext={handleContinue}
        isValid={isValid}
        isLoading={isSubmitting}
        nextLabel="Continuer"
        showBack={true}
      />
    </div>
  );
};

BirthdatePage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default BirthdatePage;
