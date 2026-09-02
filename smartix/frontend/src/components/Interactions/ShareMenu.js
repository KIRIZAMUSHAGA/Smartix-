import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Share2, Download, Copy, X } from 'lucide-react';
import axios from '../../config/axiosConfig';
import { toast } from 'sonner';

const ShareMenu = ({ postId, postContent, onClose, onShareComplete }) => {
  const [copied, setCopied] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showGroupSelect, setShowGroupSelect] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const shareOptions = [
    {
      id: 'feed',
      label: 'Republier sur mon fil',
      icon: '📝',
      description: 'Partager sur votre mur'
    },
    {
      id: 'group',
      label: 'Partager dans un groupe',
      icon: '👥',
      description: 'Sélectionner un groupe'
    },
    {
      id: 'story',
      label: 'Partager en story',
      icon: '📸',
      description: 'Ajouter à vos stories'
    },
    {
      id: 'message',
      label: 'Partager en message privé',
      icon: '💬',
      description: 'Envoyer à des amis'
    },
    {
      id: 'quote',
      label: 'Citer la publication',
      icon: '💭',
      description: 'Quote Tweet style'
    },
    {
      id: 'copy',
      label: 'Copier le lien',
      icon: '🔗',
      description: 'Copier URL'
    },
  ];

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await axios.get('/groups');
      setGroups(response.data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Impossible de charger les groupes');
    } finally {
      setLoadingGroups(false);
    }
  };

  const shareToFeed = async (message = '') => {
    setIsSharing(true);
    try {
      await axios.post('/posts', {
        content: message || `Partagé: ${postContent?.substring(0, 100)}...`,
        shared_post_id: postId,
        category: 'share'
      });
      toast.success('Publication partagée dans votre fil !');
      onShareComplete?.();
      onClose();
    } catch (error) {
      console.error('Error sharing to feed:', error);
      toast.error('Erreur lors du partage');
    } finally {
      setIsSharing(false);
    }
  };

  const shareToGroup = async (groupId) => {
    setIsSharing(true);
    try {
      await axios.post(`/groups/${groupId}/posts`, {
        content: `Partagé: ${postContent?.substring(0, 100)}...`,
        shared_post_id: postId
      });
      toast.success('Publication partagée dans le groupe !');
      onShareComplete?.();
      onClose();
    } catch (error) {
      console.error('Error sharing to group:', error);
      toast.error('Erreur lors du partage dans le groupe');
    } finally {
      setIsSharing(false);
    }
  };

  const shareAsStory = async () => {
    toast.info('Redirection vers la création de story...');
    window.location.href = `/create-story?shared_post=${postId}`;
  };

  const shareAsMessage = async () => {
    toast.info('Fonctionnalité en cours de développement');
  };

  const handleShareOption = async (option) => {
    setSelectedOption(option.id);

    switch (option.id) {
      case 'feed':
        break;
      case 'group':
        setShowGroupSelect(true);
        await fetchGroups();
        break;
      case 'story':
        await shareAsStory();
        break;
      case 'message':
        await shareAsMessage();
        break;
      case 'quote':
        setShareMessage(postContent || '');
        break;
      case 'copy':
        const postUrl = `${window.location.origin}/posts/${postId}`;
        navigator.clipboard.writeText(postUrl);
        setCopied(true);
        toast.success('Lien copié !');
        setTimeout(() => {
          setCopied(false);
          onClose();
        }, 1500);
        break;
      default:
        break;
    }
  };

  const handleConfirm = async () => {
    if (selectedOption === 'feed') {
      await shareToFeed(shareMessage);
    } else if (selectedOption === 'quote') {
      await shareToFeed(shareMessage);
    }
  };

  if (showGroupSelect) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowGroupSelect(false)} className="text-white hover:bg-white/20 rounded-full p-1">
                ←
              </button>
              <h2 className="text-xl font-bold text-white">Choisir un groupe</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="p-4 max-h-80 overflow-y-auto">
            {loadingGroups ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : groups.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun groupe trouvé</p>
            ) : (
              groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => shareToGroup(group.id)}
                  disabled={isSharing}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {group.name?.[0]?.toUpperCase() || 'G'}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900 dark:text-white">{group.name}</p>
                    <p className="text-xs text-gray-500">{group.members_count || 0} membres</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Partager cette publication</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          {shareOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleShareOption(option)}
              disabled={isSharing}
              className={`w-full p-4 rounded-xl transition-all transform hover:scale-105 active:scale-95 border-2 disabled:opacity-50 ${
                selectedOption === option.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl mt-1">{option.icon}</div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {option.description}
                  </p>
                </div>
                {selectedOption === option.id && (
                  <div className="text-blue-500 text-xl">✓</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {(selectedOption === 'quote' || selectedOption === 'feed') && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Ajouter un message (optionnel)
            </label>
            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Ajouter votre commentaire..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>
        )}

        {copied && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 bg-green-50 dark:bg-green-900/30">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              ✓ Lien copié dans le presse-papiers!
            </p>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
          >
            Annuler
          </button>
          {(selectedOption === 'feed' || selectedOption === 'quote') && (
            <button 
              onClick={handleConfirm}
              disabled={isSharing}
              className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {isSharing ? 'Partage...' : 'Partager'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

ShareMenu.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  postContent: PropTypes.string,
  onClose: PropTypes.func,
  onShareComplete: PropTypes.func
};

export default ShareMenu;
