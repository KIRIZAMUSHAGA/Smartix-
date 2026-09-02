import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from '../config/axiosConfig';
import { API } from '../config/api';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const InviteFriendsModal = ({ groupId, groupName, isOpen, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/friends`);
      setFriends(res.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des amis:', error);
      toast.error('Impossible de charger les amis');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (friendId) => {
    setInviting(prev => ({ ...prev, [friendId]: true }));
    try {
      await axios.post(`/groups/${groupId}/invite`, {
        invited_user_id: friendId
      });
      toast.success('Invitation envoyée! 🎉');
      setFriends(friends.filter(f => f.id !== friendId));
    } catch (error) {
      const errMsg = error.response?.data?.detail || 'Erreur lors de l\'invitation';
      toast.error(errMsg);
    } finally {
      setInviting(prev => ({ ...prev, [friendId]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Inviter des amis</h2>
            <p className="text-white/90 text-sm">au groupe "{groupName}"</p>
          </div>
          <button 
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#00B894]" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Pas d'amis disponibles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map(friend => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white font-bold">
                        {friend.full_name?.[0]}{friend.full_name?.split(' ')[1]?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{friend.full_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">@{friend.username}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleInvite(friend.id)}
                    disabled={inviting[friend.id]}
                    className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white"
                  >
                    {inviting[friend.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '👤 Inviter'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="text-gray-700 dark:text-gray-300"
          >
            Fermer
          </Button>
        </div>
      </Card>
    </div>
  );
};

InviteFriendsModal.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  groupName: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
