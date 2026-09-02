
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import PropTypes from 'prop-types';

const PostNavigationButton = ({ postId, commentsCount = 0 }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/post/${postId}/comments`);
  };

  return (
    <button
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-all hover:scale-105 active:scale-95 rounded-lg"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="text-sm">
        {commentsCount > 0 ? `Voir les commentaires (${commentsCount})` : 'Commenter'}
      </span>
    </button>
  );
};

PostNavigationButton.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  commentsCount: PropTypes.any,
};

export default PostNavigationButton;
