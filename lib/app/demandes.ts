/**
 * Les demandes d'objectif des coachés (CTS_NOLIO_CADRAGE.md, OM1, décision coach du 19/10/2026) : le coaché remplit
 * le questionnaire dans l'app (sans durée ni paiement), sa demande et sa trace attendent son coach, qui la relit,
 * corrige si besoin et lance l'objectif depuis son espace (« Nouvel objectif », prérempli de la demande). Côté
 * serveur seulement.
 */
import { clientService } from './supabase';

// plan_id : rempli à la validation d'une demande d'objectif ; sur une demande encore à valider, c'est une demande de
// RETRAIT de cet objectif (décision coach du 20/10/2026 : l'athlète demande, le coach confirme).
export type Demande = {
  id: string; athlete_id: string; coach_id: string; champs: Record<string, string | string[]>; gpx_chemin: string | null;
  statut: string; cree_le: string; plan_id: string | null;
};
export const estRetrait = (d: Pick<Demande, 'plan_id'>) => Boolean(d.plan_id);

// La fiche coaché d'un compte invité dans l'app (T6), ou null ; null aussi en mode plan (décision coach du 23/10/2026) :
// son app est alors celle d'un acheteur.
export async function ficheDuCompte(compteId: string): Promise<{ id: string; coach_id: string; nom: string } | null> {
  const { data } = await clientService().from('athletes_coaches').select('*').eq('compte_id', compteId);
  const f = (data ?? []).find((x) => x.mode !== 'plan');
  return f ? { id: String(f.id), coach_id: String(f.coach_id), nom: String(f.nom) } : null;
}

export async function demandesDuCoach(coachId: string): Promise<(Demande & { nom: string })[]> {
  const service = clientService();
  const { data } = await service.from('objectifs_demandes').select('*').eq('coach_id', coachId).eq('statut', 'a_valider').order('cree_le');
  const ids = [...new Set((data ?? []).map((d) => d.athlete_id as string))];
  const { data: fiches } = ids.length ? await service.from('athletes_coaches').select('id, nom').in('id', ids) : { data: [] };
  const nom = new Map((fiches ?? []).map((f) => [f.id as string, f.nom as string]));
  return ((data ?? []) as Demande[]).map((d) => ({ ...d, nom: nom.get(d.athlete_id) ?? '' }));
}

export async function demandeDuCoach(coachId: string, demandeId: string): Promise<Demande | null> {
  const { data } = await clientService().from('objectifs_demandes').select('*').eq('id', demandeId).eq('coach_id', coachId)
    .eq('statut', 'a_valider').is('plan_id', null).maybeSingle();
  return (data ?? null) as Demande | null;
}

export async function demandesDeLAthlete(athleteId: string): Promise<Demande[]> {
  const { data } = await clientService().from('objectifs_demandes').select('*').eq('athlete_id', athleteId).eq('statut', 'a_valider');
  return (data ?? []) as Demande[];
}
