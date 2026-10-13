/**
 * Le coaching par Nolio, côté serveur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, N1 à N9, V1 à V4) :
 * l'athlète coaché est une fiche qui regroupe ses objectifs successifs (un plan par objectif principal, N9), son
 * athlète Nolio et ses valeurs (N8) ; chaque plan s'envoie dans Nolio semaine par semaine, puis se met à jour (V4).
 * Les séances sont traduites par le moteur (POST /v1/nolio/seances), avec les valeurs de l'athlète, puis créées
 * dans Nolio par l'API v2, avec la clé du coach.
 */
import { API_URL } from '@/lib/plan';
import { ajouterJours, type Jour, type Plan } from './plan';
import { appelNolio, convertirIdsV1, listeNolio, moiNolio, nolioConfigure, refusNolio } from './nolio';
import { clientService } from './supabase';

export type Objectif = { plan_id: string; course_nom: string; course_date: string };
export type FicheAthlete = {
  id: string; nom: string; nolio_athlete_id: string | null;
  fc_seuil1: number | null; vc_ms: number | null; fc_seuil2: number | null; v_seuil1_ms: number | null;
  objectifs: Objectif[];
};
// Une séance envoyée : son jour du plan, son identifiant Nolio (« ptrn_… » ; un nombre pour un envoi de la v1,
// converti à la visite suivante), sa révision à l'envoi (V4 : une révision changée, le coach l'a retouchée), et
// supprimee quand le coach l'a supprimée dans Nolio (une mise à jour ne la recrée pas). note : la note « Repos » d'un
// jour de repos (« pnot_… », V6), dont la révision est l'empreinte de son contenu.
export type SeanceEnvoyee = {
  jour_id: string; nolio_id: string | number | null; revision?: string | null; supprimee?: boolean; note?: boolean;
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
    v_seuil1_ms: a.v_seuil1_ms ?? null,
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

// Les jours d'une semaine traduits par le moteur (cts_nolio), avec les valeurs de l'athlète (N8) : la séance, ou
// pour un jour de repos la note « Repos » (V6).
type JourTraduit = { id: string; nolio: Record<string, unknown> | null; note: Record<string, unknown> | null };
async function seancesDuMoteur(jours: Jour[], profil: Record<string, number>) {
  const r = await fetch(`${API_URL}/v1/nolio/seances`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jours, profil }), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Moteur /v1/nolio/seances : ${r.status}`);
  return ((await r.json()).seances ?? []).map((s: JourTraduit) => ({ ...s, note: s.note ?? null })) as JourTraduit[];
}

type Destinataire = { usr: string; moi: boolean };

// L'athlète Nolio d'un objectif ; le coach lui-même (« (toi) ») reçoit ses séances sans destinataire et les lit
// sans ?athlete=.
async function destinataire(nolioAthlete: string | null): Promise<Destinataire> {
  if (!nolioAthlete) throw new Error('Choisis d’abord son nom dans ta liste Nolio, sur sa fiche.');
  if (/^\d+$/.test(nolioAthlete)) throw new Error('Nolio ne retrouve pas cet athlète : choisis à nouveau son nom sur sa fiche.');
  return { usr: nolioAthlete, moi: (await moiNolio()).id === nolioAthlete };
}
const requete = (d: Destinataire) => (d.moi ? '' : `?athlete=${d.usr}`);
const chemin = (note: boolean) => (note ? 'planned/notes/' : 'planned/trainings/');

function profilDe(a: FicheAthlete) {
  return Object.fromEntries(
    (['fc_seuil1', 'vc_ms', 'fc_seuil2', 'v_seuil1_ms'] as const).filter((k) => a[k] !== null).map((k) => [k, Number(a[k])]),
  );
}

// Une note n'a pas de révision dans l'API : sa version est ce qu'elle contient (nom, jour, type, couleur).
const empreinte = (n: Record<string, unknown>) =>
  JSON.stringify([n.name ?? '', n.date_start ?? '', n.note_type ?? null, String(n.color ?? '').toLowerCase()]);

// Créer une séance ou une note dans Nolio ; rend son identifiant et sa version à l'envoi.
async function creer(d: Destinataire, jourId: string, corps: Record<string, unknown>, note = false): Promise<SeanceEnvoyee & { erreur?: string }> {
  const r = await appelNolio('POST', chemin(note), d.moi ? corps : { ...corps, athletes: [d.usr] });
  const quoi = note ? `la note de repos du ${String(corps.date_start)}` : `la séance du ${String(corps.date_start)}`;
  if (r.statut !== 201 && r.statut !== 200) return { jour_id: jourId, nolio_id: null, erreur: refusNolio(r, quoi) };
  const id = String(r.corps?.id ?? '');
  return note
    ? { jour_id: jourId, nolio_id: id, note: true, revision: empreinte(r.corps ?? corps) }
    : { jour_id: jourId, nolio_id: id, revision: (r.corps?.revision as string) ?? null };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Envoyer une semaine dans Nolio, la première fois : ses séances, et une note « Repos » sur ses jours de repos (V6).
// Rend ce qui est parti, en clair.
export async function envoyerSemaine(coachId: string, planId: string, numero: string) {
  const o = await objectifCoache(coachId, planId);
  if (!o) throw new Error('Objectif introuvable');
  const d = await destinataire(o.athlete.nolio_athlete_id);
  if (o.envois.some((e) => e.semaine === numero)) throw new Error('Cette semaine est déjà envoyée : mets-la à jour.');
  const semaine = o.plan.semaines.find((s) => s.numero === numero);
  if (!semaine) throw new Error('Semaine introuvable');
  const jours = await seancesDuMoteur(semaine.jours, profilDe(o.athlete));
  const crees: SeanceEnvoyee[] = [];
  for (const j of jours) {
    const corps = j.nolio ?? j.note;
    if (!corps) continue;
    const cree = await creer(d, j.id, corps, !j.nolio);
    if (cree.erreur) {
      // Ce qui est déjà créé est gardé, pour que la semaine reste « envoyée » et ne se double pas.
      if (crees.length) await garderEnvoi(coachId, planId, numero, crees);
      throw new Error(cree.erreur);
    }
    crees.push(cree);
  }
  await garderEnvoi(coachId, planId, numero, crees);
  const notes = crees.filter((c) => c.note).length;
  return `${pluriel(crees.length - notes, 'séance')}${notes ? ` et ${pluriel(notes, 'note')} de repos` : ''}`;
}

async function garderEnvoi(coachId: string, planId: string, numero: string, seances: SeanceEnvoyee[]) {
  const { error } = await clientService().from('nolio_envois').upsert({
    plan_id: planId, semaine: numero, coach_id: coachId, seances, envoye_le: new Date().toISOString(),
  });
  if (error) throw new Error(`nolio_envois : ${error.message}`);
}

// Ce qui est dans Nolio entre deux dates, séances et notes de l'athlète : { identifiant : version } (la révision
// d'une séance, l'empreinte d'une note).
async function versions(d: Destinataire, du: string, au: string): Promise<Map<string, string>> {
  const params = new URLSearchParams({ date_from: du, date_to: au });
  if (!d.moi) params.set('athlete', d.usr);
  const seances = await listeNolio<{ id: string; revision?: string }>(`planned/trainings/?${params}&with_revision=true`);
  const notes = await listeNolio<{ id: string } & Record<string, unknown>>(`planned/notes/?${params}`);
  return new Map([...seances.map((x) => [x.id, x.revision ?? ''] as [string, string]), ...notes.map((x) => [x.id, empreinte(x)] as [string, string])]);
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

export type BilanMiseAJour = { remplacees: number; ajoutees: number; retirees: number; notes: number; gardees: string[] };

// Ce que l'app réécrit d'une séance (tous les champs qu'elle pose, pour que rien de l'ancienne version ne reste),
// ou d'une note.
function corpsPatch(corps: Record<string, unknown>, note: boolean) {
  if (note) {
    const { name, date_start, note_type, color } = corps;
    return { name, date_start, note_type: note_type ?? null, color: color ?? null };
  }
  const { sport, name, date_start, duration, rpe, show_rpe, color, description, workout } = corps;
  return { sport, name, date_start, duration: duration ?? null, rpe: rpe ?? null, show_rpe: show_rpe ?? false,
    color: color ?? null, description: description ?? '', workout: workout ?? null };
}

// V4 (décision coach du 13/10/2026) : mettre à jour une semaine envoyée. Ce que le coach n'a pas touché dans Nolio
// (même version qu'à l'envoi) est remplacé, ce que la semaine n'a plus est supprimé, le nouveau créé ; ce qu'il a
// retouché ou supprimé dans Nolio reste tel quel, et lui est dit. Les notes de repos (V6) suivent la même règle.
export async function mettreAJourSemaine(coachId: string, planId: string, numero: string): Promise<BilanMiseAJour> {
  const o = await objectifCoache(coachId, planId);
  if (!o) throw new Error('Objectif introuvable');
  const d = await destinataire(o.athlete.nolio_athlete_id);
  const envoi = o.envois.find((e) => e.semaine === numero);
  const semaine = o.plan.semaines.find((s) => s.numero === numero);
  if (!envoi || !semaine?.lundi) throw new Error('Cette semaine n’est pas encore envoyée.');
  await convertirEnvoisV1(planId, d, [envoi]);
  const dansNolio = await versions(d, ajouterJours(semaine.lundi, -1), ajouterJours(semaine.lundi, 7));
  const jours = await seancesDuMoteur(semaine.jours, profilDe(o.athlete));
  const date = (jourId: string) => semaine.jours.find((j) => j.id === jourId)?.date ?? jourId;
  const bilan: BilanMiseAJour = { remplacees: 0, ajoutees: 0, retirees: 0, notes: 0, gardees: [] };
  const garde: SeanceEnvoyee[] = [];
  const parJour = new Map(envoi.seances.map((s) => [s.jour_id, s]));
  const echec = async (message: string) => {
    await garderEnvoi(coachId, planId, numero, [...garde, ...parJour.values()]);
    return new Error(message);
  };
  const ajouter = async (j: JourTraduit) => {
    const corps = j.nolio ?? j.note;
    if (!corps) return;
    const cree = await creer(d, j.id, corps, !j.nolio);
    if (cree.erreur) throw await echec(cree.erreur);
    garde.push(cree);
    if (j.nolio) bilan.ajoutees += 1;
    else bilan.notes += 1;
  };
  for (const j of jours) {
    const ancienne = parJour.get(j.id);
    parJour.delete(j.id);
    if (!ancienne?.nolio_id) {
      await ajouter(j);
      continue;
    }
    const id = String(ancienne.nolio_id);
    const note = Boolean(ancienne.note);
    const quoi = note ? 'note de repos' : 'séance';
    const version = dansNolio.get(id);
    if (ancienne.supprimee || version === undefined) {
      garde.push({ ...ancienne, supprimee: true });
      bilan.gardees.push(`${date(j.id)} (${quoi} supprimée dans Nolio)`);
      continue;
    }
    if (!ancienne.revision || version !== ancienne.revision) {
      garde.push(ancienne);
      bilan.gardees.push(`${date(j.id)} (${quoi} retouchée dans Nolio)`);
      continue;
    }
    const voulu = note ? j.note : j.nolio;
    if (voulu) {
      // Même nature qu'à l'envoi : réécrite. If-Match sur une séance : refusée (409) si le coach l'a retouchée
      // entre la lecture et l'écriture.
      const r = await appelNolio('PATCH', `${chemin(note)}${id}/${requete(d)}`, corpsPatch(voulu, note), note ? {} : { 'If-Match': version });
      if (r.statut === 409) {
        garde.push(ancienne);
        bilan.gardees.push(`${date(j.id)} (${quoi} retouchée dans Nolio)`);
        continue;
      }
      if (r.statut !== 200) {
        garde.push(ancienne);
        throw await echec(refusNolio(r, `la mise à jour de la ${quoi} du ${date(j.id)}`));
      }
      garde.push(note ? { jour_id: j.id, nolio_id: id, note: true, revision: empreinte(r.corps ?? voulu) }
        : { jour_id: j.id, nolio_id: id, revision: (r.corps?.revision as string) ?? null });
      if (!note) bilan.remplacees += 1;
      continue;
    }
    // Le jour a changé de nature (une séance devenue repos, ou l'inverse) : l'ancienne part, la nouvelle arrive.
    const r = await appelNolio('DELETE', `${chemin(note)}${id}/${requete(d)}`);
    if (r.statut !== 204 && r.statut !== 200 && r.statut !== 404) {
      garde.push(ancienne);
      throw await echec(refusNolio(r, `le retrait de la ${quoi} du ${date(j.id)}`));
    }
    if (!note) bilan.retirees += 1;
    await ajouter(j);
  }
  // Une séance d'un jour que la semaine n'a plus (rare) : gardée dans l'envoi, telle quelle.
  garde.push(...parJour.values());
  await garderEnvoi(coachId, planId, numero, garde);
  return bilan;
}
