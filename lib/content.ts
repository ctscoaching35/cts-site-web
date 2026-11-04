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
 * La page de la Préparation CTS (/plans) et son bloc sur l'accueil (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur,
 * L2, décision coach du 13/10/2026). Réécrite sur le vrai parcours le 04/11/2026 (PL1, « A » ; audit de l'app plan du
 * 03/11/2026, V1) : les séances dans Nolio, l'app tableau de bord, la semaine écrite chaque dimanche ; un seul nom,
 * « Préparation CTS » (décision coach du 04/11/2026). Rien n'y est promis que le parcours ne fasse aujourd'hui ; les
 * limites sont dites. Les prix viennent de l'API (/v1/config), pas d'ici. Validée par le coach le 04/11/2026 au soir,
 * avec trois retouches : la durée choisie et son jour de début à la fin de l'étape 1, l'invitation Nolio la semaine
 * avant le départ (lib/app/invitation.ts), et « Déplace-la d'abord dans ton calendrier Nolio » (Nolio ne relie une
 * activité à sa séance que le même jour).
 */
export const plansOffre = {
  hero: {
    eyebrow: 'Préparation CTS · trail',
    title: 'Ta préparation, construite sur ta course.',
    subtitle:
      'Ta course, ton niveau, ton terrain et tes jours disponibles : ta préparation se construit sur tes réponses et s’écrit semaine après semaine dans Nolio, jusqu’au jour J et à ta récupération. Pensée par deux kinésithérapeutes du sport. Ton app CTS est ton tableau de bord.',
    cta: 'Construire ma préparation',
    note: 'Achat unique, sans abonnement.',
  },
  etapes: {
    eyebrow: 'Comment ça marche',
    title: 'Trois étapes, et tu t’entraînes',
    items: [
      {
        titre: 'Tu réponds au questionnaire',
        texte:
          'Une dizaine de minutes : ta course (distance, dénivelé, trace GPX si tu l’as), ton niveau, ce que tu cours en ce moment, ton terrain d’entraînement et tes jours disponibles. Puis tu choisis la durée de ta préparation, et tu vois le jour où elle commence.',
      },
      {
        titre: 'Tu rejoins l’équipe CTS sur Nolio',
        texte:
          'Nolio est l’application d’entraînement, gratuite, que nous utilisons avec tous nos athlètes. La semaine avant ton départ, Nolio t’invite dans l’équipe CTS, ou te crée un compte. Tes séances arrivent dans son calendrier, et sur ta montre.',
      },
      {
        titre: 'Ta semaine s’écrit chaque dimanche',
        texte:
          'Chaque samedi, Nolio te demande tes jours disponibles de la semaine qui vient ; le dimanche soir, elle s’écrit d’après tes réponses et ta semaine écoulée. Ton app CTS te montre ta course, ta préparation, tes données et tes fiches.',
      },
    ],
  },
  contenu: {
    eyebrow: 'Ce que contient ta préparation',
    title: 'Tout ce qu’il faut, rien de trop',
    items: [
      'Chaque séance détaillée dans Nolio : échauffement, corps de séance, retour au calme, avec l’effort à viser sur l’échelle RPE, et tes repères de fréquence cardiaque ou d’allure quand tu les as.',
      'Des sorties longues qui progressent par paliers, et le terrain de ta course : côtes, descentes, navettes.',
      'Une séance de renforcement par semaine de charge, ses exercices en vidéo dans Nolio.',
      'Une semaine qui s’ajuste chaque dimanche : une séance manquée, tes disponibilités, et, avec ton accord de lecture, ta fatigue.',
      'Tes zones, mesurées par des tests simples, et ta fiche de course pour le jour J.',
      'Ta récupération après la course, écrite elle aussi.',
      'La bibliothèque CTS : 22 fiches (nutrition, récupération, renforcement, descente…) et les calculateurs.',
    ],
  },
  coachs: {
    eyebrow: 'Qui est derrière',
    title: 'Deux kinés du sport, une méthode',
    texte:
      'Juliette (Annecy) et Romain (Rennes) sont kinésithérapeutes du sport et coachs trail depuis plus de 10 ans, kinés sur l’UTMB Mont-Blanc. La méthode de leurs coachings individualisés, appuyée sur les données actuelles des sciences de l’entraînement, construit ta préparation.',
  },
  prix: {
    eyebrow: 'Les prix',
    title: 'Un prix selon la durée de ta préparation',
    note: 'Le questionnaire te propose les durées qui conviennent à ta course, avec la date de début de chacune. Achat unique, sans abonnement.',
    durees: [
      { mois: 3, semaines: 12 },
      { mois: 4, semaines: 16 },
      { mois: 6, semaines: 24 },
    ],
  },
  limites: {
    eyebrow: 'À savoir',
    title: 'Ce que la préparation ne fait pas',
    items: [
      'Elle se suit dans Nolio : il te faut un compte Nolio, gratuit (Nolio te le crée si tu n’en as pas), et son appli sur ton téléphone.',
      'Pas de coach qui suit ta préparation : elle se construit et s’ajuste d’après tes réponses et ce que tu cours. Pour un suivi par Juliette ou Romain, il y a le coaching individualisé.',
      'Les formats ouverts dépendent de ton niveau : un débutant prépare un Trail Court ou un Trail Marathon ; au-delà de 10 h de course, il faut avoir déjà terminé une course d’au moins la moitié de sa taille.',
      'Une course à moins de 4 semaines ne se prépare plus : notre check-list avant course est gratuite.',
      'Elle ne remplace pas un avis médical.',
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
        q: 'Ma course est plus proche que la durée de la formule.',
        r: 'Le questionnaire te conseille la formule qui commence en entier dans les 14 jours. Sinon, tu rejoins une formule déjà commencée à la semaine en cours : ses semaines passées sont sautées. Avant de payer, tu vois le jour où elle commence.',
      },
      {
        q: 'J’ai déjà un compte Nolio.',
        r: 'Donne son adresse au questionnaire : la semaine avant ton départ, tu reçois une invitation à rejoindre l’équipe CTS, à accepter. Sans compte, Nolio t’en crée un, gratuit, déjà dans l’équipe.',
      },
      {
        q: 'Que se passe-t-il si je rate une séance ?',
        r: 'Nolio fait foi : ta semaine suivante s’écrit d’après ce que tu as vraiment couru, sans saut de charge.',
      },
      {
        q: 'Je ne peux pas courir le jour prévu.',
        r: 'Chaque samedi, le questionnaire de Nolio te demande tes jours disponibles de la semaine qui vient : elle s’écrit dessus. Tu cours une séance un autre jour ? Déplace-la d’abord dans ton calendrier Nolio.',
      },
      {
        q: 'Ma course change de date.',
        r: 'Réponds à ton e-mail de bienvenue avec la nouvelle date : nous voyons avec toi comment ta préparation suit.',
      },
      {
        q: 'J’ai une douleur ou une blessure.',
        r: 'La préparation ne remplace pas un avis médical : adapte ou interromps la séance, et consulte un professionnel de santé.',
      },
      {
        q: 'Je prépare plusieurs courses.',
        r: 'Pour un autre objectif majeur, une nouvelle préparation, rangée dans le même compte. Une course de préparation sur la route de ton objectif s’ajoute gratuitement, dans l’app.',
      },
      {
        q: 'Et après ma course ?',
        r: 'Ta récupération s’écrit dans Nolio, puis tu quittes l’équipe CTS. Ton compte Nolio et tes séances restent à toi.',
      },
    ],
  },
  fin: {
    title: 'Prêt ? Construis ta préparation.',
    cta: 'Construire ma préparation',
  },
  // Le bloc de l'accueil, sous l'offre de coaching.
  blocAccueil: {
    eyebrow: 'Pas besoin d’un suivi ?',
    title: 'La Préparation CTS',
    texte:
      'Ta préparation construite sur ta course, écrite chaque semaine dans Nolio, par la méthode CTS. Achat unique, dès 39 €.',
    cta: 'Découvrir la Préparation CTS',
    href: '/plans',
  },
};
