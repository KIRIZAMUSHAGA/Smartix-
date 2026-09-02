import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Upload, Camera } from 'lucide-react';
import axios from '../config/axiosConfig';
import { toast } from 'sonner';

const GroupEditModal = ({ isOpen, onClose, group, API, onGroupUpdated }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    avatar: group?.avatar || ''
  });
  const [previewImage, setPreviewImage] = useState(group?.avatar || '');

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
        setEditData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!editData.name.trim() || !editData.description.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsEditing(true);
    try {
      await axios.put(`/groups/${group.id}`, {
        name: editData.name,
        description: editData.description,
        avatar: editData.avatar
      });
      toast.success('Groupe mis à jour! ✨');
      onGroupUpdated();
      onClose();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-900 border border-cyan-300/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-gray-900 dark:text-white">
            Paramètres du groupe
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-cyan-400">
                <AvatarImage src={previewImage} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-violet-500 text-white text-2xl font-bold">
                  {editData.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full cursor-pointer hover:bg-cyan-600 transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">Cliquez sur la caméra pour changer la photo</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Nom du groupe
              </label>
              <Input
                value={editData.name}
                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nom du groupe"
                className="bg-gray-100 dark:bg-gray-800 border-cyan-300/30 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <Textarea
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description du groupe"
                className="bg-gray-100 dark:bg-gray-800 border-cyan-300/30 text-gray-900 dark:text-white resize-none"
                rows={4}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={onClose}
              className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isEditing}
              className="bg-gradient-to-r from-cyan-400 to-violet-500 text-white hover:shadow-lg disabled:opacity-50"
            >
              {isEditing ? 'Mise à jour...' : '💾 Sauvegarder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

GroupEditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  group: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    description: PropTypes.string,
    avatar: PropTypes.string
  }),
  API: PropTypes.string,
  onGroupUpdated: PropTypes.func
};

export default GroupEditModal;
