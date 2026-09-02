import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, User, Mail, Globe, Phone,
  MapPin, CalendarDays, Shield, Scale, Sparkles,
  Server, FileText, ExternalLink, ChevronRight
} from 'lucide-react';

const InfoBlock = ({ icon: Icon, label, value, isLink, href }) => (
  <div className="flex items-start gap-4 py-4 border-b border-white/5 last:border-0">
    <div className="w-9 h-9 rounded-xl bg-[#00B894]/10 border border-[#00B894]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-[#00B894]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">{label}</p>
      {isLink ? (
        <a href={href} className="text-[#00B894] hover:text-[#00d4a8] text-sm font-medium transition-colors break-all">
          {value}
        </a>
      ) : (
        <p className="text-white text-sm font-medium">{value}</p>
      )}
    </div>
  </div>
);

const Section = ({ icon: Icon, title, children }) => (
  <div className="mb-6 bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
      <div className="w-8 h-8 rounded-lg bg-[#00B894]/12 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#00B894]" />
      </div>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
    </div>
    <div className="px-6 pb-2">
      {children}
    </div>
  </div>
);

const MentionsLegales = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">

      {/* Barre de navigation sticky */}
      <div className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group-hover:scale-105">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm hidden sm:block">Retour</span>
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00B894]" />
            <span className="text-sm font-semibold text-white/80">Mentions légales</span>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 bg-white/5 px-2 py-1 rounded-full">
              v1.0
            </span>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00B894]/8 via-transparent to-[#0f172a]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00B894]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#00B894]/15 border border-[#00B894]/25 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#00B894]" />
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm font-bold text-[#00B894] uppercase tracking-widest">Smartix</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            Mentions<br />
            <span className="text-[#00B894]">Légales</span>
          </h1>
          <p className="text-white/50 text-base max-w-xl leading-relaxed mb-8">
            Informations légales relatives à l'éditeur de la plateforme Smartix,
            conformément aux obligations d'information applicables.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2">
              <CalendarDays className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm text-white/60">Avril 2026 · Version 1.0</span>
            </div>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2">
              <MapPin className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm text-white/60">Smartix S.A.R.L. — RDC</span>
            </div>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2">
              <Shield className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm text-white/60">Données protégées</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Éditeur */}
        <Section icon={Building2} title="Éditeur de la plateforme">
          <InfoBlock icon={Building2} label="Raison sociale" value="Smartix S.A.R.L." />
          <InfoBlock icon={Globe} label="Plateforme" value="Smartix — Plateforme éducative numérique" />
          <InfoBlock icon={MapPin} label="Siège social" value="République Démocratique du Congo (RDC)" />
          <InfoBlock icon={Scale} label="Forme juridique" value="Société à Responsabilité Limitée (S.A.R.L.)" />
          <InfoBlock icon={CalendarDays} label="Année de création" value="2025" />
        </Section>

        {/* Responsable */}
        <Section icon={User} title="Responsable de la publication">
          <InfoBlock icon={User} label="Nom complet" value="Kiriza Mushaga" />
          <InfoBlock icon={Building2} label="Organisation" value="OKIM Univers Global" />
          <InfoBlock
            icon={Mail}
            label="Adresse email"
            value="kirizamushaga01@gmail.com"
            isLink
            href="mailto:kirizamushaga01@gmail.com"
          />
        </Section>

        {/* Hébergement */}
        <Section icon={Server} title="Hébergement">
          <InfoBlock icon={Server} label="Fournisseur" value="Replit Inc." />
          <InfoBlock icon={Globe} label="Site web" value="https://replit.com" isLink href="https://replit.com" />
          <InfoBlock icon={MapPin} label="Pays" value="États-Unis d'Amérique" />
        </Section>

        {/* Propriété intellectuelle */}
        <Section icon={Shield} title="Propriété intellectuelle">
          <div className="py-4 text-sm text-white/60 leading-relaxed space-y-3">
            <p>
              L'ensemble des contenus présents sur la plateforme Smartix (textes, images, logos, icônes,
              illustrations, vidéos, sons, code source, architecture, base de données) sont la propriété
              exclusive de <strong className="text-white">Smartix S.A.R.L.</strong> ou de leurs auteurs respectifs,
              et sont protégés par les lois en vigueur sur la propriété intellectuelle.
            </p>
            <p>
              Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie
              des éléments de la plateforme, quel que soit le moyen ou le procédé utilisé, est interdite
              sans autorisation écrite préalable de Smartix S.A.R.L.
            </p>
            <p>
              Toute exploitation non autorisée de la plateforme ou de l'un quelconque des éléments qu'elle
              contient sera considérée comme constitutive d'une contrefaçon et poursuivie conformément aux
              dispositions légales en vigueur.
            </p>
          </div>
        </Section>

        {/* Responsabilité */}
        <Section icon={Scale} title="Limitation de responsabilité">
          <div className="py-4 text-sm text-white/60 leading-relaxed space-y-3">
            <p>
              Smartix s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur sa
              plateforme. Toutefois, Smartix ne peut garantir l'exactitude, la complétude ou l'actualité
              des informations diffusées.
            </p>
            <p>
              Smartix décline toute responsabilité pour tout dommage ou préjudice, direct ou indirect,
              pouvant résulter de l'accès à la plateforme ou de l'utilisation des informations qu'elle contient,
              y compris en cas d'inaccessibilité temporaire de la plateforme.
            </p>
          </div>
        </Section>

        {/* Protection des données */}
        <Section icon={Shield} title="Protection des données personnelles">
          <div className="py-4 text-sm text-white/60 leading-relaxed space-y-3">
            <p>
              Conformément à notre{' '}
              <a
                href="/politique-confidentialite"
                onClick={e => { e.preventDefault(); navigate('/politique-confidentialite'); }}
                className="text-[#00B894] hover:underline font-medium"
              >
                politique de confidentialité
              </a>
              , Smartix collecte et traite vos données personnelles dans le respect des lois applicables
              en matière de protection des données.
            </p>
            <p>
              Vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles.
              Pour exercer ces droits, contactez-nous à l'adresse :{' '}
              <a href="mailto:kirizamushaga01@gmail.com" className="text-[#00B894] hover:underline transition-colors">
                kirizamushaga01@gmail.com
              </a>
            </p>
          </div>
        </Section>

        {/* Liens légaux */}
        <div className="mt-6 mb-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="/conditions-utilisation"
            onClick={e => { e.preventDefault(); navigate('/conditions-utilisation'); }}
            className="group flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-[#00B894]/30 rounded-2xl px-6 py-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00B894]/10 flex items-center justify-center">
                <Scale className="w-4 h-4 text-[#00B894]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Conditions d'Utilisation</p>
                <p className="text-xs text-white/40">Consulter nos CGU complètes</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-[#00B894] group-hover:translate-x-1 transition-all" />
          </a>
          <a
            href="/politique-confidentialite"
            onClick={e => { e.preventDefault(); navigate('/politique-confidentialite'); }}
            className="group flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-[#00B894]/30 rounded-2xl px-6 py-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00B894]/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#00B894]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Politique de Confidentialité</p>
                <p className="text-xs text-white/40">Protection de vos données</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-[#00B894] group-hover:translate-x-1 transition-all" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-white/5 pt-8 pb-4">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Smartix S.A.R.L. — OKIM Univers Global · République Démocratique du Congo
          </p>
          <p className="text-white/20 text-xs mt-1">
            Mentions légales — Version 1.0, Avril 2026
          </p>
        </div>

      </div>
    </div>
  );
};

export default MentionsLegales;
