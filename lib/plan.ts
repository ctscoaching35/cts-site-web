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
  formats: { code: string; nom: string; bornes: string }[];
  formats_par_distance?: [string, number | null, boolean][];
  durees_par_format: Record<string, number[]>;
  freq_min_par_format: Record<string, number>;
  freq_min_km_effort_seuil: number;
  freq_min_au_dela_du_seuil: number;
  freq_max_par_niveau: Record<string, number>;
  temps_max_par_format: Record<string, number>;
  reperes_km_effort_h: Record<string, [number, number, number]>;
  bandes_temps_cible?: { bornes_h: number[]; libelles: string[]; phrases_bornes: string[]; marge_min: number };
  sortie_longue_min?: { h: number; message: string };
  semaines_par_formule: Record<string, number>;
  jours: string[];
  prix_eur_par_mois: Record<string, number>;
  mode_paiement: 'test' | 'stripe';
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
  // Section 7 : la blessure ne quitte jamais le navigateur (avertissement seulement).
  blessure: string;
  // Section 2 : l'arrêt récent part avec le plan, comme la charge actuelle (second audit
  // du moteur, D16) : il fait démarrer le plan par deux semaines sans séance dure.
  coupure: string;
};

export const champsVides: Champs = {
  nom: '', email: '', niveau: '', volume_hebdo_actuel: '', sortie_longue_actuelle: '',
  format: '', duree_mois: '', course_nom: '', date_course: '',
  distance_km: '', dplus_m: '', dmoins_m: '', temps_cible: '', terrain: '',
  jours_disponibles: [], jour_sl: '', freq_hebdo: '', blessure: '', coupure: '',
};

export const textes = {
  niveau: {
    aide:
      'C’est la question qui calibre tout le reste : le volume de base, la longueur de tes sorties longues, la dose de travail dur, et les formats de course qui te sont ouverts. Lis les trois descriptions et coche celle dans laquelle tu te reconnais — pas celle que tu aimerais atteindre.',
    options: [
      {
        valeur: 'debutant',
        titre: 'Débutant',
        description:
          'Je cours depuis moins de deux ans. Je n’ai jamais suivi de plan structuré. Le fractionné ne fait pas partie de mes habitudes. Au-delà d’1h30 de course, je commence à subir.',
        formats: 'Format ouvert : Trail Court.',
      },
      {
        valeur: 'intermediaire',
        titre: 'Intermédiaire',
        description:
          'Je cours régulièrement depuis deux ans ou plus. J’ai déjà suivi un plan d’entraînement. Je pratique le fractionné. Je tiens 2h30 de course sans difficulté majeure.',
        formats: 'Formats ouverts : Trail Court, Trail Marathon.',
      },
      {
        valeur: 'confirme',
        titre: 'Confirmé',
        description:
          'Je m’entraîne de façon structurée depuis plusieurs années, plusieurs fois par semaine. J’ai déjà terminé des courses longues. Les sorties de 4h font partie de ma pratique.',
        formats: 'Formats ouverts : tous, jusqu’à l’ultra.',
      },
    ],
    note:
      'Te surestimer ne débloque pas un meilleur plan : ça produit un plan plus dur que ce que tu peux encaisser, avec le risque de blessure qui va avec.',
  },
  // Charge actuelle (24/09/2026). Aucun pourcentage dans l'aide, décision du coach du
  // 26/09/2026 : l'étude dit 10 %, le plan monte par marches de 15 % au plus, et
  // l'athlète lirait les deux.
  charge: {
    titre: 'Ce que tu cours en ce moment',
    aide:
      'Ta plus longue sortie décide d’où ton plan démarre. C’est la seule chose qui distingue deux coureurs du même niveau : l’un tient déjà 2h30, l’autre plafonne à 1h, et ils n’ont pas à recevoir la même première semaine. Le risque de blessure monte quand une sortie dépasse nettement la plus longue des 4 dernières semaines — c’est le résultat le mieux établi de tout l’entraînement, et il ne sert à rien si on ne sait pas d’où tu pars.',
    volume: 'Volume de course par semaine, en ce moment',
    sortieLongue: 'Ta plus longue sortie des 4 dernières semaines',
    note: 'En durée de course, pas en kilomètres. Si tu n’as pas couru du tout ces 4 semaines, mets ta dernière sortie régulière.',
    coupure: 'As-tu arrêté de courir plus de 4 semaines au cours des 2 derniers mois ?',
  },
  gpx:
    'Le profil réel du parcours (répartition des pentes) affine tout le plan. Sans trace, le plan est construit sur le D+/D− déclaré ci-dessus, et le PDF n’affiche pas de profil.',
  tempsCible: 'Même une estimation large vaut mieux que rien — c’est ce qui calibre l’intensité de tout le plan.',
  terrain: {
    aide:
      'Réponds sur la plus longue côte que tu peux vraiment enchaîner près de chez toi, pas sur le paysage. C’est cette longueur qui décide si ton travail au seuil se fera en côte ou sur terrain roulant.',
    options: [
      { valeur: 'vallonne', titre: 'Vallonné', description: 'Côtes courtes, jusqu’à 1min30 de montée.' },
      { valeur: 'intermediaire', titre: 'Intermédiaire', description: 'Côtes de 2 à 5 min de montée.' },
      { valeur: 'pentu', titre: 'Pentu', description: 'Côtes de 5 à 10 min de montée.' },
      { valeur: 'tres_pentu', titre: 'Très pentu', description: 'Côtes de plus de 10 min de montée.' },
    ],
  },
  disponibilite: {
    aide:
      'Ton plan se cale sur ta semaine : tes séances sur tes jours disponibles, ta sortie longue sur le jour que tu choisis, et jamais deux séances dures d’affilée.',
  },
  sante: {
    blessure: 'Une blessure ou une douleur t’empêche-t-elle de courir normalement en ce moment ?',
  },
};

/** Avertissements non bloquants (CONTRAT_API_CTS.md §5 bis), confirmés avant de continuer. */
export function avertissements(c: Champs, config: ConfigPlan, aujourdhui = new Date()): string[] {
  const out: string[] = [];
  if (c.blessure === 'oui') {
    out.push(
      'Ce plan est conçu pour un coureur sans blessure en cours. Avant de le commencer, fais le point avec un professionnel de santé (médecin, kinésithérapeute) : une douleur qui empêche de courir normalement ne se règle pas par l’entraînement.'
    );
  }
  if (c.coupure === 'oui') {
    out.push(
      c.niveau === 'debutant'
        ? 'Après plus de 4 semaines sans courir, le plan débutant reste le bon choix : il démarre au plus bas. Écoute tes sensations les premières semaines, et allège si une douleur apparaît.'
        : 'Après plus de 4 semaines sans courir, tes deux premières semaines de plan se font sans séance dure, puis la vitesse revient par un Seuil 2 au plus bas : tes muscles et tes tendons se réhabituent avant la vitesse. Écoute tes sensations, et allège si une douleur apparaît.'
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
        `Ta course est dans ${semaines(dans)} : ton plan de ${c.duree_mois} mois a commencé le ${lundiS1.toLocaleDateString('fr-FR')}, il y a ${semaines(ilYa)}. Tu le reçois en entier et tu le rejoins cette semaine : ta sortie longue repart de ta plus longue sortie récente, sans jamais la dépasser de plus d’une petite marche.`
      );
    }
  }
  return out;
}

/** Repères de chrono, une aide jamais un contrôle : km-effort / vitesse, arrondi à 5 min. */
export function reperesChrono(c: Champs, config: ConfigPlan): string | null {
  const vitesses = config.reperes_km_effort_h[c.format];
  const km = parseFloat(c.distance_km.replace(',', '.'));
  const dp = parseFloat(c.dplus_m.replace(',', '.')) || 0;
  if (!vitesses || !(km > 0)) return null;
  const ke = km + dp / 100;
  const fmt = (h: number) => {
    const t = Math.round(h * 12) * 5;
    return `${Math.floor(t / 60)}h${String(t % 60).padStart(2, '0')}`;
  };
  // Un repère au-delà du plafond du format le dit, au lieu de proposer un chrono que le
  // formulaire refusera ensuite (audit du 27/09/2026, C21 ; décision coach du 28/09/2026 :
  // « dire la vérité au bon endroit »). UTMB : allure prudente 54h10, plafond 45h.
  const plafond = config.temps_max_par_format[c.format];
  const heures = vitesses.map((v) => ke / v);
  const depasse = plafond !== undefined && heures.some((h) => h > plafond);
  const [rapide, moyenne, prudente] = heures.map((h) =>
    plafond !== undefined && h > plafond ? `plus de ${plafond}h` : fmt(h)
  );
  const fin = depasse
    ? ` Au-delà de ${plafond}h, c’est hors du plafond de ce plan : un coaching individualisé est plus adapté.`
    : ' Choisis d’après ta propre expérience de course.';
  return `Ta course fait ${Math.round(ke)} km-effort (km + D+/100). Repères de chrono sur ce format : allure rapide ${rapide}, allure moyenne ${moyenne}, allure prudente ${prudente}.${fin}`;
}

/**
 * Format de la course, déduit de la distance (CONTRAT_API_CTS.md §4 ; audit du questionnaire du
 * 01/10/2026, F4) : la question du format n'avait qu'une réponse possible. Bornes lues dans
 * /v1/config (formats_par_distance : code, borne haute en km ou null, borne incluse) ; '' tant
 * que la distance n'est pas lisible ou que l'API ne fournit pas les bornes.
 */
export function formatDepuisDistance(distance: string, config: ConfigPlan): string {
  const km = parseFloat(distance.replace(',', '.'));
  if (!(km > 0) || !config.formats_par_distance) return '';
  for (const [code, borne, incluse] of config.formats_par_distance) {
    if (borne === null || km < borne || (incluse && km === borne)) return code;
  }
  return '';
}

/** Le format déduit est-il ouvert au niveau déclaré ? Sans niveau, oui (l'API reste juge). */
export function formatOuvert(c: Champs, config: ConfigPlan): boolean {
  return !!c.format && (!c.niveau || (config.formats_par_niveau[c.niveau] ?? []).includes(c.format));
}

/**
 * Ce que le formulaire dit sous la distance : le format de la course, ou, s'il n'est pas ouvert
 * au niveau, la phrase du refus 0 de l'API (cts_intake.valider_champs), avant de la recevoir.
 */
export function noteFormat(c: Champs, config: ConfigPlan): string | null {
  if (!c.format) return null;
  const nom = (code: string) => {
    const f = config.formats.find((x) => x.code === code);
    return f ? `${f.nom} (${f.bornes})` : code;
  };
  if (formatOuvert(c, config)) return `Ta course est un ${nom(c.format)}.`;
  const ouverts = config.formats_par_niveau[c.niveau] ?? [];
  return `Une course de ${c.distance_km.replace('.', ',')} km est un ${nom(c.format)} : ce format n’est pas ouvert à ton niveau. Choisis une course ${ouverts.map((f) => `de ${nom(f)}`).join(' ou ')}, ou oriente-toi vers un coaching individualisé.`;
}

/** Temps saisi -> heures, la même lecture que l'API (cts_intake.parse_temps_cible) ; null si illisible. */
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

/**
 * Bande du temps cible (CONTRAT_API_CTS.md §4 ; audit du questionnaire du 01/10/2026, F1) :
 * pour quelle durée de course le plan sera construit et, à moins de `marge_min` minutes
 * d'une borne, ce qui change de l'autre côté. Bornes, noms et phrases lus dans /v1/config.
 */
export function bandeTempsCible(c: Champs, config: ConfigPlan): { annonce: string; alerte: string | null } | null {
  const bandes = config.bandes_temps_cible;
  const h = lireTemps(c.temps_cible);
  if (!bandes || h === null || !(h > 0)) return null;
  const i = bandes.bornes_h.filter((b) => h >= b).length;
  const j = bandes.bornes_h.findIndex((b) => Math.abs(h - b) * 60 < bandes.marge_min);
  return {
    annonce: `Ton plan sera construit pour une course de ${bandes.libelles[i]}.`,
    alerte: j < 0 ? null
      : `Tu es à moins de ${bandes.marge_min} min de ${bandes.bornes_h[j]}h, une frontière du plan. ${bandes.phrases_bornes[j]} Mets le temps que tu crois le plus probable.`,
  };
}

/**
 * Plancher de séances par semaine (CONTRAT_API_CTS.md §5) : celui du format, et au moins
 * 4 dès le seuil de km-effort (50 depuis le 26/09/2026) — la difficulté réelle de la
 * course, pas son étiquette. Seuils lus dans /v1/config ; l'API reste seule juge (refus
 * 5 et 5 bis). La note annonce le plancher en direct, pour que l'athlète ne le découvre
 * pas dans un refus, et dit son coût mesuré. Pas de motif (décision coach du 27/09/2026) :
 * aucun motif court n'est vrai pour tous les formats et tous les niveaux.
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
  const bornes = 'Pas plus que de jours cochés.'
    + (max < 7 ? ` En débutant, ${max} séances par semaine au plus.` : '');
  if (!c.format) return { min, max, note: bornes };
  if (ke !== null && parDifficulte >= parFormat && parDifficulte > 0) {
    return {
      min,
      max,
      note: `Ta course vaut ${Math.round(ke)} km-effort (distance + D+/100). À partir de ${seuil}, le plan demande au moins ${min} séances par semaine. La 4e séance ajoute environ une heure par semaine. ${bornes}`,
    };
  }
  const passage = parFormat < auDela
    ? ` À partir de ${seuil} km-effort (distance + D+/100), le minimum passe à ${auDela}.`
    : '';
  return { min, max, note: `Minimum ${min} séances par semaine sur ce format.${passage} ${bornes}` };
}

/** L'intake envoyé à l'API : tous les champs sauf la blessure, qui reste sur la page. */
export function intakePourApi(c: Champs) {
  const { blessure, ...reste } = c;
  void blessure;
  return reste;
}
