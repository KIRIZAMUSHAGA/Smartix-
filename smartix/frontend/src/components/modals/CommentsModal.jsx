import React from 'react';
import CommentSection from '../clips/CommentSection';

import PropTypes from 'prop-types';

function CommentsModal({ isOpen, onClose, clipId, comments, onAddComment }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 w-full max-w-lg h-96 rounded-t-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold">Commentaires</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <CommentSection clipId={clipId} comments={comments} onAddComment={onAddComment} />
      </div>
    </div>
  );
}

CommentsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  clipId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  comments: PropTypes.array,
  onAddComment: PropTypes.func
};

export default CommentsModal;
