/**
 * Les demandes d'objectif des coachés (CTS_NOLIO_CADRAGE.md, OM1, décision coach du 19/10/2026) : le coaché remplit
 * le questionnaire dans l'app (sans durée ni paiement), sa demande et sa trace attendent son coach, qui la relit,
 * corrige si besoin et lance l'objectif depuis son espace (« Nouvel objectif », prérempli de la demande). Côté
 * serveur seulement.
 */
import { clientService } from './supabase';

export type Demande = {
  id: string; athlete_id: string; coach_id: string; champs: Record<string, string | string[]>; gpx_chemin: string | null;
  statut: string; cree_le: string;
};

// La fiche coaché d'un compte invité dans l'app (T6), ou null.
export async function ficheDuCompte(compteId: string): Promise<{ id: string; coach_id: string; nom: string } | null> {
  const { data } = await clientService().from('athletes_coaches').select('id, coach_id, nom').eq('compte_id', compteId).limit(1);
  return (data?.[0] ?? null) as { id: string; coach_id: string; nom: string } | null;
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
    .eq('statut', 'a_valider').maybeSingle();
  return (data ?? null) as Demande | null;
}

export async function demandesDeLAthlete(athleteId: string): Promise<Demande[]> {
  const { data } = await clientService().from('objectifs_demandes').select('*').eq('athlete_id', athleteId).eq('statut', 'a_valider');
  return (data ?? []) as Demande[];
}
