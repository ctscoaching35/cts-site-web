/**
 * Les demandes de coaching de l'app gratuite (lot A2, décisions du coach du 16/11/2026), côté serveur. Ne pas confondre
 * avec lib/app/demandes.ts : celui-là porte les demandes d'OBJECTIF d'un coaché (OM1) ; celui-ci, la demande de quelqu'un qui
 * n'est pas encore coaché (table demandes_coaching, supabase/migrations/20261116120000_demandes_coaching.sql).
 * Les écritures passent par la clé de service, après contrôle (lib/app/coachingRegles.ts) ; le compte lit et efface la
 * sienne avec sa session. Les demandes vont au seul coach Romain : le premier compte de CTS_COACHS.
 */
import { bornePourEffacer, reponsesSures, type DemandeLue, type ReponsesCoaching } from './coachingRegles';
import { modeAppGratuite } from './gratuitRegles';
import { coachs } from './nolio';
import { testsSurs, type Experience, type TestsGratuits } from './profilGratuit';
import { clientService } from './supabase';

export type StatutDemande = 'ouverte' | 'acceptee' | 'sans_suite';
export type LigneDemande = {
  id: string; compte_id: string; reponses: Partial<ReponsesCoaching>; sante: string | null; consentement_sante_le: string | null;
  moments: string[]; telephone: string; envoyee_le: string; statut: StatutDemande; traitee_le: string | null; athlete_id: string | null;
};

const lue = (d: Record<string, any>): LigneDemande => ({
  id: String(d.id), compte_id: String(d.compte_id), reponses: reponsesSures(d.reponses), sante: d.sante ?? null,
  consentement_sante_le: d.consentement_sante_le ?? null, moments: Array.isArray(d.moments) ? d.moments.filter((m: unknown) => typeof m === 'string') : [],
  telephone: String(d.telephone ?? ''), envoyee_le: String(d.envoyee_le), statut: d.statut, traitee_le: d.traitee_le ?? null, athlete_id: d.athlete_id ?? null,
});

// Les demandes vont au premier compte de CTS_COACHS (Romain) : les autres coachs ne les voient pas.
export const coachDesDemandes = (coach: { email: string }) => coachs()[0] === coach.email.trim().toLowerCase();

// La pastille : combien de demandes ouvertes. Rien (0) tant que l'app gratuite est coupée, ou si la table n'existe pas encore :
// la migration n'est jamais un obstacle à l'espace coach.
export async function nombreDeDemandesOuvertes(): Promise<number> {
  if (modeAppGratuite() === 'coupe') return 0;
  try {
    const { count, error } = await clientService().from('demandes_coaching').select('id', { count: 'exact', head: true }).eq('statut', 'ouverte');
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

export async function demandesOuvertes(): Promise<LigneDemande[]> {
  const { data } = await clientService().from('demandes_coaching').select('*').eq('statut', 'ouverte').order('envoyee_le', { ascending: true });
  return (data ?? []).map(lue);
}

export async function demandeParId(id: string): Promise<LigneDemande | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await clientService().from('demandes_coaching').select('*').eq('id', id).maybeSingle();
  return data ? lue(data) : null;
}

// La demande qui a donné cette fiche (acceptée) : elle reste lisible sur la fiche du coaché.
export async function demandeDeLAthlete(athleteId: string): Promise<LigneDemande | null> {
  try {
    const { data } = await clientService().from('demandes_coaching').select('*').eq('athlete_id', athleteId).maybeSingle();
    return data ? lue(data) : null;
  } catch {
    return null;
  }
}

// Ce que l'app sait déjà de la personne, joint à la demande : son expérience et ses tests, ses courses (lues en base par le
// serveur pour le coach seulement). La FC n'est montrée que si son consentement est donné (consentement_fc_le).
export type Jointes = {
  experience: Experience | null; tests: TestsGratuits; consentementFc: boolean;
  courses: { id: string; nom: string; course_date: string | null; temps_vise_s: number | null; distance_km: number | null; dplus_m: number | null }[];
};
export async function jointesDuCompte(compteId: string): Promise<Jointes> {
  const service = clientService();
  const { data: profil } = await service.from('profils_gratuits').select('experience, tests, consentement_fc_le').eq('compte_id', compteId).maybeSingle();
  const { data: courses } = await service.from('courses_gratuites').select('id, nom, course_date, temps_vise_s, distance_km, dplus_m')
    .eq('compte_id', compteId).order('course_date', { ascending: true, nullsFirst: false });
  return {
    experience: profil?.experience ?? null, tests: testsSurs(profil?.tests), consentementFc: Boolean(profil?.consentement_fc_le),
    courses: (courses ?? []).map((c) => ({ id: String(c.id), nom: String(c.nom), course_date: c.course_date ?? null,
      temps_vise_s: c.temps_vise_s ?? null, distance_km: c.distance_km == null ? null : Number(c.distance_km), dplus_m: c.dplus_m ?? null })),
  };
}

// Poser la demande d'un compte (une seule par compte : la renvoyer la met à jour et la rouvre). Sans le consentement, la
// santé n'est ni envoyée ni gardée.
export async function poserLaDemande(compteId: string, d: DemandeLue, maintenant = new Date()): Promise<void> {
  const service = clientService();
  // La clé des tables du compte : sa ligne `comptes` (posée au besoin, sans toucher à un compte existant).
  const { error: e1 } = await service.from('comptes').upsert({ id: compteId, nom: '' }, { onConflict: 'id', ignoreDuplicates: true });
  if (e1) throw new Error(`comptes : ${e1.message}`);
  const jour = maintenant.toISOString();
  const { error } = await service.from('demandes_coaching').upsert({
    compte_id: compteId, reponses: d.reponses, moments: d.moments, telephone: d.telephone,
    sante: d.consentementSante ? d.sante : null, consentement_sante_le: d.consentementSante ? jour : null,
    envoyee_le: jour, statut: 'ouverte', traitee_le: null, athlete_id: null,
  }, { onConflict: 'compte_id' });
  if (error) throw new Error(`demande : ${error.message}`);
}

// Le passage quotidien : une demande NON ACCEPTÉE s'efface 3 mois après son envoi. Rend le nombre de demandes effacées. Sans la
// table (migration pas encore passée), rien.
export async function effacerLesDemandesEchues(maintenant = new Date()): Promise<number> {
  const { data, error } = await clientService().from('demandes_coaching').delete().neq('statut', 'acceptee')
    .lt('envoyee_le', bornePourEffacer(maintenant)).select('id');
  if (error) {
    // Avant la migration, la table n'existe pas : rien à dire tant que l'app gratuite est coupée.
    if (modeAppGratuite() !== 'coupe') console.error('Demandes de coaching échues :', error.message);
    return 0;
  }
  return data?.length ?? 0;
}
