import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Mail } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import { useEmailCheck } from '../hooks/useEmailCheck';
import '../styles/EmailPage.css';

const EmailPage = ({ flow, onLoading }) => {
  const [localEmail, setLocalEmail] = useState(flow.formData.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { status, message, isAvailable, isChecking, STATUS } = useEmailCheck(localEmail);

  const handleInputChange = useCallback((e) => {
    setLocalEmail(e.target.value);
  }, []);

  const handleContinue = useCallback(async () => {
    if (!isAvailable || isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);
    try {
      flow.updateFormData('email', localEmail.trim().toLowerCase());
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving email:', err);
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [localEmail, isAvailable, isSubmitting, flow, onLoading]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && isAvailable && !isSubmitting) {
      handleContinue();
    }
  }, [isAvailable, isSubmitting, handleContinue]);

  const renderStatusIcon = () => {
    switch (status) {
      case STATUS.CHECKING:
        return <Loader2 className="w-4 h-4 animate-spin text-white/60" />;
      case STATUS.AVAILABLE:
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case STATUS.TAKEN:
        return <XCircle className="w-4 h-4 text-red-500" />;
      case STATUS.INVALID:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const messageColorClass = (() => {
    switch (status) {
      case STATUS.AVAILABLE: return 'text-green-500';
      case STATUS.TAKEN:
      case STATUS.INVALID: return 'text-red-500';
      case STATUS.CHECKING: return 'text-white/60';
      default: return 'text-white/40';
    }
  })();

  return (
    <div className="email-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">

        <div className="email-header text-center mb-8 sm:mb-12">
          <div className="email-icon-wrapper inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-4">
            <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff6b35]" />
          </div>
          <h2 className="email-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Ton adresse email
          </h2>
          <p className="email-subtitle text-sm sm:text-base text-white/60">
            Pour communiquer et sécuriser ton compte
          </p>
        </div>

        <div className="email-form">
          <div className="form-group">
            <Label htmlFor="email" className="email-label block text-sm font-medium text-white/80 mb-2">
              Adresse email
            </Label>

            <div className="email-input-wrapper relative">
              <Input
                id="email"
                type="email"
                placeholder="jean@example.com"
                value={localEmail}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                maxLength={100}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all ${
                  status === STATUS.INVALID || status === STATUS.TAKEN
                    ? 'border-red-500 focus:ring-red-500'
                    : ''
                }`}
                autoFocus
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {renderStatusIcon()}
              </div>
            </div>

            <div className="mt-1 min-h-[20px]">
              {message && (
                <p className={`text-xs ${messageColorClass}`}>{message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="email-info mt-8 text-center">
          <p className="email-info-text text-xs text-white/40">
            Nous t'enverrons un lien de vérification pour confirmer ton email
          </p>
        </div>
      </div>

      <ActionContainer
        onBack={flow.goToPreviousStep}
        onNext={handleContinue}
        isValid={isAvailable && !isChecking}
        isLoading={isSubmitting}
        nextLabel="Continuer"
      />
    </div>
  );
};

EmailPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default EmailPage;
