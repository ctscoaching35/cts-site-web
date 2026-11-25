/**
 * LES MOTS DU COACH REMPLACENT LE JARGON, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : « l'espace coach doit être très simple sous la 9.x » ;
 * le document de départ est reports/Application coach — revue de simplicité, 24-11.md, § 3 « Jargon et textes difficiles à lire » et proposition 5). CINQUIÈME
 * SIMPLIFICATION, après « un seul endroit pour ce qui est à faire », « une page athlète courte », « ce que la v1 ne fait pas encore est caché » et les blocs supprimés.
 * Sous la 8.x, rien ne change : `motsDuCoach(false)` rend les mots d'avant, mot pour mot (`MOTS_DU_COACH.ancien`), `motsDuCoach(true)` ceux de la 9.x
 * (`MOTS_DU_COACH.simple`). `v9` vient de moteurEstV9 (lib/app/moteurEnLigne.ts), lu par la page ou le composant serveur.
 *
 * Trois sortes de choses y sont :
 *   - des TEXTES (« charge tenue » devient « du prévu tenu », « Hooper » devient « fatigue déclarée », « RPE » devient « effort ressenti », « D+ » devient « dénivelé », « EF »
 *     devient « endurance », « Seuil 1 », « Seuil 2 » et « vitesse critique » restent (ce sont les mots du coach), la légende des
 *     couleurs, la phrase de la dose, de la marche, du bloc et du pilier), chacun avec la ligne d'explication qui va sous le chiffre quand il n'est pas évident ;
 *   - des RÈGLES (`regles`) pour les phrases qui ne sont pas écrites ici mais par le moteur, par une lecture de Nolio ou par un calcul du site (le texte d'un point d'« À faire »,
 *     le détail d'un signal du soir, les sept réponses de « Pourquoi cette semaine ») : le même sens, dit autrement, sans toucher à la donnée ;
 *   - rien d'autre : ce fichier ne lit ni la base ni Nolio.
 * Les mots d'avant qui existent déjà dans un autre fichier (tableau.ts, prevision.ts, seriesDuSamedi.ts, entree.ts) n'y sont pas copiés : `ancien` les prend là où ils sont.
 *
 * Ce que dit chaque chiffre, d'après le code (rien n'est inventé) :
 *   - « charge tenue 87 % » : charge_tenue sur charge_prevue de la semaine passée (lib/app/espaceCoach.ts, tenue) ; la charge d'une séance est sa durée en minutes fois son RPE
 *     (lib/app/resumeSemaine.ts : « La charge (RPE × durée) ») ; la prévue est celle des séances qui ont un RPE prévu ;
 *   - « charge 1 240 » : charge_faite, la somme de ces durées fois RPE sur les séances dont l'athlète a noté le RPE ;
 *   - « Hooper 8,8 » : l'indice Hooper du dimanche, lu dans Nolio (lib/app/ecriture.ts, indiceHooper) ; plus il est haut, plus l'athlète est fatigué (la même phrase que dans son app,
 *     components/app/Graphiques.tsx) ; sa moyenne est celle des valeurs d'avant (lib/app/signauxSuivi.ts : hooper_semaines), et l'alerte part quand la dernière dépasse sa moyenne
 *     d'un écart (hooper_ecart) ;
 *   - la couleur : ce que ses signaux de la semaine laissent prévoir pour le passage du dimanche (lib/app/prevision.ts).
 *
 * Le calcul seul : il s'essaie sans réseau ni base (scripts/test-espace-coach-simple-5.mjs). Les textes ci-dessous ne sont lus que par le coach : aucun composant partagé avec l'app
 * de l'athlète ne les lit sans une option réservée au coach, fausse par défaut.
 */
import { TEXTES_PREVISION_D_AVANT, type Niveau as Couleur, type TextesPrevision } from './prevision';
import { TEXTES_SERIES } from './seriesDuSamedi';
import {
  calculDeLaMontee, libelleDeLaMontee, pourcentDeLaMontee, PILIERS_D_AVANT, texteCourtDeLaMontee, texteDeLaMontee, type Montee, type MotsDesPiliers,
} from './tableau';

// ─── La forme des mots ────────────────────────────────────────────────────────────────────────────────────────────

export type MotsDuCoach = {
  // « Mes athlètes » : la légende des couleurs et sa phrase, l'en-tête de la semaine passée, ce que disent ses chiffres, ses trois cases.
  legende: [Couleur, string][];
  legendeSous: string | null;
  entetePassee: (du: string, au: string) => string;
  legendeDesChiffres: string[];
  passee: { sansEffort: string; tenueSous: string | null; fatigue: (valeur: number, tendance: string | null) => string };
  // La montée (la jauge de la préparation) : son libellé, sa suite, son calcul, sa forme courte, et la ligne qui l'explique.
  montee: { libelle: (m: Montee) => string; suite: (m: Montee) => string; calcul: (m: Montee) => string; court: (m: Montee) => string; sous: string | null };
  piliers: MotsDesPiliers;
  prevision: TextesPrevision;
  // Le nom court d'un point dans « Ce qui l'attend », quand il change (genre -> nom).
  etiquettes: Record<string, string>;
  // La page d'un athlète : ses repères, les trois chiffres de sa semaine passée, sa revue du dimanche, ses 7 jours, son test, ses repères, son accord.
  reperes: { fc1: string; vs1: string; vc: string; fc2: string };
  tuiles: { tenue: string; fatigue: (tendance: string | null) => string; sansEffort: string; explicationTenue: string | null; explicationFatigue: string | null };
  revue: { sansEffort: string; tenue: (pourcent: number) => string };
  septJours: { fatigue: (valeur: number, moyenne: string | null) => string; explication: string | null };
  // Les phrases « ses 7 jours vides » et « le test saisi » sont écrites dans lib/app/cacherSousLaV1.ts (où l'essai de la troisième simplification les lit) : pas redites ici.
  test: { manque: string; geste: string };
  reperesAide: string;
  accordLu: string;
  dplus: (valeur: string) => string;
  // La page d'un objectif : ses cibles, la semaine par semaine, sa carte « Son départ ».
  cibles: { fc1: (v: string) => string; vs1: (a: string) => string; vc: (a: string) => string; fc2: (v: string) => string; liste: (s: string) => string; sans: string };
  semaines: { sansEffort: string; tenue: (pourcent: number) => string; charge: (n: string) => string; fatigue: (v: number) => string; legende: string[] };
  carteDepart: boolean;
  // « Sa semaine qui arrive » : l'effort visé d'une séance, le nom du bloc (« Bloc fondations » devient « Fondations »), l'intitulé et le texte d'une des sept réponses, « Ce qu'il a lu ».
  effortVise: (rpe: number | string) => string;
  bloc: (bloc: string) => string;
  reponse: { libelle: (libelle: string) => string; texte: (texte: string) => string };
  lu: {
    sansEffort: string; tenue: (pourcent: number) => string; sansEffortLu: string; colonneEffort: string; famille: Record<string, string>;
    pasLues: string; explique: string;
  };
  // « Chiffres » et « Demandes » : plus rien de l'infrastructure.
  chiffres: {
    coachingsSous: string; coachingsDetail: (etat: string) => string; tunnel: string; retouches: string; famille: Record<string, string>;
  };
  demandes: { illisibles: string; ficheCree: string; dplusPossible: string; vitesseCritique: string; fc1: string; fc2: string };
  series: { marche: readonly string[] };
  // Les mots d'une phrase écrite ailleurs (le moteur, une lecture de Nolio, un calcul) : sans rien changer à la donnée.
  enMots: (texte: string) => string;
};

// ─── Les règles : la même phrase, en mots du coach ────────────────────────────────────────────────────────────────

// Appliquées dans l'ordre, du plus précis au plus général. Elles ne touchent jamais un nom de séance (« SL D+ Bauges », « S1 marche active ») : seules les phrases de l'espace coach
// y passent (le texte d'un point d'« À faire », le détail d'un signal du soir, les détails de « Son entrée », les sept réponses du moteur).
const REGLES: [RegExp, string | ((...args: string[]) => string)][] = [
  // Le Hooper.
  [/\bson RPE et son Hooper\b/g, 'son effort ressenti et sa fatigue déclarée'],
  [/\bsa fatigue monte : indice\b/g, 'sa fatigue déclarée monte :'],
  [/\bIndice (?=\d)/g, 'Fatigue déclarée '],
  [/\bindice (?=\d)/g, 'fatigue déclarée '],
  [/\bquestionnaire et de Hooper\b/g, 'questionnaire et de fatigue'],
  [/\bQuestionnaire du samedi et Hooper\b/g, 'Questionnaire du samedi et question de fatigue'],
  [/\bQuestionnaire et Hooper\b/g, 'Questionnaire et question de fatigue'],
  [/\bde son Hooper\b/g, 'de sa fatigue déclarée'],
  [/\b([Ss])on Hooper\b/g, '$1a fatigue déclarée'],
  [/\b([Ll])e Hooper\b/g, '$1a fatigue déclarée'],
  [/\bdu Hooper\b/g, 'de la fatigue déclarée'],
  [/\bun Hooper\b/g, 'une fatigue déclarée'],
  [/\bHooper\b/g, 'fatigue déclarée'],
  // Le RPE.
  [/\bRPE à revoir\b/g, 'effort ressenti à revoir'],
  [/\bsans aucun RPE noté\b/g, 'sans aucun effort ressenti noté'],
  [/\bRPE (?=\d)/g, 'effort ressenti '],
  [/\b([Ss])on RPE\b/g, '$1on effort ressenti'],
  [/\bau RPE\b/g, 'à l’effort ressenti'],
  [/\b(du|le) RPE\b/g, (_m: string, a: string) => (a === 'du' ? 'de l’effort ressenti' : 'l’effort ressenti')],
  [/\b(ses|les|des) RPE\b/g, '$1 efforts ressentis'],
  [/\bRPE\b/g, 'effort ressenti'],
  // La charge tenue, la vitesse critique.
  [/\bde la charge prévue tenue\b/g, 'du prévu tenu'],
  [/(\d)[\s\u00a0\u202f]m D\+/g, '$1 m de dénivelé'],
  // La marche (le niveau d'une séance clé d'une semaine à l'autre), jamais « marche active » ni « marche rapide » (les noms des séances).
  // (« à » n'est pas une lettre pour \b : pas de \b devant lui.)
  [/(^|\s)à la marche suivante\b/g, '$1au niveau suivant'],
  [/\b(refont|refait) la même marche\b/g, '$1 le même niveau'],
  [/\bla même marche\b/g, 'le même niveau'],
  [/\bla marche suit le plan\b/g, 'sa progression suit le plan'],
  [/\bfixe la marche\b/g, 'fixe le niveau de la suivante'],
];

// ─── Les mots d'avant : ce que les écrans disaient, mot pour mot ──────────────────────────────────────────────────

const ANCIEN: MotsDuCoach = {
  legende: [['rouge', 'le moteur changera sa semaine'], ['orange', 'proche d’un seuil'], ['vert', 'elle suit le plan'], ['rien', 'rien de lu']],
  legendeSous: null,
  entetePassee: (du, au) => `Séances, charge tenue et Hooper : semaine du ${du} au ${au}${au.endsWith('.') ? '' : '.'}`,
  legendeDesChiffres: [],
  passee: { sansEffort: 'sans RPE', tenueSous: null, fatigue: (valeur, tendance) => `${valeur}${tendance ? ` · ${tendance}` : ''}` },
  montee: { libelle: (m) => libelleDeLaMontee(m, true), suite: (m) => texteDeLaMontee(m, true), calcul: calculDeLaMontee, court: texteCourtDeLaMontee, sous: null },
  piliers: PILIERS_D_AVANT,
  prevision: TEXTES_PREVISION_D_AVANT,
  etiquettes: {},
  reperes: { fc1: 'FC au seuil 1', vs1: 'Allure au seuil 1', vc: 'Vitesse critique', fc2: 'FC au seuil 2' },
  tuiles: {
    tenue: 'charge tenue', fatigue: (tendance) => `Hooper${tendance ? ` · ${tendance}` : ''}`, sansEffort: 'sans RPE', explicationTenue: null, explicationFatigue: null,
  },
  revue: { sansEffort: 'sans RPE', tenue: (pourcent) => `tenue (${pourcent} %)` },
  septJours: {
    fatigue: (valeur, moyenne) => ` · Hooper ${valeur}${moyenne !== null ? ` (moyenne ${moyenne})` : ''}`, explication: null,
  },
  test: { manque: 'son test de vitesse critique', geste: 'Saisir son test de vitesse critique' },
  reperesAide: 'Avec eux, les séances partent avec une allure sur le plat ou une FC, puis le RPE ; sans eux, au RPE, et le test s’écrit à la place d’une séance. Gardés seulement avec son accord de lecture.',
  accordLu: 'ses séances, son RPE et son Hooper sont lus dans Nolio, et ses repères gardés sur sa fiche.',
  dplus: (valeur) => `${valeur} m D+`,
  cibles: {
    fc1: (v) => `FC seuil 1 ${v}`, vs1: (a) => `allure seuil 1 ${a}/km`, vc: (a) => `VC ${a}/km`, fc2: (v) => `FC seuil 2 ${v}`,
    liste: (s) => `Cibles : ${s}.`, sans: 'Sans valeurs : cibles au RPE.',
  },
  semaines: {
    sansEffort: 'sans RPE', tenue: (pourcent) => `charge tenue ${pourcent} %`, charge: (n) => `charge ${n}`, fatigue: (v) => `Hooper ${v}`, legende: [],
  },
  carteDepart: true,
  effortVise: (rpe) => `RPE ${rpe}`,
  bloc: (bloc) => bloc,
  reponse: { libelle: (libelle) => libelle, texte: (texte) => texte },
  lu: {
    sansEffort: 'sans RPE', tenue: (pourcent) => `charge tenue : ${pourcent} % de la prévue`, sansEffortLu: ' (sans RPE lu : la charge compte le RPE prévu)', colonneEffort: 'RPE', famille: {},
    pasLues: 'Ses séances de qualité n’ont pas pu être lues : la marche suit le plan.',
    explique: 'Ses séances de qualité faites des 4 dernières semaines, classées par leur structure. La dernière de chaque famille, quand c’est la tienne, fixe la marche.',
  },
  chiffres: {
    coachingsSous: 'coachings · à brancher sur ton Stripe',
    coachingsDetail: (etat) => (etat === 'a_brancher'
      ? 'Ils se liront dans ton Stripe, en totaux par mois, avec une clé restreinte en lecture seule que tu crées dans Stripe et colles dans Vercel. Aujourd’hui, le site ne lit rien des coachings.'
      : 'Ta clé Stripe en lecture seule est posée : la lecture des coachings arrive à la prochaine étape. Aujourd’hui, le site ne lit rien des coachings.'),
    tunnel: 'Combien de personnes passent chaque étape, semaine par semaine. Les étapes sont comptées sans aucune donnée personnelle, une fois par visite. Les visites du site et leur provenance (Instagram, recherche…) sont dans Vercel, onglet Analytics.',
    retouches: 'Comptées chaque nuit sur la semaine en cours et la précédente. Semaines sans retouche : les semaines envoyées où rien n’a été modifié, déplacé, supprimé ni ajouté. Modifiée : sa révision a changé dans Nolio, son contenu ou son jour (Nolio change la révision d’une séance seulement déplacée). Dont déplacées : celles qui ont aussi changé de jour (comptées depuis le 16/11). Ajoutées : les séances de course que tu as posées dans une semaine écrite par le moteur. Durée des modifiées : leur durée dans Nolio par rapport à la durée prévue (−15 % : tu les raccourcis).',
    famille: {},
  },
  demandes: {
    illisibles: 'Les demandes ne se lisent pas : la migration demandes_coaching est-elle passée dans Supabase ?',
    ficheCree: 'Une fiche de coaché est créée à ce nom, avec sa vitesse critique du profil gratuit ; ses FC n’y sont reprises que si son consentement FC est donné.',
    dplusPossible: 'D+ possible', vitesseCritique: 'Vitesse critique', fc1: 'FC au seuil 1', fc2: 'FC au seuil 2',
  },
  series: { marche: TEXTES_SERIES.marche },
  enMots: (texte) => texte,
};

// ─── Les mots de la 9.x ───────────────────────────────────────────────────────────────────────────────────────────

const PHRASES = {
  // Une ligne sous chaque chiffre : la même, partout où le chiffre se lit.
  tenue: 'Sa charge faite sur sa charge prévue : chaque séance compte pour sa durée et son effort ressenti.',
  charge: 'La durée de chaque séance fois son effort ressenti, additionnées sur la semaine.',
  fatigue: 'Son questionnaire du dimanche : plus le chiffre est haut, plus il est fatigué.',
  fatigueMoyenne: 'Entre parenthèses, sa moyenne des dernières semaines.',
};
const sGrandeur = (n: number) => (n > 1 ? 's' : '');
const nbsp = ' ';

const SIMPLE: MotsDuCoach = {
  // La couleur dit ce que ses derniers jours laissent prévoir (lib/app/prevision.ts) : rouge, sa semaine sera sans doute changée dimanche ; orange, il s'en faut de peu.
  legende: [['rouge', 'sa semaine sera sans doute changée'], ['orange', 'à surveiller : il s’en faut de peu'], ['vert', 'elle suit le plan'], ['rien', 'rien de lu']],
  legendeSous: 'Le point de couleur dit ce que ses derniers jours laissent prévoir pour sa semaine de dimanche.',
  entetePassee: (du, au) => `Séances faites, part du prévu tenue et fatigue déclarée : semaine du ${du} au ${au}${au.endsWith('.') ? '' : '.'}`,
  legendeDesChiffres: [
    'Objectif : la part de la charge prévue qu’il a faite, et celle que le plan attendait à ce jour.',
    'Part du prévu : sa charge faite sur sa charge prévue, durée et effort ressenti comptés.',
    'Fatigue déclarée : son questionnaire du dimanche ; plus c’est haut, plus il est fatigué.',
  ],
  passee: {
    sansEffort: 'effort non noté', tenueSous: 'du prévu',
    fatigue: (valeur, tendance) => `fatigue ${valeur}${tendance ? ` · ${tendance}` : ''}`,
  },
  montee: {
    suite: (m) => (m.mesure === 'minutes' ? 'du volume prévu jusqu’à sa course, déjà fait' : 'de la charge prévue jusqu’à sa course, déjà faite'),
    libelle: (m) => `${pourcentDeLaMontee(m)} ${m.mesure === 'minutes' ? 'du volume prévu jusqu’à sa course, déjà fait' : 'de la charge prévue jusqu’à sa course, déjà faite'}`,
    calcul: (m) => (m.mesure === 'minutes'
      ? `Chaque séance faite compte pour sa durée. 100${nbsp}%, c’est tout le volume prévu jusqu’à sa course${nbsp}: ce chiffre ne fait que monter.`
      : `Chaque séance faite compte selon sa durée et son effort ressenti. 100${nbsp}%, c’est toute la charge prévue jusqu’à sa course${nbsp}: ce chiffre ne fait que monter.`),
    court: (m) => {
      const [x, y] = [Math.round(100 * m.fait), Math.round(100 * m.prevu)];
      return m.mesure === 'minutes' ? `${x}${nbsp}% du volume prévu fait · ${y}${nbsp}% attendu à ce jour` : `${x}${nbsp}% de la charge prévue faite · ${y}${nbsp}% attendue à ce jour`;
    },
    sous: 'Le premier chiffre, ce qu’il a fait ; le second, ce que le plan attendait à ce jour.',
  },
  piliers: {
    assiduite: (pourcent, faites, prevues) => `${pourcent} du prévu tenu · ${faites} séances faites sur ${prevues}`,
    sortiesLongues: (tenues, demandees, plusLongue) => `${tenues} sortie${sGrandeur(tenues)} longue${sGrandeur(tenues)} tenue${sGrandeur(tenues)} sur ${demandees} · sa plus longue : ${plusLongue}`,
    cles: (reussies, prevues, auBonEffort) => `${reussies} séance${sGrandeur(reussies)} clé${sGrandeur(reussies)} réussie${sGrandeur(reussies)} sur ${prevues}${auBonEffort ? ', au bon effort' : ''}`,
    fraicheur: (frais) => (frais ? 'Sa fatigue du dimanche est revenue dans sa zone habituelle.' : 'Sa fatigue du dimanche reste au-dessus de sa zone habituelle.'),
  },
  prevision: {
    sousSoixante: 'Si sa semaine reste sous 60 % du prévu : ses séances clés ne montent pas',
    plusDur: 'Si c’est une séance clé : la suivante ne monte pas',
  },
  etiquettes: { rpe: 'Effort ressenti à revoir' },
  reperes: { fc1: 'FC au seuil 1', vs1: 'Allure au seuil 1', vc: 'Vitesse critique', fc2: 'FC au seuil 2' },
  tuiles: {
    tenue: 'du prévu tenu', fatigue: (tendance) => `fatigue déclarée${tendance ? ` · ${tendance}` : ''}`, sansEffort: 'effort non noté',
    explicationTenue: PHRASES.tenue, explicationFatigue: PHRASES.fatigue,
  },
  revue: { sansEffort: 'effort non noté', tenue: (pourcent) => `tenue à ${pourcent} % du prévu` },
  septJours: {
    fatigue: (valeur, moyenne) => ` · fatigue déclarée ${valeur}${moyenne !== null ? ` (sa moyenne : ${moyenne})` : ''}`,
    explication: `${PHRASES.fatigue} ${PHRASES.fatigueMoyenne}`,
  },
  test: { manque: 'son test de vitesse critique', geste: 'Saisir son test de vitesse critique' },
  reperesAide: 'Avec eux, ses séances partent avec une allure sur le plat ou une FC, puis l’effort ressenti. Sans eux, elles partent à l’effort ressenti, et le test s’écrit à la place d’une séance. Gardés seulement avec son accord de lecture.',
  accordLu: 'ses séances, son effort ressenti et sa fatigue déclarée sont lus dans Nolio, et ses repères gardés sur sa fiche.',
  dplus: (valeur) => `${valeur} m de dénivelé`,
  cibles: {
    // « à » : « FC seuil 1 152 » se lisait « 1 152 » (relecture du 25/11/2026).
    fc1: (v) => `FC seuil 1 à ${v}`, vs1: (a) => `allure seuil 1 ${a}/km`, vc: (a) => `vitesse critique ${a}/km`, fc2: (v) => `FC seuil 2 à ${v}`,
    liste: (s) => `Cibles : ${s}.`, sans: 'Sans repères : ses séances se règlent à l’effort ressenti.',
  },
  semaines: {
    sansEffort: 'effort non noté', tenue: (pourcent) => `semaine tenue à ${pourcent}${nbsp}% du prévu`, charge: (n) => `charge faite ${n}`, fatigue: (v) => `fatigue déclarée ${v}`,
    legende: [
      'Semaine tenue : sa charge faite sur sa charge prévue, durée et effort ressenti comptés.',
      'Charge faite : la durée de chaque séance fois son effort ressenti, additionnées.',
      'Fatigue déclarée : son questionnaire du dimanche ; plus c’est haut, plus il est fatigué.',
    ],
  },
  // « Son départ » : la carte dit l'échelon, les fondations sautées et le rythme repris du moteur d'avant ; le « départ lu » des paramètres du plan n'est écrit que par le départ de la 8.x (lib/app/ecriture.ts,
  // deciderLeDepart, après le retour de `demarrerSousLeMoteurV1`) : sous la 9.x, ni la carte ni ses quatre phrases.
  carteDepart: false,
  effortVise: (rpe) => `effort visé ${rpe}`,
  bloc: (bloc) => bloc.replace(/^Bloc\s+/i, '').replace(/^./, (c) => c.toUpperCase()),
  reponse: {
    libelle: (libelle) => (libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() === 'dose' ? 'En résumé' : libelle),
    texte: (texte) => enMotsDe(texte),
  },
  lu: {
    sansEffort: 'effort non noté', tenue: (pourcent) => `semaine tenue à ${pourcent} % du prévu`, sansEffortLu: ' (effort ressenti non lu : la charge compte l’effort prévu)',
    colonneEffort: 'Effort ressenti', famille: { ef: 'Endurance', seuil1: 'Seuil 1', seuil2: 'Seuil 2' },
    pasLues: 'Ses séances de qualité n’ont pas pu être lues : sa progression suit le plan.',
    explique: 'Ses séances de qualité faites des 4 dernières semaines, classées par leur structure. La dernière de chaque famille, quand c’est la tienne, fixe le niveau de la suivante.',
  },
  // Plus de clé Stripe ni de Vercel : la phrase simple de « Cette partie n'est pas disponible », et l'infrastructure au journal du serveur (montrerLInfra, le fichier de la première simplification).
  chiffres: {
    coachingsSous: 'coachings · pas encore disponible',
    coachingsDetail: () => 'Cette partie n’est pas disponible pour l’instant.',
    tunnel: 'Combien de personnes passent chaque étape, semaine par semaine. Les étapes sont comptées sans aucune donnée personnelle, une fois par visite.',
    retouches: 'Comptées chaque nuit sur la semaine en cours et la précédente. Semaines sans retouche : les semaines envoyées où rien n’a été modifié, déplacé, supprimé ni ajouté. Modifiée : son contenu ou son jour a changé dans Nolio. Dont déplacées : celles qui ont aussi changé de jour (comptées depuis le 16/11). Ajoutées : les séances de course que tu as posées dans une semaine écrite par le moteur. Durée des modifiées : leur durée dans Nolio par rapport à la durée prévue (−15 % : tu les raccourcis).',
    famille: { ef: 'Endurance', seuil1: 'Seuil 1', seuil2: 'Seuil 2' },
  },
  demandes: {
    illisibles: 'Cette partie n’est pas disponible pour l’instant.',
    ficheCree: 'Une fiche de coaché est créée à ce nom, avec sa vitesse critique du profil gratuit ; ses FC n’y sont reprises que si son consentement FC est donné.',
    dplusPossible: 'Dénivelé possible', vitesseCritique: 'Vitesse critique', fc1: 'FC au seuil 1', fc2: 'FC au seuil 2',
  },
  series: {
    marche: [TEXTES_SERIES.marche[0], TEXTES_SERIES.marche[1], 'Ne retire pas « Ton point du dimanche » ni la question de fatigue du dimanche : elles restent.'],
  },
  enMots: (texte) => enMotsDe(texte),
};

function enMotsDe(texte: string): string {
  return REGLES.reduce((t, [regle, par]) => t.replace(regle, par as string), texte);
}

// ─── L'objet nommé et sa fonction ─────────────────────────────────────────────────────────────────────────────────

export const MOTS_DU_COACH: { ancien: MotsDuCoach; simple: MotsDuCoach } = { ancien: ANCIEN, simple: SIMPLE };

// Sous la 8.x (v9 faux) : les mots d'avant ; sous la 9.x : ceux du coach.
export const motsDuCoach = (v9: boolean): MotsDuCoach => (v9 ? SIMPLE : ANCIEN);

// Les règles seules, pour les essais : le jeu de phrases qu'elles couvrent.
export const REGLES_DES_MOTS = REGLES;

// Un point d'« À faire » (ou d'une colonne « Ce qui l'attend ») en mots du coach : son texte, son détail, sa ligne de dessous, et son nom court quand il change. La donnée n'est pas touchée :
// c'est la phrase que le coach lit. Sous la 8.x, rien (les points restent ceux d'avant, mesAthletes.ts ne les passe ici que derrière `v9`).
export function pointEnMotsDuCoach<T extends { genre: string; texte: string; detail?: string; sous?: string; etiquette?: string }>(p: T): T {
  const etiquette = SIMPLE.etiquettes[p.genre];
  return {
    ...p, texte: enMotsDe(p.texte), ...(p.detail ? { detail: enMotsDe(p.detail) } : {}), ...(p.sous ? { sous: enMotsDe(p.sous) } : {}), ...(etiquette ? { etiquette } : {}),
  };
}
