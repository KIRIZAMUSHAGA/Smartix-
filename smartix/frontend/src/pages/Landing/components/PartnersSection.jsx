// frontend/src/pages/Landing/components/PartnersSection.jsx
import React from 'react';
import { Users, Brain, Shield, Sparkles, School, TrendingUp, CheckCircle } from 'lucide-react';
import PropTypes from 'prop-types';

// =============================
// DONNÉES PARTENAIRES OPTIMISÉES
// =============================
const PARTNERS = [
  {
    name: "Lycée Hélène de Chappotin",
    logo: "/lycee-helene-logo.png",
    description: "Des élèves utilisent Smartix pour apprendre et progresser au quotidien",
    badge: "👥 Établissement utilisateur",
    badgeIcon: School,
    badgeColor: "text-blue-400",
    badgeBg: "bg-blue-500/10",
    stat: "Élèves actifs",
    statValue: "+200"
  },
  {
    name: "OKIM Univers Global",
    logo: "/okim-logo.jpg",
    description: "Organisation à l'origine du projet Smartix, engagée dans la formation et l'accompagnement des apprenants",
    badge: "🎯 Organisation fondatrice",
    badgeIcon: Sparkles,
    badgeColor: "text-[#ff6b35]",
    badgeBg: "bg-[#ff6b35]/10",
    stat: "Projets accompagnés",
    statValue: "+15"
  },
  {
    name: "Lotseke Center",
    logo: "/lotseke-logo.jpg",
    description: "Centre de formation qui accompagne les utilisateurs dans leur apprentissage",
    badge: "📚 Accompagnement formation",
    badgeIcon: Brain,
    badgeColor: "text-purple-400",
    badgeBg: "bg-purple-500/10",
    stat: "Formations dispensées",
    statValue: "+50"
  }
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const PartnersSection = () => {
  return (
    <div className="pt-6 pb-24 bg-transparent border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ✅ TITRE OPTIMISÉ - Plus fort */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-6">
            <Shield className="w-4 h-4 text-[#ff6b35]" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Preuve sociale</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Ils font confiance à <span className="gradient-text">Smartix</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Des établissements et organisations qui accompagnent déjà nos utilisateurs
          </p>
        </div>

        {/* ✅ LOGOS STRIP - Nouvelle section de crédibilité */}
        <div className="mb-16">
          <p className="text-center text-xs uppercase tracking-wider text-white/30 mb-6">Déjà utilisé dans plusieurs établissements</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-70">
            {PARTNERS.map((partner, idx) => (
              <img
                key={idx}
                src={partner.logo}
                alt={partner.name}
                className="h-8 sm:h-10 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-50 hover:opacity-100"
              />
            ))}
          </div>
        </div>

        {/* ✅ PARTNERS GRID - Design uniformisé */}
        <div className="grid md:grid-cols-3 gap-8">
          {PARTNERS.map((partner, index) => (
            <div
              key={index}
              className="group bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#ff6b35]/5"
            >
              {/* Logo - Taille réduite (h-40) */}
              <div className="w-full h-40 rounded-xl flex items-center justify-center mb-6 overflow-hidden bg-white/5 group-hover:scale-105 transition-transform duration-300">
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="w-full h-full object-contain p-4"
                />
              </div>

              {/* Titre */}
              <h3 className="text-xl font-bold text-white mb-3 text-center">
                {partner.name}
              </h3>

              {/* ✅ Description optimisée */}
              <p className="text-white/60 text-sm text-center leading-relaxed mb-4">
                {partner.description}
              </p>

              {/* Stat (nouveau - preuve d'impact) */}
              <div className="flex items-center justify-center gap-1 mb-4">
                <TrendingUp className="w-3 h-3 text-[#ff6b35]" />
                <span className="text-xs text-white/40">{partner.stat}</span>
                <span className="text-xs font-bold text-[#ff6b35]">{partner.statValue}</span>
              </div>

              {/* Badge - Style uniformisé */}
              <div className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-full ${partner.badgeBg} w-fit mx-auto`}>
                <partner.badgeIcon className={`w-3.5 h-3.5 ${partner.badgeColor}`} />
                <span className={`text-[10px] font-medium uppercase tracking-wider ${partner.badgeColor}`}>
                  {partner.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ✅ MICRO-PHRASE DE PREUVE DYNAMIQUE */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-full shadow-lg backdrop-blur-sm hover:border-[#ff6b35]/30 transition-all duration-300 group">
            <div className="flex -space-x-2">
              {PARTNERS.slice(0, 3).map((_, idx) => (
                <div key={idx} className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex items-center justify-center border-2 border-white/10">
                  <Users className="w-4 h-4 text-white" />
                </div>
              ))}
            </div>
            <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
              Des étudiants utilisent Smartix dans ces établissements
            </span>
          </div>
        </div>

        {/* ✅ BADGE FINAL OPTIMISÉ - Version plus forte */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#ff6b35]/10 to-orange-500/10 px-8 py-4 rounded-full border border-[#ff6b35]/20 backdrop-blur-sm">
            <div className="bg-[#ff6b35]/20 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-[#ff6b35]" />
            </div>
            <span className="text-white font-medium tracking-wide">
              Un écosystème construit pour ta réussite
            </span>
          </div>
        </div>

        {/* ✅ MICRO-INFO SUPPLÉMENTAIRE (preuve sociale discrète) */}
        <div className="text-center mt-8">
          <p className="text-xs text-white/30">
            Utilisé dans des environnements scolaires réels • Testé par des établissements partenaires
          </p>
        </div>
      </div>
    </div>
  );
};

PartnersSection.propTypes = {};

export default PartnersSection;
