import React, { useState, useEffect } from 'react';
import axios from '../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import { API } from '../config/api';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

export const InvitationsPanel = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});
  const [accepted, setAccepted] = useState({});

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/groups/invitations/received`);
      setInvitations(res.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (inv) => {
    setResponding(prev => ({ ...prev, [inv.id]: true }));
    try {
      const res = await axios.post(
        `/groups/${inv.group_id}/invitations/${inv.id}/accept`
      );
      setAccepted(prev => ({ ...prev, [inv.id]: true }));
      toast.success('Invitation acceptée! ✅');
      
      setTimeout(() => {
        setInvitations(invitations.filter(i => i.id !== inv.id));
        setAccepted(prev => {
          const newState = { ...prev };
          delete newState[inv.id];
          return newState;
        });
      }, 1500);
    } catch (error) {
      toast.error('Erreur lors de l\'acceptation');
    } finally {
      setResponding(prev => ({ ...prev, [inv.id]: false }));
    }
  };

  const handleReject = async (inv) => {
    setResponding(prev => ({ ...prev, [inv.id]: true }));
    try {
      await axios.post(
        `/groups/${inv.group_id}/invitations/${inv.id}/reject`
      );
      toast.success('Invitation refusée');
      setInvitations(invitations.filter(i => i.id !== inv.id));
    } catch (error) {
      toast.error('Erreur lors du refus');
    } finally {
      setResponding(prev => ({ ...prev, [inv.id]: false }));
    }
  };

  const handleViewGroup = (groupId) => {
    navigate(`/groups/${groupId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#00B894]" />
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Pas d'invitations en attente
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map(inv => (
        <Card
          key={inv.id}
          className={`p-4 bg-white dark:bg-gray-800 rounded-2xl transition-all border-l-4 ${
            accepted[inv.id]
              ? 'border-[#00B894] bg-green-50/50 dark:bg-green-900/20'
              : 'border-[#0984E3]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Invitation Info */}
            <div className="flex gap-3 flex-1">
              <Avatar className="w-12 h-12 flex-shrink-0">
                <AvatarImage src={inv.inviter?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white font-bold">
                  {inv.inviter?.full_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {inv.inviter?.full_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  t'invite à rejoindre <strong>{inv.group?.name || 'le groupe'}</strong>
                </p>
                {inv.group?.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                    {inv.group.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              {accepted[inv.id] ? (
                <Button
                  onClick={() => handleViewGroup(inv.group_id)}
                  className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Voir le groupe
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => handleAccept(inv)}
                    disabled={responding[inv.id]}
                    className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white"
                  >
                    {responding[inv.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '✅ Accepter'
                    )}
                  </Button>
                  <Button
                    onClick={() => handleReject(inv)}
                    disabled={responding[inv.id]}
                    variant="outline"
                    className="text-red-500 border-red-200 dark:border-red-800"
                  >
                    {responding[inv.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '❌'
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
InvitationsPanel.propTypes = {};
