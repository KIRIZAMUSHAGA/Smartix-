import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { ThemeProvider } from 'next-themes';
import { ThemeProvider as ThemeContextProvider } from './contexts/ThemeContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoryViewerProvider } from './contexts/StoryViewerContext';
import { AuthContext } from './contexts/AuthContext';
import appConfig from './config/appConfig.js';
import { Toaster } from 'sonner';
import {
  initializeAuth,
  getCurrentUser,
  addAuthStateListener,
  removeAuthStateListener,
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  refreshAccessToken as authRefreshToken,
  setAccessToken as authSetAccessToken,
  setCurrentUser as authSetCurrentUser
} from './services/authService';
import { GlobalCacheProvider } from './contexts/GlobalCacheContext';
import { ApiClientProvider } from './contexts/ApiClientContext';
import { CommentEventBusProvider } from './components/PostItem.js';
import { CookiePreferences } from './components/CookiePreferences.jsx';
import useCookies from './hooks/useCookies';
import { ImagePreloaderService } from './services/ImagePreloaderService';
import { ConfirmModal } from './components/ConfirmModal';
import AuthCallback from './components/AuthCallback';

// =============================
// 🆕 IMPORT OFFLINE PROVIDER
// =============================
import { OfflineProvider } from './contexts/OfflineContext';
import { PullToRefreshProvider } from './contexts/PullToRefreshContext';

// =============================
// IMPORTS DES PROVIDERS MARKETPLACE
// =============================
import { MarketplaceProvider } from './vibe-coding/marketplace/hooks/useMarketplace';
import { AnalyticsProvider } from './vibe-coding/hooks/useAnalytics';
import { ForkProvider } from './vibe-coding/hooks/useFork';

// =============================
// IMPORTS DU MODULE VIBE-CODING
// =============================
import {
  VibeDashboard,
  ProjectsList,
  CreateProject,
  CreateProjectTemplate,
  ProjectDetail,
  ProjectEditor,
  ProjectEditorAI,
  TemplatesList,
  TemplateDetail
} from './pages/vibe-coding';

// =============================
// IMPORTS MARKETPLACE APPLICATIONS
// =============================
import MarketplaceApps from './pages/MarketplaceApps';
import AppDetail from './pages/AppDetail';
import DeveloperProfile from './pages/DeveloperProfile';

// =============================
// IMPORTS EXISTANTS
// =============================
import Landing from './pages/Landing/Landing';
import AboutPage from './pages/About/AboutPage';
import VisionTeamPage from './pages/About/VisionTeamPage';
import Home from './pages/Home.js';
import Trending from './pages/Trending.js';
import Feed from './pages/Feed';
import Explore from './pages/Explore';
import Favorites from './pages/Favorites';
import AIChat from './pages/AIChat.jsx';
import Courses from './pages/Courses';
import MyDrafts from './pages/MyDrafts';
import CourseEdit from './pages/CourseEdit';
import CourseEditor from './pages/CourseEditor';
import CourseDetail from './pages/CourseDetail';
import CourseReader from './pages/CourseReader';
import Community from './pages/Community';
import MarketplaceV2 from './pages/MarketplaceV2';
import SellerDashboard from './pages/SellerDashboard';
import ProductDetail from './pages/ProductDetail';
import BuyerOrderHistory from './pages/BuyerOrderHistory';
import AddProduct from './pages/AddProduct';
import ProductCanvasPage from './pages/ProductCanvasPage';
import OrderDetail from './pages/OrderDetail';
import PDFViewer from './pages/PDFViewer';
import Profile from './pages/Profile';
import Security from './pages/Security';
import Pricing from './pages/Pricing';
import SettingsPage from './pages/Settings/SettingsPage';
import AIProfilePage from './pages/AIProfilePage';
import CreateStory from './pages/CreateStory';
import CreatePost from './pages/CreatePost';
import PostDetail from './pages/PostDetail';
import Friends from './pages/Friends';
import BlockedUsers from './pages/BlockedUsers';
import Groups from './pages/Groups';
import Messages from './pages/Messages';
import MessagesDetail from './pages/MessagesDetail';
import Notifications from './pages/NotificationsPage';
import { initiateSocket, disconnectSocket } from './services/messageSocketService';
import FAQ from './pages/FAQ.jsx';
import ConditionsUtilisation from './pages/ConditionsUtilisation.jsx';
import MentionsLegales from './pages/MentionsLegales.jsx';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite.jsx';
import HelpCenter from './pages/HelpCenter';
import SmartClips from './pages/SmartClips';
import SmartClipsOnboarding from './pages/SmartClipsOnboarding';
import SmartClipsStudio from './pages/SmartClipsStudio';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import NewsRaw from "./pages/NewsRaw";
import TeacherMode from './pages/TeacherMode';

// ✅ Imports des composants UI
import { Button } from './components/ui/button.js';
import { Progress } from './components/ui/progress.js';
import SideDrawer from './components/SideDrawer.js';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './components/ui/hover-card.jsx';

// ✅ Import CSS
import './pages/Landing.css';

// =============================
// 1️⃣ PROTECTED ROUTE CENTRALISÉE
// =============================
const ProtectedRoute = ({ children, requireAuth = true }) => {
  const { user, isLoading } = React.useContext(AuthContext);

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, border: '4px solid #00B894', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (requireAuth && !user) {
    console.log('[POST_LOGIN] ProtectedRoute -> Navigate(/auth) | requireAuth=true & user=null | from:', window.location.pathname);
    return <Navigate to="/auth" replace state={{ from: window.location.pathname }} />;
  }

  // ✅ Routes publiques accessibles aussi aux utilisateurs connectés
  // (Vibe-coding, /about, /faq, /explore, etc.)
  // Seul /auth doit rediriger vers /home pour les utilisateurs connectés.
  if (!requireAuth && user && window.location.pathname === '/auth') {
    console.log('[POST_LOGIN] ProtectedRoute -> Navigate(/home) | /auth accessed by authenticated user');
    return <Navigate to="/home" replace />;
  }

  return children;
};

// =============================
// 2️⃣ CONFIGURATION DES ROUTES CENTRALISÉE
// =============================
const routeConfig = [
  // Routes publiques
  { path: "/about", element: <AboutPage />, auth: false },
  { path: "/vision", element: <VisionTeamPage />, auth: false },
  { path: "/faq", element: <FAQ />, auth: false },
  { path: "/conditions-utilisation", element: <ConditionsUtilisation />, auth: false },
  { path: "/mentions-legales", element: <MentionsLegales />, auth: false },
  { path: "/politique-confidentialite", element: <PolitiqueConfidentialite />, auth: false },
  { path: "/explore", element: <Community />, auth: false },
  { path: "/auth", element: <Landing />, auth: false },
  { path: "/news-raw", element: <NewsRaw />, auth: false },
  { path: "/cookie-preferences", element: <CookiePreferences />, auth: false },
  { path: "/", element: null, redirect: true, auth: false },
  
  // ROUTES VIBE-CODING — TEMPORAIRE pour tests - réactiver auth avant prod
  { path: "/vibe", element: <VibeDashboard />, auth: false },
  { path: "/vibe/projects", element: <ProjectsList />, auth: false },
  { path: "/vibe/projects/create", element: <CreateProject />, auth: false },
  { path: "/vibe/projects/create/template", element: <CreateProjectTemplate />, auth: false },
  { path: "/vibe/projects/create/empty", element: <ProjectEditor />, auth: false },
  { path: "/vibe/projects/create/ai", element: <ProjectEditorAI />, auth: false },
  { path: "/vibe/projects/:id", element: <ProjectDetail />, auth: false },
  { path: "/vibe/projects/:id/edit", element: <ProjectEditor />, auth: false },
  { path: "/vibe/projects/:id/edit/ai", element: <ProjectEditorAI />, auth: false },
  { path: "/vibe/templates", element: <TemplatesList />, auth: false },
  { path: "/vibe/templates/:id", element: <TemplateDetail />, auth: false },
  
  // ROUTES MARKETPLACE APPLICATIONS
  { path: "/apps", element: <MarketplaceApps />, auth: true },
  { path: "/apps/:id", element: <AppDetail />, auth: true },
  { path: "/developer/:id", element: <DeveloperProfile />, auth: true },
  
  // Routes protégées existantes
  { path: "/home", element: <Home />, auth: true },
  { path: "/trending", element: <Trending />, auth: true },
  { path: "/favorites", element: <Favorites />, auth: true },
  { path: "/feed", element: <Feed />, auth: true },
  { path: "/ai", element: <AIChat />, auth: true },
  { path: "/ai-chat", element: <AIChat />, auth: true },
  { path: "/courses", element: <Courses />, auth: true },
  { path: "/courses/drafts", element: <MyDrafts />, auth: true },
  { path: "/courses/:courseId/edit", element: <CourseEdit />, auth: true },
  { path: "/courses/:courseId/editor", element: <CourseEditor />, auth: true },
  { path: "/courses/:courseId", element: <CourseDetail />, auth: true },
  { path: "/course/:chapterId", element: <CourseReader />, auth: true },
  { path: "/smartix-store", element: <MarketplaceV2 />, auth: true },
  { path: "/marketplace", element: <MarketplaceV2 />, auth: true },
  { path: "/marketplace/product/:productId", element: <ProductDetail />, auth: true },
  { path: "/buyer/orders", element: <BuyerOrderHistory />, auth: true },
  { path: "/buyer/orders/:orderNumber", element: <OrderDetail />, auth: true },
  { path: "/pdf-viewer/:orderId", element: <PDFViewer />, auth: true },
  { path: "/seller/dashboard", element: <SellerDashboard />, auth: true },
  { path: "/seller/add-product", element: <AddProduct />, auth: true },
  { path: "/marketplace/product/:productId/canvas", element: <ProductCanvasPage />, auth: true },
  { path: "/pricing", element: <Pricing />, auth: true },
  { path: "/ai-profile", element: <AIProfilePage />, auth: true },
  { path: "/profile", element: <Profile />, auth: true },
  { path: "/profile/:id", element: <Profile />, auth: true },
  { path: "/security", element: <Security />, auth: true },
  { path: "/settings", element: <SettingsPage />, auth: true },
  { path: "/create-story", element: <CreateStory />, auth: true },
  { path: "/create-post", element: <CreatePost />, auth: true },
  { path: "/post/:postId", element: <PostDetail />, auth: true },
  { path: "/post/:postId/comments", element: <PostDetail />, auth: true },
  { path: "/friends", element: <Friends />, auth: true },
  { path: "/blocked-users", element: <BlockedUsers />, auth: true },
  { path: "/groups", element: <Groups />, auth: true },
  { path: "/messages", element: <Messages />, auth: true },
  { path: "/messages/:conversationId", element: <MessagesDetail />, auth: true },
  { path: "/notifications", element: <Notifications />, auth: true },
  { path: "/help-center", element: <HelpCenter />, auth: true },
  { path: "/smartclips", element: <SmartClips />, auth: true },
  { path: "/smartclips/onboarding", element: <SmartClipsOnboarding />, auth: true },
  { path: "/create-veo", element: <SmartClipsStudio />, auth: true },
  { path: "/smartclips/create", element: <SmartClipsStudio />, auth: true },
  { path: "/news", element: <News />, auth: true },
  { path: "/news/:id", element: <NewsDetail />, auth: true },
  { path: "/teacher-mode", element: <TeacherMode />, auth: true },
  
  // Redirections
  { path: "/smartixclip", redirect: "/smartclips", auth: true },
  { path: "/clips", redirect: "/smartclips", auth: true },
];

function AppRoutes() {
  const { user } = React.useContext(AuthContext);
  
  return (
    <Routes>
      {/* Callback OAuth Google : monté HORS de ProtectedRoute pour éviter
          tout redirect avant la consommation du fragment d'URL. */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {routeConfig.map((route) => {
        if (route.redirect) {
          const redirectTo = route.path === "/" 
            ? (user ? "/home" : "/auth") 
            : route.redirect;
            
          return (
            <Route
              key={route.path}
              path={route.path}
              element={<Navigate to={redirectTo} replace />}
            />
          );
        }
        
        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute requireAuth={route.auth}>
                {route.element}
              </ProtectedRoute>
            }
          />
        );
      })}
      
      <Route path="*" element={<Navigate to={user ? "/home" : "/auth"} replace />} />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef(null);
  
  // ✅ Ref pour éviter les appels parallèles de refresh
  const refreshRef = useRef({ isRefreshing: false, promise: null });

  // Initialisation de l'auth
  useEffect(() => {
    const init = async () => {
      console.log('[APP][INIT] auth init started');
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ user: null, token: null }), 500)
      );
      
      try {
        const storedToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        if (storedToken && storedUser) {
          console.log('[APP][INIT] token found in storage → fast path', { userId: JSON.parse(storedUser)?.id });
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
          setIsLoading(false);
          return;
        }
        
        console.log('[APP][INIT] no storage → calling initializeAuth() with 500ms timeout race');
        const userData = await Promise.race([initializeAuth(), timeoutPromise]);
        console.log('[APP][INIT] initializeAuth result:', { hasUser: !!userData?.user, hasToken: !!userData?.token });
        
        if (userData?.user) {
          setUser(userData.user);
          setToken(userData.token);
        }
        
      } catch (error) {
        console.error('[APP][INIT] Auth error:', error);
      } finally {
        setIsLoading(false);
        console.log('[APP][INIT] isLoading → false');
      }
    };
    
    init();
    
    const handleAuthChange = (authState) => {
      setUser(authState.user);
      setToken(authState.token);
      if (!authState.user) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    };
    
    addAuthStateListener(handleAuthChange);
    return () => removeAuthStateListener(handleAuthChange);
  }, []);

  // ✅ Fonction de refresh token (source unique)
  const refreshToken = useCallback(async () => {
    if (refreshRef.current.isRefreshing) {
      return refreshRef.current.promise;
    }

    refreshRef.current.isRefreshing = true;
    const promise = (async () => {
      try {
        const newToken = await authRefreshToken();
        setToken(newToken);
        
        // Mettre à jour localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          localStorage.setItem('access_token', newToken);
        }
        
        return newToken;
      } catch (error) {
        // Si refresh échoue, déconnecter
        setUser(null);
        setToken(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        throw error;
      } finally {
        refreshRef.current.isRefreshing = false;
        refreshRef.current.promise = null;
      }
    })();
    
    refreshRef.current.promise = promise;
    return promise;
  }, []);

  // ✅ Persistance multi-tab
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'access_token' && e.newValue) {
        setToken(e.newValue);
      }
      if (e.key === 'user' && e.newValue) {
        setUser(JSON.parse(e.newValue));
      }
      if (e.key === 'access_token' && !e.newValue) {
        setToken(null);
        setUser(null);
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Gestion du socket
  useEffect(() => {
    if (!user?.id) {
      if (socketRef.current) {
        disconnectSocket();
        socketRef.current = null;
      }
      return;
    }

    if (socketRef.current) return;

    initiateSocket(user.id);
    socketRef.current = { id: user.id };

    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, [user?.id]);

  const login = useCallback(async (email, password) => {
    console.log('[APP][LOGIN] login() called');
    const result = await authLogin(email, password);
    if (result.user && result.token) {
      console.log('[APP][LOGIN] success → setUser + setToken', { userId: result.user?.id });
      setUser(result.user);
      setToken(result.token);
      localStorage.setItem('access_token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
    } else {
      console.warn('[APP][LOGIN] authLogin returned without user or token', result);
    }
    return result;
  }, []);

  const register = useCallback(async (email, password, full_name, username = null) => {
    const result = await authRegister(email, password, full_name, username);
    if (result.user && result.token) {
      setUser(result.user);
      setToken(result.token);
      localStorage.setItem('access_token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }, []);

  // ✅ Valeurs dérivées (pré-calculées pour éviter recalculs)
  const isAuthenticated = !!user && !!token;
  const roles = user?.roles || [];
  const permissions = user?.permissions || [];
  const isAdmin = roles.includes('admin') || user?.isAdmin === true;

  console.log('[APP][RENDER]', { isLoading, hasUser: !!user, hasToken: !!token, userId: user?.id });

  if (isLoading) {
    console.log('[APP][BLOCKING RETURN] isLoading=true → spinner, ALL providers NOT mounted');
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #00B894', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <ThemeContextProvider>
      <Router>
        {/* ✅ AuthContext avec TOUTES les valeurs nécessaires */}
        <AuthContext.Provider value={{ 
          user, 
          token,
          isLoading,
          setUser, 
          setToken,
          login, 
          register, 
          logout,
          refreshToken,
          isAuthenticated,
          roles,
          permissions,
          isAdmin
        }}>
          {/* 🆕 OFFLINE PROVIDER - Gère la connectivité globale */}
          <OfflineProvider
            showRetryButton={true}
            showDismissButton={true}
            enableVibration={true}
            onRetry={async () => {
              console.log('Tentative de reconnexion manuelle');
              // Ici, vous pouvez ajouter une logique personnalisée
              // comme recharger les données ou rafraîchir les feeds
            }}
            onDismiss={() => {
              console.log('Indicateur hors-ligne fermé par l\'utilisateur');
            }}
            autoHideDelay={3000}
            enableRealConnectivityCheck={false}
          >
            <CommentEventBusProvider>
              <ApiClientProvider timeout={30000}>
                <GlobalCacheProvider currentUserId={user?.id || null}>
                  
                  {/* PROVIDERS MARKETPLACE */}
                  <MarketplaceProvider 
                    userId={user?.id}
                    options={{
                      initialLoad: true,
                      cacheResults: true,
                      autoRefresh: false
                    }}
                  >
                    <AnalyticsProvider 
                      appId={null}
                      userId={user?.id}
                      options={{
                        initialLoad: false,
                        autoRefresh: true,
                        cacheResults: true,
                        batchEvents: true
                      }}
                    >
                      <ForkProvider 
                        userId={user?.id}
                        options={{
                          initialLoad: true,
                          cacheResults: true,
                          autoRefresh: false
                        }}
                      >
                        <StoryViewerProvider>
                          <PullToRefreshProvider>
                            <AppRoutes />
                            <Toaster richColors position="top-center" />
                            <ConfirmModal />
                          </PullToRefreshProvider>
                        </StoryViewerProvider>
                      </ForkProvider>
                    </AnalyticsProvider>
                  </MarketplaceProvider>

                </GlobalCacheProvider>
              </ApiClientProvider>
            </CommentEventBusProvider>
          </OfflineProvider>
        </AuthContext.Provider>
      </Router>
      </ThemeContextProvider>
    </ThemeProvider>
  );
}

App.propTypes = {};

export default App;
AppRoutes.propTypes = {};
ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireAuth: PropTypes.bool,
};
