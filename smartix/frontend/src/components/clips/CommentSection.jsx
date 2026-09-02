import React, { useState } from 'react';
import PropTypes from 'prop-types';

function CommentSection({ clipId, comments = [], onAddComment }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim() && onAddComment) {
      onAddComment(text.trim());
      setText('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {comments.map((c, i) => (
          <div key={i} className="flex gap-2">
            <span className="font-semibold text-sm">{c.user?.full_name || 'Utilisateur'}</span>
            <span className="text-sm">{c.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
          Envoyer
        </button>
      </form>
    </div>
  );
}

CommentSection.propTypes = {
  clipId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string,
      user: PropTypes.shape({
        full_name: PropTypes.string
      })
    })
  ),
  onAddComment: PropTypes.func
};

export default CommentSection;
