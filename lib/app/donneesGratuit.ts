/**
 * Ce que garde le compte gratuit, lu avec sa session (les règles de la base ne lui montrent que ses lignes). Sans la
 * table (migration pas encore collée), le profil reste vide.
 */
import { clientServeur } from './supabase';
import { estExperience, testsSurs, type Experience, type TestsGratuits } from './profilGratuit';

export type ProfilGarde = { experience: Experience | null; tests: TestsGratuits; consentementFc: boolean; liste: boolean };

export async function profilDuCompteGratuit(compteId: string): Promise<ProfilGarde> {
  const { data, error } = await (await clientServeur()).from('profils_gratuits')
    .select('experience, tests, consentement_fc_le, liste_email_le').eq('compte_id', compteId).maybeSingle();
  if (error) console.error('Profil gratuit illisible :', error.message);
  return {
    experience: estExperience(data?.experience) ? data.experience : null, tests: testsSurs(data?.tests),
    consentementFc: Boolean(data?.consentement_fc_le), liste: Boolean(data?.liste_email_le),
  };
}
