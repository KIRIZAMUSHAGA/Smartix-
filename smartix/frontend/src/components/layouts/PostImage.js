import React from 'react';

import PropTypes from 'prop-types';

const PostImage = ({ post, isImageVisible, cardRef }) => {
  if (!post.image) return null;
  
  const imageUrl = post.image.startsWith('http') ? post.image : `/uploads/posts/${post.image}`;

  return (
    <div 
      ref={cardRef} 
      className="relative w-full aspect-[4/5]"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    />
  );
};

PostImage.propTypes = {
  post: PropTypes.shape({
    image: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  isImageVisible: PropTypes.bool,
  cardRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
};

export default PostImage;
