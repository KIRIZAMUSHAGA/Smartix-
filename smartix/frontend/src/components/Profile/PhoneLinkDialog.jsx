import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '../ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { Phone, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { phoneLinkSendCode, phoneLinkVerifyCode } from '../../services/authService';

const loadRecaptcha = (siteKey) => {
  if (!siteKey) return Promise.reject(new Error('REACT_APP_RECAPTCHA_SITE_KEY manquante'));
  if (window.grecaptcha?.execute) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('recaptcha-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = 'recaptcha-script';
    s.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('reCAPTCHA load failed'));
    document.head.appendChild(s);
  });
};

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
const isLikelyE164 = (s) => /^\+\d{8,15}$/.test(s.trim());

/**
 * Dialog 2 étapes pour rattacher un numéro de téléphone au compte courant.
 * À la différence de PhoneAuthFlow (qui CONNECTE), ici on RATTACHE — on appelle
 * `onLinked(updatedUser)` pour que le parent rafraîchisse son state.
 */
const PhoneLinkDialog = ({ open, onOpenChange, onLinked }) => {
  const phoneRef = useRef(null);

  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sessionInfo, setSessionInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('phone');
      setPhone('');
      setCode('');
      setSessionInfo('');
      setLoading(false);
      setTimeout(() => phoneRef.current?.focus(), 50);
      loadRecaptcha(RECAPTCHA_SITE_KEY).catch(() => {});
    }
  }, [open]);

  const handleSendCode = useCallback(async (e) => {
    e?.preventDefault();
    if (loading) return;
    if (!isLikelyE164(phone)) {
      toast.error('Numéro invalide', { description: 'Format attendu : +33612345678' });
      return;
    }
    if (!RECAPTCHA_SITE_KEY) {
      toast.error('Configuration manquante', {
        description: 'REACT_APP_RECAPTCHA_SITE_KEY non définie',
      });
      return;
    }
    setLoading(true);
    try {
      await loadRecaptcha(RECAPTCHA_SITE_KEY);
      const recaptchaToken = await window.grecaptcha.execute(
        RECAPTCHA_SITE_KEY,
        { action: 'phone_link_send_code' }
      );
      const data = await phoneLinkSendCode(phone.trim(), recaptchaToken);
      setSessionInfo(data.session_info);
      setStep('otp');
      toast.success('Code envoyé', { description: 'Vérifie tes SMS' });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Erreur inconnue';
      toast.error('Envoi du code impossible', { description: detail });
    } finally {
      setLoading(false);
    }
  }, [phone, loading]);

  const handleVerifyCode = useCallback(async (e) => {
    e?.preventDefault();
    if (loading) return;
    if (code.length !== 6) {
      toast.error('Code invalide', { description: '6 chiffres attendus' });
      return;
    }
    setLoading(true);
    try {
      const updated = await phoneLinkVerifyCode({ sessionInfo, code });
      toast.success('Numéro rattaché 🎉');
      if (onLinked && updated) onLinked(updated);
      onOpenChange(false);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Code invalide';
      toast.error('Vérification impossible', { description: detail });
    } finally {
      setLoading(false);
    }
  }, [code, sessionInfo, loading, onLinked, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="registration-dialog w-full max-w-md rounded-2xl overflow-hidden border-0 p-0">
        <div className="registration-content px-6 pt-8 pb-6">
          <div className="login-header">
            <div className="login-icon-container">
              <Phone className="w-8 h-8" style={{ color: '#ff6b35' }} />
            </div>
            <h2 className="login-title">
              {step === 'phone' ? 'Lier un numéro' : 'Code de vérification'}
            </h2>
            <p className="login-description">
              {step === 'phone'
                ? 'Saisis ton numéro au format international'
                : `Code envoyé au ${phone}`}
            </p>
          </div>

          {step === 'phone' && (
            <form onSubmit={handleSendCode} className="login-form-fields">
              <div className="form-group">
                <label className="login-label">Numéro de téléphone</label>
                <div className="login-input-wrapper">
                  <input
                    ref={phoneRef}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+33612345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    className="login-input"
                  />
                </div>
                {phone && !isLikelyE164(phone) && (
                  <p className="text-xs text-red-500 mt-1">Format E.164 attendu (+ pays)</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isLikelyE164(phone)}
                className={`w-full h-12 mt-6 bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all duration-300 ${
                  loading ? 'cursor-not-allowed opacity-70' : ''
                } ${!isLikelyE164(phone) ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Envoi du code...
                  </>
                ) : (
                  <>Recevoir le code <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyCode} className="login-form-fields">
              <div className="form-group flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(v) => setCode(v.replace(/\D/g, ''))}
                  disabled={loading}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className={`w-full h-12 mt-6 bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all duration-300 ${
                  loading ? 'cursor-not-allowed opacity-70' : ''
                } ${code.length !== 6 ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>Lier le numéro <ChevronRight className="w-5 h-5" /></>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                disabled={loading}
                className="w-full mt-3 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Modifier le numéro
              </button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

PhoneLinkDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onLinked: PropTypes.func,
};

export default PhoneLinkDialog;
