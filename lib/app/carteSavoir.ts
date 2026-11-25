// Aucun réseau, aucune base : le calcul de la carte « Ce que j’ai besoin de savoir » (scripts/test-parcours-moment2.mjs). Lu dans le navigateur (components/app/CarteSavoir.tsx) comme sur le serveur (lib/app/actionsCoaching.ts).
/**
 * « CE QUE J’AI BESOIN DE SAVOIR », LA CARTE UNIQUE DE LA PAGE D’UN ATHLÈTE, SOUS LA 9.x SEULEMENT (décision 241 du coach, 25/11/2026 ; « Parcours du coach dans l’app — proposition, 25-11 », moment 2) : un seul formulaire, un seul
 * « Enregistrer ». Le coureur (sa côte, son tapis, ses deux critères, son dernier test, ses repères de fréquence cardiaque) va sur sa fiche ; son objectif (date, distance, dénivelé, chrono, trace, jours, sortie longue, séances) repasse
 * par « Modifier l’objectif » (app/app/coach/athletes/route.ts). Ses jours, sa sortie longue et son nombre de séances sont ceux de l’objectif, recopiés sur sa fiche. Un champ laissé vide n’efface rien.
 * Les textes sont lus par le coach seul.
 */
import { lireCote, terrainDeLaCote, TEXTES_COTE } from '@/lib/cote';
import { estReponseCritere } from '@/lib/criteres';
import { POINTS_TRAIL, pointsSaisis, pointsTrail, type ValeursTrail } from './pointsTrail';
import { champsVides, FORMATS_ROUTE, intakePourApi, type Champs } from '@/lib/plan';

export const TEXTES_CARTE = {
  titre: 'Ce que j’ai besoin de savoir',
  // La carte complète se replie (choix du coach du 25/11/2026 : la page d’un athlète faisait plusieurs écrans).
  voirEtModifier: 'Voir et modifier',
  leCoureur: 'Le coureur',
  sonObjectif: 'Son objectif',
  tapis: 'Accès à un tapis de course qui monte',
  oui: 'Oui',
  non: 'Non',
  test: 'Son dernier test de vitesse critique',
  // Une vitesse critique connue d'un test passé (241, retouche) : son allure, sans les deux efforts.
  vcConnue: 'Ou son allure à la vitesse critique, si tu la connais d’un test passé (min/km)',
  aTester: 'à tester',
  dateDuTest: 'Date du test',
  effortCourt: 'Effort court (3 min)',
  effortLong: 'Effort long (12 min)',
  duree: 'Durée',
  distanceDeLEffort: 'Distance',
  autresDurees: 'D’autres durées marchent aussi, de 2 à 15 minutes, au moins 5 minutes d’écart entre les deux.',
  reperes: 'Ses repères de fréquence cardiaque',
  dateDeLaCourse: 'Date de la course',
  km: 'Distance (km)',
  denivele: 'Dénivelé (m)',
  chrono: 'Chrono visé',
  trace: 'Trace GPX',
  nouvelleTrace: 'Nouvelle trace GPX',
  traceGardee: 'Sans nouvelle trace, celle d’avant est gardée.',
  jours: 'Jours disponibles',
  sortieLongue: 'Sortie longue le',
  seances: 'Nombre de séances par semaine',
  choisis: 'Choisis',
  enRoute: 'Il est déjà en route : sa date et sa distance ne changent plus.',
  programme: 'Son départ est programmé : changer son objectif l’annule.',
  departAnnule: 'Son départ programmé est annulé : lance sa préparation à nouveau.',
  modifierObjectif: 'Modifier l’objectif',
  enregistrer: 'Enregistrer',
  enregistrement: 'Enregistrement…',
  enregistre: 'C’est enregistré.',
  leResteEnregistre: 'Le reste est enregistré.',
  // Les phrases de ce qui ne va pas, reprises des formulaires d’avant.
  distanceIllisible: 'Je ne comprends pas la distance ou le dénivelé.',
  joursEtSortieLongue: 'Coche ses jours disponibles, dont celui de sa sortie longue.',
  tropDeSeances: 'Le nombre de séances doit tenir dans ses jours disponibles.',
  serviceMuet: 'Le service ne répond pas. Vérifie ta connexion et réessaie.',
  erreur: 'Une erreur est survenue. Réessaie dans quelques minutes.',
} as const;

export const JOURS_DE_LA_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export type ValeursDeLaCarte = ValeursTrail & {
  cote_min: string; tapis: string; critere_intensite: string; critere_denivele: string;
  fc_seuil1: string; fc_seuil2: string; vc_allure: string;
  date_course: string; distance_km: string; dplus_m: string; temps_cible: string; jours_disponibles: string[]; jour_sl: string; freq_hebdo: string;
};
export const CLES_DU_COUREUR = ['cote_min', 'tapis', 'critere_intensite', 'critere_denivele', 'trail_montees', 'trail_descentes', 'trail_technique', 'trail_fin'] as const;
export const CLES_DES_REPERES = ['fc_seuil1', 'fc_seuil2', 'vc_allure'] as const;
export const CLES_DE_L_OBJECTIF = ['date_course', 'distance_km', 'dplus_m', 'temps_cible', 'jours_disponibles', 'jour_sl', 'freq_hebdo'] as const;

export type EffortsDuTest = { le: string; duree1: string; distance1: string; duree2: string; distance2: string };

type Reponses = Record<string, unknown> | null | undefined;
export type ReponsesDeLObjectif = Record<string, string | string[]>;

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const nombre = (v: unknown): number | null => {
  const t = texte(v).replace(/\s/g, '').replace(',', '.');
  const n = Number(t);
  return t && Number.isFinite(n) ? n : null;
};
const estUneRoute = (format: unknown): boolean => FORMATS_ROUTE.some((f) => f.code === format);

// ─── Les réponses de l’objectif, reprises pour « Modifier » ──────────────────────────────────────────────────────────

// Ce que le site a posé lui-même dans les réponses d’un plan (son entrée, sa course d’avant, ce qu’il courait au départ, le profil de sa trace) ne repart pas comme une réponse du questionnaire ; la santé non plus.
const CLES_DU_SITE = ['entree', 'course_precedente', 'lu', 'gpx', 'blessure', 'coeur'];

// Les réponses de l’achat de l’objectif, celles qu’il a depuis (`parametres.champs`) l’emportant : du texte ou des listes de textes seulement.
export function reponsesReprises(intake: Reponses, champs: Reponses): ReponsesDeLObjectif {
  return Object.fromEntries(Object.entries({ ...(intake ?? {}), ...(champs ?? {}) })
    .filter(([k, v]) => !CLES_DU_SITE.includes(k) && v !== null && v !== undefined && (Array.isArray(v) ? v.every((x) => typeof x !== 'object') : typeof v !== 'object'))
    .map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : String(v)]));
}

// Ce que la carte montre d’emblée. La côte, le tapis et les critères se lisent comme le moteur les lit (sa fiche d’abord, sinon l’objectif) ; ses jours, sa sortie longue et ses séances sont ceux de l’objectif.
export function valeursDeLaCarte({ fiche, intake, champs, courseDate, fc1, fc2, vcAllure = null }: {
  fiche: Reponses; intake: Reponses; champs: Reponses; courseDate: string; fc1: number | null | undefined; fc2: number | null | undefined; vcAllure?: string | null;
}): ValeursDeLaCarte {
  const base = reponsesReprises(intake, champs);
  const criteres = (typeof champs?.criteres === 'object' && champs.criteres !== null ? champs.criteres : {}) as Record<string, unknown>;
  const critere = (flat: 'critere_intensite' | 'critere_denivele', court: 'intensite' | 'mecanique') =>
    String([fiche?.[flat], criteres[court], champs?.[flat]].find(estReponseCritere) ?? '');
  const cote = [fiche?.cote_min, champs?.cote_min].map(lireCote).find((c) => c !== null);
  return {
    cote_min: cote === undefined ? '' : String(cote),
    tapis: String([fiche?.tapis, champs?.tapis].find((v) => v === 'oui' || v === 'non') ?? ''),
    critere_intensite: critere('critere_intensite', 'intensite'),
    critere_denivele: critere('critere_denivele', 'mecanique'),
    ...pointsTrail(fiche as Record<string, unknown> | null | undefined),
    fc_seuil1: fc1 ? String(fc1) : '',
    fc_seuil2: fc2 ? String(fc2) : '',
    vc_allure: vcAllure ?? '',
    date_course: texte(base.date_course) || courseDate,
    distance_km: texte(base.distance_km),
    dplus_m: texte(base.dplus_m),
    temps_cible: texte(base.temps_cible),
    jours_disponibles: liste(champs?.jours_disponibles),
    jour_sl: texte(champs?.jour_sl),
    freq_hebdo: texte(champs?.freq_hebdo),
  };
}

// Ce qui s’enregistre : la saisie du coach par-dessus ce qui était montré ; un champ vidé garde ce qu’il avait (rien ne s’efface).
export function completer(avant: ValeursDeLaCarte, saisie: Partial<ValeursDeLaCarte>): ValeursDeLaCarte {
  const sortie = { ...avant };
  for (const [cle, v] of Object.entries(saisie) as [keyof ValeursDeLaCarte, string | string[]][]) {
    if (Array.isArray(v) ? v.length > 0 : v.trim() !== '') Object.assign(sortie, { [cle]: Array.isArray(v) ? v : v.trim() });
  }
  return sortie;
}

// ─── Ce qui ne va pas, avant d’enregistrer ───────────────────────────────────────────────────────────────────────────

export function erreurDeSemaine(jours: string[], jourSl: string, freq: string): string | null {
  if (jourSl && jours.length && !jours.includes(jourSl)) return TEXTES_CARTE.joursEtSortieLongue;
  const n = nombre(freq);
  if (freq && (n === null || !Number.isInteger(n) || n < 1 || n > Math.min(7, jours.length || 7))) return TEXTES_CARTE.tropDeSeances;
  return null;
}

// `objectif` : null quand la carte n’en a pas à modifier (aucun à venir, ou envoyé en entier).
export function erreurDeLaCarte(v: ValeursDeLaCarte, objectif: { route: boolean } | null): string | null {
  if (v.cote_min && lireCote(v.cote_min) === null) return TEXTES_COTE.illisibleSa;
  if (!objectif) return null;
  if (!objectif.route) {
    const km = nombre(v.distance_km);
    const dplus = nombre(v.dplus_m);
    if ((v.distance_km && !(km !== null && km > 0)) || (v.dplus_m && !(dplus !== null && dplus >= 0))) return TEXTES_CARTE.distanceIllisible;
  }
  return erreurDeSemaine(v.jours_disponibles, v.jour_sl, v.freq_hebdo);
}

// ─── Son objectif : a-t-il changé, et ses réponses pour « Modifier » ─────────────────────────────────────────────────

// « 12,5 » et « 12.5 » sont la même réponse ; un texte qui ne se lit pas est un changement, pour qu'il soit refusé plutôt qu'oublié.
const memeNombre = (a: string, b: string) => a === b || (nombre(a) !== null && nombre(a) === nombre(b));
const memesJours = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();

export const distanceChangee = (avant: ValeursDeLaCarte, apres: ValeursDeLaCarte): boolean => !memeNombre(avant.distance_km, apres.distance_km);

// Une trace donnée à elle seule suffit aussi à le renvoyer (le composant le sait : c’est un fichier).
export function objectifChange(avant: ValeursDeLaCarte, apres: ValeursDeLaCarte): boolean {
  return avant.date_course !== apres.date_course || distanceChangee(avant, apres) || !memeNombre(avant.dplus_m, apres.dplus_m) || avant.temps_cible !== apres.temps_cible
    || !memesJours(avant.jours_disponibles, apres.jours_disponibles) || avant.jour_sl !== apres.jour_sl || !memeNombre(avant.freq_hebdo, apres.freq_hebdo);
}

/**
 * Les réponses qui repartent avec « Modifier l’objectif », comme le questionnaire les envoie (components/plan/Questionnaire.tsx) : celles de l’objectif, les nouvelles par-dessus. Ce qui n’a pas changé reste tel quel, au
 * caractère près : un objectif en route refuse tout changement de date, de distance ou de format. `format` : celui de la nouvelle distance (formatDepuisDistance), seulement quand elle change.
 */
export function intakeDeLObjectif({ base, avant, apres, nom, email, niveau, format }: {
  base: ReponsesDeLObjectif; avant: ValeursDeLaCarte; apres: ValeursDeLaCarte; nom: string; email: string; niveau?: string; format?: string;
}) {
  const c = { ...champsVides, ...(base as Partial<Champs>), nom, email, duree_mois: 'auto', coupure: '' } as Champs;
  const route = estUneRoute(c.format);
  if (apres.date_course && (apres.date_course !== avant.date_course || !c.date_course)) c.date_course = apres.date_course;
  if (!route) {
    if (distanceChangee(avant, apres)) {
      c.distance_km = apres.distance_km.replace(',', '.');
      if (format) c.format = format;
    }
    if (!memeNombre(avant.dplus_m, apres.dplus_m)) {
      // Un D− égal au D+ d’avant suivait le D+ : vide, il le suit encore.
      if (c.dmoins_m && memeNombre(c.dmoins_m, c.dplus_m)) c.dmoins_m = '';
      c.dplus_m = apres.dplus_m.replace(',', '.');
    }
  }
  if (apres.temps_cible) c.temps_cible = apres.temps_cible;
  if (apres.jours_disponibles.length) c.jours_disponibles = JOURS_DE_LA_SEMAINE.filter((j) => apres.jours_disponibles.includes(j));
  if (apres.jour_sl) c.jour_sl = apres.jour_sl;
  if (apres.freq_hebdo) c.freq_hebdo = apres.freq_hebdo;
  if (apres.cote_min) c.cote_min = apres.cote_min;
  if (apres.tapis) c.tapis = apres.tapis;
  c.niveau = c.niveau || niveau || 'intermediaire';
  if (route) c.terrain = c.terrain || 'vallonne';
  // Comme le questionnaire, au champ près (intakePourApi) : les deux critères ne partent pas au moteur de l'achat, la v1 les lit sur sa fiche (enregistrée par la carte).
  return intakePourApi(c);
}

// ─── Le test et les repères ──────────────────────────────────────────────────────────────────────────────────────────

export const testSaisi = (e: EffortsDuTest): boolean => [e.duree1, e.distance1, e.duree2, e.distance2].some((x) => x.trim() !== '');

/**
 * Ses repères, quand une fréquence cardiaque ou l'allure de sa vitesse critique a changé (null sinon) : l’enregistrement (enregistrerValeurs) efface tout ce qui part vide, donc la fréquence inchangée et les deux allures repartent telles qu’elles sont ;
 * `allures_gardees` lui dit de garder leur valeur exacte (ni arrondie à la seconde, ni redite « saisie par toi »).
 */
export function reperesAEnvoyer(avant: ValeursDeLaCarte, apres: ValeursDeLaCarte, allures: { vs1: string | null; vc: string | null }): [string, string][] | null {
  if (CLES_DES_REPERES.every((k) => (k === 'vc_allure' ? avant[k] === apres[k] : memeNombre(avant[k], apres[k])))) return null;
  return [['fc_seuil1', apres.fc_seuil1], ['fc_seuil2', apres.fc_seuil2], ['vs1_allure', allures.vs1 ?? ''], ['vc_allure', apres.vc_allure || (allures.vc ?? '')], ['allures_gardees', '1']];
}

// ─── Sa fiche ────────────────────────────────────────────────────────────────────────────────────────────────────────

// Ce que la carte envoie à sa fiche. `avecSemaine` : les jours, la sortie longue et les séances de l’objectif, recopiés quand l’objectif les a bien.
export function champsDuCoureur(v: ValeursDeLaCarte, avecSemaine: boolean): [string, string][] {
  return [
    ...CLES_DU_COUREUR.map((k): [string, string] => [k, v[k]]),
    ...(avecSemaine ? [...v.jours_disponibles.map((j): [string, string] => ['jours_disponibles', j]), ['jour_sl', v.jour_sl] as [string, string], ['freq_hebdo', v.freq_hebdo] as [string, string]] : []),
  ].filter(([, x]) => x !== '');
}

export type SaisieCoureur = ValeursTrail & { cote_min: string; tapis: string; critere_intensite: string; critere_denivele: string; jours_disponibles: string[]; jour_sl: string; freq_hebdo: string };

export function lireSaisieCoureur(form: FormData): SaisieCoureur {
  const lu = (k: string) => String(form.get(k) ?? '').trim();
  return {
    cote_min: lu('cote_min'), tapis: lu('tapis'), critere_intensite: lu('critere_intensite'), critere_denivele: lu('critere_denivele'),
    ...(Object.fromEntries(POINTS_TRAIL.map((p) => [p.champ, lu(p.champ)])) as ValeursTrail),
    jours_disponibles: form.getAll('jours_disponibles').map(String).filter((j) => JOURS_DE_LA_SEMAINE.includes(j)), jour_sl: lu('jour_sl'), freq_hebdo: lu('freq_hebdo'),
  };
}

type Profil = Record<string, string | string[]>;

/**
 * Sa fiche après la carte : seuls les champs remplis changent, rien n’est effacé. Son niveau est gardé, « intermediaire » à défaut (le moteur v1 ne le lit pas) ; son terrain vient de sa côte en minutes.
 */
export function profilAvecLaCarte(avant: Profil | null | undefined, s: SaisieCoureur): { profil: Profil } | { erreur: string } {
  const profil: Profil = { ...(avant ?? {}) };
  profil.niveau = profil.niveau || 'intermediaire';
  if (s.cote_min) {
    const cote = lireCote(s.cote_min);
    if (cote === null) return { erreur: TEXTES_COTE.illisibleSa };
    profil.cote_min = String(cote);
  }
  const terrain = terrainDeLaCote(profil.cote_min);
  if (terrain) profil.terrain = terrain;
  if (s.tapis === 'oui' || s.tapis === 'non') profil.tapis = s.tapis;
  if (estReponseCritere(s.critere_intensite)) profil.critere_intensite = s.critere_intensite;
  if (estReponseCritere(s.critere_denivele)) profil.critere_denivele = s.critere_denivele;
  Object.assign(profil, pointsSaisis((champ) => s[champ]));
  if (s.jours_disponibles.length || s.jour_sl || s.freq_hebdo) {
    const jours = s.jours_disponibles.length ? s.jours_disponibles : liste(profil.jours_disponibles);
    const erreur = erreurDeSemaine(jours, s.jour_sl, s.freq_hebdo);
    if (erreur) return { erreur };
    if (s.jours_disponibles.length) profil.jours_disponibles = s.jours_disponibles;
    if (JOURS_DE_LA_SEMAINE.includes(s.jour_sl)) profil.jour_sl = s.jour_sl;
    if (s.freq_hebdo) profil.freq_hebdo = s.freq_hebdo;
  }
  return { profil };
}
