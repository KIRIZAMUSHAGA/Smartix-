// components/ToggleSwitch.jsx
import React, { useCallback, useId } from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT TOGGLE SWITCH (accessible & premium)
// =============================
const ToggleSwitch = ({ 
  enabled, 
  onChange, 
  disabled = false,
  className = "",
  size = "md",
  colorEnabled = "bg-[#ff6b35]",
  colorDisabled = "bg-foreground/10",
  label,
  ariaLabel
}) => {
  const id = useId();
  const switchId = `toggle-${id}`;
  
  // =============================
  // 2️⃣ TAILLES PRÉDÉFINIES
  // =============================
  const sizes = {
    sm: {
      container: "w-8 h-4",
      knob: "w-3 h-3",
      translateX: 16
    },
    md: {
      container: "w-12 h-6",
      knob: "w-4 h-4",
      translateX: 24
    },
    lg: {
      container: "w-14 h-7",
      knob: "w-5 h-5",
      translateX: 28
    }
  };
  
  const sizeConfig = sizes[size] || sizes.md;
  
  // =============================
  // 3️⃣ GESTIONNAIRES D'ÉVÉNEMENTS
  // =============================
  const handleClick = useCallback(() => {
    if (!disabled) {
      onChange(!enabled);
    }
  }, [disabled, enabled, onChange]);
  
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(!enabled);
    }
  }, [disabled, enabled, onChange]);
  
  // =============================
  // 4️⃣ RENDU
  // =============================
  const containerClasses = `
    ${sizeConfig.container}
    ${enabled ? colorEnabled : colorDisabled}
    rounded-full
    relative
    cursor-pointer
    transition-all
    duration-300
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    focus:outline-none
    focus-visible:ring-2
    focus-visible:ring-[#ff6b35]
    focus-visible:ring-offset-2
    focus-visible:ring-offset-background
    ${className}
  `;
  
  const knobClasses = `
    absolute
    left-1
    top-1/2
    -translate-y-1/2
    ${sizeConfig.knob}
    bg-white
    rounded-full
    shadow-sm
    transition-all
    duration-300
    ${disabled ? 'opacity-50' : ''}
  `;
  
  const switchElement = (
    <div
      id={switchId}
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel || label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={containerClasses}
    >
      <motion.div
        animate={{ x: enabled ? sizeConfig.translateX : 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 400,   // ✅ plus naturel
          damping: 25,      // ✅ plus naturel
          mass: 0.8
        }}
        className={knobClasses}
      />
    </div>
  );
  
  // Si un label est fourni, on l'enrobe
  if (label) {
    return (
      <div className="flex items-center gap-3">
        {switchElement}
        <label
          htmlFor={switchId}
          className="text-sm font-medium text-foreground cursor-pointer select-none"
        >
          {label}
        </label>
      </div>
    );
  }
  
  return switchElement;
};

ToggleSwitch.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  size: PropTypes.number,
  colorEnabled: PropTypes.string,
  colorDisabled: PropTypes.string,
  label: PropTypes.string.isRequired,
  ariaLabel: PropTypes.string,
};

export default ToggleSwitch;
