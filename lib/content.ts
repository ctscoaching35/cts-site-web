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
};

export const nav = [
  { label: 'Accueil', href: '#hero' },
  { label: 'À propos', href: '#about' },
  { label: "L'offre", href: '#offre' },
  { label: 'Contact', href: '#contact' },
];

export const hero = {
  badge: 'Atteignez vos sommets',
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
    'Une formule unique. Pas de paliers, pas d’options cachées. Un suivi 100% individualisé, scientifique, à distance.',
  card: {
    label: 'CTS COACHING',
    price: '80€',
    pricePeriod: '/ mois',
    commitment: 'Sans engagement',
    features: [
      'Plan d’entraînement 100% individualisé',
      'Ajustement permanent selon tes sensations et tes données',
      'Suivi sur la plateforme Nolio',
      'Échanges illimités sur WhatsApp',
      'Double expertise kiné du sport + coach trail',
      'Fiches techniques exclusives (allure, nutrition, gestion de course)',
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
    'Réponse sous 48h. Pas de bot, pas de tunnel commercial — Juliette ou Romain te répond directement.',
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
