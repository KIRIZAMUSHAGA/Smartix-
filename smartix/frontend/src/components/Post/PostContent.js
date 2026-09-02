import React from 'react';
import FormattedContent from '../FormattedContent';
import PostHeader from './PostHeader';
import PropTypes from 'prop-types';

const PostContent = ({ post }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-b-8 border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <PostHeader author={post.user} createdAt={post.created_at} />

      {/* Contenu */}
      {post.background_id ? (
        <div className="mb-3">
          <div 
            className={`w-full ${post.background_css || 'bg-gradient-to-br from-cyan-400 to-violet-600'} rounded-lg overflow-hidden flex items-center justify-center min-h-64 relative`}
          >
            {post.background_image && (
              <div className="absolute inset-0 w-full h-full">
                <img 
                  src={post.background_image} 
                  alt="Background"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="relative z-10 px-8 py-12 flex items-center justify-center min-h-64">
              <FormattedContent 
                content={post.content} 
                className="text-white text-center text-xl font-semibold leading-relaxed drop-shadow-lg whitespace-pre-wrap break-words"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <FormattedContent 
            content={post.content} 
            className="text-gray-900 dark:text-white whitespace-pre-wrap break-words"
          />
        </div>
      )}

      {/* Image */}
      {post.image && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <img
            src={post.image}
            alt="Publication"
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      )}

      {/* Statistiques */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {post.reactions_count || 0} réaction{(post.reactions_count || 0) > 1 ? 's' : ''}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {post.comments_count || 0} commentaire{(post.comments_count || 0) > 1 ? 's' : ''}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {post.shares_count || 0} partage{(post.shares_count || 0) > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

PostContent.propTypes = {
  post: PropTypes.object.isRequired,
};

export default PostContent;
