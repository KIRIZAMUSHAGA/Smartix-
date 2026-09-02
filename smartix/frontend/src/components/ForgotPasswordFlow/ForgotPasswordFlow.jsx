import React, { useState } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Mail, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import axios from 'axios';
import './ForgotPasswordFlow.css';
import PropTypes from 'prop-types';

const ForgotPasswordFlow = ({ open, onOpenChange }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
      setTimeout(() => {
        setEmail('');
        setSubmitted(false);
        onOpenChange(false);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const isValid = email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="forgot-password-dialog w-full h-screen max-w-none max-h-screen overflow-hidden border-0 rounded-0 flex flex-col p-0">
        <div className="forgot-password-content flex-1 overflow-hidden px-6 pt-8 pb-6">
          <div className="w-full max-w-md mx-auto">
            {!submitted ? (
              <>
                <div className="forgot-password-header">
                  <div className="forgot-password-icon-container">
                    <Mail className="forgot-password-icon" />
                  </div>
                  <h2 className="forgot-password-title">Réinitialiser votre mot de passe</h2>
                  <p className="forgot-password-description">
                    Entrez votre adresse email et nous vous enverrons un lien de réinitialisation
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="forgot-password-form">
                  <div className="form-group">
                    <label className="forgot-password-label">Email</label>
                    <div className="forgot-password-input-wrapper">
                      <input
                        type="email"
                        placeholder="votre@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="forgot-password-input"
                        disabled={loading}
                      />
                    </div>
                    {error && <p className="forgot-password-error">{error}</p>}
                  </div>
                </form>

                <div className="fixed bottom-12 right-12 z-50">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !isValid}
                    className={`min-w-[160px] h-14 bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-full shadow-lg shadow-[#ff6b35]/20 flex items-center justify-center gap-2 px-8 text-lg font-bold transition-all duration-500 ${
                      !isValid ? 'opacity-0 translate-y-8 scale-90 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'
                    }`}
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Envoyer <ChevronRight className="w-5 h-5" /></>}
                  </button>
                </div>
              </>
            ) : (
              <div className="forgot-password-success">
                <div className="success-icon-container">
                  <CheckCircle className="success-icon" />
                </div>
                <h2 className="success-title">Email envoyé!</h2>
                <p className="success-description">
                  Un lien de réinitialisation a été envoyé à {email}. Veuillez vérifier votre inbox.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

ForgotPasswordFlow.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
};

export default ForgotPasswordFlow;
