import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Lock, Eye, Database, Users, Bell,
  Server, Mail, Trash2, RefreshCw, ChevronDown, ChevronUp,
  CalendarDays, MapPin, Sparkles, Key, AlertCircle,
  CheckCircle, Globe, FileText, ChevronRight, Scale
} from 'lucide-react';

const Section = ({ icon: Icon, number, title, children, accent = '#00B894' }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-8 border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <span className="flex-1 text-base font-bold text-white">
          {number}. {title}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-white/30" />
          : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>
      {open && (
        <div className="px-6 pb-6 pt-2 text-white/60 text-sm leading-relaxed space-y-3 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
};

const Li = ({ children }) => (
  <li className="flex items-start gap-2">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00B894] flex-shrink-0" />
    <span>{children}</span>
  </li>
);

const Tag = ({ children, color = '#00B894' }) => (
  <span
    className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mr-1"
    style={{ backgroundColor: `${color}20`, color }}
  >
    {children}
  </span>
);

const DataRow = ({ donnee, source, stockage, finalite }) => (
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 py-2 border-b border-white/5 text-xs">
    <span className="text-white font-medium">{donnee}</span>
    <span className="text-white/50">{source}</span>
    <span className="text-white/50">{stockage}</span>
    <span className="text-white/40">{finalite}</span>
  </div>
);

const RightCard = ({ icon: Icon, title, description, color = '#00B894' }) => (
  <div
    className="flex items-start gap-4 p-4 rounded-xl border"
    style={{ backgroundColor: `${color}08`, borderColor: `${color}20` }}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ backgroundColor: `${color}18` }}
    >
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
    <div>
      <p className="text-sm font-bold text-white mb-1">{title}</p>
      <p className="text-xs text-white/50 leading-relaxed">{description}</p>
    </div>
  </div>
);

const PolitiqueConfidentialite = () => {
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
            <Shield className="w-4 h-4 text-[#00B894]" />
            <span className="text-sm font-semibold text-white/80">Politique de Confidentialité</span>
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
              <Shield className="w-6 h-6 text-[#00B894]" />
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm font-bold text-[#00B894] uppercase tracking-widest">Smartix</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            Politique de<br />
            <span className="text-[#00B894]">Confidentialité</span>
          </h1>
          <p className="text-white/50 text-base max-w-xl leading-relaxed mb-8">
            Chez Smartix, la protection de tes données personnelles est une priorité absolue.
            Ce document t'explique de manière transparente quelles données nous collectons,
            pourquoi, et comment nous les protégeons.
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
              <Lock className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm text-white/60">Données jamais vendues</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Sommaire */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Sommaire</p>
          <ol className="text-sm text-white/50 space-y-1 list-decimal list-inside">
            {[
              'Qui sommes-nous ?',
              'Données que nous collectons',
              'Comment nous utilisons vos données',
              'Partage des données avec des tiers',
              'Conservation et suppression des données',
              'Vos droits sur vos données',
              'Cookies et traceurs',
              'Sécurité des données',
              'Transferts internationaux',
              'Modifications de cette politique',
              'Nous contacter',
            ].map((t, i) => (
              <li key={i} className="hover:text-white/70 transition-colors">{t}</li>
            ))}
          </ol>
        </div>

        {/* ── 1 ── */}
        <Section icon={Globe} number="1" title="Qui sommes-nous ?">
          <p>
            <strong className="text-white">Smartix</strong> est une plateforme éducative numérique développée par{' '}
            <strong className="text-white">OKIM Univers Global</strong>, sous la responsabilité de{' '}
            <strong className="text-white">Kiriza Mushaga</strong>, basée en{' '}
            <strong className="text-white">République Démocratique du Congo (RDC)</strong>.
          </p>
          <p>
            Smartix combine apprentissage interactif, création de projets assistée par IA (Vibe-Coding),
            réseau social éducatif, marketplace numérique et actualités technologiques — le tout au sein d'une seule plateforme.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-2">
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">Responsable du traitement</p>
            <p><strong className="text-white">Smartix S.A.R.L.</strong></p>
            <p>Responsable : Kiriza Mushaga — OKIM Univers Global</p>
            <p>
              Contact :{' '}
              <a href="mailto:kirizamushaga01@gmail.com" className="text-[#00B894] hover:underline">
                kirizamushaga01@gmail.com
              </a>
            </p>
          </div>
        </Section>

        {/* ── 2 ── */}
        <Section icon={Database} number="2" title="Données que nous collectons" accent="#6366f1">
          <p>
            Nous collectons uniquement les données <strong className="text-white">strictement nécessaires</strong> au
            bon fonctionnement de la plateforme. Voici le détail complet :
          </p>

          <div className="mt-3 space-y-0">
            <div className="grid grid-cols-4 gap-1 py-1.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/30">
              <span>Donnée</span><span>Source</span><span>Stockage</span><span>Finalité</span>
            </div>
            <DataRow donnee="Adresse email" source="Inscription" stockage="MongoDB Atlas" finalite="Authentification, contact" />
            <DataRow donnee="Mot de passe" source="Inscription" stockage="MongoDB (bcrypt)" finalite="Sécurité du compte" />
            <DataRow donnee="Nom complet" source="Inscription" stockage="MongoDB Atlas" finalite="Affichage du profil" />
            <DataRow donnee="Nom d'utilisateur" source="Inscription" stockage="MongoDB Atlas" finalite="Identification publique" />
            <DataRow donnee="Photo de profil" source="Upload volontaire" stockage="Serveur Smartix" finalite="Affichage profil" />
            <DataRow donnee="Numéro de téléphone" source="Marketplace" stockage="MongoDB Atlas" finalite="Transactions financières" />
            <DataRow donnee="Adresse IP" source="Automatique" stockage="MongoDB Atlas" finalite="Sécurité, anti-fraude" />
            <DataRow donnee="Appareil & navigateur" source="Automatique" stockage="MongoDB Atlas" finalite="Gestion des sessions" />
            <DataRow donnee="Token push (FCM)" source="Consentement" stockage="MongoDB Atlas" finalite="Notifications push" />
            <DataRow donnee="Contenus publiés" source="Actions utilisateur" stockage="MongoDB Atlas" finalite="Fonctionnement plateforme" />
            <DataRow donnee="Historique transactions" source="Marketplace" stockage="MongoDB Atlas" finalite="Comptabilité, litiges" />
            <DataRow donnee="Quota outils IA" source="Automatique" stockage="MongoDB Atlas" finalite="Limitation d'abus" />
            <DataRow donnee="Brouillons éditeur" source="Autosave" stockage="localStorage navigateur" finalite="Confort utilisateur" />
            <DataRow donnee="Cookies essentiels" source="Automatique" stockage="Navigateur" finalite="Session, authentification" />
            <DataRow donnee="Cookies analytics" source="Consentement" stockage="Navigateur" finalite="Statistiques anonymes" />
          </div>

          <p className="mt-3">
            Nous ne collectons <strong className="text-white">ni ta localisation GPS, ni l'accès à ta caméra</strong>,
            ni aucune donnée biométrique. Les seules permissions matérielles possibles sont le microphone
            (commentaires vocaux, avec ton accord) et les notifications push (avec ton consentement explicite).
          </p>
        </Section>

        {/* ── 3 ── */}
        <Section icon={Eye} number="3" title="Comment nous utilisons vos données">
          <p>Tes données sont utilisées exclusivement pour les finalités suivantes :</p>
          <ul className="space-y-1 mt-2">
            <Li><strong className="text-white">Authentification et sécurité</strong> — vérifier ton identité, sécuriser ton compte et prévenir les fraudes</Li>
            <Li><strong className="text-white">Personnalisation</strong> — adapter ton expérience d'apprentissage selon tes préférences et ta progression</Li>
            <Li><strong className="text-white">Fonctionnalités sociales</strong> — afficher ton profil, tes publications, tes interactions avec la communauté</Li>
            <Li><strong className="text-white">Marketplace</strong> — gérer tes achats, tes ventes, ton portefeuille vendeur et l'historique des transactions</Li>
            <Li><strong className="text-white">Assistant IA</strong> — traiter tes messages pour te fournir des réponses contextualisées via SmartAI</Li>
            <Li><strong className="text-white">Notifications</strong> — t'informer des nouvelles activités (messages, mentions, likes, nouveaux cours)</Li>
            <Li><strong className="text-white">Amélioration du service</strong> — analyser les usages de manière anonyme pour améliorer la plateforme</Li>
            <Li><strong className="text-white">Support</strong> — traiter tes demandes d'assistance et résoudre les litiges éventuels</Li>
          </ul>
          <p className="mt-2">
            Tes données ne sont <strong className="text-white">jamais utilisées à des fins publicitaires</strong> pour des tiers,
            ni revendues sous quelque forme que ce soit.
          </p>
        </Section>

        {/* ── 4 ── */}
        <Section icon={Users} number="4" title="Partage des données avec des tiers" accent="#8b5cf6">
          <p>
            Nous faisons appel à des prestataires de confiance pour faire fonctionner Smartix.
            Chacun de ces partenaires traite tes données uniquement dans le cadre de sa mission spécifique :
          </p>
          <ul className="space-y-2 mt-3">
            <li>
              <Tag color="#10a37f">OpenAI</Tag>
              <span> — Tes messages adressés à SmartAI sont transmis à OpenAI pour traitement. OpenAI peut les utiliser pour améliorer ses modèles, sauf paramétrage contraire.</span>
            </li>
            <li>
              <Tag color="#635bff">Stripe</Tag>
              <span> — Les données de paiement par carte bancaire sont traitées directement par Stripe. Smartix ne stocke jamais les numéros de carte.</span>
            </li>
            <li>
              <Tag color="#FFCA28">Firebase / FCM</Tag>
              <span> — Ton token d'appareil est transmis à Google Firebase pour la livraison des notifications push.</span>
            </li>
            <li>
              <Tag color="#4DB33D">MongoDB Atlas</Tag>
              <span> — L'ensemble des données de la plateforme est hébergé sur MongoDB Atlas (cloud, États-Unis). Les données sont chiffrées au repos et en transit.</span>
            </li>
            <li>
              <Tag color="#1a73e8">Replit</Tag>
              <span> — Le frontend et le backend de Smartix sont hébergés sur l'infrastructure Replit (États-Unis).</span>
            </li>
            <li>
              <Tag color="#ff6b35">Pollinations AI</Tag>
              <span> — Tes prompts de génération d'images sont transmis à Pollinations AI pour produire les images demandées.</span>
            </li>
          </ul>
          <p className="mt-3">
            Smartix <strong className="text-white">ne vend, ne loue ni ne partage</strong> tes données avec des tiers
            à des fins commerciales. Nous pouvons être amenés à divulguer tes données si la loi l'exige ou pour protéger
            les droits et la sécurité de la plateforme et de ses utilisateurs.
          </p>
        </Section>

        {/* ── 5 ── */}
        <Section icon={Trash2} number="5" title="Conservation et suppression des données" accent="#f59e0b">
          <p>
            Tes données sont conservées aussi longtemps que ton compte est actif sur Smartix,
            et jusqu'à <strong className="text-white">30 jours après la suppression de ton compte</strong> (délai de sécurité pour
            permettre d'annuler une suppression accidentelle).
          </p>
          <p>
            Passé ce délai, toutes tes données personnelles sont <strong className="text-white">définitivement supprimées</strong> de nos serveurs,
            à l'exception :
          </p>
          <ul className="space-y-1 mt-1">
            <Li>Des données de transactions financières, conservées <strong className="text-white">5 ans</strong> à des fins comptables et légales</Li>
            <Li>Des journaux de sécurité (logs d'accès), conservés <strong className="text-white">90 jours</strong> pour détecter les fraudes</Li>
            <Li>Des données anonymisées et agrégées (statistiques d'usage), conservées indéfiniment sans lien avec ton identité</Li>
          </ul>
          <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl p-4 mt-3">
            <p className="text-[#f59e0b] font-bold text-sm mb-1">Comment supprimer ton compte ?</p>
            <p>
              Tu peux supprimer ton compte à tout moment depuis{' '}
              <strong className="text-white">Paramètres → Compte → Supprimer mon compte</strong>.
              La suppression est irréversible après le délai de 30 jours.
            </p>
          </div>
        </Section>

        {/* ── 6 ── */}
        <Section icon={Key} number="6" title="Vos droits sur vos données">
          <p>
            Conformément aux lois applicables en matière de protection des données, tu disposes des droits suivants :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <RightCard
              icon={Eye}
              title="Droit d'accès"
              description="Tu peux demander à tout moment la liste complète des données que nous détenons sur toi."
            />
            <RightCard
              icon={RefreshCw}
              title="Droit de rectification"
              description="Tu peux corriger ou mettre à jour tes informations directement depuis les paramètres de ton profil."
            />
            <RightCard
              icon={Trash2}
              title="Droit à l'effacement"
              description="Tu peux demander la suppression de toutes tes données personnelles (droit à l'oubli)."
              color="#ef4444"
            />
            <RightCard
              icon={Lock}
              title="Droit à la limitation"
              description="Tu peux demander la suspension temporaire du traitement de tes données dans certaines situations."
              color="#f59e0b"
            />
            <RightCard
              icon={Database}
              title="Droit à la portabilité"
              description="Tu peux demander l'exportation de tes données dans un format structuré et lisible."
              color="#6366f1"
            />
            <RightCard
              icon={AlertCircle}
              title="Droit d'opposition"
              description="Tu peux t'opposer au traitement de tes données pour des raisons tenant à ta situation particulière."
              color="#8b5cf6"
            />
          </div>
          <p className="mt-4">
            Pour exercer l'un de ces droits, contacte-nous à{' '}
            <a href="mailto:kirizamushaga01@gmail.com" className="text-[#00B894] hover:underline">
              kirizamushaga01@gmail.com
            </a>{' '}
            en indiquant clairement ta demande. Nous nous engageons à y répondre dans un délai de{' '}
            <strong className="text-white">30 jours ouvrables</strong>.
          </p>
        </Section>

        {/* ── 7 ── */}
        <Section icon={Bell} number="7" title="Cookies et traceurs" accent="#ec4899">
          <p>
            Smartix utilise des cookies et technologies similaires pour assurer le bon fonctionnement
            de la plateforme et améliorer ton expérience. Voici les catégories de cookies utilisées :
          </p>
          <ul className="space-y-3 mt-3">
            <li>
              <p className="font-semibold text-white mb-1">
                <Tag color="#00B894">Essentiels</Tag> Toujours actifs
              </p>
              <p>
                Nécessaires au fonctionnement de base : gestion de ta session de connexion,
                sécurité (token JWT), préférences de langue. Sans eux, la plateforme ne peut pas fonctionner.
              </p>
            </li>
            <li>
              <p className="font-semibold text-white mb-1">
                <Tag color="#6366f1">Analytics</Tag> Avec ton consentement
              </p>
              <p>
                Nous permettent de comprendre comment les utilisateurs naviguent sur Smartix
                afin d'améliorer les fonctionnalités. Les données sont anonymisées et agrégées.
              </p>
            </li>
            <li>
              <p className="font-semibold text-white mb-1">
                <Tag color="#f59e0b">Fonctionnels</Tag> Avec ton consentement
              </p>
              <p>
                Mémorisent tes préférences (thème sombre/clair, langue, taille de texte) pour
                personnaliser ton expérience entre les sessions.
              </p>
            </li>
          </ul>
          <p className="mt-3">
            Tu peux gérer tes préférences de cookies à tout moment depuis{' '}
            <button
              onClick={() => navigate('/cookie-preferences')}
              className="text-[#00B894] hover:underline font-medium"
            >
              Préférences de cookies
            </button>
            . Le retrait de consentement n'affecte pas la légalité des traitements déjà effectués.
          </p>
        </Section>

        {/* ── 8 ── */}
        <Section icon={Shield} number="8" title="Sécurité des données">
          <p>
            Smartix met en œuvre des mesures techniques et organisationnelles robustes pour
            protéger tes données contre l'accès non autorisé, la perte ou la divulgation :
          </p>
          <ul className="space-y-1 mt-2">
            <Li>
              <strong className="text-white">Chiffrement des mots de passe</strong> — algorithme bcrypt avec sel aléatoire,
              les mots de passe ne sont jamais stockés en clair
            </Li>
            <Li>
              <strong className="text-white">Authentification JWT</strong> — tokens d'accès à courte durée de vie (expiration)
              avec rotation automatique des refresh tokens
            </Li>
            <Li>
              <strong className="text-white">HTTPS / TLS</strong> — toutes les communications entre ton navigateur
              et nos serveurs sont chiffrées
            </Li>
            <Li>
              <strong className="text-white">Protection XSS</strong> — le contenu utilisateur est systématiquement
              nettoyé via la bibliothèque DOMPurify pour prévenir les injections
            </Li>
            <Li>
              <strong className="text-white">Accès restreint</strong> — toutes les routes API sensibles sont protégées
              par un middleware d'authentification
            </Li>
            <Li>
              <strong className="text-white">Sessions multi-appareils</strong> — tu peux consulter et révoquer
              les sessions actives depuis les paramètres de sécurité
            </Li>
          </ul>
          <p className="mt-3">
            Malgré ces mesures, aucun système n'est infaillible. En cas de violation de données susceptible
            de te porter préjudice, Smartix s'engage à t'en informer dans les meilleurs délais.
          </p>
        </Section>

        {/* ── 9 ── */}
        <Section icon={Server} number="9" title="Transferts internationaux" accent="#0984E3">
          <p>
            Smartix est basé en RDC, mais utilise des services d'hébergement situés aux{' '}
            <strong className="text-white">États-Unis</strong> (MongoDB Atlas, Replit). Tes données peuvent donc
            être transférées et traitées hors de ton pays de résidence.
          </p>
          <p>
            En utilisant Smartix, tu consens à ces transferts internationaux, nécessaires au fonctionnement du service.
            Ces transferts sont encadrés par les politiques de confidentialité des prestataires concernés,
            qui offrent des garanties de sécurité adéquates.
          </p>
          <ul className="space-y-1 mt-2">
            <Li>
              <strong className="text-white">MongoDB Atlas</strong> — politique de confidentialité disponible sur{' '}
              <a href="https://www.mongodb.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#00B894] hover:underline">
                mongodb.com
              </a>
            </Li>
            <Li>
              <strong className="text-white">Replit</strong> — politique de confidentialité disponible sur{' '}
              <a href="https://replit.com/site/privacy" target="_blank" rel="noopener noreferrer" className="text-[#00B894] hover:underline">
                replit.com
              </a>
            </Li>
            <Li>
              <strong className="text-white">OpenAI</strong> — politique disponible sur{' '}
              <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#00B894] hover:underline">
                openai.com
              </a>
            </Li>
          </ul>
        </Section>

        {/* ── 10 ── */}
        <Section icon={RefreshCw} number="10" title="Modifications de cette politique" accent="#f59e0b">
          <p>
            Smartix se réserve le droit de modifier cette Politique de Confidentialité à tout moment,
            notamment pour s'adapter à de nouvelles fonctionnalités ou à l'évolution du cadre légal.
          </p>
          <p>
            En cas de modification substantielle, nous t'informerons par :
          </p>
          <ul className="space-y-1">
            <Li>Une notification dans l'application</Li>
            <Li>Un email à l'adresse associée à ton compte</Li>
            <Li>L'affichage d'une bannière sur la plateforme</Li>
          </ul>
          <p>
            La version en vigueur est toujours accessible à l'adresse{' '}
            <strong className="text-white">/politique-confidentialite</strong>.
            La date de dernière mise à jour est indiquée en haut du document.
            La poursuite de l'utilisation de Smartix après une modification vaut acceptation de la nouvelle politique.
          </p>
        </Section>

        {/* ── 11 ── */}
        <Section icon={Mail} number="11" title="Nous contacter">
          <p>
            Pour toute question relative à cette politique, pour exercer tes droits ou pour signaler
            un problème de confidentialité, contacte-nous :
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-10 h-10 bg-[#00B894]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="text-[#00B894] w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Email — DPO / Confidentialité</p>
                <a
                  href="mailto:kirizamushaga01@gmail.com"
                  className="text-base font-medium text-white hover:text-[#00B894] transition-colors"
                >
                  kirizamushaga01@gmail.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-10 h-10 bg-[#00B894]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe className="text-[#00B894] w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Support général</p>
                <a
                  href="mailto:support@smartix.app"
                  className="text-base font-medium text-white hover:text-[#00B894] transition-colors"
                >
                  support@smartix.app
                </a>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/30">
            Délai de réponse garanti : 30 jours ouvrables. Objet recommandé : « Demande RGPD — [ton droit] ».
          </p>
        </Section>

        {/* Liens vers autres pages légales */}
        <div className="mt-2 mb-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            href="/mentions-legales"
            onClick={e => { e.preventDefault(); navigate('/mentions-legales'); }}
            className="group flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-[#00B894]/30 rounded-2xl px-6 py-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00B894]/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#00B894]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Mentions Légales</p>
                <p className="text-xs text-white/40">Informations légales de l'éditeur</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-[#00B894] group-hover:translate-x-1 transition-all" />
          </a>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-white/5 pt-8 pb-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-[#00B894]" />
            <span className="text-xs text-[#00B894] font-semibold">Vos données ne sont jamais vendues</span>
          </div>
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Smartix S.A.R.L. — OKIM Univers Global · République Démocratique du Congo
          </p>
          <p className="text-white/20 text-xs mt-1">
            Politique de Confidentialité — Version 1.0, Avril 2026
          </p>
        </div>

      </div>
    </div>
  );
};

export default PolitiqueConfidentialite;
