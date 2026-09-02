import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { School, AlertCircle, Check, ChevronDown } from 'lucide-react';
import ActionContainer from '../ActionContainer';
import '../styles/SchoolPage.css';

// =============================
// 1️⃣ DONNÉES STRUCTURÉES
// =============================
const LEVELS = [
  { value: 'primary', label: 'Primaire' },
  { value: 'secondary1', label: 'Secondaire 1' },
  { value: 'secondary2', label: 'Secondaire 2' },
  { value: 'highschool', label: 'Lycée' },
  { value: 'university', label: 'Université' },
  { value: 'other', label: 'Autre' }
];

// =============================
// 2️⃣ VALIDATION CENTRALISÉE (source unique)
// =============================
const validateSchool = (school) => {
  if (!school) return { valid: false, error: '' };
  
  const trimmed = school.trim();
  if (trimmed.length === 0) return { valid: false, error: '' };
  if (trimmed.length < 2) return { valid: false, error: 'Au moins 2 caractères' };
  if (trimmed.length > 100) return { valid: false, error: 'Maximum 100 caractères' };
  
  // ✅ Vérification des caractères spéciaux excessifs
  const specialCharsCount = (trimmed.match(/[^a-zA-ZÀ-ÿ0-9\s'-]/g) || []).length;
  if (specialCharsCount > 5) {
    return { valid: false, error: 'Trop de caractères spéciaux' };
  }
  
  return { valid: true, error: '' };
};

// =============================
// 3️⃣ COMPOSANT SELECT CUSTOM (robuste)
// =============================
const CustomSelect = ({ value, onChange, options, disabled, placeholder, id }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = useCallback((optValue) => {
    onChange(optValue);
    setIsOpen(false);
  }, [onChange]);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => updateCoords();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  return (
    <div className="custom-select-container relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Niveau scolaire"
      >
        <span className={selectedOption ? 'text-white' : 'text-white/40'}>
          {selectedOption?.label || placeholder || 'Choisir un niveau...'}
        </span>
        <ChevronDown className={`w-5 h-5 text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            backgroundColor: '#1e293b',
            backgroundImage: 'none',
            opacity: 1,
            zIndex: 99999,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between ${
                value === option.value ? 'bg-white/10' : ''
              }`}
              style={{ backgroundColor: value === option.value ? '#243447' : '#1e293b' }}
              role="option"
              aria-selected={value === option.value}
            >
              <span>{option.label}</span>
              {value === option.value && <Check className="w-4 h-4 text-green-500" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

const SchoolPage = ({ flow, onLoading }) => {
  const [localSchool, setLocalSchool] = useState(flow.formData.school?.name || '');
  const [localLevel, setLocalLevel] = useState(flow.formData.level || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ SOURCE UNIQUE de validation (pas de state redondant)
  const schoolValidation = useMemo(
    () => validateSchool(localSchool),
    [localSchool]
  );

  // ✅ Validation stricte du niveau
  const isValidLevel = LEVELS.some(l => l.value === localLevel);
  const isValidSchool = schoolValidation.valid;
  const isValid = isValidSchool && isValidLevel;

  const handleContinue = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    onLoading(true);

    try {
      // ✅ Structure de données enrichie
      flow.updateMultipleFields({
        school: {
          name: localSchool.trim(),
          // Pour future évolution
          // country: flow.formData.school?.country || '',
          // city: flow.formData.school?.city || ''
        },
        level: localLevel
      });
      flow.goToNextStep();
    } catch (err) {
      console.error('Error saving school info:', err);
    } finally {
      setIsSubmitting(false);
      onLoading(false);
    }
  }, [isValid, isSubmitting, localSchool, localLevel, flow, onLoading]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && isValid && !isSubmitting) {
      handleContinue();
    }
  }, [isValid, isSubmitting, handleContinue]);

  // ✅ Valeurs dérivées (pas de state)
  const schoolError = schoolValidation.error;
  const selectedLevelLabel = LEVELS.find(l => l.value === localLevel)?.label || '';

  return (
    <div className="school-page flex flex-col items-center justify-start bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      {/* Container responsive */}
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Header */}
        <div className="school-header text-center mb-8 sm:mb-12">
          <div className="school-icon-wrapper inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 mb-4">
            <School className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff6b35]" />
          </div>
          <h2 className="school-title text-2xl sm:text-3xl font-bold text-white mb-3">
            Ton profil scolaire
          </h2>
          <p className="school-subtitle text-sm sm:text-base text-white/60">
            Où apprends-tu ?
          </p>
        </div>

        {/* Form */}
        <div className="school-form space-y-6">
          {/* École avec autocomplete */}
          <div className="form-group">
            <Label htmlFor="school" className="school-label block text-sm font-medium text-white/80 mb-2">
              École ou institution
            </Label>
            <Input
              id="school"
              type="text"
              placeholder="ex: Lycée Saint-Marie"
              value={localSchool}
              onChange={(e) => setLocalSchool(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              maxLength={100}
              autoComplete="organization"
              aria-invalid={!!schoolError && localSchool.length > 0}
              aria-describedby={schoolError ? "school-error" : undefined}
              className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                schoolError && localSchool ? 'border-red-500 focus:ring-red-500' : 'border-white/10'
              } text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent transition-all`}
              autoFocus
            />
            {schoolError && (
              <div id="school-error" className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>{schoolError}</span>
              </div>
            )}
          </div>

          {/* Niveau scolaire - Custom Select */}
          <div className="form-group">
            <Label htmlFor="level" className="school-label block text-sm font-medium text-white/80 mb-2">
              Niveau scolaire
            </Label>
            <CustomSelect
              id="level"
              value={localLevel}
              onChange={setLocalLevel}
              options={LEVELS}
              disabled={isSubmitting}
              placeholder="Choisir un niveau..."
            />
          </div>
        </div>

        {/* Info Footer */}
        <div className="school-info mt-8 text-center">
          <p className="school-info-text text-xs text-white/40">
            Tu pourras modifier ces informations plus tard dans les paramètres
          </p>
        </div>
      </div>

      {/* Action Container */}
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

CustomSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(PropTypes.object),
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  id: PropTypes.string,
};

SchoolPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onLoading: PropTypes.func,
};

export default SchoolPage;
