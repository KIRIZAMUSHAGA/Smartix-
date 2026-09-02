import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';

const PublishProgress = ({ progress, status, eta, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (progress === 100 && status === 'success') {
        onClose?.();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [progress, status, onClose]);

  const getStatusMessage = () => {
    if (progress < 20) return 'Préparation...';
    if (progress < 50) return 'Compression des assets...';
    if (progress < 90) return 'Envoi au serveur...';
    if (progress < 100) return 'Finalisation...';
    return status === 'success' ? 'Publié!' : 'Erreur';
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-8 w-96 border border-white/20">
        <h2 className="text-xl font-bold text-white mb-4">Publication en cours...</h2>

        {/* Progress Bar */}
        <div className="bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/80 text-sm">{getStatusMessage()}</p>
          <p className="text-white/60 text-xs">{progress}%</p>
        </div>

        {/* ETA */}
        {eta && progress < 100 && (
          <p className="text-white/60 text-xs text-center">
            Temps estimé: {eta}s
          </p>
        )}

        {/* Result */}
        {status === 'success' && progress === 100 && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-5 h-5" />
            <span>Story publiée avec succès!</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Erreur lors de la publication</span>
          </div>
        )}
      </div>
    </div>
  );
};

PublishProgress.propTypes = {
  progress: PropTypes.number.isRequired,
  status: PropTypes.string.isRequired,
  eta: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default PublishProgress;
