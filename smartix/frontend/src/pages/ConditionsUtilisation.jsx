import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Shield, Users, ShoppingBag, AlertCircle,
  CheckCircle, Mail, Mic, Bell, Server, Globe, CreditCard, FileText,
  ChevronDown, ChevronUp, Lock, Scale, CalendarDays, MapPin, Sparkles
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

const ConditionsUtilisation = () => {
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
            <Scale className="w-4 h-4 text-[#00B894]" />
            <span className="text-sm font-semibold text-white/80">Conditions Générales d'Utilisation</span>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 bg-white/5 px-2 py-1 rounded-full">
              v2.0
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
              <Scale className="w-6 h-6 text-[#00B894]" />
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm font-bold text-[#00B894] uppercase tracking-widest">Smartix</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            Conditions Générales<br />
            <span className="text-[#00B894]">d'Utilisation</span>
          </h1>
          <p className="text-white/50 text-base max-w-xl leading-relaxed mb-8">
            Ce document régit l'ensemble de vos droits et obligations lors de l'utilisation
            de la plateforme Smartix. Veuillez le lire attentivement avant d'utiliser nos services.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2">
              <CalendarDays className="w-4 h-4 text-[#00B894]" />
              <span className="text-sm text-white/60">Avril 2026 · Version 2.0</span>
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Sommaire rapide */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Sommaire</p>
          <ol className="text-sm text-white/50 space-y-1 list-decimal list-inside">
            {[
              'Acceptation des conditions',
              'Âge requis et création de compte',
              'Utilisation de la plateforme',
              'Contenu et propriété intellectuelle',
              'Marketplace, transactions et commission',
              'Données collectées',
              'Services tiers',
              'Permissions matériel et navigateur',
              'Confidentialité et sécurité',
              'Suspension et résiliation',
              'Limitation de responsabilité',
              'Droit applicable et juridiction',
            ].map((t, i) => (
              <li key={i} className="hover:text-white/70 transition-colors">{t}</li>
            ))}
          </ol>
        </div>

        {/* ── 1 ── */}
        <Section icon={CheckCircle} number="1" title="Acceptation des conditions">
          <p>
            En créant un compte ou en utilisant Smartix, tu confirmes avoir lu, compris et accepté ces CGU dans leur intégralité.
            Si tu n'es pas d'accord, merci de ne pas utiliser la plateforme.
          </p>
          <p>
            Smartix se réserve le droit de modifier ces conditions à tout moment. Les modifications entrent en vigueur
            dès leur publication. Une notification te sera envoyée en cas de changement substantiel.
            La poursuite de l'utilisation de la plateforme après modification vaut acceptation.
          </p>
        </Section>

        {/* ── 2 ── */}
        <Section icon={Users} number="2" title="Âge requis et création de compte">
          <p>
            Pour utiliser Smartix, tu dois avoir <strong className="text-white">au minimum 13 ans</strong>.
            Pour accéder aux fonctionnalités de vente sur la marketplace (créer un portefeuille vendeur et percevoir des revenus),
            tu dois avoir <strong className="text-white">au minimum 18 ans</strong> ou disposer du consentement écrit d'un parent ou tuteur légal.
          </p>
          <p>Tu t'engages à fournir des informations exactes lors de l'inscription, notamment :</p>
          <ul className="space-y-1">
            <Li>Nom complet réel</Li>
            <Li>Adresse e-mail valide et active</Li>
            <Li>Nom d'utilisateur unique et non offensant</Li>
          </ul>
          <p>
            Tu es seul(e) responsable de la confidentialité de ton mot de passe et de toutes les activités
            effectuées depuis ton compte. En cas de compromission, contacte-nous immédiatement à <span className="text-[#00B894]">contact@smartix.app</span>.
          </p>
          <p>
            Smartix se réserve le droit de supprimer tout compte dont les informations s'avèrent fausses ou qui appartient
            à un utilisateur n'atteignant pas l'âge minimum requis.
          </p>
        </Section>

        {/* ── 3 ── */}
        <Section icon={BookOpen} number="3" title="Utilisation de la plateforme">
          <p>Smartix est une plateforme éducative, créative et sociale. Tu t'engages à l'utiliser de manière responsable, honnête et légale.</p>
          <p>Il est <strong className="text-white">strictement interdit</strong> de :</p>
          <ul className="space-y-1">
            <Li>Publier du contenu offensant, violent, discriminatoire, sexuellement explicite ou illégal</Li>
            <Li>Harceler, menacer, diffamer ou intimider d'autres membres</Li>
            <Li>Diffuser des informations volontairement fausses ou trompeuses</Li>
            <Li>Violer les droits de propriété intellectuelle d'autrui (plagiat, piratage, etc.)</Li>
            <Li>Utiliser des bots, scripts automatisés ou outils de scraping sans autorisation écrite préalable</Li>
            <Li>Tenter de pirater, contourner ou compromettre la sécurité de la plateforme</Li>
            <Li>Usurper l'identité d'une autre personne ou organisation</Li>
            <Li>Spammer, démultiplier les comptes ou manipuler les systèmes de recommandation</Li>
          </ul>
          <p>
            Tout manquement peut entraîner la suspension immédiate du compte sans préavis ni remboursement.
          </p>
        </Section>

        {/* ── 4 ── */}
        <Section icon={FileText} number="4" title="Contenu et propriété intellectuelle">
          <p>
            Tout contenu que tu publies sur Smartix (cours, projets, ressources, commentaires, clips, stories)
            reste <strong className="text-white">ta propriété intellectuelle</strong>.
            En le publiant, tu accordes à Smartix une <strong className="text-white">licence non exclusive, mondiale et gratuite</strong> pour
            l'afficher, le distribuer et le promouvoir dans le cadre du fonctionnement de la plateforme.
          </p>
          <p>
            Tu garantis que le contenu que tu publies ne viole pas les droits de tiers.
            En cas de réclamation fondée de tiers, Smartix se réserve le droit de retirer immédiatement le contenu concerné.
          </p>
          <p>
            La marque <strong className="text-white">Smartix</strong>, son logo, son interface, ses algorithmes et son code source sont
            protégés par les lois congolaises et internationales sur la propriété intellectuelle.
            Toute reproduction, imitation ou utilisation sans autorisation écrite est strictement interdite.
          </p>
        </Section>

        {/* ── 5 ── */}
        <Section icon={ShoppingBag} number="5" title="Marketplace, transactions et commission" accent="#ff6b35">
          <p>
            Smartix propose une marketplace permettant aux créateurs de vendre leurs ressources numériques
            (cours, templates, PDF, applications Vibe-Coding, etc.).
          </p>

          <div className="bg-[#ff6b35]/10 border border-[#ff6b35]/20 rounded-xl p-4 my-3">
            <p className="text-[#ff6b35] font-bold text-sm mb-1">Commission Smartix</p>
            <p>
              Pour chaque vente réalisée sur la marketplace, Smartix prélève une commission de{' '}
              <strong className="text-white text-base">10 %</strong> du prix de vente hors taxes.
              Les <strong className="text-white">90 % restants</strong> sont crédités sur le portefeuille vendeur de l'utilisateur.
            </p>
          </div>

          <p className="font-semibold text-white/80">Méthodes de paiement acceptées :</p>
          <ul className="space-y-1">
            <Li><Tag>Carte bancaire</Tag> via Stripe (Visa, Mastercard, cartes africaines)</Li>
            <Li><Tag color="#4CAF50">M-Pesa</Tag> — mobile money (Kenya, RDC)</Li>
            <Li><Tag color="#F44336">Airtel Money</Tag> — mobile money (Afrique centrale)</Li>
            <Li><Tag color="#FF9800">Orange Money</Tag> — mobile money (Afrique francophone)</Li>
          </ul>

          <p className="font-semibold text-white/80 mt-3">En tant que vendeur, tu t'engages à :</p>
          <ul className="space-y-1">
            <Li>Vendre uniquement des contenus dont tu détiens pleinement les droits</Li>
            <Li>Décrire tes produits de manière honnête, précise et non trompeuse</Li>
            <Li>Fixer des prix raisonnables et transparents</Li>
            <Li>Ne pas proposer de contenu illégal ou contraire aux présentes CGU</Li>
          </ul>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-3">
            <p className="text-white/80 font-semibold mb-1">Politique de remboursement</p>
            <p>
              En raison de la nature numérique des ressources vendues sur Smartix, <strong className="text-white">aucun remboursement
              n'est accordé</strong> après l'accès au contenu acheté, sauf en cas de défaut technique prouvé ou de
              contenu non conforme à sa description. Tout litige peut être soumis à <span className="text-[#00B894]">contact@smartix.app</span>.
            </p>
          </div>

          <p>
            Smartix se réserve le droit de retirer tout produit violant ces conditions, de geler le portefeuille
            et de suspendre le compte du vendeur sans préavis en cas de fraude avérée.
          </p>
        </Section>

        {/* ── 6 ── */}
        <Section icon={Lock} number="6" title="Données collectées" accent="#6366f1">
          <p>
            Dans le cadre de son fonctionnement, Smartix collecte les données suivantes :
          </p>

          <div className="mt-3 space-y-0">
            <div className="grid grid-cols-4 gap-1 py-1.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/30">
              <span>Donnée</span><span>Source</span><span>Stockage</span><span>Finalité</span>
            </div>
            <DataRow donnee="Email" source="Inscription" stockage="MongoDB Atlas" finalite="Authentification, contact" />
            <DataRow donnee="Mot de passe" source="Inscription" stockage="MongoDB (bcrypt)" finalite="Sécurité du compte" />
            <DataRow donnee="Nom complet" source="Inscription" stockage="MongoDB Atlas" finalite="Affichage profil" />
            <DataRow donnee="Nom d'utilisateur" source="Inscription" stockage="MongoDB Atlas" finalite="Identification publique" />
            <DataRow donnee="Photo de profil" source="Upload volontaire" stockage="Serveur Smartix" finalite="Affichage profil" />
            <DataRow donnee="Numéro de téléphone" source="Marketplace" stockage="MongoDB Atlas" finalite="Transactions financières" />
            <DataRow donnee="Adresse IP" source="Automatique" stockage="MongoDB Atlas" finalite="Sécurité, anti-fraude" />
            <DataRow donnee="Appareil & plateforme" source="Automatique" stockage="MongoDB Atlas" finalite="Gestion sessions" />
            <DataRow donnee="Token push (FCM)" source="Consentement" stockage="MongoDB Atlas" finalite="Notifications push" />
            <DataRow donnee="Contenu publié" source="Actions utilisateur" stockage="MongoDB Atlas" finalite="Fonctionnement plateforme" />
            <DataRow donnee="Historique transactions" source="Marketplace" stockage="MongoDB Atlas" finalite="Comptabilité, litiges" />
            <DataRow donnee="Brouillons éditeur" source="Autosave" stockage="localStorage navigateur" finalite="Confort utilisateur" />
            <DataRow donnee="Cookies essentiels" source="Automatique" stockage="Navigateur" finalite="Session, authentification" />
            <DataRow donnee="Cookies analytics" source="Consentement" stockage="Navigateur" finalite="Statistiques anonymes" />
            <DataRow donnee="Quota outils IA" source="Automatique" stockage="MongoDB Atlas" finalite="Limitation d'abus" />
          </div>

          <p className="mt-3">
            Tes données ne sont <strong className="text-white">jamais vendues à des tiers</strong>.
            Conformément aux lois congolaises applicables, tu disposes d'un droit d'accès, de rectification et
            de suppression de tes données. Pour exercer ces droits, contacte-nous à{' '}
            <span className="text-[#00B894]">contact@smartix.app</span>.
          </p>
          <p>
            Tes données sont hébergées sur des serveurs de <strong className="text-white">MongoDB Atlas</strong> et de
            la plateforme <strong className="text-white">Replit</strong>, tous deux situés aux États-Unis.
            En utilisant Smartix, tu consens à ce transfert international de données nécessaire au fonctionnement du service.
          </p>
        </Section>

        {/* ── 7 ── */}
        <Section icon={Server} number="7" title="Services tiers" accent="#8b5cf6">
          <p>
            Smartix fait appel aux services tiers suivants pour son fonctionnement. Chaque prestataire applique
            sa propre politique de confidentialité que nous t'invitons à consulter :
          </p>
          <ul className="space-y-2 mt-2">
            <li>
              <Tag color="#10a37f">OpenAI</Tag>
              <span> — Assistant IA (SmartAI) et génération d'images. Tes messages sont transmis à OpenAI pour traitement.</span>
            </li>
            <li>
              <Tag color="#635bff">Stripe</Tag>
              <span> — Paiements par carte bancaire. Les données de paiement sont traitées directement par Stripe et ne transitent pas par nos serveurs.</span>
            </li>
            <li>
              <Tag color="#FFCA28">Firebase / FCM</Tag>
              <span> — Notifications push. Ton token d'appareil est transmis à Google Firebase pour la livraison des notifications.</span>
            </li>
            <li>
              <Tag color="#4DB33D">MongoDB Atlas</Tag>
              <span> — Base de données cloud. Toutes les données de la plateforme y sont stockées (USA).</span>
            </li>
            <li>
              <Tag color="#1a73e8">Replit</Tag>
              <span> — Hébergement du frontend et du backend (USA).</span>
            </li>
            <li>
              <Tag color="#ff6b35">Pollinations AI</Tag>
              <span> — Génération d'images IA à partir de tes prompts textuels.</span>
            </li>
          </ul>
          <p className="mt-2">
            Smartix n'est pas responsable des interruptions, modifications ou défaillances de ces services tiers.
          </p>
        </Section>

        {/* ── 8 ── */}
        <Section icon={Mic} number="8" title="Permissions matériel et navigateur" accent="#ec4899">
          <p>Certaines fonctionnalités de Smartix nécessitent l'accès à des ressources de ton appareil :</p>
          <ul className="space-y-2 mt-2">
            <li className="flex items-start gap-3">
              <Mic className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Microphone</strong> — Utilisé uniquement pour l'enregistrement
                de commentaires vocaux. L'accès est demandé au moment de l'utilisation et jamais en arrière-plan.
                Les enregistrements sont stockés sur nos serveurs en tant que contenu de commentaire.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Bell className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Notifications push</strong> — Utilisées pour t'alerter
                des nouvelles activités (messages, mentions, likes, etc.). Un consentement explicite te sera demandé.
                Tu peux les désactiver à tout moment dans les paramètres de ton navigateur ou de la plateforme.
              </span>
            </li>
          </ul>
          <p className="mt-2">
            Smartix n'accède <strong className="text-white">ni à ta caméra, ni à ta géolocalisation</strong>.
            Aucun accès matériel non mentionné ci-dessus n'est effectué.
          </p>
        </Section>

        {/* ── 9 ── */}
        <Section icon={Shield} number="9" title="Confidentialité et sécurité">
          <p>
            Smartix met en œuvre des mesures techniques et organisationnelles adaptées pour protéger tes données :
          </p>
          <ul className="space-y-1">
            <Li>Mots de passe hachés avec l'algorithme bcrypt</Li>
            <Li>Authentification par tokens JWT avec expiration et rotation des refresh tokens</Li>
            <Li>Accès API sécurisé par middleware d'authentification sur toutes les routes protégées</Li>
            <Li>Transferts de données chiffrés via HTTPS/TLS</Li>
            <Li>Contenu nettoyé contre les injections XSS (bibliothèque DOMPurify)</Li>
          </ul>
          <p>
            Malgré ces mesures, aucun système n'est infaillible. Smartix ne peut garantir une sécurité absolue
            et décline toute responsabilité en cas d'accès non autorisé résultant d'une négligence de ta part
            (partage de mot de passe, phishing, etc.).
          </p>
          <p>
            En cas de violation de données avérée susceptible de te porter préjudice, Smartix s'engage à
            t'en informer dans les meilleurs délais.
          </p>
        </Section>

        {/* ── 10 ── */}
        <Section icon={AlertCircle} number="10" title="Suspension et résiliation" accent="#f59e0b">
          <p>
            Smartix se réserve le droit de suspendre ou résilier ton compte, avec ou sans préavis, en cas de :
          </p>
          <ul className="space-y-1">
            <Li>Violation des présentes CGU</Li>
            <Li>Comportement abusif, frauduleux ou mettant en danger d'autres utilisateurs</Li>
            <Li>Fausse identité ou faux renseignements lors de l'inscription</Li>
            <Li>Non-respect de l'âge minimum requis</Li>
            <Li>Activité mettant en danger la plateforme, ses données ou son intégrité technique</Li>
          </ul>
          <p>
            En cas de suspension pour fraude sur la marketplace, le solde du portefeuille vendeur peut être
            gelé jusqu'à résolution du litige.
          </p>
          <p>
            Tu peux supprimer ton compte à tout moment depuis les paramètres de ton profil.
            La suppression entraîne la perte définitive de tes données, contenus publiés et solde de portefeuille non retiré.
          </p>
        </Section>

        {/* ── 11 ── */}
        <Section icon={AlertCircle} number="11" title="Limitation de responsabilité" accent="#ef4444">
          <p>
            Smartix est fourni <strong className="text-white">"en l'état"</strong>, sans garantie d'aucune sorte,
            expresse ou implicite. Smartix ne peut être tenu responsable :
          </p>
          <ul className="space-y-1">
            <Li>Des interruptions de service, maintenances planifiées ou incidents techniques</Li>
            <Li>Des pertes de données résultant d'une défaillance technique indépendante de notre volonté</Li>
            <Li>Du contenu publié par les utilisateurs (posts, commentaires, ressources vendues)</Li>
            <Li>Des dommages indirects liés à l'utilisation ou à l'impossibilité d'utiliser la plateforme</Li>
            <Li>Des défaillances des services tiers (Stripe, Firebase, OpenAI, etc.)</Li>
          </ul>
          <p>
            La responsabilité maximale de Smartix, pour quelque cause que ce soit, ne pourra excéder
            le montant que tu as versé à Smartix au cours des trois (3) derniers mois précédant le sinistre.
          </p>
        </Section>

        {/* ── 12 ── */}
        <Section icon={Globe} number="12" title="Droit applicable et juridiction" accent="#14b8a6">
          <p>
            Les présentes CGU sont régies par le <strong className="text-white">droit de la République Démocratique du Congo</strong>,
            ainsi que par les textes applicables de l'espace OHADA en matière commerciale et numérique.
          </p>
          <p>
            En cas de litige relatif à l'interprétation ou à l'exécution des présentes CGU, les parties
            s'efforceront de trouver une solution amiable. À défaut, les tribunaux compétents de la
            <strong className="text-white"> RDC</strong> seront seuls compétents.
          </p>
          <p>
            Les présentes CGU sont rédigées en <strong className="text-white">langue française</strong>,
            qui fait foi en cas de contradiction avec toute traduction.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-3 text-xs text-white/40">
            <p>
              Note : L'hébergement des données est assuré par des prestataires américains (MongoDB Atlas, Replit).
              En utilisant Smartix, tu consens au transfert de tes données vers ces juridictions étrangères,
              conformément aux engagements contractuels de ces prestataires en matière de protection des données.
            </p>
          </div>
        </Section>

        {/* Contact */}
        <div className="mt-10 bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#ff6b35]/15 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-[#ff6b35]" />
          </div>
          <div>
            <h3 className="font-bold text-white mb-1">Une question ou un litige ?</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Pour toute question sur ces conditions, toute demande relative à tes données personnelles,
              ou pour signaler un abus, contacte l'équipe Smartix à :{' '}
              <a href="mailto:contact@smartix.app" className="text-[#00B894] hover:underline font-medium">
                contact@smartix.app
              </a>
            </p>
            <p className="text-white/30 text-xs mt-2">
              Smartix S.A.R.L. — République Démocratique du Congo · Version 2.0, Avril 2026
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ConditionsUtilisation;
