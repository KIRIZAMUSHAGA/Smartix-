
import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

let modalId = 0;

export const ConfirmModal = () => {
  const [modals, setModals] = useState([]);

  const closeModal = useCallback((id) => {
    setModals(prev => prev.filter(m => m.id !== id));
  }, []);

  useEffect(() => {
    const handleOpen = (event) => {
      const id = ++modalId;
      const newModal = {
        id,
        title: event.detail.title || 'Confirmation',
        message: event.detail.message || 'Êtes-vous sûr ?',
        onConfirm: event.detail.onConfirm,
        onCancel: event.detail.onCancel,
        confirmText: event.detail.confirmText || 'Confirmer',
        cancelText: event.detail.cancelText || 'Annuler',
        type: event.detail.type || 'danger'
      };
      
      setModals(prev => [...prev, newModal]);
    };
    
    window.addEventListener('openConfirmModal', handleOpen);
    return () => window.removeEventListener('openConfirmModal', handleOpen);
  }, [closeModal]);

  if (modals.length === 0) return null;

  return (
    <>
      {modals.map((modal) => (
        <div 
          key={modal.id}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => closeModal(modal.id)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">{modal.title}</h3>
            <p className="text-gray-600 mb-6">{modal.message}</p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  modal.onCancel?.();
                  closeModal(modal.id);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
              >
                {modal.cancelText}
              </button>
              
              <button
                onClick={() => {
                  modal.onConfirm?.();
                  closeModal(modal.id);
                }}
                className={`px-4 py-2 rounded transition ${
                  modal.type === 'danger' 
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : modal.type === 'warning'
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
ConfirmModal.propTypes = {};
