/**
 * La liste e-mail d'un compte gratuit (lot A2) : ce que l'app connaît de lui, envoyé à Brevo quand il s'inscrit, puis à
 * chaque changement de son profil ou de sa prochaine course (le lot B appellera `majListeSiInscrit` à chaque changement de la prochaine course). Lit avec SA session
 * (les règles de la base : chacun ne lit que le sien). Ne lève jamais : un échec de Brevo ne bloque rien.
 */
import { attributsListe, inscrireAListe } from './listeEmail';
import { testsSurs, profilDesTests } from './profilGratuit';
import { clientServeur } from './supabase';

// La prochaine course (date à venir, la plus proche), sinon la dernière sans date.
async function prochaineCourse(compteId: string) {
  const { data } = await (await clientServeur()).from('courses_gratuites').select('course_date, distance_km, dplus_m')
    .eq('compte_id', compteId).order('course_date', { ascending: true, nullsFirst: false });
  const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const lignes = (data ?? []) as { course_date: string | null; distance_km: number | string | null; dplus_m: number | null }[];
  const c = lignes.find((x) => x.course_date && x.course_date >= jour) ?? lignes[0];
  return c ? { date: c.course_date, distance_km: c.distance_km == null ? null : Number(c.distance_km), dplus_m: c.dplus_m } : null;
}

// Inscrit le compte à la liste avec ses attributs du moment ; true : Brevo a répondu par un succès.
export async function synchroniserListe(compteId: string, email: string): Promise<boolean> {
  try {
    const { data } = await (await clientServeur()).from('profils_gratuits').select('tests').eq('compte_id', compteId).maybeSingle();
    const profil = profilDesTests(testsSurs(data?.tests));
    return await inscrireAListe(email, attributsListe({
      vc_ms: profil.vc_ms, d_prime_m: profil.d_prime_m, prochaineCourse: await prochaineCourse(compteId),
    }));
  } catch (e) {
    console.error('Liste e-mail (attributs) :', e instanceof Error ? e.message : e);
    return false;
  }
}

// Le profil ou la prochaine course ont changé : les attributs suivent, pour qui est inscrit (liste_email_le daté).
export async function majListeSiInscrit(compteId: string, email: string): Promise<void> {
  try {
    const { data } = await (await clientServeur()).from('profils_gratuits').select('liste_email_le').eq('compte_id', compteId).maybeSingle();
    if (data?.liste_email_le) await synchroniserListe(compteId, email);
  } catch (e) {
    console.error('Liste e-mail (mise à jour) :', e instanceof Error ? e.message : e);
  }
}
