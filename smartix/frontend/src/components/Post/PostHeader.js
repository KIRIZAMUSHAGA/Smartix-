import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { getAvatarUrl } from '../../config/apiClient';
import PropTypes from 'prop-types';

const PostHeader = ({ author, createdAt, onMenuClick }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <div className="flex items-start gap-3 mb-3">
      <Avatar className="w-12 h-12 ring-2 ring-blue-500/20">
        <AvatarImage 
          src={getAvatarUrl(author?.avatar)} 
          onError={(e) => { e.target.src = '/default-avatar.png'; }}
        />
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold">
          {author?.full_name?.[0] || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 dark:text-white">
          {author?.full_name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(createdAt)}
        </p>
      </div>
      {onMenuClick && (
        <button onClick={onMenuClick} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <MoreVertical className="w-5 h-5 text-gray-500" />
        </button>
      )}
    </div>
  );
};

PostHeader.propTypes = {
  author: PropTypes.any.isRequired,
  createdAt: PropTypes.any.isRequired,
  onMenuClick: PropTypes.func.isRequired,
};

export default PostHeader;
