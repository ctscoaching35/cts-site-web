/**
 * Le coaching par Nolio, côté serveur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, N1 à N9) : l'athlète
 * coaché est une fiche qui regroupe ses objectifs successifs (un plan par objectif principal, N9), son nom Nolio
 * et ses valeurs (N8) ; chaque plan s'envoie dans Nolio semaine par semaine (N4). Les séances sont traduites par
 * le moteur (POST /v1/nolio/seances), avec les valeurs de l'athlète, puis créées dans Nolio au nom du coach.
 */
import { API_URL } from '@/lib/plan';
import { ajouterJours, type Jour, type Plan } from './plan';
import { appelNolio } from './nolio';
import { clientService } from './supabase';

export type Objectif = { plan_id: string; course_nom: string; course_date: string };
export type FicheAthlete = {
  id: string; nom: string; nolio_athlete_id: number | null;
  fc_seuil1: number | null; vc_ms: number | null; fc_seuil2: number | null;
  objectifs: Objectif[];
};
export type Envoi = { semaine: string; envoye_le: string; seances: { jour_id: string; nolio_id: number | null }[] };

type LigneCoaching = { plan_id: string; athlete_id: string; plans: unknown };
const objectif = (l: LigneCoaching): Objectif => {
  const p = (Array.isArray(l.plans) ? l.plans[0] : l.plans) as { course_nom: string; course_date: string } | null;
  return { plan_id: l.plan_id, course_nom: p?.course_nom ?? '', course_date: p?.course_date ?? '' };
};

// Les athlètes du coach, chacun avec ses objectifs, du plus proche au plus lointain.
export async function athletesCoaches(coachId: string): Promise<FicheAthlete[]> {
  const service = clientService();
  const { data: athletes } = await service.from('athletes_coaches').select('*').eq('coach_id', coachId).order('nom');
  const { data: lignes } = await service.from('coaching').select('plan_id, athlete_id, plans(course_nom, course_date)')
    .eq('coach_id', coachId);
  return (athletes ?? []).map((a) => ({
    id: a.id, nom: a.nom, nolio_athlete_id: a.nolio_athlete_id, fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2,
    objectifs: ((lignes ?? []) as LigneCoaching[]).filter((l) => l.athlete_id === a.id).map(objectif)
      .sort((x, y) => x.course_date.localeCompare(y.course_date)),
  }));
}

export async function ficheAthlete(coachId: string, athleteId: string): Promise<FicheAthlete | null> {
  return (await athletesCoaches(coachId)).find((a) => a.id === athleteId) ?? null;
}

// Un objectif du coach : son plan, sa fiche d'athlète, ses semaines envoyées. null s'il n'est pas à lui.
export async function objectifCoache(coachId: string, planId: string) {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('plan_id, athlete_id').eq('plan_id', planId).eq('coach_id', coachId).maybeSingle();
  if (!c?.athlete_id) return null;
  const athlete = await ficheAthlete(coachId, c.athlete_id);
  if (!athlete) return null;
  const { data: p } = await service.from('plans').select('donnees, pdf_chemin').eq('id', planId).single();
  const { data: envois } = await service.from('nolio_envois').select('semaine, envoye_le, seances').eq('plan_id', planId);
  return { athlete, plan: p?.donnees as Plan, pdf: p?.pdf_chemin as string | null, envois: (envois ?? []) as Envoi[] };
}

// Les réponses du dernier objectif d'un athlète, pour préremplir le suivant (N9) : tout sauf la course.
export async function questionnairePrerempli(coachId: string, athleteId: string) {
  const athlete = await ficheAthlete(coachId, athleteId);
  const dernier = athlete?.objectifs[athlete.objectifs.length - 1];
  if (!athlete || !dernier) return null;
  const { data } = await clientService().from('plans').select('intake').eq('id', dernier.plan_id).single();
  const intake = (data?.intake ?? {}) as Record<string, unknown>;
  const COURSE = ['format', 'duree_mois', 'course_nom', 'date_course', 'distance_km', 'dplus_m', 'dmoins_m', 'temps_cible', 'coupure'];
  const garde = Object.fromEntries(Object.entries(intake).filter(([k]) => !COURSE.includes(k))
    .map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : String(v ?? '')]));
  return { athlete, initial: { ...garde, nom: athlete.nom } as Record<string, string | string[]> };
}

// Un identifiant entier stable pour chaque séance envoyée (id_partner de l'API de Nolio).
const idPartenaire = (texte: string) => {
  let h = 0;
  for (const c of texte) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) || 1;
};

// Les séances d'une semaine traduites par le moteur (cts_nolio), avec les valeurs de l'athlète (N8).
async function seancesDuMoteur(jours: Jour[], profil: Record<string, number>) {
  const r = await fetch(`${API_URL}/v1/nolio/seances`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jours, profil }), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Moteur /v1/nolio/seances : ${r.status}`);
  return ((await r.json()).seances ?? []) as { id: string; nolio: Record<string, unknown> | null }[];
}

// N7 : le moteur met le RPE de chaque étape en cible. Si Nolio refuse cette cible (sa documentation hésite), la
// séance repart avec le RPE en simple champ de l'étape, sans cible.
type Etape = Record<string, unknown> & { type?: string; steps?: Etape[] };
const sansCibleRpe = (etapes: Etape[]): Etape[] =>
  etapes.map((e) => {
    if (e.type === 'repetition') return { ...e, steps: sansCibleRpe(e.steps ?? []) };
    if (e.target_type !== 'rpe') return e;
    const { target_value_min: _min, target_value_max: _max, ...reste } = e;
    return { ...reste, target_type: 'no_target' };
  });

// Envoyer une semaine dans Nolio (N4 : une seule fois tant que ses séances existent). Rend le nombre de séances.
export async function envoyerSemaine(coachId: string, planId: string, numero: string) {
  const o = await objectifCoache(coachId, planId);
  if (!o) throw new Error('Objectif introuvable');
  if (!o.athlete.nolio_athlete_id) throw new Error('Choisis d’abord son nom dans ta liste Nolio, sur sa fiche.');
  if (o.envois.some((e) => e.semaine === numero)) throw new Error('Cette semaine est déjà envoyée.');
  const semaine = o.plan.semaines.find((s) => s.numero === numero);
  if (!semaine) throw new Error('Semaine introuvable');
  const profil = Object.fromEntries(
    (['fc_seuil1', 'vc_ms', 'fc_seuil2'] as const).filter((k) => o.athlete[k] !== null).map((k) => [k, Number(o.athlete[k])]),
  );
  const seances = (await seancesDuMoteur(semaine.jours, profil)).filter((s) => s.nolio);
  const crees: Envoi['seances'] = [];
  for (const s of seances) {
    const corps: Record<string, unknown> = {
      ...s.nolio, athlete_id: o.athlete.nolio_athlete_id, id_partner: idPartenaire(`${planId}:${s.id}`),
    };
    const creer = (c: Record<string, unknown>) => appelNolio(coachId, '/create/planned/training/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
    });
    let r = await creer(corps);
    if (!r.ok && r.status < 500 && Array.isArray(corps.structured_workout)) {
      console.error(`Nolio refuse la cible RPE (${r.status}) : nouvel essai sans cible.`);
      r = await creer({ ...corps, structured_workout: sansCibleRpe(corps.structured_workout as Etape[]) });
    }
    if (!r.ok) {
      // Ce qui est déjà créé est gardé, pour que la semaine reste « envoyée » et ne se double pas.
      if (crees.length) await garderEnvoi(coachId, planId, numero, crees);
      throw new Error(`Nolio a refusé la séance du ${String(s.nolio?.date_start)} (${r.status}).`);
    }
    const cree = await r.json().catch(() => ({}));
    crees.push({ jour_id: s.id, nolio_id: Number(cree?.nolio_id ?? cree?.id) || null });
  }
  await garderEnvoi(coachId, planId, numero, crees);
  return crees.length;
}

async function garderEnvoi(coachId: string, planId: string, numero: string, seances: Envoi['seances']) {
  const { error } = await clientService().from('nolio_envois').upsert({ plan_id: planId, semaine: numero, coach_id: coachId, seances });
  if (error) throw new Error(`nolio_envois : ${error.message}`);
}

// N4 : une semaine envoyée dont aucune séance n'existe plus dans Nolio redevient envoyable.
export async function verifierEnvois(coachId: string, planId: string, nolioAthlete: number, plan: Plan, envois: Envoi[]) {
  const restants: Envoi[] = [];
  for (const e of envois) {
    const semaine = plan.semaines.find((s) => s.numero === e.semaine);
    const ids = e.seances.map((s) => s.nolio_id).filter((x): x is number => x !== null);
    if (!semaine?.lundi || ids.length === 0) {
      restants.push(e);
      continue;
    }
    const params = new URLSearchParams({
      athlete_id: String(nolioAthlete), from: ajouterJours(semaine.lundi, -1), to: ajouterJours(semaine.lundi, 7), limit: '100',
    });
    const r = await appelNolio(coachId, `/get/planned/training/?${params}`);
    if (!r.ok) {
      restants.push(e);
      continue;
    }
    const presents = new Set(((await r.json()) as { nolio_id: number }[]).map((x) => x.nolio_id));
    if (ids.some((id) => presents.has(id))) restants.push(e);
    else await clientService().from('nolio_envois').delete().eq('plan_id', planId).eq('semaine', e.semaine);
  }
  return restants;
}
