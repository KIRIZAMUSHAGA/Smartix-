import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Users, Target, Zap, 
  ChevronRight, ArrowLeft, GraduationCap, Heart,
  Globe, Shield, Award, Rocket, Star,
  Linkedin, Twitter, Github, Mail, Phone,
  Lock, FileText, ExternalLink, Send, X, CheckCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import './AboutPage.css';
import PropTypes from 'prop-types';

const VisionTeamPage = () => {
  const navigate = useNavigate();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerSuccess, setPartnerSuccess] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    email: '',
    organization: '',
    message: '',
  });

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

  // ✅ Partenaires (en dur)
  const partners = [
    {
      name: "OKIM Univers Global",
      role: "Partenaire Technologique",
      description: "Collaboration stratégique pour le développement d'infrastructures numériques robustes.",
      icon: Globe,
      link: "https://okim-univers.com",
      color: "text-[#ff6b35]"
    },
    {
      name: "Lycée Hélène de Chappotin",
      role: "Établissement Pilote",
      description: "Intégration de Smartix dans le parcours pédagogique pour un apprentissage hybride.",
      icon: GraduationCap,
      link: "https://lycee-helene.com",
      color: "text-[#00B894]"
    },
    {
      name: "Lotseke Center",
      role: "Centre de Formation",
      description: "Centre de formation d'excellence accompagnant le déploiement des outils Smartix.",
      icon: Award,
      link: "https://lotseke-center.com",
      color: "text-[#6C5CE7]"
    }
  ];

  // ✅ Équipe (en dur)
  const teamMembers = [
    {
      role: "Fondateur & Visionnaire",
      name: "Kiriza Mushaga",
      description: "Passionné d'éducation et de technologie, créateur de Smartix pour démocratiser le savoir en Afrique.",
      icon: Star,
      social: {
        linkedin: "https://linkedin.com/in/kiriza",
        twitter: "https://twitter.com/kiriza",
        github: "https://github.com/kiriza",
        email: "kiriza@smartix.app"
      }
    },
    {
      role: "Innovation IA",
      name: "L'Équipe Smartix",
      description: "Développent des outils intelligents pour un apprentissage personnalisé et accessible.",
      icon: Zap,
      social: {
        email: "team@smartix.app"
      }
    }
  ];

  // ✅ Valeurs fondamentales
  const values = [
    {
      title: "Accessibilité",
      description: "L'éducation pour tous, sans barrières géographiques ou financières.",
      icon: Globe
    },
    {
      title: "Innovation",
      description: "Des solutions technologiques de pointe adaptées aux réalités africaines.",
      icon: Zap
    },
    {
      title: "Communauté",
      description: "Un écosystème où chaque apprenant contribue à la réussite des autres.",
      icon: Users
    },
    {
      title: "Excellence",
      description: "Des contenus et outils de la plus haute qualité pour des résultats optimaux.",
      icon: Award
    }
  ];

  const handleExternalLink = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Email copié !', {
      description: `${email} a été copié dans le presse-papier`
    });
  };

  const handlePartnerSubmit = (e) => {
    e.preventDefault();
    if (!partnerForm.name || !partnerForm.email || !partnerForm.organization || !partnerForm.message) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    const subject = encodeURIComponent(`[Smartix] Demande de partenariat — ${partnerForm.name} (${partnerForm.organization})`);
    const body = encodeURIComponent(
      `Nom : ${partnerForm.name}\nEmail : ${partnerForm.email}\nOrganisation : ${partnerForm.organization}\n\nMessage :\n${partnerForm.message}`
    );
    window.location.href = `mailto:kirizamushaga01@gmail.com?subject=${subject}&body=${body}`;
    setPartnerSuccess(true);
  };

  const closePartnerModal = () => {
    setShowPartnerModal(false);
    setTimeout(() => {
      setPartnerSuccess(false);
      setPartnerForm({ name: '', email: '', organization: '', message: '' });
    }, 300);
  };

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

      {/* Hero Section */}
      <section className="relative pt-6 pb-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ff6b35]/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          {/* Header row: arrow + badge on same line */}
          <div className="flex items-center gap-4 mb-10 animate-fade-in">
            <button
              onClick={() => navigate('/auth', { replace: true, state: { openMenu: true } })}
              className="p-2 hover:bg-white/10 rounded-full transition-all flex-shrink-0"
              aria-label="Retour"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e293b] rounded-full border border-white/10 text-sm">
              <Target className="w-4 h-4 text-[#ff6b35]" />
              <span className="font-medium text-white/80 tracking-wide uppercase text-[10px]">Vision & Partenariats</span>
            </div>
          </div>
          {/* Title & content centered */}
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight tracking-tight">
              Devenir la référence <br />
              <span className="text-[#ff6b35]">africaine de l'apprentissage.</span>
            </h1>
            <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed mb-12">
              Notre vision est claire : propulser Smartix comme l'écosystème éducatif incontournable en Afrique, où chaque talent est révélé par une technologie intelligente et accessible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff8c61] text-white px-8 h-14 rounded-full text-lg font-bold shadow-xl shadow-[#ff6b35]/20 transition-all hover:scale-105 active:scale-95"
              >
                Découvrir nos solutions <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Nos Valeurs */}
      <section className="py-24 px-6 bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Nos <span className="text-[#ff6b35]">Valeurs Fondamentales</span></h2>
            <p className="text-white/40 text-lg">Ce qui guide nos actions chaque jour</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, i) => (
              <div key={i} className="p-8 rounded-3xl bg-[#1e293b] border border-white/5 hover:border-[#ff6b35]/30 transition-all group text-center">
                <div className="mb-6 p-4 bg-white/5 rounded-2xl inline-flex items-center justify-center group-hover:scale-110 transition-transform">
                  <value.icon className="w-8 h-8 text-[#ff6b35]" />
                </div>
                <h3 className="text-xl font-bold mb-4">{value.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="py-24 px-6 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Nos <span className="text-[#ff6b35]">Partenaires Stratégiques</span></h2>
            <p className="text-white/40 text-lg">Ils nous font confiance pour transformer l'éducation.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {partners.map((partner, i) => (
              <div 
                key={i} 
                className="p-8 rounded-3xl bg-[#1e293b] border border-white/5 hover:border-[#ff6b35]/30 hover:bg-[#263548] transition-all group cursor-pointer flex flex-col items-center text-center"
                onClick={() => handleExternalLink(partner.link)}
              >
                <div className="mb-6 p-4 bg-[#0f172a] rounded-2xl inline-flex items-center justify-center group-hover:scale-110 transition-transform">
                  <partner.icon className={`w-8 h-8 ${partner.color}`} />
                </div>
                <h3 className="text-xl font-bold mb-2">{partner.name}</h3>
                <p className="text-xs text-[#ff6b35] uppercase font-bold tracking-widest mb-4">{partner.role}</p>
                <p className="text-white/50 leading-relaxed text-sm">{partner.description}</p>
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40 group-hover:text-[#ff6b35] transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  <span>Visiter le site</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-6">L'équipe derrière <span className="text-[#ff6b35]">Smartix</span></h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">Une équipe multidisciplinaire de passionnés qui travaillent chaque jour pour transformer votre manière d'apprendre.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            {teamMembers.map((member, i) => (
              <div key={i} className="flex gap-6 p-8 bg-[#1e293b] rounded-[32px] border border-white/10 hover:bg-[#263548] transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-[#ff6b35]/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <member.icon className="w-8 h-8 text-[#ff6b35]" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs text-[#ff6b35] uppercase font-bold tracking-widest mb-1">{member.role}</h4>
                  <h3 className="text-2xl font-bold mb-3">{member.name}</h3>
                  <p className="text-white/50 leading-relaxed mb-4">{member.description}</p>
                  <div className="flex gap-3">
                    {member.social.linkedin && (
                      <button onClick={() => handleExternalLink(member.social.linkedin)} className="p-1 hover:text-[#ff6b35] transition-colors">
                        <Linkedin className="w-4 h-4" />
                      </button>
                    )}
                    {member.social.twitter && (
                      <button onClick={() => handleExternalLink(member.social.twitter)} className="p-1 hover:text-[#ff6b35] transition-colors">
                        <Twitter className="w-4 h-4" />
                      </button>
                    )}
                    {member.social.github && (
                      <button onClick={() => handleExternalLink(member.social.github)} className="p-1 hover:text-[#ff6b35] transition-colors">
                        <Github className="w-4 h-4" />
                      </button>
                    )}
                    {member.social.email && (
                      <button onClick={() => handleCopyEmail(member.social.email)} className="p-1 hover:text-[#ff6b35] transition-colors">
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ✅ Mission Section */}
      <section className="py-24 px-6 bg-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-8">
            <Rocket className="w-4 h-4 text-[#ff6b35]" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">Notre engagement</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ensemble, construisons l'avenir de l'éducation <span className="text-[#ff6b35]">en Afrique</span>
          </h2>
          <p className="text-white/50 text-lg max-w-3xl mx-auto mb-8">
            Rejoignez-nous dans cette aventure pour rendre l'apprentissage accessible, interactif et passionnant pour chaque étudiant, où qu'il se trouve.
          </p>
          <button
            onClick={() => setShowPartnerModal(true)}
            className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff8c61] text-white px-8 py-4 rounded-full font-bold transition-all hover:scale-105 active:scale-95"
          >
            Devenir partenaire <Heart className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8 tracking-tighter opacity-80">SMARTIX</h2>
          <p className="text-white/30 text-sm mb-8">© {new Date().getFullYear()} Smartix Platform. Tous droits réservés.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
            <button 
              onClick={() => navigate('/politique-confidentialite')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all group"
            >
              <Lock className="w-4 h-4 text-[#ff6b35] group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Confidentialité</span>
            </button>
            <button 
              onClick={() => navigate('/conditions-utilisation')}
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
                <p>L'utilisateur s'engage à utiliser la plateforme à des fins éducatives uniquement.</p>
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

      {/* Partner Request Modal */}
      {showPartnerModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closePartnerModal} />
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-[32px] border border-white/10 shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
            <button
              onClick={closePartnerModal}
              className="absolute top-5 right-5 p-2 hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>

            {partnerSuccess ? (
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-20 h-20 rounded-full bg-[#00B894]/20 flex items-center justify-center mb-6">
                  <CheckCircle className="w-10 h-10 text-[#00B894]" />
                </div>
                <h3 className="text-2xl font-black mb-3">Demande envoyée !</h3>
                <p className="text-white/60 leading-relaxed mb-8">
                  Votre demande de partenariat a bien été reçue. Notre équipe vous contactera très bientôt à l'adresse indiquée.
                </p>
                <button
                  onClick={closePartnerModal}
                  className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff8c61] text-white px-8 py-3 rounded-full font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-[#ff6b35]/20 rounded-2xl">
                    <Heart className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Devenir partenaire</h3>
                    <p className="text-white/40 text-sm">Rejoignez l'aventure Smartix</p>
                  </div>
                </div>

                <form onSubmit={handlePartnerSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Nom complet *</label>
                    <input
                      type="text"
                      value={partnerForm.name}
                      onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Jean Dupont"
                      className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#ff6b35]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Email *</label>
                    <input
                      type="email"
                      value={partnerForm.email}
                      onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="jean@exemple.com"
                      className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#ff6b35]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Organisation *</label>
                    <input
                      type="text"
                      value={partnerForm.organization}
                      onChange={e => setPartnerForm(f => ({ ...f, organization: e.target.value }))}
                      placeholder="Nom de votre école, entreprise..."
                      className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#ff6b35]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Message *</label>
                    <textarea
                      value={partnerForm.message}
                      onChange={e => setPartnerForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Décrivez votre projet de partenariat, votre vision et comment vous souhaitez collaborer avec Smartix..."
                      rows={4}
                      className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#ff6b35]/50 transition-colors resize-none"
                    />
                  </div>

                  {(() => {
                    const isValid = partnerForm.name.trim() && partnerForm.email.trim() && partnerForm.organization.trim() && partnerForm.message.trim();
                    return (
                      <button
                        type="submit"
                        disabled={!isValid}
                        className={`w-full inline-flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg transition-all mt-2 ${
                          isValid
                            ? 'bg-[#ff6b35] hover:bg-[#ff8c61] text-white hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                            : 'bg-white/10 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-5 h-5" />
                        Envoyer via Gmail
                      </button>
                    );
                  })()}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

VisionTeamPage.propTypes = {};

export default VisionTeamPage;
