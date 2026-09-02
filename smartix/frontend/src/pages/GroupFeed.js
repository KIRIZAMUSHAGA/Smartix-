import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SkeletonGroupFeed, SkeletonFeed, useSkeletonLoader } from '../components/SkeletonComplete';
import BottomNav from '../components/BottomNav';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { InviteFriendsModal } from '../components/InviteFriendsModal';
import { ShareMenu } from '../components/ShareMenu';
import GroupEditModal from '../components/GroupEditModal';
import PublicationWithReactions from '../components/PublicationWithReactions';
import { ArrowLeft, Users, Share2, MessageCircle, Heart, Zap, Flame, Eye, Gift, FileText, Users2, Info, Clock, MapPin, Settings } from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { API_BASE_URL } from '../config/apiClient'; // ✅ Importer l'URL de base
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const POSTS_PER_PAGE = 10;
const MEMBERS_PER_PAGE = 20;
const tabs = [
  { id: 'feed', label: 'Fil d\'actu', icon: '📰' },
  { id: 'media', label: 'Médias', icon: '📸' },
  { id: 'members', label: 'Membres', icon: '👥' },
  { id: 'about', label: 'À propos', icon: 'ℹ️' },
];

// =============================
// SOUS-COMPOSANT: HEADER DU GROUPE
// =============================
const GroupHeader = ({ group, creator, isAdmin, onNavigate, onInvite, onMedia, onShare, onEdit }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-br from-[#00B894] via-[#00D9FF] to-[#0984E3] text-white px-4 py-10 relative overflow-hidden backdrop-blur-xl">
      {/* Glow effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 mb-4 backdrop-blur-sm"
          onClick={() => navigate('/groups')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>

        {/* Avatar avec halo */}
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="absolute inset-0 w-20 h-20 bg-white/20 rounded-full blur-lg"></div>
            <Avatar className="w-20 h-20 relative border-4 border-white shadow-lg">
              <AvatarImage src={group?.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white text-2xl font-bold">
                {group?.name?.[0] || 'G'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 pt-2">
            <h1 className="text-3xl font-bold mb-2">{group?.name}</h1>
            <p className="text-white/90 mb-3">{group?.description}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{group?.members?.length || 0} membres</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{group?.visibility || 'Public'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="flex gap-2 mt-6 flex-wrap">
          <Button 
            onClick={() => navigate(`/groups/${group?.id}/create-post`)}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
          >
            📝 Poster
          </Button>
          <Button 
            onClick={onInvite}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
          >
            👥 Inviter
          </Button>
          <Button 
            onClick={onMedia}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
          >
            🎨 Médias
          </Button>
          <Button 
            onClick={onShare}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
          >
            📱 Partager
          </Button>
          {isAdmin && (
            <Button 
              onClick={onEdit}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Paramètres
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================
// SOUS-COMPOSANT: À PROPOS
// =============================
const AboutTab = ({ group, creator }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    return name[0]?.toUpperCase() || '?';
  };

  return (
    <Card className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">À propos</h3>
      <div className="space-y-4 text-gray-700 dark:text-gray-300">
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Créé par</p>
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={creator?.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white font-bold">
                {getInitials(creator?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{creator?.full_name || 'Utilisateur'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">@{creator?.username || 'admin'}</p>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p><strong>Description:</strong> {group?.description || 'Aucune description'}</p>
          <p className="mt-2"><strong>Créé le:</strong> {group?.created_at ? new Date(group.created_at).toLocaleDateString('fr-FR') : 'Date inconnue'}</p>
          <p className="mt-2"><strong>Membres:</strong> {group?.members?.length || 0}</p>
        </div>
      </div>
    </Card>
  );
};

// =============================
// SOUS-COMPOSANT: LISTE DES POSTS
// =============================
const PostsFeed = ({ posts, loadingMore, hasMore, onLoadMore, onLike, onSuperLike, onComment, onShare, likedPosts, user }) => {
  if (posts.length === 0) {
    return (
      <Card className="p-12 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
        <div className="space-y-4">
          <div className="text-4xl">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bienvenue dans le groupe!</h3>
          <p className="text-gray-600 dark:text-gray-400">Commence par partager un moment ou une idée.</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">👉 Les autres membres verront ton post ici</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {posts.map(post => (
          <PublicationWithReactions
            key={post.id}
            post={{
              id: post.id,
              user_name: post.user?.full_name,
              user_avatar: post.user?.avatar,
              badge: '👥 Groupe',
              content: post.content,
              image: post.image,
              video: post.video,
              created_at: post.created_at,
              reactions_count: post.reactions_count || post.likes?.length || 0,
              comments_count: post.comments_count || post.comments?.length || 0,
              shares_count: post.shares_count || post.shares?.length || 0,
            }}
            user={user}
            onLike={() => onLike(post.id)}
            onSuperLike={() => onSuperLike(post.id)}
            onComment={() => onComment(post.id)}
            onShare={() => onShare(post)}
            onMenuClick={() => {}}
            isLiked={likedPosts[post.id] || false}
          />
        ))}
      </div>

      {/* Loader pour pagination */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            onClick={onLoadMore}
            disabled={loadingMore}
            variant="outline"
            className="px-6"
          >
            {loadingMore ? 'Chargement...' : 'Charger plus'}
          </Button>
        </div>
      )}
    </>
  );
};

// =============================
// SOUS-COMPOSANT: LISTE DES MEMBRES
// =============================
const MembersList = ({ members, loading, hasMore, onLoadMore, adminId }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    return name[0]?.toUpperCase() || '?';
  };

  if (members.length === 0 && !loading) {
    return <p className="text-gray-500 text-center py-8">Aucun membre</p>;
  }

  return (
    <>
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="w-14 h-14 flex-shrink-0">
              <AvatarImage src={member.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white font-bold text-lg">
                {getInitials(member.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{member.full_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">@{member.username}</p>
            </div>
          </div>
          {member.id === adminId && (
            <span className="px-3 py-1 bg-gradient-to-r from-[#00B894]/20 to-[#0984E3]/20 text-xs font-semibold text-[#00B894] rounded-full">
              👑 Admin
            </span>
          )}
        </div>
      ))}

      {/* Loader pour pagination membres */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            onClick={onLoadMore}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? 'Chargement...' : 'Charger plus'}
          </Button>
        </div>
      )}
    </>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const GroupFeed = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getGroupCache, updateGroupCache } = useGlobalCache();

  // États
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [likedPosts, setLikedPosts] = useState({});
  const [activeTab, setActiveTab] = useState('feed');
  const [reactions, setReactions] = useState({});
  const [creator, setCreator] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [membersPage, setMembersPage] = useState(1);
  const [hasMoreMembers, setHasMoreMembers] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState(null);

  // Dérivés
  const isAdmin = useMemo(() => group?.admin_id === user?.id, [group, user]);

  // =============================
  // CHARGEMENT DU GROUPE
  // =============================
  const fetchGroupData = useCallback(async (reset = false) => {
    if (!groupId) return;

    try {
      if (reset) {
        setLoading(true);
        setPage(1);
        setPosts([]);
      }

      // Vérifier le cache pour le groupe
      const cachedGroup = getGroupCache(groupId);
      if (cachedGroup && !reset) {
        setGroup(cachedGroup);
        setCreator(cachedGroup.creator);
      } else {
        const groupRes = await client.get(`/groups/${groupId}`);
        setGroup(groupRes.data);
        updateGroupCache(groupId, groupRes.data);

        // Charger le créateur
        if (groupRes.data.admin_id) {
          try {
            const creatorRes = await client.get(`/users/${groupRes.data.admin_id}`);
            setCreator(creatorRes.data);
          } catch (err) {
            console.error('Failed to fetch creator:', err);
          }
        }
      }

      // Charger les posts (paginés)
      const postsRes = await client.get(`/groups/${groupId}/posts`, {
        params: { page: reset ? 1 : page, limit: POSTS_PER_PAGE }
      });

      setPosts(prev => reset ? postsRes.data : [...prev, ...postsRes.data]);
      setHasMore(postsRes.data.length === POSTS_PER_PAGE);
      
    } catch (error) {
      console.error('Failed to fetch group data:', error);
      toast.error('Erreur lors du chargement du groupe');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [groupId, client, page, getGroupCache, updateGroupCache]);

  // =============================
  // CHARGEMENT DES MEMBRES (PAGINÉ)
  // =============================
  const fetchMembers = useCallback(async (reset = false) => {
    if (!group?.members?.length) return;

    setLoadingMembers(true);
    try {
      const memberIds = group.members;
      const currentPage = reset ? 1 : membersPage;
      const start = (currentPage - 1) * MEMBERS_PER_PAGE;
      const batchIds = memberIds.slice(start, start + MEMBERS_PER_PAGE);

      if (batchIds.length === 0) {
        setHasMoreMembers(false);
        return;
      }

      // Requête batch (si backend le supporte)
      const response = await client.post('/users/batch', { ids: batchIds });
      
      setMembersData(prev => reset ? response.data : [...prev, ...response.data]);
      setMembersPage(prev => reset ? 2 : prev + 1);
      setHasMoreMembers(start + MEMBERS_PER_PAGE < memberIds.length);
      
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast.error('Erreur chargement membres');
    } finally {
      setLoadingMembers(false);
    }
  }, [group, client, membersPage]);

  // Réinitialiser la pagination des membres quand le groupe change
  useEffect(() => {
    if (group?.members) {
      setMembersData([]);
      setMembersPage(1);
      setHasMoreMembers(true);
      fetchMembers(true);
    }
  }, [group?.members, fetchMembers]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    if (groupId) {
      fetchGroupData(true);
    }
  }, [groupId, fetchGroupData]);

  // =============================
  // LIKE
  // =============================
  const handleLike = useCallback(async (postId) => {
    const isLiked = likedPosts[postId];
    try {
      // Optimistic update
      setLikedPosts(prev => ({ ...prev, [postId]: !isLiked }));
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, reactions_count: (p.reactions_count || 0) + (isLiked ? -1 : 1) }
          : p
      ));

      await client.post(`/groups/${groupId}/posts/${postId}/like`);
      
    } catch (error) {
      // Rollback
      setLikedPosts(prev => ({ ...prev, [postId]: likedPosts[postId] }));
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, reactions_count: (p.reactions_count || 0) + (isLiked ? 1 : -1) }
          : p
      ));
      toast.error('Erreur lors du like');
    }
  }, [groupId, likedPosts, client]);

  // =============================
  // SUPER LIKE
  // =============================
  const handleSuperLike = useCallback(async (postId) => {
    try {
      await client.post(`/groups/${groupId}/posts/${postId}/super-like`);
      toast.success('⭐ Super like !');
    } catch (error) {
      toast.error('Erreur super like');
    }
  }, [groupId, client]);

  // =============================
  // COMMENTAIRE
  // =============================
  const handleComment = useCallback(async (postId) => {
    // Cette fonction sera appelée par PublicationWithReactions
    // On navigue vers la page de commentaires ou on ouvre un modal
    navigate(`/posts/${postId}/comments`);
  }, [navigate]);

  // =============================
  // CHARGER PLUS DE POSTS
  // =============================
  const loadMorePosts = useCallback(() => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      setPage(prev => prev + 1);
    }
  }, [loadingMore, hasMore]);

  // Effet pour charger plus quand page change
  useEffect(() => {
    if (page > 1) {
      fetchGroupData();
    }
  }, [page]);

  // =============================
  // ACTIONS
  // =============================
  const handleWhatsAppShare = useCallback(() => {
    if (!group?.name) return;
    const text = `Rejoins notre groupe "${group.name}" sur Smartix! 🚀`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }, [group]);

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-24">
        <div className="bg-gradient-to-br from-[#00B894] via-[#00D9FF] to-[#0984E3] text-white px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold">Chargement du groupe...</h1>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <SkeletonFeed count={4} />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Groupe non trouvé</p>
          <Button onClick={() => navigate('/groups')}>Retour aux groupes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* Header */}
      <GroupHeader
        group={group}
        creator={creator}
        isAdmin={isAdmin}
        onNavigate={() => navigate('/groups')}
        onInvite={() => setShowInviteModal(true)}
        onMedia={() => setActiveTab('media')}
        onShare={handleWhatsAppShare}
        onEdit={() => setShowEditModal(true)}
      />

      <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Onglets */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1 p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'feed' && (
          <div>
            {/* Boîte de création de post */}
            <div
              onClick={() => navigate(`/groups/${groupId}/create-post`)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-6 shadow-md hover:shadow-lg cursor-pointer transition-all border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white">
                    {user?.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="text"
                  placeholder="Quoi de neuf dans le groupe?"
                  readOnly
                  className="flex-1 bg-gray-100 dark:bg-gray-700 border-0 rounded-2xl px-4 py-3 text-gray-700 dark:text-gray-300 placeholder-gray-500 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                />
              </div>
            </div>

            {/* Liste des posts */}
            <PostsFeed
              posts={posts}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMorePosts}
              onLike={handleLike}
              onSuperLike={handleSuperLike}
              onComment={handleComment}
              onShare={setSelectedPostForShare}
              likedPosts={likedPosts}
              user={user}
            />
          </div>
        )}

        {activeTab === 'media' && (
          <div>
            {posts.filter(p => p.image).length === 0 ? (
              <Card className="p-12 text-center bg-white dark:bg-gray-800 rounded-2xl">
                <div className="space-y-4">
                  <div className="text-4xl">📸</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Aucune image</h3>
                  <p className="text-gray-600 dark:text-gray-400">Les images des publications apparaîtront ici</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {posts.filter(p => p.image).map(post => (
                  <div key={post.id} className="rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all cursor-pointer">
                    <img src={post.image} alt={post.content} className="w-full h-40 object-cover" />
                    <div className="p-2 bg-white dark:bg-gray-800">
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{post.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <Card className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Membres ({group?.members?.length || 0})
            </h3>
            <div className="space-y-4">
              <MembersList
                members={membersData}
                loading={loadingMembers}
                hasMore={hasMoreMembers}
                onLoadMore={() => fetchMembers()}
                adminId={group.admin_id}
              />
            </div>
          </Card>
        )}

        {activeTab === 'about' && (
          <AboutTab group={group} creator={creator} />
        )}
      </div>

      {/* Modals */}
      <InviteFriendsModal 
        groupId={groupId} 
        groupName={group?.name}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {selectedPostForShare && (
        <ShareMenu
          post={selectedPostForShare}
          groupId={groupId}
          groupName={group?.name}
          isOpen={showShareMenu}
          onClose={() => {
            setShowShareMenu(false);
            setSelectedPostForShare(null);
          }}
          onSuccess={() => fetchGroupData(true)}
        />
      )}

      <GroupEditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        group={group}
        API={API_BASE_URL}
        onGroupUpdated={() => fetchGroupData(true)}
      />

      <BottomNav />
    </div>
  );
};

GroupFeed.propTypes = {};

export default GroupFeed;
GroupHeader.propTypes = {
  group: PropTypes.object.isRequired,
  creator: PropTypes.any.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onInvite: PropTypes.func.isRequired,
  onMedia: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
};
AboutTab.propTypes = {
  group: PropTypes.object.isRequired,
  creator: PropTypes.any.isRequired,
};
PostsFeed.propTypes = {
  posts: PropTypes.array.isRequired,
  loadingMore: PropTypes.any.isRequired,
  hasMore: PropTypes.bool.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperLike: PropTypes.func.isRequired,
  onComment: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  likedPosts: PropTypes.any.isRequired,
  user: PropTypes.object.isRequired,
};
MembersList.propTypes = {
  members: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  hasMore: PropTypes.bool.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  adminId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
