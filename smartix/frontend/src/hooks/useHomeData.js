import { useState, useEffect, useCallback } from 'react';

export const useHomeData = (user, client) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [stats, setStats] = useState({ courses: 0, posts: 0 });
  const [lastCourse, setLastCourse] = useState(null);
  const [popularCourses, setPopularCourses] = useState([]);
  const [popularProjects, setPopularProjects] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [externalNews, setExternalNews] = useState([]);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [trendingItems, setTrendingItems] = useState([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState([]);
  
  const [creatorStats, setCreatorStats] = useState({
    totalDownloads: 0,
    totalEarnings: 0,
    averageRating: 0,
    followers: 0
  });

  const safeList = (v) =>
    Array.isArray(v) ? v :
    Array.isArray(v?.items) ? v.items :
    Array.isArray(v?.data) ? v.data :
    [];

  const loadData = useCallback(async (silent = false) => {
    if (!user || !client) return;

    try {
      if (!silent) setLoading(true);
      setIsRefreshing(true);
      
      const [
        coursesRes,
        projectsRes,
        productsRes,
        creatorsRes,
        newsRes,
        postsRes,
      ] = await Promise.allSettled([
        client.get('/courses/popular?limit=4'),
        client.get('/projects/popular?limit=4'),
        client.get('/marketplace/popular?limit=4'),
        client.get('/creators/top?limit=4'),
        client.get('/news/external?limit=4'),
        client.get('/community/posts?page=1&limit=10'),
      ]);

      if (coursesRes.status === 'fulfilled') {
        setPopularCourses(safeList(coursesRes.value));
      }

      if (projectsRes.status === 'fulfilled') {
        setPopularProjects(safeList(projectsRes.value));
      }

      if (productsRes.status === 'fulfilled') {
        setPopularProducts(safeList(productsRes.value));
      }

      if (creatorsRes.status === 'fulfilled') {
        const list = safeList(creatorsRes.value);
        setTopCreators(list);
        
        const totalDownloads = list.reduce((sum, c) => sum + (c.downloads || 0), 0);
        const totalEarnings = list.reduce((sum, c) => sum + (c.earnings || 0), 0);
        const avgRating = list.length ? list.reduce((sum, c) => sum + (c.rating || 0), 0) / list.length : 0;
        const followers = list.reduce((sum, c) => sum + (c.followers || 0), 0);
        
        setCreatorStats({
          totalDownloads,
          totalEarnings: Math.round(totalEarnings),
          averageRating: Math.round(avgRating * 10) / 10,
          followers
        });
      }

      if (newsRes.status === 'fulfilled') {
        setExternalNews(safeList(newsRes.value));
      }

      if (postsRes.status === 'fulfilled') {
        setCommunityPosts(safeList(postsRes.value));
      }

    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [user?.id, client]);

  useEffect(() => {
    if (user && client) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, client, loadData]);

  return {
    loading,
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
    refreshData: loadData
  };
};
