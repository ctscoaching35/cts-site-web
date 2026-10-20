/**
 * Contenu éditable du site CTS Coaching.
 * Tous les textes du site sont centralisés ici.
 * Pour modifier un texte, édite la valeur correspondante.
 */

export const site = {
  url: 'https://www.cts-coaching.com',
  name: 'CTS Coaching',
  email: 'ctscoaching35@gmail.com',
  instagram: 'cts.coaching',
  instagramUrl: 'https://instagram.com/cts.coaching',
  // Implantation : Juliette à Annecy, Romain à Rennes — coaching à distance partout
  cities: 'Annecy · Rennes',
  // Endpoint Formspree pour les soumissions du formulaire (envoie vers email ci-dessus)
  formspreeEndpoint: 'https://formspree.io/f/xgodvykb',
};

export const nav = [
  { label: 'Accueil', href: '#hero' },
  { label: 'À propos', href: '#about' },
  { label: "L'offre", href: '#offre' },
  { label: 'Bibliothèque', href: '/bibliotheque' },
  { label: 'Calculateurs', href: '/calculateurs' },
  { label: 'Contact', href: '#contact' },
];

// L'app des athlètes (décision coach du 20/10/2026 : « Mon espace » sur le site, un chemin permanent pour qui ne l'a pas
// installée ou a perdu l'e-mail d'invitation) ; derrière, la connexion par e-mail et code.
export const espace = { label: 'Mon espace', href: '/app' };

export const hero = {
  badge: 'Atteins tes sommets',
  title: 'City to',
  titleAccent: 'Summit.',
  subtitle:
    'Coaching trail 100% individualisé, à distance. Par des kinésithérapeutes du sport. Une approche scientifique, pour des objectifs concrets — du premier trail à l’ultra.',
  ctaPrimary: { label: 'Parle-nous de ton projet', href: '#contact' },
  ctaSecondary: { label: 'Découvrir l’offre', href: '#offre' },
  // Photo fond — choisir parmi /public/photos/
  background: '/photos/DSC_8334.jpg',
};

export const problem = {
  eyebrow: 'Le constat',
  title: 'Tu cours en ville. Tu rêves de montagne.',
  items: [
    {
      title: 'Pas de dénivelé à disposition',
      body: 'Bitume, parcs urbains, chemin forestier. Tu dois faire face aux contraintes d’une vie citadine, loin des sentiers.',
    },
    {
      title: 'Entraînements non structurés',
      body: 'Tu enchaînes les sorties au feeling. Sans périodisation, sans données, sans cap clair vers la course visée.',
    },
    {
      title: 'Blessures récurrentes',
      body: 'Périostite, tendinopathie, surcharge. Le corps signale, mais sans accompagnement adapté, le cycle recommence.',
    },
  ],
  resolution: 'On a construit CTS pour toi.',
};

export const about = {
  eyebrow: 'Les coachs',
  title: 'Juliette & Romain',
  subtitle:
    'Kinésithérapeutes du sport et coachs trail depuis plus de 10 ans. Juliette à Annecy, Romain à Rennes — entre plaine et montagne, on couvre tes deux réalités.',
  juliette: {
    name: 'Juliette VINOT',
    role: 'Kinésithérapeute du sport · Annecy',
    photo: '/lifestyle/IMG_5701.jpeg',
    points: [
      'D.U. Trail Running — Université de Besançon',
      '10+ ans d’expérience clinique et terrain',
      'Au pied des Aravis, sur les sentiers chaque semaine',
    ],
  },
  romain: {
    name: 'Romain LETERME',
    role: 'Kinésithérapeute du sport · Rennes',
    photo: '/lifestyle/IMG_5697.jpeg',
    points: [
      'Spécialiste des blessures du coureur',
      'Le trail comme connexion à l’essentiel',
      'Approche scientifique, exécution terrain',
    ],
  },
  credential: {
    title: 'Kinés sur l’UTMB Mont-Blanc',
    body: 'Nous accompagnons les coureurs sur un des trails les plus exigeants du monde. Cette expérience irrigue chaque plan que nous écrivons pour toi.',
  },
  stats: [
    { value: '10+', label: 'années de pratique' },
    { value: '100%', label: 'individualisé' },
    { value: '100%', label: 'à distance' },
  ],
};

export const offer = {
  eyebrow: 'L’offre',
  title: 'Un coaching pensé pour ta réalité',
  subtitle:
    'Pour le coaching, une formule unique. Pas de paliers, pas d’options cachées. Un suivi 100% individualisé, scientifique, à distance.',
  card: {
    label: 'CTS COACHING',
    price: '89€',
    pricePeriod: '/ mois',
    commitment: 'Sans engagement',
    features: [
      'Plan d’entraînement 100% individualisé',
      'Ajustement permanent selon tes sensations et tes données',
      'Suivi sur la plateforme Nolio',
      'Échanges illimités sur WhatsApp',
      'Double expertise kiné du sport + coach trail',
      'Fiches techniques CTS (allure, nutrition, préparation de course)',
      'Programme de renforcement spécifique avec vidéos à l’appui',
    ],
    cta: { label: 'Commencer mon coaching', href: '#contact' },
  },
};

export const testimonials = {
  eyebrow: 'Ils nous ont fait confiance',
  title: 'Trois trajectoires. Une même méthode.',
  items: [
    {
      initial: 'M.',
      meta: '34 ans · Paris',
      photo: '/lifestyle/IMG_5687.jpeg',
      quote:
        'Je tournais sur le bitume depuis des années. Avec CTS, j’ai appris à courir en nature, à lire un dénivelé, à doser. Un an plus tard, premier trail finisher — sans douleur, sans appréhension.',
      result: 'De la route au trail, en confiance',
    },
    {
      initial: 'L.',
      meta: '41 ans · Nantes',
      photo: '/lifestyle/IMG_5694.jpeg',
      quote:
        'Trois ans de blessures à répétition. Juliette et Romain ont structuré chaque semaine — charge, récupération, renfo ciblé. Aujourd’hui je cours plus, mieux, et le corps suit.',
      result: 'Sortie d’un cycle de blessures',
    },
    {
      initial: 'A.',
      meta: '38 ans · Lyon',
      photo: '/lifestyle/IMG_5705.jpeg',
      quote:
        'Mon premier ultra, je l’ai construit avec eux pendant 10 mois. Plan ajusté chaque semaine, fiches renfo en vidéo, réponses sur WhatsApp à toute heure. Rien n’a été laissé au hasard.',
      result: 'Premier ultra accompagné de bout en bout',
    },
  ],
};

export const instagram = {
  eyebrow: 'Au quotidien',
  title: 'Le coaching se vit aussi ici',
  subtitle:
    'Conseils, coulisses, contenus techniques. Suis le quotidien de CTS sur Instagram.',
  // 6 photos pour la grille — éviter les sorties de groupe (le coaching est individuel à distance)
  // Mix : terrain solo + portraits Juliette / Romain / les deux ensemble
  posts: [
    '/photos/DSC_8118.jpg', // terrain
    '/lifestyle/IMG_5701.jpeg', // Juliette
    '/photos/DSC_8212.jpg', // terrain
    '/lifestyle/IMG_5687.jpeg', // Juliette + Romain ensemble
    '/photos/DSC_8299.jpg', // terrain
    '/photos/DSC_8988.jpg', // terrain
  ],
  cta: '@cts.coaching — Rejoins la communauté',
};

export const contact = {
  eyebrow: 'On en parle ?',
  title: 'Parlons de ton prochain défi',
  subtitle:
    'Réponse sous 48h. Juliette ou Romain te répond directement.',
  form: {
    nameLabel: 'Prénom',
    emailLabel: 'Email',
    cityLabel: 'Ville',
    objectiveLabel: 'Ton prochain objectif trail',
    objectivePlaceholder: 'Premier trail, sortie de blessure, premier ultra...',
    messageLabel: 'Message',
    submit: 'Envoyer ma demande',
  },
};

export const footer = {
  tagline: 'CTS Coaching · Annecy · Rennes · Coaching trail à distance',
  legal: '© ' + new Date().getFullYear() + ' CTS Coaching. Tous droits réservés.',
};

/**
 * La page des plans clé en main (/plans) et son bloc sur l'accueil (CTS_LANCEMENT_CADRAGE.md dans le dépôt du
 * moteur, L2, décision coach du 13/10/2026). Rien n'y est promis que l'app ne fasse aujourd'hui ; les limites
 * sont dites. Les prix viennent de l'API (/v1/config), pas d'ici.
 */
export const plansOffre = {
  hero: {
    eyebrow: 'Plan d’entraînement trail',
    title: 'Ton plan, construit sur ta course.',
    subtitle:
      'Ta course, ton niveau, ton terrain et tes jours disponibles : ton plan se construit sur tes réponses, semaine par semaine, jusqu’au jour J. Pensé par deux kinésithérapeutes du sport, il vit dans une app qui te suit tout au long de ta préparation.',
    cta: 'Construire mon plan',
    note: 'Achat unique, sans abonnement.',
  },
  etapes: {
    eyebrow: 'Comment ça marche',
    title: 'Trois étapes, et tu t’entraînes',
    items: [
      {
        titre: 'Tu réponds au questionnaire',
        texte:
          'Une dizaine de minutes : ta course (distance, dénivelé, trace GPX si tu l’as), ton niveau, ce que tu cours en ce moment, ton terrain d’entraînement et tes jours disponibles.',
      },
      {
        titre: 'Ton plan est construit',
        texte:
          'Dès le paiement : la progression de tes sorties longues, tes séances de qualité, le travail en côte et en descente, l’affûtage, calés sur la date de ta course.',
      },
      {
        titre: 'Tu t’entraînes avec l’app',
        texte:
          'La séance du jour, détaillée à l’effort ; ton journal ; un plan qui s’ajuste quand une séance saute ou quand la fatigue s’installe.',
      },
    ],
  },
  contenu: {
    eyebrow: 'Ce que contient ton plan',
    title: 'Tout ce qu’il faut, rien de trop',
    items: [
      'Chaque séance détaillée : échauffement, corps de séance, retour au calme, avec l’effort à viser sur l’échelle RPE.',
      'Des sorties longues qui progressent par paliers, et le terrain de ta course : côtes, descentes, navettes.',
      'Tes zones : avec ta fréquence cardiaque ou ta vitesse critique, mesurées par des tests simples, tes repères de FC et d’allure sur chaque séance.',
      'Un plan qui s’adapte : séance manquée, fatigue, sensations notées dans ton journal, la suite s’ajuste sans saut de charge.',
      'Une séance à déplacer dans la semaine ? L’app te montre les jours qui conviennent le mieux.',
      'La bibliothèque CTS : 22 fiches (nutrition, récupération, renforcement, descente…) et les calculateurs.',
    ],
  },
  exemple: {
    eyebrow: 'Un exemple',
    title: 'À quoi ressemble un plan',
    texte:
      'Un trail de 42 km et 2 700 m de D+, niveau intermédiaire, quatre séances par semaine, préparé en 4 mois : le plan complet, semaine par semaine, dans sa version PDF.',
    lien: { label: 'Voir le plan d’exemple (PDF)', href: '/exemples/plan-exemple-cts.pdf' },
  },
  coachs: {
    eyebrow: 'Qui est derrière',
    title: 'Deux kinés du sport, une méthode',
    texte:
      'Juliette (Annecy) et Romain (Rennes) sont kinésithérapeutes du sport et coachs trail depuis plus de 10 ans, kinés sur l’UTMB Mont-Blanc. La méthode de leurs coachings individualisés, appuyée sur les données actuelles des sciences de l’entraînement, construit ton plan.',
  },
  prix: {
    eyebrow: 'Les prix',
    title: 'Un prix selon la durée de ta préparation',
    note: 'Le questionnaire te propose les durées qui conviennent à ta course. Achat unique, sans abonnement.',
    durees: [
      { mois: 3, semaines: 12 },
      { mois: 4, semaines: 16 },
      { mois: 6, semaines: 24 },
    ],
  },
  limites: {
    eyebrow: 'À savoir',
    title: 'Ce que le plan ne fait pas',
    items: [
      'Pas d’envoi sur ta montre pour l’instant : tes séances sont dans l’app.',
      'Pas de coach qui te répond : le plan est construit à partir de tes réponses. Pour un suivi par Juliette ou Romain, il y a le coaching individualisé.',
      'Les formats ouverts dépendent de ton niveau : un débutant prépare un Trail Court, l’ultra-trail est réservé aux coureurs confirmés.',
      'Il ne remplace pas un avis médical.',
    ],
    lienCoaching: { label: 'Découvrir le coaching individualisé', href: '/#offre' },
  },
  faq: {
    eyebrow: 'Questions fréquentes',
    title: 'Avant de te lancer',
    items: [
      {
        q: 'Je ne connais pas encore mon temps visé.',
        r: 'Le questionnaire te donne des repères de chrono pour ta course, selon sa distance et son dénivelé. Mets le temps qui te semble le plus probable.',
      },
      {
        q: 'Ma course est plus proche que la durée du plan.',
        r: 'Tu reçois quand même le plan entier, et tu le rejoins à la semaine en cours.',
      },
      {
        q: 'Que se passe-t-il si je rate une séance ?',
        r: 'Tu l’indiques dans ton journal : l’app ajuste la suite pour éviter un saut de charge.',
      },
      {
        q: 'Je ne peux pas courir le jour prévu.',
        r: 'Tu peux déplacer une séance dans la même semaine. L’app te signale les jours moins propices, sans te les interdire.',
      },
      {
        q: 'J’ai une douleur ou une blessure.',
        r: 'Le plan ne remplace pas un avis médical : adapte ou interromps la séance, et consulte un professionnel de santé.',
      },
      {
        q: 'Je prépare plusieurs courses.',
        r: 'Un plan par course : pour une autre course, un nouveau plan, rangé dans le même compte.',
      },
    ],
  },
  fin: {
    title: 'Prêt ? Construis ton plan.',
    cta: 'Construire mon plan',
  },
  // Le bloc de l'accueil, sous l'offre de coaching.
  blocAccueil: {
    eyebrow: 'Pas besoin d’un suivi ?',
    title: 'Le plan clé en main',
    texte:
      'Ton plan d’entraînement construit sur ta course, dans une app, par la méthode CTS. Achat unique, dès 39 €.',
    cta: 'Découvrir le plan',
    href: '/plans',
  },
};
