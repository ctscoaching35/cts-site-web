'use server';
/**
 * Les gestes de la page coach (CTS_NOLIO_CADRAGE.md, N1 à N5) : associer l'athlète Nolio, envoyer une
 * semaine, retirer un athlète. Chaque geste revérifie le coach et que l'athlète est à lui.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { athleteCoache, envoyerSemaine } from './coaching';
import { coachConnecte } from './nolio';
import { clientService } from './supabase';

export type EtatCoach = { message: string; ok: boolean } | null;

export async function associerNolio(planId: string, form: FormData): Promise<void> {
  const coach = await coachConnecte();
  const nolioId = Number(form.get('nolio_id'));
  if (!coach || !Number.isInteger(nolioId) || nolioId <= 0) return;
  await clientService().from('coaching').update({ nolio_athlete_id: nolioId }).eq('plan_id', planId).eq('coach_id', coach.compteId);
  revalidatePath(`/app/coach/athlete/${planId}`);
}

export async function envoyer(planId: string, numero: string, _e: EtatCoach): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  try {
    const n = await envoyerSemaine(coach.compteId, planId, numero);
    revalidatePath(`/app/coach/athlete/${planId}`);
    return { ok: true, message: `${n} séance${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''} dans Nolio.` };
  } catch (e) {
    console.error(`Envoi Nolio ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'L’envoi n’a pas abouti.' };
  }
}

// Retirer un athlète de l'espace coach : son plan et son PDF partent ; ce qui est dans Nolio y reste.
export async function retirerAthlete(planId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  const a = await athleteCoache(coach.compteId, planId);
  if (!a) return;
  const service = clientService();
  if (a.pdf) await service.storage.from('plans-pdf').remove([a.pdf]);
  await service.from('plans').delete().eq('id', planId).eq('compte_id', coach.compteId);
  revalidatePath('/app/coach');
  redirect('/app/coach');
}
