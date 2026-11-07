/**
 * La charge du moment d'un coaché, lue dans ses séances Nolio (QD4, décision coach du 19/10/2026 ; lib/app/coaching.ts,
 * chargeDepuisNolio) : les calculs, sans appel à Nolio ni à la base, pour qu'ils s'éprouvent seuls
 * (scripts/test-charge.mjs).
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
