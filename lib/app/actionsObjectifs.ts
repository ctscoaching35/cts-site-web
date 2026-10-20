'use server';
/**
 * Les objectifs d'un coaché, de son côté (décision coach du 20/10/2026, « il demande, tu confirmes ») : il annule seul
 * une demande que son coach n'a pas encore lancée (sa trace part avec) ; pour un objectif lancé, il demande le retrait,
 * que son coach confirme ou refuse dans son espace. Chaque geste revérifie que la demande ou l'objectif est à lui.
 */
import { revalidatePath } from 'next/cache';
import { ficheDuCompte } from './demandes';
import { clientServeur, clientService } from './supabase';

async function maFiche() {
  const { data } = await (await clientServeur()).auth.getClaims();
  const compteId = data?.claims?.sub as string | undefined;
  return compteId ? ficheDuCompte(compteId) : null;
}

// Annuler sa demande encore à valider : un objectif demandé, ou la demande de retrait d'un objectif.
export async function annulerDemande(demandeId: string): Promise<void> {
  const fiche = await maFiche();
  if (!fiche) return;
  const service = clientService();
  const { data: d } = await service.from('objectifs_demandes').select('id, gpx_chemin').eq('id', demandeId)
    .eq('athlete_id', fiche.id).eq('statut', 'a_valider').maybeSingle();
  if (!d) return;
  if (d.gpx_chemin) await service.storage.from('plans-pdf').remove([d.gpx_chemin as string]);
  await service.from('objectifs_demandes').update({ statut: 'retiree', gpx_chemin: null }).eq('id', d.id);
  revalidatePath('/app/plan');
}

// Demander le retrait d'un objectif lancé par son coach ; une seule demande à la fois par objectif.
export async function demanderRetrait(planId: string): Promise<void> {
  const fiche = await maFiche();
  if (!fiche) return;
  const service = clientService();
  const { data: lien } = await service.from('coaching').select('plan_id, plans(course_nom, course_date)')
    .eq('plan_id', planId).eq('athlete_id', fiche.id).maybeSingle();
  if (!lien) return;
  const { data: deja } = await service.from('objectifs_demandes').select('id').eq('plan_id', planId).eq('statut', 'a_valider').limit(1);
  if (deja?.length) return;
  const p = (Array.isArray(lien.plans) ? lien.plans[0] : lien.plans) as { course_nom: string; course_date: string } | null;
  await service.from('objectifs_demandes').insert({
    athlete_id: fiche.id, coach_id: fiche.coach_id, plan_id: planId, statut: 'a_valider',
    champs: { retrait: '1', course_nom: p?.course_nom ?? '', date_course: p?.course_date ?? '' },
  });
  revalidatePath('/app/plan');
}

// Son profil d'entraînement, modifié par le coaché lui-même (décision coach du 20/10/2026, « le voir et le modifier ») :
// il vaut pour ses prochains objectifs, que son coach relit et lance ; sa préparation en cours garde le sien.
export async function modifierMonProfil(_e: { ok: boolean; message: string } | null, form: FormData): Promise<{ ok: boolean; message: string }> {
  const fiche = await maFiche();
  if (!fiche) return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
  const { lireProfil } = await import('./profilEntrainement');
  const lu = lireProfil(form, 'ton');
  if ('erreur' in lu) return { ok: false, message: lu.erreur };
  const { error } = await clientService().from('athletes_coaches').update({ profil: lu.profil }).eq('id', fiche.id);
  if (error) return { ok: false, message: 'L’enregistrement n’a pas abouti : réessaie dans un moment.' };
  revalidatePath('/app/profil');
  return { ok: true, message: 'C’est enregistré : ton prochain objectif partira de ce profil ; ta préparation en cours garde le sien.' };
}
