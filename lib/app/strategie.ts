/**
 * La stratégie de course gardée (décision coach du 20/10/2026 : « qu'elle reste notée pour lui, qu'il ne soit pas
 * obligé de la rentrer de nouveau, elle s'inscrit dans sa fiche de course » ; option « les quatre repères ») : dans
 * l'app, « Garder ma stratégie » du calculateur de nutrition range ses réponses et ses quatre repères (glucides,
 * boisson, sodium, caféine) avec sa course ; « Ton jour J » et sa fiche de course les affichent, et le calculateur se
 * rouvre rempli de ses réponses. Une stratégie par fiche de course : « objectif » pour sa course, la date d'une course
 * de préparation (AAAA-MM-JJ). Côté serveur, sauf les fonctions pures.
 */
import { ficheDuCompte } from './demandes';
import { requeteCalculateurNutrition } from './plan';
import { clientServeur, clientService } from './supabase';

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
  return {
    ...Object.fromEntries(new URLSearchParams(requeteCalculateurNutrition(temps, niveau))),
    ...(s?.entrees ?? {}), ...(garder ? { garder } : {}),
  };
}

// Les stratégies gardées d'un objectif ; vide avant la migration du 20/10/2026 (la colonne n'existe pas encore).
export async function strategiesDuPlan(planId: string): Promise<Record<string, Strategie>> {
  const { data, error } = await clientService().from('plans').select('strategies').eq('id', planId).maybeSingle();
  if (error || !data) return {};
  return ((data as { strategies?: Record<string, Strategie> | null }).strategies ?? {}) as Record<string, Strategie>;
}

// L'objectif est-il au compte connecté : un plan à lui (les règles de la base ne lui montrent que les siens), ou l'un
// de ses objectifs de coaché (rangés dans le compte de son coach). Le compte, ou null.
export async function compteDuPlan(planId: string): Promise<string | null> {
  const supabase = await clientServeur();
  const { data: session } = await supabase.auth.getClaims();
  const compteId = session?.claims?.sub ? String(session.claims.sub) : null;
  if (!compteId) return null;
  const { data: plan } = await supabase.from('plans').select('id').eq('id', planId).maybeSingle();
  if (plan) return compteId;
  const fiche = await ficheDuCompte(compteId);
  const { data: lien } = fiche
    ? await clientService().from('coaching').select('plan_id').eq('plan_id', planId).eq('athlete_id', fiche.id).maybeSingle()
    : { data: null };
  return lien ? compteId : null;
}

// En démonstration (?retours=exemple) : une stratégie gardée, pour voir la fiche.
export const STRATEGIE_EXEMPLE: Strategie = {
  entrees: { heures: '2', minutes: '15', poids: '68', conditions: 'tempere', niveau: 'int', intestin: 'cours', sueur: 'moderee' },
  cartes: [
    { nom: 'Glucides', valeur: '45 à 55 g', sous: 'par heure' },
    { nom: 'Boisson', valeur: '500 à 700 mL', sous: 'par heure, à ta soif' },
    { nom: 'Sodium', valeur: 'Rien', sous: 'de systématique sous 3 h' },
    { nom: 'Caféine', valeur: '170 à 200 mg', sous: 'une heure avant' },
  ],
  le: '2026-10-20',
};
