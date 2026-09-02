import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "../ui/button";

// =============================
// PROPS
// =============================
interface CTASectionProps {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  variant?: "default" | "compact";
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CTASection = ({
  title = "Prêt à utiliser KIRIX ?",
  description = "Posez votre première question et découvrez la puissance de l'IA.",
  buttonText = "Commencer à discuter",
  buttonLink = "/ai-chat",
  variant = "default"
}: CTASectionProps) => {
  const isCompact = variant === "compact";

  return (
    <div
      className={`
        bg-gradient-to-r from-indigo-600 to-purple-600
        dark:from-indigo-800 dark:to-purple-800
        text-white rounded-3xl
        ${isCompact ? 'p-8' : 'p-12'}
        text-center
        relative overflow-hidden
        transition-all duration-300
        hover:shadow-2xl
      `}
      role="region"
      aria-label="Appel à l'action"
    >
      {/* Effet de fond décoratif */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-300 rounded-full blur-3xl"></div>
      </div>

      {/* Contenu */}
      <div className="relative z-10">
        <h2 className={`
          font-bold mb-4
          ${isCompact ? 'text-3xl' : 'text-4xl'}
        `}>
          {title}
        </h2>

        <p className={`
          mb-6
          ${isCompact ? 'text-base' : 'text-lg'}
          text-white/90
        `}>
          {description}
        </p>

        <Link
          to={buttonLink}
          aria-label={`${buttonText} - ouvrir l'assistant IA`}
        >
          <Button
            size={isCompact ? "default" : "lg"}
            className={`
              bg-white text-indigo-600
              hover:bg-gray-100 hover:scale-105
              dark:bg-gray-100 dark:text-indigo-700
              dark:hover:bg-white
              transition-all duration-300
              shadow-lg hover:shadow-xl
              group
            `}
            aria-label={buttonText}
          >
            <MessageCircle
              className="mr-2 group-hover:rotate-12 transition-transform"
              aria-hidden="true"
              size={isCompact ? 18 : 20}
            />
            {buttonText}
            <Sparkles
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
              size={isCompact ? 14 : 16}
            />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CTASection;
