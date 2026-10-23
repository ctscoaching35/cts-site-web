/**
 * Le retrait d'un athlète coaché : « Retirer cet athlète » sur sa fiche, ou, tout seul, sa sortie de l'équipe Nolio (la
 * corbeille, décision coach du 22/10/2026 : « quand un athlète arrête je le signale sur Nolio, il faut que ça suive sur
 * l'app »). Ses objectifs et leurs plans partent, sa fiche aussi (et avec elle son accès à l'app) ; sorti de Nolio, ce
 * que le site tenait de Nolio sur lui s'efface (son accord, ses badges ; conditions de l'API, article 7.2). Les séances
 * déjà envoyées restent dans Nolio. Côté serveur seulement.
 */
import { clientService } from './supabase';

export async function supprimerPlans(coachId: string, planIds: string[]) {
  const service = clientService();
  for (const id of planIds) {
    const { data } = await service.from('plans').select('pdf_chemin').eq('id', id).eq('compte_id', coachId).maybeSingle();
    if (data?.pdf_chemin) await service.storage.from('plans-pdf').remove([data.pdf_chemin]);
    // Les traces de ses courses de préparation, gardées pour les modifier (23/10/2026).
    if (data) {
      const { data: traces } = await service.storage.from('plans-pdf').list(`preparations/${id}`);
      if (traces?.length) await service.storage.from('plans-pdf').remove(traces.map((f) => `preparations/${id}/${f.name}`));
    }
    await service.from('plans').delete().eq('id', id).eq('compte_id', coachId);
  }
}

// Sa fiche et ses objectifs, chez ce coach.
export async function retirerFiche(coachId: string, ficheId: string, planIds: string[]) {
  await supprimerPlans(coachId, planIds);
  await clientService().from('athletes_coaches').delete().eq('id', ficheId).eq('coach_id', coachId);
}

// Sorti de l'équipe Nolio : chacune de ses fiches de coaché retirée, son accord et ses badges effacés (ses badges
// seulement s'il n'est pas aussi acheteur d'un plan). Le nombre de fiches retirées.
export async function retirerCoachePartiDeNolio(usr: string): Promise<number> {
  const service = clientService();
  const { data: fiches } = await service.from('athletes_coaches').select('id, coach_id').eq('nolio_athlete_id', usr);
  for (const f of fiches ?? []) {
    const { data: lignes } = await service.from('coaching').select('plan_id').eq('athlete_id', f.id);
    await retirerFiche(String(f.coach_id), String(f.id), (lignes ?? []).map((l) => String(l.plan_id)));
    await service.from('nolio_accords').delete().eq('coach_id', f.coach_id).eq('nolio_athlete_id', usr);
  }
  if (fiches?.length) {
    const { data: achats } = await service.from('plans').select('id').eq('nolio_athlete_id', usr).limit(1);
    if (!achats?.length) await service.from('badges').delete().eq('nolio_athlete_id', usr);
  }
  return fiches?.length ?? 0;
}
