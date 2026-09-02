import React from 'react';
import './Skeleton.css';
import PropTypes from 'prop-types';

export const SkeletonCard = ({ className = '' }) => (
  <div className={`skeleton-card ${className}`}>
    <div className="skeleton-avatar"></div>
    <div className="skeleton-content">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-text"></div>
      <div className="skeleton-line skeleton-text" style={{ width: '80%' }}></div>
    </div>
  </div>
);

export const SkeletonPost = ({ className = '' }) => (
  <div className={`skeleton-post ${className}`}>
    <div className="skeleton-avatar"></div>
    <div className="skeleton-meta">
      <div className="skeleton-line skeleton-title" style={{ width: '40%' }}></div>
      <div className="skeleton-line skeleton-text" style={{ width: '30%' }}></div>
    </div>
    <div className="skeleton-content" style={{ marginTop: '12px' }}>
      <div className="skeleton-line skeleton-text"></div>
      <div className="skeleton-line skeleton-text"></div>
      <div className="skeleton-line skeleton-text" style={{ width: '70%' }}></div>
    </div>
    <div className="skeleton-image"></div>
    <div className="skeleton-actions">
      <div className="skeleton-line" style={{ width: '60px', height: '24px' }}></div>
      <div className="skeleton-line" style={{ width: '60px', height: '24px' }}></div>
      <div className="skeleton-line" style={{ width: '60px', height: '24px' }}></div>
    </div>
  </div>
);

export const SkeletonGroup = ({ className = '' }) => (
  <div className={`skeleton-group ${className}`}>
    <div className="skeleton-avatar"></div>
    <div className="skeleton-content">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-text"></div>
      <div className="skeleton-line skeleton-text" style={{ width: '50%' }}></div>
    </div>
  </div>
);

export const SkeletonUser = ({ className = '' }) => (
  <div className={`skeleton-user ${className}`}>
    <div className="skeleton-avatar"></div>
    <div className="skeleton-content">
      <div className="skeleton-line skeleton-title" style={{ width: '70%' }}></div>
      <div className="skeleton-line skeleton-text" style={{ width: '50%' }}></div>
    </div>
  </div>
);

export const SkeletonLoader = ({ type = 'post', count = 3, className = '' }) => {
  const skeletons = [];
  
  let Component = SkeletonPost;
  if (type === 'card') Component = SkeletonCard;
  if (type === 'group') Component = SkeletonGroup;
  if (type === 'user') Component = SkeletonUser;
  
  for (let i = 0; i < count; i++) {
    skeletons.push(<Component key={i} />);
  }
  
  return <div className={`skeleton-loader ${className}`}>{skeletons}</div>;
};
SkeletonCard.propTypes = {
  className: PropTypes.any,
};
SkeletonPost.propTypes = {
  className: PropTypes.any,
};
SkeletonGroup.propTypes = {
  className: PropTypes.any,
};
SkeletonUser.propTypes = {
  className: PropTypes.any,
};
SkeletonLoader.propTypes = {
  type: PropTypes.string,
  count: PropTypes.number,
  className: PropTypes.any,
};
