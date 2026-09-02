import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../ui/button';
import { Loader2, Upload, User, Camera, X, AlertCircle, Check } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import { MAX_IMAGE_SIZE, ACCEPTED_IMAGE_TYPES } from '../../../config/appConfig';
import { useApiClient } from '../../../contexts/ApiClientContext';
import '../styles/AvatarPage.css';

// =============================
// 1️⃣ VALIDATION MIME PAR SIGNATURE (magic numbers, byte-par-byte)
// =============================
const validateFileSignature = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result);

      // JPEG
      if (arr[0] === 0xFF && arr[1] === 0xD8) {
        return resolve({ valid: true, type: 'image/jpeg' });
      }
      // PNG
      if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
        return resolve({ valid: true, type: 'image/png' });
      }
      // GIF
      if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) {
        return resolve({ valid: true, type: 'image/gif' });
      }
      // WebP (RIFF....WEBP)
      if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) {
        const m = arr.slice(8, 12);
        if (m[0] === 0x57 && m[1] === 0x45 && m[2] === 0x42 && m[3] === 0x50) {
          return resolve({ valid: true, type: 'image/webp' });
        }
      }

      resolve({ valid: false, error: 'Format de fichier invalide ou corrompu' });
    };
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
};

// =============================
// 2️⃣ COMPRESSION CONDITIONNELLE
// =============================
const compressImage = (file, maxWidth = 512, maxHeight = 512, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Redimensionnement
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // ✅ Conserver le type original
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Échec de la compression'));
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: outputType,
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, outputType, quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const AvatarPage = ({ flow, onLoading }) => {
  const { client } = useApiClient();
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  // ✅ Nettoyage mémoire (CRITIQUE)
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError('');
    setIsProcessing(true);
    
    try {
      // ✅ Validation par signature (anti-spoofing)
      const signatureValidation = await validateFileSignature(file);
      if (!signatureValidation.valid) {
        setError(signatureValidation.error);
        setIsProcessing(false);
        return;
      }
      
      // ✅ Validation taille
      if (file.size > MAX_IMAGE_SIZE) {
        setError(`Fichier trop volumineux (max ${MAX_IMAGE_SIZE / (1024 * 1024)}MB)`);
        setIsProcessing(false);
        return;
      }
      
      // ✅ Compression conditionnelle
      let finalFile = file;
      if (file.size > MAX_IMAGE_SIZE / 2) {
        finalFile = await compressImage(file, 512, 512);
      }
      
      // ✅ Nettoyer l'ancien preview
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      
      // ✅ Utiliser URL.createObjectURL (pas de base64 en mémoire)
      const previewUrl = URL.createObjectURL(finalFile);
      previewUrlRef.current = previewUrl;
      setPreview(previewUrl);

      // ⚠️ L'utilisateur n'est pas encore authentifié à cette étape :
      // on ne peut pas uploader vers le serveur. On stocke le fichier
      // dans le state du flow ; FinalPage l'enverra après la création
      // du compte (même comportement que CoverPhotoPage).
      flow.updateFormData('avatar_file', finalFile);

    } catch (err) {
      console.error('Erreur traitement image:', err);
      setError('Erreur lors du traitement de l\'image');
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreview(null);
      }
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  }, [flow, client]);

  const handleContinue = useCallback(async () => {
    if (!preview || isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving avatar:', err);
      setError('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [preview, isSubmitting, flow, onLoading]);

  const handleSkip = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      flow.goToNextStep();
    } catch (err) {
      console.error('Error skipping avatar:', err);
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [isSubmitting, flow, onLoading]);

  const handleRemove = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    flow.updateFormData('avatar_url', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [flow]);

  const isValid = !!preview && !error;

  return (
    <div className="avatar-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      {/* Bouton Passer en haut à droite */}
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSubmitting}
          className="text-sm text-white/70 hover:text-white transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10"
          aria-label="Passer cette étape"
        >
          Passer
        </button>
      </div>

      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-2 sm:py-4 pb-32">
        
        {/* Header */}
        <div className="avatar-header text-center mb-6 sm:mb-8">
          <div className="avatar-icon-wrapper inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-4">
            <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff6b35]" />
          </div>
          <h2 className="avatar-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Ta photo de profil
          </h2>
          <p className="avatar-subtitle text-sm sm:text-base text-white/60">
            Choisis une photo pour personnaliser ton profil
          </p>
        </div>

        {/* Form */}
        <div className="avatar-form space-y-6">
          <div className="avatar-upload-section flex flex-col items-center">
            {preview ? (
              <div className="relative group">
                <div className="avatar-preview w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 border-2 border-white/20">
                  <img
                    src={preview}
                    alt="Aperçu de votre avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting || isProcessing}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
                      aria-label="Changer la photo"
                    >
                      <Upload className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={handleRemove}
                      disabled={isSubmitting}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Supprimer la photo"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isProcessing}
                className="avatar-upload-btn w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white/5 border-2 border-dashed border-white/20 hover:border-[#ff6b35] hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
                aria-label="Sélectionner une photo de profil"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin text-white/60" />
                    <span className="text-xs text-white/40">
                      {uploadProgress > 0 ? `${uploadProgress}%` : 'Traitement...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-white/60" />
                    <span className="text-xs text-white/40">Choisir</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleFileSelect}
              disabled={isSubmitting || isProcessing}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            
            {/* Message d'erreur avec aria-live */}
            <div aria-live="polite" className="mt-3 min-h-[40px] text-center">
              {error && (
                <div className="flex items-center justify-center gap-1 text-red-500 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            {/* Hint */}
            {!preview && !error && (
              <p className="mt-4 text-xs text-white/40 text-center">
                Formats: JPG, PNG, WebP (max {MAX_IMAGE_SIZE / (1024 * 1024)}MB)
              </p>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="avatar-info mt-8 text-center">
          <p className="avatar-info-text text-xs text-white/40">
            Tu pourras modifier ta photo plus tard dans les paramètres
          </p>
        </div>
      </div>

      {/* Action Container — bouton Retour + Continuer */}
      <ActionContainer
        onBack={flow.goToPreviousStep}
        onNext={handleContinue}
        isValid={isValid}
        isLoading={isSubmitting}
        nextLabel="Continuer"
      />
    </div>
  );
};

AvatarPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default AvatarPage;
