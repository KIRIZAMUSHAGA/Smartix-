import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Film, Newspaper, Plus, Loader2, Palette, X, Image as ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarUrl } from '../utils/avatarUtils';
import { useTranslation } from 'react-i18next';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

const SmartComposer = ({ user, onSubmit }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBg, setSelectedBg] = useState(null);
  const [showBgSelector, setShowBgSelector] = useState(false);
  const composerRef = useRef(null);

  const backgrounds = [
    { id: 1, css: 'linear-gradient(to bottom right, #001a4d, #0033cc, #0066ff)', name: 'Cosmique Bleu' },
    { id: 2, css: 'linear-gradient(to bottom right, #9d4edd, #7209b7, #00d9ff)', name: 'Violet Turquoise' },
    { id: 5, css: 'linear-gradient(to bottom right, #ff6f00, #ff9800, #ffb74d)', name: 'Orange Dynamique' },
    { id: 6, css: 'linear-gradient(to bottom right, #ff1493, #ff69b4)', name: 'Rose Néon' },
    { id: 11, css: 'linear-gradient(to bottom right, #1e3a8a, #3b82f6)', name: 'Icônes Éducation' },
    { id: 21, css: 'linear-gradient(to bottom right, #00b4d8, #0077b6)', name: 'Smarti Robot', image: '/mascots/smarti_robot_mascot.png' },
    { id: 22, css: 'linear-gradient(to bottom right, #7b2cbf, #3c096c)', name: 'Luma Futuriste', image: '/mascots/luma_futuristic_character.png' },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (composerRef.current && !composerRef.current.contains(event.target) && !content.trim()) {
        setIsExpanded(false);
        setShowBgSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [content]);

  const handlePost = () => {
    if (!content.trim() && !selectedBg && !selectedBg?.image) return;
    
    const bgData = selectedBg ? {
      background_id: selectedBg.id,
      background_css: selectedBg.css,
      background_image: selectedBg.image || null
    } : null;

    onSubmit(content, bgData);
    setContent('');
    setIsExpanded(false);
    setSelectedBg(null);
    setShowBgSelector(false);
  };

  const handleAvatarClick = () => {
    navigate('/profile');
  };

  const handleAiClick = () => {
    setIsAiLoading(true);
    navigate('/ai-chat');
  };

  return (
    <div className="mb-3" ref={composerRef}>
      <div 
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${isExpanded ? 'shadow-xl' : 'shadow-sm'}`}
        style={{ maxWidth: '600px', margin: '0 auto' }}
      >
        <div className="p-3">
          <div className="flex items-start gap-3">
            <Avatar 
              className="w-10 h-10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/profile/${user?.id || user?._id}`)}
            >
              <AvatarImage src={getAvatarUrl(user?.avatar)} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-violet-500 text-white">
                {(user?.full_name || 'U')[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className={`relative rounded-2xl transition-all duration-300 ${selectedBg ? 'p-6 min-h-[150px] flex items-center justify-center' : 'bg-gray-100 dark:bg-gray-700'}`} style={selectedBg ? { background: selectedBg.css } : {}}>
                <Textarea
                  placeholder={t('community.composer.placeholder')}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onFocus={() => setIsExpanded(true)}
                  className={`w-full bg-transparent border-none focus:ring-0 resize-none transition-all ${selectedBg ? 'text-white text-center text-lg font-bold placeholder:text-white/60' : 'text-gray-900 dark:text-white text-sm'}`}
                  rows={isExpanded ? 3 : 1}
                />
                
                {selectedBg && (
                  <button 
                    onClick={() => setSelectedBg(null)}
                    className="absolute top-2 right-2 p-1 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="flex items-center justify-between mt-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowBgSelector(!showBgSelector)}
                      className={`p-2 rounded-full transition-colors ${showBgSelector ? 'bg-cyan-100 text-cyan-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'}`}
                      title="Arrière-plans"
                    >
                      <Palette className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => navigate('/create-post')}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded-full transition-colors"
                      title="Plus d'options (Images, etc.)"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={!content.trim() && !selectedBg}
                    className="px-6 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold rounded-full transition-all"
                  >
                    {t('community.post.publish')}
                  </button>
                </div>
              )}

              {showBgSelector && isExpanded && (
                <div className="flex gap-2 mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-x-auto animate-in zoom-in-95">
                  <button 
                    onClick={() => setSelectedBg(null)}
                    className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex-shrink-0 flex items-center justify-center text-gray-400 hover:border-cyan-500 hover:text-cyan-500 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBg(bg)}
                      className={`w-10 h-10 rounded-lg flex-shrink-0 transition-transform hover:scale-110 ${selectedBg?.id === bg.id ? 'ring-2 ring-cyan-500 ring-offset-2' : ''}`}
                      style={{ background: bg.css }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isExpanded && (
            <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3 flex items-center justify-around gap-2">
              <button
                onClick={() => { setIsAiLoading(true); navigate('/ai-chat'); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg transition-all border border-emerald-400/30"
              >
                <Brain className="w-4 h-4" />
                <span className="text-xs font-bold">IA</span>
              </button>
              <button
                onClick={() => navigate('/smartclips')}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-all border border-red-400/30"
              >
                <Film className="w-4 h-4" />
                <span className="text-xs font-bold">VEO</span>
              </button>
              <button
                onClick={() => navigate('/news')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg transition-all border border-amber-400/30"
              >
                <Newspaper className="w-4 h-4" />
                <span className="text-xs font-bold">NEWS</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

SmartComposer.propTypes = {
  user: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default SmartComposer;
