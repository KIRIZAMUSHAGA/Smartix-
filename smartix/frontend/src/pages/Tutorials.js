import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 

  Sparkles, PlayCircle, BookOpen, MessageCircle, Users,
  ArrowLeft, CheckCircle, Video, FileText
} from 'lucide-react';
import PropTypes from 'prop-types';

const Tutorials = () => {
  const tutorials = [
    {
      id: 1,
      title: "Comment s'inscrire sur Smartix ?",
      description: "Guide complet pour créer ton compte et configurer ton profil en moins de 2 minutes",
      duration: "3 min",
      type: "video",
      difficulty: "Débutant",
      steps: [
        "Clique sur 'Commencer gratuitement' sur la page d'accueil",
        "Remplis le formulaire avec ton nom, email et mot de passe",
        "Vérifie que ton email est disponible (icône verte)",
        "Accepte les conditions d'utilisation",
        "Clique sur 'S'inscrire gratuitement'",
        "Tu seras automatiquement connecté et redirigé vers ton tableau de bord"
      ],
      thumbnail: "👤"
    },
    {
      id: 2,
      title: "Comment poser une question à l'IA ?",
      description: "Apprends à utiliser l'assistant IA pour obtenir de l'aide sur tes cours",
      duration: "4 min",
      type: "video",
      difficulty: "Débutant",
      steps: [
        "Connecte-toi à ton compte Smartix",
        "Clique sur l'icône 'IA Chat' dans le menu de navigation",
        "Tape ta question dans la zone de texte en bas de l'écran",
        "Sois précis dans ta question pour obtenir une meilleure réponse",
        "Appuie sur Entrée ou clique sur le bouton d'envoi",
        "L'IA te répondra en quelques secondes avec une explication détaillée"
      ],
      thumbnail: "🤖"
    },
    {
      id: 3,
      title: "Comment publier dans la communauté ?",
      description: "Partage tes fiches, exercices et réussites avec d'autres étudiants",
      duration: "5 min",
      type: "guide",
      difficulty: "Débutant",
      steps: [
        "Va dans la section 'Feed' depuis le menu principal",
        "Clique sur le bouton 'Créer une publication'",
        "Choisis le type de contenu : texte, image, ou lien",
        "Écris ton message ou ajoute une description",
        "Ajoute des hashtags pour plus de visibilité (ex: #Comptabilité #OHADA)",
        "Choisis la catégorie appropriée",
        "Clique sur 'Publier'",
        "Ta publication apparaîtra dans le feed de la communauté"
      ],
      thumbnail: "📱"
    },
    {
      id: 4,
      title: "Comment rejoindre un groupe d'étude ?",
      description: "Trouve et rejoins des groupes selon ta matière et ton niveau",
      duration: "3 min",
      type: "guide",
      difficulty: "Débutant",
      steps: [
        "Ouvre la section 'Communauté' ou 'Groupes'",
        "Utilise la barre de recherche pour trouver des groupes par matière",
        "Parcours les groupes recommandés selon ton profil",
        "Clique sur un groupe qui t'intéresse",
        "Lis la description et les règles du groupe",
        "Clique sur 'Rejoindre le groupe'",
        "Tu recevras une notification de confirmation"
      ],
      thumbnail: "👥"
    },
    {
      id: 5,
      title: "Comment suivre un cours ?",
      description: "Accède aux cours et suis ta progression",
      duration: "6 min",
      type: "video",
      difficulty: "Débutant",
      steps: [
        "Va dans la section 'Cours' depuis le menu",
        "Choisis ta matière ou utilise les filtres",
        "Clique sur le cours qui t'intéresse",
        "Commence par le premier chapitre",
        "Regarde les vidéos et lis les contenus",
        "Fais les quiz pour valider ta compréhension",
        "Ta progression est automatiquement sauvegardée"
      ],
      thumbnail: "📚"
    },
    {
      id: 6,
      title: "Comment gagner des badges ?",
      description: "Débloque des récompenses en progressant dans tes études",
      duration: "4 min",
      type: "guide",
      difficulty: "Intermédiaire",
      steps: [
        "Complète des cours entiers pour débloquer des badges",
        "Participe aux challenges quotidiens et hebdomadaires",
        "Atteins des séries de connexion (7 jours, 30 jours, etc.)",
        "Aide d'autres étudiants dans la communauté",
        "Obtiens de bons résultats aux quiz",
        "Consulte ton profil pour voir tous tes badges"
      ],
      thumbnail: "🏆"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour à l'accueil</span>
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <PlayCircle className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold">Tutoriels</h1>
          </div>
          <p className="text-xl text-white/90 max-w-3xl">
            Des guides pas à pas pour maîtriser toutes les fonctionnalités de Smartix
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Introduction */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Apprends à utiliser Smartix en quelques minutes
          </h2>
          <p className="text-lg text-gray-700">
            Nos tutoriels vidéo et guides illustrés te montrent comment tirer le meilleur parti 
            de la plateforme. Que tu sois nouveau ou utilisateur régulier, tu trouveras ici 
            toutes les réponses à tes questions !
          </p>
        </div>

        {/* Tutorials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tutorials.map((tutorial) => (
            <div key={tutorial.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              {/* Thumbnail */}
              <div className="h-48 bg-gradient-to-br from-[#00B894] to-[#0984E3] flex items-center justify-center relative">
                <div className="text-9xl opacity-50">{tutorial.thumbnail}</div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                    {tutorial.type === 'video' ? (
                      <Video className="w-8 h-8 text-white" />
                    ) : (
                      <FileText className="w-8 h-8 text-white" />
                    )}
                  </div>
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
                  {tutorial.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                    {tutorial.difficulty}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                    {tutorial.type === 'video' ? '📹 Vidéo' : '📝 Guide'}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {tutorial.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {tutorial.description}
                </p>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Étapes :</p>
                  <ul className="space-y-1">
                    {tutorial.steps.slice(0, 3).map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{step}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">+{tutorial.steps.length - 3} autres étapes...</p>
                </div>

                <Button className="w-full bg-gradient-to-r from-[#00B894] to-[#0984E3] hover:from-[#00a182] hover:to-[#0773c9]">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Voir le tutoriel
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Help Section */}
        <div className="mt-16 bg-gradient-to-r from-[#00B894] to-[#0984E3] rounded-3xl p-12 text-white text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">Besoin d'aide supplémentaire ?</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Si tu ne trouves pas la réponse que tu cherches, n'hésite pas à contacter notre support !
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/help-center">
              <Button size="lg" className="bg-white text-[#00B894] hover:bg-gray-50 shadow-xl px-8 py-6 text-lg">
                <MessageCircle className="w-5 h-5 mr-2" />
                Contacter le support
              </Button>
            </Link>
            <Link to="/faq">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                <BookOpen className="w-5 h-5 mr-2" />
                Consulter la FAQ
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

Tutorials.propTypes = {};

export default Tutorials;
