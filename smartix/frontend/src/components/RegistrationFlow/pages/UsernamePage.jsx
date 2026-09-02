import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { AlertCircle } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import '../styles/UsernamePage.css';

// =============================
// VALIDATION FORMAT UNIQUEMENT — l'unicité sera vérifiée à l'inscription finale
// =============================
const validateUsername = (username) => {
  if (username === null || username === undefined) return { valid: false, error: '' };
  const str = typeof username === 'string' ? username : String(username);
  if (!str) return { valid: false, error: '' };

  const trimmed = str.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: 'Au moins 3 caractères' };
  }
  if (trimmed.length > 20) {
    return { valid: false, error: 'Maximum 20 caractères' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Seulement lettres, chiffres et _' };
  }

  return { valid: true, error: '' };
};

const UsernamePage = ({ flow, onLoading }) => {
  const [localUsername, setLocalUsername] = useState(typeof flow.formData.username === 'string' ? flow.formData.username : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validation, setValidation] = useState({ valid: false, error: '' });

  useEffect(() => {
    setValidation(validateUsername(localUsername));
  }, [localUsername]);

  const handleContinue = useCallback(async () => {
    const validationResult = validateUsername(localUsername);
    if (!validationResult.valid || isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      flow.updateFormData('username', localUsername.trim());
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving username:', err);
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [localUsername, isSubmitting, flow, onLoading]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && validation.valid && !isSubmitting) {
      handleContinue();
    }
  }, [validation.valid, isSubmitting, handleContinue]);

  const handleInputChange = useCallback((e) => {
    setLocalUsername(e.target.value);
  }, []);

  const isValid = validation.valid;

  return (
    <div className="username-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 pt-2 pb-8 sm:pt-4 sm:pb-12">

        <div className="username-content text-center mb-8 sm:mb-12">
          <h2 className="username-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Choisis ton identité
          </h2>
          <p className="username-description text-sm sm:text-base text-white/60">
            Ce sera ton pseudo sur Smartix. Tu pourras le changer plus tard.
          </p>
        </div>

        <div className="username-form">
          <div className="form-group">
            <Label htmlFor="username" className="username-label block text-sm font-medium text-white/80 mb-2">
              Nom d'utilisateur
            </Label>

            <div className="username-input-wrapper relative">
              <Input
                id="username"
                type="text"
                placeholder="jean_dupont"
                value={localUsername}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                disabled={isSubmitting}
                maxLength={20}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all ${
                  !validation.valid && localUsername ? 'border-red-500 focus:ring-red-500' : ''
                }`}
                autoFocus
              />
            </div>

            <div className="mt-1 min-h-[20px]">
              {localUsername && !validation.valid && (
                <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  <span>{validation.error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="username-info mt-8 text-center">
          <p className="username-info-text text-xs text-white/40">
            Ton pseudo peut être modifié plus tard dans les paramètres
          </p>
        </div>
      </div>

      <ActionContainer
        onBack={flow.goToPreviousStep}
        onNext={handleContinue}
        isValid={isValid}
        isLoading={isSubmitting}
        nextLabel="Suivant"
      />
    </div>
  );
};

UsernamePage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default UsernamePage;
