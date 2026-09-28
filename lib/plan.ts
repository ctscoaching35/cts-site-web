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
  durees_par_format: Record<string, number[]>;
  freq_min_par_format: Record<string, number>;
  freq_min_km_effort_seuil: number;
  freq_min_au_dela_du_seuil: number;
  temps_max_par_format: Record<string, number>;
  reperes_km_effort_h: Record<string, [number, number, number]>;
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
  ambition: string;
  terrain: string;
  jours_disponibles: string[];
  jour_sl: string;
  freq_hebdo: string;
  // Section 7 : ne quittent jamais le navigateur (avertissements seulement).
  blessure: string;
  coupure: string;
};

export const champsVides: Champs = {
  nom: '', email: '', niveau: '', volume_hebdo_actuel: '', sortie_longue_actuelle: '',
  format: '', duree_mois: '', course_nom: '', date_course: '',
  distance_km: '', dplus_m: '', dmoins_m: '', temps_cible: '', ambition: '', terrain: '',
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
  },
  gpx:
    'Le profil réel du parcours (répartition des pentes) affine tout le plan. Sans trace, le plan est construit sur le D+/D− déclaré ci-dessus, et le PDF n’affiche pas de profil.',
  tempsCible: 'Même une estimation large vaut mieux que rien — c’est ce qui calibre l’intensité de tout le plan.',
  ambition: {
    intro:
      'Le plafond de ton plan ne bouge pas : c’est ton niveau qui le fixe, et il est le même pour les trois réponses. Ce que tu choisis ici, c’est la vitesse à laquelle tu montes vers ce plafond.',
    options: [
      {
        valeur: 'decouverte',
        titre: 'La découvrir et la finir',
        description: 'Arriver au départ en forme, franchir la ligne. La montée en intensité est la plus progressive des trois.',
      },
      {
        valeur: 'progresser',
        titre: 'Progresser',
        description: 'Franchir un cap sur ce format, sans en faire une obsession de chrono. L’équilibre par défaut.',
      },
      {
        valeur: 'performer',
        titre: 'Performer',
        description:
          'Viser le meilleur jour J possible. Tu montes plus vite et tu atteins ta dose maximale plus tôt, sans jamais dépasser le plafond de ton niveau.',
      },
    ],
  },
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
  sante: {
    blessure: 'Une blessure ou une douleur t’empêche-t-elle de courir normalement en ce moment ?',
    coupure: 'As-tu arrêté de courir plus de 4 semaines au cours des 2 derniers mois ?',
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
        : 'Après plus de 4 semaines sans courir, reprends avec le niveau en dessous de celui que tu as coché, si ton format y reste ouvert : le plan démarre plus bas, et tes muscles et tendons en ont besoin.'
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
 * Plancher de séances par semaine (CONTRAT_API_CTS.md §5) : celui du format, et au moins
 * 4 dès le seuil de km-effort (50 depuis le 26/09/2026) — la difficulté réelle de la
 * course, pas son étiquette. Seuils lus dans /v1/config ; l'API reste seule juge (refus
 * 5 et 5 bis). La note annonce le plancher en direct, pour que l'athlète ne le découvre
 * pas dans un refus, et dit son coût mesuré. Pas de motif (décision coach du 27/09/2026) :
 * aucun motif court n'est vrai pour tous les formats et tous les niveaux.
 */
export function plancherSeances(c: Champs, config: ConfigPlan): { min: number; note: string } {
  const parFormat = config.freq_min_par_format[c.format] ?? 0;
  const seuil = config.freq_min_km_effort_seuil;
  const auDela = config.freq_min_au_dela_du_seuil;
  const km = parseFloat(c.distance_km.replace(',', '.'));
  const dp = parseFloat(c.dplus_m.replace(',', '.')) || 0;
  const ke = km > 0 ? km + dp / 100 : null;
  const parDifficulte = ke !== null && ke >= seuil ? auDela : 0;
  const min = Math.max(parFormat, parDifficulte, 3);
  const bornes = 'Pas plus que de jours cochés.';
  if (!c.format) return { min, note: bornes };
  if (ke !== null && parDifficulte >= parFormat && parDifficulte > 0) {
    return {
      min,
      note: `Ta course vaut ${Math.round(ke)} km-effort (distance + D+/100). À partir de ${seuil}, le plan demande au moins ${min} séances par semaine. La 4e séance ajoute environ une heure par semaine. ${bornes}`,
    };
  }
  const passage = parFormat < auDela
    ? ` À partir de ${seuil} km-effort (distance + D+/100), le minimum passe à ${auDela}.`
    : '';
  return { min, note: `Minimum ${min} séances par semaine sur ce format.${passage} ${bornes}` };
}

/** L'intake envoyé à l'API : tous les champs sauf la santé. */
export function intakePourApi(c: Champs) {
  const { blessure, coupure, ...reste } = c;
  void blessure;
  void coupure;
  return reste;
}
