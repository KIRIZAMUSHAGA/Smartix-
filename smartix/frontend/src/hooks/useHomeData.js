import { useState, useEffect, useCallback } from 'react';

const getImageUrl = (item = {}) =>
  item.coverImage ||
  item.cover_image ||
  item.coverUrl ||
  item.image ||
  item.image_url ||
  item.image_thumbnail_url ||
  item.image_original_url ||
  item.thumbnail_url ||
  item.preview_image ||
  item.thumbnail ||
  null;

const getLikesCount = (item = {}) => {
  if (Array.isArray(item.likes)) return item.likes.length;
  return item.likes_count ?? item.likes ?? item.stats?.likes;
};

const getViewsCount = (item = {}) =>
  item.views ?? item.views_count ?? item.stats?.views;

const getCommentsCount = (item = {}) =>
  item.comments_count ?? item.comments ?? item.stats?.comments;

const buildTrendingItems = ({ courses, projects, products, posts, news }) => [
  ...courses.map((course) => ({
    id: `course-${course.id}`,
    type: 'course',
    title: course.title || 'Cours sans titre',
    subtitle: course.author_name
      ? `Par ${course.author_name}`
      : course.category || 'Cours Smartix',
    image: getImageUrl(course),
    stats: {
      views: getViewsCount(course),
      likes: getLikesCount(course),
      comments: getCommentsCount(course),
    },
    trend: course.trending_score ?? course.popularity ?? 20,
    link: course.id ? `/courses/${course.id}` : '/courses',
  })),
  ...projects.map((project) => ({
    id: `project-${project.id}`,
    type: 'project',
    title: project.title || project.name || 'Projet sans titre',
    subtitle: project.description || project.type || 'Projet Vibe-Coding',
    image: getImageUrl(project),
    stats: {
      views: getViewsCount(project),
      likes: getLikesCount(project),
      downloads: project.downloads ?? project.stats?.downloads,
    },
    trend: project.trending_score ?? project.popularity ?? 20,
    // Les projets publics ne sont pas tous consultables en détail par le
    // propriétaire courant : la liste publique est toujours une destination valide.
    link: project.homeLink || '/vibe/projects',
  })),
  ...products.map((product) => ({
    id: `product-${product.id}`,
    type: 'product',
    title: product.title || 'Produit sans titre',
    subtitle: product.seller_name
      ? `Par ${product.seller_name}`
      : product.category || 'Marketplace Smartix',
    image: getImageUrl(product),
    stats: {
      views: getViewsCount(product),
      downloads: product.quantity_sold ?? product.downloads,
      rating: product.average_rating ?? product.rating,
    },
    trend: product.trending_score ?? product.quantity_sold ?? 20,
    link: product.id ? `/marketplace/product/${product.id}` : '/marketplace',
  })),
  ...posts.map((post) => ({
    id: `post-${post.id}`,
    type: 'post',
    title: post.title || post.content?.slice(0, 80) || 'Publication communautaire',
    subtitle: post.author?.full_name || 'Communauté Smartix',
    image: getImageUrl(post),
    stats: {
      views: getViewsCount(post),
      likes: getLikesCount(post),
      comments: getCommentsCount(post),
    },
    trend: post.trending_score ?? getLikesCount(post) ?? 20,
    link: post.id ? `/post/${post.id}` : '/feed',
  })),
  ...news.map((article) => ({
    id: `news-${article.id}`,
    type: 'news',
    title: article.title || 'Actualité Smartix',
    subtitle: article.source || article.category || 'Actualités',
    image: getImageUrl(article),
    stats: {
      views: getViewsCount(article),
      likes: getLikesCount(article),
    },
    trend: article.trending_score ?? 20,
    link: article.id ? `/news/${article.id}` : '/news',
  })),
].filter((item) => item.id && item.title);

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
        client.get('/courses?skip=0&limit=4'),
        client.get('/community/projects/cycle'),
        client.get('/marketplace/products?page=1&limit=4&sort_by=popular'),
        client.get('/creators/top?limit=4'),
        client.get('/news/?page=1&limit=4'),
        client.get('/community/posts?page=1&limit=10'),
      ]);

      const courses = coursesRes.status === 'fulfilled' ? safeList(coursesRes.value) : [];
      const projects = projectsRes.status === 'fulfilled' ? safeList(projectsRes.value) : [];
      const products = productsRes.status === 'fulfilled' ? safeList(productsRes.value) : [];
      const news = newsRes.status === 'fulfilled' ? safeList(newsRes.value) : [];
      const posts = postsRes.status === 'fulfilled' ? safeList(postsRes.value) : [];
      const publicProjects = projects.map((project) => ({
        ...project,
        homeLink: '/vibe/projects',
      }));
      const publicCourses = courses.filter((course) => course.status !== 'draft');

      if (coursesRes.status === 'fulfilled') {
        setPopularCourses(courses);
      }

      if (projectsRes.status === 'fulfilled') {
        setPopularProjects(publicProjects);
      }

      if (productsRes.status === 'fulfilled') {
        setPopularProducts(products);
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
        setExternalNews(news);
      }

      if (postsRes.status === 'fulfilled') {
        setCommunityPosts(posts);
      }

      setTrendingItems(buildTrendingItems({
        courses: publicCourses,
        projects: publicProjects,
        products,
        posts,
        news,
      }));

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
