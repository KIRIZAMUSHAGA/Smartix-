import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Video, Paperclip, Calendar, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarUrl, handleAvatarError } from '../utils/avatarUtils';

export const CreatePostBox = ({ user, onSubmit, loading }) => {
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await onSubmit(content, null, 'regular');
    setContent('');
  };

  return (
    <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-2xl overflow-hidden hover:bg-white/10 transition-all p-6">
      <div className="flex gap-4 items-start mb-6">
        <Avatar className="w-12 h-12 ring-2 ring-white/5">
          <AvatarImage 
            src={getAvatarUrl(user?.avatar)} 
            onError={handleAvatarError}
          />
          <AvatarFallback className="bg-[#ff6b35] text-white font-black">
            {user?.full_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Partage ton inspiration..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex gap-1">
          {[ImageIcon, Video, Paperclip].map((Icon, i) => (
            <button key={i} className="p-3 hover:bg-white/5 rounded-xl transition-all text-white/30 hover:text-[#ff6b35]">
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || loading}
          className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl shadow-[#ff6b35]/20 disabled:opacity-30 transition-all active:scale-95"
        >
          Publier
        </button>
      </div>
    </div>
  );
};

CreatePostBox.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    full_name: PropTypes.string,
    avatar: PropTypes.string
  }),
  onSubmit: PropTypes.func,
  loading: PropTypes.bool
};