/**
 * La partie PURE de la stratégie de course (aucune lecture de base, utilisable dans le navigateur) : les types, la lecture
 * vérifiée de ce que le calculateur envoie et l'adresse du calculateur. lib/app/strategie.ts la ré-exporte ; l'app gratuite
 * (dossier de course, lot B) s'en sert côté navigateur.
 */
import { requeteCalculateurNutrition } from './plan';

export const COURSE_OBJECTIF = 'objectif';
export type CarteStrategie = { nom: string; valeur: string; sous: string };
export type Strategie = { entrees: Record<string, string>; cartes: CarteStrategie[]; le: string };

// Les réponses du calculateur (public/calculateur-nutrition.html), celles qu'il sait relire dans son adresse.
const ENTREES: Record<string, RegExp> = {
  heures: /^\d{1,2}$/, minutes: /^\d{1,2}$/, poids: /^\d{2,3}([.,]\d)?$/, conditions: /^(frais|tempere|chaud|humide)$/,
  nuit: /^1$/, niveau: /^(deb|int|exp)$/, intestin: /^(non|cours|oui)$/, sueur: /^(faible|moderee|elevee)$/,
};
export const CLES_ENTREES = Object.keys(ENTREES);
// Les quatre cartes du calculateur, dans son ordre (c_cho, c_eau, c_na, c_caf).
const NOMS = ['Glucides', 'Boisson', 'Sodium', 'Caféine'];

export const cleCourse = (c: unknown): string | null =>
  c === COURSE_OBJECTIF || (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c)) ? c : null;

// Ce que le calculateur envoie, vérifié : ses réponses connues, ses quatre repères en texte court ; null sinon.
export function lireStrategie(brut: unknown): Omit<Strategie, 'le'> | null {
  if (!brut || typeof brut !== 'object') return null;
  const { entrees, cartes } = brut as { entrees?: unknown; cartes?: unknown };
  if (!entrees || typeof entrees !== 'object' || !Array.isArray(cartes) || cartes.length !== NOMS.length) return null;
  const e = Object.fromEntries(Object.entries(ENTREES).flatMap(([k, re]) => {
    const v = String((entrees as Record<string, unknown>)[k] ?? '').trim();
    return v && re.test(v) ? [[k, v]] : [];
  }));
  if (!e.heures && !e.minutes) return null;
  const c = cartes.map((x, i) => ({
    nom: NOMS[i], valeur: String((x as { valeur?: unknown })?.valeur ?? '').trim().slice(0, 40),
    sous: String((x as { sous?: unknown })?.sous ?? '').trim().slice(0, 80),
  }));
  return c.some((x) => !x.valeur) ? null : { entrees: e, cartes: c };
}

// L'adresse du calculateur : la durée visée et le niveau, remplacés par ses réponses gardées ; garder, la fiche de
// course où « Garder ma stratégie » la range (dans l'app seulement).
export function parametresCalculateur(temps: string, niveau: string, s?: Strategie | null, garder?: string): Record<string, string> {
  const p: Record<string, string> = {
    ...Object.fromEntries(new URLSearchParams(requeteCalculateurNutrition(temps, niveau))),
    ...(s?.entrees ?? {}), ...(garder ? { garder } : {}),
  };
  // C31 (audits du 05/11/2026) : une durée en heures pleines (« 7h ») passe ses minutes à « 00 » ; vides, le calculateur
  // montrait leur exemple « 30 », qui se lisait 7 h 30.
  if (p.heures && !p.minutes) p.minutes = '00';
  return p;
}

