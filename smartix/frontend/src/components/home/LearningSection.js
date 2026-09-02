import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Play, Award, Target, Clock, 
  TrendingUp, Star, Users, ChevronRight,
  Trophy, Zap, Sparkles, ArrowRight
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import PropTypes from 'prop-types';

const LearningSection = ({ user, lastCourse, popularCourses = [], stats = {} }) => {
  // Données de démonstration pour les cours populaires
  const demoPopularCourses = [
    {
      id: '1',
      title: 'Introduction à React 18',
      level: 'Débutant',
      duration: '8h',
      author: 'Jean Dupont',
      rating: 4.8,
      students: 1234,
      image: null
    },
    {
      id: '2',
      title: 'Maîtrisez TypeScript',
      level: 'Intermédiaire',
      duration: '12h',
      author: 'Marie Martin',
      rating: 4.9,
      students: 2341,
      image: null
    },
    {
      id: '3',
      title: 'Développement Full-Stack',
      level: 'Avancé',
      duration: '20h',
      author: 'Pierre Durand',
      rating: 4.7,
      students: 3456,
      image: null
    },
    {
      id: '4',
      title: 'UI/UX Design Principles',
      level: 'Débutant',
      duration: '6h',
      author: 'Sophie Bernard',
      rating: 4.8,
      students: 4567,
      image: null
    }
  ];

  const displayCourses = popularCourses.length > 0 ? popularCourses : demoPopularCourses;

  // Calcul des statistiques d'apprentissage
  const totalCourses = stats?.courses || 0;
  const completedCourses = user?.courses_completed || 0;
  const inProgressCourses = totalCourses - completedCourses;
  const completionRate = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  // Prochain objectif
  const nextGoal = Math.min(completedCourses + 1, 5);
  const goalProgress = (completedCourses / 5) * 100;

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex items-center justify-center shadow-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">📚 Apprentissage</h2>
            <p className="text-sm text-muted-foreground">Continuez votre progression</p>
          </div>
        </div>
        <Link to="/courses">
          <Button variant="ghost" className="text-[#ff6b35] hover:text-[#ff8c61] hover:bg-[#ff6b35]/10 font-bold">
            Voir tous les cours <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne de gauche : Cours en cours et progression */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Cours en cours */}
          {lastCourse ? (
            <Card className="p-6 bg-card/60 border border-border/30 hover:bg-card/80 transition-all">
              <div className="flex items-start gap-4">
                {/* Miniature du cours */}
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex-shrink-0 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">EN COURS</Badge>
                    <span className="text-xs text-muted-foreground">Chapitre 4 sur 12</span>
                  </div>
                  
                  <h3 className="font-bold text-foreground text-lg mb-1">
                    {lastCourse.title || 'Introduction au développement'}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {lastCourse.author || 'Smartix Academy'}
                  </p>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-bold text-[#ff6b35]">{lastCourse.progress || 45}%</span>
                    </div>
                    <Progress value={lastCourse.progress || 45} max={100} className="h-2" />
                  </div>

                  <Button className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white">
                    <Play className="w-4 h-4 mr-2" />
                    Reprendre le cours
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-card/60 border border-border/30 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">Aucun cours en cours</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Commencez votre premier cours dès maintenant
              </p>
              <Link to="/courses">
                <Button className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white">
                  Explorer les cours
                </Button>
              </Link>
            </Card>
          )}

          {/* Cours populaires */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#ff6b35]" />
              Cours populaires
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayCourses.slice(0, 2).map((course) => (
                <Link to={`/courses/${course.id}`} key={course.id}>
                  <Card className="p-4 bg-card/60 border border-border/30 hover:bg-card/80 transition-all hover:scale-105">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#ff6b35]/20 to-[#ff8c61]/20 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-[#ff6b35]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-foreground text-sm mb-1 line-clamp-1">
                          {course.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">{course.author}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-3 h-3" /> {course.rating}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3 h-3" /> {course.students}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne de droite : Progression et objectifs */}
        <div className="space-y-4">
          
          {/* Carte de progression */}
          <Card className="p-6 bg-card/60 border border-border/30">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#ff6b35]" />
              Votre progression
            </h3>

            <div className="space-y-4">
              {/* Statistiques */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-card/40 rounded-xl">
                  <div className="text-2xl font-black text-[#ff6b35]">{totalCourses}</div>
                  <div className="text-xs text-muted-foreground">Cours total</div>
                </div>
                <div className="text-center p-3 bg-card/40 rounded-xl">
                  <div className="text-2xl font-black text-green-400">{completedCourses}</div>
                  <div className="text-xs text-muted-foreground">Terminés</div>
                </div>
                <div className="text-center p-3 bg-card/40 rounded-xl">
                  <div className="text-2xl font-black text-blue-400">{inProgressCourses}</div>
                  <div className="text-xs text-muted-foreground">En cours</div>
                </div>
                <div className="text-center p-3 bg-card/40 rounded-xl">
                  <div className="text-2xl font-black text-yellow-400">{completionRate}%</div>
                  <div className="text-xs text-muted-foreground">Taux</div>
                </div>
              </div>

              {/* Barre de progression globale */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progression globale</span>
                  <span className="font-bold text-[#ff6b35]">{completionRate}%</span>
                </div>
                <Progress value={completionRate} max={100} className="h-2" />
              </div>
            </div>
          </Card>

          {/* Objectifs */}
          <Card className="p-6 bg-card/60 border border-border/30">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Objectifs
            </h3>

            <div className="space-y-4">
              {/* Objectif 5 cours */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-foreground">5 cours complétés</span>
                  <span className="font-bold text-[#ff6b35]">{completedCourses}/5</span>
                </div>
                <Progress value={goalProgress} max={100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Prochain objectif : {nextGoal} cours
                </p>
              </div>

              {/* Objectif hebdomadaire */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-foreground">Objectif hebdomadaire</span>
                  <span className="font-bold text-green-400">{Math.min(completedCourses, 3)}/3</span>
                </div>
                <Progress value={(Math.min(completedCourses, 3) / 3) * 100} max={100} className="h-2" />
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
                  <Award className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">Apprenti Smartix</p>
                  <p className="text-[10px] text-muted-foreground">Débloqué après 1 cours</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Recommandation IA */}
          <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-foreground mb-1">Recommandé pour vous</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Basé sur votre progression, nous vous recommandons le cours "TypeScript avancé"
                </p>
                <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400">
                  Voir la recommandation
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// PropTypes pour la documentation
LearningSection.propTypes = {
  user: PropTypes.object,
  lastCourse: PropTypes.shape({
    title: PropTypes.string,
    author: PropTypes.string,
    progress: PropTypes.number
  }),
  popularCourses: PropTypes.array,
  stats: PropTypes.shape({
    courses: PropTypes.number
  })
};

export default LearningSection;
