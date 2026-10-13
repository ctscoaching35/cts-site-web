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
// supprimee quand le coach l'a supprimée dans Nolio (une mise à jour ne la recrée pas).
export type SeanceEnvoyee = { jour_id: string; nolio_id: string | number | null; revision?: string | null; supprimee?: boolean };
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

// Les séances d'une semaine traduites par le moteur (cts_nolio), avec les valeurs de l'athlète (N8).
async function seancesDuMoteur(jours: Jour[], profil: Record<string, number>) {
  const r = await fetch(`${API_URL}/v1/nolio/seances`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jours, profil }), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Moteur /v1/nolio/seances : ${r.status}`);
  return ((await r.json()).seances ?? []) as { id: string; nolio: Record<string, unknown> | null }[];
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

function profilDe(a: FicheAthlete) {
  return Object.fromEntries(
    (['fc_seuil1', 'vc_ms', 'fc_seuil2', 'v_seuil1_ms'] as const).filter((k) => a[k] !== null).map((k) => [k, Number(a[k])]),
  );
}

async function creer(d: Destinataire, nolio: Record<string, unknown>): Promise<SeanceEnvoyee & { erreur?: string }> {
  const r = await appelNolio('POST', 'planned/trainings/', d.moi ? nolio : { ...nolio, athletes: [d.usr] });
  if (r.statut !== 201 && r.statut !== 200) return { jour_id: '', nolio_id: null, erreur: refusNolio(r, `la séance du ${String(nolio.date_start)}`) };
  return { jour_id: '', nolio_id: String(r.corps?.id ?? ''), revision: (r.corps?.revision as string) ?? null };
}

// Envoyer une semaine dans Nolio, la première fois. Rend le nombre de séances.
export async function envoyerSemaine(coachId: string, planId: string, numero: string) {
  const o = await objectifCoache(coachId, planId);
  if (!o) throw new Error('Objectif introuvable');
  const d = await destinataire(o.athlete.nolio_athlete_id);
  if (o.envois.some((e) => e.semaine === numero)) throw new Error('Cette semaine est déjà envoyée : mets-la à jour.');
  const semaine = o.plan.semaines.find((s) => s.numero === numero);
  if (!semaine) throw new Error('Semaine introuvable');
  const seances = (await seancesDuMoteur(semaine.jours, profilDe(o.athlete))).filter((s) => s.nolio);
  const crees: SeanceEnvoyee[] = [];
  for (const s of seances) {
    const cree = await creer(d, s.nolio as Record<string, unknown>);
    if (cree.erreur) {
      // Ce qui est déjà créé est gardé, pour que la semaine reste « envoyée » et ne se double pas.
      if (crees.length) await garderEnvoi(coachId, planId, numero, crees);
      throw new Error(cree.erreur);
    }
    crees.push({ jour_id: s.id, nolio_id: cree.nolio_id, revision: cree.revision });
  }
  await garderEnvoi(coachId, planId, numero, crees);
  return crees.length;
}

async function garderEnvoi(coachId: string, planId: string, numero: string, seances: SeanceEnvoyee[]) {
  const { error } = await clientService().from('nolio_envois').upsert({
    plan_id: planId, semaine: numero, coach_id: coachId, seances, envoye_le: new Date().toISOString(),
  });
  if (error) throw new Error(`nolio_envois : ${error.message}`);
}

// Les révisions des séances prévues de l'athlète entre deux dates : { « ptrn_… » : révision }.
async function revisions(d: Destinataire, du: string, au: string): Promise<Map<string, string>> {
  const params = new URLSearchParams({ date_from: du, date_to: au, with_revision: 'true' });
  if (!d.moi) params.set('athlete', d.usr);
  const liste = await listeNolio<{ id: string; revision?: string }>(`planned/trainings/?${params}`);
  return new Map(liste.map((x) => [x.id, x.revision ?? '']));
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

// L'état des semaines envoyées, revu dans Nolio à chaque visite : une semaine dont toutes les séances ont été
// supprimées dans Nolio redevient envoyable ; sinon, combien le coach en a retouchées ou supprimées (V4).
export async function verifierEnvois(planId: string, nolioAthlete: string, plan: Plan, envois: Envoi[]): Promise<EtatEnvoi[]> {
  const sans = envois.map((e) => ({ ...e, retouchees: 0, supprimees: 0 }));
  const lundis = envois.map((e) => plan.semaines.find((s) => s.numero === e.semaine)?.lundi).filter((x): x is string => Boolean(x)).sort();
  if (!lundis.length || !nolioConfigure()) return sans;
  try {
    const d = await destinataire(nolioAthlete);
    await convertirEnvoisV1(planId, d, envois);
    const dansNolio = await revisions(d, ajouterJours(lundis[0], -1), ajouterJours(lundis[lundis.length - 1], 7));
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

export type BilanMiseAJour = { remplacees: number; ajoutees: number; retirees: number; gardees: string[] };

// V4 (décision coach du 13/10/2026) : mettre à jour une semaine envoyée. Les séances que le coach n'a pas touchées
// dans Nolio (même révision qu'à l'envoi) sont remplacées, celles que la semaine n'a plus sont supprimées, les
// nouvelles créées ; celles qu'il a retouchées ou supprimées dans Nolio restent telles quelles, et lui sont dites.
export async function mettreAJourSemaine(coachId: string, planId: string, numero: string): Promise<BilanMiseAJour> {
  const o = await objectifCoache(coachId, planId);
  if (!o) throw new Error('Objectif introuvable');
  const d = await destinataire(o.athlete.nolio_athlete_id);
  const envoi = o.envois.find((e) => e.semaine === numero);
  const semaine = o.plan.semaines.find((s) => s.numero === numero);
  if (!envoi || !semaine?.lundi) throw new Error('Cette semaine n’est pas encore envoyée.');
  await convertirEnvoisV1(planId, d, [envoi]);
  const dansNolio = await revisions(d, ajouterJours(semaine.lundi, -1), ajouterJours(semaine.lundi, 7));
  const nouvelles = await seancesDuMoteur(semaine.jours, profilDe(o.athlete));
  const date = (jourId: string) => semaine.jours.find((j) => j.id === jourId)?.date ?? jourId;
  const bilan: BilanMiseAJour = { remplacees: 0, ajoutees: 0, retirees: 0, gardees: [] };
  const gardees: SeanceEnvoyee[] = [];
  const parJour = new Map(envoi.seances.map((s) => [s.jour_id, s]));
  const finir = async () => {
    await garderEnvoi(coachId, planId, numero, gardees);
    return bilan;
  };
  for (const n of nouvelles) {
    const ancienne = parJour.get(n.id);
    parJour.delete(n.id);
    if (!ancienne?.nolio_id) {
      if (!n.nolio) continue;
      const cree = await creer(d, n.nolio);
      if (cree.erreur) {
        await finir();
        throw new Error(cree.erreur);
      }
      gardees.push({ jour_id: n.id, nolio_id: cree.nolio_id, revision: cree.revision });
      bilan.ajoutees += 1;
      continue;
    }
    const id = String(ancienne.nolio_id);
    const revision = dansNolio.get(id);
    if (ancienne.supprimee || revision === undefined) {
      gardees.push({ ...ancienne, supprimee: true });
      bilan.gardees.push(`${date(n.id)} (supprimée dans Nolio)`);
      continue;
    }
    if (!ancienne.revision || revision !== ancienne.revision) {
      gardees.push(ancienne);
      bilan.gardees.push(`${date(n.id)} (retouchée dans Nolio)`);
      continue;
    }
    if (!n.nolio) {
      const r = await appelNolio('DELETE', `planned/trainings/${id}/${requete(d)}`);
      if (r.statut !== 204 && r.statut !== 200 && r.statut !== 404) {
        gardees.push(ancienne);
        await finir();
        throw new Error(refusNolio(r, `le retrait de la séance du ${date(n.id)}`));
      }
      bilan.retirees += 1;
      continue;
    }
    // Tous les champs que l'app écrit, pour que rien de l'ancienne version ne reste ; If-Match : refusée (409)
    // si le coach l'a retouchée entre la lecture et l'écriture.
    const { sport, name, date_start, duration, rpe, show_rpe, color, description, workout } = n.nolio;
    const r = await appelNolio('PATCH', `planned/trainings/${id}/${requete(d)}`, {
      sport, name, date_start, duration: duration ?? null, rpe: rpe ?? null, show_rpe: show_rpe ?? false,
      color: color ?? null, description: description ?? '', workout: workout ?? null,
    }, { 'If-Match': revision });
    if (r.statut === 409) {
      gardees.push(ancienne);
      bilan.gardees.push(`${date(n.id)} (retouchée dans Nolio)`);
      continue;
    }
    if (r.statut !== 200) {
      gardees.push(ancienne);
      await finir();
      throw new Error(refusNolio(r, `la mise à jour de la séance du ${date(n.id)}`));
    }
    gardees.push({ jour_id: n.id, nolio_id: id, revision: (r.corps?.revision as string) ?? null });
    bilan.remplacees += 1;
  }
  // Une séance d'un jour que la semaine n'a plus (rare) : gardée dans l'envoi, telle quelle.
  gardees.push(...parJour.values());
  return finir();
}
