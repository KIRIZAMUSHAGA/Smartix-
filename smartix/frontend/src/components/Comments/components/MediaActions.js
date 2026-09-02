// frontend/src/components/Comments/components/MediaActions.js
import React from 'react';
import PropTypes from 'prop-types';
import { 
  Image as ImageIcon, 
  Mic, 
  Gift, 
  Send, 
  Loader2, 
  Trash2
} from 'lucide-react';

// =============================
// CONSTANTES
// =============================
const BUTTON_VARIANTS = {
  default: "p-0.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors",
  active: "p-0.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors",
  danger: "p-0.5 text-red-500 hover:text-red-600 transition-colors",
  success: "p-0.5 text-green-500 hover:text-green-600 transition-colors"
};

// Fonction noop stable pour éviter les recréations
const noop = () => {};

// =============================
// COMPOSANT BOUTON D'ACTION
// =============================
const ActionButton = ({ 
  icon: Icon, 
  onClick, 
  disabled = false, 
  loading = false,
  active = false,
  variant = 'default',
  title = '',
  ariaLabel = '',
  badge = false,
  className = ''
}) => {
  // Version optimisée de la sélection du variant
  const variantClass = active
    ? BUTTON_VARIANTS.active
    : BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.default;
  
  const showRecordingBadge = badge; // Micro-optimisation
  
  return (
    <button
      type="button" // Évite les comportements inattendus dans les formulaires
      onClick={onClick}
      disabled={disabled || loading}
      aria-pressed={active} // Indique l'état actif aux lecteurs d'écran
      className={`relative ${variantClass} ${className} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-current focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full`}
      title={title}
      aria-label={ariaLabel || title}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {showRecordingBadge && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white dark:border-gray-800 animate-pulse" />
      )}
    </button>
  );
};

// =============================
// COMPOSANT SÉPARATEUR
// =============================
const Separator = () => (
  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const MediaActions = ({
  // Actions
  onImageClick,
  onMicClick,
  onGifClick,
  onSubmit,
  onClear,
  
  // États
  isSubmitting = false,
  disabled = false,
  hasContent = false,
  isRecording = false,
  isGifPickerOpen = false,
  isUploading = false,
  
  // Options
  showImageButton = true,
  showMicButton = true,
  showGifButton = true
}) => {
  // Factorisation des conditions disabled
  const isDisabled = disabled || isSubmitting;
  const isSubmitDisabled = disabled || isSubmitting || isUploading || !hasContent;
  
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* Bouton Image */}
      {showImageButton && (
        <ActionButton
          icon={ImageIcon}
          onClick={onImageClick || noop}
          disabled={isDisabled}
          loading={isUploading}
          title="Joindre une image"
          ariaLabel="Joindre une image"
        />
      )}

      {/* Bouton Micro (enregistrement vocal) */}
      {showMicButton && (
        <ActionButton
          icon={Mic}
          onClick={onMicClick || noop}
          disabled={isDisabled}
          active={isRecording}
          variant={isRecording ? 'active' : 'default'}
          title={isRecording ? "Enregistrement en cours..." : "Message vocal"}
          ariaLabel="Message vocal"
          badge={isRecording}
        />
      )}

      {/* Bouton GIF */}
      {showGifButton && (
        <ActionButton
          icon={Gift}
          onClick={onGifClick || noop}
          disabled={isDisabled}
          active={isGifPickerOpen}
          variant={isGifPickerOpen ? 'active' : 'default'}
          title="Ajouter un GIF"
          ariaLabel="Ajouter un GIF"
        />
      )}

      {/* Séparateur */}
      <Separator />

      {/* Bouton Annuler (si contenu présent) */}
      {hasContent && onClear && (
        <ActionButton
          icon={Trash2}
          onClick={onClear}
          disabled={isDisabled}
          variant="danger"
          title="Annuler"
          ariaLabel="Annuler le contenu"
        />
      )}

      {/* Bouton d'envoi */}
      <ActionButton
        icon={Send}
        onClick={onSubmit || noop}
        disabled={isSubmitDisabled}
        loading={isSubmitting}
        variant="success"
        title="Envoyer"
        ariaLabel="Envoyer"
        className={hasContent ? 'scale-110 transition-transform' : ''}
      />
    </div>
  );
};

// =============================
// COMPARAISON PERSONNALISÉE POUR OPTIMISER REACT.MEMO
// =============================
const arePropsEqual = (prev, next) => {
  return (
    prev.isSubmitting === next.isSubmitting &&
    prev.disabled === next.disabled &&
    prev.hasContent === next.hasContent &&
    prev.isRecording === next.isRecording &&
    prev.isGifPickerOpen === next.isGifPickerOpen &&
    prev.isUploading === next.isUploading &&
    prev.showImageButton === next.showImageButton &&
    prev.showMicButton === next.showMicButton &&
    prev.showGifButton === next.showGifButton &&
    prev.onImageClick === next.onImageClick &&
    prev.onMicClick === next.onMicClick &&
    prev.onGifClick === next.onGifClick &&
    prev.onSubmit === next.onSubmit &&
    prev.onClear === next.onClear
  );
};

// =============================
// EXPORT AVEC MÉMO OPTIMISÉ
// =============================
MediaActions.propTypes = {
  onImageClick: PropTypes.func,
  onMicClick: PropTypes.func,
  onGifClick: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  onClear: PropTypes.func,
  isSubmitting: PropTypes.bool,
  disabled: PropTypes.bool,
  hasContent: PropTypes.bool,
  isRecording: PropTypes.bool,
  isGifPickerOpen: PropTypes.bool,
  isUploading: PropTypes.bool,
  showImageButton: PropTypes.bool,
  showMicButton: PropTypes.bool,
  showGifButton: PropTypes.bool
};

export default React.memo(MediaActions, arePropsEqual);
ActionButton.propTypes = {
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  active: PropTypes.bool,
  variant: PropTypes.string,
  title: PropTypes.string,
  ariaLabel: PropTypes.any,
  badge: PropTypes.object,
  className: PropTypes.any,
};
Separator.propTypes = {};
