/**
 * La charge du moment d'un coaché, lue dans ses séances Nolio (QD4, décision coach du 19/10/2026 ; lib/app/coaching.ts,
 * chargeDepuisNolio) : les calculs, sans appel à Nolio ni à la base, pour qu'ils s'éprouvent seuls
 * (scripts/test-charge.mjs) ; et l'historique des 13 semaines d'avant, pour le niveau habituel du moteur (décision 8 du
 * coach du 09/11/2026 ; scripts/test-historique.mjs).
 */
import { ajouterJours } from './plan';

// LE VOLUME DU MOMENT (décision coach du 24/10/2026, « la moyenne est souvent peu représentative ») : sa dernière semaine,
// jamais sous la moyenne des 4 (une semaine malade ou allégée ne fait pas partir trop bas) ni au-delà de cette moyenne
// +30 % (un pic isolé ne fait pas partir trop haut ; la hausse brutale du volume, Nielsen 2014). semaines : les minutes
// de course de chaque semaine, dans l'ordre, la dernière au bout. La plus longue sortie reste celle des 4 semaines.
export function volumeDuMoment(semaines: number[]): { retenu: number; moyenne: number; pourquoi: 'derniere' | 'plafond' | 'moyenne' } {
  const moyenne = semaines.reduce((a, b) => a + b, 0) / Math.max(1, semaines.length);
  const derniere = semaines[semaines.length - 1] ?? 0;
  if (derniere <= moyenne) return { retenu: moyenne, moyenne, pourquoi: 'moyenne' };
  if (derniere > moyenne * 1.3) return { retenu: moyenne * 1.3, moyenne, pourquoi: 'plafond' };
  return { retenu: derniere, moyenne, pourquoi: 'derniere' };
}

// Les 4 semaines sur lesquelles se lit sa charge, fin exclue : TOUJOURS les 4 dernières semaines complètes, du lundi au
// dimanche, comme les lignes du calendrier Nolio (décision coach du 23/10/2026), la fin au lundi de la semaine en cours.
// Les jours de course n'y comptent jamais (chargeDepuisNolio). PLUS AUCUN RECUL (décision coach du 07/11/2026, « A ») :
// après une course de moins de 2 semaines, le calcul sautait 2 semaines d'« affûtage » supposé et lisait les 4 d'avant —
// une course le 24/10 faisait lire du 07/09 au 04/10, son vrai bloc d'octobre sauté, et le questionnaire était prérempli
// à 0h34 au lieu d'environ 3h25 ; la borne comptait aussi une course d'il y a 14 jours pile.
export function fenetreDeCharge(aujourdhui: string): { debut: string; fin: string } {
  const fin = ajouterJours(aujourdhui, -((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  return { debut: ajouterJours(fin, -28), fin };
}

// Les minutes de course de chaque semaine de la fenêtre, la plus ancienne d'abord, et les séances qui y comptent : les
// jours de course n'y comptent jamais (décision coach du 23/10/2026 : ni dans le volume ni dans la plus longue sortie).
export function semainesDeCharge<T extends { date: string; min: number }>(debut: string, fin: string, seances: T[],
  competitions: string[]): { recentes: T[]; parSemaine: number[] } {
  const jours = new Set(competitions);
  const recentes = seances.filter((r) => r.date >= debut && r.date < fin && !jours.has(r.date));
  const parSemaine = [0, 1, 2, 3].map((i) => recentes
    .filter((r) => r.date >= ajouterJours(debut, 7 * i) && r.date < ajouterJours(debut, 7 * (i + 1))).reduce((a, r) => a + r.min, 0));
  return { recentes, parSemaine };
}

// LA PLUS LONGUE SORTIE DE CHAQUE SEMAINE (moteur 8.460, décision « B » du coach du 08/11/2026 au soir : la sortie longue
// d'une saison de fond part de la plus longue sortie courue des 4 dernières semaines, saison commencée ou non) : les
// 4 semaines qui commencent au lundi `debut`, la plus ancienne d'abord, en minutes entières ; 0 pour une semaine sans
// course ; les jours de course n'y comptent jamais, comme dans la charge (décision coach du 23/10/2026).
export function plusLonguesParSemaine<T extends { date: string; min: number }>(debut: string, seances: T[],
  competitions: string[]): number[] {
  const jours = new Set(competitions);
  return [0, 1, 2, 3].map((i) => Math.round(Math.max(0, ...seances
    .filter((r) => !jours.has(r.date) && r.date >= ajouterJours(debut, 7 * i) && r.date < ajouterJours(debut, 7 * (i + 1)))
    .map((r) => r.min))));
}

// LE NIVEAU HABITUEL, LU DANS NOLIO (décision 8 du coach du 09/11/2026, doctrine de la semaine : « le niveau habituel se
// lit dans Nolio sur ses semaines d'entraînement normales des 3 derniers mois ; sans historique, sa déclaration ») : les
// `n` semaines complètes, du lundi au dimanche, qui commencent au lundi `debut`, la plus ancienne d'abord, en minutes
// entières ; 0 pour une semaine vide. Le volume de course et la plus longue sortie se lisent sans les jours de course,
// comme la charge (décision coach du 23/10/2026) ; une semaine qui contient un jour de course le dit (`course`), avec la
// plus longue activité de ce jour (`course_min`, la course elle-même). Toutes les semaines partent telles quelles : c'est
// le moteur qui écarte lui-même les semaines allégées, de course et de récupération pour en tirer sa semaine typique (le
// volume, la sortie longue).
export const SEMAINES_HISTORIQUE = 13;
export type HistoriqueSemaine = { lundi: string; volume_min: number; sl_min: number; course: boolean; course_min: number };
export function historiqueParSemaine(debut: string, seances: { date: string; min: number }[], competitions: string[],
  n = SEMAINES_HISTORIQUE): HistoriqueSemaine[] {
  const jours = new Set(competitions);
  return Array.from({ length: n }, (_, i) => {
    const lundi = ajouterJours(debut, 7 * i);
    const suivant = ajouterJours(debut, 7 * (i + 1));
    const semaine = seances.filter((r) => r.date >= lundi && r.date < suivant);
    const entrainement = semaine.filter((r) => !jours.has(r.date)).map((r) => r.min);
    const courses = semaine.filter((r) => jours.has(r.date)).map((r) => r.min);
    return {
      lundi,
      volume_min: Math.round(entrainement.reduce((a, b) => a + b, 0)),
      sl_min: Math.round(Math.max(0, ...entrainement)),
      course: competitions.some((d) => d >= lundi && d < suivant),
      course_min: Math.round(Math.max(0, ...courses)),
    };
  });
}

// L'historique ne part qu'une fois (décision 8 du coach du 09/11/2026) : le moteur pose `niveau_habituel.historique` dans
// son état la première fois qu'il le reçoit, puis tient lui-même le niveau habituel à jour de semaine en semaine. Avant
// cette marque, il part, même pour un objectif déjà en cours ; un état sans elle (ou pas d'état) : pas encore reçu.
export function historiqueDejaRecu(etat: Record<string, unknown> | null | undefined): boolean {
  return (etat as { niveau_habituel?: { historique?: unknown } | null } | null | undefined)?.niveau_habituel?.historique === true;
}

// SA SEMAINE TYPIQUE, LUE AU SITE (moteur 8.460, étape D3 de la doctrine ; décision 8 du coach du 09/11/2026 : « la saison
// de fond démarre sur son niveau habituel », volume et sortie longue des mêmes semaines) : la règle du moteur
// (cts_bilan.niveau_habituel), sur ses semaines lues dans Nolio (historiqueParSemaine) — la médiane du volume et celle de
// la plus longue sortie de ses semaines d'entraînement normales, sans la semaine d'une course, celle qui la suit (sa
// récupération), une semaine vide, ni une semaine sous 75 % de la médiane des autres ; au moins 3 semaines normales, sinon
// null (sa déclaration tient lieu de lui). Avant, la saison partait du volume de ses 4 dernières semaines (affûtage,
// course, récupération) et de sa plus longue sortie sur 8 (sa préparation) : le moteur refusait une sortie plus longue
// que le volume, la saison ne se créait pas (N9 du banc d'essai).
export const NIVEAU_LEGERE_SOUS = 0.75;
export const NIVEAU_SEMAINES_MIN = 3;
const mediane = (v: number[]) => {
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};
export function niveauHabituel(semaines: HistoriqueSemaine[]): { volume_min: number; sl_min: number; semaines: number } | null {
  const apresCourse = new Set(semaines.filter((w) => w.course).map((w) => ajouterJours(w.lundi, 7)));
  const candidates = semaines.filter((w) => !w.course && !apresCourse.has(w.lundi) && w.volume_min > 0);
  if (!candidates.length) return null;
  const m = mediane(candidates.map((w) => w.volume_min));
  const normales = candidates.filter((w) => w.volume_min >= NIVEAU_LEGERE_SOUS * m);
  if (normales.length < NIVEAU_SEMAINES_MIN) return null;
  return {
    volume_min: Math.round(mediane(normales.map((w) => w.volume_min))),
    sl_min: Math.round(mediane(normales.map((w) => w.sl_min))),
    semaines: normales.length,
  };
}

// ─── CE QUE LE MOTEUR LIT DE CE QU'IL COURT AU DÉPART (entrée 203, décision du coach du 24/11/2026, « Oui, valide ») ─────────────────────
// Un seul calcul, pour le premier passage d'un plan sans état, le départ d'un objectif et la saison de fond : il donne `lu`, que le moteur v1 lit
// dans `parametres` à la place du déclaré (CONTRAT_API_CTS.md, « MOTEUR v1 »). Il remplace « la moyenne des 4 dernières semaines » (C8) :
//   - `sl_min` : sa plus longue sortie des 4 dernières semaines, jours de course exclus (4 semaines : le filet des 110 % porte sur 30 jours) ;
//   - `volume_min` : la moyenne de ses 4 plus grosses semaines des 8 dernières, les semaines où il a couru une course exclues : la moitié haute, ses semaines de
//     charge, que l'affûtage, la course et la récupération ne font pas baisser ; une semaine exceptionnelle y pèse peu, une semaine vide n'y est jamais ;
//   - sans aucune activité (course, trail ou tapis, lues par le lecteur) : rien, le moteur garde le déclaré du questionnaire.
// `lundi` : le lundi de la semaine que le moteur va écrire. Les semaines lues sont les complètes qui le précèdent, du lundi au dimanche, comme les
// lignes du calendrier Nolio (décision du 23/10/2026) : de `lundi` - 56 jours à `lundi` exclu.
export const SEMAINES_LUES_AU_DEPART = 8;
export const SEMAINES_RETENUES_AU_DEPART = 4;
export const SEMAINES_DE_LA_SL_AU_DEPART = 4;
export type LuAuDepart = { volume_min?: number; sl_min?: number };
export const fenetreDuDepart = (lundi: string): { debut: string; debutSl: string; fin: string } =>
  ({ debut: ajouterJours(lundi, -7 * SEMAINES_LUES_AU_DEPART), debutSl: ajouterJours(lundi, -7 * SEMAINES_DE_LA_SL_AU_DEPART), fin: lundi });

export function luAuDepart(lundi: string, activites: { date: string; min: number }[], competitions: string[]): LuAuDepart | null {
  const { debut, debutSl, fin } = fenetreDuDepart(lundi);
  const jours = new Set(competitions);
  const lues = activites.filter((a) => a.min > 0 && a.date >= debut && a.date < fin);
  const semaines = Array.from({ length: SEMAINES_LUES_AU_DEPART }, (_, i) => {
    const du = ajouterJours(debut, 7 * i);
    const au = ajouterJours(du, 7);
    return { course: competitions.some((c) => c >= du && c < au), min: lues.filter((a) => a.date >= du && a.date < au).reduce((s, a) => s + a.min, 0) };
  });
  const grosses = semaines.filter((s) => !s.course && s.min > 0).map((s) => s.min).sort((a, b) => b - a).slice(0, SEMAINES_RETENUES_AU_DEPART);
  const sl = Math.max(0, ...lues.filter((a) => a.date >= debutSl && !jours.has(a.date)).map((a) => a.min));
  const lu: LuAuDepart = {
    ...(grosses.length ? { volume_min: Math.round(grosses.reduce((s, m) => s + m, 0) / grosses.length) } : {}),
    ...(sl > 0 ? { sl_min: Math.round(sl) } : {}),
  };
  return Object.keys(lu).length ? lu : null;
}
