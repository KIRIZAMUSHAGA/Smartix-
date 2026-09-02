import React from 'react';
import PropTypes from 'prop-types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { ShieldCheck, Info } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, description, confirmText = "Continuer", cancelText = "Annuler", variant = "default" }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#1e1e1e] border-white/10 rounded-[2rem] p-8 shadow-2xl">
        <DialogHeader className="items-center text-center space-y-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
            variant === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'
          }`}>
            {variant === 'warning' ? <ShieldCheck className="w-8 h-8" /> : <Info className="w-8 h-8" />}
          </div>
          <DialogTitle className="text-2xl font-black text-white tracking-tight leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400 font-medium text-base leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-white/5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold border-none"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 h-12 rounded-xl font-black shadow-lg transition-transform active:scale-95 ${
              variant === 'warning' 
                ? 'bg-amber-500 hover:bg-amber-600 text-black' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'danger', 'warning'])
};

export default ConfirmationModal;