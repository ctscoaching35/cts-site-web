/**
 * LE STOCKAGE DE LA CHAÎNE DU MOTEUR v1 (supabase/migrations/20261124120000_etat_du_moteur_v1.sql, écrite, pas appliquée) : l'état par plan, les
 * semaines écrites avec l'état d'avant, le questionnaire posé. Seul ce fichier connaît les colonnes ; il ne lit ni ne modifie celles de la 8.x
 * (plans.etat_ecriture, semaines_ecrites.etat_avant, revue, realise). PRÉPARÉ, PAS BRANCHÉ (rien ne le lit encore ; scripts/test-ecriture-v9.mjs).
 *
 * L'ORDRE DES ÉCRITURES : la semaine d'abord, l'état du plan ensuite. Si la seconde échoue, la semaine est gardée avec son état d'avant : la reprise la
 * réécrit (c'est la dernière) et refait le même état. Dans l'autre sens, un état sans sa semaine ne se réécrirait pas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ETAT_VIDE, type Etat, type EtatDuPlan } from './etatMoteur';
import { etatV9, noteEnTexte } from './moteurV9';
import type { SemaineEcriteV9 } from './ecritureV9';
import type { ReponsesDimanche, SeanceCle, VersionDimanche } from './dimancheV9';
import type { SortieV9 } from './moteurV9';

export const MOTEUR_ECRIT = '9.0';
export const cleDeLaSemaine = (numero: number) => `S${numero}`;
const numeroDeLaCle = (cle: unknown): number | null => {
  const m = /^S(\d+)$/.exec(String(cle ?? ''));
  return m ? Number(m[1]) : null;
};
const MIGRATION = 'la migration du 24/11/2026 (état du moteur v1) est-elle passée ?';
const echec = (quoi: string, e: { message: string }) => new Error(`${quoi} : ${e.message} (${MIGRATION})`);

export async function lireEtatDuPlan(service: SupabaseClient, planId: string): Promise<EtatDuPlan> {
  const { data: p, error } = await service.from('plans').select('etat_moteur').eq('id', planId).maybeSingle();
  if (error) throw echec('plans.etat_moteur', error);
  const { data: lignes, error: e2 } = await service.from('semaines_ecrites').select('numero, etat_avant_moteur').eq('plan_id', planId).eq('moteur', MOTEUR_ECRIT);
  if (e2) throw echec('semaines_ecrites', e2);
  const ecrites = ((lignes ?? []) as { numero: string; etat_avant_moteur: unknown }[]).flatMap((l) => {
    const numero = numeroDeLaCle(l.numero);
    return numero === null ? [] : [{ numero, etatAvant: etatV9(l.etat_avant_moteur) ? (l.etat_avant_moteur as Etat) : null }];
  }).sort((a, b) => a.numero - b.numero);
  const courant = (p as { etat_moteur?: unknown } | null)?.etat_moteur;
  return p || ecrites.length ? { courant: etatV9(courant) ? courant : null, ecrites } : ETAT_VIDE;
}

// La semaine écrite et l'état du plan. `apres` : l'état du plan après cette écriture (etatApresEcriture).
export async function garderUneEcriture(service: SupabaseClient, planId: string, ecrite: SemaineEcriteV9, apres: EtatDuPlan): Promise<void> {
  const { error } = await service.from('semaines_ecrites').upsert({
    plan_id: planId, numero: cleDeLaSemaine(ecrite.numero), donnees: ecrite.semaine, notes: [], journal: [], bilan: noteEnTexte(ecrite.note) || null,
    sans_ajustement: false, moteur: MOTEUR_ECRIT, etat_avant_moteur: ecrite.etatUtilise, pourquoi: ecrite.pourquoi, branche: ecrite.branche,
    reponses_lues: ecrite.reponses, ecrite_le: new Date().toISOString(),
  });
  if (error) throw echec(`semaine ${ecrite.numero}`, error);
  await garderLEtat(service, planId, apres.courant);
}

export async function garderLEtat(service: SupabaseClient, planId: string, etat: Etat | null): Promise<void> {
  const { error } = await service.from('plans').update({ etat_moteur: etat }).eq('id', planId);
  if (error) throw echec('plans.etat_moteur', error);
}

// Le questionnaire du dimanche posé à la fin d'une semaine : ce qu'il faut pour lire ses réponses en rangs (lireReponsesDimanche).
export type QuestionnaireGarde = { version: VersionDimanche; cles: SeanceCle[]; nolio_id: string | null; pose_le: string };
export async function garderLeQuestionnairePose(service: SupabaseClient, planId: string, numero: number, q: QuestionnaireGarde): Promise<void> {
  const { error } = await service.from('semaines_ecrites').update({ questionnaire: q }).eq('plan_id', planId).eq('numero', cleDeLaSemaine(numero));
  if (error) throw echec(`questionnaire de la semaine ${numero}`, error);
}
export async function lireLeQuestionnairePose(service: SupabaseClient, planId: string, numero: number): Promise<QuestionnaireGarde | null> {
  const { data, error } = await service.from('semaines_ecrites').select('questionnaire').eq('plan_id', planId).eq('numero', cleDeLaSemaine(numero)).maybeSingle();
  if (error) throw echec(`questionnaire de la semaine ${numero}`, error);
  const q = (data as { questionnaire?: QuestionnaireGarde | null } | null)?.questionnaire;
  return q && typeof q === 'object' && Array.isArray(q.cles) ? q : null;
}

// La dernière semaine écrite par le moteur v1 : sa semaine, les réponses qui l'ont écrite, le questionnaire posé à sa fin ; null sans aucune.
export type SemaineGardeeV9 = { numero: number; lundi: string | null; semaine: SortieV9['semaine']; reponsesLues: ReponsesDimanche | null; questionnaire: QuestionnaireGarde | null };
export async function lireLaDerniereSemaine(service: SupabaseClient, planId: string): Promise<SemaineGardeeV9 | null> {
  const { data, error } = await service.from('semaines_ecrites').select('numero, donnees, reponses_lues, questionnaire').eq('plan_id', planId).eq('moteur', MOTEUR_ECRIT);
  if (error) throw echec('semaines_ecrites', error);
  const lignes = ((data ?? []) as { numero: string; donnees: SortieV9['semaine']; reponses_lues: ReponsesDimanche | null; questionnaire: QuestionnaireGarde | null }[])
    .flatMap((l) => (numeroDeLaCle(l.numero) === null ? [] : [{ ...l, n: numeroDeLaCle(l.numero) as number }])).sort((a, b) => b.n - a.n);
  const l = lignes[0];
  if (!l) return null;
  return { numero: l.n, lundi: typeof l.donnees?.lundi === 'string' ? l.donnees.lundi : null, semaine: l.donnees, reponsesLues: l.reponses_lues ?? null,
    questionnaire: l.questionnaire && Array.isArray(l.questionnaire.cles) ? l.questionnaire : null };
}

// Les réponses qu'une réponse tardive a vues : la semaine n'est pas réécrite, mais la même réponse ne se rejoue pas au passage suivant.
export async function garderLesReponsesLues(service: SupabaseClient, planId: string, numero: number, reponses: ReponsesDimanche): Promise<void> {
  const { error } = await service.from('semaines_ecrites').update({ reponses_lues: reponses }).eq('plan_id', planId).eq('numero', cleDeLaSemaine(numero));
  if (error) throw echec(`réponses de la semaine ${numero}`, error);
}
