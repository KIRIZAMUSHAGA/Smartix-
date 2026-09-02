import React, { useCallback } from "react";
import { BookOpen, Code, Calculator, PenTool } from "lucide-react";
import PropTypes from 'prop-types';

// =============================
// DONNÉES
// =============================
const modes = [
  { id: "student", name: "Étudiant", icon: BookOpen },
  { id: "developer", name: "Développeur", icon: Code },
  { id: "accountant", name: "Comptable", icon: Calculator },
  { id: "creative", name: "Créatif", icon: PenTool },
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ModesSection = ({ mode, setMode }) => {
  // =============================
  // GESTIONNAIRE DE CLIC
  // =============================
  const handleModeChange = useCallback((selectedMode) => {
    setMode(selectedMode);
  }, [setMode]);

  return (
    <div>
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
        Modes intelligents
      </h2>

      <div className="grid md:grid-cols-4 gap-4">
        {modes.map((m) => {
          const isActive = mode === m.name;

          return (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.name)}
              className={`
                p-6 rounded-xl border-2 transition-all duration-300
                hover:scale-105 hover:shadow-xl
                focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700
                ${
                  isActive
                    ? "bg-indigo-500 text-white border-indigo-600 shadow-lg"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                }
              `}
              aria-pressed={isActive}
              aria-label={`Mode ${m.name}${isActive ? ' (actif)' : ''}`}
            >
              <m.icon
                className={`
                  mx-auto mb-2 w-8 h-8
                  transition-transform duration-300
                  ${isActive ? 'scale-110' : ''}
                `}
                aria-hidden="true"
              />
              <span className="font-semibold">{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Indicateur du mode actuel pour les lecteurs d'écran */}
      <div className="sr-only" role="status" aria-live="polite">
        Mode actuel : {mode}
      </div>
    </div>
  );
};

ModesSection.propTypes = {
  mode: PropTypes.string.isRequired,
  setMode: PropTypes.any.isRequired,
};

export default ModesSection;
