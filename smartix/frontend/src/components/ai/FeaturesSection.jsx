import React from "react";
import { MessageCircle, Mic, Database, Globe } from "lucide-react";
import PropTypes from 'prop-types';

// =============================
// DONNÉES AVEC IDS UNIQUES
// =============================
const features = [
  { id: "chat", icon: MessageCircle, text: "Chat intelligent" },
  { id: "voice", icon: Mic, text: "Dictée vocale" },
  { id: "documents", icon: Database, text: "Analyse de documents" },
  { id: "translation", icon: Globe, text: "Traduction automatique" },
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const FeaturesSection = () => {
  return (
    <div>
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
        Fonctionnalités avancées
      </h2>

      <div className="grid md:grid-cols-4 gap-6">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="
              bg-white dark:bg-gray-800 
              rounded-xl shadow-lg p-6 
              hover:shadow-xl hover:-translate-y-1 
              transition-all duration-300
              border border-gray-100 dark:border-gray-700
              flex flex-col items-center text-center
            "
            role="article"
            aria-label={`Fonctionnalité: ${feature.text}`}
          >
            <feature.icon
              className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mb-3"
              aria-hidden="true"
            />
            <span className="font-medium text-gray-900 dark:text-white">
              {feature.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

FeaturesSection.propTypes = {};

export default FeaturesSection;
