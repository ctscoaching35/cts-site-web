'use server';
/**
 * Les gestes de l'espace coach (CTS_NOLIO_CADRAGE.md, N1 à N9, V4) : sur la fiche d'un athlète, son nom Nolio et
 * ses valeurs (N8) ; sur un objectif, l'envoi d'une semaine puis sa mise à jour (V4) ; retirer un objectif ou un
 * athlète. Chaque geste revérifie le coach et que l'athlète ou l'objectif est à lui.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerSemaine, ficheAthlete, mettreAJourSemaine, objectifCoache } from './coaching';
import { coachConnecte } from './nolio';
import { lireAllure } from './allureCoach';
import { clientService } from './supabase';

export type EtatCoach = { message: string; ok: boolean } | null;

export async function associerNolio(athleteId: string, form: FormData): Promise<void> {
  const coach = await coachConnecte();
  // L'identifiant d'un athlète dans l'API v2 de Nolio : « usr_… ».
  const nolioId = String(form.get('nolio_id') ?? '');
  if (!coach || !/^usr_[A-Za-z0-9]+$/.test(nolioId)) return;
  await clientService().from('athletes_coaches').update({ nolio_athlete_id: nolioId }).eq('id', athleteId).eq('coach_id', coach.compteId);
  revalidatePath(`/app/coach/athlete/${athleteId}`);
}

// N8 : FC au seuil 1, vitesse critique (en allure, min/km), FC au seuil 2 ; un champ vide efface la valeur.
export async function enregistrerValeurs(athleteId: string, _e: EtatCoach, form: FormData): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const lire = (cle: string, min: number, max: number) => {
    const brut = String(form.get(cle) ?? '').trim().replace(',', '.');
    if (!brut) return { valeur: null, ok: true };
    const n = Number(brut);
    return Number.isFinite(n) && n >= min && n <= max ? { valeur: n, ok: true } : { valeur: null, ok: false };
  };
  const fc1 = lire('fc_seuil1', 80, 220);
  const fc2 = lire('fc_seuil2', 80, 230);
  // L'allure, de 2:15 à 11:00 min/km (de 27 à 5,4 km/h).
  const brutAllure = String(form.get('vc_allure') ?? '').trim();
  const allure = brutAllure ? lireAllure(brutAllure) : null;
  const vcOk = !brutAllure || (allure !== null && allure >= 135 && allure <= 660);
  // L'allure au seuil 1, le palier du test de la parole, de 2:30 à 12:00 min/km (moteur 8.320).
  const brutS1 = String(form.get('vs1_allure') ?? '').trim();
  const allureS1 = brutS1 ? lireAllure(brutS1) : null;
  const s1Ok = !brutS1 || (allureS1 !== null && allureS1 >= 150 && allureS1 <= 720);
  if (!fc1.ok || !vcOk || !fc2.ok || !s1Ok)
    return { ok: false, message: 'Une valeur ne semble pas juste : FC entre 80 et 230, allures en min/km (par exemple 6:00 au seuil 1, 4:10 pour la vitesse critique).' };
  if (fc1.valeur !== null && fc2.valeur !== null && fc2.valeur <= fc1.valeur)
    return { ok: false, message: 'La FC au seuil 2 doit être plus haute que la FC au seuil 1.' };
  const { error } = await clientService().from('athletes_coaches').update({
    fc_seuil1: fc1.valeur === null ? null : Math.round(fc1.valeur),
    vc_ms: allure === null ? null : Math.round((1000 / allure) * 1000) / 1000,
    v_seuil1_ms: allureS1 === null ? null : Math.round((1000 / allureS1) * 1000) / 1000,
    fc_seuil2: fc2.valeur === null ? null : Math.round(fc2.valeur),
  }).eq('id', athleteId).eq('coach_id', coach.compteId);
  if (error) return { ok: false, message: 'L’enregistrement n’a pas abouti. Réessaie.' };
  revalidatePath(`/app/coach/athlete/${athleteId}`);
  return { ok: true, message: 'C’est enregistré. Les prochaines semaines envoyées partiront avec ces valeurs.' };
}

export async function envoyer(planId: string, numero: string, _e: EtatCoach): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  try {
    const envoye = await envoyerSemaine(coach.compteId, planId, numero);
    revalidatePath(`/app/coach/plan/${planId}`);
    return { ok: true, message: `Envoyé dans Nolio : ${envoye}.` };
  } catch (e) {
    console.error(`Envoi Nolio ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'L’envoi n’a pas abouti.' };
  }
}

// Envoyer tout le plan d'une traite (demande du coach du 13/10/2026) : le navigateur envoie les semaines une à une, avec
// cette action, sans rafraîchir la page entre deux (un seul long appel dépasserait le temps d'une requête Vercel).
export async function envoyerUneSemaine(planId: string, numero: string): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  try {
    return { ok: true, message: await envoyerSemaine(coach.compteId, planId, numero) };
  } catch (e) {
    console.error(`Envoi Nolio ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'L’envoi n’a pas abouti.' };
  }
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// V4 : mettre à jour une semaine envoyée ; le bilan dit ce qui a changé et ce qui est resté tel que le coach l'a fait.
export async function mettreAJour(planId: string, numero: string, _e: EtatCoach): Promise<EtatCoach> {
  const coach = await coachConnecte();
  if (!coach) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  try {
    const b = await mettreAJourSemaine(coach.compteId, planId, numero);
    revalidatePath(`/app/coach/plan/${planId}`);
    const fait = [b.remplacees && `${pluriel(b.remplacees, 'séance')} mise${b.remplacees > 1 ? 's' : ''} à jour`,
      b.ajoutees && `${pluriel(b.ajoutees, 'séance')} ajoutée${b.ajoutees > 1 ? 's' : ''}`,
      b.retirees && `${pluriel(b.retirees, 'séance')} retirée${b.retirees > 1 ? 's' : ''}`,
      b.notes && `${pluriel(b.notes, 'note')} de repos ajoutée${b.notes > 1 ? 's' : ''}`,
      b.bandeau && `bandeau « ${b.bandeau} » ajouté`].filter(Boolean).join(', ');
    const garde = b.gardees.length ? ` Gardé${b.gardees.length > 1 ? 'es' : 'e'} telle${b.gardees.length > 1 ? 's' : ''} quelle${b.gardees.length > 1 ? 's' : ''} : ${b.gardees.join(', ')}.` : '';
    return { ok: true, message: `${fait ? `${fait.charAt(0).toUpperCase()}${fait.slice(1)} dans Nolio.` : 'Rien à changer dans Nolio.'}${garde}` };
  } catch (e) {
    console.error(`Mise à jour Nolio ${planId} ${numero} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: e instanceof Error ? e.message : 'La mise à jour n’a pas abouti.' };
  }
}

async function supprimerPlans(coachId: string, planIds: string[]) {
  const service = clientService();
  for (const id of planIds) {
    const { data } = await service.from('plans').select('pdf_chemin').eq('id', id).eq('compte_id', coachId).maybeSingle();
    if (data?.pdf_chemin) await service.storage.from('plans-pdf').remove([data.pdf_chemin]);
    await service.from('plans').delete().eq('id', id).eq('compte_id', coachId);
  }
}

// Retirer un objectif : son plan et son PDF partent ; ce qui est dans Nolio y reste.
export async function retirerObjectif(planId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  const o = await objectifCoache(coach.compteId, planId);
  if (!o) return;
  await supprimerPlans(coach.compteId, [planId]);
  revalidatePath('/app/coach');
  redirect(`/app/coach/athlete/${o.athlete.id}`);
}

// Retirer un athlète : sa fiche, ses objectifs et leurs PDF partent ; ce qui est dans Nolio y reste.
export async function retirerAthlete(athleteId: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach) return;
  const a = await ficheAthlete(coach.compteId, athleteId);
  if (!a) return;
  await supprimerPlans(coach.compteId, a.objectifs.map((o) => o.plan_id));
  await clientService().from('athletes_coaches').delete().eq('id', athleteId).eq('coach_id', coach.compteId);
  revalidatePath('/app/coach');
  redirect('/app/coach');
}
