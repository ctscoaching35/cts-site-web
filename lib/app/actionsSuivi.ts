'use server';
/**
 * L'accord d'un athlète pour le suivi (CTS_NOLIO_CADRAGE.md, T3) : le coach coche « Accord reçu » quand l'athlète a
 * répondu oui dans la messagerie Nolio (sa réponse fait preuve) ; « Retirer l'accord » efface la ligne et l'app ne lit
 * plus ses données. Le même accord couvre ses repères (FC aux seuils, allures) sur sa fiche (E3, décision coach du
 * 15/10/2026) : le retirer les efface. Chaque geste revérifie le coach.
 */
import { revalidatePath } from 'next/cache';
import { coachConnecte } from './nolio';
import { clientService } from './supabase';

const USR = /^usr_[A-Za-z0-9]+$/;

export async function accordRecu(usr: string, nom: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach || !USR.test(usr)) return;
  await clientService().from('nolio_accords').upsert({ coach_id: coach.compteId, nolio_athlete_id: usr, nom: nom.slice(0, 120) });
  revalidatePath('/app/coach/suivi');
}

export async function retirerAccord(usr: string): Promise<void> {
  const coach = await coachConnecte();
  if (!coach || !USR.test(usr)) return;
  await clientService().from('nolio_accords').delete().eq('coach_id', coach.compteId).eq('nolio_athlete_id', usr);
  // Ses badges partent avec l'accord (BG1 à BG3, décisions coach du 20/10/2026).
  await clientService().from('badges').delete().eq('nolio_athlete_id', usr);
  await clientService().from('athletes_coaches').update({ fc_seuil1: null, vc_ms: null, v_seuil1_ms: null, fc_seuil2: null })
    .eq('coach_id', coach.compteId).eq('nolio_athlete_id', usr);
  // Les chiffres gardés de ses semaines écrites (charge faite, Hooper : moteur 8.327) s'effacent aussi (T5).
  const { data: fiches } = await clientService().from('athletes_coaches').select('id').eq('coach_id', coach.compteId).eq('nolio_athlete_id', usr);
  const { data: objectifs } = fiches?.length
    ? await clientService().from('coaching').select('plan_id').in('athlete_id', fiches.map((f) => f.id))
    : { data: [] };
  if (objectifs?.length) {
    await clientService().from('semaines_ecrites').update({ realise: null }).in('plan_id', objectifs.map((o) => o.plan_id));
  }
  revalidatePath('/app/coach/suivi');
}
