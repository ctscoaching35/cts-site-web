'use server';
/**
 * Les gestes de l'écriture semaine par semaine (CTS_NOLIO_CADRAGE.md, dernière section) : le coach démarre un objectif
 * dans Nolio, annule les ajustements d'une semaine (question 20) ; l'athlète ou le coach ajoute une course secondaire
 * (O2, O3). Chaque geste revérifie à qui est le plan.
 */
import { revalidatePath } from 'next/cache';
import { API_URL } from '@/lib/plan';
import {
  annulerAjustements, demarrerObjectif, objectifEcrit, poserCourse, poserFichePreparation, retirerAccordLecture, retirerCourseDeNolio,
} from './ecriture';
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
    const depart = await demarrerObjectif(planId);
    revalidatePath(`/app/coach/plan/${planId}`);
    if ('prevu' in depart) {
      const le = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR');
      return { ok: true, message: depart.raison === 'seances'
        ? `Programmé : tes séances déjà posées vont jusqu’au ${le(depart.apres)}. L’écriture commencera toute seule le lundi ${le(depart.prevu)} ; rien n’est écrasé.`
        : `Programmé : un objectif à la fois. Il démarrera tout seul le ${le(depart.prevu)}, après la récupération de ${depart.apres}.` };
    }
    return { ok: true, message: `C’est parti : la trame, les questionnaires du dimanche et la semaine ${depart.numero.replace('S', '')} sont dans Nolio. La suite s’écrit chaque dimanche.` };
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
  // PO3 : le chrono visé (« 2h15 », « 2:15 », « 135 min ») ; il règle les jours autour de la course et sa fiche.
  const temps_h = heuresDuChrono(String(form.get('chrono') ?? ''));
  const course = {
    nom: String(form.get('nom') ?? '').trim().slice(0, 80) || 'Course de préparation', date,
    distance_km: Number(String(form.get('distance_km') ?? '').replace(',', '.')),
    dplus_m: Number(String(form.get('dplus_m') ?? '0').replace(',', '.')) || 0,
    ...(temps_h !== null ? { temps_h, chrono: `${Math.floor(temps_h)}h${String(Math.round((temps_h % 1) * 60)).padStart(2, '0')}` } : {}),
  };
  if (!(course.distance_km > 0 && course.distance_km <= 200) || course.dplus_m < 0 || course.dplus_m > 15000) {
    return { ok: false, message: 'La distance ou le dénivelé ne se lisent pas.' };
  }
  if (temps_h === null || temps_h < 0.25 || temps_h > 48) return { ok: false, message: 'Le chrono visé ne se lit pas : par exemple 2h15.' };
  const reelles = Object.values(((o.etat ?? {}) as { sl_reelles?: Record<string, number> }).sl_reelles ?? {});
  const r = await fetch(`${API_URL}/v1/course-secondaire`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ parametres: o.parametres, course, sl_30j_min: reelles.length ? Math.max(...reelles.slice(-4)) : null }),
  });
  const verdict = await r.json().catch(() => null) as { ok?: boolean; message?: string | null } | null;
  if (!r.ok || !verdict) return { ok: false, message: verdict?.message ?? 'Le moteur ne répond pas : réessaie dans un moment.' };
  if (!verdict.ok) return { ok: false, message: verdict.message ?? 'Cette course ne peut pas s’ajouter au plan.' };
  const courses = [...((o.parametres.courses_secondaires as unknown[]) ?? []), course];
  const service = clientService();
  await service.from('plans').update({ parametres: { ...o.parametres, courses_secondaires: courses } }).eq('id', planId);
  // PO3 : sa fiche de course, sans plan, avec sa trace si elle est donnée ; gardée par sa date (après la migration du
  // 19/10/2026 : sans elle, la course s'ajoute sans fiche).
  const gpx = form.get('gpx');
  const traceDonnee = gpx instanceof File && gpx.size > 0;
  const envoi = new FormData();
  envoi.set('corps', JSON.stringify({ parametres: o.parametres, course }));
  if (traceDonnee) envoi.set('gpx', gpx);
  const rf = await fetch(`${API_URL}/v1/fiche-course`, { method: 'POST', body: envoi, cache: 'no-store' }).catch(() => null);
  const fiche = rf?.ok ? await rf.json().catch(() => null) as { trace?: boolean } | null : null;
  let ficheGardee = false;
  if (fiche) {
    const { data: fp, error } = await service.from('plans').select('fiches_preparation').eq('id', planId).maybeSingle();
    if (!error) {
      const avant = ((fp as { fiches_preparation?: Record<string, unknown> } | null)?.fiches_preparation ?? {});
      ficheGardee = !(await service.from('plans').update({ fiches_preparation: { ...avant, [date]: fiche } }).eq('id', planId)).error;
    }
  }
  // OM3 : la course dans le calendrier Nolio, si l'objectif y est déjà ; sinon elle part au démarrage.
  const { data: depart } = await clientService().from('plans').select('demarre_le').eq('id', planId).maybeSingle();
  if (depart?.demarre_le) {
    await poserCourse(o, course, false).catch((e) => console.error(`Course de ${planId} non posée dans Nolio :`, e instanceof Error ? e.message : e));
    // PO4 : sa fiche en note Nolio une semaine avant, avec son lien privé.
    if (ficheGardee) await poserFichePreparation(o, course).catch((e) => console.error(`Fiche de ${planId} non posée dans Nolio :`, e instanceof Error ? e.message : e));
  }
  revalidatePath('/app/plan');
  revalidatePath(`/app/coach/plan/${planId}`);
  const surLaFiche = !ficheGardee ? '' : traceDonnee && !fiche?.trace
    ? ' Sa fiche de course est prête, mais sa trace ne s’est pas lue : le profil reste schématique.'
    : ' Sa fiche de course est prête, ici et une semaine avant dans Nolio.';
  return { ok: true, message: `Course ajoutée : les jours autour d’elle s’ajustent dans tes semaines.${verdict.message ? ` ${verdict.message}` : ''}${surLaFiche}` };
}

// Retirer une course de préparation à venir (décision coach du 20/10/2026 : l'athlète la retire seul, comme il l'ajoute ;
// son coach le peut aussi) : elle quitte les paramètres et sa fiche part ; dans Nolio, sa course et le rappel de sa fiche
// s'ils sont encore à venir. Les semaines déjà écrites gardent leurs jours ajustés ; les suivantes s'écrivent sans elle.
export async function retirerCourse(planId: string, date: string, _e: EtatGeste): Promise<EtatGeste> {
  const { compteId, coachId } = await qui();
  const o = await objectifEcrit(planId);
  if (!o || !compteId || (o.compteId !== compteId && o.compteAthlete !== compteId && o.coachId !== coachId)) {
    return { ok: false, message: 'Plan introuvable.' };
  }
  const courses = ((o.parametres.courses_secondaires as { date: string }[] | undefined) ?? []);
  const aujourdhui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  if (!courses.some((c) => c.date === date) || date <= aujourdhui) return { ok: false, message: 'Cette course n’est plus à venir.' };
  const soucis = await retirerCourseDeNolio(o, date).catch((e) => [e instanceof Error ? e.message : String(e)]);
  if (soucis.length) console.error(`Course du ${date} (${planId}) : restée dans Nolio — ${soucis.join(' ; ')}`);
  const service = clientService();
  await service.from('plans').update({ parametres: { ...o.parametres, courses_secondaires: courses.filter((c) => c.date !== date) } }).eq('id', planId);
  const { data: fp, error } = await service.from('plans').select('fiches_preparation').eq('id', planId).maybeSingle();
  if (!error) {
    const fiches = { ...((fp as { fiches_preparation?: Record<string, unknown> } | null)?.fiches_preparation ?? {}) };
    delete fiches[date];
    await service.from('plans').update({ fiches_preparation: fiches }).eq('id', planId);
  }
  revalidatePath('/app/plan');
  revalidatePath(`/app/coach/plan/${planId}`);
  return { ok: true, message: soucis.length
    ? 'Course retirée de ta préparation. Dans Nolio, elle n’a pas pu partir : retire-la à la main.'
    : 'Course retirée : tes prochaines semaines s’écrivent sans elle.' };
}

// « 2h15 », « 2h », « 2:15 », « 135 min », « 2,5 » : des heures ; null illisible.
function heuresDuChrono(brut: string): number | null {
  const t = brut.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  const hm = /^(\d{1,2})\s*[h:]\s*(\d{0,2})$/.exec(t);
  if (hm) return Number(hm[1]) + Number(hm[2] || 0) / 60;
  const m = /^(\d{1,4})\s*min$/.exec(t);
  if (m) return Number(m[1]) / 60;
  const h = /^(\d{1,2}(?:\.\d+)?)$/.exec(t);
  return h ? Number(h[1]) : null;
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
    return { ok: true, message: 'C’est fait : l’app ne lit plus ton RPE, ton ressenti, ton Hooper ni tes séances test, et ce qu’elle en avait gardé est effacé. Tes repères restent dans « Tes zones », où tu peux les effacer.' };
  } catch (e) {
    console.error(`Retrait de l'accord ${planId} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: 'Le retrait n’a pas abouti : réessaie dans un moment.' };
  }
}
