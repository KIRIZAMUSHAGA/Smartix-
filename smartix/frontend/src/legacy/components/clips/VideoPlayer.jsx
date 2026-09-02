import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

function VideoPlayer({ src, autoPlay = false, muted = false, loop = false, onEnded, style, className }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted={muted}
      loop={loop}
      onEnded={onEnded}
      playsInline
      style={style}
      className={className}
      controls={!autoPlay}
    />
  );
}

VideoPlayer.propTypes = {
  src: PropTypes.string.isRequired,
  autoPlay: PropTypes.bool,
  muted: PropTypes.bool,
  loop: PropTypes.bool,
  onEnded: PropTypes.func,
  style: PropTypes.object,
  className: PropTypes.string
};

export default VideoPlayer;
