import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Loader2, CheckCircle2, Sparkles, AlertCircle, Shield, FileText, Camera, Image, X } from 'lucide-react';
import { register, authApi } from '../../../services/authService';
import { compressImage } from '../../../utils/imageUtils';
import ActionContainer from '../ActionContainer';
import '../styles/FinalPage.css';

// =============================
// 1️⃣ COMPOSANT DE RÉCAPITULATIF
// =============================
const SummaryItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
    <Icon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-sm text-white font-medium break-words">{value || 'Non renseigné'}</p>
    </div>
  </div>
);

// ✅ NOUVEAU: Composant de prévisualisation d'image
const ImagePreview = ({ file, title, onRemove, icon: Icon }) => {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(false);
  const previewUrlRef = useRef(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreview(url);
    }
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [file]);

  if (!file && !preview) return null;

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#ff6b35]" />
          <h4 className="text-sm font-medium text-white">{title}</h4>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
            aria-label={`Supprimer ${title}`}
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        )}
      </div>
      <div className="p-3">
        {error ? (
          <div className="h-24 bg-red-500/10 rounded-lg flex items-center justify-center">
            <p className="text-xs text-red-500">Image non disponible</p>
          </div>
        ) : preview ? (
          <img
            src={preview}
            alt={`Aperçu de ${title}`}
            className="w-full h-24 object-cover rounded-lg"
            onError={() => setError(true)}
          />
        ) : (
          <div className="h-24 bg-white/5 rounded-lg flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          </div>
        )}
      </div>
    </div>
  );
};

const FinalPage = ({ flow, onLoading }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(flow.formData.accept_terms || false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(flow.formData.accept_privacy || false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('idle');

  const abortControllerRef = useRef(null);

  // États locaux pour la prévisualisation
  const [avatarPreview, setAvatarPreview] = useState(flow.formData.avatar_file || null);
  const [coverPreview, setCoverPreview] = useState(flow.formData.cover_file || null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const isValid = acceptTerms && acceptPrivacy;

  const handleRemoveAvatar = useCallback(() => {
    setAvatarPreview(null);
    flow.updateFormData('avatar_file', null);
  }, [flow]);

  const handleRemoveCover = useCallback(() => {
    setCoverPreview(null);
    flow.updateFormData('cover_file', null);
  }, [flow]);

  const handleFinish = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1️⃣ Création du compte d'abord — l'utilisateur n'est pas encore
      // authentifié, donc on ne peut rien uploader avant.
      setUploadStage('registering');
      setUploadProgress(0);

      const additionalData = {
        school: typeof flow.formData.school === 'object'
          ? flow.formData.school?.name || null
          : flow.formData.school || null,
        level: flow.formData.level || null,
        date_of_birth: flow.formData.date_of_birth || null,
        accept_terms: acceptTerms,
        accept_privacy: acceptPrivacy,
      };

      const registerResponse = await register(
        flow.formData.email,
        flow.formData.password,
        flow.formData.full_name,
        flow.formData.username,
        additionalData
      );

      const userId = registerResponse?.user?.id;

      // 2️⃣ Une fois inscrit, authApi a le token : on peut uploader.
      const uploadProfileImage = async (file) => {
        const fd = new FormData();
        fd.append('file', file);
        const res = await authApi.post('/auth/upload-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal,
          // ⏱️ Le timeout par défaut d'authApi est court (refresh) :
          // on l'augmente pour les uploads de fichiers.
          timeout: 60000,
          onUploadProgress: (e) => {
            if (e.total) {
              setUploadProgress(Math.round((e.loaded * 100) / e.total));
            }
          },
        });
        return res.data?.url || null;
      };

      // 🗜️ Helper : compression locale avant envoi (best-effort).
      // Réduit la taille du fichier pour des uploads plus rapides et fiables,
      // surtout sur les connexions mobiles. En cas d'échec, on retombe sur
      // le fichier d'origine.
      const compressForUpload = async (file, { maxSizeMB, label }) => {
        if (!file || !(file instanceof Blob)) return file;
        try {
          const compressed = await compressImage(file, maxSizeMB);
          if (compressed && compressed.size > 0 && compressed.size < file.size) {
            console.info(
              `Compression ${label} : ${(file.size / 1024).toFixed(0)} Ko → ${(compressed.size / 1024).toFixed(0)} Ko`
            );
            return compressed;
          }
          return file;
        } catch (e) {
          console.warn(`Compression ${label} a échoué, envoi du fichier original :`, e);
          return file;
        }
      };

      let avatarUrl = null;
      let coverUrl = null;

      if (avatarPreview) {
        setUploadStage('compressing_avatar');
        setUploadProgress(0);
        const avatarToUpload = await compressForUpload(avatarPreview, {
          maxSizeMB: 0.5,
          label: 'avatar',
        });
        setUploadStage('uploading_avatar');
        setUploadProgress(0);
        try {
          avatarUrl = await uploadProfileImage(avatarToUpload);
        } catch (e) {
          console.warn('Upload avatar a échoué, on continue sans :', e);
        }
      }

      if (coverPreview) {
        setUploadStage('compressing_cover');
        setUploadProgress(0);
        const coverToUpload = await compressForUpload(coverPreview, {
          maxSizeMB: 1,
          label: 'cover',
        });
        setUploadStage('uploading_cover');
        setUploadProgress(0);
        try {
          coverUrl = await uploadProfileImage(coverToUpload);
        } catch (e) {
          console.warn('Upload cover a échoué, on continue sans :', e);
        }
      }

      // 3️⃣ Mise à jour du profil avec les URLs (et école/niveau).
      if (userId && (avatarUrl || coverUrl || additionalData.school || additionalData.level)) {
        const profileUpdate = {};
        if (avatarUrl) profileUpdate.avatar = avatarUrl;
        if (coverUrl) profileUpdate.cover_image = coverUrl;
        try {
          await authApi.put(`/api/users/${userId}`, profileUpdate, { signal, timeout: 30000 });
        } catch (e) {
          console.warn('Mise à jour profil échouée :', e);
        }
      }

      flow.completeRegistration();

    } catch (err) {
      console.error('Erreur inscription:', err);

      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        setError('Inscription annulée');
      } else {
        const detail = err.response?.data?.detail;
        let errorMessage;
        if (Array.isArray(detail)) {
          errorMessage = detail.map((d) => d.msg || JSON.stringify(d)).join(' • ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        } else {
          errorMessage = err.response?.data?.message || err.message || 'Une erreur est survenue.';
        }
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
      setUploadStage('idle');
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  }, [isValid, isSubmitting, avatarPreview, coverPreview, flow, acceptTerms, acceptPrivacy]);

  const getProgressMessage = () => {
    switch (uploadStage) {
      case 'compressing_avatar':
        return 'Optimisation de la photo de profil...';
      case 'compressing_cover':
        return 'Optimisation de la photo de couverture...';
      case 'uploading_avatar':
        return `Téléchargement de la photo de profil... ${uploadProgress}%`;
      case 'uploading_cover':
        return `Téléchargement de la photo de couverture... ${uploadProgress}%`;
      case 'registering':
        return 'Création de votre compte...';
      default:
        return '';
    }
  };

  const schoolName = typeof flow.formData.school === 'object'
    ? flow.formData.school?.name || ''
    : flow.formData.school || '';
  const schoolInfo = flow.formData.level && schoolName
    ? `${flow.formData.level} - ${schoolName}`
    : flow.formData.level || schoolName || 'Non renseigné';

  return (
    <div className="final-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Header */}
        <div className="final-header text-center mb-8 sm:mb-12">
          <div className="final-icon-wrapper inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-4">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff6b35]" />
          </div>
          <h2 className="final-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Bienvenue sur Smartix !
          </h2>
          <p className="final-subtitle text-sm sm:text-base text-white/60">
            Vérifie tes informations avant de finaliser
          </p>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={handleFinish}
                disabled={!isValid || isSubmitting}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-red-500/30 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Nouvel essai...
                  </>
                ) : (
                  'Réessayer'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Message de progression */}
        {isSubmitting && uploadStage !== 'idle' && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl" aria-live="polite">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <p className="text-sm text-blue-500">{getProgressMessage()}</p>
            </div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="h-1.5 w-full bg-blue-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* ✅ IMAGES - PRÉVISUALISATION */}
        {(avatarPreview || coverPreview) && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-semibold text-white/60">Tes images</h3>
            {avatarPreview && (
              <ImagePreview
                file={avatarPreview}
                title="Photo de profil"
                icon={Camera}
                onRemove={handleRemoveAvatar}
              />
            )}
            {coverPreview && (
              <ImagePreview
                file={coverPreview}
                title="Photo de couverture"
                icon={Image}
                onRemove={handleRemoveCover}
              />
            )}
          </div>
        )}

        {/* ✅ RÉCAPITULATIF DES INFORMATIONS */}
        <div className="final-summary space-y-3 mb-8">
          <SummaryItem icon={CheckCircle2} label="Nom complet" value={flow.formData.full_name} />
          <SummaryItem icon={CheckCircle2} label="Nom d'utilisateur" value={`@${flow.formData.username}`} />
          <SummaryItem icon={CheckCircle2} label="Email" value={flow.formData.email} />
          <SummaryItem icon={CheckCircle2} label="Profil scolaire" value={schoolInfo} />
          {flow.formData.date_of_birth && (
            <SummaryItem 
              icon={CheckCircle2} 
              label="Date de naissance" 
              value={new Date(flow.formData.date_of_birth).toLocaleDateString('fr-FR')} 
            />
          )}
        </div>

        {/* Conditions légales */}
        <div className="final-legal space-y-6 mb-8">
          <div className="legal-section bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-[#ff6b35]" />
              <h3 className="text-sm font-semibold text-white">Conditions d'utilisation</h3>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              En utilisant Smartix, tu acceptes nos conditions d'utilisation. Tu t'engages à utiliser la plateforme de manière responsable et respectueuse.
            </p>
          </div>

          <div className="legal-section bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-[#ff6b35]" />
              <h3 className="text-sm font-semibold text-white">Politique de confidentialité</h3>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Tes données personnelles sont traitées de manière sécurisée et confidentielle. Nous ne les partageons jamais avec des tiers sans ton consentement.
            </p>
          </div>

          {/* Checkboxes */}
          <div className="legal-checkboxes space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#ff6b35] focus:ring-[#ff6b35] focus:ring-offset-0"
                aria-describedby="terms-description"
              />
              <div>
                <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                  J'accepte les <span className="text-[#ff6b35]">conditions d'utilisation</span>
                </span>
                <p id="terms-description" className="text-xs text-white/30 mt-1">
                  Vous acceptez de respecter les règles de la communauté
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#ff6b35] focus:ring-[#ff6b35] focus:ring-offset-0"
                aria-describedby="privacy-description"
              />
              <div>
                <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                  J'accepte la <span className="text-[#ff6b35]">politique de confidentialité</span>
                </span>
                <p id="privacy-description" className="text-xs text-white/30 mt-1">
                  Vos données sont protégées et ne sont pas partagées
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Info Footer */}
        <div className="final-info text-center">
          <p className="final-info-text text-xs text-white/40">
            Nous t'enverrons un email de confirmation 📧
          </p>
        </div>
      </div>

      {/* Action Container */}
      <ActionContainer
        onBack={flow.goToPreviousStep}
        onNext={handleFinish}
        isValid={isValid}
        isLoading={isSubmitting}
        nextLabel="S'inscrire gratuitement"
      />
    </div>
  );
};

SummaryItem.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string,
  value: PropTypes.string,
};

ImagePreview.propTypes = {
  file: PropTypes.object,
  title: PropTypes.string,
  onRemove: PropTypes.func,
  icon: PropTypes.elementType,
};

FinalPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default FinalPage;
