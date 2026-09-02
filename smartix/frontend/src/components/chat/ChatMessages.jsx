import { useEffect, useRef, useCallback } from 'react';

import MessageBubble from '../messages/MessageBubble';
import { Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ChatMessages = ({
  messages,
  onEdit,
  onRegenerate,
  loading = false,
  error = null
}) => {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // =============================
  // AUTO-SCROLL AUX NOUVEAUX MESSAGES
  // =============================
  useEffect(() => {
    if (!messages.length) return;

    // Ne scroller que si l'utilisateur n'a pas scrollé vers le haut
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // =============================
  // RENDU DES MESSAGES
  // =============================
  const renderMessages = useCallback(() => {
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-red-500 bg-red-50 dark:bg-red-900/20 p-6 rounded-xl">
            <p className="font-medium">Erreur de chargement</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </div>
      );
    }

    if (messages.length === 0 && !loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">💬 Aucun message</p>
            <p className="text-sm">Commencez la conversation !</p>
          </div>
        </div>
      );
    }

    return (
      <>
        {messages.map((msg, index) => (
          <MessageBubble
            key={msg.id || `msg-${index}`}
            message={msg}
            index={index}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
          />
        ))}

        {loading && (
          <div className="flex justify-start my-4">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-gray-500 dark:text-gray-400 animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  L'IA réfléchit...
                </span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }, [messages, loading, error, onEdit, onRegenerate]);

  return (
    <div
      ref={containerRef}
      className="
        flex-1 overflow-y-auto p-6
        bg-gray-50 dark:bg-gray-900
        scroll-smooth
      "
      role="log"
      aria-live="polite"
      aria-label="Messages de la conversation"
    >
      {renderMessages()}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
};

ChatMessages.propTypes = {
  messages: PropTypes.array.isRequired,
  onEdit: PropTypes.func,
  onRegenerate: PropTypes.func,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

export default ChatMessages;
