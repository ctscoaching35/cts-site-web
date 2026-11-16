/**
 * La stratégie de course gardée (décision coach du 20/10/2026 : « qu'elle reste notée pour lui, qu'il ne soit pas
 * obligé de la rentrer de nouveau, elle s'inscrit dans sa fiche de course » ; option « les quatre repères ») : dans
 * l'app, « Garder ma stratégie » du calculateur de nutrition range ses réponses et ses quatre repères (glucides,
 * boisson, sodium, caféine) avec sa course ; « Ton jour J » et sa fiche de course les affichent, et le calculateur se
 * rouvre rempli de ses réponses. Une stratégie par fiche de course : « objectif » pour sa course, la date d'une course
 * de préparation (AAAA-MM-JJ). Côté serveur, sauf les fonctions pures.
 */
import { ficheDuCompte } from './demandes';
import { clientServeur, clientService } from './supabase';

export * from './strategiePure';
import { COURSE_OBJECTIF } from './strategiePure';
import type { Strategie } from './strategiePure';

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

// Sa stratégie gardée pour sa course, lue une fois pour la semaine du moteur : ses glucides par heure (glucides_cible) et
// ses quatre repères (parametres.strategie) en sortent ensemble (lib/app/strategieMoteur.ts, parametresAvecLaStrategie).
export async function strategieDeLaCourse(planId: string): Promise<Strategie | null> {
  return (await strategiesDuPlan(planId))[COURSE_OBJECTIF] ?? null;
}
