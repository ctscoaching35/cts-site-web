'use server';
/**
 * Les gestes de l'écriture semaine par semaine (CTS_NOLIO_CADRAGE.md, dernière section) : le coach démarre un objectif
 * dans Nolio, annule les ajustements d'une semaine (question 20) ; l'athlète ou le coach ajoute une course secondaire
 * (O2, O3). Chaque geste revérifie à qui est le plan.
 */
import { revalidatePath } from 'next/cache';
import { API_URL } from '@/lib/plan';
import { annulerAjustements, demarrerObjectif, objectifEcrit, retirerAccordLecture } from './ecriture';
import { coachConnecte } from './nolio';
import { clientServeur, clientService } from './supabase';

export type EtatGeste = { ok: boolean; message: string } | null;

// Le compte connecté et, s'il est coach, son compte coach.
async function qui(): Promise<{ compteId: string | null; coachId: string | null }> {
  const { data } = await (await clientServeur()).auth.getClaims();
  const coach = await coachConnecte();
  return { compteId: (data?.claims?.sub as string | undefined) ?? null, coachId: coach?.compteId ?? null };
}

export async function demarrerDansNolio(planId: string, _e: EtatGeste): Promise<EtatGeste> {
  const { coachId } = await qui();
  const o = await objectifEcrit(planId);
  if (!coachId || !o || o.coachId !== coachId) return { ok: false, message: 'Réservé au coach de cet objectif.' };
  try {
    const numero = await demarrerObjectif(planId);
    revalidatePath(`/app/coach/plan/${planId}`);
    return { ok: true, message: `C’est parti : la trame, les questionnaires du dimanche et la semaine ${numero.replace('S', '')} sont dans Nolio. La suite s’écrit chaque dimanche.` };
  } catch (e) {
    console.error(`Départ dans Nolio de ${planId} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'Le départ n’a pas abouti.' };
  }
}

export async function annulerSemaine(planId: string, numero: string, _e: EtatGeste): Promise<EtatGeste> {
  const { coachId } = await qui();
  const o = await objectifEcrit(planId);
  if (!coachId || !o || o.coachId !== coachId || !/^S\d+$/.test(numero)) return { ok: false, message: 'Réservé au coach de cet objectif.' };
  try {
    await annulerAjustements(planId, numero);
    revalidatePath(`/app/coach/plan/${planId}`);
    revalidatePath('/app/coach/suivi');
    return { ok: true, message: `Semaine ${numero.replace('S', '')} réécrite sans ses ajustements, et mise à jour dans Nolio.` };
  } catch (e) {
    console.error(`Annulation ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'L’annulation n’a pas abouti.' };
  }
}

// O2, O3 : une course secondaire, vérifiée par le moteur (3 semaines avant l'objectif, une toutes les 4 semaines, jamais
// plus longue que lui ; plus longue que la plus longue sortie récente, signalée). Elle compte dans les semaines écrites
// à partir du dimanche qui vient.
export async function ajouterCourse(planId: string, _e: EtatGeste, form: FormData): Promise<EtatGeste> {
  const { compteId, coachId } = await qui();
  const o = await objectifEcrit(planId);
  if (!o || !compteId || (o.compteId !== compteId && o.compteAthlete !== compteId && o.coachId !== coachId)) {
    return { ok: false, message: 'Plan introuvable.' };
  }
  const date = String(form.get('date') ?? '');
  const lundiProchain = new Date();
  lundiProchain.setUTCDate(lundiProchain.getUTCDate() + ((8 - lundiProchain.getUTCDay()) % 7 || 7));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < lundiProchain.toISOString().slice(0, 10)) {
    return { ok: false, message: 'Ta course doit tomber à partir de lundi prochain : la semaine en cours est déjà écrite.' };
  }
  const course = {
    nom: String(form.get('nom') ?? '').trim().slice(0, 80) || 'Course de préparation', date,
    distance_km: Number(String(form.get('distance_km') ?? '').replace(',', '.')),
    dplus_m: Number(String(form.get('dplus_m') ?? '0').replace(',', '.')) || 0,
  };
  if (!(course.distance_km > 0 && course.distance_km <= 200) || course.dplus_m < 0 || course.dplus_m > 15000) {
    return { ok: false, message: 'La distance ou le dénivelé ne se lisent pas.' };
  }
  const reelles = Object.values(((o.etat ?? {}) as { sl_reelles?: Record<string, number> }).sl_reelles ?? {});
  const r = await fetch(`${API_URL}/v1/course-secondaire`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ parametres: o.parametres, course, sl_30j_min: reelles.length ? Math.max(...reelles.slice(-4)) : null }),
  });
  const verdict = await r.json().catch(() => null) as { ok?: boolean; message?: string | null } | null;
  if (!r.ok || !verdict) return { ok: false, message: verdict?.message ?? 'Le moteur ne répond pas : réessaie dans un moment.' };
  if (!verdict.ok) return { ok: false, message: verdict.message ?? 'Cette course ne peut pas s’ajouter au plan.' };
  const courses = [...((o.parametres.courses_secondaires as unknown[]) ?? []), course];
  await clientService().from('plans').update({ parametres: { ...o.parametres, courses_secondaires: courses } }).eq('id', planId);
  revalidatePath('/app/plan');
  revalidatePath(`/app/coach/plan/${planId}`);
  return { ok: true, message: `Course ajoutée : les jours autour d’elle s’ajustent dans tes semaines.${verdict.message ? ` ${verdict.message}` : ''}` };
}

// T5 : l'acheteur retire son accord de lecture, depuis son Compte.
export async function retirerMonAccord(planId: string, _e: EtatGeste): Promise<EtatGeste> {
  const { compteId } = await qui();
  const o = await objectifEcrit(planId);
  if (!o || !compteId || o.compteId !== compteId || o.coache) return { ok: false, message: 'Plan introuvable.' };
  try {
    await retirerAccordLecture(planId);
    revalidatePath('/app');
    revalidatePath('/app/compte');
    return { ok: true, message: 'C’est fait : l’app ne lit plus ton RPE, ton ressenti ni ton Hooper, et ce qu’elle en avait gardé est effacé.' };
  } catch (e) {
    console.error(`Retrait de l'accord ${planId} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: 'Le retrait n’a pas abouti : réessaie dans un moment.' };
  }
}
