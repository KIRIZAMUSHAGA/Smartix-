import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from 'next-themes'; // Si tu utilises next-themes

// Composants
import AIHeader from "../components/ai/AIHeader";
import ChatPreview from "../components/ai/ChatPreview";
import CapabilitiesSection from "../components/ai/CapabilitiesSection";
import ModesSection from "../components/ai/ModesSection";
import FeaturesSection from "../components/ai/FeaturesSection";
import DocumentCenter from "../components/ai/DocumentCenter";
import CTASection from "../components/ai/CTASection";
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MODES = {
  STUDENT: "Étudiant",
  TEACHER: "Enseignant",
  PARENT: "Parent"
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const AIAssistant = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme(); // Pour dark mode

  const [mode, setMode] = useState(MODES.STUDENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =============================
  // VÉRIFICATION AUTH
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      setLoading(false);
    }
  }, [user, navigate]);

  // =============================
  // HANDLER POUR CHANGER DE MODE
  // =============================
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
  }, []);

  // =============================
  // MÉMOÏSATION DES SECTIONS (optionnel)
  // =============================
  const sections = useMemo(() => ({
    capabilities: <CapabilitiesSection />,
    modes: <ModesSection mode={mode} setMode={handleModeChange} />,
    features: <FeaturesSection />,
    documents: <DocumentCenter />,
    cta: <CTASection />
  }), [mode, handleModeChange]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00C4B3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground/60 font-medium">Chargement de l'assistant IA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-500 mb-4">Une erreur est survenue</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#00C4B3] text-white rounded-lg hover:bg-[#00A594]"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className={`
        min-h-screen transition-colors duration-300
        bg-gradient-to-br from-[#E8F5F2] via-white to-[#E9F0FF]
        dark:from-gray-900 dark:via-gray-800 dark:to-gray-900
      `}
      role="main"
      aria-label="Assistant IA"
    >
      <AIHeader />

      <div className="max-w-7xl mx-auto px-4 py-16 space-y-16">
        <ChatPreview mode={mode} />

        {sections.capabilities}
        {sections.modes}
        {sections.features}
        {sections.documents}
        {sections.cta}
      </div>
    </div>
  );
};

AIAssistant.propTypes = {};

export default AIAssistant;
