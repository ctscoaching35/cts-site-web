/**
 * LES PARAMÈTRES DU MOTEUR v1 POUR UN PLAN (CONTRAT_API_CTS.md, « MOTEUR v1 ») : ses réponses d'achat, ses tests tels que Nolio les a, et, d'un coaché, ce que son
 * coach a rempli sur sa fiche ; sa cible de glucides. Ce que lisent le passage du dimanche, la trame (« Mon plan ») et le questionnaire du matin. Côté serveur.
 */
import { clientService } from './supabase';
import type { Objectif } from './ecriture';
import { parametresDuPlanV9 } from './passeUnPlanV9';
import { profilDeLaFiche } from './profilEntrainement';
import { strategieDeLaCourse } from './strategie';
import { parametresAvecLaStrategie } from './strategieMoteur';

export async function parametresDuObjectifV9(o: Objectif): Promise<Record<string, unknown>> {
  let fiche: Record<string, string | string[]> | null = null;
  if (o.coache) {
    const { data } = await clientService().from('coaching').select('athlete_id').eq('plan_id', o.planId).maybeSingle();
    if (data?.athlete_id) fiche = await profilDeLaFiche(String(data.athlete_id)).catch(() => null);
  }
  const strategie = await strategieDeLaCourse(o.planId).catch(() => null);
  const glucides = (parametresAvecLaStrategie(o.parametres, strategie) as { glucides_cible?: unknown }).glucides_cible;
  return parametresDuPlanV9({ parametres: o.parametres, profil: o.profil as Record<string, number>, coache: o.coache, accordLecture: o.accordLecture,
    premierLundi: o.plan.semaines.find((s) => s.lundi)?.lundi ?? null, glucides: typeof glucides === 'number' ? glucides : null }, fiche);
}
