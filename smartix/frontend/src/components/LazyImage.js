import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const LazyImage = ({ src, alt, className = '', onLoad }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageRef, setImageRef] = useState(null);

  useEffect(() => {
    let observer;

    if (imageRef && imageSrc === null) {
      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              onLoad?.();
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '50px' }
      );

      observer.observe(imageRef);
    }

    return () => observer?.disconnect();
  }, [imageRef, src, imageSrc, onLoad]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E'}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  className: PropTypes.string,
  onLoad: PropTypes.func
};

export default React.memo(LazyImage);
