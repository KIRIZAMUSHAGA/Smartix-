import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Loader2, AlertCircle, X } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import '../styles/WelcomePage.css';

// Validation du nom complet
const isValidFullName = (name) => {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  if (trimmed.length > 50) return false;
  // Lettres, accents, espaces, apostrophes, tirets
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]{2,50}$/;
  return nameRegex.test(trimmed);
};

const WelcomePage = ({ flow, onLoading, onClose }) => {
  const [localName, setLocalName] = useState(flow.formData.full_name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // [SIGNUP_FLOW] Trace : 1ʳᵉ étape réellement affichée à l'ouverture du modal Inscription
  useEffect(() => {
    console.log('[SIGNUP_FLOW] WelcomePage MOUNTED — premier écran affiché : champ "Nom Complet" (full_name). Aucun écran de choix Google/Email/Phone n\'est rendu en amont.');
    return () => console.log('[SIGNUP_FLOW] WelcomePage UNMOUNTED');
  }, []);

  // Synchronisation avec le flow
  useEffect(() => {
    setLocalName(flow.formData.full_name || '');
  }, [flow.formData.full_name]);

  // Validation en temps réel
  useEffect(() => {
    if (!localName) {
      setError('');
      return;
    }
    const trimmed = localName.trim();
    if (trimmed.length < 2) {
      setError('Au moins 2 caractères');
    } else if (trimmed.length > 50) {
      setError('Maximum 50 caractères');
    } else if (!/^[a-zA-ZÀ-ÿ\s'-]{2,50}$/.test(trimmed)) {
      setError('Caractères invalides (lettres, accents, apostrophes, tirets)');
    } else {
      setError('');
    }
  }, [localName]);

  const isValid = isValidFullName(localName);

  const handleContinue = useCallback(async () => {
    if (!isValid) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      // Mettre à jour le state
      flow.updateFormData('full_name', localName.trim());
      
      // Petit délai pour la mise à jour
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Aller à la prochaine étape
      flow.goToNextStep();
    } catch (err) {
      console.error('Error in WelcomePage:', err);
      setError('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [isValid, isSubmitting, localName, flow, onLoading]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && isValid && !isSubmitting) {
      handleContinue();
    }
  }, [isValid, isSubmitting, handleContinue]);

  return (
    <div className="welcome-page">
      {/* Bouton fermeture (croix) — assure la présence de la fermeture sur la 1re page */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'inscription"
          className="welcome-close-btn"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Header Icon */}
      <div className="welcome-header">
        <div className="welcome-icon-container">
          <img src="/smartix-s-logo.png" alt="Smartix" className="welcome-logo-s" />
        </div>
      </div>

      {/* Content */}
      <div className="welcome-content">
        <h1 className="welcome-title">Bienvenue sur Smartix</h1>
        <p className="welcome-description">
          Commençons par faire connaissance.
        </p>
      </div>

      {/* Form */}
      <div className="welcome-form">
        <div className="form-group">
          <Label htmlFor="full_name" className="welcome-label">
            Nom Complet
          </Label>
          <Input
            id="full_name"
            type="text"
            placeholder="Jean Dupont"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting}
            className={`welcome-input ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
            autoFocus
            maxLength={50}
          />
          {error && (
            <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Container */}
      <ActionContainer
        onBack={() => {}}
        onNext={handleContinue}
        isValid={isValid}
        isLoading={isSubmitting}
        nextLabel="Suivant"
        showBack={false}
      />

      {/* Footer Text */}
      <div className="welcome-footer">
        <p className="welcome-footer-text">
          🎓 Rejoins une communauté de learners passionnés
        </p>
      </div>
    </div>
  );
};

WelcomePage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
  onClose: PropTypes.func,
};

export default WelcomePage;
