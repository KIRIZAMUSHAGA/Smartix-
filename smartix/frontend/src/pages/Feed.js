import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "../hooks/useAuth";
import { useApiClient } from "../contexts/ApiClientContext";

import { getAvatarUrl } from "../config/apiClient";
import { normalizeStoryOrbits } from "../utils/storyNormalizer";

import { SkeletonFeed } from "../components/SkeletonComplete";
import BottomNav from "../components/BottomNav";
import NeoGlassHeader from "../components/NeoGlassHeader";
import SideDrawer from "../components/SideDrawer";
import OrbitStories from "../components/OrbitStories";
import SmartComposer from "../components/SmartComposer";
import SmartActionButton from "../components/SmartActionButton";
import FeedSimple from "../components/FeedSimple";
import { useRegisterRefresh } from "../contexts/PullToRefreshContext";
import PropTypes from 'prop-types';


// =============================
// CONSTANTES
// =============================

const MASCOTS = [
  "/mascots/smarti_robot_mascot.png",
  "/mascots/luma_futuristic_character.png",
  "/mascots/smartfox_scholar.png",
  "/mascots/genius_bot_mascot.png",
  "/mascots/edupanda_character.png",
  "/mascots/neostar_mascot.png",
  "/mascots/codeowl_mascot.png",
  "/mascots/mindspark_character.png",
  "/mascots/skyguide_mascot.png"
];


// =============================
// COMPOSANT PRINCIPAL
// =============================

const Feed = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { user, logout } = useAuth();
  const { client, isReady: isClientReady } = useApiClient();

  console.log('[FEED][RENDER]', { hasUser: !!user, userId: user?.id, isClientReady, hasClient: !!client });


  // =============================
  // STATES
  // =============================

  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const [stories, setStories] = useState([]);

  const [counts, setCounts] = useState({
    notifications: 0,
    messages: 0,
    friends: 0,
    groups: 0
  });

  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [fontSize, setFontSize] = useState(
    () => localStorage.getItem("smartix-font-size") || "Normal"
  );

  const loaderRef = useRef(null);


  // =============================
  // CHARGEMENT DES POSTS (local, direct via client)
  // =============================

  const loadPosts = useCallback(async (reset = false) => {
    if (!client) throw new Error("Client non prêt");
    if (reset) pageRef.current = 1;
    const page = pageRef.current;
    const data = await client.get(`/community/posts?page=${page}&limit=20`);
    const newPosts = data?.items || data?.posts || (Array.isArray(data) ? data : []);
    pageRef.current = page + 1;
    setHasMore(newPosts.length === 20);
    setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
  }, [client]);

  const prependNewPosts = useCallback((newItems) => {
    if (!Array.isArray(newItems)) return;
    setPosts(prev => [...newItems, ...prev]);
  }, []);


  // =============================
  // PRÉCHARGEMENT MASCOTTES
  // =============================

  useEffect(() => {

    MASCOTS.forEach((url) => {
      const img = new Image();
      img.src = url;
    });

  }, []);


  // =============================
  // CAPTURE ERREURS RUNTIME GLOBALES
  // =============================

  useEffect(() => {

    const prevOnError = window.onerror;
    const prevOnUnhandled = window.onunhandledrejection;

    window.onerror = (msg, src, line, col, err) => {
      if (prevOnError) prevOnError(msg, src, line, col, err);
    };

    window.onunhandledrejection = (event) => {
      if (prevOnUnhandled) prevOnUnhandled(event);
    };

    return () => {
      window.onerror = prevOnError;
      window.onunhandledrejection = prevOnUnhandled;
    };

  }, []);


  // =============================
  // GESTION TAILLE POLICE
  // =============================

  useEffect(() => {

    const handleStorageChange = () => {

      const savedFontSize =
        localStorage.getItem("smartix-font-size") || "Normal";

      setFontSize(savedFontSize);
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);

  }, []);


  useEffect(() => {

    const root = document.documentElement;

    root.classList.remove(
      "font-size-petit",
      "font-size-normal",
      "font-size-grand"
    );

    root.classList.add(`font-size-${fontSize.toLowerCase()}`);

  }, [fontSize]);


  // =============================
  // INFINITE SCROLL
  // =============================

  useEffect(() => {

    const element = loaderRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(

      async (entries) => {

        const target = entries[0];

        if (
          target.isIntersecting &&
          hasMore &&
          !loadingMore &&
          posts.length >= 5
        ) {

          setLoadingMore(true);

          try {

            await loadPosts(false);

          } catch (err) {

            console.error("Error loading more posts:", err);
            toast.error("Erreur lors du chargement");

          } finally {

            setLoadingMore(false);

          }

        }

      },

      {
        root: null,
        rootMargin: "400px",
        threshold: 0
      }
    );

    observer.observe(element);

    return () => observer.unobserve(element);

  }, [hasMore, loadingMore, posts.length, loadPosts]);


  // =============================
  // INITIALISATION FEED
  // =============================

  useEffect(() => {
    console.log('[FEED][INIT_EFFECT] fired', { hasUser: !!user, isClientReady, hasClient: !!client });

    if (!user) {
      console.log('[FEED][BLOCKING RETURN] user=null → navigate /auth');
      navigate("/auth");
      return;
    }

    if (!isClientReady || !client) {
      console.log('[FEED][BLOCKING RETURN] client not ready', { isClientReady, hasClient: !!client });
      return;
    }

    console.log('[FEED][INIT] starting initFeed()');
    let cancelled = false;

    const initFeed = async () => {
      try {

        setLoadingLocal(true);
        setError(null);

        await loadPosts(true);

        if (cancelled) return;

        // ----------------------
        // POSTS SESSION STORAGE
        // ----------------------

        const optimisticPost = sessionStorage.getItem("optimisticPost");
        const newPost = sessionStorage.getItem("newPost");

        if (optimisticPost) {
          try { prependNewPosts([JSON.parse(optimisticPost)]); } catch (_) {}
          sessionStorage.removeItem("optimisticPost");
        }

        if (newPost) {
          try { prependNewPosts([JSON.parse(newPost)]); } catch (_) {}
          sessionStorage.removeItem("newPost");
        }

        // ----------------------
        // STORIES + NOTIFICATIONS
        // ----------------------

        const fetchStories = client
          .get("/stories")
          .then((res) => { if (!cancelled) setStories(normalizeStoryOrbits(res || [])); })
          .catch(() => { if (!cancelled) setStories([]); });

        const fetchCounts = client
          .get("/notifications/counts")
          .then((res) => {
            if (!cancelled) setCounts((prev) => ({
              ...prev,
              notifications: (res?.unread_count ?? res?.notifications) || 0
            }));
          })
          .catch(() => {});

        await Promise.allSettled([fetchStories, fetchCounts]);

      } catch (err) {

        console.error("[Feed] Init error:", err);
        if (!cancelled) setError(t("community.error"));

      } finally {

        if (!cancelled) setLoadingLocal(false);

      }

    };

    initFeed();

    return () => { cancelled = true; };

  }, [user, navigate, isClientReady, client, loadPosts, prependNewPosts, t]);


  // =============================
  // CRÉATION POST
  // =============================

  const handleCreatePost = useCallback(

    async (content, bgData = null, postType = "regular") => {

      if (!content.trim() && !bgData && postType !== "shared_post") return;

      const optimisticId = `temp-${Date.now()}`;

      const optimisticPost = {

        id: optimisticId,
        content: content.trim(),
        post_type: postType,

        background_id: bgData?.background_id || null,
        background_css: bgData?.background_css || null,
        background_image: bgData?.background_image || null,

        image: null,

        user: user
          ? {
              id: user.id,
              full_name: user.full_name,
              avatar: getAvatarUrl(user.avatar),
              badges: user.badges || [],
              level: user.level
            }
          : null,

        author: user
          ? {
              id: user.id,
              full_name: user.full_name,
              avatar: getAvatarUrl(user.avatar)
            }
          : null,

        reactions_count: 0,
        comments_count: 0,
        shares_count: 0,

        likedByCurrentUser: false,

        created_at: new Date().toISOString(),
        status: "pending"
      };

      prependNewPosts([optimisticPost]);

      try {

        const res = await client.post("/posts", {
          content: content.trim(),
          category: "general",
          post_type: postType,
          background_id: optimisticPost.background_id,
          background_css: optimisticPost.background_css,
          background_image: optimisticPost.background_image
        });

        const resData = res?.data || res || {};
        const officialPost = {
          ...optimisticPost,
          ...resData,
          id: optimisticId,
          server_id: String(resData.id || resData._id || optimisticId),
          status: "published"
        };

        prependNewPosts([officialPost]);

        toast.success(t("community.published"));

      } catch (err) {

        console.error("Post creation error:", err);

        const failedPost = {
          ...optimisticPost,
          status: "failed"
        };

        prependNewPosts([failedPost]);

        toast.error("Erreur lors de la publication.");

      }

    },

    [user, client, prependNewPosts, t]
  );


  // =============================
  // LOGOUT
  // =============================

  const handleLogout = useCallback(() => {

    logout();
    navigate("/auth");

  }, [logout, navigate]);


  // =============================
  // RENDER
  // =============================

  useRegisterRefresh(useCallback(() => loadPosts(true), [loadPosts]));

  return (

    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">

      <NeoGlassHeader
        notifications={counts.notifications}
        messages={counts.messages}
        friends={counts.friends}
        groups={counts.groups}
        onMenuClick={() => setIsMenuOpen(true)}
      />

      <SideDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      <main
        className="max-w-xl mx-auto px-3 py-3 pb-24"
        style={{ maxWidth: "600px" }}
      >

        <OrbitStories
          storyOrbits={stories}
          user={user}
          onCreateStory={() => navigate("/create-story")}
          onViewStory={(s) => navigate(`/stories/${s.id}`)}
          isLoading={loadingLocal && stories.length === 0}
        />

        <div className="my-6 border-b border-border/50" />

        <SmartComposer
          user={user}
          onSubmit={handleCreatePost}
          navigateToCreate={() => navigate("/create-post")}
        />

        <div className="my-6 border-b border-border/50" />

        <div className="flex flex-col gap-0 bg-transparent">

          {loadingLocal && posts.length === 0 ? (

            <SkeletonFeed count={3} />

          ) : posts.length > 0 ? (

            <FeedSimple
              initialPosts={posts}
              user={user}
              onComment={(post) => navigate(`/posts/${post.id}`)}
              onShare={() => toast.info(t("community.shareSoon"))}
            />

          ) : (

            <div className="text-center py-24 text-muted-foreground font-medium">
              {error || t("community.empty")}
            </div>

          )}

        </div>

        {hasMore && (

          <div ref={loaderRef} className="py-8 flex justify-center">

            {loadingMore && (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}

          </div>

        )}

      </main>

      <SmartActionButton onClick={() => navigate("/create-post")} />

      <BottomNav />

    </div>
  );

};

Feed.propTypes = {};

export default Feed;
