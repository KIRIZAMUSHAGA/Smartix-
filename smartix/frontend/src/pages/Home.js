import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ✅ IMPORT de TON hook useAuth
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';

// Composants
import HeroSection from '../components/home/HeroSection';
import QuickAccess from '../components/home/QuickAccess';
import GlobalSearch from '../components/home/GlobalSearch';
import PillarsSection from '../components/home/PillarsSection';
import TrendingSection from '../components/home/TrendingSection';
import LearningSection from '../components/home/LearningSection';
import ProjectsSection from '../components/home/ProjectsSection';
import MarketplaceSection from '../components/home/MarketplaceSection';
import CommunityFeed from '../components/home/CommunityFeed';
import NewsSection from '../components/home/NewsSection';
import CreatorsSection from '../components/home/CreatorsSection';
import CreatorEconomy from '../components/home/CreatorEconomy';
import WeeklyChallenges from '../components/home/WeeklyChallenges';
import OnboardingCard from '../components/home/OnboardingCard';

// Composants globaux
import BottomNav from '../components/BottomNav';
import SideDrawer from '../components/SideDrawer';
import { useRegisterRefresh } from '../contexts/PullToRefreshContext';
import { SkeletonHome } from '../components/SkeletonComplete';

// Hooks
import { useHomeData } from '../hooks/useHomeData';
import PropTypes from 'prop-types';

const Home = () => {
  const navigate = useNavigate();
  
  // ✅ Utilisation de TON hook useAuth
  const { 
    user, 
    logout, 
    isLoading: authLoading,
    isAuthenticated 
  } = useAuth();
  
  const { client } = useApiClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const {
    loading: dataLoading,
    isRefreshing,
    stats,
    lastCourse,
    popularCourses,
    popularProjects,
    popularProducts,
    topCreators,
    externalNews,
    communityPosts,
    creatorStats,
    trendingItems,
    weeklyChallenges,
    refreshData
  } = useHomeData(user, client);

  // ✅ Redirection si non authentifié
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Rechargement silencieux
  useEffect(() => {
    const handleFocus = () => refreshData(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshData(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshData]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/auth');
  }, [logout, navigate]);

  // ✅ Gestion du chargement combiné
  const isLoading = authLoading || dataLoading;

  useRegisterRefresh(useCallback(() => refreshData(true), [refreshData]));

  if (isLoading) return <SkeletonHome isLoading={true} />;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans">
      <SideDrawer 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        user={user} 
        onLogout={handleLogout}
      />

      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs shadow-lg animate-pulse">
            Mise à jour...
          </div>
        </div>
      )}

      <HeroSection />
      
      {/* ✅ QuickAccess seulement si authentifié */}
      {isAuthenticated && (
        <QuickAccess 
          lastCourse={lastCourse} 
          creatorStats={creatorStats}
          user={user}
        />
      )}
      
      <GlobalSearch />
      <PillarsSection />
      <TrendingSection items={trendingItems} />
      
      {/* ✅ LearningSection seulement si authentifié */}
      {isAuthenticated && (
        <LearningSection 
          user={user} 
          lastCourse={lastCourse} 
          popularCourses={popularCourses}
          stats={stats}
        />
      )}
      
      <ProjectsSection projects={popularProjects} />
      <MarketplaceSection products={popularProducts} />
      <CommunityFeed posts={communityPosts} />
      <NewsSection news={externalNews} />
      <CreatorsSection creators={topCreators} />
      <CreatorEconomy stats={creatorStats} />
      <WeeklyChallenges challenges={weeklyChallenges} />
      
      {!user?.hasSeenOnboarding && <OnboardingCard user={user} />}
      
      <BottomNav />
    </div>
  );
};

Home.propTypes = {};

export default Home;
