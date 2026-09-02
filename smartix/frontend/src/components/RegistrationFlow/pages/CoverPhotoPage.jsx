import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Loader2, Upload, Image, X, AlertCircle } from 'lucide-react';
import { useApiClient } from '../../../contexts/ApiClientContext';
import { cancelUpload } from '../../../services/uploadService';
import { MAX_COVER_SIZE, ACCEPTED_IMAGE_TYPES } from '../../../config/appConfig';
import ActionContainer from '../ActionContainer';
import '../styles/CoverPhotoPage.css';

// =============================
// 1️⃣ VALIDATION MIME PAR SIGNATURE (WebP CORRIGÉ)
// =============================
const validateFileSignature = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result);
      
      // JPEG
      if (arr[0] === 0xFF && arr[1] === 0xD8) {
        resolve({ valid: true, type: 'image/jpeg' });
        return;
      }
      
      // PNG
      if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
        resolve({ valid: true, type: 'image/png' });
        return;
      }
      
      // GIF
      if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) {
        resolve({ valid: true, type: 'image/gif' });
        return;
      }
      
      // ✅ WebP (corrigé: RIFF + WEBP)
      if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) {
        const webpMarker = arr.slice(8, 12);
        if (webpMarker[0] === 0x57 && webpMarker[1] === 0x45 && webpMarker[2] === 0x42 && webpMarker[3] === 0x50) {
          resolve({ valid: true, type: 'image/webp' });
          return;
        }
      }
      
      resolve({ valid: false, error: 'Format de fichier non reconnu' });
    };
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
};

// =============================
// 2️⃣ COMPRESSION AVEC RESPECT DU RATIO
// =============================
const compressCoverImage = (file, maxWidth = 1200, maxHeight = 400, quality = 0.85) => {
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
        
        // ✅ Respect du ratio original
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        if (ratio < 1) {
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
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

const CoverPhotoPage = ({ flow, onLoading }) => {
  const { client } = useApiClient();
  const [preview, setPreview] = useState(flow.formData.cover_url ? null : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(flow.formData.cover_file || null);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  // ✅ Nettoyage mémoire
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // ✅ Mettre à jour le preview quand un fichier est sélectionné
  useEffect(() => {
    if (selectedFile) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(selectedFile);
      previewUrlRef.current = url;
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, [selectedFile]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError('');
    setIsProcessing(true);
    
    try {
      // ✅ Validation par signature
      const signatureValidation = await validateFileSignature(file);
      if (!signatureValidation.valid) {
        setError(signatureValidation.error);
        setIsProcessing(false);
        return;
      }
      
      // ✅ Validation taille (explicite)
      if (file.size > MAX_COVER_SIZE) {
        setError(`Fichier trop volumineux (max ${MAX_COVER_SIZE / (1024 * 1024)}MB)`);
        setIsProcessing(false);
        return;
      }
      
      // ✅ Compression conditionnelle
      let finalFile = file;
      if (file.size > MAX_COVER_SIZE / 2) {
        finalFile = await compressCoverImage(file, 1200, 400);
      }
      
      // ✅ STOCKER LE FICHIER DANS LE FLOW (PAS D'UPLOAD)
      setSelectedFile(finalFile);
      flow.updateFormData('cover_file', finalFile);
      
    } catch (err) {
      console.error('Erreur traitement image:', err);
      setError('Erreur lors du traitement de l\'image');
    } finally {
      setIsProcessing(false);
    }
  }, [flow]);

  const handleContinue = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving cover:', err);
      setError('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [isSubmitting, flow, onLoading]);

  const handleSkip = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      flow.goToNextStep();
    } catch (err) {
      console.error('Error skipping cover:', err);
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
    setSelectedFile(null);
    setPreview(null);
    flow.updateFormData('cover_file', null);
    flow.updateFormData('cover_url', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [flow]);

  const isValid = !!selectedFile;

  return (
    <div className="cover-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
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
        <div className="cover-header text-center mb-6 sm:mb-8">
          <div className="cover-icon-wrapper inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-4">
            <Image className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff6b35]" />
          </div>
          <h2 className="cover-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Photo de couverture
          </h2>
          <p className="cover-subtitle text-sm sm:text-base text-white/60">
            Personnalise ton profil avec une belle bannière
          </p>
        </div>

        {/* Form */}
        <div className="cover-form space-y-6">
          <div className="cover-upload-section flex flex-col items-center">
            {preview ? (
              <div className="relative group w-full">
                <div className="cover-preview w-full h-48 rounded-xl overflow-hidden bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 border border-white/10">
                  <img
                    src={preview}
                    alt="Aperçu de votre couverture"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
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
                className="cover-upload-btn w-full h-48 rounded-xl bg-white/5 border-2 border-dashed border-white/20 hover:border-[#ff6b35] hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
                aria-label="Sélectionner une photo de couverture"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin text-white/60" />
                    <span className="text-xs text-white/40">Traitement...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-white/60" />
                    <span className="text-xs text-white/40">Choisir une photo</span>
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
            
            {/* Feedback */}
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
                Formats: JPG, PNG, WebP (max {MAX_COVER_SIZE / (1024 * 1024)}MB)<br />
                Recommandé: 1200 x 400px
              </p>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="cover-info mt-8 text-center">
          <p className="cover-info-text text-xs text-white/40">
            Tu pourras modifier ta couverture plus tard dans les paramètres
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
        allowNextWhenInvalid
      />
    </div>
  );
};

CoverPhotoPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default CoverPhotoPage;
