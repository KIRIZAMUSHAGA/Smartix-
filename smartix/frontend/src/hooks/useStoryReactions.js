import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

/**
 * Hook pour gérer les réactions temps réel des stories
 * Gère:
 * - Récupération des réactions visibles
 * - Envoi des commentaires/réactions
 * - Throttling côté client
 * - Agrégation des événements
 */
export const useStoryReactions = (storyId, enabled = true, currentUser = null) => {
  // 🔑 CINQ ÉTATS SÉPARÉS pour réconciliation correcte
  const [remoteReactions, setRemoteReactions] = useState([]); // Ce que le serveur dit
  const [myReaction, setMyReaction] = useState(null); // Ce que MOI j'ai fait localement (like)
  const [myComments, setMyComments] = useState([]); // Mes commentaires optimistes (plusieurs autorisés)
  const [hasLiked, setHasLiked] = useState(false); // 🔒 Verrouillage: une seule like par user
  const [likesCount, setLikesCount] = useState(0); // 🔥 NOUVEAU: Compteur persistant depuis la DB
  const [persistentComments, setPersistentComments] = useState([]); // 🔥 NOUVEAU: Commentaires persistants depuis la DB
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastEventTimeRef = useRef({});
  const throttleTimeRef = useRef(300); // ms
  const currentUserIdRef = useRef(currentUser?.id || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.id || 'anonymous');
  const currentUserInfoRef = useRef(currentUser);

  // 🔥 CRITIQUE: Mettre à jour les refs quand currentUser change
  useEffect(() => {
    if (currentUser) {
      currentUserIdRef.current = currentUser.id || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.id || 'anonymous';
      currentUserInfoRef.current = currentUser;
      console.log('✅ [useStoryReactions] User info updated:', { id: currentUserIdRef.current, name: currentUser.full_name });
    } else {
      console.log('⚠️ [useStoryReactions] currentUser is null, using fallback');
    }
  }, [currentUser]);

  // 🧠 FUSION: Combiner remoteReactions + myReaction + myComments
  const mergedReactions = useMemo(() => {
    let result = [...remoteReactions];
    
    // 🔑 Ajouter le like optimiste (si pas encore confirmé par serveur)
    if (myReaction) {
      const likeConfirmedByServer = result.some(
        r => r.type === 'like' && r.user_id === currentUserIdRef.current && r.id !== myReaction.id
      );
      if (!likeConfirmedByServer) {
        console.log('⏳ [Reactions] Like pending on server, keeping local');
        result.unshift(myReaction); // Ajouter au début
      }
    }
    
    // 🔑 Ajouter les commentaires optimistes (si pas encore confirmés par serveur)
    myComments.forEach(optimisticComment => {
      const existsOnServer = result.some(
        r => r.id === optimisticComment.id
      );
      if (!existsOnServer) {
        console.log('⏳ [Reactions] Comment pending on server, keeping local:', optimisticComment.id);
        result.push(optimisticComment); // Ajouter à la fin
      }
    });
    
    // Limiter à 5 réactions visibles max
    return result.slice(0, 5);
  }, [remoteReactions, myReaction, myComments]);

  // 🔥 LOAD PERSISTENT STATE: Endpoint critique pour l'état initial
  useEffect(() => {
    if (!enabled || !storyId) return;

    const fetchPersistentState = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/stories/${storyId}/interactions`);
        
        // 🔥 NOUVELLE ARCHITECTURE:
        // 1️⃣ Récupérer le compteur persistant
        const persistentLikesCount = response.data.likesCount || 0;
        setLikesCount(persistentLikesCount);
        console.log(`📊 [Story ${storyId}] Loaded persistent likes count: ${persistentLikesCount}`);
        
        // 2️⃣ Vérifier si l'utilisateur courant a déjà liké
        const userHasAlreadyLiked = response.data.userHasLiked || false;
        setHasLiked(userHasAlreadyLiked);
        console.log(`❤️ [Story ${storyId}] User has liked: ${userHasAlreadyLiked}`);
        
        // 3️⃣ Charger les commentaires persistants ET les ajouter à remoteReactions
        const persistentCommentsList = response.data.comments || [];
        setPersistentComments(persistentCommentsList);
        
        // 🔥 FIX CRITIQUE: Transformer les commentaires persistants en réactions et les ajouter à la queue
        const persistentReactions = persistentCommentsList.map((comment, idx) => ({
          id: comment.id || `persistent-comment-${idx}`,
          type: 'comment',
          user_id: comment.user_id,
          username: comment.username || 'Utilisateur',
          avatar: comment.avatar,
          content: comment.text,
          created_at: comment.created_at,
          _persistent: true,  // 🔑 Flag pour les interactions persistantes
          _ttl_end: Infinity  // 🔑 NE JAMAIS expirer
        }));
        
        // 🔥 SUPER CRUCIAL: Ajouter le like persistant si l'utilisateur a déjà liké
        // Ceci FIX le bug où le like disparaît après fermeture/réouverture
        if (userHasAlreadyLiked) {
          const currentUserId = currentUserIdRef.current;
          const currentUserName = currentUserInfoRef.current?.full_name || 'Utilisateur';
          const currentUserAvatar = currentUserInfoRef.current?.avatar || null;
          
          const likeReaction = {
            id: `persistent-like-${storyId}-${currentUserId}`,
            type: 'like',
            user_id: currentUserId,
            username: currentUserName,
            avatar: currentUserAvatar,
            created_at: new Date().toISOString(),
            _persistent: true,
            _ttl_end: Infinity
          };
          
          persistentReactions.unshift(likeReaction); // Ajouter au début
          console.log(`❤️ [Story ${storyId}] User has liked - Adding persistent like reaction to queue`);
        }
        
        // 🔥 FIXE CRITIQUE: TOUJOURS appeler setRemoteReactions, même si le tableau est vide
        // Sinon, si l'user a liké mais pas commenté, persistentReactions contient juste le like
        // mais on ne l'affiche jamais si on oublie de mettre à jour l'état!
        setRemoteReactions(persistentReactions);
        
        if (persistentReactions.length > 0) {
          console.log(`✅ [Story ${storyId}] Added ${persistentReactions.length} persistent interactions to reaction queue`);
        } else {
          console.log(`✅ [Story ${storyId}] No persistent interactions (queue will show "no interactions" message)`);
        }
        
        console.log(`💬 [Story ${storyId}] Loaded ${persistentCommentsList.length} persistent comments`);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching persistent state:', err);
        // Fallback gracieux
      } finally {
        setLoading(false);
      }
    };

    // 🔑 Reset AU CHANGEMENT DE STORY
    setHasLiked(false);
    setMyReaction(null);
    setMyComments([]);
    setLikesCount(0);
    setPersistentComments([]);
    setRemoteReactions([]);  // 🔑 Reset aussi remoteReactions
    
    // Charger l'état persistant immédiatement
    fetchPersistentState();
  }, [storyId, enabled]);

  // Vérifier le throttle
  const shouldThrottle = useCallback((userId) => {
    const lastTime = lastEventTimeRef.current[userId];
    if (!lastTime) return false;

    const elapsed = Date.now() - lastTime;
    return elapsed < throttleTimeRef.current;
  }, []);

  // Ajouter une réaction
  const addReaction = useCallback(async (type, content = null, commentId = null) => {
    if (!storyId || !enabled) return;

    // 🔒 Bloquer les likes supplémentaires
    if (type === 'like' && hasLiked) {
      console.log('❌ User has already liked this story');
      return null;
    }

    try {
      // 🔒 Optimistic UI: créer myReaction localement (pour "like")
      if (type === 'like') {
        const currentUserId = currentUserIdRef.current;
        const userInfo = currentUserInfoRef.current;
        
        // ✅ Créer la réaction optimiste dans le state séparé
        const optimisticReaction = {
          id: `optimistic-like-${Date.now()}`,
          type: 'like',
          user_id: currentUserId,
          username: userInfo?.full_name || userInfo?.username || 'Utilisateur',
          avatar: userInfo?.avatar || null,
          created_at: new Date().toISOString(),
          _ttl_end: Date.now() / 1000 + 7
        };
        
        console.log('💓 [Optimistic Like] Creating reaction:', { username: optimisticReaction.username, avatar: optimisticReaction.avatar });
        
        // 🔑 Ajouter à myReaction (pas remoteReactions)
        setMyReaction(optimisticReaction);
        setHasLiked(true); // 🔒 Verrouiller immédiatement
      }

      // 🔒 Inclure token d'authentification
      const token = localStorage.getItem('access_token');
      console.log(`📤 [Reaction POST] Token présent: ${token ? '✅' : '❌'}, Token: ${token ? token.substring(0, 20) + '...' : 'NONE'}`);
      
      const response = await axios.post(`/api/stories/${storyId}/reactions`, {
        type,
        content,
        comment_id: commentId
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      console.log(`✅ [Reaction POST] Response status:`, response.status);

      // 🔥 CORRECTION: Mettre à jour SEULEMENT remoteReactions
      if (response.data.visible_reactions) {
        const reactionsWithPersistent = [...response.data.visible_reactions];
        if (response.data.persistent_like_count !== undefined && response.data.persistent_like_count > 0) {
          const hasPersistentCounter = reactionsWithPersistent.some(r => r.type === 'persistent_like_count');
          if (!hasPersistentCounter) {
            reactionsWithPersistent.unshift({
              id: `persistent-likes-${storyId}`,
              type: 'persistent_like_count',
              count: response.data.persistent_like_count,
              created_at: new Date().toISOString(),
              _persistent: true
            });
          }
        }
        // 🔑 Mise à jour clée: remoteReactions, pas le state fusionné
        setRemoteReactions(reactionsWithPersistent);
        console.log(`✅ Like sauvegardé! Comptage persistant: ${response.data.persistent_like_count || 0}`);
      }

      return response.data;
    } catch (err) {
      console.error('Error adding reaction:', err);
      setError(err.message);
      // 🔒 Revenir à l'état antérieur si erreur
      if (type === 'like') {
        setHasLiked(false);
        setMyReaction(null);
      }
      return null;
    }
  }, [storyId, enabled, hasLiked]);

  // Ajouter un commentaire court
  const addComment = useCallback(async (text, username, avatar) => {
    if (!storyId || !enabled || text.length > 40) return;

    try {
      const userId = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.id || 'anonymous';
      
      // 🔑 OPTIMISTIC UI: Créer le commentaire localement AVANT d'envoyer
      const optimisticComment = {
        id: `optimistic-comment-${Date.now()}`,
        type: 'comment',
        user_id: userId,
        username: username || 'Utilisateur',
        avatar: avatar || null,
        content: text,
        created_at: new Date().toISOString(),
        _optimistic: true
      };
      
      // 🔑 Ajouter immédiatement à myComments (apparaît dans la queue)
      setMyComments(prev => [...prev, optimisticComment]);
      console.log('💬 [Optimistic Comment] Adding:', { username, content: text });
      
      // 🔥 IMPORTANT: Envoyer le token d'authentification
      const token = localStorage.getItem('access_token');
      console.log(`📤 [Comment POST] Token présent: ${token ? '✅' : '❌'}, Token value: ${token ? token.substring(0, 20) + '...' : 'NONE'}`);
      
      const response = await axios.post(`/api/stories/${storyId}/comments`, {
        text,
        user_id: userId,
        username,
        avatar
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      console.log(`✅ [Comment POST] Response status:`, response.status);

      // 🔑 Mettre à jour SEULEMENT remoteReactions avec la réponse serveur
      if (response.data.visible_reactions) {
        setRemoteReactions(response.data.visible_reactions);
        // La fusion automatique enlèvera le commentaire optimiste si le serveur l'a confirmé
        console.log('✅ Comment sauvegardé!');
      }

      return response.data;
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err.message);
      // 🔒 Revenir à l'état antérieur si erreur
      setMyComments(prev => prev.filter(c => !c.id.includes('Date.now')));
      return null;
    }
  }, [storyId, enabled]);

  // Ajouter une réponse courte
  const addReply = useCallback(async (commentId, text, username, avatar) => {
    if (!storyId || !enabled || text.length > 25) return;

    try {
      const userId = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.id || 'anonymous';
      // 🔥 IMPORTANT: Envoyer le token d'authentification
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        `/api/stories/${storyId}/comments/${commentId}/reply`,
        {
          text,
          user_id: userId,
          username,
          avatar
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      // 🔑 Mettre à jour SEULEMENT remoteReactions
      if (response.data.visible_reactions) {
        setRemoteReactions(response.data.visible_reactions);
      }

      return response.data;
    } catch (err) {
      console.error('Error adding reply:', err);
      setError(err.message);
      return null;
    }
  }, [storyId, enabled]);

  // Aimer un commentaire
  const likeComment = useCallback(async (commentId) => {
    if (!storyId || !enabled) return;

    try {
      const response = await axios.post(
        `/api/stories/${storyId}/comments/${commentId}/like`
      );
      return response.data;
    } catch (err) {
      console.error('Error liking comment:', err);
      setError(err.message);
      return null;
    }
  }, [storyId, enabled]);

  // Gestion du contexte menu long press
  const handleLongPress = useCallback((reaction) => {
    // Menu simple: Répondre, Épingler
    // À implémenter selon design
    console.log('Long press on reaction:', reaction);
  }, []);

  // Mettre à jour les réactions depuis WebSocket (évite doublons)
  const updateReactionFromWS = useCallback((newReaction) => {
    if (!newReaction || !newReaction.id) return;
    
    // 🔑 Mettre à jour SEULEMENT remoteReactions
    setRemoteReactions(prev => {
      if (prev.some(r => r.id === newReaction.id)) {
        return prev; // Déjà présent, ne pas ajouter
      }
      return [newReaction, ...prev.slice(0, 4)];
    });

    // 🔒 Mettre à jour hasLiked si c'est un like de cet utilisateur
    if (newReaction.type === 'like' && newReaction.user_id === currentUserIdRef.current) {
      setHasLiked(true);
    }
  }, []);

  return {
    reactions: mergedReactions, // 🔑 Exporter les réactions FUSIONNÉES
    loading,
    error,
    addReaction,
    addComment,
    addReply,
    likeComment,
    handleLongPress,
    shouldThrottle,
    updateReactionFromWS,
    hasLiked, // 🔒 Exporter l'état de verrouillage
    likesCount, // 📊 NOUVEAU: Compteur persistant depuis DB
    persistentComments // 💬 NOUVEAU: Commentaires persistants depuis DB
  };
};

export default useStoryReactions;
