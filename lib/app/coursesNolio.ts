/**
 * Les compétitions que le coach pose dans Nolio (décision coach du 22/10/2026, « proposer, tu valides » ;
 * CTS_NOLIO_CADRAGE.md dans le dépôt du moteur) : sur la fiche de l'athlète, celles qui ne sont pas encore dans CTS ;
 * « Créer l'objectif » ouvre Nouvel objectif déjà rempli, « En préparation » le formulaire de sa course de préparation ;
 * « À regarder » signale une course A sans objectif. Rien ne se crée sans le coach. Côté serveur seulement.
 */
import { unstable_cache } from 'next/cache';
import { destinataire } from './coaching';
import { appelNolio, listeNolio } from './nolio';

// type : « a », l'objectif principal dans Nolio ; « b », une course secondaire ; null, sans type.
export type CourseNolio = {
  id: string; nom: string; date: string; distance_km: number | null; dplus_m: number | null; dmoins_m: number | null;
  chrono: string | null; type: 'a' | 'b' | null;
};
type Mesure = { value?: number | null } | null | undefined;
type Brute = { id: string; name?: string; date_start: string; duration?: Mesure; distance?: Mesure; elevation_gain?: Mesure;
  elevation_loss?: Mesure; goal_type?: string | null };

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const nombre = (m: Mesure) => (typeof m?.value === 'number' && m.value > 0 ? Math.round(m.value * 10) / 10 : null);
// Sa durée prévue dans Nolio, en chrono visé (« 5h30 »).
const chrono = (m: Mesure) => {
  const s = nombre(m);
  return s ? `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : null;
};
const enCourse = (c: Brute): CourseNolio => ({
  id: c.id, nom: (c.name ?? '').trim() || 'Course', date: c.date_start.slice(0, 10), distance_km: nombre(c.distance),
  dplus_m: nombre(c.elevation_gain), dmoins_m: nombre(c.elevation_loss), chrono: chrono(c.duration),
  type: c.goal_type === 'a' || c.goal_type === 'b' ? c.goal_type : null,
});

// Ses compétitions à venir dans Nolio, de la plus proche à la plus lointaine.
export async function coursesDansNolio(usr: string): Promise<CourseNolio[]> {
  const d = await destinataire(usr);
  const brutes = await listeNolio<Brute>(`planned/competitions/?date_from=${aujourdhui()}${d.moi ? '' : `&athlete=${d.usr}`}`);
  return brutes.map(enCourse).sort((x, y) => x.date.localeCompare(y.date));
}

// Gardées une heure pour « À regarder » : un appel par athlète et par heure, pas à chaque visite de l'espace coach.
export const coursesGardees = unstable_cache(coursesDansNolio, ['courses-nolio'], { revalidate: 3600 });

// Une compétition, pour préremplir Nouvel objectif ou sa course de préparation ; null si Nolio ne la donne pas.
export async function courseNolio(usr: string, id: string): Promise<CourseNolio | null> {
  if (!/^pcmp_[A-Za-z0-9]+$/.test(id)) return null;
  const d = await destinataire(usr);
  const r = await appelNolio('GET', `planned/competitions/${id}/${d.moi ? '' : `?athlete=${d.usr}`}`);
  return r.statut === 200 && r.corps ? enCourse(r.corps as unknown as Brute) : null;
}

// Celles qui ne sont pas encore dans CTS : aucun objectif ni course de préparation à sa date.
export const pasEncoreIci = (courses: CourseNolio[], dates: Set<string>) => courses.filter((c) => !dates.has(c.date));
