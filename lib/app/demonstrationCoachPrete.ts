// Aucun réseau, aucune base, aucun fichier : en développement seulement, lu par lib/app/demonstrationCoachDonnees.ts et par ses essais (scripts/test-demonstration-prete.mjs).
/**
 * UNE COACHÉE FICTIVE PRÊTE À PARTIR, dans la démonstration de l'espace coach (25/11/2026), pour que « Lancer sa préparation » s'y voie sous la v1 : sa carte est complète (côte, tapis, les deux
 * critères, trace, semaine), son compte Nolio est associé, son accord reçu, et son objectif n'a pas démarré. Elle est posée ici et non dans coach.json, que scripts/demonstration-coach.py écrit avec le moteur : son objectif
 * reprend celui de la coachée fictive pas encore démarrée (sa course, sa trame, ses semaines affichées), sans aucune séance ni semaine écrite.
 */
const MODELE = 'demo-manon';
export const ID_PRETE = 'demo-chloe';
export const PLAN_PRET = 'demo-plan-chloe';
const NOM = 'Chloé Garnier';

// Ce qui complète sa carte : sa fiche le garde, ses réponses le portent.
const CARTE = { cote_min: '12', tapis: 'non', critere_intensite: 'parfois', critere_denivele: 'regulier' };
// Ses points forts et faibles en trail, sur sa fiche seulement : ils ne partent pas avec les réponses d'un objectif.
const POINTS = { trail_montees: 'faible', trail_descentes: 'fort' };
// Le profil d'une trace inventée, à la forme que `POST /v1/trace` rend (lib/app/gpxV9.ts).
const TRACE = { montees: [{ dplus_m: 420 }, { dplus_m: 310 }, { dplus_m: 260 }], dplus_par_pente: { vallonne: 480, cote_moderee: 720, cote_raide: 418 } };

type Ligne = Record<string, unknown>;
type DonneesLues = {
  athletes: { id: string; champs: Ligne }[];
  plans: Ligne[];
  nolio: Record<string, { prevues: Ligne[]; reelles: Ligne[]; hooper: Ligne[] }>;
};

// Les données de la démonstration avec elle en plus ; la même référence si elle y est déjà, ou si son modèle n'y est pas.
export function avecLaCoacheePrete<D extends DonneesLues>(d: D): D {
  const modele = d.athletes.find((a) => a.id === MODELE);
  const plan = d.plans.find((p) => p.athlete_id === MODELE);
  if (!modele || !plan || d.athletes.some((a) => a.id === ID_PRETE)) return d;
  const parametres = plan.parametres as Ligne & { champs: Ligne };
  const donnees = plan.donnees as Ligne | null;
  const champs = { ...modele.champs, ...CARTE, ...POINTS };
  const athlete = {
    ...modele, id: ID_PRETE, nom: NOM, scenario: 'carte complète, prête à lancer', pas_demarre: true, sans_accord: false, app: false,
    d_prime: 180, reperes: [148, 3.7, 169, 2.9], champs,
  };
  const sonPlan = {
    ...plan, id: PLAN_PRET, athlete_id: ID_PRETE, demarre_le: null, depart_prevu: null,
    donnees: donnees ? { ...donnees, athlete: { nom: NOM } } : donnees,
    intake: { ...(plan.intake as Ligne), ...CARTE },
    parametres: { ...parametres, champs: { ...parametres.champs, ...CARTE, gpx: TRACE }, _demonstration: PLAN_PRET },
  };
  return { ...d, athletes: [...d.athletes, athlete], plans: [...d.plans, sonPlan], nolio: { ...d.nolio, [ID_PRETE]: { prevues: [], reelles: [], hooper: [] } } };
}

// Le profil d'une fiche de la démonstration, tiré de ses réponses : la côte, le tapis, les critères et les points forts et faibles quand elle les a.
export function profilDeDemonstration(c: Ligne): Ligne {
  return { niveau: c.niveau, terrain: c.terrain, jours_disponibles: c.jours_disponibles, jour_sl: c.jour_sl, freq_hebdo: c.freq_hebdo,
    ...Object.fromEntries(Object.keys({ ...CARTE, ...POINTS }).filter((k) => c[k] !== undefined).map((k) => [k, c[k]])) };
}
