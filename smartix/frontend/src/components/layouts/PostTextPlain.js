import React from 'react';

import PropTypes from 'prop-types';

const PostTextPlain = ({ content, textStyle }) => {
  return (
    <div className="px-6 py-8 flex-grow flex items-center justify-center text-center bg-white relative z-10">
      <p className={`text-xl sm:text-2xl font-black leading-tight text-gray-800`}>
        {content}
      </p>
    </div>
  );
};

PostTextPlain.propTypes = {
  content: PropTypes.string.isRequired,
  textStyle: PropTypes.object
};

export default PostTextPlain;
