import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Code2, FolderGit2, Rocket, GitFork, Eye, 
  ThumbsUp, Download, Star, Clock, Users,
  Plus, ArrowRight, Zap, Sparkles
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import PropTypes from 'prop-types';

const getProjectImageUrl = (project) =>
  project.image ||
  project.image_url ||
  project.thumbnail_url ||
  project.cover_image ||
  project.preview_image ||
  project.thumbnail ||
  null;

const getProjectFallbackVisual = (type) => {
  const normalizedType = (type || '').toLowerCase();
  if (normalizedType.includes('vue')) {
    return 'from-emerald-500/80 via-green-500/55 to-slate-950';
  }
  if (normalizedType.includes('node') || normalizedType.includes('api')) {
    return 'from-green-500/80 via-teal-500/55 to-slate-950';
  }
  if (normalizedType.includes('mobile') || normalizedType.includes('native')) {
    return 'from-orange-500/80 via-pink-500/55 to-slate-950';
  }
  if (normalizedType.includes('next')) {
    return 'from-cyan-500/80 via-blue-500/55 to-slate-950';
  }
  return 'from-purple-500/80 via-pink-500/55 to-slate-950';
};

const ProjectCover = ({ project, children }) => {
  const imageUrl = getProjectImageUrl(project);

  return (
    <div
      className={`h-32 bg-gradient-to-br ${imageUrl ? 'from-slate-800 to-slate-950' : getProjectFallbackVisual(project.type)} rounded-t-xl relative overflow-hidden`}
      style={imageUrl ? {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {!imageUrl && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-5 -bottom-8 h-32 w-32 rounded-full border-[18px] border-white/10" />
          <Code2 className="absolute -right-3 -bottom-7 h-28 w-28 text-white/20" />
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
      {children}
    </div>
  );
};

ProjectCover.propTypes = {
  project: PropTypes.shape({
    type: PropTypes.string,
    image: PropTypes.string,
    image_url: PropTypes.string,
    thumbnail_url: PropTypes.string,
    cover_image: PropTypes.string,
    preview_image: PropTypes.string,
    thumbnail: PropTypes.string,
  }).isRequired,
  children: PropTypes.node,
};

const ProjectsSection = ({ projects = [] }) => {
  // Données de démonstration
  const demoProjects = {
    recent: [
      {
        id: '1',
        name: 'Application Météo',
        type: 'React',
        views: 1234,
        likes: 89,
        updatedAt: '2024-03-15'
      },
      {
        id: '2',
        name: 'Dashboard Admin',
        type: 'Vue.js',
        views: 2345,
        likes: 156,
        updatedAt: '2024-03-14'
      },
      {
        id: '3',
        name: 'API GraphQL',
        type: 'Node.js',
        views: 3456,
        likes: 234,
        updatedAt: '2024-03-13'
      },
      {
        id: '4',
        name: 'Mobile App',
        type: 'React Native',
        views: 4567,
        likes: 345,
        updatedAt: '2024-03-12'
      }
    ],
    popular: [
      {
        id: '5',
        name: 'E-commerce Platform',
        type: 'Next.js',
        views: 15678,
        likes: 1234,
        downloads: 567,
        author: 'Jean Dupont'
      },
      {
        id: '6',
        name: 'Blog System',
        type: 'Django',
        views: 12345,
        likes: 987,
        downloads: 456,
        author: 'Marie Martin'
      },
      {
        id: '7',
        name: 'Auth Service',
        type: 'Express',
        views: 10987,
        likes: 876,
        downloads: 345,
        author: 'Pierre Durand'
      },
      {
        id: '8',
        name: 'Portfolio Template',
        type: 'HTML/CSS',
        views: 9876,
        likes: 765,
        downloads: 234,
        author: 'Sophie Bernard'
      }
    ],
    templates: [
      {
        id: '9',
        name: 'Dashboard Template',
        category: 'Admin',
        price: 29.99,
        isFree: false,
        downloads: 1234,
        rating: 4.8
      },
      {
        id: '10',
        name: 'Landing Page',
        category: 'Marketing',
        price: 0,
        isFree: true,
        downloads: 5678,
        rating: 4.9
      },
      {
        id: '11',
        name: 'E-commerce Template',
        category: 'Shop',
        price: 49.99,
        isFree: false,
        downloads: 3456,
        rating: 4.7
      },
      {
        id: '12',
        name: 'Blog Template',
        category: 'Content',
        price: 0,
        isFree: true,
        downloads: 7890,
        rating: 4.6
      }
    ]
  };

  const recentProjects = projects.length > 0 ? projects : demoProjects.recent;
  const popularProjects = demoProjects.popular;
  const templates = demoProjects.templates;

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">⚡ Projets et Création</h2>
            <p className="text-sm text-muted-foreground">Créez, partagez et collaborez</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/vibe/projects/create">
            <Button className="bg-purple-500 hover:bg-purple-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau projet
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs pour les différentes catégories */}
      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="recent">Projets récents</TabsTrigger>
          <TabsTrigger value="popular">Projets populaires</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Onglet : Projets récents */}
        <TabsContent value="recent">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentProjects.map((project) => (
              <Link to={project.homeLink || `/vibe/projects/${project.id}`} key={project.id}>
                <Card className="bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 group">
                  <ProjectCover project={project}>
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline" className="bg-black/50 text-white border-0 backdrop-blur-sm">
                        {project.type}
                      </Badge>
                    </div>
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white/80 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>Mis à jour récemment</span>
                    </div>
                  </ProjectCover>
                  <div className="p-4">
                    <h3 className="font-bold text-foreground mb-2 group-hover:text-purple-400 transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {project.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" /> {project.likes}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* Onglet : Projets populaires */}
        <TabsContent value="popular">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularProjects.map((project) => (
              <Link to={project.homeLink || `/vibe/projects/${project.id}`} key={project.id}>
                <Card className="bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 group">
                  <ProjectCover project={project}>
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline" className="bg-blue-500/80 text-white border-0">
                        🔥 Populaire
                      </Badge>
                    </div>
                  </ProjectCover>
                  <div className="p-4">
                    <h3 className="font-bold text-foreground mb-1 group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">par {project.author}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {project.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" /> {project.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" /> {project.downloads}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* Onglet : Templates */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <Link to={`/vibe/templates/${template.id}`} key={template.id}>
                <Card className="bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105 group">
                  <div className="h-32 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-t-xl relative">
                    <div className="absolute top-3 right-3">
                      {template.isFree ? (
                        <Badge variant="outline" className="bg-green-500/80 text-white border-0">
                          Gratuit
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-[#ff6b35] text-white border-0">
                          {template.price}€
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-foreground mb-1 group-hover:text-green-400 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">{template.category}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-3 h-3" /> {template.rating}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Download className="w-3 h-3" /> {template.downloads}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-green-400">
                        Utiliser
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Section inspiration / vibe-coding */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vibe-coding avec IA */}
        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">🎨 Vibe-coding avec IA</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Créez des projets en quelques clics grâce à notre assistant IA
              </p>
              <Link to="/vibe/ai-assistant">
                <Button variant="outline" className="border-purple-500/30 text-purple-400">
                  Essayer l'IA <Zap className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <Card className="p-6 bg-card/60 border border-border/30">
          <h3 className="font-bold text-foreground mb-3">🚀 Actions rapides</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/vibe/projects/create">
              <Button size="sm" className="w-full bg-purple-500 hover:bg-purple-600 text-white">
                <FolderGit2 className="w-4 h-4 mr-1" />
                Nouveau projet
              </Button>
            </Link>
            <Link to="/vibe/templates">
              <Button size="sm" variant="outline" className="w-full border-purple-500/30 text-purple-400">
                <Rocket className="w-4 h-4 mr-1" />
                Templates
              </Button>
            </Link>
            <Link to="/vibe/explore">
              <Button size="sm" variant="outline" className="w-full border-blue-500/30 text-blue-400">
                <Eye className="w-4 h-4 mr-1" />
                Explorer
              </Button>
            </Link>
            <Link to="/vibe/collaborate">
              <Button size="sm" variant="outline" className="w-full border-green-500/30 text-green-400">
                <Users className="w-4 h-4 mr-1" />
                Collaborer
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Lien vers tous les projets */}
      <div className="mt-6 text-center">
        <Link to="/vibe/projects">
          <Button variant="ghost" className="text-purple-400">
            Voir tous les projets <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

// PropTypes pour la documentation
ProjectsSection.propTypes = {
  projects: PropTypes.array
};

export default ProjectsSection;
