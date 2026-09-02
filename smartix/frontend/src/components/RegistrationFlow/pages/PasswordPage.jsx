import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Loader2, Eye, EyeOff, Check, X, Shield, AlertTriangle } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import '../styles/PasswordPage.css';

// =============================
// 1️⃣ CALCUL DE FORCE DU MOT DE PASSE (SOURCE UNIQUE DE VÉRITÉ)
// =============================
const calculatePasswordStrength = (password) => {
  if (!password) {
    return {
      percentage: 0,
      label: '',
      level: 'weak',
      color: 'bg-red-500',
      score: 0,
      checks: {
        length: false,
        longLength: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false
      },
      feedback: '',
      missing: []
    };
  }

  // Vérifications individuelles (SOURCE UNIQUE)
  const checks = {
    length: password.length >= 8,
    longLength: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    // ✅ Protection contre les patterns courants
    noCommonPattern: !/password|1234|qwerty|azerty|admin|welcome|letmein/i.test(password)
  };

  // Calcul du score (1 point par condition)
  let score = 0;
  if (checks.length) score += 1;
  if (checks.longLength) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;
  if (checks.noCommonPattern) score += 1;

  const percentage = (score / 7) * 100;

  // ✅ Feedback dynamique basé sur les règles manquantes
  const missing = [];
  if (!checks.uppercase) missing.push('une majuscule');
  if (!checks.lowercase) missing.push('une minuscule');
  if (!checks.number) missing.push('un chiffre');
  if (!checks.special) missing.push('un caractère spécial');
  if (!checks.longLength) missing.push('au moins 12 caractères');
  if (!checks.noCommonPattern) missing.push('un mot de passe moins prévisible');

  // ✅ Détermination du niveau
  let label = 'Faible';
  let level = 'weak';
  let color = 'bg-red-500';
  let feedback = '';

  // ✅ Critère renforcé : score >= 6 ET longueur >= 12
  const isStrong = score >= 6 && password.length >= 12;

  if (isStrong) {
    label = 'Fort';
    level = 'strong';
    color = 'bg-green-500';
    feedback = '🔒 Excellent mot de passe';
  } else if (score >= 5) {
    label = 'Bon';
    level = 'medium';
    color = 'bg-blue-500';
    feedback = missing.length > 0 
      ? `Ajoutez ${missing.join(', ')} pour le renforcer`
      : 'Bon niveau, peut être amélioré';
  } else if (score >= 3) {
    label = 'Moyen';
    level = 'medium';
    color = 'bg-yellow-500';
    feedback = `Ajoutez ${missing.join(', ')}`;
  } else {
    feedback = `Ajoutez ${missing.join(', ')}`;
  }

  return { percentage, label, level, color, score, checks, feedback, missing };
};

const PasswordPage = ({ flow, onLoading }) => {
  const [localPassword, setLocalPassword] = useState(flow.formData.password || '');
  const [localConfirmPassword, setLocalConfirmPassword] = useState(flow.formData.confirm_password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hideTimeout, setHideTimeout] = useState(null);

  // ✅ SOURCE UNIQUE de vérité
  const passwordStrength = useMemo(
    () => calculatePasswordStrength(localPassword),
    [localPassword]
  );

  const { checks, score, isStrong } = passwordStrength;

  // ✅ Validation basée sur la source unique
  const passwordsMatch = localPassword && localConfirmPassword && localPassword === localConfirmPassword;
  
  // ✅ Règles de base (sécurité minimale)
  const basicRulesValid = 
    checks.length &&
    checks.uppercase &&
    checks.lowercase &&
    checks.number &&
    passwordsMatch;

  // ✅ Force recommandée (non bloquante)
  const isStrongEnough = score >= 5 && localPassword.length >= 10;

  // ✅ UX tolérante : autoriser la continuation mais avertir
  const isValid = basicRulesValid;
  const isRecommended = isStrongEnough;

  // ✅ Auto-hide après 3 secondes (sécurité UX)
  useEffect(() => {
    if (showPassword && !hideTimeout) {
      const timer = setTimeout(() => {
        setShowPassword(false);
        setHideTimeout(null);
      }, 3000);
      setHideTimeout(timer);
    }
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [showPassword]);

  const handleContinue = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      flow.updateMultipleFields({
        password: localPassword,
        confirm_password: localConfirmPassword
      });
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving password:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, isSubmitting, localPassword, localConfirmPassword, flow]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && isValid && !isSubmitting) {
      handleContinue();
    }
  }, [isValid, isSubmitting, handleContinue]);

  const handlePasswordChange = useCallback((e) => {
    setLocalPassword(e.target.value);
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
  }, [hideTimeout]);

  // ✅ Liste des règles basée sur les checks
  const requirements = [
    { key: 'length', label: '8 caractères minimum', met: checks.length },
    { key: 'uppercase', label: '1 majuscule (A-Z)', met: checks.uppercase },
    { key: 'lowercase', label: '1 minuscule (a-z)', met: checks.lowercase },
    { key: 'number', label: '1 chiffre (0-9)', met: checks.number },
    { key: 'special', label: '1 caractère spécial (!@#$%^&*)', met: checks.special },
    { key: 'noCommon', label: 'Pas de mot de passe évident (1234, password, etc.)', met: checks.noCommonPattern },
    { key: 'strong', label: 'Mot de passe fort (recommandé)', met: isRecommended }
  ];

  return (
    <div className="password-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-2 sm:py-4 pb-32">
        
        {/* Header */}
        <div className="password-header text-center mb-3 sm:mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-2">
            <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-[#ff6b35]" />
          </div>
          <h2 className="password-title text-xl sm:text-2xl font-bold text-white mb-1">
            Sécurise ton compte
          </h2>
          <p className="password-subtitle text-xs sm:text-sm text-white/60">
            Choisis un mot de passe fort
          </p>
        </div>

        {/* Form */}
        <div className="password-form space-y-6">
          {/* Password Field */}
          <div className="form-group">
            <Label htmlFor="password" className="password-label block text-sm font-medium text-white/80 mb-2">
              Mot de passe
            </Label>

            <div className="password-input-wrapper relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={localPassword}
                onChange={handlePasswordChange}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                maxLength={256}
                aria-invalid={!isValid && localPassword.length > 0}
                aria-describedby="password-error password-strength"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                  !isValid && localPassword.length > 0 ? 'border-red-500 focus:ring-red-500' : 'border-white/10'
                } text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all pr-12`}
                autoFocus
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Strength Bar */}
            {localPassword && (
              <div className="mt-3 space-y-1" id="password-strength">
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                    style={{ width: `${passwordStrength.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${
                    passwordStrength.level === 'strong' ? 'text-green-500' :
                    passwordStrength.level === 'medium' ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {passwordStrength.label}
                  </span>
                  {passwordStrength.feedback && (
                    <span className="text-xs text-white/40">{passwordStrength.feedback}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field — remonté juste sous le mot de passe pour rester visible */}
          <div className="form-group">
            <Label htmlFor="confirm-password" className="password-label block text-sm font-medium text-white/80 mb-2">
              Confirmer le mot de passe
            </Label>

            <div className="password-input-wrapper relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={localConfirmPassword}
                onChange={(e) => setLocalConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                maxLength={256}
                aria-invalid={!passwordsMatch && localConfirmPassword.length > 0}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all pr-12"
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isSubmitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Match Status */}
            {localConfirmPassword && (
              <p 
                id="password-error"
                className={`text-xs mt-2 ${passwordsMatch ? 'text-green-500' : 'text-red-500'}`}
                role="status"
                aria-live="polite"
              >
                {passwordsMatch ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
              </p>
            )}
          </div>

          {/* Requirements Checklist (repliable pour ne pas masquer la confirmation) */}
          <details className="requirements-section bg-white/5 rounded-xl p-4 border border-white/10" open={!isValid}>
            <summary className="text-xs font-semibold text-white/60 cursor-pointer select-none flex items-center justify-between gap-2">
              <span>📋 Exigences du mot de passe</span>
              <span className={`text-xs font-mono ${isValid ? 'text-green-500' : 'text-white/50'}`}>
                {requirements.filter((r) => r.met).length}/{requirements.length}
              </span>
            </summary>
            <div className="space-y-2 mt-3">
              {requirements.map((req) => (
                <div key={req.key} className={`flex items-center gap-2 transition-all duration-300 ${
                  req.met ? 'opacity-100' : 'opacity-60'
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    req.met ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                    {req.met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </span>
                  <span className={`text-xs ${req.met ? 'text-green-500' : 'text-white/60'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </details>

          {/* Warning if not recommended */}
          {localPassword && !isRecommended && isValid && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <p className="text-xs text-yellow-500">
                Ton mot de passe est acceptable mais nous recommandons un mot de passe plus fort.
              </p>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="password-info mt-8 text-center">
          <p className="password-info-text text-xs text-white/40">
            Ne partage ton mot de passe avec personne
          </p>
        </div>
      </div>

      {/* Action Container */}
      <ActionContainer
        onBack={flow.goToPreviousStep}
        onNext={handleContinue}
        isValid={isValid}
        isLoading={isSubmitting}
        nextLabel={!isRecommended && isValid ? 'Continuer (faible recommandation)' : 'Continuer'}
      />
    </div>
  );
};

PasswordPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default PasswordPage;
