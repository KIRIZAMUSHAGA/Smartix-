// frontend/src/pages/Landing/components/Footer.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  Sparkles, Facebook, Instagram, Linkedin, 
  Zap, BookOpen, Brain, Users, Check, ChevronRight, 
  ExternalLink, Lock, Shield, AlertCircle, Award, Star,
  MessageCircle, Target, Mail, TrendingUp, Rocket
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../components/ui/accordion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Footer = () => {
  const { t } = useTranslation();

  const handleAcceptCookies = () => {
    localStorage.setItem('cookiesAccepted', 'true');
    toast.success('✅ Cookies acceptés', {
      description: 'Merci ! Vos préférences ont été enregistrées.'
    });
  };

  const handleRejectCookies = () => {
    localStorage.setItem('cookiesAccepted', 'false');
    toast.info('🍪 Cookies refusés', {
      description: 'Seuls les cookies essentiels seront utilisés.'
    });
  };

  // ✅ Nouveaux trust badges crédibles
  const trustBadges = [
    { icon: Shield, text: "Données protégées", color: "text-[#00B894]" },
    { icon: Rocket, text: "Plateforme en évolution", color: "text-blue-400" },
    { icon: Users, text: "Premiers utilisateurs actifs", color: "text-purple-400" },
    { icon: Check, text: "Accès gratuit", color: "text-green-400" }
  ];

  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ✅ DESCRIPTION PRINCIPALE CORRIGÉE */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-[#00B894]" />
            <span className="text-xl font-bold">Smartix</span>
          </div>
          <p className="text-gray-400 text-sm mb-4 max-w-2xl leading-relaxed">
            Une plateforme éducative conçue pour apprendre, créer des projets et développer ses compétences avec l'intelligence artificielle.
          </p>
          
          {/* ✅ NOUVEAUX TRUST BADGES - Crédibles */}
          <div className="flex flex-wrap gap-4 mb-6">
            {trustBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <badge.icon className={`w-4 h-4 ${badge.color}`} />
                <span className="text-xs text-gray-400">{badge.text}</span>
              </div>
            ))}
          </div>

          {/* Social links */}
          <div className="flex gap-3">
            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-[#00B894] flex items-center justify-center transition-all duration-300 hover:scale-110">
              <Facebook className="w-5 h-5" />
            </a>
            <a href="https://www.x.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-black flex items-center justify-center transition-all duration-300 hover:scale-110">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-pink-600 flex items-center justify-center transition-all duration-300 hover:scale-110">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition-all duration-300 hover:scale-110">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* ✅ ACCORDION - Allégé et structuré */}
        <Accordion type="multiple" className="space-y-2 mb-12">
          {/* Plateforme */}
          <AccordionItem value="plateforme" className="border border-gray-800 rounded-lg bg-gray-800/30">
            <AccordionTrigger className="px-6 py-4 hover:bg-gray-800/50 rounded-lg text-lg font-semibold">
              🧩 Plateforme
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 space-y-4">
              <div>
                <h4 className="font-semibold text-[#00B894] mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Ce que tu peux faire
                </h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>📚 Apprends avec des cours interactifs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>🎨 Crée des projets concrets</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>💬 Partage avec la communauté</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>💰 Gagne de l'argent en vendant tes créations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>🧠 Pose tes questions à l'assistant IA</span>
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Ressources */}
          <AccordionItem value="ressources" className="border border-gray-800 rounded-lg bg-gray-800/30">
            <AccordionTrigger className="px-6 py-4 hover:bg-gray-800/50 rounded-lg text-lg font-semibold">
              📚 Ressources
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 space-y-4">
              <div>
                <h4 className="font-semibold text-[#00B894] mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Centre d'aide
                </h4>
                <ul className="space-y-2 text-gray-400 text-sm mb-4">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>Comment créer un compte ?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>Comment accéder à un cours ?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[#00B894] mt-0.5 flex-shrink-0" />
                    <span>Comment contacter l'assistant IA ?</span>
                  </li>
                </ul>
                <a href="mailto:kirizamushaga01@gmail.com?subject=Support Smartix - Demande d'aide&body=Bonjour,%0D%0A%0D%0AJ'ai besoin d'aide concernant :%0D%0A%0D%0A">
                  <Button variant="outline" className="border-[#00B894] text-[#00B894] hover:bg-[#00B894] hover:text-white">
                    <Mail className="w-4 h-4 mr-2" />
                    Contacter le support
                  </Button>
                </a>
              </div>

              {/* FAQ simplifiée */}
              <div>
                <h4 className="font-semibold text-[#00B894] mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  FAQ
                </h4>
                <Accordion type="single" collapsible className="space-y-2">
                  <AccordionItem value="faq-1" className="bg-gray-800/50 border border-gray-700 rounded-lg px-4">
                    <AccordionTrigger className="text-sm text-white hover:text-[#00B894]">
                      Puis-je utiliser Smartix sans internet ?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-gray-400">
                      Certaines fonctionnalités nécessitent une connexion internet. Un mode hors ligne est en développement.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-2" className="bg-gray-800/50 border border-gray-700 rounded-lg px-4">
                    <AccordionTrigger className="text-sm text-white hover:text-[#00B894]">
                      Comment réinitialiser mon mot de passe ?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-gray-400">
                      Cliquez sur "Mot de passe oublié ?" sur la page de connexion.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-3" className="bg-gray-800/50 border border-gray-700 rounded-lg px-4">
                    <AccordionTrigger className="text-sm text-white hover:text-[#00B894]">
                      Est-ce que Smartix est gratuit ?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-gray-400">
                      Oui ! Smartix est 100% gratuit avec accès illimité.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Légal */}
          <AccordionItem value="legal" className="border border-gray-800 rounded-lg bg-gray-800/30">
            <AccordionTrigger className="px-6 py-4 hover:bg-gray-800/50 rounded-lg text-lg font-semibold">
              ⚖️ Légal
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 space-y-4">
              <div>
                <Link
                  to="/conditions-utilisation"
                  className="group font-semibold text-[#00B894] mb-3 flex items-center gap-2 hover:text-[#00d4a8] transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Conditions d'utilisation
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div>
                <h4 className="font-semibold text-[#00B894] mb-3 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Confidentialité
                </h4>
                <p className="text-gray-400 text-sm mb-2">
                  Vos données sont protégées et ne sont jamais vendues.
                </p>
              </div>

              {/* Cookies */}
              <div>
                <h4 className="font-semibold text-[#00B894] mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Cookies
                </h4>
                <div className="flex gap-3">
                  <Button size="sm" className="bg-[#00B894] hover:bg-[#00a182]" onClick={handleAcceptCookies}>
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white"
                    onClick={handleRejectCookies}
                  >
                    Refuser
                  </Button>
                </div>
              </div>

              {/* Politique de confidentialité */}
              <div>
                <Link
                  to="/politique-confidentialite"
                  className="group font-semibold text-[#00B894] mb-3 flex items-center gap-2 hover:text-[#00d4a8] transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Politique de confidentialité
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Mentions légales */}
              <div>
                <Link
                  to="/mentions-legales"
                  className="group font-semibold text-[#00B894] mb-3 flex items-center gap-2 hover:text-[#00d4a8] transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  Mentions légales
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* ✅ TRUST BADGES FINAUX - Version crédible */}
        <div className="border-t border-gray-800 pt-8 mb-8">
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Shield className="w-5 h-5 text-[#00B894]" />
              <span>Données protégées</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Sparkles className="w-5 h-5 text-[#ff6b35]" />
              <span>Plateforme en évolution</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-5 h-5 text-purple-400" />
              <span>Premiers utilisateurs actifs</span>
            </div>
            <button
              onClick={() => toast.info('⭐ Des retours positifs des premiers utilisateurs de Smartix')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00B894] transition-colors cursor-pointer"
            >
              <Star className="w-5 h-5 text-yellow-500" />
              <span>⭐ Retours positifs</span>
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-gray-400 border-t border-gray-800 pt-8">
          <p>© {new Date().getFullYear()} Smartix - Kiriza Mushaga / OKIM Univers Global</p>
          <p className="mt-2 text-xs text-gray-500">Développé pour l'éducation en Afrique</p>
        </div>
      </div>
    </footer>
  );
};

Footer.propTypes = {};

export default Footer;
