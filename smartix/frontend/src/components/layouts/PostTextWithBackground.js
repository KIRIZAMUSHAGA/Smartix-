import React from 'react';

import PropTypes from 'prop-types';

const PostTextWithBackground = ({ content, backgroundStyle }) => {
  return (
    <div className="relative z-10 px-6 py-12 flex-grow flex items-center justify-center text-center">
      <p className="text-xl sm:text-2xl font-black leading-tight drop-shadow-lg" style={{ color: 'white' }}>
        {content}
      </p>
    </div>
  );
};

PostTextWithBackground.propTypes = {
  content: PropTypes.string.isRequired,
  backgroundStyle: PropTypes.object
};

export default PostTextWithBackground;
