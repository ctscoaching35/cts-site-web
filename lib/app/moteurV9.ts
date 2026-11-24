// Fonctions pures, sans réseau ni base : PRÉPARÉ, PAS BRANCHÉ (rien ne les lit encore ; scripts/test-moteur-v9.mjs).
/**
 * LE CONTRAT DU MOTEUR 9.0 (CONTRAT_API_CTS.md, section « MOTEUR v1 », 23/11/2026) CÔTÉ SITE : les corps que le site envoie et ce qu'il
 * garde, en types et en fonctions pures. Le moteur ne garde rien : `etat`, rendu à chaque appel, est rendu tel quel à l'appel suivant.
 *
 *   POST /v1/semaine         { parametres, numero, etat?, nolio?, reponses? } -> { semaine, note, pourquoi, etat, branche }
 *   POST /v1/questionnaire   { parametres, numero, etat?, nolio? }            -> { version }
 *   POST /v1/trame           { parametres }                                   -> { semaines, version_moteur }
 *   POST /v1/nolio/seances   { semaine, profil? }                             -> { seances: [{ id, famille, nolio }], cycle }
 *
 * Retirés (404) : /v1/semaine/lundi, /v1/realise, /v1/fatigue, /v1/veto, /v1/recuperation, /v1/course-secondaire. L'achat
 * (/v1/verification, /v1/apercu, /v1/checkout, /v1/plans, PDF) reste sur 8.474 jusqu'à la 9.1 : rien de ce fichier ne le concerne.
 *
 * LE SITE ET LES DEUX VERSIONS : tant que le moteur en ligne est une 8.x, rien n'est appelé d'ici. `estMoteurV9` lit la version que
 * `GET /v1/config` rend (`version_moteur`).
 */
import { lireCote, TERRAIN_DE_COTE } from '../cote';
import type { ReponsesDimanche, VersionDimanche } from './dimancheV9';

export const estMoteurV9 = (versionMoteur: unknown): boolean => typeof versionMoteur === 'string' && /^9(\.|$)/.test(versionMoteur.trim());

// Le rang d'une semaine dans la liste de `POST /v1/trame` (1 à N) : « S9 », 9 ou « 9 » ; null s'il ne se lit pas.
export function numeroMoteur(numero: unknown): number | null {
  if (typeof numero === 'number') return Number.isInteger(numero) && numero >= 1 ? numero : null;
  const m = /^S?(\d+)$/.exec(String(numero ?? '').trim());
  return m && Number(m[1]) >= 1 ? Number(m[1]) : null;
}

export type Categorie = 'jamais' | 'parfois' | 'regulier';
export type CoteMax = '1m30' | '2-5' | '5-10' | '10+';
export type EntreesAthlete = {
  // Les deux critères (`criteres.intensite`, `criteres.mecanique`) : un critère absent vaut « jamais », et « Pourquoi cette semaine » le dit.
  criteres?: { intensite?: Categorie | null; mecanique?: Categorie | null };
  // La plus longue côte, en minutes (contrat du 23/11/2026, entrée 188) : un nombre d'au moins 1 (sous 1 min, 1 : le plancher du moteur,
  // 24/11/2026) ; la réponse du questionnaire (`base.cote_min`, « 12 ») est lue à défaut. `cote_max` (la tranche) n'est lu par le moteur
  // que sans `cote_min` : transition.
  cote_min?: number | string | null;
  cote_max?: CoteMax | null; tapis?: 'oui' | 'non' | null;
  // Ce que Nolio montre de ses 4 dernières semaines : remplace le déclaré.
  lu?: { volume_min?: number | null; sl_min?: number | null } | null;
  aisance?: 'montee' | 'descente' | null; montees?: 'courtes' | 'moyennes' | 'longues' | null;
  coaching?: boolean; entree?: string | null; course_precedente?: { date: string; duree_h: number } | null;
  // La cible du calculateur de l'app : une fourchette [bas, haut] ou un nombre, en g/h ; le moteur lit UN nombre (absent : 60).
  glucides?: [number, number] | number | null;
  accord_lecture?: boolean;
};

// Ce que le moteur 8.x lisait et que la 9.0 ne lit plus : le niveau, l'habitude, le terrain à quatre valeurs, et les deux critères à plat de
// l'intake d'avant la 9.1 (ils deviennent `criteres`).
const RETIRES = ['niveau', 'habitude', 'terrain', 'critere_intensite', 'critere_denivele', 'strategie', 'glucides_cible'];
// Ce que `parametresV9` écrit lui-même : la réponse du site, « 12 », ne passe pas telle quelle (le moteur lit un nombre).
const REECRITS = [...RETIRES, 'cote_min'];
const CATEGORIES: Categorie[] = ['jamais', 'parfois', 'regulier'];
const categorie = (v: unknown): Categorie | null => (CATEGORIES as unknown[]).includes(v) ? (v as Categorie) : null;

// Une fourchette de glucides en un nombre : le milieu, arrondi (g/h) ; un nombre garde sa valeur ; autre chose : rien (le moteur prend 60).
export function glucidesPourLeMoteur(g: EntreesAthlete['glucides'] | unknown): number | null {
  if (Array.isArray(g) && g.length === 2 && g.every((x) => typeof x === 'number' && x > 0)) return Math.round((g[0] + g[1]) / 2);
  return typeof g === 'number' && Number.isFinite(g) && g > 0 ? Math.round(g) : null;
}

// Les `parametres` du moteur 9.0 d'après ceux du plan (l'intake d'avant) et ce que la fiche donne en plus. Rien n'est modifié ; les clés
// que la 9.0 ne lit pas sont retirées ; une clé absente reste absente (jamais une valeur inventée).
export function parametresV9(base: Record<string, unknown>, e: EntreesAthlete = {}): Record<string, unknown> {
  const sortie: Record<string, unknown> = Object.fromEntries(Object.entries(base).filter(([k]) => !REECRITS.includes(k)));
  const intensite = categorie(e.criteres?.intensite) ?? categorie(base.critere_intensite);
  const mecanique = categorie(e.criteres?.mecanique) ?? categorie(base.critere_denivele);
  if (intensite || mecanique) sortie.criteres = { ...(intensite ? { intensite } : {}), ...(mecanique ? { mecanique } : {}) };
  // La côte : `cote_min`, en minutes, d'au moins 1 (le plancher du moteur ; sans côte lue, il lui donne 1 min). Sans minutes lues, la tranche
  // (`cote_max`) : celle qu'on donne, sinon celle de l'ancien terrain d'un profil d'avant ; le moteur ne la lit que sans `cote_min`.
  const cote = lireCote(e.cote_min ?? base.cote_min);
  if (cote !== null) sortie.cote_min = cote;
  else {
    const tranche = e.cote_max ?? (Object.entries(TERRAIN_DE_COTE).find(([, t]) => t === base.terrain)?.[0] as CoteMax | undefined);
    if (tranche) sortie.cote_max = tranche;
  }
  if (e.tapis) sortie.tapis = e.tapis;
  if (e.lu && (e.lu.volume_min || e.lu.sl_min)) sortie.lu = { ...(e.lu.volume_min ? { volume_min: e.lu.volume_min } : {}), ...(e.lu.sl_min ? { sl_min: e.lu.sl_min } : {}) };
  if (e.aisance) sortie.aisance = e.aisance;
  if (e.montees) sortie.montees = e.montees;
  if (e.coaching) {
    sortie.coaching = 'oui';
    if (e.entree) sortie.entree = e.entree;
    if (e.course_precedente) sortie.course_precedente = e.course_precedente;
  }
  const glucides = glucidesPourLeMoteur(e.glucides ?? base.glucides_cible);
  if (glucides !== null) sortie.glucides_cible = glucides;
  if (e.accord_lecture !== undefined) sortie.accord_lecture = e.accord_lecture;
  return sortie;
}

// ─── Ce que Nolio montre : l'entrée `nolio` ─────────────────────────────────────────────────────────

// De la plus ancienne à la plus récente, 13 semaines au plus. `etapes` : à plat ; `faite` : false seulement quand l'athlète coche « pas
// faite », null quand rien ne s'en lit. `id` : celui que le moteur a posé (« S9-mardi ») ; une séance du coach n'en a pas (lue par son titre).
export type EtapeAPlat = { s: number; rpe: number | null; type: 'warmup' | 'work' | 'rest' | 'cooldown' };
export type SeanceVue = {
  id?: string | null; date: string; titre: string; duree_min: number | null; etapes: EtapeAPlat[]; faite: boolean | null;
  duree_faite_min: number | null; rpe: number | null; ressenti: number | null; course: boolean;
};
export type SemaineVue = { lundi: string; seances: SeanceVue[]; hooper: { date: string; valeur: number }[]; activites_vues: number };
export type NolioVu = { semaines: SemaineVue[] };
export const SEMAINES_LUES_AU_PLUS = 13;

// Les 13 dernières semaines au plus, rangées de la plus ancienne à la plus récente.
export function nolioPourLeMoteur(semaines: SemaineVue[]): NolioVu {
  return { semaines: [...semaines].sort((a, b) => a.lundi.localeCompare(b.lundi)).slice(-SEMAINES_LUES_AU_PLUS) };
}

// ─── Les corps des appels ───────────────────────────────────────────────────────────────────────────

type Etat = Record<string, unknown>;
const sans = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;

// `POST /v1/semaine`. etat : celui que le moteur a rendu l'appel d'avant, tel quel ; nolio et reponses : absents sans lecture (« sans
// réponse, la semaine prévue »).
export function corpsDeLaSemaine({ parametres, numero, etat, nolio, reponses }: {
  parametres: Record<string, unknown>; numero: unknown; etat?: Etat | null; nolio?: NolioVu | null; reponses?: ReponsesDimanche | null;
}) {
  const n = numeroMoteur(numero);
  if (n === null) throw new Error(`Numéro de semaine illisible : ${String(numero)}`);
  return sans({ parametres, numero: n, etat, nolio, reponses });
}

// `POST /v1/questionnaire` : la version du dimanche, choisie le matin d'après ce que Nolio montre de la semaine écrite.
export function corpsDuQuestionnaire({ parametres, numero, etat, nolio }: {
  parametres: Record<string, unknown>; numero: unknown; etat?: Etat | null; nolio?: NolioVu | null;
}) {
  const n = numeroMoteur(numero);
  if (n === null) throw new Error(`Numéro de semaine illisible : ${String(numero)}`);
  return sans({ parametres, numero: n, etat, nolio });
}

export const versionDuQuestionnaire = (r: unknown): VersionDimanche | null => {
  const v = (r as { version?: unknown } | null)?.version;
  return v === 'normale' || v === 'aucune_seance_vue' || v === 'fatigue' ? v : null;
};

// `POST /v1/nolio/seances` : la semaine telle que /v1/semaine l'a rendue, et ce que l'athlète a dans Nolio (une valeur absente n'est
// jamais visée : le RPE seul).
export function corpsNolioSeances(semaine: Record<string, unknown>, profil?: { vc_ms?: number | null; fc_seuil1?: number | null; fc_seuil2?: number | null } | null) {
  const p = profil ? sans(profil as Record<string, unknown>) : {};
  return Object.keys(p).length ? { semaine, profil: p } : { semaine };
}

// La réponse de `POST /v1/semaine`, vérifiée : la semaine, sa note, son pourquoi, l'état à garder et la branche. null si elle n'a pas cette
// forme : l'état d'une 9.0 porte sa version (`etat.version`, « 9.0 »), ce que ne fait pas la réponse d'une 8.x, jamais lue comme une 9.0.
export type SortieV9 = {
  semaine: { numero?: number; lundi?: string; jours?: unknown[] } & Record<string, unknown>; note: string | null; pourquoi: unknown[]; etat: Etat; branche: number | null;
};
export function lireSortieV9(r: unknown): SortieV9 | null {
  const o = r as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  if (!o.semaine || typeof o.semaine !== 'object' || !Array.isArray((o.semaine as { jours?: unknown }).jours)) return null;
  if (!o.etat || typeof o.etat !== 'object' || Array.isArray(o.etat) || !estMoteurV9((o.etat as Etat).version)) return null;
  return {
    semaine: o.semaine as SortieV9['semaine'], note: typeof o.note === 'string' ? o.note : null,
    pourquoi: Array.isArray(o.pourquoi) ? o.pourquoi : [], etat: o.etat as Etat, branche: typeof o.branche === 'number' ? o.branche : null,
  };
}
