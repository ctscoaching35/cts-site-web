/**
 * Ranger un dossier de course dans le compte gratuit (table courses_gratuites, lot B). Côté serveur, avec la session du compte
 * (les règles de la base : chacun n'écrit que ses lignes). Le fichier GPX n'est conservé nulle part : seules les entrées et la
 * réponse du moteur (son profil allégé) sont gardées. Ce fichier n'est PAS une action serveur (il prend un compte en
 * paramètre) : les actions (actionsCourses.ts, actionsGratuit.ts) l'appellent après avoir vérifié la session.
 */
import { assurerCompte } from './compteGratuit';
import { allegerReponse, dossierSur, nomDeLaCourse, tempsViseSecondes } from './courseLibre';
import { majListeSiInscrit } from './listeGratuit';
import { lireStrategie } from './strategiePure';
import { clientServeur } from './supabase';

// Au plus vingt dossiers par compte : une course se prépare, on n'en fait pas des dizaines (et chaque dossier est une ligne de la base).
export const DOSSIERS_AU_PLUS = 20;
export const MESSAGE_TROP_DE_DOSSIERS = `Tu gardes déjà ${DOSSIERS_AU_PLUS} dossiers de course : supprime-en un pour en garder un nouveau.`;
const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

export type RangeDossier = { ok: true; id: string } | { ok: false; message: string };

// brut : { entrees, reponse, strategie? }, venu du navigateur : relu, jamais cru sur parole.
export async function rangerDossier(compteId: string, email: string | undefined, brut: unknown): Promise<RangeDossier> {
  const lu = dossierSur(brut);
  if (!lu) return { ok: false, message: 'Ce dossier n’a pas pu être gardé : refais-le dans le calculateur, puis garde-le.' };
  const reponse = allegerReponse(lu.reponse);
  const strategie = lireStrategie((brut as { strategie?: unknown }).strategie);
  const supabase = await clientServeur();
  await assurerCompte(compteId);
  const { count } = await supabase.from('courses_gratuites').select('id', { count: 'exact', head: true }).eq('compte_id', compteId);
  if ((count ?? 0) >= DOSSIERS_AU_PLUS) return { ok: false, message: MESSAGE_TROP_DE_DOSSIERS };
  const { data, error } = await supabase.from('courses_gratuites').insert({
    compte_id: compteId, nom: nomDeLaCourse(reponse), course_date: reponse.course.date, temps_vise_s: tempsViseSecondes(reponse),
    distance_km: reponse.course.distance_km, dplus_m: Math.round(reponse.course.dplus_m),
    resultat: { entrees: lu.entrees, reponse }, strategie: strategie ? { ...strategie, le: aujourdhui() } : null,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'aucune ligne');
  // Sa prochaine course a changé : TYPE_COURSE et DATE_COURSE suivent chez Brevo, pour qui est inscrit ; un échec ne bloque rien.
  if (email) await majListeSiInscrit(compteId, email);
  return { ok: true, id: String(data.id) };
}
