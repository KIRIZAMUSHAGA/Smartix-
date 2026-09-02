import React, { useState } from "react";
import { Mic, Paperclip, Zap, Sparkles } from "lucide-react";
import PropTypes from 'prop-types';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ChatPreview = ({ mode }) => {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // =============================
  // GESTIONNAIRE D'ENVOI
  // =============================
  const handleSend = () => {
    if (!message.trim()) return;

    // Simuler l'envoi (dans une vraie app, appel API)
    console.log("Message envoyé:", message);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessage("");
    }, 1500);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 transition-colors duration-300">
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Interface de Chat — Mode{" "}
        <span className="text-indigo-600 dark:text-indigo-400">{mode}</span>
      </h2>

      {/* Zone de chat */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 mb-6 min-h-[250px]">
        {/* Message utilisateur */}
        <div className="flex justify-end mb-4">
          <div className="bg-indigo-500 text-white rounded-xl px-4 py-2 max-w-[70%] break-words">
            Explique la partie double en comptabilité
          </div>
        </div>

        {/* Réponse IA */}
        <div className="flex justify-start">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 max-w-[70%] break-words">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles
                className="w-4 h-4 text-purple-500"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-purple-500">
                KIRIX
              </span>
            </div>

            Le principe de la partie double signifie que chaque opération
            affecte au moins deux comptes...
          </div>
        </div>

        {/* Indicateur de frappe */}
        {isTyping && (
          <div className="flex justify-start mt-4">
            <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
      </div>

      {/* Barre de saisie */}
      <div className="flex gap-2 items-center border border-gray-200 dark:border-gray-700 rounded-full p-2 bg-white dark:bg-gray-800">
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-indigo-500 transition-colors"
          aria-label="Joindre un fichier"
        >
          <Paperclip aria-hidden="true" />
        </button>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Posez votre question..."
          aria-label="Message à KIRIX"
          className="flex-1 outline-none px-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400"
        />

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-indigo-500 transition-colors"
          aria-label="Message vocal"
        >
          <Mic aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleSend}
          disabled={!message.trim()}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            transition-all duration-300
            ${
              message.trim()
                ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
            }
          `}
          aria-label="Envoyer le message"
        >
          <Zap className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

ChatPreview.propTypes = {
  mode: PropTypes.string.isRequired,
};

export default ChatPreview;
