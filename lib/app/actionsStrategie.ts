'use server';
/**
 * Garder ou effacer la stratégie de course d'une fiche de course (lib/app/strategie.ts, décision coach du
 * 20/10/2026). La session est vérifiée, l'objectif doit être au compte (un plan à lui, ou l'un de ses objectifs de
 * coaché), puis le serveur écrit avec la clé de service. Seul le geste « Garder ma stratégie » l'envoie.
 */
import { revalidatePath } from 'next/cache';
import { cleCourse, compteDuPlan, lireStrategie, strategiesDuPlan } from './strategie';
import { clientService, supabaseConfigure } from './supabase';

export type EtatStrategie = { ok: boolean; message: string };

const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

export async function garderStrategie(planId: string, course: string, donnees: unknown): Promise<EtatStrategie> {
  if (!supabaseConfigure()) return { ok: false, message: 'Démonstration : ta stratégie se garde avec les comptes.' };
  const cle = cleCourse(course);
  const s = lireStrategie(donnees);
  if (!cle || !s) return { ok: false, message: 'Indique au moins la durée de ta course pour garder ta stratégie.' };
  if (!(await compteDuPlan(planId))) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const avant = await strategiesDuPlan(planId);
  const { error } = await clientService().from('plans')
    .update({ strategies: { ...avant, [cle]: { ...s, le: aujourdhui() } } }).eq('id', planId);
  if (error) {
    console.error(`Stratégie de course, plan ${planId} :`, error.message);
    return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie dans un moment.' };
  }
  revalidatePath('/app', 'layout');
  return { ok: true, message: 'Ta stratégie est gardée.' };
}

export async function effacerStrategie(planId: string, course: string): Promise<void> {
  const cle = cleCourse(course);
  if (!supabaseConfigure() || !cle || !(await compteDuPlan(planId))) return;
  const { [cle]: _efface, ...reste } = await strategiesDuPlan(planId);
  await clientService().from('plans').update({ strategies: reste }).eq('id', planId);
  revalidatePath('/app', 'layout');
}
