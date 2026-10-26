/**
 * Le suivi des athlètes coachés, côté serveur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T1 à T4, décisions coach
 * du 13/10/2026) : le tableau de bord lit dans Nolio, à son ouverture, les séances prévues et réalisées et l'indice
 * Hooper des seuls athlètes qui ont donné leur accord (T3), et n'en garde rien. Il signale ce qui mérite le regard du
 * coach ; le détail reste dans Nolio. Les seuils viennent du moteur (cts_suivi, /v1/config) : l'app ne fait que
 * comparer (D3).
 */
import { API_URL } from '@/lib/plan';
import { ajouterJours } from './plan';
import { listeNolio } from './nolio';
import { aujourdhuiParis, signaux, type Prevue, type Realisee, type Seuils, type Suivi, type ValeurHooper } from './signauxSuivi';
import { athletesCoaches } from './coaching';
import type { Statut } from './prevision';
import { clientService } from './supabase';

export { aujourdhuiParis, type GenreSignal, type Seuils, type Signal, type Suivi } from './signauxSuivi';

export async function seuilsSuivi(): Promise<Seuils> {
  const r = await fetch(`${API_URL}/v1/config`, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`Moteur /v1/config : ${r.status}`);
  const s = (await r.json()).suivi as Seuils | undefined;
  if (!s) throw new Error('Moteur /v1/config : les seuils du suivi manquent (moteur 8.322 attendu).');
  return s;
}

// L'indice Hooper dans le catalogue des métriques de Nolio (clé INDICEHOOPER), cherché une fois par instance.
let hooperId: Promise<string | null> | null = null;
function indiceHooper(): Promise<string | null> {
  hooperId ??= listeNolio<{ id: string; key?: string }>('metrics/items/')
    .then((items) => items.find((i) => i.key === 'INDICEHOOPER')?.id ?? null)
    .catch(() => {
      hooperId = null;
      return null;
    });
  return hooperId;
}

// Ce que le tableau lit d'un athlète : le strict nécessaire (champs choisis), en mémoire le temps de la page.
export async function lireSuivi(usr: string, moi: boolean, s: Seuils, aujourdhui: string): Promise<Suivi> {
  const qui = moi ? '' : `&athlete=${usr}`;
  const debut = ajouterJours(aujourdhui, -(s.jours - 1));
  const hooper = await indiceHooper();
  const [prevues, realisees, valeurs] = await Promise.all([
    // Les prévues d'une semaine de plus : le RPE prévu d'une séance faite un autre jour que prévu.
    listeNolio<Prevue>(`planned/trainings/?date_from=${ajouterJours(debut, -7)}&date_to=${aujourdhui}&fields=id,name,date_start,rpe,sport${qui}`),
    listeNolio<Realisee>(`real/trainings/?date_from=${debut}&date_to=${aujourdhui}&fields=id,name,date_start,planned,debrief${qui}`),
    hooper
      ? listeNolio<ValeurHooper>(`metrics/values/?item=${hooper}&date_from=${ajouterJours(debut, -(7 * s.hooper_semaines + 3))}&date_to=${aujourdhui}${qui}`)
      : Promise.resolve([] as ValeurHooper[]),
  ]);
  return signaux(prevues, realisees, valeurs, s, aujourdhui);
}

// Les athlètes qui ont donné leur accord (T3) : { usr : date }.
export async function accords(coachId: string): Promise<Map<string, string>> {
  const { data } = await clientService().from('nolio_accords').select('nolio_athlete_id, accord_le').eq('coach_id', coachId);
  return new Map((data ?? []).map((a) => [a.nolio_athlete_id as string, a.accord_le as string]));
}

// Pour « Dimanche, le moteur prévoit » (décision coach du 24/10/2026) : de chaque coaché relié à Nolio, sa fiche, son
// prochain objectif, et si le moteur écrit ses semaines (objectif à venir démarré, programmé automatiquement) ou le coach ;
// sinon, pourquoi pas encore (ni objectif ni saison, ou le départ programmé de son objectif).
export type StatutSuivi = Statut & { fiche: string; objectif: string | null };
export async function statutsDuSuivi(coachId: string): Promise<Map<string, StatutSuivi>> {
  const jour = aujourdhuiParis();
  const fiches = (await athletesCoaches(coachId)).filter((a) => a.nolio_athlete_id && a.mode === 'coaching');
  const prochains = new Map(fiches.map((a) => [a.id, a.objectifs.find((o) => o.course_date >= jour) ?? null]));
  const ids = [...prochains.values()].filter(Boolean).map((o) => o!.plan_id);
  const { data: plans } = ids.length
    ? await clientService().from('plans').select('id, demarre_le, depart_prevu, parametres').in('id', ids)
    : { data: [] };
  const ecrits = new Set((plans ?? []).filter((p) => p.demarre_le && p.parametres).map((p) => p.id as string));
  const departs = new Map((plans ?? []).map((p) => [p.id as string, (p.depart_prevu as string | null) ?? null]));
  return new Map(fiches.map((a) => {
    const o = prochains.get(a.id);
    const ecrit = Boolean(o && ecrits.has(o.plan_id));
    return [a.nolio_athlete_id as string, { fiche: a.id, objectif: o?.course_nom ?? null, aLaMain: a.programmation === 'main',
      ecrit, ...(ecrit ? {} : { pasParti: { objectif: Boolean(o), depart: o ? departs.get(o.plan_id) ?? null : null } }) }];
  }));
}
