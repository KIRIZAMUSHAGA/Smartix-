import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, HelpCircle, Search, ChevronDown, MessageCircle,
  Target, Zap, Globe, Shield, Heart, GraduationCap,
  MessageSquare, Lock, FileText, Mail, Phone, BookOpen, Users,
  ChevronRight, ArrowLeft, TrendingUp, ShoppingBag, Newspaper, Brain
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import './About/AboutPage.css';
import PropTypes from 'prop-types';

const FAQ = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleItem = (id) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copié !', {
      description: `${email} a été copié dans le presse-papier`
    });
  };

  // ✅ FAQ enrichies avec les 5 piliers de Smartix
  const faqs = [
    {
      id: 1,
      category: "📚 Apprendre",
      icon: <BookOpen className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "Quels cours sont disponibles sur Smartix ?",
          a: "Smartix propose des cours dans toutes les disciplines : Mathématiques, Physique, Chimie, Informatique, Comptabilité OHADA, Littérature, Économie, et bien d'autres. Les cours sont structurés du collège à l'université."
        },
        {
          q: "Comment suivre ma progression ?",
          a: "Ton tableau de bord affiche ton niveau, tes points XP, tes badges gagnés, et ta progression dans chaque matière. Un système de gamification te motive à avancer chaque jour."
        },
        {
          q: "Les cours sont-ils certifiés ?",
          a: "Oui, nos contenus sont élaborés avec des établissements partenaires comme le Lycée Hélène de Chappotin et validés par des experts pédagogiques du Lotseke Center."
        }
      ]
    },
    {
      id: 2,
      category: "⚡ Créer",
      icon: <Zap className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "Qu'est-ce que le vibe-coding ?",
          a: "Le vibe-coding est une nouvelle façon de programmer assistée par l'IA. Tu décris ce que tu veux créer, et l'IA génère le code pour toi. Idéal pour débuter en programmation ou accélérer tes projets."
        },
        {
          q: "Puis-je créer des projets sans savoir coder ?",
          a: "Absolument ! Grâce à l'assistant IA et aux templates prêts à l'emploi, tu peux créer tes premiers projets même sans expérience en programmation."
        },
        {
          q: "Mes projets sont-ils privés ?",
          a: "Tu choisis la visibilité de tes projets : privé (visible seulement par toi), partagé (visible par la communauté), ou public (visible par tous)."
        }
      ]
    },
    {
      id: 3,
      category: "👥 Communauté",
      icon: <Users className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "Comment interagir avec les autres étudiants ?",
          a: "Tu peux publier tes fiches, partager tes réussites, commenter les publications des autres, rejoindre des groupes d'étude par matière, et participer à des challenges éducatifs."
        },
        {
          q: "Comment créer un groupe d'étude ?",
          a: "Depuis la section Groupes, clique sur 'Créer un groupe', choisis une matière, et invite tes camarades à rejoindre pour apprendre ensemble."
        },
        {
          q: "Mes données sont-elles protégées ?",
          a: "Absolument. La sécurité et la confidentialité sont nos priorités. Vos données sont chiffrées et ne servent qu'à personnaliser votre expérience éducative."
        }
      ]
    },
    {
      id: 4,
      category: "🛒 Marketplace",
      icon: <ShoppingBag className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "Puis-je vendre mes créations sur Smartix ?",
          a: "Oui ! Tu peux vendre tes ebooks, formations, templates, outils et ressources numériques sur le marketplace Smartix. Deviens créateur et monétise ton travail."
        },
        {
          q: "Comment fixer le prix de mes produits ?",
          a: "Nous te conseillons de regarder les prix des produits similaires. Tu peux commencer avec des prix attractifs pour te faire connaître, puis ajuster selon la demande."
        },
        {
          q: "Quelle commission prend Smartix ?",
          a: "Smartix prélève une commission de 10% sur chaque vente pour maintenir la plateforme. Le reste (90%) te revient intégralement."
        }
      ]
    },
    {
      id: 5,
      category: "📰 Actualités",
      icon: <Newspaper className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "D'où viennent les actualités sur Smartix ?",
          a: "Nos actualités sont agrégées à partir de sources externes de confiance comme BBC, RFI, Reuters, et Le Monde, avec un focus sur la technologie, l'IA et l'innovation."
        },
        {
          q: "Puis-je personnaliser mon flux d'actualités ?",
          a: "Oui ! Tu peux choisir tes centres d'intérêt (technologie, éducation, business, etc.) pour ne recevoir que les actualités qui t'intéressent."
        }
      ]
    },
    {
      id: 6,
      category: "🧠 IA Assistant",
      icon: <Brain className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "Comment l'IA m'aide-t-elle ?",
          a: "L'IA Smartix agit comme un tuteur personnel 24h/24. Elle explique les concepts complexes, aide à la résolution d'exercices et adapte le parcours d'apprentissage à ton rythme."
        },
        {
          q: "L'IA comprend-elle toutes les matières ?",
          a: "Oui, l'IA Smartix est entraînée pour toutes les matières : Maths, Sciences, Informatique, Comptabilité, Littérature, et bien d'autres. Elle s'adapte à ton niveau et à ta filière."
        }
      ]
    },
    {
      id: 7,
      category: "🔧 Technique & Compte",
      icon: <Shield className="w-6 h-6 text-[#ff6b35]" />,
      questions: [
        {
          q: "Comment créer un compte ?",
          a: "Clique sur 'Commencer gratuitement' sur la page d'accueil, remplis le formulaire avec ton nom, email et mot de passe, puis accepte les conditions d'utilisation."
        },
        {
          q: "Smartix est-il vraiment gratuit ?",
          a: "Oui ! Smartix est 100% gratuit. Tu as accès à tous les cours, l'IA assistant, et la communauté sans aucun frais."
        },
        {
          q: "Puis-je utiliser Smartix sur mobile ?",
          a: "Absolument ! Smartix est accessible sur tous les appareils : ordinateur, tablette et mobile. Une application mobile est en développement."
        }
      ]
    }
  ];

  // ✅ Chiffres clés
  const stats = [
    { value: "500+", label: "Cours disponibles", icon: BookOpen },
    { value: "10k+", label: "Utilisateurs actifs", icon: Users },
    { value: "1200+", label: "Projets créés", icon: Zap },
    { value: "350+", label: "Produits vendus", icon: ShoppingBag }
  ];

  const allQuestions = faqs.flatMap(cat => cat.questions.map(q => ({...q, category: cat.category})));
  const filteredFaqs = searchQuery 
    ? allQuestions.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div className="about-page min-h-screen bg-[#0f172a] text-white overflow-x-hidden relative">
      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 p-3 rounded-full text-white/30 transition-all duration-300 hover:text-[#ff6b35] hover:scale-110 active:scale-95 group ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        aria-label="Retour en haut"
      >
        <ChevronRight className="w-8 h-8 -rotate-90 transition-transform group-hover:-translate-y-1" />
      </button>

      {/* Back Button */}
      <button 
        onClick={() => navigate('/auth', { replace: true, state: { openMenu: true } })}
        className="absolute top-6 left-6 z-[100] w-12 h-12 bg-white/10 hover:bg-[#ff6b35] rounded-full flex items-center justify-center transition-all backdrop-blur-md group"
      >
        <ArrowLeft className="w-6 h-6 text-white group-hover:scale-110" />
      </button>

      {/* Hero Section */}
      <section className="relative pt-16 pb-12 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ff6b35]/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-sm mb-8">
            <HelpCircle className="w-4 h-4 text-[#ff6b35]" />
            <span className="font-medium text-white/80 tracking-wide uppercase text-[10px]">Aide & Support</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            Comment pouvons-nous <br />
            <span className="text-[#ff6b35]">vous aider ?</span>
          </h1>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mt-12 relative group">
            <div className="absolute inset-0 bg-[#ff6b35]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
              <input 
                type="text"
                placeholder="Rechercher une réponse..."
                className="w-full bg-white/5 border border-white/10 rounded-full py-5 pl-14 pr-6 text-lg focus:outline-none focus:border-[#ff6b35]/50 transition-all backdrop-blur-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <stat.icon className="w-8 h-8 text-[#ff6b35] mx-auto mb-3" />
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-xs text-white/40 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          {filteredFaqs ? (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-8 text-white/50">{filteredFaqs.length} résultats trouvés</h2>
              {filteredFaqs.map((item, i) => (
                <div key={i} className="p-8 rounded-[32px] bg-white/5 border border-white/10">
                  <h3 className="text-xl font-bold mb-4 text-[#ff6b35]">{item.q}</h3>
                  <p className="text-white/60 leading-relaxed">{item.a}</p>
                  <p className="text-xs text-white/30 mt-4">Catégorie: {item.category}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-12">
              {faqs.map((category) => (
                <div key={category.id} className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-[#ff6b35]/10 rounded-2xl">
                      {category.icon}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">{category.category}</h2>
                  </div>
                  <div className="space-y-4">
                    {category.questions.map((item, idx) => {
                      const id = `${category.id}-${idx}`;
                      const isOpen = openItems.includes(id);
                      return (
                        <div key={idx} className={`rounded-[32px] border transition-all ${isOpen ? 'bg-white/5 border-[#ff6b35]/30' : 'bg-white/5 border-white/10'}`}>
                          <button 
                            onClick={() => toggleItem(id)}
                            className="w-full p-6 text-left flex items-center justify-between gap-4"
                          >
                            <span className={`font-bold text-lg ${isOpen ? 'text-[#ff6b35]' : 'text-white/80'}`}>{item.q}</span>
                            <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180 text-[#ff6b35]' : 'text-white/30'}`} />
                          </button>
                          {isOpen && (
                            <div className="px-6 pb-6 text-white/50 leading-relaxed animate-fade-in">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto p-12 rounded-[48px] bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] text-center shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <MessageCircle className="w-16 h-16 mx-auto mb-8 text-white drop-shadow-lg" />
          <h2 className="text-3xl md:text-5xl font-black mb-6">Encore des questions ?</h2>
          <p className="text-white/90 text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Notre équipe est là pour vous accompagner. Contactez-nous pour toute assistance personnalisée.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="mailto:kirizamushaga01@gmail.com"
              className="inline-flex items-center justify-center bg-white text-[#ff6b35] hover:bg-white/90 px-10 h-16 rounded-full font-bold text-xl shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              Écrire au support
            </a>
            <button
              onClick={() => handleCopyEmail('kirizamushaga01@gmail.com')}
              className="inline-flex items-center justify-center bg-white/20 hover:bg-white/30 text-white px-8 h-16 rounded-full font-bold text-lg transition-all"
            >
              <Mail className="w-5 h-5 mr-2" />
              Copier l'email
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8 tracking-tighter opacity-80">SMARTIX</h2>
          <p className="text-white/30 text-sm mb-8">© {new Date().getFullYear()} Smartix Platform. Tous droits réservés.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
            <button 
              onClick={() => setActiveModal('privacy')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <Lock className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Confidentialité</span>
            </button>
            <button 
              onClick={() => setActiveModal('terms')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <FileText className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Conditions</span>
            </button>
            <button 
              onClick={() => setActiveModal('contact')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <Mail className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Contact</span>
            </button>
          </div>
        </div>
      </footer>

        {/* Modals */}
      <Dialog open={activeModal !== null} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="bg-[#1e293b] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              {activeModal === 'privacy' && <><Lock className="text-[#ff6b35]" /> Politique de Confidentialité</>}
              {activeModal === 'terms' && <><FileText className="text-[#ff6b35]" /> Conditions d'Utilisation</>}
              {activeModal === 'contact' && <><Mail className="text-[#ff6b35]" /> Contactez-nous</>}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 space-y-4 text-white/70 leading-relaxed">
            {activeModal === 'privacy' && (
              <>
                <p>Chez Smartix, nous prenons votre vie privée très au sérieux. Vos données personnelles sont protégées et ne sont jamais partagées sans votre consentement explicite.</p>
                <h4 className="text-white font-bold mt-4">Collecte des données</h4>
                <p>Nous collectons uniquement les informations nécessaires à votre progression pédagogique : nom, email et parcours scolaire.</p>
              </>
            )}

            {activeModal === 'terms' && (
              <>
                <p>En utilisant Smartix, vous acceptez de respecter nos règles communautaires pour garantir un environnement d'apprentissage bienveillant et productif.</p>
                <h4 className="text-white font-bold mt-4">Engagement de l'utilisateur</h4>
                <p>L'utilisateur s'engage à utiliser la plateforme à des fins éducatives uniquement et à respecter les droits de propriété intellectuelle des contenus proposés.</p>
              </>
            )}

            {activeModal === 'contact' && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <Mail className="w-6 h-6 text-[#ff6b35]" />
                  <div>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Email Direct</p>
                    <button 
                      onClick={() => handleCopyEmail('kirizamushaga01@gmail.com')}
                      className="text-lg font-medium text-white hover:text-[#ff6b35] transition-colors"
                    >
                      kirizamushaga01@gmail.com
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <Phone className="w-6 h-6 text-[#ff6b35]" />
                  <div>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Téléphone / WhatsApp</p>
                    <a href="tel:+243820740027" className="text-lg font-medium text-white hover:text-[#ff6b35] transition-colors">
                      +243 820 740 027
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

FAQ.propTypes = {};

export default FAQ;
