import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { 
  HelpCircle, Mail, MessageCircle, Search,
  ArrowLeft, Send, CheckCircle, Code2, Rocket,
  Sparkles, Database, Terminal, Bug, Star, GitFork,
  ShoppingBag, Download, Eye, Users, Award,
  Cpu, Globe, Smartphone, Zap, Shield, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT ACCORDÉON
// =============================
const ChevronDown = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// =============================
// 2️⃣ QUESTIONS PAR CATÉGORIE
// =============================

// 📚 CATÉGORIE : GÉNÉRAL
const generalQuestions = [
  {
    question: "Comment créer un compte ?",
    answer: "Clique sur 'Commencer gratuitement' sur la page d'accueil, remplis le formulaire avec ton nom, email et mot de passe, puis accepte les conditions d'utilisation. Tu recevras un email de confirmation."
  },
  {
    question: "Smartix est-il vraiment gratuit ?",
    answer: "Oui ! Smartix est 100% gratuit. Tu as accès à tous les cours, l'IA assistant, la communauté, le Vibe-coding, et le marketplace sans aucun frais."
  },
  {
    question: "Comment suivre ma progression ?",
    answer: "Ta progression est affichée sur ton profil. Tu peux voir tes badges, points, cours complétés et statistiques d'apprentissage. La barre de progression te montre ton avancement dans chaque cours."
  }
];

// ⚡ CATÉGORIE : VIBE-CODING
const vibeCodingQuestions = [
  {
    question: "Qu'est-ce que Vibe-coding ?",
    answer: "Vibe-coding est notre plateforme de création d'applications. Tu peux créer des projets React, Node.js, ou mobiles avec un éditeur intégré, des templates, et même une assistance IA pour générer du code automatiquement."
  },
  {
    question: "Comment créer mon premier projet ?",
    answer: "Va dans la section 'Vibe-coding', clique sur 'Créer un projet', choisis entre un template, un projet vide, ou une génération IA. Donne un nom à ton projet, sélectionne le type (React, Node, etc.), et c'est parti !"
  },
  {
    question: "C'est quoi l'éditeur IA ?",
    answer: "L'éditeur IA est un mode spécial de création qui te permet de décrire ton application en langage naturel. L'IA génère le code, la structure du projet, et peut même ajouter des fonctionnalités sur demande. Idéal pour prototyper rapidement !"
  },
  {
    question: "Comment utiliser les templates ?",
    answer: "Les templates sont des projets pré-faits que tu peux utiliser comme point de départ. Va dans 'Templates', choisis celui qui t'intéresse, et clique sur 'Utiliser'. Le template sera copié dans tes projets."
  },
  {
    question: "Puis-je exporter mon projet ?",
    answer: "Oui ! Dans l'éditeur, clique sur 'Exporter' pour télécharger tous les fichiers de ton projet au format ZIP. Tu peux aussi le déployer directement depuis la plateforme."
  },
  {
    question: "Comment lancer mon application ?",
    answer: "Dans l'éditeur, clique sur le bouton 'Run' (▶️) en bas de l'écran. Le build va démarrer, et tu verras une preview de ton application en direct. Tu peux aussi l'ouvrir dans un nouvel onglet."
  },
  {
    question: "Qu'est-ce que le shell interactif ?",
    answer: "Le shell est un terminal intégré dans l'éditeur IA. Tu peux y exécuter des commandes comme 'npm install', 'git status', ou 'ls'. C'est comme si tu avais un terminal directement dans ton navigateur !"
  },
  {
    question: "Comment déboguer mon application ?",
    answer: "Utilise l'onglet 'Debug' dans l'éditeur IA. Tu verras les erreurs, les logs, et les performances de ton application. La console affiche aussi les messages d'erreur en temps réel."
  },
  {
    question: "Puis-je collaborer avec d'autres développeurs ?",
    answer: "Oui ! Tu peux partager ton projet en cliquant sur 'Partager'. Tu pourras inviter d'autres utilisateurs par email et leur donner des droits (lecteur, éditeur, administrateur)."
  }
];

// 🛒 CATÉGORIE : MARKETPLACE APPLICATIONS
const marketplaceQuestions = [
  {
    question: "Comment publier une application ?",
    answer: "Dans l'éditeur de ton projet, termine ton application, puis va dans 'Publier'. Remplis les informations (nom, description, catégorie, tags) et confirme. Ton application sera disponible dans le marketplace après validation."
  },
  {
    question: "Comment télécharger une application ?",
    answer: "Va dans la section 'Marketplace', trouve l'application qui t'intéresse, et clique sur 'Télécharger'. L'APK sera généré et prêt à être installé sur ton appareil Android."
  },
  {
    question: "Comment noter une application ?",
    answer: "Après avoir téléchargé et testé une application, retourne sur sa page et donne une note de 1 à 5 étoiles. Tu peux aussi laisser un commentaire pour aider les autres utilisateurs."
  },
  {
    question: "Qu'est-ce qu'un fork ?",
    answer: "Forker une application signifie créer une copie du projet original pour le modifier à ta guise. C'est parfait pour apprendre ou améliorer une application existante. Tous tes forks sont visibles dans ton profil."
  },
  {
    question: "Comment trouver une application tendance ?",
    answer: "Va dans 'Marketplace' et trie par 'Tendances'. Les applications les plus populaires du moment remontent en haut de la liste. Tu peux aussi filtrer par catégorie ou note."
  },
  {
    question: "Puis-je vendre mes applications ?",
    answer: "Oui ! Tu peux définir un prix pour ton application lors de la publication. Les utilisateurs pourront l'acheter et tu recevras une commission. Pour l'instant, le paiement se fait via Stripe."
  },
  {
    question: "Comment sont calculées les notes ?",
    answer: "La note moyenne est calculée à partir de tous les avis des utilisateurs. Nous utilisons un système de Bayesian rating pour éviter les biais (une app avec 1 avis 5⭐ n'a pas le même poids qu'une app avec 100 avis 4.5⭐)."
  }
];

// 📊 CATÉGORIE : ANALYTICS
const analyticsQuestions = [
  {
    question: "Où voir les statistiques de mon application ?",
    answer: "Dans l'onglet 'Analytics' de ton projet, tu peux voir le nombre de vues, téléchargements, installations, et utilisateurs actifs. Les données sont mises à jour en temps réel."
  },
  {
    question: "Comment interpréter les métriques ?",
    answer: "Les vues sont le nombre de fois que ta page a été visitée. Les téléchargements sont le nombre d'APK téléchargés. Les installations sont les vrais lancements de l'application. Le taux de conversion (téléchargements → installations) est un bon indicateur de qualité."
  },
  {
    question: "C'est quoi le taux de rétention ?",
    answer: "La rétention mesure le nombre d'utilisateurs qui reviennent utiliser ton application après la première installation. Un bon taux de rétention à J7 (7 jours) est supérieur à 20%."
  },
  {
    question: "Comment fonctionne la recherche ?",
    answer: "La recherche utilise un moteur full-text qui indexe le nom, la description, et les tags des applications. Tu peux aussi filtrer par catégorie, note minimum, et trier par popularité ou nouveauté."
  }
];

// 🔧 CATÉGORIE : DÉPANNAGE
const troubleshootingQuestions = [
  {
    question: "Mon application ne se lance pas, que faire ?",
    answer: "Vérifie les logs de build dans l'onglet 'Terminal'. Les erreurs y sont affichées. Les problèmes courants : port déjà utilisé, dépendances manquantes, ou erreur de syntaxe. Le shell interactif peut aussi t'aider à diagnostiquer."
  },
  {
    question: "Pourquoi mon build échoue ?",
    answer: "Les builds échouent souvent à cause de dépendances manquantes. Lance 'npm install' dans le shell pour réinstaller les packages. Vérifie aussi que ton code ne contient pas d'erreurs de syntaxe."
  },
  {
    question: "Le shell ne répond pas, que faire ?",
    answer: "Rafraîchis la page. Si le problème persiste, vérifie ta connexion internet. Le shell nécessite une connexion WebSocket active. Tu peux aussi cliquer sur 'Stop' puis 'Run' pour redémarrer le processus."
  },
  {
    question: "Mes modifications ne s'affichent pas en preview ?",
    answer: "N'oublie pas de sauvegarder tes fichiers (Ctrl+S). Ensuite, relance le build avec le bouton 'Run'. La preview se recharge automatiquement après un build réussi."
  }
];

// 👥 CATÉGORIE : COMMUNAUTÉ
const communityQuestions = [
  {
    question: "Comment accéder à la communauté ?",
    answer: "Va dans la section 'Feed' pour voir les publications des autres créateurs. Tu peux publier tes projets, commenter, et rejoindre des discussions."
  },
  {
    question: "Comment devenir créateur vérifié ?",
    answer: "Publie au moins 3 applications avec des notes supérieures à 4.0 et reçois plus de 100 téléchargements. Notre équipe examinera ton profil et te donnera le badge vérifié."
  },
  {
    question: "Où trouver de l'aide ?",
    answer: "Tu es déjà au bon endroit ! Le centre d'aide est là pour répondre à tes questions. Tu peux aussi utiliser l'assistant IA pour des questions techniques, ou poster dans la communauté."
  }
];

// 🎯 Fusion de toutes les questions
const allQuestions = [
  ...generalQuestions,
  ...vibeCodingQuestions,
  ...marketplaceQuestions,
  ...analyticsQuestions,
  ...troubleshootingQuestions,
  ...communityQuestions
];

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================
const HelpCenter = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    email: user?.email || '',
    subject: '',
    message: ''
  });

  // Pré-remplir avec les infos utilisateur
  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.full_name || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  // Envoi du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await client.post('/help/contact', {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        user_id: user?.id
      });
      
      toast.success('Message envoyé !', {
        description: 'Nous te répondrons dans les 24 heures',
        duration: 5000
      });
      
      setFormData(prev => ({ ...prev, subject: '', message: '' }));
      setShowContactForm(false);
      
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi', {
        description: 'Veuillez réessayer plus tard'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrer les questions
  const filteredQuestions = allQuestions.filter(q => 
    searchQuery === '' || 
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <HelpCircle className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold">Centre d'aide</h1>
          </div>
          <p className="text-xl text-white/90 max-w-3xl">
            Trouve rapidement des réponses sur Vibe-coding, le marketplace, l'IA assistant, et toute la plateforme Smartix
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Comment pouvons-nous t'aider ?</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Recherche une question sur Vibe-coding, marketplace, analytics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
        </div>

        {/* Quick Questions */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-6 h-6 text-[#00B894]" />
            <h2 className="text-3xl font-bold text-gray-900">Questions fréquentes</h2>
          </div>
          
          {/* Catégories */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">⚡ Vibe-coding</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">🛒 Marketplace</span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">📊 Analytics</span>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">🔧 Dépannage</span>
            <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">👥 Communauté</span>
          </div>
          
          <div className="space-y-4">
            {filteredQuestions.map((item, idx) => (
              <details key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-all group">
                <summary className="font-semibold text-gray-900 text-lg flex items-start gap-3 list-none">
                  <HelpCircle className="w-6 h-6 text-[#00B894] flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{item.question}</span>
                  <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-4 pt-4 border-t border-gray-100 text-gray-700 leading-relaxed pl-9">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
          
          {filteredQuestions.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune question ne correspond à ta recherche</p>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Voir toutes les questions
              </Button>
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div className="bg-gradient-to-br from-[#00B894] to-[#0984E3] rounded-3xl p-12 text-white mb-12">
          <div className="text-center">
            <Mail className="w-16 h-16 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl font-bold mb-4">Besoin d'aide supplémentaire ?</h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Notre équipe de support est là pour t'aider avec Vibe-coding, le marketplace, ou toute autre question !
            </p>
            <Button 
              onClick={() => setShowContactForm(!showContactForm)}
              size="lg" 
              className="bg-white text-[#00B894] hover:bg-gray-50 shadow-xl px-8 py-6 text-lg"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Contacter le support
            </Button>
          </div>
        </div>

        {/* Contact Form */}
        {showContactForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Envoyer un message</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                <Input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ton nom complet"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <Input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="ton.email@example.com"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sujet</label>
                <Input 
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="De quoi veux-tu parler ? (Vibe-coding, Marketplace, Compte...)"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <Textarea 
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  placeholder="Décris ton problème ou ta question en détail..."
                  rows={6}
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="flex gap-4">
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-[#00B894] to-[#0984E3] hover:from-[#00a182] hover:to-[#0773c9] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer le message
                    </>
                  )}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setShowContactForm(false)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}

           {/* Contact Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Autres moyens de nous contacter</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Email</div>
                <a href="mailto:kirizamushaga01@gmail.com" className="text-[#00B894] hover:underline">
                  kirizamushaga01@gmail.com
                </a>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Temps de réponse moyen</div>
                <div className="text-gray-600">Moins de 24 heures</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Communauté</div>
                <div className="text-gray-600">Rejoins notre communauté d'entraide dans la section Feed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

HelpCenter.propTypes = {};

export default HelpCenter;
ChevronDown.propTypes = {
  className: PropTypes.any.isRequired,
};
