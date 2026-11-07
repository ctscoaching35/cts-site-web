/**
 * Plan d'entraînement clé en main — textes et échanges avec l'API CTS.
 *
 * Source : CONTRAT_API_CTS.md (dépôt du moteur). Les textes d'aide et les
 * descriptions d'options sont repris mot pour mot : ils ont été écrits pour que
 * l'athlète se situe correctement, les reformuler change le plan qu'il reçoit.
 * Aucune logique d'entraînement ici : les refus métier sont décidés par l'API.
 */

export const API_URL = (process.env.NEXT_PUBLIC_CTS_API_URL || 'http://localhost:5070').replace(/\/$/, '');

export type ConfigPlan = {
  formats_par_niveau: Record<string, string[]>;
  // La course de référence de l'ultra et du Trail Long de plus de 10 h (P2, 30/10/2026) : sa part minimale du km-effort.
  porte_ultra?: { part_min: number; temps_tl_h: number };
  formats: { code: string; nom: string; bornes: string }[];
  formats_par_distance?: [string, number | null, boolean][];
  durees_par_format: Record<string, number[]>;
  freq_min_par_format: Record<string, number>;
  freq_min_km_effort_seuil: number;
  freq_min_au_dela_du_seuil: number;
  freq_max_par_niveau: Record<string, number>;
  temps_max_par_format: Record<string, number>;
  reperes_km_effort_h: Record<string, [number, number, number]>;
  sortie_longue_min?: { h: number; message: string };
  // Les bornes du temps cible : elles règlent les durées possibles, plus aucune phrase à la saisie (22/10/2026).
  bandes_temps_cible?: { bornes_h: number[]; libelles: string[]; phrases_bornes: string[]; marge_min: number };
  semaines_par_formule: Record<string, number>;
  // Les durées que le temps visé admet, bande par bande (moteur : mois_par_temps_cible) ; absentes d'une API d'avant.
  mois_par_bande?: number[][];
  quatre_mois_jusqua_h?: number;
  jours: string[];
  prix_eur_par_mois: Record<string, number>;
  mode_paiement: 'test' | 'stripe';
  // L'avertissement santé du PDF, mot pour mot (cts_contenu.avertissement_sante(), 07/10/2026).
  avertissement?: { surtitre: string; paragraphes: string[] };
};

export type Champs = {
  nom: string;
  email: string;
  niveau: string;
  volume_hebdo_actuel: string;
  sortie_longue_actuelle: string;
  format: string;
  duree_mois: string;
  course_nom: string;
  date_course: string;
  distance_km: string;
  dplus_m: string;
  dmoins_m: string;
  temps_cible: string;
  terrain: string;
  jours_disponibles: string[];
  jour_sl: string;
  freq_hebdo: string;
  // Section 7 : la blessure ne quitte jamais le navigateur ; « oui » arrête l'achat (décision coach du 20/10/2026).
  blessure: string;
  // Le dépistage cardiaque (audit de la programmation trail du 30/10/2026, P4) : comme la blessure, il ne quitte jamais
  // le navigateur ; « oui » avertit (consulter avant de commencer) sans arrêter l'achat.
  coeur: string;
  // L'arrêt récent (second audit du moteur, D16 : deux semaines sans séance dure au départ) ne se demande plus : retiré
  // de l'achat le 05/11/2026 (S9), puis du coaching le même soir (1B). Le champ part toujours vide ; le moteur 8.452 lit
  // son absence comme « non ».
  coupure: string;
  // « oui » : un premier marathon (route, signalé au coach sous 20 semaines de préparation).
  premier_marathon: string;
  // « oui » : un tapis de course qui monte (FT3-1, décision coach du 01/11/2026), facultatif ; le moteur s'en sert quand
  // la côte manque (moins de 5 min) et que la course monte.
  tapis: string;
};

export const champsVides: Champs = {
  nom: '', email: '', niveau: '', volume_hebdo_actuel: '', sortie_longue_actuelle: '',
  format: '', duree_mois: '', course_nom: '', date_course: '',
  distance_km: '', dplus_m: '', dmoins_m: '', temps_cible: '', terrain: '',
  jours_disponibles: [], jour_sl: '', freq_hebdo: '', blessure: '', coeur: '', coupure: '', premier_marathon: '',
  tapis: '',
};

// LE QUESTIONNAIRE PLUS COURT (P1-P7, décision coach du 07/11/2026, « tout A ») : des aides plus courtes, validées par le
// coach mot pour mot ; ce qui part au moteur ne change pas.
export const textes = {
  niveau: {
    // P3-a (07/11/2026) : l'aide et la note sous les trois choix fusionnent en une phrase, sous le titre.
    aide:
      'Coche celle où tu te reconnais aujourd’hui, pas celle que tu vises : un niveau surestimé donne un plan plus dur que ce que tu peux encaisser.',
    options: [
      {
        valeur: 'debutant',
        titre: 'Débutant',
        description:
          'Je cours depuis moins de deux ans. Je n’ai jamais suivi de plan structuré. Le fractionné ne fait pas partie de mes habitudes. Au-delà d’1h30 de course, je commence à subir.',
        // P3-b (07/11/2026) : la ligne des formats sous le débutant seulement, le seul niveau qu'elle ferme ; jamais pour
        // le coach, où tout format s'ouvre à tout niveau.
        formats: 'Formats ouverts : Trail Court et Trail Marathon.',
      },
      {
        valeur: 'intermediaire',
        titre: 'Intermédiaire',
        description:
          'Je cours régulièrement depuis deux ans ou plus. J’ai déjà suivi un plan d’entraînement. Je pratique le fractionné. Je tiens 2h30 de course sans difficulté majeure.',
      },
      {
        valeur: 'confirme',
        titre: 'Confirmé',
        description:
          'Je m’entraîne de façon structurée depuis plusieurs années, plusieurs fois par semaine. J’ai déjà terminé des courses longues. Les sorties de 4h font partie de ma pratique.',
      },
    ] as { valeur: string; titre: string; description: string; formats?: string }[],
  },
  // Charge actuelle (24/09/2026). Aucun pourcentage dans l'aide, décision du coach du
  // 26/09/2026 : l'étude dit 10 %, le plan monte par marches de 15 % au plus, et
  // l'athlète lirait les deux.
  // S9 (décision coach du 05/11/2026, « ne complique pas les choses ») : deux questions simples, sans note dessous ; la
  // question de l'arrêt récent quitte le questionnaire d'achat et la confirmation de charge, puis celui du coaching (1B,
  // le même soir).
  charge: {
    titre: 'Ce que tu cours en ce moment',
    // P3-c (07/11/2026).
    aide: 'Ta plus longue sortie fixe le point de départ de ton plan : il ne la dépassera que par petites marches.',
    volume: 'Ton volume de course par semaine, en ce moment',
    sortieLongue: 'Ta plus longue sortie en ce moment',
  },
  // P3-d (07/11/2026).
  gpx: 'Elle donne le vrai profil du parcours et affine ton plan ; sans elle, il se construit sur le D+ que tu indiques.',
  tempsCible: 'Même une estimation large vaut mieux que rien — c’est ce qui calibre l’intensité de tout le plan.',
  // Sans paragraphe d'aide (décision coach du 07/10/2026 : « ça n'apporte rien ») : les quatre
  // descriptions disent la longueur de côte.
  terrain: {
    options: [
      { valeur: 'vallonne', titre: 'Vallonné', description: 'Côtes courtes, jusqu’à 1min30 de montée.' },
      // « Côtes moyennes » (décision coach du 04/11/2026, « 9 A ») : « Intermédiaire » se confondait avec le niveau ; la
      // valeur envoyée au moteur ne change pas.
      { valeur: 'intermediaire', titre: 'Côtes moyennes', description: 'Côtes de 2 à 5 min de montée.' },
      { valeur: 'pentu', titre: 'Pentu', description: 'Côtes de 5 à 10 min de montée.' },
      { valeur: 'tres_pentu', titre: 'Très pentu', description: 'Côtes de plus de 10 min de montée.' },
    ],
    // Posée avec une côte de moins de 5 min seulement (FT3-1, décision coach du 01/11/2026) : facultative, sans effet
    // ailleurs.
    tapis: 'As-tu accès à un tapis de course qui monte ?',
  },
  // La section « Ta semaine » (« Ta disponibilité » jusqu'au 07/11/2026, P2).
  disponibilite: {
    aide:
      // Le point de départ (décision coach du 20/10/2026) : le questionnaire du samedi dans Nolio les change ensuite.
      // P3-e (07/11/2026).
      'Tes séances se placent sur ces jours, jamais deux séances dures d’affilée. Chaque samedi, un court questionnaire dans Nolio te permet de changer tes jours de la semaine suivante.',
  },
  sante: {
    blessure: 'Une blessure ou une douleur t’empêche-t-elle de courir normalement en ce moment ?',
    coeur: 'À l’effort, as-tu déjà ressenti une douleur dans la poitrine, un malaise ou un essoufflement inhabituel, ou as-tu une maladie du cœur connue ?',
    // Le conseil d'un « oui » (P4, 30/10/2026), redit au récapitulatif sans case de plus (J9, audits du 05/11/2026).
    conseilCoeur: 'Avant de commencer, montre ces signes à ton médecin : ils méritent un avis avant une préparation, et un bilan avec un test d’effort te dira si tu peux t’entraîner sans risque. Tant qu’ils reviennent, arrête-toi et ne force jamais au travers.',
  },
};

/** Avertissements non bloquants (CONTRAT_API_CTS.md §5 bis), confirmés avant de continuer. */
export function avertissements(c: Champs, config: ConfigPlan, aujourdhui = new Date()): string[] {
  const out: string[] = [];
  // La blessure en cours n'est plus un avertissement : elle arrête l'achat, dans le questionnaire (décision coach du
  // 20/10/2026). L'arrêt récent non plus : il ne se demande plus (S9 et 1B, 05/11/2026).
  // Le Trail Marathon du débutant (audit de la programmation trail du 30/10/2026, P1 ; décision coach) : ouvert, avec
  // ce qui protège le mieux d'une première longue course, la blessure de surcharge et l'abandon.
  if (c.niveau === 'debutant' && c.format === 'TM') {
    out.push(
      'Une première course de cette distance : vise d’abord l’arrivée. Marche dans les côtes raides, bois à ta soif, sans te forcer, et si tu le peux, cours avant une course d’environ la moitié de la distance. Ton plan reste celui du débutant : il monte doucement.'
    );
  }
  // Trois séances sur une course de 50 km-effort et plus (audit de la programmation trail du 30/10/2026, P3) : acceptées
  // jusqu'à 100 km-effort, avec ce qu'elles changent.
  if (!FORMATS_ROUTE.some((f) => f.code === c.format) && c.freq_hebdo === '3' && kmEffort(c.distance_km, c.dplus_m) >= 50) {
    out.push(
      'Trois séances par semaine pour une course de cette taille : ton plan garde la même sortie longue, avec un peu moins de volume autour. Une séance de marche en côte, de vélo ou de renforcement en plus, si tu le peux, compense une partie de l’écart.'
    );
  }
  const n = config.semaines_par_formule[`${c.format}-${c.duree_mois}`];
  if (n && c.date_course) {
    const course = new Date(`${c.date_course}T00:00:00`);
    const decalageLundi = (course.getDay() + 6) % 7;
    const lundiS1 = new Date(course);
    lundiS1.setDate(course.getDate() - decalageLundi - 7 * (n - 1));
    const jour = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
    const semainesPassees = Math.floor((jour.getTime() - lundiS1.getTime()) / (7 * 86400000));
    if (semainesPassees >= 1) {
      const dans = Math.max(Math.floor((course.getTime() - jour.getTime()) / (7 * 86400000)), 0);
      // Le plan repart de la semaine rejointe (audit du 27/09/2026, B4 ; décision coach du
      // 28/09/2026) : plus de « choisis une formule plus courte », qui n'existait pas
      // toujours (Trail Marathon de 3 mois) et que le site ne peut pas vérifier.
      // Accord et arrondi (audit du 27/09/2026, K3) : « dans 1 semaines », et « il y a 3
      // semaines » pour un plan commencé depuis 27 jours.
      const ilYa = Math.round((jour.getTime() - lundiS1.getTime()) / (7 * 86400000));
      const semaines = (n: number) => (n === 0 ? 'moins d’une semaine' : `${n} semaine${n > 1 ? 's' : ''}`);
      out.push(
        `Ta course est dans ${semaines(dans)} : ton plan de ${c.duree_mois} mois a commencé le ${lundiS1.toLocaleDateString('fr-FR')}, il y a ${semaines(ilYa)}. Tu le rejoins cette semaine, les semaines déjà passées sont sautées : ta sortie longue repart de ta plus longue sortie récente, sans jamais la dépasser de plus d’une petite marche.`
      );
    }
  }
  return out;
}

/** Repères de chrono, une aide jamais un contrôle : km-effort / vitesse, arrondi à 5 min. */
// coach : le questionnaire du coaching individualisé (QD6, décision coach du 19/10/2026) : les mêmes portes, sans
// renvoyer au coaching qu'il est en train de faire.
const HORS_DU_MOTEUR = 'Le moteur ne construit pas ce cas : à préparer toi-même, hors du parcours automatique.';

// LES REPÈRES DE CHRONO EN CINQ BANDES (décisions coach du 23/10/2026 ; CTS_CHRONO_RECHERCHE.md dans le dépôt du moteur) :
// la vitesse médiane des finishers selon la taille de la course en km-effort (presque plate jusqu'à 190, puis la
// deuxième nuit), et cinq bandes de finishers coupées à 10, 30, 60 et 85 % : élite au-dessus de 1,35 fois la médiane,
// rapide de 1,12 à 1,35, intermédiaire de 0,96 à 1,12, prudent de 0,86 à 0,96, proche des barrières en dessous.
export function vitesseMediane(ke: number): number {
  return ke <= 190 ? 8.9 * (ke / 60) ** -0.07 : 8.2 * (ke / 190) ** -0.58;
}
const COUPURES = [1.35, 1.12, 0.96, 0.86];
const NOMS_BANDES = ['élite', 'rapide', 'intermédiaire', 'prudent', 'proche des barrières'];
const heuresMinutes = (h: number) => {
  const t = Math.round(h * 12) * 5;
  return `${Math.floor(t / 60)}h${String(t % 60).padStart(2, '0')}`;
};
const kmEffort = (km: string, dplus: string) => {
  const k = parseFloat(km.replace(',', '.'));
  return k > 0 ? k + (parseFloat(dplus.replace(',', '.')) || 0) / 100 : 0;
};

// LES REPÈRES EN LISTE (P4, décision coach du 07/11/2026, « A ») : une structure au lieu d'une phrase, que le
// questionnaire affiche en petite liste ; le même calcul et les mêmes bornes plafonnées. kmEffort : arrondi ; bandes : de
// l'élite aux proches des barrières, le temps de chacune (« moins de 6h20 », « 6h20 à 7h40 », « plus de 9h55 ») ; fin :
// la phrase du plafond dépassé, sinon null.
export type ReperesChrono = { kmEffort: number; bandes: { nom: string; temps: string }[]; fin: string | null };
export function reperesChrono(c: Champs, config: ConfigPlan, coach = false): ReperesChrono | null {
  const ke = kmEffort(c.distance_km, c.dplus_m);
  if (!c.format || !(ke > 0)) return null;
  // Un repère au-delà du plafond du format le dit, au lieu de proposer un chrono que le formulaire refusera ensuite
  // (audit du 27/09/2026, C21 ; décision coach du 28/09/2026 : « dire la vérité au bon endroit »).
  const plafond = config.temps_max_par_format[c.format];
  const [p10, p30, p60, p85] = COUPURES.map((k) => ke / (k * vitesseMediane(ke)));
  const borne = (h: number) => (plafond !== undefined && h > plafond ? `${plafond}h` : heuresMinutes(h));
  const de = (h1: number, h2: number) => (plafond !== undefined && h1 > plafond ? `plus de ${plafond}h` : `${heuresMinutes(h1)} à ${borne(h2)}`);
  const temps = [`moins de ${borne(p10)}`, de(p10, p30), de(p30, p60), de(p60, p85), `plus de ${borne(p85)}`];
  const depasse = plafond !== undefined && p85 > plafond;
  const fin = !depasse ? null
    : coach ? `Au-delà de ${plafond}h, c’est hors du plafond de ce plan. ${HORS_DU_MOTEUR}`
      : `Au-delà de ${plafond}h, c’est hors du plafond de ce plan : un coaching individualisé est plus adapté.`;
  return {
    kmEffort: Math.round(ke),
    bandes: NOMS_BANDES.map((nom, i) => ({ nom: nom.charAt(0).toUpperCase() + nom.slice(1), temps: temps[i] })),
    fin,
  };
}

// UN TEMPS DE TÊTE DE COURSE (S13, décision coach du 05/11/2026, « A » ; audit A-9, I5) : un temps visé sous la borne
// « élite » des repères de chrono (les 10 % les plus rapides des finishers de courses de cette taille) se dit sous le
// champ, sans case ni refus : la préparation se calibre sur ce temps. Hors route (le coach seul la prépare).
export const PHRASE_TEMPS_DE_TETE = 'C’est un temps de tête de course : vérifie-le, ta préparation en dépend.';
export function tempsDeTete(c: Champs): boolean {
  const ke = kmEffort(c.distance_km, c.dplus_m);
  const h = lireTemps(c.temps_cible ?? '');
  if (!c.format || FORMATS_ROUTE.some((f) => f.code === c.format) || !(ke > 0) || h === null || !(h > 0)) return false;
  return h < ke / (COUPURES[0] * vitesseMediane(ke));
}

// LA COURSE DE RÉFÉRENCE (décision coach du 23/10/2026, facultative) : une course récente, ramenée à la course visée par
// la pente des vainqueurs (temps en km-effort à la puissance 1,2, la plus juste pour un même coureur) ; sa bande et un
// chrono estimé à 6 % près. Réserve quand les deux courses sont très différentes, ou au-delà d'une nuit.
export type CourseReference = { km: string; dplus: string; temps: string };

// LA PORTE DE L'ULTRA (audit de la programmation trail du 30/10/2026, P2) : l'ultra et le Trail Long de plus de 10 h
// demandent une course terminée ces deux dernières années, d'au moins la moitié du km-effort visé ; l'API la vérifie.
// S14 (décision coach du 05/11/2026, « A » ; audit G-13) : dès que le temps visé dépasse 10 h, QUEL QUE SOIT LE FORMAT
// (un Trail Marathon de 15 h d'un débutant compris) ; l'ultra la demande toujours. Le refus est celui du moteur, que le
// questionnaire affiche tel quel. Le minimum en km-effort, ou null quand la course n'en demande pas (et pour le coach,
// qui juge).
export function referenceExigee(c: Champs, config: ConfigPlan, coach = false): number | null {
  const porte = config.porte_ultra;
  const h = lireTemps(c.temps_cible ?? '');
  if (coach || !porte || !(c.format === 'UT' || (h !== null && h > porte.temps_tl_h))) return null;
  const ke = kmEffort(c.distance_km, c.dplus_m);
  return ke > 0 ? Math.ceil(ke * porte.part_min) : null;
}
export function placementReference(c: Champs, ref: CourseReference): string | null {
  const ke = kmEffort(c.distance_km, c.dplus_m);
  const keRef = kmEffort(ref.km, ref.dplus);
  const tRef = lireTemps(ref.temps);
  if (!(ke > 0 && keRef > 0 && tRef && tRef > 0)) return null;
  const t = tRef * (ke / keRef) ** 1.2;
  const r = ke / t / vitesseMediane(ke);
  const bande = NOMS_BANDES[COUPURES.findIndex((k) => r > k)] ?? NOMS_BANDES[4];
  const ecart = ke / keRef;
  const reserves = [
    ecart > 2 || ecart < 0.5 ? `les deux courses sont très différentes (${Math.round(keRef)} contre ${Math.round(ke)} km-effort)` : '',
    t > 30 && tRef < 24 ? 'au-delà d’une nuit, la fatigue pèse davantage : vise plutôt la bande d’en dessous' : '',
  ].filter(Boolean);
  return `Cette course de référence (${Math.round(keRef)} km-effort en ${heuresMinutes(tRef)}) place en bande ${bande} : environ `
    + `${heuresMinutes(t)} ici (${heuresMinutes(t * 0.94)} à ${heuresMinutes(t * 1.06)}).${reserves.length ? ` À prendre avec prudence : ${reserves.join(' ; ')}.` : ''}`;
}

/**
 * Format de la course, déduit de la distance (CONTRAT_API_CTS.md §4 ; audit du questionnaire du
 * 01/10/2026, F4) : la question du format n'avait qu'une réponse possible. Bornes lues dans
 * /v1/config (formats_par_distance : code, borne haute en km ou null, borne incluse) ; '' tant
 * que la distance n'est pas lisible ou que l'API ne fournit pas les bornes.
 */
// La route (moteur 8.349, CTS_ROUTE_CADRAGE.md) : les formats que seul le questionnaire du coach propose ; semaines : la
// plus longue trame.
export const ROUTE_10KM = 'R10';
export const FORMATS_ROUTE: { code: string; nom: string; court: string; km: string; exemple: string; semaines: number }[] = [
  { code: 'R10', nom: '10 km sur route', court: '10 km', km: '10', exemple: '0h46', semaines: 16 },
  { code: 'R21', nom: 'Semi-marathon', court: 'semi', km: '21.1', exemple: '1h45', semaines: 16 },
  { code: 'R42', nom: 'Marathon', court: 'marathon', km: '42.195', exemple: '3h45', semaines: 24 },
];

export function formatDepuisDistance(distance: string, config: ConfigPlan): string {
  const km = parseFloat(distance.replace(',', '.'));
  if (!(km > 0) || !config.formats_par_distance) return '';
  for (const [code, borne, incluse] of config.formats_par_distance) {
    if (borne === null || km < borne || (incluse && km === borne)) return code;
  }
  return '';
}

/** Le format déduit est-il ouvert au niveau déclaré ? Sans niveau, oui (l'API reste juge). */
// Les durées que sa course admet (décision coach du 20/10/2026, « montrer les seules possibles ») : celles du format,
// et, son temps visé lisible, celles que ce temps admet (la même règle que le moteur, mois_par_temps_cible : une course
// de 4 à 8 h ne se prépare pas en 3 mois). Plus de durée proposée que le moteur refuserait ensuite.
export function dureesPossibles(c: Champs, config: ConfigPlan): number[] {
  const duFormat = config.durees_par_format[c.format] ?? [];
  const h = lireTemps(c.temps_cible ?? '');
  const bornes = config.bandes_temps_cible?.bornes_h;
  if (h === null || h <= 0 || !config.mois_par_bande || !bornes) return duFormat;
  const i = bornes.findIndex((b) => h < b);
  const bande = i === -1 ? config.mois_par_bande.length - 1 : i;
  const derniere = bande === config.mois_par_bande.length - 1;
  const parTemps = [...(config.mois_par_bande[bande] ?? []), ...(derniere && h <= (config.quatre_mois_jusqua_h ?? 0) ? [4] : [])];
  return duFormat.filter((m) => parTemps.includes(m));
}

// La durée qui colle à la date de sa course (QD1 du coaching, la même lecture) : la plus courte dont la première semaine
// tombe le lundi qui vient ou avant ; une course plus loin que la plus longue, la plus longue. null sans date.
export function dureeConseillee(c: Champs, config: ConfigPlan, durees: number[], aujourdhui = new Date()): number | null {
  if (!durees.length || !/^\d{4}-\d{2}-\d{2}$/.test(c.date_course ?? '')) return null;
  const jour = (d: Date) => d.toISOString().slice(0, 10);
  const course = new Date(`${c.date_course}T12:00:00Z`);
  const auj = new Date(`${jour(aujourdhui)}T12:00:00Z`);
  const lundi = new Date(auj.getTime() + ((7 - ((auj.getUTCDay() + 6) % 7)) % 7) * 86_400_000);
  const triees = [...durees].sort((x, y) => x - y);
  for (const m of triees) {
    const semaines = config.semaines_par_formule[`${c.format}-${m}`];
    if (!semaines) continue;
    const debut = new Date(course.getTime() - ((semaines - 1) * 7 + ((course.getUTCDay() + 6) % 7)) * 86_400_000);
    if (jour(debut) <= jour(lundi)) return m;
  }
  return triees[triees.length - 1];
}

// Les durées proposées à l'achat (audit de la programmation trail du 30/10/2026, T2 ; décision coach, « A ») : celles
// que la course admet, sans dépasser celle qui colle à sa date, le choix que le coaching fait déjà. Une formule plus
// longue serait rejointe plus loin en route, payée pour des semaines déjà passées : à 12 semaines d'un trail marathon,
// le 6 mois ne donnait plus que du spécifique. Sans date, toutes celles que la course admet.
export function dureesProposees(c: Champs, config: ConfigPlan, aujourdhui = new Date()): number[] {
  const possibles = dureesPossibles(c, config);
  const colle = dureeConseillee(c, config, possibles, aujourdhui);
  const proposees = colle === null ? possibles : possibles.filter((m) => m <= colle);
  return troisMoisEnPlus(c, config, aujourdhui) ? [3, ...proposees.filter((m) => m !== 3)] : proposees;
}

// LE 3 MOIS POUR UNE COURSE DE 4 À 8 H (S15, décision coach du 05/11/2026, « A » ; audit G-12, I8) : une course de 4 à
// 8 h ne se prépare pas en 3 mois, sauf quand le 4 mois serait rejoint au-delà de sa semaine 2, c'est-à-dire en semaine
// 3 ou plus tard : le 3 mois, qui commence alors entier ou presque, est AUSSI proposé, moins cher que le 4 mois rejoint en
// route. Seulement si le format a un 3 mois et que le temps visé admet le 4 mois.
// La semaine rejointe est celle de debutFormule, comme ce que l'acheteur lit sous chaque durée : ses séances partent du
// lendemain de l'achat (Paris), rejointe = floor((lendemain − lundi de la semaine 1) / 7) + 1. Semaine 3 ou plus : 14
// jours ou plus entre le lendemain de l'achat et le lundi de la semaine 1 du 4 mois. Le seuil de /v1/config,
// trois_mois_si_quatre_rejoint_au_dela_j (14), a ce sens depuis le moteur 8.453, la même formule (correction d'écart du
// 05/11/2026 au soir : avant, plus de 14 jours écoulés le jour de l'achat, soit un achat le dimanche refusé jusqu'au mardi).
export const SEMAINE_REJOINTE_TROIS_MOIS = 3;
export function troisMoisEnPlus(c: Champs, config: ConfigPlan, aujourdhui = new Date()): boolean {
  const h = lireTemps(c.temps_cible ?? '');
  const bornes = config.bandes_temps_cible?.bornes_h;
  if (h === null || !bornes || bornes.length < 3 || !(h >= bornes[1] && h < bornes[2])) return false;
  const possibles = dureesPossibles(c, config);
  if (!(config.durees_par_format[c.format] ?? []).includes(3) || possibles.includes(3) || !possibles.includes(4)) return false;
  return (debutFormule(c, config, 4, aujourdhui)?.rejointe ?? 0) >= SEMAINE_REJOINTE_TROIS_MOIS;
}

const JOUR_MS = 86_400_000;
const isoUtc = (d: Date) => d.toISOString().slice(0, 10);
const midiUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);
// Aujourd'hui à Paris, le jour qui compte pour l'acheteur.
const aujourdhuiIso = (aujourdhui: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(aujourdhui);

// LA DATE DE DÉBUT DE CHAQUE FORMULE (audit de l'app plan du 03/11/2026, C1 ; décision coach du 04/11/2026) : le lundi
// de sa semaine 1, et la semaine que l'acheteur rejoindrait. Ses séances partent du lendemain de son achat (C9) : une
// formule déjà commencée se rejoint à la semaine qui contient ce lendemain ; rejointe null : il la commence entière,
// premierJour compris. null sans date ni durée connue.
export type DebutFormule = { debut: string; premierJour: string; rejointe: number | null; semaines: number };
export function debutFormule(c: Champs, config: ConfigPlan, mois: number, aujourdhui = new Date()): DebutFormule | null {
  const semaines = config.semaines_par_formule[`${c.format}-${mois}`];
  if (!semaines || !/^\d{4}-\d{2}-\d{2}$/.test(c.date_course ?? '')) return null;
  const course = midiUtc(c.date_course);
  const debut = isoUtc(new Date(course.getTime() - ((semaines - 1) * 7 + ((course.getUTCDay() + 6) % 7)) * JOUR_MS));
  const demain = isoUtc(new Date(midiUtc(aujourdhuiIso(aujourdhui)).getTime() + JOUR_MS));
  if (debut >= demain) return { debut, premierJour: debut, rejointe: null, semaines };
  const rejointe = Math.floor((midiUtc(demain).getTime() - midiUtc(debut).getTime()) / (7 * JOUR_MS)) + 1;
  return { debut, premierJour: demain, rejointe: rejointe <= 1 ? null : rejointe, semaines };
}

// LA FORMULE COCHÉE D'OFFICE (décision coach du 04/11/2026, PL2 « A ») : la formule complète qui commence dans les
// 14 jours ; sinon, comme avant, celle qui colle à la date de la course. Avant, un débutant à 16 semaines d'un trail
// marathon se voyait cocher le 6 mois, déjà commencé, et le rejoignait en semaine 7, fondations sautées, pour 10 € de
// plus que le 4 mois qui commençait entier 13 jours plus tard.
export const JOURS_FORMULE_COMPLETE = 14;
export function dureeCocheeDOffice(c: Champs, config: ConfigPlan, durees: number[], aujourdhui = new Date()): number | null {
  const limite = isoUtc(new Date(midiUtc(aujourdhuiIso(aujourdhui)).getTime() + JOURS_FORMULE_COMPLETE * JOUR_MS));
  const complete = [...durees].sort((x, y) => y - x).find((m) => {
    const f = debutFormule(c, config, m, aujourdhui);
    return f !== null && f.rejointe === null && f.premierJour <= limite;
  });
  return complete ?? dureeConseillee(c, config, durees, aujourdhui);
}

// UNE COURSE TROP PROCHE (décision coach du 04/11/2026, PL3 « A ») : à moins de 4 semaines, il n'y a plus de
// préparation à vendre, comme pour une course passée. Ce n'est pas une porte de plus au sens de la règle du 01/11 : un
// service qu'on ne peut plus rendre. Le moteur refuse aussi (sa vérification et son checkout). Pas pour le coach.
export const JOURS_MIN_AVANT_COURSE = 28;
export const MESSAGE_COURSE_TROP_PROCHE = 'Ta course est dans moins de 4 semaines : c’est trop proche pour une préparation. '
  + 'Pour la courir au mieux, lis notre check-list avant course, gratuite, ou écris-nous pour un coaching individualisé.';
export function courseTropProche(c: Champs, aujourdhui = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date_course ?? '')) return false;
  const limite = isoUtc(new Date(midiUtc(aujourdhuiIso(aujourdhui)).getTime() + JOURS_MIN_AVANT_COURSE * JOUR_MS));
  return c.date_course < limite;
}

// coach : en coaching individualisé, tout format s'ouvre à tout niveau (décision coach du 23/10/2026, « lever la
// porte », comme le moteur : cts_intake.valider_champs).
export function formatOuvert(c: Champs, config: ConfigPlan, coach = false): boolean {
  return !!c.format && (coach || !c.niveau || (config.formats_par_niveau[c.niveau] ?? []).includes(c.format));
}

/**
 * Ce que le formulaire dit sous la distance : le format de la course, ou, s'il n'est pas ouvert
 * au niveau, la phrase du refus 0 de l'API (cts_intake.valider_champs), avant de la recevoir.
 */
export function noteFormat(c: Champs, config: ConfigPlan, coach = false): string | null {
  if (!c.format) return null;
  const nom = (code: string) => {
    const f = config.formats.find((x) => x.code === code);
    return f ? `${f.nom} (${f.bornes})` : code;
  };
  if (formatOuvert(c, config, coach)) return `Ta course est un ${nom(c.format)}.`;
  const ouverts = config.formats_par_niveau[c.niveau] ?? [];
  const debut = `Une course de ${c.distance_km.replace('.', ',')} km est un ${nom(c.format)} : ce format n’est pas ouvert à ton niveau. Choisis une course ${ouverts.map((f) => `de ${nom(f)}`).join(' ou ')}`;
  return coach ? `${debut}. ${HORS_DU_MOTEUR}` : `${debut}, ou oriente-toi vers un coaching individualisé.`;
}

/** Temps saisi -> heures, la même lecture que l'API (cts_intake.parse_temps_cible) ; null si illisible. */
// LA RÉCUPÉRATION APRÈS L'OBJECTIF (décisions coach du 21/10/2026 et du 01/11/2026, « A » : « trois semaines au maximum ») :
// deux jours sans séance dure ni sortie longue par heure de course, 3 au moins, 21 au plus ; 14 après un marathon sur
// route (décision 7 du marathon, 23/10/2026). Une récupération active : deux jours de repos, puis une EF courte un jour
// sur deux (le moteur, cts_semaine.semaine_de_recuperation).
// AU MOINS 14 JOURS DÈS 3 H DE COURSE (la jonction de deux objectifs, décision 5 du 07/11/2026, « A » ; moteur 8.457) :
// la descente rend le trail au moins aussi traumatisant qu'un marathon (Giandolini 2016) ; un trail de 4 h en donnait 8.
export const RECUPERATION_MARATHON_J = 14;
export const RECUPERATION_MAX_J = 21;
export const RECUPERATION_LONGUE_DES_H = 3;
export function joursRecuperation(heures: number, format?: string): number {
  if (format === 'R42') return RECUPERATION_MARATHON_J;
  const jours = Math.min(RECUPERATION_MAX_J, Math.max(3, Math.ceil(2 * heures)));
  return heures >= RECUPERATION_LONGUE_DES_H ? Math.max(RECUPERATION_MARATHON_J, jours) : jours;
}

export function lireTemps(brut: string): number | null {
  const s = brut.trim().toLowerCase();
  let m = s.match(/^([-+]?\d+)\s*(?:h|:)\s*(\d{1,2})\s*(?:min|mn)?$/);
  if (m) return Number(m[2]) < 60 ? Number(m[1]) + Number(m[2]) / 60 : null;
  m = s.match(/^([-+]?\d+(?:[.,]\d+)?)\s*(?:min|mn)$/);
  if (m) return Number(m[1].replace(',', '.')) / 60;
  m = s.match(/^([-+]?\d+(?:[.,]\d+)?)\s*h?$/);
  if (m) return Number(m[1].replace(',', '.'));
  return null;
}

/**
 * Plancher de la plus longue sortie (CONTRAT_API_CTS.md §4 et refus 6 quinquies ; audit du
 * questionnaire du 01/10/2026) : sous 45 min, la phrase du refus de l'API, dite dès la saisie
 * au lieu d'à la vérification. Seuil et phrase lus dans /v1/config ; la saisie se lit comme
 * l'API la lit ; rien tant qu'elle est vide ou illisible.
 */
export function alerteSortieLongue(c: Champs, config: ConfigPlan): string | null {
  const plancher = config.sortie_longue_min;
  const h = lireTemps(c.sortie_longue_actuelle);
  if (!plancher || h === null || !(h > 0)) return null;
  return h < plancher.h - 1e-9 ? plancher.message : null;
}

// La bande du temps cible n'est plus dite à la saisie (décision coach du 22/10/2026 : « une estimation est une estimation
// que l'athlète pense juste, il n'a pas besoin de savoir que c'est une frontière ») ; l'annonce « Ton plan sera construit
// pour une course de… » l'était déjà (07/10/2026).

/**
 * Plancher de séances par semaine (CONTRAT_API_CTS.md §5) : celui du format, et au moins
 * 4 dès le seuil de km-effort (50 depuis le 26/09/2026) — la difficulté réelle de la
 * course, pas son étiquette. Seuils lus dans /v1/config ; l'API reste seule juge (refus
 * 5 et 5 bis). La note annonce le plancher en direct, pour que l'athlète ne le découvre
 * pas dans un refus. Pas de motif (décision coach du 27/09/2026) :
 * aucun motif court n'est vrai pour tous les formats et tous les niveaux.
 * La note ne dit plus que ce qui s'applique (P5, décision coach du 07/11/2026, « A ») : le minimum de l'ultra, ou celui
 * d'une course de 100 km-effort et plus, puis le plafond du débutant ; rien pour le minimum de 3 seul. L'ultra passe
 * avant le km-effort (une course de plus de 100 km les a toujours tous les deux). Un autre format au minimum propre,
 * qui n'existe pas aujourd'hui, n'aurait pas de note plutôt qu'une note fausse.
 */
export function plancherSeances(c: Champs, config: ConfigPlan): { min: number; max: number; note: string } {
  const parFormat = config.freq_min_par_format[c.format] ?? 0;
  const seuil = config.freq_min_km_effort_seuil;
  const auDela = config.freq_min_au_dela_du_seuil;
  const km = parseFloat(c.distance_km.replace(',', '.'));
  const dp = parseFloat(c.dplus_m.replace(',', '.')) || 0;
  const ke = km > 0 ? km + dp / 100 : null;
  const parDifficulte = ke !== null && ke >= seuil ? auDela : 0;
  const min = Math.max(parFormat, parDifficulte, 3);
  // Plafond du niveau (second audit du 28/09/2026, D4) : le débutant, 4 séances au plus.
  // Lu dans /v1/config ; l'API reste seule juge (refus 5 ter).
  const max = config.freq_max_par_niveau?.[c.niveau] ?? 7;
  const parties = [
    min <= 3 ? ''
      : parFormat === min ? (c.format === 'UT' ? `Au moins ${min} séances par semaine pour un ultra.` : '')
        : `Au moins ${min} séances par semaine pour une course de cette taille (${seuil} km-effort et plus).`,
    // Sans « Pas plus que de jours cochés. » ni le coût de la 4e séance (décision coach du
    // 07/10/2026 : « ça n'apporte rien ») ; le plafond du débutant reste, il évite un refus.
    c.niveau === 'debutant' && max < 7 ? `${max} au plus en débutant.` : '',
  ];
  return { min, max, note: parties.filter(Boolean).join(' ') };
}

/** L'intake envoyé à l'API : tous les champs sauf la blessure et le cœur, qui restent sur la page. */
export function intakePourApi(c: Champs) {
  const { blessure, coeur, ...reste } = c;
  void blessure;
  void coeur;
  return reste;
}
