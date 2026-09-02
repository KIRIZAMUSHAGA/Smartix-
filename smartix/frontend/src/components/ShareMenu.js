import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../config/axiosConfig';
import { API } from '../config/api';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { X, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

export const ShareMenu = ({ post, groupId, groupName, isOpen, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showGroupSelect, setShowGroupSelect] = useState(false);
  const [groups, setGroups] = useState([]);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`/groups`);
      setGroups(res.data?.filter(g => g.id !== groupId) || []);
      setShowGroupSelect(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des groupes');
    }
  };

  const shareInCurrentGroup = async () => {
    setLoading(true);
    try {
      await axios.post(`/groups/${groupId}/posts/${post.id}/share`);
      toast.success('Publication partagée dans le groupe! ✨');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Erreur lors du partage');
    } finally {
      setLoading(false);
    }
  };

  const shareInOtherGroup = async (targetGroupId) => {
    setLoading(true);
    try {
      await axios.post(`/groups/${groupId}/posts/${post.id}/share`, {
        target_group_id: targetGroupId
      });
      toast.success('Publication partagée! ✨');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Erreur lors du partage');
    } finally {
      setLoading(false);
    }
  };

  const shareInFeed = async () => {
    setLoading(true);
    try {
      await axios.post(`/groups/${groupId}/posts/${post.id}/share`, {
        is_feed_share: true
      });
      toast.success('Publication partagée dans ton fil! ✨');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Erreur lors du partage');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Partager la publication
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {!showGroupSelect ? (
            <>
              <Button
                onClick={shareInCurrentGroup}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white justify-start"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '📌'}
                Republier dans "{groupName}"
              </Button>

              <Button
                onClick={fetchGroups}
                disabled={loading}
                variant="outline"
                className="w-full justify-start"
              >
                📂 Partager dans un autre groupe
              </Button>

              <Button
                onClick={shareInFeed}
                disabled={loading}
                variant="outline"
                className="w-full justify-start"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🌐'}
                Partager dans mon fil d'actualité
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setShowGroupSelect(false)}
                variant="outline"
                className="w-full justify-start mb-4"
              >
                ← Retour
              </Button>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucun autre groupe trouvé</p>
                ) : (
                  groups.map(group => (
                    <Button
                      key={group.id}
                      onClick={() => shareInOtherGroup(group.id)}
                      disabled={loading}
                      variant="outline"
                      className="w-full justify-start text-left"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2 flex-shrink-0" /> : '📂'}
                      <span className="truncate">{group.name}</span>
                    </Button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
ShareMenu.propTypes = {
  post: PropTypes.object.isRequired,
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  groupName: PropTypes.any.isRequired,
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
