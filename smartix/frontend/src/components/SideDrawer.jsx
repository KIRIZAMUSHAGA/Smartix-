import React from 'react';
import PropTypes from 'prop-types';

function SideDrawer({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 w-80 h-full overflow-y-auto shadow-xl">
        {children}
      </div>
    </div>
  );
}

SideDrawer.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default SideDrawer;
