import React from 'react';
import PropTypes from 'prop-types';

export const Progress = ({ value = 0, max = 100, className = '', ...props }) => {
  const percentage = (value / max) * 100;

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-secondary/20 ${className}`}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-all duration-300"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
};
Progress.propTypes = {
  value: PropTypes.string,
  max: PropTypes.number,
  className: PropTypes.any,
  props: PropTypes.any.isRequired,
};
