/**
 * Le coaching par Nolio, côté serveur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, N1 à N5) : les plans
 * des athlètes coachés, rangés dans le compte du coach ; l'athlète Nolio associé ; l'envoi d'une semaine.
 * Les séances sont traduites par le moteur (POST /v1/nolio/seances), puis créées dans Nolio au nom du coach.
 */
import { API_URL } from '@/lib/plan';
import { ajouterJours, type Jour, type Plan } from './plan';
import { appelNolio } from './nolio';
import { clientService } from './supabase';

export type AthleteCoache = {
  plan_id: string; athlete_nom: string; nolio_athlete_id: number | null; course_nom: string; course_date: string;
};
export type Envoi = { semaine: string; envoye_le: string; seances: { jour_id: string; nolio_id: number | null }[] };

export async function athletesCoaches(coachId: string): Promise<AthleteCoache[]> {
  const { data } = await clientService()
    .from('coaching').select('plan_id, athlete_nom, nolio_athlete_id, plans(course_nom, course_date)')
    .eq('coach_id', coachId).order('cree_le', { ascending: false });
  return (data ?? []).map((l) => {
    const p = (Array.isArray(l.plans) ? l.plans[0] : l.plans) as { course_nom: string; course_date: string } | null;
    return { plan_id: l.plan_id, athlete_nom: l.athlete_nom, nolio_athlete_id: l.nolio_athlete_id,
      course_nom: p?.course_nom ?? '', course_date: p?.course_date ?? '' };
  });
}

// Un athlète coaché du coach : son plan, son athlète Nolio, ses semaines envoyées. null s'il n'est pas à lui.
export async function athleteCoache(coachId: string, planId: string) {
  const service = clientService();
  const { data: c } = await service.from('coaching').select('*').eq('plan_id', planId).eq('coach_id', coachId).maybeSingle();
  if (!c) return null;
  const { data: p } = await service.from('plans').select('donnees, pdf_chemin').eq('id', planId).single();
  const { data: envois } = await service.from('nolio_envois').select('semaine, envoye_le, seances').eq('plan_id', planId);
  return { coaching: c, plan: p?.donnees as Plan, pdf: p?.pdf_chemin as string | null, envois: (envois ?? []) as Envoi[] };
}

// Un identifiant entier stable pour chaque séance envoyée (id_partner de l'API de Nolio).
const idPartenaire = (texte: string) => {
  let h = 0;
  for (const c of texte) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) || 1;
};

// Les séances d'une semaine traduites par le moteur (cts_nolio).
async function seancesDuMoteur(jours: Jour[]) {
  const r = await fetch(`${API_URL}/v1/nolio/seances`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jours }), cache: 'no-store',
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
  const a = await athleteCoache(coachId, planId);
  if (!a) throw new Error('Athlète introuvable');
  if (!a.coaching.nolio_athlete_id) throw new Error('Choisis d’abord son nom dans ta liste Nolio.');
  if (a.envois.some((e) => e.semaine === numero)) throw new Error('Cette semaine est déjà envoyée.');
  const semaine = a.plan.semaines.find((s) => s.numero === numero);
  if (!semaine) throw new Error('Semaine introuvable');
  const seances = (await seancesDuMoteur(semaine.jours)).filter((s) => s.nolio);
  const crees: Envoi['seances'] = [];
  for (const s of seances) {
    const corps: Record<string, unknown> = {
      ...s.nolio, athlete_id: a.coaching.nolio_athlete_id, id_partner: idPartenaire(`${planId}:${s.id}`),
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
