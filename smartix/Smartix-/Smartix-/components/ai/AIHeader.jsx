import React from "react";
import { Link } from "react-router-dom";
import { Brain, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import PropTypes from 'prop-types';

// =============================
// ANIMATION CSS PERSONNALISÉE
// =============================
const spinSlowStyle = `
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}
`;

const AIHeader = () => {
  const { user } = useAuth();

  return (
    <>
      <style>{spinSlowStyle}</style>
      <div className={`
        relative overflow-hidden py-20
        bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600
        dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800
      `}>
        {/* Effet de fond supplémentaire */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* Bouton retour - seulement si utilisateur connecté */}
          {user && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
              aria-label="Retour à l'accueil"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              Retour à l'accueil
            </Link>
          )}

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Brain className="w-10 h-10" aria-label="Icône cerveau" />
                </div>

                <div>
                  <h1 className="text-5xl font-bold tracking-tight">KIRIX</h1>
                  <p className="text-xl text-white/90 font-medium">
                    Votre Intelligence Multidisciplinaire
                  </p>
                </div>
              </div>

              <p className="text-lg max-w-3xl text-white/80 leading-relaxed">
                Une IA capable de répondre, expliquer, générer et résoudre dans
                plusieurs domaines : informatique, comptabilité, mathématiques,
                sciences, littérature, entrepreneuriat et analyse de données.
              </p>
            </div>

            <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles
                className="w-16 h-16 animate-spin-slow text-yellow-300"
                aria-label="Icône étincelles"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

AIHeader.propTypes = {};

export default AIHeader;
