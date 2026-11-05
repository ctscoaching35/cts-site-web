/**
 * La porte de la démonstration de l'app des athlètes (lib/app/demonstration.ts) et ses paramètres d'adresse : à part,
 * sans aucune donnée, pour que la barre d'onglets (un composant du navigateur) et les actions la lisent sans charger la
 * démonstration.
 *
 * LA PORTE, FERMÉE EN PRODUCTION : la même que celle de l'espace coach (lib/app/demonstrationCoachPorte.ts) —
 * `next build` remplace process.env.NODE_ENV par « production » (la condition est fausse dans le code construit), une
 * seule des deux variables de Supabase posée la ferme, et Vercel (VERCEL=1) aussi.
 */
import { demonstrationCoachOuverte } from './demonstrationCoachPorte';

export const demonstrationOuverte = () => demonstrationCoachOuverte();

// Les plans de la démonstration (lib/app/exemples/app.json, scripts/demonstration-app.py).
export const CLES_DEMONSTRATION = ['L4', 'L1', 'R21', 'F1'] as const;
export const estPlanDeDemonstration = (planId: string | null | undefined) =>
  demonstrationOuverte() && (CLES_DEMONSTRATION as readonly string[]).includes(String(planId ?? ''));
export const REFUS_DEMONSTRATION = 'Démonstration : rien ne s’enregistre, rien ne part dans Nolio.';

// Les paramètres d'adresse de la démonstration, gardés d'une page à l'autre (les liens de l'app, la barre d'onglets).
// Les plans et le jour :
//   plan=L4|L1|R21|F1   le plan affiché (L4 par défaut) ; jour=AAAA-MM-JJ le jour simulé
//   coache=1            la version d'un coaché (« Coaching individualisé ») ; main=1 programmé à la main ;
//                       sansobjectif=1 un coaché sans objectif
//   retours=exemple     des semaines écoulées simulées (la jauge, les piliers, les graphiques)
//   fc1, vc, fc2, v1    des repères simulés (vc et v1 en km/h)
// Les états (lib/app/demonstration.ts, etatDeDemonstration) :
//   nolio=a_inviter|en_cours|invite|actif|refuse|sorti|arrete|coaching   où en est l'acheteur dans Nolio (par défaut :
//                       « a_inviter » avant le jour de son invitation, « actif » ensuite)
//   accord=0            sans accord de lecture
//   achat=AAAA-MM-JJ    le jour de l'achat (par défaut 60 jours avant le départ : la confirmation de charge est demandée)
//   confirmation=oui    la confirmation de charge déjà répondue (« C'est noté »)
//   semaine=retouchee|vide|muet|pas_partie|fatigue|manquee|test   la semaine en cours : lue dans Nolio retouchée par le
//                       coach, vide, Nolio qui ne répond pas, pas encore partie, ajustée par le moteur (fatigue, séance
//                       manquée), semaine de test ; par défaut, lue dans Nolio telle que le moteur l'a écrite
//   prepa=1             une course de préparation ajoutée (et sa fiche, /app/plan/course?course=AAAA-MM-JJ)
//   demarrage=masque    « Pour bien démarrer » masquée sur cet appareil
//   profil=vide         le profil d'entraînement d'un coaché pas encore rempli
//   objectif=demande    un objectif suivant demandé, en attente du coach
//   testvc=non_repropose  le test de vitesse critique plus proposé après deux fois sans valeur (D5, moteur 8.452) : la
//                       carte de l'accueil d'un acheteur, tant qu'aucune vitesse critique n'est connue (sans ?vc=)
// Sans être gardés : demande=envoyee (« Ta demande est partie »), reinitialiser=1 (efface sur ce navigateur les deux
// cookies que posait l'ancienne démonstration, cts_bienvenue et cts_demarrage).
export const PARAMETRES_DEMONSTRATION = ['plan', 'jour', 'fc1', 'vc', 'fc2', 'v1', 'retours', 'coache', 'main', 'sansobjectif',
  'nolio', 'accord', 'achat', 'confirmation', 'semaine', 'prepa', 'demarrage', 'profil', 'objectif', 'testvc'] as const;
// Ceux que lien() (lib/app/contexte.ts) ajoute à ce qu'il tire du contexte.
export const ETATS_DEMONSTRATION = ['nolio', 'accord', 'achat', 'confirmation', 'semaine', 'prepa', 'demarrage', 'profil', 'objectif',
  'testvc'] as const;
