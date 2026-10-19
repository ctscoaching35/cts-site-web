/**
 * Le coaching par Nolio, côté serveur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, N1 à N9, V1 à V4) :
 * l'athlète coaché est une fiche qui regroupe ses objectifs successifs (un plan par objectif principal, N9), son
 * athlète Nolio et ses valeurs (N8) ; chaque plan s'envoie dans Nolio semaine par semaine, puis se met à jour (V4).
 * Les séances sont traduites par le moteur (POST /v1/nolio/seances), avec les valeurs de l'athlète, puis créées
 * dans Nolio par l'API v2, avec la clé du coach.
 */
import { API_URL } from '@/lib/plan';
import { lienFicheCourse } from './ficheCourse';
import { ajouterJours, type Plan, type Semaine } from './plan';
import { appelNolio, convertirIdsV1, listeNolio, moiNolio, nolioConfigure, refusNolio } from './nolio';
import { clientService } from './supabase';

export type Objectif = { plan_id: string; course_nom: string; course_date: string };
export type FicheAthlete = {
  id: string; nom: string; nolio_athlete_id: string | null;
  fc_seuil1: number | null; vc_ms: number | null; fc_seuil2: number | null; v_seuil1_ms: number | null;
  objectifs: Objectif[];
  // Son compte dans l'app, quand le coach l'y a invité (T6).
  compte_id: string | null;
};
// Une séance envoyée : son jour du plan, son identifiant Nolio (« ptrn_… » ; un nombre pour un envoi de la v1,
// converti à la visite suivante), sa révision à l'envoi (V4 : une révision changée, le coach l'a retouchée), et
// supprimee quand le coach l'a supprimée dans Nolio (une mise à jour ne la recrée pas). genre : la note « Repos » d'un
// jour de repos (« pnot_… », V6) ou le bandeau de la semaine (« pcyc_… », jour_id « semaine », V7), dont la révision
// est l'empreinte de leur contenu (l'API ne leur en donne pas).
export type Genre = 'seance' | 'note' | 'cycle';
export type SeanceEnvoyee = {
  jour_id: string; nolio_id: string | number | null; revision?: string | null; supprimee?: boolean; genre?: Genre;
};
export type Envoi = { semaine: string; envoye_le: string; seances: SeanceEnvoyee[] };
// Ce que la page montre d'une semaine envoyée : combien de ses séances le coach a retouchées ou supprimées.
export type EtatEnvoi = Envoi & { retouchees: number; supprimees: number };

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
  await convertirAthletesV1(athletes ?? []);
  return (athletes ?? []).map((a) => ({
    id: a.id, nom: a.nom, nolio_athlete_id: a.nolio_athlete_id, fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2,
    v_seuil1_ms: a.v_seuil1_ms ?? null, compte_id: a.compte_id ?? null,
    objectifs: ((lignes ?? []) as LigneCoaching[]).filter((l) => l.athlete_id === a.id).map(objectif)
      .sort((x, y) => x.course_date.localeCompare(y.course_date)),
  }));
}

// Les athlètes associés du temps de la v1 (un numéro) : convertis une fois en « usr_… » et enregistrés.
async function convertirAthletesV1(athletes: { id: string; nolio_athlete_id: string | null }[]) {
  const anciens = athletes.filter((a) => a.nolio_athlete_id && /^\d+$/.test(String(a.nolio_athlete_id)));
  if (!anciens.length || !nolioConfigure()) return;
  try {
    const v2 = await convertirIdsV1('user', anciens.map((a) => String(a.nolio_athlete_id)));
    for (const a of anciens) {
      const id = v2[String(a.nolio_athlete_id)];
      if (!id) continue;
      await clientService().from('athletes_coaches').update({ nolio_athlete_id: id }).eq('id', a.id);
      a.nolio_athlete_id = id;
    }
  } catch (e) {
    console.error('Conversion des athlètes Nolio :', e instanceof Error ? e.message : e);
  }
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
  const { data: p } = await service.from('plans').select('donnees, pdf_chemin, intake').eq('id', planId).single();
  const { data: envois } = await service.from('nolio_envois').select('semaine, envoye_le, seances').eq('plan_id', planId);
  // Le niveau déclaré au questionnaire : le renfo s'y règle (cts_renfo, RF2).
  const niveau = String((p?.intake as Record<string, unknown> | null)?.niveau ?? 'intermediaire');
  return { athlete, plan: p?.donnees as Plan, pdf: p?.pdf_chemin as string | null, envois: (envois ?? []) as Envoi[], niveau };
}

// Les réponses du dernier objectif d'un athlète, pour préremplir le suivant (N9) : tout sauf la course.
export async function questionnairePrerempli(coachId: string, athleteId: string) {
  const athlete = await ficheAthlete(coachId, athleteId);
  const dernier = athlete?.objectifs[athlete.objectifs.length - 1];
  if (!athlete || !dernier) return null;
  const { data } = await clientService().from('plans').select('intake').eq('id', dernier.plan_id).single();
  const charge = await chargeDepuisNolio(coachId, athlete.nolio_athlete_id).catch(() => null);
  return { athlete, initial: { ...reponsesSansLaCourse(data?.intake), nom: athlete.nom, ...(charge ?? {}) }, nolio: Boolean(charge) };
}

// QD4 (décision coach du 19/10/2026) : la charge du moment d'un coaché, lue dans ses séances Nolio avec son accord du
// Suivi, pour préremplir son questionnaire (relue et corrigible) : le volume moyen et la plus longue sortie de course
// des 4 dernières semaines, et un arrêt de plus de 4 semaines sur les 2 derniers mois. null sans accord ; sans course
// ces 4 semaines, seul l'arrêt est rempli (le questionnaire demande alors la dernière sortie régulière).
const SPORTS_COURSE = ['spt_kNYHjuEzDJRiYCX', 'spt_YprHS7jgV5vdsz0'];
const enHeuresMinutes = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
export async function chargeDepuisNolio(coachId: string, usr: string | null): Promise<Record<string, string> | null> {
  if (!usr || !nolioConfigure()) return null;
  const { data: accord } = await clientService().from('nolio_accords').select('accord_le').eq('coach_id', coachId).eq('nolio_athlete_id', usr).maybeSingle();
  if (!accord) return null;
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const du = ajouterJours(aujourdhui, -56);
  const q = (await moiNolio()).id === usr ? '' : `&athlete=${usr}`;
  const reels = await listeNolio<{ id: string; date_start: string; duration?: { value: number } | null; sport?: string | null }>(
    `real/trainings/?date_from=${du}&date_to=${ajouterJours(aujourdhui, -1)}&fields=id,date_start,duration,sport${q}`);
  const course = reels.filter((r) => SPORTS_COURSE.includes(String(r.sport)) && r.duration?.value)
    .map((r) => ({ date: r.date_start.slice(0, 10), min: (r.duration as { value: number }).value / 60 }));
  const recentes = course.filter((r) => r.date >= ajouterJours(aujourdhui, -28));
  const dates = [du, ...course.map((r) => r.date).sort(), aujourdhui];
  const ecarts = dates.slice(1).map((d, i) => (new Date(`${d}T12:00:00Z`).getTime() - new Date(`${dates[i]}T12:00:00Z`).getTime()) / 86_400_000);
  const charge: Record<string, string> = { coupure: ecarts.some((e) => e > 28) ? 'oui' : 'non' };
  if (recentes.length) {
    charge.volume_hebdo_actuel = enHeuresMinutes(recentes.reduce((a, r) => a + r.min, 0) / 4);
    charge.sortie_longue_actuelle = enHeuresMinutes(Math.max(...recentes.map((r) => r.min)));
  }
  return charge;
}

// Les réponses d'un objectif, sans celles de sa course : le point de départ du suivant (N9, OM1).
export function reponsesSansLaCourse(intake: unknown): Record<string, string | string[]> {
  const COURSE = ['format', 'duree_mois', 'course_nom', 'date_course', 'distance_km', 'dplus_m', 'dmoins_m', 'temps_cible', 'coupure'];
  return Object.fromEntries(Object.entries((intake ?? {}) as Record<string, unknown>).filter(([k]) => !COURSE.includes(k))
    .map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : String(v ?? '')]));
}

// Les jours d'une semaine traduits par le moteur (cts_nolio), avec les valeurs de l'athlète (N8) : la séance, ou
// pour un jour de repos la note « Repos » (V6) ; le bandeau de la semaine (V7) ; et les séances de renfo (RF1 à RF4),
// rangées comme des jours de plus (« S6-jeudi:renfo »), leurs exercices montés pour le lecteur Nolio.
type JourTraduit = { id: string; nolio: Record<string, unknown> | null; note: Record<string, unknown> | null };
const SEMAINE = 'semaine';
const RENFO = ':renfo';
export async function seancesDuMoteur(plan: Plan, planId: string, semaine: Semaine, profil: Record<string, number>, niveau: string,
  avecTrame = true) {
  // La place de la semaine dans son bloc : la dose du renfo monte à partir de la troisième.
  const rang = plan.semaines.filter((s) => s.bloc === semaine.bloc).findIndex((s) => s.numero === semaine.numero) + 1;
  // Le calendrier du plan, pour les fiches au bon moment (F1) et la fiche de course (F2).
  const lundiDu = (bloc: string) => plan.semaines.find((s) => s.bloc === bloc)?.lundi ?? null;
  const calendrier = {
    debut: plan.semaines[0]?.lundi ?? null, course: plan.course.date, specifique: lundiDu('Bloc spécifique'),
    affutage: lundiDu('Affûtage'), fiches_du_plan: plan.pour_aller_plus_loin.fiches.map((f) => f.cle),
  };
  const r = await fetch(`${API_URL}/v1/nolio/seances`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ jours: semaine.jours, profil, niveau, calendrier,
      semaine: { type: semaine.type, bloc: semaine.bloc, lundi: semaine.lundi, rang_bloc: rang || 1 } }),
  });
  if (!r.ok) throw new Error(`Moteur /v1/nolio/seances : ${r.status}`);
  const corps = await r.json();
  const jours = (corps.seances ?? []).map((s: JourTraduit) => ({ ...s, note: s.note ?? null })) as JourTraduit[];
  const brut = (corps.renfo ?? []) as { id: string; nolio: Record<string, unknown> }[];
  const renfo = brut.length ? await monterRenfo(brut) : [];
  // Les fiches, des notes de plus (« fiche:pieds ») ; la fiche de course reçoit son lien privé.
  const fiches = ((corps.fiches ?? []) as { id: string; note: Record<string, unknown> }[]).map((f) => ({
    id: f.id, nolio: null,
    note: { ...f.note, description: String(f.note.description ?? '').replace('{lien_fiche_course}', lienFicheCourse(planId)) },
  }));
  // Écriture semaine par semaine (T3) : le bandeau et les fiches de tout le plan partent au départ, avec la trame ;
  // chaque semaine n'envoie plus que ses jours et son renfo.
  if (!avecTrame) return { jours, cycle: null, renfo };
  return { jours, cycle: (corps.cycle ?? null) as Record<string, unknown> | null, renfo: [...renfo, ...fiches] };
}

type Noeud = Record<string, unknown> & { kind: string };

// Les exercices du renfo, nommés par le moteur, remplacés par leur identifiant Nolio : la bibliothèque du coach
// d'abord (ses vidéos), sinon le catalogue de Nolio. Un exercice absent (à filmer) part en étape décrite, sans vidéo.
async function monterRenfo(seances: { id: string; nolio: Record<string, unknown> }[]): Promise<JourTraduit[]> {
  const exercices = await listeNolio<{ id: string; name: string; scope: string }>('library/exercises/');
  const idDe = (nom: string) => (exercices.find((e) => e.name === nom && e.scope === 'perso') ?? exercices.find((e) => e.name === nom))?.id;
  const monter = (n: Noeud): Noeud => {
    if (n.kind === 'superset') return { ...n, exercises: (n.exercises as Noeud[]).map(monter) };
    if (n.kind !== 'exercise') return n;
    const { exercice_nom: nom, ...reste } = n as Noeud & { exercice_nom: string; sets: Record<string, { value: number }>[] };
    const id = idDe(nom);
    if (id) return { ...reste, exercise: id };
    const series = (n.sets as { reps?: number; duration?: { value: number }; rest: { value: number } }[]);
    const duree = series.reduce((t, x) => t + (x.duration?.value ?? (x.reps ?? 0) * 4) + x.rest.value, 0);
    const dose = `${series.length} × ${series[0]?.reps ?? `${series[0]?.duration?.value}″`}`;
    return { kind: 'step', intensity: 'work', duration: { value: duree, unit: 's' }, targets: [{ type: 'no_target' }],
      comment: [`${nom} : ${dose}`, n.comment].filter(Boolean).join(', ') };
  };
  return seances.map((s) => ({ id: s.id, note: null,
    nolio: { ...s.nolio, workout: (s.nolio.workout as Noeud[]).map(monter) } }));
}

// Ce qu'un envoi dans Nolio demande, d'où que vienne le plan : un objectif coaché (son compte coach, sa fiche) ou le
// plan d'un acheteur (écriture semaine par semaine, lib/app/ecriture.ts). avecTrame : le bandeau et les fiches partent
// avec chaque semaine (l'envoi en entier d'avant le 19/10/2026), ou au départ avec la trame (semaine par semaine).
export type Cible = {
  coachId: string; planId: string; plan: Plan; nolioAthlete: string | null; profil: Record<string, number>;
  niveau: string; envois: Envoi[]; avecTrame: boolean;
};

async function cibleCoache(coachId: string, planId: string): Promise<Cible> {
  const o = await objectifCoache(coachId, planId);
  if (!o) throw new Error('Objectif introuvable');
  return { coachId, planId, plan: o.plan, nolioAthlete: o.athlete.nolio_athlete_id, profil: profilDe(o.athlete),
    niveau: o.niveau, envois: o.envois, avecTrame: true };
}

type Destinataire = { usr: string; moi: boolean };

// L'athlète Nolio d'un objectif ; le coach lui-même (« (toi) ») reçoit ses séances sans destinataire et les lit
// sans ?athlete=.
export async function destinataire(nolioAthlete: string | null): Promise<Destinataire> {
  if (!nolioAthlete) throw new Error('Choisis d’abord son nom dans ta liste Nolio, sur sa fiche.');
  if (/^\d+$/.test(nolioAthlete)) throw new Error('Nolio ne retrouve pas cet athlète : choisis à nouveau son nom sur sa fiche.');
  return { usr: nolioAthlete, moi: (await moiNolio()).id === nolioAthlete };
}
const requete = (d: Destinataire) => (d.moi ? '' : `?athlete=${d.usr}`);
const CHEMINS: Record<Genre, string> = { seance: 'planned/trainings/', note: 'planned/notes/', cycle: 'planned/cycles/' };
const genreDe = (s: SeanceEnvoyee): Genre => s.genre ?? 'seance';

export function profilDe(a: Pick<FicheAthlete, 'fc_seuil1' | 'vc_ms' | 'fc_seuil2' | 'v_seuil1_ms'>) {
  return Object.fromEntries(
    (['fc_seuil1', 'vc_ms', 'fc_seuil2', 'v_seuil1_ms'] as const).filter((k) => a[k] !== null).map((k) => [k, Number(a[k])]),
  );
}

// Une note ou un bandeau n'a pas de révision dans l'API : sa version est ce qu'il contient.
const empreinte = (n: Record<string, unknown>) =>
  JSON.stringify([n.name ?? '', n.date_start ?? '', n.date_end ?? null, n.note_type ?? null, String(n.color ?? '').toLowerCase()]);
// Pour les messages au coach : le nom, son article et son accord (« la note retouchée », « le bandeau retouché »).
const NOM: Record<Genre, [string, string, string]> = { seance: ['la', 'séance', 'e'], note: ['la', 'note de repos', 'e'], cycle: ['le', 'bandeau', ''] };

// Créer une séance, une note ou un bandeau dans Nolio ; rend son identifiant et sa version à l'envoi. deja : Nolio
// refuse un second bandeau sur la même période (409), celui que le coach a posé lui-même est gardé.
export async function creer(d: Destinataire, jourId: string, corps: Record<string, unknown>, genre: Genre = 'seance'): Promise<SeanceEnvoyee & { erreur?: string; deja?: boolean }> {
  const r = await appelNolio('POST', CHEMINS[genre], d.moi ? corps : { ...corps, athletes: [d.usr] });
  if (genre === 'cycle' && r.statut === 409) return { jour_id: jourId, nolio_id: null, deja: true };
  if (r.statut !== 201 && r.statut !== 200) return { jour_id: jourId, nolio_id: null, erreur: refusNolio(r, `${NOM[genre][0]} ${NOM[genre][1]} du ${String(corps.date_start)}`) };
  const id = String(r.corps?.id ?? '');
  return genre === 'seance'
    ? { jour_id: jourId, nolio_id: id, revision: (r.corps?.revision as string) ?? null }
    : { jour_id: jourId, nolio_id: id, genre, revision: empreinte(r.corps ?? corps) };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Envoyer une semaine dans Nolio, la première fois : son bandeau (V7), ses séances, et une note « Repos » sur ses jours
// de repos (V6). Rend ce qui est parti, en clair.
export async function envoyerSemaine(coachId: string, planId: string, numero: string) {
  return envoyerSemaineCible(await cibleCoache(coachId, planId), numero);
}

// semaineEcrite : la semaine telle que le moteur l'a écrite le dimanche (écriture semaine par semaine) ; sans elle, celle
// des données du plan.
export async function envoyerSemaineCible(c: Cible, numero: string, semaineEcrite?: Semaine) {
  const { coachId, planId } = c;
  const d = await destinataire(c.nolioAthlete);
  if (c.envois.some((e) => e.semaine === numero)) throw new Error('Cette semaine est déjà envoyée : mets-la à jour.');
  const semaine = semaineEcrite ?? c.plan.semaines.find((s) => s.numero === numero);
  if (!semaine) throw new Error('Semaine introuvable');
  const { jours, cycle, renfo } = await seancesDuMoteur(c.plan, planId, semaine, c.profil, c.niveau, c.avecTrame);
  const crees: SeanceEnvoyee[] = [];
  let bandeau = '';
  if (cycle) {
    const cree = await creer(d, SEMAINE, cycle, 'cycle');
    if (cree.erreur) throw new Error(cree.erreur);
    if (cree.deja) bandeau = ' ; ton bandeau déjà posé sur cette semaine est gardé';
    else {
      crees.push(cree);
      bandeau = ` et le bandeau « ${String(cycle.name)} »`;
    }
  }
  for (const j of [...jours, ...renfo]) {
    const corps = j.nolio ?? j.note;
    if (!corps) continue;
    const cree = await creer(d, j.id, corps, j.nolio ? 'seance' : 'note');
    if (cree.erreur) {
      // Ce qui est déjà créé est gardé, pour que la semaine reste « envoyée » et ne se double pas.
      if (crees.length) await garderEnvoi(coachId, planId, numero, crees);
      throw new Error(cree.erreur);
    }
    crees.push(cree);
  }
  await garderEnvoi(coachId, planId, numero, crees);
  const fiches = crees.filter((c) => c.jour_id.startsWith('fiche:')).length;
  const notes = crees.filter((c) => c.genre === 'note').length - fiches;
  const renfos = crees.filter((c) => c.jour_id.endsWith(RENFO)).length;
  const seances = crees.filter((c) => genreDe(c) === 'seance').length - renfos;
  return `${pluriel(seances, 'séance')}${renfos ? `, ${pluriel(renfos, 'séance')} de renfo` : ''}${notes ? `, ${pluriel(notes, 'note')} de repos` : ''}${fiches ? `, ${pluriel(fiches, 'fiche')}` : ''}${bandeau}`;
}

export async function garderEnvoi(coachId: string, planId: string, numero: string, seances: SeanceEnvoyee[]) {
  const { error } = await clientService().from('nolio_envois').upsert({
    plan_id: planId, semaine: numero, coach_id: coachId, seances, envoye_le: new Date().toISOString(),
  });
  if (error) throw new Error(`nolio_envois : ${error.message}`);
}

// Ce qui est dans Nolio entre deux dates, séances, notes et bandeaux de l'athlète : { identifiant : version } (la
// révision d'une séance, l'empreinte d'une note ou d'un bandeau).
async function versions(d: Destinataire, du: string, au: string): Promise<Map<string, string>> {
  const params = new URLSearchParams({ date_from: du, date_to: au });
  if (!d.moi) params.set('athlete', d.usr);
  const seances = await listeNolio<{ id: string; revision?: string }>(`planned/trainings/?${params}&with_revision=true`);
  const notes = await listeNolio<{ id: string } & Record<string, unknown>>(`planned/notes/?${params}`);
  const cycles = await listeNolio<{ id: string } & Record<string, unknown>>(`planned/cycles/?${params}`);
  return new Map([...seances.map((x) => [x.id, x.revision ?? ''] as [string, string]),
    ...[...notes, ...cycles].map((x) => [x.id, empreinte(x)] as [string, string])]);
}

// Les envois du temps de la v1 (des numéros) : convertis une fois en « ptrn_… » et enregistrés, sans révision.
async function convertirEnvoisV1(planId: string, d: Destinataire, envois: Envoi[]) {
  const anciens = envois.flatMap((e) => e.seances).filter((s) => typeof s.nolio_id === 'number' || /^\d+$/.test(String(s.nolio_id ?? '')));
  if (!anciens.length) return;
  const v2 = await convertirIdsV1('planned.event', anciens.map((s) => String(s.nolio_id)), d.moi ? undefined : d.usr);
  for (const e of envois) {
    let change = false;
    for (const s of e.seances) {
      const id = s.nolio_id === null ? undefined : v2[String(s.nolio_id)];
      if (id) {
        s.nolio_id = id;
        change = true;
      }
    }
    if (change) await clientService().from('nolio_envois').update({ seances: e.seances }).eq('plan_id', planId).eq('semaine', e.semaine);
  }
}

// L'état des semaines envoyées, revu dans Nolio à chaque visite : une semaine dont tout a été supprimé dans Nolio
// redevient envoyable ; sinon, combien le coach en a retouché ou supprimé (V4).
export async function verifierEnvois(planId: string, nolioAthlete: string, plan: Plan, envois: Envoi[]): Promise<EtatEnvoi[]> {
  const sans = envois.map((e) => ({ ...e, retouchees: 0, supprimees: 0 }));
  const lundis = envois.map((e) => plan.semaines.find((s) => s.numero === e.semaine)?.lundi).filter((x): x is string => Boolean(x)).sort();
  if (!lundis.length || !nolioConfigure()) return sans;
  try {
    const d = await destinataire(nolioAthlete);
    await convertirEnvoisV1(planId, d, envois);
    const dansNolio = await versions(d, ajouterJours(lundis[0], -1), ajouterJours(lundis[lundis.length - 1], 7));
    const etats: EtatEnvoi[] = [];
    for (const e of envois) {
      // Seules les semaines se revoient : la trame, les questionnaires (que `versions` ne lit pas), les courses et les
      // notes de bilan gardent leur ligne, qui sert à les retrouver dans Nolio (défaut vu le 19/10/2026, essai sur
      // « (toi) » : chaque visite effaçait celle des questionnaires).
      if (!plan.semaines.some((s) => s.numero === e.semaine)) {
        etats.push({ ...e, retouchees: 0, supprimees: 0 });
        continue;
      }
      const envoyees = e.seances.filter((s) => s.nolio_id !== null);
      const presentes = envoyees.filter((s) => !s.supprimee && dansNolio.has(String(s.nolio_id)));
      if (envoyees.length && !presentes.length) {
        await clientService().from('nolio_envois').delete().eq('plan_id', planId).eq('semaine', e.semaine);
        continue;
      }
      etats.push({
        ...e, supprimees: envoyees.length - presentes.length,
        retouchees: presentes.filter((s) => !s.revision || dansNolio.get(String(s.nolio_id)) !== s.revision).length,
      });
    }
    return etats;
  } catch (e) {
    console.error('Vérification Nolio :', e instanceof Error ? e.message : e);
    return sans;
  }
}

export type BilanMiseAJour = {
  remplacees: number; ajoutees: number; retirees: number; notes: number; bandeau: string | null; gardees: string[];
};

// Ce que l'app réécrit d'une séance (tous les champs qu'elle pose, pour que rien de l'ancienne version ne reste),
// d'une note ou d'un bandeau.
function corpsPatch(corps: Record<string, unknown>, genre: Genre) {
  if (genre === 'note') {
    const { name, date_start, note_type, color, description } = corps;
    return { name, date_start, note_type: note_type ?? null, color: color ?? null, description: description ?? '' };
  }
  if (genre === 'cycle') {
    const { name, date_start, date_end, color } = corps;
    return { name, date_start, date_end, color: color ?? null };
  }
  const { sport, name, date_start, duration, rpe, show_rpe, color, description, workout } = corps;
  return { sport, name, date_start, duration: duration ?? null, rpe: rpe ?? null, show_rpe: show_rpe ?? false,
    color: color ?? null, description: description ?? '', workout: workout ?? null };
}

// V4 (décision coach du 13/10/2026) : mettre à jour une semaine envoyée. Ce que le coach n'a pas touché dans Nolio
// (même version qu'à l'envoi) est remplacé, ce que la semaine n'a plus est supprimé, le nouveau créé ; ce qu'il a
// retouché ou supprimé dans Nolio reste tel quel, et lui est dit. Les notes de repos (V6) et le bandeau (V7) suivent
// la même règle.
export async function mettreAJourSemaine(coachId: string, planId: string, numero: string): Promise<BilanMiseAJour> {
  return mettreAJourSemaineCible(await cibleCoache(coachId, planId), numero);
}

export async function mettreAJourSemaineCible(c: Cible, numero: string, semaineEcrite?: Semaine): Promise<BilanMiseAJour> {
  const { coachId, planId } = c;
  const d = await destinataire(c.nolioAthlete);
  const envoi = c.envois.find((e) => e.semaine === numero);
  const semaine = semaineEcrite ?? c.plan.semaines.find((s) => s.numero === numero);
  if (!envoi || !semaine?.lundi) throw new Error('Cette semaine n’est pas encore envoyée.');
  await convertirEnvoisV1(planId, d, [envoi]);
  const dansNolio = await versions(d, ajouterJours(semaine.lundi, -1), ajouterJours(semaine.lundi, 7));
  const { jours, cycle, renfo } = await seancesDuMoteur(c.plan, planId, semaine, c.profil, c.niveau, c.avecTrame);
  const date = (jourId: string) => {
    if (jourId === SEMAINE) return 'la semaine';
    const jour = semaine.jours.find((j) => j.id === jourId.replace(RENFO, ''))?.date ?? jourId;
    return jourId.endsWith(RENFO) ? `${jour}, renfo` : jour;
  };
  const bilan: BilanMiseAJour = { remplacees: 0, ajoutees: 0, retirees: 0, notes: 0, bandeau: null, gardees: [] };
  const garde: SeanceEnvoyee[] = [];
  const parJour = new Map(envoi.seances.map((s) => [s.jour_id, s]));
  const echec = async (message: string) => {
    await garderEnvoi(coachId, planId, numero, [...garde, ...parJour.values()]);
    return new Error(message);
  };
  const ajouter = async (j: JourTraduit) => {
    const genre: Genre = j.id === SEMAINE ? 'cycle' : j.nolio ? 'seance' : 'note';
    const corps = genre === 'cycle' ? cycle : j.nolio ?? j.note;
    if (!corps) return;
    const cree = await creer(d, j.id, corps, genre);
    if (cree.erreur) throw await echec(cree.erreur);
    if (cree.deja) {
      bilan.gardees.push('ton bandeau déjà posé sur la semaine');
      return;
    }
    garde.push(cree);
    if (genre === 'seance') bilan.ajoutees += 1;
    else if (genre === 'note' && !j.id.startsWith('fiche:')) bilan.notes += 1;
    else bilan.bandeau = String(corps.name);
  };
  // Le bandeau d'abord, comme un jour de plus (« semaine ») ; le renfo après les jours ; puis ce que la semaine n'a
  // plus (une séance de renfo déplacée, par exemple) : supprimé de Nolio s'il n'a pas été touché.
  const voulus: JourTraduit[] = [...(c.avecTrame ? [{ id: SEMAINE, nolio: null, note: null }] : []), ...jours, ...renfo];
  const restes = [...parJour.keys()].filter((k) => !voulus.some((v) => v.id === k)).map((id) => ({ id, nolio: null, note: null }));
  for (const j of [...voulus, ...restes]) {
    const ancienne = parJour.get(j.id);
    parJour.delete(j.id);
    if (!ancienne?.nolio_id) {
      await ajouter(j);
      continue;
    }
    const id = String(ancienne.nolio_id);
    const genre = genreDe(ancienne);
    const [article, quoi, e] = NOM[genre];
    const version = dansNolio.get(id);
    if (ancienne.supprimee || version === undefined) {
      garde.push({ ...ancienne, supprimee: true });
      bilan.gardees.push(`${date(j.id)} (${quoi} supprimé${e} dans Nolio)`);
      continue;
    }
    if (!ancienne.revision || version !== ancienne.revision) {
      garde.push(ancienne);
      bilan.gardees.push(`${date(j.id)} (${quoi} retouché${e} dans Nolio)`);
      continue;
    }
    const voulu = genre === 'cycle' ? cycle : genre === 'note' ? j.note : j.nolio;
    if (voulu) {
      // Même nature qu'à l'envoi : réécrite. If-Match sur une séance : refusée (409) si le coach l'a retouchée
      // entre la lecture et l'écriture.
      const r = await appelNolio('PATCH', `${CHEMINS[genre]}${id}/${requete(d)}`, corpsPatch(voulu, genre), genre === 'seance' ? { 'If-Match': version } : {});
      if (r.statut === 409) {
        garde.push(ancienne);
        bilan.gardees.push(`${date(j.id)} (${quoi} retouché${e} dans Nolio)`);
        continue;
      }
      if (r.statut !== 200) {
        garde.push(ancienne);
        throw await echec(refusNolio(r, `la mise à jour de ${article} ${quoi} du ${date(j.id)}`));
      }
      garde.push(genre === 'seance' ? { jour_id: j.id, nolio_id: id, revision: (r.corps?.revision as string) ?? null }
        : { jour_id: j.id, nolio_id: id, genre, revision: empreinte(r.corps ?? voulu) });
      if (genre === 'seance') bilan.remplacees += 1;
      continue;
    }
    // Le jour a changé de nature (une séance devenue repos, ou l'inverse) : l'ancienne part, la nouvelle arrive.
    const r = await appelNolio('DELETE', `${CHEMINS[genre]}${id}/${requete(d)}`);
    if (r.statut !== 204 && r.statut !== 200 && r.statut !== 404) {
      garde.push(ancienne);
      throw await echec(refusNolio(r, `le retrait de ${article} ${quoi} du ${date(j.id)}`));
    }
    if (genre === 'seance') bilan.retirees += 1;
    await ajouter(j);
  }
  // Chaque entrée de l'envoi est passée dans la boucle (les restes compris) : il ne reste rien à reporter.
  garde.push(...parJour.values());
  await garderEnvoi(coachId, planId, numero, garde);
  return bilan;
}
