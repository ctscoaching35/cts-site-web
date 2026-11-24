/**
 * CE QUE LE MOTEUR v1 LIT DE CE QU'IL COURT AU DÉPART : le seul lecteur (entrée 203, décision du coach du 24/11/2026). Côté serveur.
 */
import { fenetreDuDepart, luAuDepart, type LuAuDepart } from './charge';
import { listeNolio, moiNolio, nolioConfigure, sansVitesseImpossible, SPORTS_COURSE } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

// Il sert le premier passage d'un plan sans état et, avec lui, le départ d'un objectif (lib/app/passagesV9.ts), et servira la saison de fond sous la 9.x ; pour elles il remplace le
// calcul de chargeDepuisNolio (lib/app/coaching.ts), qui reste celui de la 8.x. `lundi` : le lundi de la semaine que le moteur va écrire ; les semaines lues sont les 8 complètes
// qui le précèdent (le calcul est dans lib/app/charge.ts, luAuDepart). Rend null sans Nolio relié, sans accord de lecture, ou sans aucune course, trail ni tapis lu : le moteur
// garde alors le déclaré. Une lecture de Nolio qui échoue REMONTE : jamais un `lu` calculé sans le calendrier des courses (une course comptée comme une sortie de charge ferait
// partir trop haut) ; l'appelant réessaie au passage suivant.
// Un coaché relié à Nolio, avec son accord de lecture : la seule lecture de ce qu'il court au départ.
async function lisible(coachId: string, usr: string | null): Promise<boolean> {
  if (!usr || !nolioConfigure()) return false;
  const { data: accord } = await clientService().from('nolio_accords').select('accord_le').eq('coach_id', coachId).eq('nolio_athlete_id', usr).maybeSingle();
  return Boolean(accord);
}

export async function lireLuAuDepart(coachId: string, usr: string | null, lundi: string): Promise<LuAuDepart | null> {
  if (!(await lisible(coachId, usr))) return null;
  const { debut, fin } = fenetreDuDepart(lundi);
  const dernier = ajouterJours(fin, -1);
  const q = (await moiNolio()).id === usr ? '' : `&athlete=${usr}`;
  const competitions = (await listeNolio<{ id: string; date_start: string }>(`planned/competitions/?date_from=${debut}&date_to=${dernier}&fields=id,date_start${q}`))
    .map((c) => c.date_start.slice(0, 10));
  type Reel = { id: string; date_start: string; duration?: { value?: number } | null; sport?: string | null; distance?: { value?: number; unit?: string } | number | null };
  const reels = (await listeNolio<Reel>(`real/trainings/?date_from=${debut}&date_to=${dernier}&fields=id,date_start,duration,distance,sport${q}`)).map(sansVitesseImpossible);
  const activites = reels.filter((r) => SPORTS_COURSE.includes(String(r.sport)) && r.duration?.value)
    .map((r) => ({ date: r.date_start.slice(0, 10), min: (r.duration as { value: number }).value / 60 }));
  return luAuDepart(lundi, activites, competitions);
}

// LA DURÉE COURUE DE LA COURSE D'AVANT (moteur v1, 24/11/2026) : `course_precedente.duree_h` est la durée que l'athlète a COURUE, pas son temps visé ; lue dans Nolio, sur
// l'activité de course, trail ou tapis du jour de la course (la plus longue de ce jour : l'échauffement et la course). Une course abandonnée compte comme courue. En heures, au
// centième (6,5). null : pas de Nolio relié ni d'accord, aucune activité ce jour-là, ou durée illisible ; l'appelant garde alors le temps visé. Une lecture qui échoue remonte.
export async function lireLaDureeCourue(coachId: string, usr: string | null, jour: string): Promise<number | null> {
  if (!(await lisible(coachId, usr))) return null;
  const q = (await moiNolio()).id === usr ? '' : `&athlete=${usr}`;
  type Reel = { id: string; date_start: string; duration?: { value?: number } | null; sport?: string | null; distance?: { value?: number; unit?: string } | number | null };
  const reels = (await listeNolio<Reel>(`real/trainings/?date_from=${jour}&date_to=${jour}&fields=id,date_start,duration,distance,sport${q}`)).map(sansVitesseImpossible);
  const secondes = Math.max(0, ...reels.filter((r) => SPORTS_COURSE.includes(String(r.sport)) && r.date_start.slice(0, 10) === jour)
    .map((r) => r.duration?.value ?? 0));
  return secondes > 0 ? Math.round((secondes / 3600) * 100) / 100 : null;
}
