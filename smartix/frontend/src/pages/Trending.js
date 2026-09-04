import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useHomeData } from '../hooks/useHomeData';
import TrendingSection from '../components/home/TrendingSection';
import { SkeletonHome } from '../components/SkeletonComplete';
import { Button } from '../components/ui/button';
import BottomNav from '../components/BottomNav';

const Trending = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { client } = useApiClient();
  const {
    loading,
    isRefreshing,
    trendingItems,
    refreshData,
  } = useHomeData(user, client);

  if (authLoading || loading) {
    return <SkeletonHome isLoading={true} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/home">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Accueil
            </Button>
          </Link>
          <h1 className="text-lg font-black">Toutes les tendances</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshData(true)}
            disabled={isRefreshing}
            aria-label="Actualiser les tendances"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="pt-8">
        <TrendingSection items={trendingItems} showViewAll={false} />
      </main>
      <BottomNav />
    </div>
  );
};

Trending.propTypes = {};

export default Trending;
