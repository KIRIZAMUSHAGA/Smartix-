// src/components/messages/MessageBubble.tsx
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Check, CheckCheck, Clock, Copy, RefreshCw, Save, X, Play, Pause, Mic, User } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatTime } from '../../utils/dateUtils';
import useAudioPlayer from '../../hooks/useAudioPlayer';


// =============================
// SOUS-COMPOSANT : STATUT DU MESSAGE
// =============================
const MessageStatusIcon = ({ status, isMe }) => {
  if (!isMe) return null;
  
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3 text-muted-foreground/50 animate-pulse" />;
    case 'sent':
      return <Check className="w-3 h-3 text-muted-foreground/70" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-muted-foreground/70" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 text-[#34b7f1]" />;
    default:
      return null;
  }
};

// =============================
// SOUS-COMPOSANT : MESSAGE VOCAL
// =============================
const VoiceMessageBubble = ({ message, isMe }) => {
  const audioId = message.id;
  const audioUrl = message.media_url || '';
  
  const {
    isPlaying,
    isLoading,
    progress,
    currentTime,
    duration,
    toggle,
    seekTo,
    formatTime: formatAudioTime
  } = useAudioPlayer(audioId, audioUrl, {
    autoPlay: false,
    onError: (err) => console.error('Audio error:', err)
  });

  const displayDuration = duration || message.duration_seconds || 0;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 min-w-[200px] py-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <button
        onClick={toggle}
        disabled={isLoading}
        className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
          isMe 
            ? 'bg-white/20 hover:bg-white/30 text-white' 
            : 'bg-primary/10 hover:bg-primary/20 text-primary'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={isPlaying ? 'Pause' : 'Lecture'}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>
      
      <div className="flex-1 flex flex-col gap-1">
        <div 
          className={`h-1.5 rounded-full relative overflow-hidden cursor-pointer ${isMe ? 'bg-white/20' : 'bg-muted'}`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seekTo(percent * displayDuration);
          }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-100 ${isMe ? 'bg-white' : 'bg-primary'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-medium ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
            {formatAudioTime(currentTime)} / {formatAudioTime(displayDuration)}
          </span>
          <Mic className={`w-3 h-3 ${isMe ? 'text-white/40' : 'text-muted-foreground/40'}`} />
        </div>
      </div>
    </div>
  );
};

// =============================
// SOUS-COMPOSANT : MESSAGE TEXTE
// =============================
const TextMessageBubble = ({ content }) => {
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
      {content}
    </p>
  );
};

// =============================
// SOUS-COMPOSANT : MESSAGE ÉPHÉMÈRE
// =============================
const EphemeralMessageBubble = ({ content, isMe }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs opacity-70 italic">
        <span>⌛ Message éphémère</span>
      </div>
      {!isRevealed ? (
        <button
          onClick={() => setIsRevealed(true)}
          className="text-sm font-medium blur-sm hover:blur-none transition-all cursor-pointer text-left"
        >
          ••••••••
        </button>
      ) : (
        <p className="text-sm font-medium">{content}</p>
      )}
    </div>
  );
};

// =============================
// SOUS-COMPOSANT : DOCUMENT
// =============================
const DocumentMessageBubble = ({ fileName, mediaUrl, isMe }) => {
  return (
    <a 
      href={mediaUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-primary/10'}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <span className="text-sm truncate max-w-[150px]">{fileName}</span>
    </a>
  );
};

// =============================
// SOUS-COMPOSANT : INDICATEUR DE LECTURE GROUPE
// =============================
const ReadReceiptIndicator = ({ readCount, seenByAll, isGroup, totalParticipants }) => {
  if (!isGroup) return null;
  if (seenByAll) {
    return <span className="text-[10px] text-[#34b7f1]">Vu par tous</span>;
  }
  if (readCount && readCount > 0) {
    return <span className="text-[10px] text-muted-foreground/60">Vu par {readCount} personne{readCount > 1 ? 's' : ''}</span>;
  }
  return null;
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const MessageBubble = ({
  message,
  isMe,
  partner,
  onReaction,
  onRetry,
  currentUserReaction,
  groupedReactions = [],
  isAnimated = false,
  // Props pour les accusés de lecture
  status = message.status || 'sent',
  isRead = false,
  isDelivered = false,
  readCount = 0,
  readers = [],
  seenByAll = false,
  isGroup = false
}) => {
  const [copied, setCopied] = useState(false);

  const isVoice = message.type === 'voice';
  const isEphemeral = message.type === 'ephemeral';
  const isDocument = message.type === 'document';
  
  const timestamp = message.created_at
    ? formatTime(message.created_at)
    : '';

  // =============================
  // GESTIONNAIRES
  // =============================
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Message copié !');
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(message);
    }
  };

  // =============================
  // RENDU DU CONTENU SELON LE TYPE
  // =============================
  const renderContent = () => {
    if (isVoice && message.media_url) {
      return <VoiceMessageBubble message={message} isMe={isMe} />;
    }
    
    if (isEphemeral) {
      return <EphemeralMessageBubble content={message.content} isMe={isMe} />;
    }
    
    if (isDocument && message.media_url) {
      return <DocumentMessageBubble fileName={message.file_name || 'Fichier'} mediaUrl={message.media_url} isMe={isMe} />;
    }
    
    return <TextMessageBubble content={message.content} />;
  };

  // Statut effectif (priorité aux props)
  const effectiveStatus = status || (isRead ? 'read' : isDelivered ? 'delivered' : 'sent');

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200 group`}>
      {/* Avatar pour les messages reçus */}
      {!isMe && partner && (
        <div className="w-7 h-7 mr-2 mt-auto mb-1">
          <Avatar className="w-7 h-7">
            <AvatarImage src={partner.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary-light text-white text-[10px] font-bold">
              {partner.full_name?.charAt(0) || partner.username?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      <div className={`max-w-[75%] relative ${message.optimistic ? 'opacity-70' : ''} ${isAnimated ? 'animate-pulse' : ''}`}>
        {/* Bulle de message */}
        <div className={`p-3 shadow-sm relative ${
          isMe 
            ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white rounded-2xl rounded-br-md' 
            : 'bg-white dark:bg-[#202c33] text-foreground rounded-2xl rounded-bl-md border border-black/5 dark:border-white/5'
        }`}>
          {renderContent()}
          
          {/* Réactions */}
          {groupedReactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {groupedReactions.map(({ emoji, count, users }) => (
                <button
                  key={emoji}
                  onClick={() => onReaction?.(message.id, emoji)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                    currentUserReaction === emoji
                      ? (isMe ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary')
                      : (isMe ? 'bg-black/20 hover:bg-black/30' : 'bg-black/5 hover:bg-black/10')
                  }`}
                  aria-label={`Réaction ${emoji} (${count})`}
                  title={`${users.length} personne${users.length > 1 ? 's' : ''}`}
                >
                  {emoji} {count > 1 && <span className="ml-0.5">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer : heure + statut + lecture groupe */}
        <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
          <span className="text-[10px] text-muted-foreground/60">
            {timestamp}
          </span>
          
          {/* Statut du message (pour mes messages) */}
          {isMe && <MessageStatusIcon status={effectiveStatus} isMe={isMe} />}
          
          {/* Indicateur de lecture pour les groupes */}
          {!isMe && isGroup && (
            <ReadReceiptIndicator 
              readCount={readCount} 
              seenByAll={seenByAll} 
              isGroup={isGroup} 
            />
          )}
          
          {/* Bouton réessayer en cas d'erreur */}
          {isMe && status === 'error' && onRetry && (
            <button 
              onClick={handleRetry}
              className="text-[10px] text-red-500 font-medium hover:underline ml-1"
            >
              Réessayer
            </button>
          )}
        </div>
        
        {/* Actions flottantes (copier, etc.) */}
        <div className={`absolute top-2 ${isMe ? '-left-12' : '-right-12'} flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
          <button
            onClick={handleCopy}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Copier le message"
            title="Copier"
          >
            {copied ? (
              <Check size={14} className="text-green-600 dark:text-green-400" />
            ) : (
              <Copy size={14} className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

MessageStatusIcon.propTypes = {
  status: PropTypes.oneOf(['sending', 'sent', 'delivered', 'read', 'error']).isRequired,
  isMe: PropTypes.bool
};

VoiceMessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    media_url: PropTypes.string,
    duration_seconds: PropTypes.number
  }).isRequired,
  isMe: PropTypes.bool
};

TextMessageBubble.propTypes = {
  content: PropTypes.string
};

EphemeralMessageBubble.propTypes = {
  content: PropTypes.string,
  isMe: PropTypes.bool
};

DocumentMessageBubble.propTypes = {
  fileName: PropTypes.string.isRequired,
  mediaUrl: PropTypes.string.isRequired,
  isMe: PropTypes.bool
};

ReadReceiptIndicator.propTypes = {
  readCount: PropTypes.number,
  seenByAll: PropTypes.bool,
  isGroup: PropTypes.bool,
  totalParticipants: PropTypes.number
};

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.string,
    content: PropTypes.string,
    media_url: PropTypes.string,
    file_name: PropTypes.string,
    created_at: PropTypes.string,
    status: PropTypes.string,
    optimistic: PropTypes.bool
  }).isRequired,
  isMe: PropTypes.bool,
  partner: PropTypes.shape({
    avatar: PropTypes.string,
    full_name: PropTypes.string,
    username: PropTypes.string
  }),
  onReaction: PropTypes.func,
  onRetry: PropTypes.func,
  currentUserReaction: PropTypes.string,
  groupedReactions: PropTypes.arrayOf(
    PropTypes.shape({
      emoji: PropTypes.string,
      count: PropTypes.number,
      users: PropTypes.array
    })
  ),
  isAnimated: PropTypes.bool,
  status: PropTypes.oneOf(['sending', 'sent', 'delivered', 'read', 'error']),
  isRead: PropTypes.bool,
  isDelivered: PropTypes.bool,
  readCount: PropTypes.number,
  readers: PropTypes.array,
  seenByAll: PropTypes.bool,
  isGroup: PropTypes.bool
};

export default MessageBubble;
