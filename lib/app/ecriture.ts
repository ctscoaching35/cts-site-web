/**
 * L'écriture semaine par semaine, côté site (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, dernière section ; décisions
 * coach des 18-19/10/2026 ; moteur 8.326, cts_semaine et cts_ajustements). Un plan qui porte des paramètres ne part plus
 * en entier dans Nolio :
 * - au départ (l'acheteur a rejoint l'équipe, ou le coach a associé l'athlète d'un nouvel objectif), ses courses et le
 *   questionnaire du dimanche (Hooper et « Ta semaine prochaine »), puis la semaine en cours ; une semaine à la fois
 *   (décision coach du 23/10/2026) : chaque semaine écrite porte son bandeau et sa fiche de course, plus de TRAME posée
 *   jusqu'à la course ;
 * - chaque dimanche soir, le site lit dans Nolio la semaine écoulée (séances faites, et avec l'accord de l'athlète son RPE,
 *   son ressenti, son Hooper ; T5) et les réponses au questionnaire, le moteur écrit la semaine suivante, le site l'envoie ;
 * - chaque jour, la fatigue franche (R3) remplace la séance dure qui vient par une EF ; l'athlète peut garder sa séance
 *   d'origine (veto) ; le coach peut annuler les ajustements d'une semaine.
 * Les règles et leurs seuils vivent dans le moteur (D3) ; le site lit, envoie et garde. Côté serveur seulement.
 */
import { cache } from 'react';
import { site } from '@/lib/content';
import { API_URL } from '@/lib/plan';
import {
  chargeDepuisNolio, creer, destinataire, envoyerSemaineCible, ficheAthlete, garderEnvoi, mettreAJourSemaineCible, profilDe, seancesDuMoteur,
  volumeDuMoment,
  type Cible, type Envoi, type SeanceEnvoyee,
} from './coaching';
import { envoyerRelanceInvitation, EXPEDITEUR } from './emailBienvenue';
import { lienFicheCourse } from './ficheCourse';
import { dateDe } from './trameNolio';
import { appelNolio, coachs, listeNolio, refusNolio, sansVitesseImpossible, SPORTS_COURSE } from './nolio';
import { ajouterJours, joursEntre, type Plan, type Semaine } from './plan';
import { clientService } from './supabase';
import type { Fiche } from './tableau';
import { fcSeuil2DuTest, lireParole, vcDuTest, type Flux, type Tour } from './tests';
import { allure, coefficientRiegel, kmh, PROFIL_VIDE } from './zones';
import { reperesDeBase } from './reperes';
import { ecrireZonesNolio } from './zonesNolio';

export type Etat = Record<string, unknown>;
// compteAthlete : le compte d'un coaché invité dans l'app (T6) ; ses gestes (une course, le veto) valent comme ceux du
// propriétaire du plan.
// reperesSources : la date de chaque repère d'un coaché (sa fiche), pour refaire ses tests tous les 6 mois.
export type Objectif = Cible & {
  compteId: string; parametres: Record<string, unknown>; etat: Etat | null; accordLecture: boolean; coache: boolean;
  compteAthlete: string | null; tempsH: number; reperesSources?: Record<string, { le?: string } | undefined>;
  dPrime?: number | null;
};
export type RetourSeance = {
  id: string; date: string; faite: boolean; duree_min: number | null; rpe: number | null; ressenti: number | null; dplus_m: number | null;
};
export type Questionnaire = { jours: string[]; jour_sl: string | null; nb_seances: number | null; arret: boolean };
export type Retours = {
  seances: RetourSeance[]; hooper: { date: string; valeur: number }[]; questionnaire?: Questionnaire; nolio?: SemaineNolio;
};
// « Nolio fait foi » (décisions coach du 20/10/2026) : la semaine telle qu'elle est dans Nolio, que le moteur juge
// (cts_ajustements.semaine_reelle) : chaque séance qu'il a écrite et qui y est encore, avec sa durée et son RPE (une
// absente et non faite, le coach l'a supprimée) ; les séances de course et de trail ajoutées, posées par le coach ou
// courues par l'athlète, hors jours de course.
type SemaineNolio = {
  prevues: Record<string, { duree_min: number | null; rpe: number | null }>;
  ajoutees: {
    date: string; prevue_min: number | null; rpe_prevu: number | null; faite: boolean; duree_min?: number | null;
    rpe?: number | null; ressenti?: number | null; dplus_m?: number | null;
  }[];
};
type SortieMoteur = {
  semaine: Semaine; notes: { regle: string; texte: string }[]; bilan: string | null; journal: Record<string, unknown>[];
  etat: Etat; parametres: Record<string, unknown> | null;
  // Ce qui a été fait la semaine écoulée (moteur 8.327), rangé avec elle pour le tableau de bord ; null sans retours.
  realise: Realise | null;
};
export type Realise = {
  numero: string; lundi: string; type: string | null; charge_prevue: number; charge_faite: number; charge_tenue: number; rpe_lu: boolean;
  seances_prevues: number; seances_faites: number; duree_prevue_min: number; duree_faite_min: number;
  sl_prevue_min: number | null; sl_faite_min: number | null; cles_prevues: number; cles_reussies: number;
  dplus_m: number | null; hooper: number | null;
};

// Les clés de nolio_envois qui ne sont pas des semaines : la trame (bandeaux et fiches de tout le plan), les
// questionnaires du dimanche, la note de bilan d'une semaine (« S9:bilan ») et la note d'un ajustement en cours de
// semaine (« S9-jeudi:fatigue »).
export const TRAME = 'trame';
const QUESTIONNAIRES = 'questionnaires';
const COULEUR_NOTE = '#0C6E5F';
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LIBELLES = JOURS.map((j) => j[0].toUpperCase() + j.slice(1));
// Le questionnaire du samedi (décision coach du 19/10/2026, question 13 ; le samedi depuis le 24/10/2026, pour laisser
// le week-end), lu par le passage du dimanche soir : quatre questions courtes. Sans `order` :
// Nolio le compte à partir de 0 et le déduit de la place dans la liste (refus du 19/10/2026, essai sur « (toi) »).
export const QUESTIONNAIRE_SEMAINE = {
  name: 'Ta semaine prochaine',
  description: 'Une minute, d’ici dimanche 18 h : tes séances de la semaine prochaine s’écrivent dimanche soir à partir de tes réponses.',
  items: [
    { question: 'Quels jours peux-tu courir la semaine prochaine ?', type: 'multiple_choices', is_mandatory: true,
      choices: { choices: LIBELLES } },
    { question: 'Quel jour pour ta sortie longue ?', type: 'unique_choice', is_mandatory: true, choices: { choices: LIBELLES } },
    { question: 'Combien de séances veux-tu faire ?', type: 'number', is_mandatory: true, unit: 'séances' },
    { question: 'As-tu dû arrêter de courir cette semaine (blessure, maladie) ?', type: 'boolean', is_mandatory: true },
  ],
};

// ─── L'objectif ───────────────────────────────────────────────────────────

// Le compte du coach qui tient la clé Nolio (le premier de CTS_COACHS) : les envois des acheteurs sont à son nom.
let compteCoach: Promise<string | null> | null = null;
export function compteDuCoach(): Promise<string | null> {
  compteCoach ??= (async () => {
    const email = coachs()[0];
    if (!email) return null;
    for (let page = 1; page < 50; page += 1) {
      const { data } = await clientService().auth.admin.listUsers({ page, perPage: 1000 });
      const u = data?.users.find((x) => (x.email ?? '').toLowerCase() === email);
      if (u) return u.id;
      if (!data || data.users.length < 1000) return null;
    }
    return null;
  })().catch(() => {
    compteCoach = null;
    return null;
  });
  return compteCoach;
}

// Un plan écrit semaine par semaine, d'un coaché (sa fiche, son accord du Suivi) ou d'un acheteur (ses zones, son
// accord de lecture) ; null pour un plan envoyé en entier (avant le 19/10/2026, T11) ou introuvable.
export async function objectifEcrit(planId: string): Promise<Objectif | null> {
  const service = clientService();
  const { data: p } = await service.from('plans')
    .select('id, compte_id, coach_id, donnees, intake, parametres, etat_ecriture, nolio_athlete_id, accord_lecture_le')
    .eq('id', planId).maybeSingle();
  if (!p?.parametres) return null;
  const { data: envois } = await service.from('nolio_envois').select('semaine, envoye_le, seances').eq('plan_id', planId);
  const niveau = String((p.intake as Record<string, unknown> | null)?.niveau ?? 'intermediaire');
  const base = {
    planId, compteId: p.compte_id as string, plan: p.donnees as Plan, parametres: p.parametres as Record<string, unknown>,
    // Une semaine à la fois (décision coach du 23/10/2026) : la semaine écrite porte son bandeau et sa fiche de course.
    etat: (p.etat_ecriture ?? null) as Etat | null, niveau, envois: (envois ?? []) as Envoi[], avecTrame: true,
    tempsH: heures((p.intake as Record<string, unknown> | null)?.temps_cible),
  };
  const { data: c } = await service.from('coaching').select('athlete_id, coach_id').eq('plan_id', planId).maybeSingle();
  if (c?.athlete_id) {
    const { data: a } = await service.from('athletes_coaches')
      .select('nolio_athlete_id, fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms, compte_id, reperes_sources, d_prime_m').eq('id', c.athlete_id).single();
    const usr = (a?.nolio_athlete_id ?? null) as string | null;
    const { data: accord } = usr
      ? await service.from('nolio_accords').select('accord_le').eq('coach_id', c.coach_id).eq('nolio_athlete_id', usr).maybeSingle()
      : { data: null };
    return { ...base, coachId: c.coach_id as string, nolioAthlete: usr, coache: true, accordLecture: Boolean(accord),
      compteAthlete: (a?.compte_id ?? null) as string | null,
      reperesSources: (a?.reperes_sources ?? {}) as Objectif['reperesSources'], dPrime: (a?.d_prime_m ?? null) as number | null,
      profil: a ? profilDe({ fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms ?? null }) : {} };
  }
  const coachId = (p.coach_id as string | null) ?? (await compteDuCoach());
  if (!coachId) return null;
  const { data: z } = await service.from('zones').select('fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms, d_prime_m').eq('plan_id', planId).maybeSingle();
  return { ...base, coachId, nolioAthlete: (p.nolio_athlete_id ?? null) as string | null, coache: false, compteAthlete: null,
    accordLecture: Boolean(p.accord_lecture_le), dPrime: (z?.d_prime_m ?? null) as number | null,
    profil: z ? profilDe({ fc_seuil1: z.fc_seuil1, vc_ms: z.vc_ms, fc_seuil2: z.fc_seuil2, v_seuil1_ms: z.v_seuil1_ms ?? null }) : {} };
}

// Pour l'affichage seulement (la semaine dans Nolio, les badges : l'accueil le lisait deux fois) : lu une fois par page.
// Jamais dans une action ni une tâche, qui relisent l'objectif après l'avoir modifié et le veulent à jour.
export const objectifAffiche = cache(objectifEcrit);

// ─── Le moteur ────────────────────────────────────────────────────────────

export async function moteur<T>(chemin: string, corps: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${chemin}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps), cache: 'no-store',
  });
  if (!r.ok) {
    const message = await r.json().then((x) => x?.message).catch(() => null);
    throw new Error(`Moteur ${chemin} : ${r.status}${message ? ` — ${message}` : ''}`);
  }
  return r.json() as Promise<T>;
}

// La charge visée (Foster) : null pour une trame tirée des données d'un plan d'avant (lib/app/tableau.ts).
export type LigneTrame = {
  numero: string; type: string; bloc: string; lundi: string; dates: string; volume_h: number; charge: number | null;
  seances_cles: { jour: string; seance: string; famille: string }[]; week_end_choc: boolean; sl_min: number | null;
  passee: boolean;
  // La saison de fond (moteur 8.353) : le thème du bloc (« Vitesse », « Seuil ») et la semaine de tests.
  theme?: string; tests?: boolean;
};
export type Trame = { course: { date: string }; semaines: LigneTrame[]; fiches?: Fiche[] };
export const trameDu = (parametres: Record<string, unknown>, fichesDuPlan?: string[]) =>
  moteur<Trame>('/v1/trame', { parametres, ...(fichesDuPlan ? { fiches_du_plan: fichesDuPlan } : {}) });

// La trame d'un plan et ses fiches à leur moment, demandées une fois au moteur puis gardées avec lui (« Mon plan »,
// le tableau de bord) : elle ne change qu'avec ses paramètres (une reprise reconstruite, une séance de plus tenue),
// qui l'effacent.
export async function trameDuPlan(planId: string): Promise<Trame | null> {
  const service = clientService();
  const { data: p } = await service.from('plans').select('parametres, trame, donnees').eq('id', planId).maybeSingle();
  if (!p?.parametres) return null;
  if (p.trame) return p.trame as Trame;
  const cles = ((p.donnees as Plan | null)?.pour_aller_plus_loin?.fiches ?? []).map((f) => f.cle);
  const trame = await trameDu(p.parametres as Record<string, unknown>, cles).catch(() => null);
  if (trame) await service.from('plans').update({ trame }).eq('id', planId);
  return trame;
}

// ─── Lire Nolio (avec l'accord de l'athlète pour son RPE, son ressenti et son Hooper ; T5) ─────────────

const requeteAthlete = async (o: Objectif) => {
  const d = await destinataire(o.nolioAthlete);
  return d.moi ? '' : `&athlete=${d.usr}`;
};

let hooperItem: Promise<string | null> | null = null;
export const indiceHooper = () => {
  hooperItem ??= listeNolio<{ id: string; key?: string }>('metrics/items/')
    .then((items) => items.find((i) => i.key === 'INDICEHOOPER')?.id ?? null)
    .catch(() => {
      hooperItem = null;
      return null;
    });
  return hooperItem;
};

// Une réponse du questionnaire du samedi, lue dans Nolio (une réponse de la semaine, samedi ou dimanche).
function lireQuestionnaire(items: { question: string; value: unknown }[]): Questionnaire | undefined {
  const reponse = (n: number) => items.find((i) => i.question === QUESTIONNAIRE_SEMAINE.items[n].question)?.value;
  const jours = reponse(0);
  if (!Array.isArray(jours)) return undefined;
  const jour = (v: unknown) => (typeof v === 'string' && JOURS.includes(v.toLowerCase()) ? v.toLowerCase() : null);
  const nb = Number(reponse(2));
  return { jours: jours.map(jour).filter((x): x is string => Boolean(x)), jour_sl: jour(reponse(1)),
    nb_seances: Number.isFinite(nb) && nb > 0 ? Math.round(nb) : null, arret: reponse(3) === true || reponse(3) === 'true' };
}

// Ce que le moteur juge : les séances faites (reliées à leur jour du plan par l'envoi), le Hooper, le questionnaire, et
// la semaine telle qu'elle est dans Nolio (« Nolio fait foi »). Rien n'est gardé : le moteur en tire ce qu'il garde dans
// son état (la plus longue sortie courue, le volume fait).
export async function lireRetours(o: Objectif, du: string, au: string): Promise<Retours> {
  const qui = await requeteAthlete(o);
  const parNolio = new Map<string, string>();
  for (const e of o.envois) for (const s of e.seances as SeanceEnvoyee[])
    if (s.nolio_id && (s.genre ?? 'seance') === 'seance' && !s.jour_id.includes(':')) parNolio.set(String(s.nolio_id), s.jour_id);
  type Reel = { id: string; date_start: string; sport?: string | null; duration?: { value: number } | null; planned?: string | null;
    elevation_gain?: { value: number } | null; distance?: { value?: number; unit?: string } | number | null;
    debrief?: { rpe?: number | null; feeling?: number | null } | null };
  const reels = (await listeNolio<Reel>(
    `real/trainings/?date_from=${du}&date_to=${au}&fields=id,date_start,sport,duration,distance,elevation_gain,planned,debrief${qui}`))
    .map(sansVitesseImpossible);
  const seances: RetourSeance[] = reels.filter((r) => r.planned && parNolio.has(r.planned)).map((r) => ({
    id: parNolio.get(r.planned as string) as string, date: r.date_start.slice(0, 10), faite: true,
    duree_min: r.duration?.value ? Math.round(r.duration.value / 60) : null,
    rpe: o.accordLecture ? r.debrief?.rpe ?? null : null, ressenti: o.accordLecture ? r.debrief?.feeling ?? null : null,
    dplus_m: typeof r.elevation_gain?.value === 'number' ? Math.round(r.elevation_gain.value) : null,
  }));
  let hooper: Retours['hooper'] = [];
  const item = o.accordLecture ? await indiceHooper() : null;
  if (item) {
    const valeurs = await listeNolio<{ id: string; date_start: string; value: number | null }>(
      `metrics/values/?item=${item}&date_from=${ajouterJours(au, -42)}&date_to=${au}${qui}`);
    hooper = valeurs.filter((v) => typeof v.value === 'number')
      .map((v) => ({ date: v.date_start.slice(0, 10), valeur: v.value as number }));
  }
  const resultats = await listeNolio<{ id: string; name?: string; date_start: string; items: { question: string; value: unknown }[] }>(
    `real/quiz_results/?date_from=${ajouterJours(au, -6)}&date_to=${au}${qui}`).catch(() => []);
  const dernier = resultats.filter((r) => r.name === QUESTIONNAIRE_SEMAINE.name).sort((a, b) => b.date_start.localeCompare(a.date_start))[0];
  // « Nolio fait foi » : les séances prévues de ces semaines, une semaine de marge de chaque côté (une séance déplacée
  // juste à côté reste la sienne).
  type Prevue = { id: string; date_start: string; sport?: string | null; duration?: { value?: number } | null; rpe?: number | null };
  const planifiees = await listeNolio<Prevue>(`planned/trainings/?date_from=${ajouterJours(du, -7)}&date_to=${ajouterJours(au, 7)}${qui}`);
  const minutes = (d: { value?: number } | null | undefined) => (typeof d?.value === 'number' ? Math.round(d.value / 60) : null);
  const rpe = (x: unknown) => (typeof x === 'number' ? x : null);
  const jours = new Set([o.plan.course.date, ...((o.parametres.courses_secondaires ?? []) as Course[]).map((c) => c.date)]);
  // Course ou trail, dans la période, hors jours de course (la course n'est pas une charge d'entraînement).
  const deCourse = (sport: unknown, date: string) =>
    SPORTS_COURSE.includes(String(sport)) && date.slice(0, 10) >= du && date.slice(0, 10) <= au && !jours.has(date.slice(0, 10));
  const prevues: SemaineNolio['prevues'] = Object.fromEntries(planifiees.filter((p) => parNolio.has(p.id))
    .map((p) => [parNolio.get(p.id) as string, { duree_min: minutes(p.duration), rpe: rpe(p.rpe) }]));
  const posees = new Map(planifiees.filter((p) => !parNolio.has(p.id) && deCourse(p.sport, p.date_start)).map((p) => [p.id, p]));
  const ajoutees: SemaineNolio['ajoutees'] = [];
  for (const r of reels) {
    if ((r.planned && parNolio.has(r.planned)) || !deCourse(r.sport, r.date_start)) continue;
    const p = r.planned ? posees.get(r.planned) : undefined;
    if (p) posees.delete(p.id);
    ajoutees.push({
      date: r.date_start.slice(0, 10), prevue_min: p ? minutes(p.duration) : null, rpe_prevu: p ? rpe(p.rpe) : null, faite: true,
      duree_min: r.duration?.value ? Math.round(r.duration.value / 60) : null,
      rpe: o.accordLecture ? r.debrief?.rpe ?? null : null, ressenti: o.accordLecture ? r.debrief?.feeling ?? null : null,
      dplus_m: typeof r.elevation_gain?.value === 'number' ? Math.round(r.elevation_gain.value) : null,
    });
  }
  for (const p of posees.values()) {
    ajoutees.push({ date: p.date_start.slice(0, 10), prevue_min: minutes(p.duration), rpe_prevu: rpe(p.rpe), faite: false });
  }
  return { seances, hooper, nolio: { prevues, ajoutees }, ...(dernier ? { questionnaire: lireQuestionnaire(dernier.items) } : {}) };
}

// ─── Écrire et envoyer ────────────────────────────────────────────────────

// La semaine qui contient une date, dans les données du plan ; null hors du plan.
export function semaineDu(plan: Plan, dateIso: string): Semaine | null {
  return plan.semaines.find((s) => s.lundi && s.lundi <= dateIso && dateIso <= ajouterJours(s.lundi, 6)) ?? null;
}

// La semaine en cours rattrapée à la main (« Réessayer » dans « À regarder », décision coach du 21/10/2026) : écrite et
// envoyée comme le dimanche, à partir d'aujourd'hui, avec la même réservation qui empêche de la doubler.
export async function rattraperLaSemaine(planId: string): Promise<string> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete) throw new Error('L’athlète n’a pas encore de compte Nolio relié.');
  if ((await plansALaMain()).has(planId)) throw new Error('Tu programmes cet athlète à la main : rien ne s’écrit dans son Nolio.');
  const aujourdhui = aujourdhuiParis();
  const lundi = ajouterJours(aujourdhui, -((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  const s = semaineDu(o.plan, lundi);
  if (!s) throw new Error('Pas de semaine de préparation cette semaine.');
  if (o.envois.some((e) => e.semaine === s.numero)) return s.numero;
  const service = clientService();
  const { data: prise } = await service.from('nolio_envois')
    .upsert({ plan_id: planId, semaine: s.numero, coach_id: o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true })
    .select('plan_id');
  if (!prise?.length) throw new Error('Cette semaine est déjà en train de partir : regarde dans une minute.');
  try {
    // La première semaine d'une saison de fond, sans retours, comme le dimanche.
    const premiere = Boolean((o.parametres as { fond?: unknown }).fond) && !o.envois.some((e) => /^S\d+$/.test(e.semaine));
    const retours = premiere ? null : await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
    await ecrireEtEnvoyer(o, s.numero, retours, { depuis: aujourdhui });
  } catch (e) {
    const { data: ligne } = await service.from('nolio_envois').select('seances').eq('plan_id', planId).eq('semaine', s.numero).maybeSingle();
    if (!((ligne?.seances as unknown[] | undefined) ?? []).length) await service.from('nolio_envois').delete().eq('plan_id', planId).eq('semaine', s.numero);
    throw e;
  }
  return s.numero;
}

// Un coaché sans espace dans l'app (décision coach du 20/10/2026, « dis-le à ton coach ») : les notes Nolio ne
// renvoient pas vers l'app, qu'il ne peut pas ouvrir ; il passe par son coach.
const sansApp = (o: Objectif) => o.coache && !o.compteAthlete;

async function garderNote(o: Objectif, cle: string, dateIso: string, titre: string, texte: string) {
  const d = await destinataire(o.nolioAthlete);
  const cree = await creer(d, cle, { name: titre, date_start: dateIso, color: COULEUR_NOTE, description: texte }, 'note');
  if (cree.erreur) throw new Error(cree.erreur);
  await garderEnvoi(o.coachId, o.planId, cle, [cree]);
}

// Écrire une semaine et l'envoyer (la créer, ou la mettre à jour si elle est déjà partie : le coach a annulé, la fatigue).
// depuis : les jours d'avant ne partent pas (un départ en milieu de semaine).
// Le profil du coureur (décision coach du 21/10/2026, « le point faible à distance ») : « rapide » ou « endurant », tiré
// de son test de vitesse critique par la règle de l'app (coefficient de Riegel sous 0,90), porté par les paramètres du
// plan, que le moteur lit pour son développement ; sans test, aucun. Remis à jour à chaque semaine écrite.
async function suivreLeProfil(o: Objectif) {
  // En fond, le profil se lit au début de la saison (lib/app/fond.ts) : l'ordre de ses blocs en dépend.
  if ((o.parametres as { fond?: unknown }).fond) return;
  const vc = (o.profil as { vc_ms?: number }).vc_ms;
  const profil = vc && o.dPrime ? (coefficientRiegel(vc, o.dPrime) < 0.9 ? 'rapide' : 'endurant') : null;
  if ((o.parametres.profil_coureur ?? null) === profil) return;
  const { profil_coureur: _ancien, ...reste } = o.parametres;
  const parametres = profil ? { ...reste, profil_coureur: profil } : reste;
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

export async function ecrireEtEnvoyer(o: Objectif, numero: string, retours: Retours | null, options: {
  sansAjustement?: boolean; depuis?: string; reprise?: boolean;
} = {}): Promise<SortieMoteur> {
  await suivreLeProfil(o);
  const sortie = await moteur<SortieMoteur>('/v1/semaine', {
    parametres: o.parametres, numero, etat: o.etat, retours, sans_ajustement: Boolean(options.sansAjustement),
    valeurs: valeursConnues(o, o.plan.semaines.find((x) => x.numero === numero)?.lundi), reprise: Boolean(options.reprise),
  });
  return envoyerEtRanger(o, numero, sortie, options);
}

// LA RÉCUPÉRATION APRÈS LA COURSE (décision coach du 23/10/2026) : pour un coaché, les semaines entre celle de sa course
// et son lundi de reprise (debutApres : un jour sans séance dure par heure de course, deux au moins, jusqu'au lundi
// qui suit), numérotées à la suite du plan ; le moteur les écrit (repos les 2 jours d'après la course, puis une EF
// courte un jour disponible sur deux) et elles partent dans Nolio comme les autres. null hors de cette fenêtre.
export function semaineDeRecuperation(o: Pick<Objectif, 'coache' | 'plan' | 'tempsH' | 'parametres'>, lundi: string): { numero: string; jusqua: string } | null {
  const derniere = [...o.plan.semaines].reverse().find((s) => s.lundi);
  if (!o.coache || !derniere?.lundi || lundi <= derniere.lundi) return null;
  const jusqua = debutApres({ course_date: o.plan.course.date, temps_h: o.tempsH, format: formatDe(o) });
  if (lundi >= jusqua) return null;
  return { numero: `S${o.plan.semaines.length + Math.round(joursEntre(derniere.lundi, lundi) / 7)}`, jusqua };
}

async function ecrireLaRecuperation(o: Objectif, numero: string, jusqua: string, retours: Retours | null): Promise<SortieMoteur> {
  const sortie = await moteur<SortieMoteur>('/v1/recuperation', { parametres: o.parametres, numero, jusqua, etat: o.etat, retours });
  return envoyerEtRanger(o, numero, sortie);
}

// La semaine écrite par le moteur : dans Nolio, avec sa note du dimanche, puis rangée (journal, résumé, état).
async function envoyerEtRanger(o: Objectif, numero: string, sortie: SortieMoteur, options: {
  sansAjustement?: boolean; depuis?: string;
} = {}): Promise<SortieMoteur> {
  const service = clientService();
  if (sortie.parametres) {
    await service.from('plans').update({ parametres: sortie.parametres, trame: null }).eq('id', o.planId);
    o.parametres = sortie.parametres;
  }
  const semaine = options.depuis
    ? { ...sortie.semaine, jours: sortie.semaine.jours.filter((j) => !j.date_iso || j.date_iso >= (options.depuis as string)) }
    : sortie.semaine;
  if (o.envois.some((e) => e.semaine === numero)) await mettreAJourSemaineCible(o, numero, semaine);
  else await envoyerSemaineCible(o, numero, semaine);
  const texte = [sortie.bilan, !sortie.bilan && sortie.notes.length ? sortie.notes.map((n) => n.texte).join(' ') : null]
    .filter(Boolean).join(' ');
  if (texte && semaine.lundi && !o.envois.some((e) => e.semaine === `${numero}:bilan`)) {
    await garderNote(o, `${numero}:bilan`, semaine.lundi, 'Ta semaine', texte);
  }
  await service.from('semaines_ecrites').upsert({
    plan_id: o.planId, numero, donnees: sortie.semaine, notes: sortie.notes, journal: sortie.journal, bilan: sortie.bilan,
    sans_ajustement: Boolean(options.sansAjustement), etat_avant: o.etat, ecrite_le: new Date().toISOString(),
  });
  await programmerParole(o, semaine);
  if (semaine.lundi) await fichesDesPreparations(o, ajouterJours(semaine.lundi, 6));
  if (sortie.realise) {
    await service.from('semaines_ecrites').update({ realise: sortie.realise }).eq('plan_id', o.planId).eq('numero', sortie.realise.numero);
  }
  await service.from('plans').update({ etat_ecriture: sortie.etat }).eq('id', o.planId);
  o.etat = sortie.etat;
  return sortie;
}

// La trame posée d'avance par un départ d'avant le 24/10/2026 (le bandeau de chaque semaine jusqu'à la course) : ce
// qui tombe après la semaine qui vient part de Nolio, une fois (décision coach du 23/10/2026, « une semaine à la
// fois ») ; le passé, la semaine en cours et la semaine qui vient restent. Le reste arrive avec chaque semaine écrite.
export async function retirerLaTrameAuDela(): Promise<Compte[]> {
  const service = clientService();
  const { data: trames } = await service.from('nolio_envois').select('plan_id, seances').eq('semaine', TRAME);
  const aujourdhui = aujourdhuiParis();
  const limite = ajouterJours(aujourdhui, 13 - ((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  const comptes: Compte[] = [];
  for (const t of trames ?? []) {
    const poses = (t.seances ?? []) as SeanceEnvoyee[];
    if (!poses.some((x) => dateDe(x).slice(0, 10) > limite)) continue;
    const o = await objectifEcrit(String(t.plan_id));
    if (!o?.nolioAthlete || o.plan.course.date < aujourdhui) continue;
    try {
      const d = await destinataire(o.nolioAthlete);
      const qui = d.moi ? '' : `?athlete=${d.usr}`;
      const restent: SeanceEnvoyee[] = [];
      const soucis: string[] = [];
      let retires = 0;
      for (const x of poses) {
        if (!(dateDe(x).slice(0, 10) > limite) || !x.nolio_id) {
          restent.push(x);
          continue;
        }
        const r = await appelNolio('DELETE', `planned/${x.genre === 'cycle' ? 'cycles' : 'notes'}/${x.nolio_id}/${qui}`).catch(() => null);
        if (r && (r.statut === 204 || r.statut === 200 || r.statut === 404)) retires += 1;
        else {
          restent.push(x);
          soucis.push(r ? refusNolio(r, `le bandeau du ${dateDe(x)}`) : `le bandeau du ${dateDe(x)} : Nolio injoignable`);
        }
      }
      await garderEnvoi(o.coachId, o.planId, TRAME, restent);
      comptes.push({ plan: o.planId, quoi: `${retires} bandeau${retires > 1 ? 'x' : ''} ou note${retires > 1 ? 's' : ''} d’avance retiré${retires > 1 ? 's' : ''}`,
        ...(soucis.length ? { erreur: soucis.join(' ; ') } : {}) });
    } catch (e) {
      comptes.push({ plan: String(t.plan_id), quoi: 'trame d’avance gardée', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// Le dimanche qui vient d'un acheteur (une semaine à la fois, décision coach du 23/10/2026 ; dimanchesCoaches) : son
// questionnaire, et le Hooper avec son accord de lecture. Un coaché a le sien sur sa fiche.
async function dimancheDeLAcheteur(o: Objectif) {
  if (o.coache || !o.nolioAthlete) return;
  const { dimancheDuPlan } = await import('./dimanchesCoaches');
  const { data: p } = await clientService().from('plans').select('accord_lecture_le').eq('id', o.planId).maybeSingle();
  const c = await dimancheDuPlan({ id: o.planId, coach_id: o.coachId, nolio_athlete_id: o.nolioAthlete,
    accord_lecture_le: (p?.accord_lecture_le as string | null) ?? null });
  if (c.erreur) console.error(`Dimanche de ${o.planId} :`, c.erreur);
}

// L'accord de lecture donné après l'achat, dans l'onglet Compte (décision coach du 21/10/2026) : noté, et, la préparation
// partie dans Nolio, le Hooper du dimanche s'y ajoute à partir du dimanche qui vient ; avant le départ, il part avec les
// questionnaires. Retirable comme celui du questionnaire (retirerAccordLecture).
export async function donnerAccordLecture(planId: string): Promise<void> {
  const o = await objectifEcrit(planId);
  if (!o || o.coache) throw new Error('Plan introuvable');
  await clientService().from('plans').update({ accord_lecture_le: new Date().toISOString() }).eq('id', planId);
  // Sa préparation partie dans Nolio : le Hooper rejoint son dimanche qui vient.
  if (o.envois.some((e) => e.semaine === QUESTIONNAIRES)) await dimancheDeLAcheteur(o);
}

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

// Le départ d'un objectif écrit semaine par semaine : la trame, les questionnaires, la semaine en cours (ou la
// première), et pour un acheteur sa place dans le groupe « Plans CTS » et sa sortie programmée (P2, P3).
// prevu : le départ programmé, après la récupération d'un autre objectif (OM4) ou après les séances que le coach a déjà
// posées à la main (PC1) ; apres : la course, ou la date de la dernière de ces séances.
export type Depart = { numero: string } | { prevu: string; apres: string; raison: 'recuperation' | 'seances' | 'preparation' };

// PC1 (décision coach du 19/10/2026) : un coaché à qui le coach a déjà posé des séances à la main ; rien n'est écrasé,
// l'écriture commence le lundi qui suit la dernière d'entre elles. null : rien de posé d'ici la course (hors ce que
// l'app a posé elle-même).
// jusqua : la fin de la recherche, la course par défaut (une semaine de récupération : son dimanche).
export async function seancesDejaPosees(o: Objectif, aujourdhui: string, jusqua = o.plan.course.date): Promise<{ derniere: string; lundi: string } | null> {
  if (!o.coache || !o.nolioAthlete) return null;
  const d = await destinataire(o.nolioAthlete);
  // Celles du coach : aucune que le moteur a envoyée, pour cet objectif ou un autre de ce coaché (sa saison de fond,
  // décision coach du 24/10/2026 : ses séances ne repoussent pas le départ d'une préparation).
  const service = clientService();
  const { data: lien } = await service.from('coaching').select('athlete_id').eq('plan_id', o.planId).maybeSingle();
  const { data: freres } = lien ? await service.from('coaching').select('plan_id').eq('athlete_id', lien.athlete_id) : { data: [] };
  const autres = (freres ?? []).map((x) => x.plan_id as string).filter((id) => id !== o.planId);
  const { data: leurs } = autres.length ? await service.from('nolio_envois').select('seances').in('plan_id', autres) : { data: [] };
  const poses = new Set([...o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]),
    ...(leurs ?? []).flatMap((e) => (e.seances ?? []) as SeanceEnvoyee[])].map((x) => String(x.nolio_id ?? '')));
  const seances = await listeNolio<{ id: string; date_start: string; sport?: string | null }>(
    `planned/trainings/?date_from=${aujourdhui}&date_to=${jusqua}${d.moi ? '' : `&athlete=${d.usr}`}`);
  // Course et trail seulement (décision coach du 21/10/2026, comme « Nolio fait foi ») : la renfo, le vélo ou une série
  // d'un autre sport vivent à côté des séances du moteur, sans repousser le départ.
  const derniere = seances.filter((x) => !poses.has(x.id) && SPORTS_COURSE.includes(String(x.sport)))
    .map((x) => x.date_start.slice(0, 10)).sort().pop();
  if (!derniere) return null;
  const rang = (new Date(`${derniere}T12:00:00Z`).getUTCDay() + 6) % 7;
  return { derniere, lundi: ajouterJours(derniere, 7 - rang) };
}

// Ce que le bouton « Démarrer dans Nolio » annonce avant le clic (PC1) : la date où l'écriture commencera.
export async function annonceDepart(planId: string): Promise<{ lundi: string; derniere: string } | null> {
  const o = await objectifEcrit(planId);
  if (!o) return null;
  return seancesDejaPosees(o, aujourdhuiParis()).catch(() => null);
}

// Un départ d'acheteur en échec (décision coach du 20/10/2026) : le coach est prévenu au premier échec, avec la raison,
// et le passage quotidien le reprend chaque jour (departsDuJour) ; prevenir : false pour ces reprises. lundi : le
// départ programmé (depart_prevu), que le passage de la veille tient même si plus rien n'est posé à partir de ce jour.
// aPartirDu : le lundi choisi par le coach sur la page de l'objectif.
export async function demarrerObjectif(planId: string, { prevenir = true, lundi, aPartirDu }: { prevenir?: boolean; lundi?: string; aPartirDu?: string } = {}): Promise<Depart> {
  const o = await objectifEcrit(planId);
  if (!o) throw new Error('Ce plan ne s’écrit pas semaine par semaine.');
  if ((await plansALaMain()).has(planId))
    throw new Error('Tu programmes cet athlète à la main : rien ne s’écrit dans son Nolio. Passe sa fiche en automatique pour lancer l’objectif.');
  if (!o.nolioAthlete) throw new Error('L’athlète n’a pas encore de compte Nolio relié.');
  const aujourdhui = aujourdhuiParis();
  const debut = o.plan.semaines.find((s) => s.lundi && ajouterJours(s.lundi, 6) >= aujourdhui);
  if (!debut?.lundi) throw new Error('La course est passée.');
  // OM4 : un objectif majeur à la fois, dans l'ordre des dates. Un objectif déjà en route dont la course vient après et
  // dont la préparation commence avant que celui-ci soit fini (sa récupération, puis la semaine qui serait sa reprise) :
  // celui-ci est une course de préparation. Une préparation qui commence plus tard (QD2, 24 semaines avant sa course)
  // ne gêne pas : les deux se suivent (défaut vu le 19/10/2026, essai sur « (toi) » : Gela, qui commençait en mars
  // 2027, bloquait Menestrail, couru en décembre 2026). Un objectif dont la course vient avant : celui-ci démarre le
  // lundi après sa récupération.
  const autres = await autresObjectifs(o);
  const fini = ajouterJours(debutApres({ course_date: o.plan.course.date, temps_h: o.tempsH, format: formatDe(o) }), 7);
  const enRoute = autres.find((q) => q.demarre && q.course_date >= aujourdhui && q.course_date > o.plan.course.date
    && !(q.debut && q.debut > fini));
  if (enRoute) {
    throw new Error(`Cet objectif tombe avant ${enRoute.course_nom} (${enRoute.course_date}), déjà en route : ajoute-le plutôt comme course de préparation, ou retire l’autre objectif.`);
  }
  const precedents = autres.filter((q) => q.course_date < o.plan.course.date && q.course_date >= ajouterJours(aujourdhui, -60));
  const apres = precedents.map((q) => ({ q, lundi: debutApres(q) })).sort((a, b) => b.lundi.localeCompare(a.lundi))[0];
  // PC1 : les séances que le coach a déjà posées restent ; l'écriture attend le lundi qui suit la dernière.
  const posees = await seancesDejaPosees(o, aujourdhui);
  const premierJour = debut.lundi > aujourdhui ? debut.lundi : aujourdhui;
  const derniere = [...o.plan.semaines].reverse().find((s) => s.lundi)?.lundi;
  if (aPartirDu && derniere && aPartirDu > derniere) throw new Error('Choisis un lundi avant la semaine de sa course.');
  const calcule = apres && apres.lundi > aujourdhui && (!posees || apres.lundi >= posees.lundi)
    ? { prevu: apres.lundi, apres: apres.q.course_nom, raison: 'recuperation' as const }
    : posees && posees.lundi > premierJour ? { prevu: posees.lundi, apres: posees.derniere, raison: 'seances' as const }
      // UN OBJECTIF LOINTAIN (décision coach du 22/10/2026) : sa préparation commence plus tard ; rien ne se pose
      // d'avance, le départ se programme au premier lundi de sa préparation (la veille au soir, comme les autres).
      : debut.lundi > ajouterJours(aujourdhui, 1) ? { prevu: debut.lundi, apres: debut.lundi, raison: 'preparation' as const }
        : lundi && lundi > aujourdhui ? { prevu: lundi, apres: aujourdhui, raison: 'seances' as const } : null;
  // LE DÉPART CHOISI PAR LE COACH (décision coach du 22/10/2026 : « en coaching individuel, il faut plus de liberté ») :
  // un lundi plus tard que le premier possible, par exemple après un objectif qu'il prépare à la main. Plus tôt, le
  // premier possible l'emporte : la préparation n'a pas de semaine avant, ses séances posées et la récupération d'un
  // autre objectif restent.
  const prevu = aPartirDu && aPartirDu > (calcule?.prevu ?? aujourdhui)
    ? { prevu: aPartirDu, apres: aujourdhui, raison: 'preparation' as const } : calcule;
  // UN DÉPART AU LUNDI QUI VIENT PART LA VEILLE (défaut vu le 22/10/2026 : programmé au lundi, il partait au passage
  // quotidien du lundi soir, la séance du jour arrivait trop tard) : sa première semaine part dès maintenant, le
  // dimanche soir, comme celles des autres ; plus loin, le départ se programme.
  if (prevu && prevu.prevu !== ajouterJours(aujourdhui, 1)) {
    await clientService().from('plans').update({ depart_prevu: prevu.prevu }).eq('id', planId);
    return prevu;
  }
  // La première semaine : celle d'aujourd'hui, ou, partie la veille, la première à partir du lundi qui vient.
  const premiere = prevu ? o.plan.semaines.find((s) => s.lundi && ajouterJours(s.lundi, 6) >= prevu.prevu) : debut;
  if (!premiere?.lundi) throw new Error('La course est passée.');
  const depart = prevu ? prevu.prevu : aujourdhui;
  // La reprise allégée : la première semaine écrite suit de près la récupération (pas une préparation qui commence des
  // semaines plus tard, QD2).
  const premier = premiere.lundi > depart ? premiere.lundi : depart;
  const reprise = Boolean(apres && apres.lundi >= ajouterJours(premier, -7));
  // Un seul départ à la fois : le premier appel prend la main ; en cas d'échec il la rend, pour un nouvel essai.
  const service = clientService();
  const { data: pris } = await service.from('plans').update({ demarre_le: new Date().toISOString() })
    .eq('id', planId).is('demarre_le', null).select('id');
  if (!pris?.length) return { numero: premiere.numero };
  try {
    // La saison de fond (décisions coach du 24/10/2026) : la préparation prend la suite, la saison s'arrête la veille de
    // sa première semaine et ses séances à venir quittent Nolio.
    if (o.coache) {
      const { arreterLaSaison } = await import('./fond');
      const { data: lien } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
      for (const saison of lien ? await arreterLaSaison(String(lien.athlete_id), premiere.lundi) : []) {
        await retirerDeNolio(saison, { depuis: premier });
      }
    }
    // Juste après la course d'un autre objectif : calé sur ce que l'athlète y a vraiment couru.
    if (reprise && apres && !o.envois.length) await recalerSurLePrecedent(o, apres.q.id, premier);
    // Une charge déclarée il y a plus de 4 semaines (un objectif lointain) : relue dans Nolio au départ réel.
    else if (o.coache && !o.envois.length && String(o.parametres.declaree_le ?? '') < ajouterJours(premier, -28)) {
      await recalerSurNolio(o, premier).catch((e) => console.error(`Recalage de ${planId} :`, e instanceof Error ? e.message : e));
    }
    if (o.coache && !o.envois.length) {
      await ancrerAuDepart(o, premier).catch((e) => console.error(`Ancrage de ${planId} :`, e instanceof Error ? e.message : e));
    }
    // Deux allégées de suite, jamais (décision coach du 26/10/2026) : un départ sur la semaine allégée du plan, sa
    // dernière semaine déjà basse dans Nolio, la fait passer en charge.
    if (o.coache && !o.envois.length && premiere.type === 'Assimilation') {
      await marquerDerniereAllegee(o, premiere.lundi).catch((e) => console.error(`Semaine allégée de ${planId} :`, e instanceof Error ? e.message : e));
    }
    await dimancheDeLAcheteur(o);
    // OM3 : l'objectif et ses courses de préparation, en compétitions dans Nolio.
    const { course } = o.plan;
    await poserCourse(o, { nom: course.nom, date: course.date, distance_km: course.distance_km, dplus_m: course.dplus_m }, true);
    for (const c of ((o.parametres.courses_secondaires ?? []) as Course[])) if (c.date >= aujourdhui) await poserCourse(o, c, false);
    // PO4 : la fiche d'une course de préparation qui tombe dans sa première semaine ; les suivantes partent avec la leur.
    await fichesDesPreparations(o, ajouterJours(premiere.lundi, 6));
    const deja = o.envois.some((e) => e.semaine === premiere.numero);
    if (!deja) await ecrireEtEnvoyer(o, premiere.numero, null, { depuis: depart > premiere.lundi ? depart : undefined, reprise });
    if (!o.coache) await rangerAcheteur(o);
  } catch (e) {
    await service.from('plans').update({ demarre_le: null }).eq('id', planId);
    if (prevenir && !o.coache) {
      await prevenirCoach('Plan CTS : une préparation n’a pas démarré dans Nolio',
        `La préparation de l’acheteur du plan « ${o.plan.course.nom} » n’a pas démarré dans Nolio : `
        + `${e instanceof Error ? e.message : String(e)} Le site réessaie chaque jour à 18 h 30 ; sa première semaine part `
        + 'au premier essai réussi, à partir de ce jour-là.');
    }
    throw e;
  }
  return { numero: premiere.numero };
}

// OM4 (décision coach du 21/10/2026) : un objectif qui démarre juste après la course d'un autre part de ce que
// l'athlète y a vraiment couru — le volume moyen de ses 4 dernières semaines faites, sa plus longue sortie (hors course :
// la semaine de la course ne s'écrit pas) —, comme un plan rejoint ce jour-là, et non des chiffres saisis à sa création.
// Sans historique, ou refusés par le moteur, ces chiffres restent.
// LA CHARGE RECALÉE AU DÉPART RÉEL (décision coach du 22/10/2026, « recalée au départ réel ») : un objectif lointain part
// sur ce que l'athlète court au moment où sa préparation commence, ses 4 dernières semaines dans Nolio (avec son accord
// de lecture, chargeDepuisNolio) ; sans accord ou sans course lue, la charge saisie à la création reste.
async function recalerSurNolio(o: Objectif, lundi: string) {
  const charge = (await chargeDepuisNolio(o.coachId, o.nolioAthlete))?.champs;
  if (!charge?.volume_hebdo_actuel) return;
  const champs = { ...((o.parametres.champs ?? {}) as Record<string, unknown>), ...charge };
  const parametres = { ...o.parametres, champs, declaree_le: lundi };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return;
  }
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// Sa dernière semaine courue, déjà allégée (lue dans Nolio, sous 75 % de la moyenne de ses 4) : « allegee_en_charge », le
// lundi de sa première semaine écrite, que le moteur passe alors en charge (cts_semaine, cts_orchestrateur, cts_route).
async function marquerDerniereAllegee(o: Objectif, lundi: string) {
  const lu = await chargeDepuisNolio(o.coachId, o.nolioAthlete);
  if (!lu?.derniereAllegee) return;
  const parametres = { ...o.parametres, allegee_en_charge: lundi };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return;
  }
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// La semaine rejointe est celle de la déclaration (cts_orchestrateur, B4) : un départ plus d'une semaine après elle (un
// lundi choisi par le coach, des séances déjà posées) la reporte au premier lundi écrit, pour que chaque progression y
// parte du plancher (D2) au lieu de supposer courues des semaines qu'il n'a pas faites. La charge déclarée reste.
async function ancrerAuDepart(o: Objectif, lundi: string) {
  if (String(o.parametres.declaree_le ?? '') >= ajouterJours(lundi, -7)) return;
  const parametres = { ...o.parametres, declaree_le: lundi };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return;
  }
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// Ses 4 semaines d'entraînement avant l'affûtage de l'objectif d'avant, ni la course ni l'affûtage (décision coach du
// 23/10/2026) : leurs volumes vraiment courus, et ses sorties longues vraiment courues.
export function avantAffutage(semaines: Pick<Semaine, 'numero_int' | 'bloc'>[],
  etat: { volumes_reels?: Record<string, number>; sl_reelles?: Record<string, number> } | null) {
  const i = semaines.findIndex((s) => s.bloc === 'Affûtage');
  const numeros = (i >= 0 ? semaines.slice(0, i) : semaines.slice(0, -2)).slice(-4).map((s) => String(s.numero_int));
  const volumes = numeros.filter((n) => etat?.volumes_reels?.[n] !== undefined).map((n) => Number(etat?.volumes_reels?.[n]));
  const sl = numeros.map((n) => Number(etat?.sl_reelles?.[n] ?? 0)).filter((v) => v > 0);
  return { volumes, sl };
}

async function recalerSurLePrecedent(o: Objectif, precedentId: string, lundi: string) {
  const service = clientService();
  const { data } = await service.from('plans').select('etat_ecriture, donnees').eq('id', precedentId).maybeSingle();
  const etat = (data?.etat_ecriture ?? null) as { volumes_reels?: Record<string, number>; sl_reelles?: Record<string, number> } | null;
  const { volumes, sl } = avantAffutage(((data?.donnees ?? null) as Plan | null)?.semaines ?? [], etat);
  if (!volumes.some((v) => v > 0)) return;
  // « 4h05 », comme le moteur les écrit (cts_semaine._duree_texte).
  const duree = (min: number) => { const m = Math.round(min); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
  const champs = {
    ...((o.parametres.champs ?? {}) as Record<string, unknown>),
    // Le volume du moment (décision coach du 24/10/2026) : sa dernière semaine, bornée par la moyenne et la moyenne +30 %.
    volume_hebdo_actuel: duree(volumeDuMoment(volumes).retenu),
    ...(sl.length ? { sortie_longue_actuelle: duree(Math.max(...sl)) } : {}),
  };
  const parametres = { ...o.parametres, champs, declaree_le: lundi };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return;
  }
  await service.from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// Les autres objectifs écrits semaine par semaine du même athlète (sa fiche de coaché, ou son compte d'acheteur).
type Voisin = { id: string; course_nom: string; course_date: string; temps_h: number; demarre: boolean; debut: string | null;
  format: string };
async function autresObjectifs(o: Objectif): Promise<Voisin[]> {
  const service = clientService();
  const { data: coaching } = await service.from('coaching').select('plan_id, athlete_id');
  let ids: string[];
  if (o.coache) {
    const fiche = (coaching ?? []).find((c) => c.plan_id === o.planId)?.athlete_id;
    ids = (coaching ?? []).filter((c) => c.athlete_id === fiche).map((c) => c.plan_id as string);
  } else {
    const coaches = new Set((coaching ?? []).map((c) => c.plan_id as string));
    const { data } = await service.from('plans').select('id').eq('compte_id', o.compteId);
    ids = (data ?? []).map((p) => p.id as string).filter((id) => !coaches.has(id));
  }
  ids = ids.filter((id) => id !== o.planId);
  if (!ids.length) return [];
  const { data } = await service.from('plans').select('id, course_nom, course_date, intake, demarre_le, debut:donnees->semaines->0->>lundi')
    .in('id', ids).not('parametres', 'is', null);
  return (data ?? []).map((p) => ({
    id: p.id as string, course_nom: p.course_nom as string, course_date: p.course_date as string,
    temps_h: heures((p.intake as Record<string, unknown> | null)?.temps_cible), demarre: Boolean(p.demarre_le),
    debut: (p.debut ?? null) as string | null, format: String((p.intake as Record<string, unknown> | null)?.format ?? ''),
  }));
}

// « 5h30 », « 5:30 », « 18h » : des heures ; 0 illisible.
function heures(brut: unknown): number {
  const m = /^\s*(\d{1,3})\s*[h:]\s*(\d{0,2})/.exec(String(brut ?? ''));
  return m ? Number(m[1]) + Number(m[2] || 0) / 60 : 0;
}

// Le lundi qui suit la récupération d'une course (O3 : un jour sans séance dure par heure de course, 2 au moins).
// Le format d'un objectif (« R42 » pour un marathon sur route), tel que ses paramètres le gardent.
function formatDe(o: Pick<Objectif, 'parametres'>): string {
  return String(((o.parametres.champs ?? {}) as Record<string, unknown>).format ?? '');
}

// LA RÉCUPÉRATION APRÈS UN MARATHON (décision 7 du marathon, 23/10/2026) : deux semaines, puis la reprise ; ailleurs,
// un jour sans séance dure par heure de course, deux au moins (décision du 21/10), jusqu'au lundi qui suit.
const RECUPERATION_MARATHON_J = 14;
export function debutApres(q: Pick<Voisin, 'course_date' | 'temps_h'> & { format?: string }): string {
  const fin = ajouterJours(q.course_date, q.format === 'R42' ? RECUPERATION_MARATHON_J : Math.max(2, Math.ceil(q.temps_h)));
  const rang = (new Date(`${fin}T12:00:00Z`).getUTCDay() + 6) % 7;
  return ajouterJours(fin, 7 - rang);
}

// Les objectifs programmés (OM4) qui démarrent aujourd'hui, et les départs d'acheteurs restés en échec (décision coach
// du 20/10/2026), repris en silence : le coach a été prévenu au premier échec. budgetMs (décision coach du 22/10/2026 :
// tous ses coachés démarrent le même dimanche) : passé ce temps, les départs suivants attendent le passage suivant
// (REMIS), plutôt qu'une coupure en cours de départ ; le passage du dimanche les reprend aussi, à 17 h, 19 h et 21 h UTC.
async function departsDuJour(budgetMs = 120_000): Promise<Compte[]> {
  const debut = Date.now();
  const aujourdhui = aujourdhuiParis();
  // Un départ au lundi qui vient part la veille (défaut vu le 22/10/2026) : demarrerObjectif l'écrit dès ce soir.
  const demain = ajouterJours(aujourdhui, 1);
  const { data: tous } = await clientService().from('plans').select('id, depart_prevu, nolio_statut').is('demarre_le', null)
    .not('parametres', 'is', null).gte('course_date', aujourdhui)
    .or(`depart_prevu.lte.${demain},and(depart_prevu.is.null,nolio_statut.eq.actif)`);
  // Un plan acheté par un athlète en coaching attend le bouton de son coach (décision coach du 23/10/2026).
  const data = (tous ?? []).filter((x) => x.nolio_statut !== 'coaching');
  const comptes: Compte[] = [];
  const aLaMain = await plansALaMain();
  for (const p of (data ?? []).filter((x) => !aLaMain.has(x.id as string))) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: p.id as string, quoi: REMIS });
      continue;
    }
    try {
      const d = await demarrerObjectif(p.id as string, { prevenir: p.depart_prevu === demain, lundi: (p.depart_prevu as string | null) ?? undefined });
      comptes.push({ plan: p.id as string, quoi: 'numero' in d ? `démarré (${d.numero})` : `reprogrammé au ${d.prevu}` });
    } catch (e) {
      comptes.push({ plan: p.id as string, quoi: 'départ non fait', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// ─── Le dimanche, chaque jour ─────────────────────────────────────────────

// Les plans écrits semaine par semaine dont l'athlète est dans Nolio et la course à venir.
// Les objectifs des athlètes que le coach programme à la main (décision coach du 20/10/2026, « tableau de bord
// complet ») : le moteur n'y écrit rien, ni semaine, ni trame, ni questionnaire ; l'app reste leur tableau de bord. Et
// ceux des athlètes passés en mode plan (décision coach du 23/10/2026) : rien ne s'y écrit non plus. Les colonnes lues
// après coup : sans la migration, rien n'est retenu.
export async function plansALaMain(): Promise<Set<string>> {
  const service = clientService();
  const { data: toutes, error } = await service.from('athletes_coaches').select('*');
  const fiches = (toutes ?? []).filter((f) => f.programmation === 'main' || f.mode === 'plan');
  if (error || !fiches.length) return new Set();
  const { data } = await service.from('coaching').select('plan_id').in('athlete_id', fiches.map((f) => f.id));
  return new Set((data ?? []).map((c) => c.plan_id as string));
}

async function plansActifs(): Promise<string[]> {
  const service = clientService();
  // Seulement les objectifs démarrés dans Nolio : un objectif que le coach n'a pas encore lancé, ou programmé après un
  // autre (OM4), ne s'écrit pas.
  const { data } = await service.from('plans').select('id, nolio_statut, course_date').not('parametres', 'is', null)
    .not('demarre_le', 'is', null).gte('course_date', aujourdhuiParis());
  const { data: coaches } = await service.from('coaching').select('plan_id');
  const coachesIds = new Set((coaches ?? []).map((c) => c.plan_id as string));
  const aLaMain = await plansALaMain();
  return (data ?? []).filter((p) => (p.nolio_statut === 'actif' || coachesIds.has(p.id as string)) && !aLaMain.has(p.id as string))
    .map((p) => p.id as string);
}

// Les objectifs de coachés dont la course est passée depuis moins de 6 semaines, démarrés, en programmation automatique :
// leurs semaines de récupération s'écrivent le dimanche (semaineDeRecuperation, décision coach du 23/10/2026).
async function plansEnRecuperation(): Promise<string[]> {
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  const { data: tous } = await service.from('plans').select('id, parametres').not('parametres', 'is', null).not('demarre_le', 'is', null)
    .lt('course_date', aujourdhui).gte('course_date', ajouterJours(aujourdhui, -42));
  // Une saison de fond n'a pas de course : rien à récupérer (décisions coach du 24/10/2026).
  const data = (tous ?? []).filter((p) => !(p.parametres as { fond?: unknown } | null)?.fond);
  if (!data.length) return [];
  const { data: coaches } = await service.from('coaching').select('plan_id');
  const coachesIds = new Set((coaches ?? []).map((c) => c.plan_id as string));
  const aLaMain = await plansALaMain();
  return data.map((p) => p.id as string).filter((id) => coachesIds.has(id) && !aLaMain.has(id));
}

export type Compte = { plan: string; quoi: string; erreur?: string; coache?: boolean; journal?: Record<string, unknown>[] };

// Chaque dimanche soir : la semaine suivante de chaque plan actif, écrite d'après la semaine écoulée. Un budget de temps
// (la fonction est coupée à 300 s) : au-delà, les plans restants sont remis aux reprises du soir (vercel.json), qui ne
// font que ce qui manque. Un verrou par semaine : le passage la réserve (une ligne vide de nolio_envois, unique par plan
// et par semaine) avant de l'écrire, si bien que deux passages lancés ensemble ne la doublent jamais dans Nolio ; un
// échec avant toute création la libère pour la reprise (décision coach du 20/10/2026 : sécuriser le dimanche).
export const REMIS = 'remis à la reprise';
export async function passageDuDimanche(budgetMs = 240_000): Promise<Compte[]> {
  const debut = Date.now();
  const aujourdhui = aujourdhuiParis();
  const lundi = ajouterJours(aujourdhui, 1);
  // Les départs du lundi d'abord (leur première semaine part avec eux), dans une partie du temps du passage.
  const comptes: Compte[] = await departsDuJour(budgetMs * 0.75);
  const service = clientService();
  for (const planId of [...await plansActifs(), ...await plansEnRecuperation()]) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: REMIS });
      continue;
    }
    let reservee: string | null = null;
    try {
      const o = await objectifEcrit(planId);
      if (!o?.nolioAthlete) continue;
      const s = semaineDu(o.plan, lundi);
      const recuperation = s ? null : semaineDeRecuperation(o, lundi);
      const numero = s?.numero ?? recuperation?.numero;
      if (!numero || o.envois.some((e) => e.semaine === numero)) continue;
      // PC1 pour la récupération : une séance de course que le coach a posée cette semaine-là, et elle reste la sienne.
      if (recuperation && await seancesDejaPosees(o, lundi, ajouterJours(lundi, 6))) {
        comptes.push({ plan: planId, quoi: `${numero} : récupération laissée, séances du coach gardées`, coache: true });
        continue;
      }
      // LA SAISON DE FOND (décisions coach du 24/10/2026) : une préparation qui a pris cette semaine arrête la saison ;
      // des séances que le coach a déjà posées cette semaine restent, rien ne s'y écrit (comme la récupération) ; sa
      // première semaine s'écrit sans les retours, comme un départ (sans semaine écrite avant, le moteur lirait un arrêt).
      const fond = Boolean((o.parametres as { fond?: unknown }).fond);
      if (fond) {
        const { arreterLaSaison, semainePriseParUnObjectif } = await import('./fond');
        const athlete = await semainePriseParUnObjectif(planId, lundi);
        if (athlete) {
          await arreterLaSaison(athlete, lundi);
          comptes.push({ plan: planId, quoi: `${numero} : saison de fond arrêtée, une préparation prend la suite`, coache: true });
          continue;
        }
        if (await seancesDejaPosees(o, lundi, ajouterJours(lundi, 6))) {
          comptes.push({ plan: planId, quoi: `${numero} : saison de fond laissée, séances du coach gardées`, coache: true });
          continue;
        }
      }
      const { data: prise } = await service.from('nolio_envois')
        .upsert({ plan_id: planId, semaine: numero, coach_id: o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true })
        .select('plan_id');
      if (!prise?.length) continue;
      reservee = numero;
      const retours = fond && !o.envois.some((e) => /^S\d+$/.test(e.semaine)) ? null : await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
      const sortie = recuperation
        ? await ecrireLaRecuperation(o, numero, recuperation.jusqua, retours)
        : await ecrireEtEnvoyer(o, numero, retours);
      comptes.push({ plan: planId, quoi: `${numero} écrite${recuperation ? ' (récupération)' : ''}`, coache: o.coache, journal: sortie.journal });
    } catch (e) {
      if (reservee) {
        // Rien de créé dans Nolio : la semaine se libère pour la reprise. Sinon, ce qui est créé reste noté (pas de doublon).
        const { data: ligne } = await service.from('nolio_envois').select('seances').eq('plan_id', planId).eq('semaine', reservee).maybeSingle();
        if (!((ligne?.seances as unknown[] | undefined) ?? []).length) {
          await service.from('nolio_envois').delete().eq('plan_id', planId).eq('semaine', reservee);
        }
      }
      comptes.push({ plan: planId, quoi: 'semaine non écrite', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// Les retours tardifs (décision coach du 20/10/2026, « oui, chaque nuit ») : chaque nuit, le résumé des deux dernières
// semaines écrites par le moteur se refait avec ce que l'athlète a rempli depuis dans Nolio (RPE, sensations, Hooper),
// pour ses graphiques ; les décisions du dimanche restent les siennes, rien n'est réécrit (POST /v1/realise). Avec
// l'accord de lecture seulement.
export async function refaireLesResumes(budgetMs = 120_000): Promise<Compte[]> {
  const debut = Date.now();
  const aujourdhui = aujourdhuiParis();
  const lundi = ajouterJours(aujourdhui, -((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  const voulus = new Set([ajouterJours(lundi, -7), ajouterJours(lundi, -14)]);
  const service = clientService();
  const { data: lignes, error } = await service.from('semaines_ecrites').select('plan_id, numero, lundi:donnees->>lundi')
    .not('realise', 'is', null).gte('ecrite_le', new Date(Date.now() - 28 * 86400_000).toISOString());
  if (error) throw new Error(`semaines écrites : ${error.message}`);
  const comptes: Compte[] = [];
  for (const l of (lignes ?? []) as { plan_id: string; numero: string; lundi: string | null }[]) {
    if (!l.lundi || !voulus.has(l.lundi)) continue;
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: l.plan_id, quoi: 'remis à la nuit suivante' });
      continue;
    }
    try {
      const o = await objectifEcrit(l.plan_id);
      if (!o?.nolioAthlete || !o.accordLecture || !o.etat) continue;
      const retours = await lireRetours(o, l.lundi, aujourdhui);
      const { realise } = await moteur<{ realise: Realise | null }>('/v1/realise', { etat: o.etat, numero: l.numero, retours });
      if (!realise) continue;
      await service.from('semaines_ecrites').update({ realise }).eq('plan_id', l.plan_id).eq('numero', l.numero);
      comptes.push({ plan: l.plan_id, quoi: `${l.numero} résumée à nouveau`, coache: o.coache });
    } catch (e) {
      comptes.push({ plan: l.plan_id, quoi: 'résumé non refait', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// Une séance d'une semaine écrite, sous la forme de l'app, et sa version EF (adaptation.ef).
async function semaineEcrite(planId: string, numero: string): Promise<Semaine | null> {
  const { data } = await clientService().from('semaines_ecrites').select('donnees').eq('plan_id', planId).eq('numero', numero).maybeSingle();
  return (data?.donnees ?? null) as Semaine | null;
}

// R3 en cours de semaine : la séance dure qui vient devient une EF, une note le dit avec le lien du veto.
export async function fatigueDuJour(planId: string): Promise<Compte | null> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete || !o.accordLecture || !o.etat) return null;
  const aujourdhui = aujourdhuiParis();
  const retours = await lireRetours(o, ajouterJours(aujourdhui, -10), aujourdhui);
  const r = await moteur<{ remplacer: string | null; note?: string; journal?: Record<string, unknown>; etat?: Etat }>(
    '/v1/fatigue', { etat: o.etat, retours, aujourdhui });
  if (!r.remplacer || !r.etat) return null;
  const numero = r.remplacer.split('-')[0];
  const semaine = await semaineEcrite(planId, numero);
  const jour = semaine?.jours.find((j) => j.id === r.remplacer);
  const ef = (jour as unknown as { adaptation?: { ef?: Record<string, unknown> | null } })?.adaptation?.ef;
  if (!semaine || !jour || !ef) return null;
  // La séance d'origine reste dans le jour allégé : le veto la rend telle qu'elle était, ajustements du dimanche compris.
  const modifiee = { ...semaine, jours: semaine.jours.map((j) => (j.id === r.remplacer
    ? { ...j, ...ef, id: j.id, jour: j.jour, date: j.date, date_iso: j.date_iso, origine: j } : j)) } as Semaine;
  await mettreAJourSemaineCible(o, numero, modifiee);
  await clientService().from('semaines_ecrites').update({ donnees: modifiee }).eq('plan_id', planId).eq('numero', numero);
  await clientService().from('plans').update({ etat_ecriture: r.etat }).eq('id', planId);
  if (jour.date_iso) {
    const lien = `${site.url}/app/garder?plan=${planId}&seance=${encodeURIComponent(r.remplacer)}`;
    // Sans espace dans l'app, pas de lien : il le dit à son coach, qui la remet depuis son Suivi.
    const suite = sansApp(o) ? 'Tu préfères garder ta séance d’origine ? Dis-le à ton coach dans Nolio.' : `Garder ma séance d’origine : ${lien}`;
    await garderNote(o, `${r.remplacer}:fatigue`, jour.date_iso, 'Séance allégée', `${r.note} ${suite}`);
  }
  return { plan: planId, quoi: `${r.remplacer} allégée`, coache: o.coache, journal: r.journal ? [r.journal] : [] };
}

// Le veto : l'athlète garde sa séance d'origine, celle d'avant l'allègement (gardée dans le jour allégé) ; l'état
// oublie l'allègement (A8 : la marche n'est pas reprise).
export async function garderSeanceOrigine(planId: string, seance: string, compteId: string): Promise<boolean> {
  const o = await objectifEcrit(planId);
  if (!o || ![o.compteId, o.coachId, o.compteAthlete].includes(compteId) || !o.etat) return false;
  const numero = seance.split('-')[0];
  const actuelle = await semaineEcrite(planId, numero);
  const jourOrigine = (actuelle?.jours.find((j) => j.id === seance) as unknown as { origine?: Semaine['jours'][number] })?.origine;
  if (!actuelle || !jourOrigine) return false;
  const modifiee = { ...actuelle, jours: actuelle.jours.map((j) => (j.id === seance ? jourOrigine : j)) } as Semaine;
  await mettreAJourSemaineCible(o, numero, modifiee);
  const { etat } = await moteur<{ etat: Etat }>('/v1/veto', { etat: o.etat, id: seance });
  await clientService().from('semaines_ecrites').update({ donnees: modifiee }).eq('plan_id', planId).eq('numero', numero);
  await clientService().from('plans').update({ etat_ecriture: etat }).eq('id', planId);
  return true;
}

// Le coach annule les ajustements d'une semaine (« Annuler » dans le Suivi) : elle se réécrit sans les règles du
// dimanche, à partir de l'état d'avant, et se met à jour dans Nolio (ses retouches gardées).
export async function annulerAjustements(planId: string, numero: string): Promise<void> {
  const o = await objectifEcrit(planId);
  if (!o) throw new Error('Plan introuvable');
  const { data: ecrite } = await clientService().from('semaines_ecrites').select('etat_avant').eq('plan_id', planId).eq('numero', numero).maybeSingle();
  if (!ecrite) throw new Error('Semaine pas encore écrite');
  o.etat = (ecrite.etat_avant ?? null) as Etat | null;
  await ecrireEtEnvoyer(o, numero, null, { sansAjustement: true });
}

// T5 : l'acheteur retire son accord de lecture (dans son Compte). La lecture de son RPE, de son ressenti et de son
// Hooper s'arrête ; les chiffres gardés de ses semaines s'effacent ; son questionnaire Hooper du dimanche quitte
// Nolio (les réponses déjà envoyées y restent, à lui). Le plan suit sa trame, le questionnaire de la semaine et les
// séances faites ou manquées, sans ajustement de fatigue ni graphiques.
export async function retirerAccordLecture(planId: string): Promise<void> {
  const o = await objectifEcrit(planId);
  if (!o || o.coache) throw new Error('Plan introuvable');
  const service = clientService();
  await service.from('plans').update({ accord_lecture_le: null }).eq('id', planId);
  await service.from('semaines_ecrites').update({ realise: null }).eq('plan_id', planId);
  await service.from('tests_lus').delete().eq('plan_id', planId);
  // Ses badges partent avec l'accord (BG1 à BG3, décisions coach du 20/10/2026).
  if (o.nolioAthlete) await service.from('badges').delete().eq('nolio_athlete_id', o.nolioAthlete);
  const hooper = o.envois.find((e) => e.semaine === QUESTIONNAIRES)?.seances.find((s) => s.jour_id === 'questionnaire:hooper');
  // Les questionnaires du soir des tests de la parole à venir (TN4) quittent Nolio avec le Hooper.
  const paroles = o.envois.filter((e) => e.semaine.endsWith(':parole')).flatMap((e) => e.seances as SeanceEnvoyee[]);
  if (o.nolioAthlete) {
    const d = await destinataire(o.nolioAthlete);
    for (const [q, recurrence] of [...(hooper ? [[hooper, 'all'] as const] : []), ...paroles.map((p) => [p, 'one'] as const)]) {
      if (!q.nolio_id) continue;
      let r = await appelNolio('DELETE', `planned/quizzes/${q.nolio_id}/?recurrence_action=${recurrence}${d.moi ? '' : `&athlete=${d.usr}`}`)
        .catch(() => null);
      // Un Hooper seul (une semaine à la fois, depuis le 23/10/2026) : sans série, il part seul.
      if (r && r.statut === 400 && recurrence === 'all') {
        r = await appelNolio('DELETE', `planned/quizzes/${q.nolio_id}/?recurrence_action=one${d.moi ? '' : `&athlete=${d.usr}`}`).catch(() => null);
      }
      if (r && r.statut !== 204 && r.statut !== 200 && r.statut !== 404) console.error(`Questionnaire de ${planId} non retiré de Nolio : ${r.statut}`);
    }
  }
}

// Le retrait d'un objectif écrit semaine par semaine (décision coach du 19/10/2026) : ce qu'il a posé dans Nolio et qui
// est encore à venir (à partir de demain) en part — bandeaux, notes, séances, compétitions, et la suite de ses
// séries de questionnaires ; le passé reste (les séances faites, les questionnaires remplis). Seuls les éléments que
// l'objectif a lui-même posés (nolio_envois) sont touchés. Rend ce qui n'a pas pu partir, [] si tout va.
// depuis : à partir de quel jour les séances, notes, bandeaux et courses partent (demain par défaut ; le lundi qui
// vient quand l'athlète change de mode, décision coach du 23/10/2026 : sa semaine en cours reste) ; les questionnaires
// partent toujours dès demain.
export async function retirerDeNolio(planId: string, { depuis }: { depuis?: string } = {}): Promise<string[]> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete || !o.envois.length) return [];
  const d = await destinataire(o.nolioAthlete);
  const qui = d.moi ? '' : `athlete=${d.usr}`;
  // Demain et après : une séance du jour a pu être faite, elle reste reliée à ce qui a été couru.
  const demain = ajouterJours(aujourdhuiParis(), 1);
  const debut = depuis && depuis > demain ? depuis : demain;
  const au = ajouterJours(o.plan.course.date, 1);
  const poses = new Set(o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]).map((s) => String(s.nolio_id ?? '')).filter(Boolean));
  const soucis: string[] = [];
  const retirer = async (chemin: string, quoi: string) => {
    const r = await appelNolio('DELETE', `${chemin}${chemin.includes('?') ? (qui ? `&${qui}` : '') : (qui ? `?${qui}` : '')}`).catch(() => null);
    if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, quoi) : `${quoi} : Nolio injoignable`);
  };
  for (const [genre, quoi] of [['trainings', 'une séance'], ['notes', 'une note'], ['cycles', 'un bandeau'], ['competitions', 'une course']]) {
    const avenir = await listeNolio<{ id: string; date_start: string }>(`planned/${genre}/?date_from=${debut}&date_to=${au}${qui ? `&${qui}` : ''}`);
    for (const x of avenir) if (poses.has(x.id) && x.date_start.slice(0, 10) >= debut) await retirer(`planned/${genre}/${x.id}/`, quoi);
  }
  // Les questionnaires : une série part à partir de sa première occurrence à venir (`following`), un questionnaire seul
  // (le soir d'un test de la parole) part s'il est à venir.
  const quiz = [...poses].filter((id) => id.startsWith('pqz_'));
  if (quiz.length) {
    const series = new Set<string>();
    for (const id of quiz) {
      const r = await appelNolio('GET', `planned/quizzes/${id}/${qui ? `?${qui}` : ''}`).catch(() => null);
      const serie = r?.statut === 200 ? (r.corps?.recurrence as { id?: string } | null | undefined)?.id : undefined;
      if (serie) series.add(serie);
    }
    type Quiz = { id: string; date_start: string; recurrence?: { id?: string } | null };
    const avenir = (await listeNolio<Quiz>(`planned/quizzes/?date_from=${demain}&date_to=${au}${qui ? `&${qui}` : ''}`))
      .filter((q) => q.date_start.slice(0, 10) >= demain).sort((a, b) => a.date_start.localeCompare(b.date_start));
    const faites = new Set<string>();
    for (const q of avenir) {
      const serie = q.recurrence?.id;
      if (serie && series.has(serie)) {
        if (faites.has(serie)) continue;
        faites.add(serie);
        await retirer(`planned/quizzes/${q.id}/?recurrence_action=following`, 'les questionnaires');
      } else if (!serie && poses.has(q.id)) {
        await retirer(`planned/quizzes/${q.id}/`, 'un questionnaire');
      }
    }
  }
  return soucis;
}

// ─── Les courses dans Nolio (OM3, décision coach du 19/10/2026) ─────────────

// Le « Trail » et la « Course à pied » du catalogue de Nolio (cts_nolio.SPORT_TRAIL et SPORT_COURSE, GET /api/v2/sports/).
const SPORT_TRAIL = 'spt_YprHS7jgV5vdsz0';
const SPORT_COURSE_A_PIED = 'spt_kNYHjuEzDJRiYCX';
// discipline : « route » pour une course sur route (décision coach du 23/10/2026), le trail sinon.
export type Course = { nom: string; date: string; distance_km: number; dplus_m: number; chrono?: string | null; temps_h?: number | null;
  discipline?: 'trail' | 'route' };

// La fiche de course d'une course de préparation part avec la semaine où elle tombe (une semaine avant la course, ou
// tout de suite si la course est plus proche ; décision coach du 23/10/2026, une semaine à la fois) : celles qui tombent
// jusqu'au jusqua, par défaut la fin de la dernière semaine déjà envoyée.
export async function fichesDesPreparations(o: Objectif, jusqua?: string) {
  const aujourdhui = aujourdhuiParis();
  const courses = ((o.parametres.courses_secondaires ?? []) as Course[]).filter((c) => c.date >= aujourdhui);
  if (!courses.length) return;
  const lundis = new Map(o.plan.semaines.map((s) => [s.numero, s.lundi]));
  const fin = jusqua ?? o.envois.filter((e) => /^S\d+$/.test(e.semaine)).map((e) => lundis.get(e.semaine))
    .filter((l): l is string => Boolean(l)).map((l) => ajouterJours(l, 6)).sort().pop() ?? aujourdhui;
  const { data: fp } = await clientService().from('plans').select('fiches_preparation').eq('id', o.planId).maybeSingle();
  const fiches = ((fp as { fiches_preparation?: Record<string, unknown> } | null)?.fiches_preparation ?? {});
  for (const c of courses) {
    if (fiches[c.date] && ajouterJours(c.date, -7) <= fin) {
      await poserFichePreparation(o, c).catch((e) => console.error(`Fiche de ${o.planId} non posée dans Nolio :`, e instanceof Error ? e.message : e));
    }
  }
}

// PO4 (décision coach du 19/10/2026) : la fiche de course d'une course de préparation, en note Nolio une semaine avant
// (dès aujourd'hui si la course est plus proche), avec son lien privé, comme la fiche de course de l'objectif ; en ocre,
// la couleur des fiches.
export async function poserFichePreparation(o: Objectif, c: Course) {
  const cle = `fiche:${c.date}`;
  if (!o.nolioAthlete || o.envois.some((e) => e.semaine === cle)) return;
  const d = await destinataire(o.nolioAthlete);
  const aujourdhui = aujourdhuiParis();
  const jour = ajouterJours(c.date, -7) > aujourdhui ? ajouterJours(c.date, -7) : aujourdhui;
  const cree = await creer(d, cle, {
    name: `Ta fiche course : ${c.nom}`, date_start: jour, color: '#9A6A12',
    description: `Ta course de préparation approche : son profil, ses tronçons et ta stratégie nutritionnelle. ${lienFicheCourse(o.planId)}?course=${c.date}`,
  }, 'note');
  if (cree.erreur) throw new Error(cree.erreur);
  await garderEnvoi(o.coachId, o.planId, cle, [cree]);
  o.envois.push({ semaine: cle, envoye_le: new Date().toISOString(), seances: [cree] });
}

// Une course de préparation retirée par l'athlète (décision coach du 20/10/2026) : ce que le site en a posé dans Nolio
// (la course, le rappel de sa fiche) part s'il est encore à venir, et ces envois sont oubliés ; ce qui est passé reste.
export async function retirerCourseDeNolio(o: Objectif, date: string): Promise<string[]> {
  const cles = [`course:${date}`, `fiche:${date}`];
  const envois = o.envois.filter((e) => cles.includes(e.semaine));
  const soucis: string[] = [];
  if (o.nolioAthlete && envois.length) {
    const d = await destinataire(o.nolioAthlete);
    const qui = d.moi ? '' : `athlete=${d.usr}`;
    const demain = ajouterJours(aujourdhuiParis(), 1);
    const poses = new Set(envois.flatMap((e) => e.seances as SeanceEnvoyee[]).map((s) => String(s.nolio_id ?? '')).filter(Boolean));
    for (const [genre, quoi] of [['competitions', 'la course'], ['notes', 'le rappel de sa fiche']]) {
      const avenir = await listeNolio<{ id: string; date_start: string }>(
        `planned/${genre}/?date_from=${demain}&date_to=${ajouterJours(date, 1)}${qui ? `&${qui}` : ''}`).catch(() => []);
      for (const x of avenir.filter((y) => poses.has(y.id) && y.date_start.slice(0, 10) >= demain)) {
        const r = await appelNolio('DELETE', `planned/${genre}/${x.id}/${qui ? `?${qui}` : ''}`).catch(() => null);
        if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, quoi) : `${quoi} : Nolio injoignable`);
      }
    }
  }
  await clientService().from('nolio_envois').delete().eq('plan_id', o.planId).in('semaine', cles);
  return soucis;
}

// Une course posée en compétition dans le calendrier Nolio de l'athlète : l'objectif principal (trophée d'or) ou une
// course de préparation (d'argent) ; une compétition déjà posée ce jour-là (par le coach ou l'athlète) n'est pas
// doublée, ni une course déjà posée par le site.
export async function poserCourse(o: Objectif, c: Course, principale: boolean) {
  const cle = `course:${c.date}`;
  if (!o.nolioAthlete || o.envois.some((e) => e.semaine === cle)) return;
  const d = await destinataire(o.nolioAthlete);
  const deja = await listeNolio<{ id: string; date_start: string }>(
    `planned/competitions/?date_from=${c.date}&date_to=${c.date}${d.moi ? '' : `&athlete=${d.usr}`}`).catch(() => []);
  if (deja.length) return;
  // Sur route (décision coach du 23/10/2026) : l'objectif d'un 10 km, d'un semi ou d'un marathon, ou une course de
  // préparation dite sur route, en « Course à pied ».
  const route = c.discipline === 'route' || (principale && formatDe(o).startsWith('R'));
  const corps = {
    name: c.nom, event: c.nom, date_start: c.date, sport: route ? SPORT_COURSE_A_PIED : SPORT_TRAIL, goal_type: principale ? 'a' : 'b',
    distance: { value: c.distance_km, unit: 'km' }, elevation_gain: { value: c.dplus_m, unit: 'm' },
  };
  const r = await appelNolio('POST', 'planned/competitions/', d.moi ? corps : { ...corps, athletes: [d.usr] });
  if (r.statut !== 201 && r.statut !== 200) throw new Error(refusNolio(r, `la course du ${c.date}`));
  await garderEnvoi(o.coachId, o.planId, cle, [{ jour_id: cle, nolio_id: String(r.corps?.id ?? ''), genre: 'note' }]);
  o.envois.push({ semaine: cle, envoye_le: new Date().toISOString(), seances: [] });
}

// ─── Les tests dans Nolio (TN1 à TN4, décisions coach du 19/10/2026) ─────────

// Les valeurs connues de l'athlète, que le moteur lit pour écrire ses tests tant qu'une manque (TN1) ; « lecture » :
// avec l'accord, le site lit le résultat dans Nolio, sinon les textes du test renvoient à l'app.
// coache : sans accord de lecture, un coaché donne la valeur d'un test dans l'app ou à son coach dans Nolio ; un
// acheteur, qui n'a pas de coach attitré, dans son app (décision coach du 20/10/2026).
// Les tests d'un coaché se refont tous les 6 mois, loin de la course (décision coach du 21/10/2026) : un repère de plus
// de 6 mois, ou sans date, compte comme manquant, et le moteur replace son test au prochain moment qui s'y prête ;
// jamais à moins de 8 semaines de l'objectif. L'ancienne valeur sert jusque-là. Les acheteurs : la règle d'avant.
const RETEST_J = 182;
const RETEST_HORS_COURSE_J = 56;
function valeursConnues(o: Objectif, lundi?: string | null) {
  const loin = o.coache && Boolean(lundi) && joursEntre(lundi as string, o.plan.course.date) > RETEST_HORS_COURSE_J;
  const frais = (cle: string) => !loin || String(o.reperesSources?.[cle]?.le ?? '').slice(0, 10) >= ajouterJours(lundi as string, -RETEST_J);
  return { fc_seuil1: 'fc_seuil1' in o.profil && frais('fc_seuil1'), vc: 'vc_ms' in o.profil && frais('vc_ms'),
    fc_seuil2: 'fc_seuil2' in o.profil && frais('fc_seuil2'), lecture: o.accordLecture, coache: o.coache };
}

const testEcrit = (j: Semaine['jours'][number]) =>
  (j.reperes as { test?: { cle?: string; ecrit?: boolean } | null } | null | undefined)?.test?.ecrit
    ? (j.reperes as { test: { cle: string } }).test.cle : null;

// TN4 : le soir du test de la parole, deux questions dans Nolio (avec l'accord de lecture ; sinon l'app).
export const QUESTIONNAIRE_PAROLE = {
  name: 'Ton test de la parole',
  description: 'Deux réponses : elles règlent tes repères d’endurance.',
  items: [
    { question: 'Ta FC au premier palier où tu ne parlais plus confortablement ?', type: 'number', is_mandatory: true, unit: 'bpm' },
    { question: 'Ton allure à ce palier (par exemple 6:00) ?', type: 'short_text', is_mandatory: false },
  ],
};

async function programmerParole(o: Objectif, semaine: Semaine) {
  if (!o.accordLecture || !o.nolioAthlete) return;
  const d = await destinataire(o.nolioAthlete);
  for (const j of semaine.jours) {
    const cle = `${j.id}:parole`;
    if (testEcrit(j) !== 'parole' || !j.date_iso || o.envois.some((e) => e.semaine === cle)) continue;
    const r = await appelNolio('POST', 'planned/quizzes/', d.moi ? { ...QUESTIONNAIRE_PAROLE, date_start: j.date_iso, hour_start: '20:00' }
      : { ...QUESTIONNAIRE_PAROLE, date_start: j.date_iso, hour_start: '20:00', athletes: [d.usr] });
    if (r.statut !== 201 && r.statut !== 200) throw new Error(refusNolio(r, 'le questionnaire du test de la parole'));
    await garderEnvoi(o.coachId, o.planId, cle, [{ jour_id: cle, nolio_id: String(r.corps?.id ?? ''), genre: 'note' }]);
  }
}

// Les valeurs lues d'un test : dans « Tes zones » pour un acheteur, sur la fiche pour un coaché (T8) ; elles comptent
// dès la semaine écrite le dimanche suivant.
type Valeurs = { vc_ms?: number; d_prime_m?: number; fc_seuil1?: number; v_seuil1_ms?: number | null; fc_seuil2?: number };
async function enregistrerValeurs(o: Objectif, v: Valeurs) {
  const service = clientService();
  const jour = aujourdhuiParis();
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  // ZN1 : les zones CTS dans le Nolio de l'athlète, avec la nouvelle valeur.
  await zonesVersNolio(o, v);
  if (o.coache) {
    const { data: c } = await service.from('coaching').select('athlete_id').eq('plan_id', o.planId).maybeSingle();
    if (!c) return;
    await service.from('athletes_coaches').update({
      ...(v.vc_ms ? { vc_ms: r3(v.vc_ms) } : {}), ...(v.fc_seuil1 ? { fc_seuil1: v.fc_seuil1 } : {}),
      ...(v.v_seuil1_ms ? { v_seuil1_ms: r3(v.v_seuil1_ms) } : {}), ...(v.fc_seuil2 ? { fc_seuil2: v.fc_seuil2 } : {}),
    }).eq('id', c.athlete_id);
    // La D′ (AP4) et la source de chaque repère (lu dans un test), après la migration du 19/10/2026 seulement.
    const { data: avant } = await service.from('athletes_coaches').select('*').eq('id', c.athlete_id).maybeSingle();
    if (avant && 'reperes_sources' in avant) {
      const sources = { ...((avant.reperes_sources ?? {}) as Record<string, unknown>) };
      for (const cle of ['fc_seuil1', 'vc_ms', 'fc_seuil2'] as const) if (v[cle]) sources[cle] = { le: jour, source: 'test' };
      await service.from('athletes_coaches').update({ reperes_sources: sources, ...(v.d_prime_m ? { d_prime_m: Math.round(v.d_prime_m) } : {}) })
        .eq('id', c.athlete_id);
    }
    return;
  }
  await service.from('zones').upsert({
    plan_id: o.planId, compte_id: o.compteId, maj_le: new Date().toISOString(),
    ...(v.vc_ms ? { vc_ms: r3(v.vc_ms), d_prime_m: Math.round(v.d_prime_m ?? 0), vc_le: jour } : {}),
    ...(v.fc_seuil1 ? { fc_seuil1: v.fc_seuil1, fc_seuil1_le: jour } : {}),
    ...(v.v_seuil1_ms ? { v_seuil1_ms: r3(v.v_seuil1_ms) } : {}),
    ...(v.fc_seuil2 ? { fc_seuil2: v.fc_seuil2, fc_seuil2_le: jour } : {}),
  });
}

// ZN1 pour un coaché sans objectif (décision coach du 20/10/2026, « tableau de bord complet ») : les zones de sa fiche,
// sur les repères du moteur sans course (reperes.ts).
export async function zonesDeLaFicheVersNolio(athleteId: string): Promise<string[]> {
  const { data: a } = await clientService().from('athletes_coaches').select('nolio_athlete_id, fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms')
    .eq('id', athleteId).maybeSingle();
  if (!a?.nolio_athlete_id) return [];
  const d = await destinataire(String(a.nolio_athlete_id));
  const p = { ...PROFIL_VIDE, ...profilDe({ fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms ?? null }) };
  const soucis = await reperesDeBase().then((r) => ecrireZonesNolio(d.usr, d.moi, p, r.zones))
    .catch((e) => [e instanceof Error ? e.message : String(e)]);
  if (soucis.length) console.error(`Zones Nolio de la fiche ${athleteId} :`, soucis.join(' ; '));
  return soucis;
}

// LE RATTRAPAGE DES ZONES (décision coach du 25/10/2026, l'écriture ouverte à tous) : une nuit, les zones de chaque
// coaché qui a déjà des repères (sa vitesse critique, ou ses deux seuils de FC) partent dans son Nolio, comme quand le
// coach enregistre ses repères : d'après son objectif écrit le plus récent, sinon sa fiche. Ensuite, à chaque valeur.
export async function rattraperLesZones(budgetMs = 150_000): Promise<Compte[]> {
  const debut = Date.now();
  const { data: fiches } = await clientService().from('athletes_coaches').select('id, coach_id, mode, nolio_athlete_id, vc_ms, fc_seuil1, fc_seuil2')
    .not('nolio_athlete_id', 'is', null);
  const comptes: Compte[] = [];
  for (const f of (fiches ?? []).filter((x) => x.mode !== 'plan' && (x.vc_ms || (x.fc_seuil1 && x.fc_seuil2)))) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: '', quoi: 'zones remises' });
      continue;
    }
    try {
      const fiche = await ficheAthlete(String(f.coach_id), String(f.id));
      const dernier = fiche?.objectifs[fiche.objectifs.length - 1];
      const o = dernier ? await objectifEcrit(dernier.plan_id).catch(() => null) : null;
      const soucis = o ? await zonesVersNolio(o) : dernier ? [] : await zonesDeLaFicheVersNolio(String(f.id));
      comptes.push({ plan: dernier?.plan_id ?? '', quoi: 'zones écrites dans Nolio', ...(soucis.length ? { erreur: soucis.join(' ; ') } : {}) });
    } catch (e) {
      comptes.push({ plan: '', quoi: 'zones non écrites', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// ZN1 : les zones CTS dans le Nolio de l'athlète, d'après son profil (et une valeur qui vient d'arriver).
export async function zonesVersNolio(o: Objectif, v: Valeurs = {}): Promise<string[]> {
  if (!o.nolioAthlete) return [];
  const d = await destinataire(o.nolioAthlete);
  const p = { ...PROFIL_VIDE, ...o.profil, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined)) };
  const soucis = await ecrireZonesNolio(d.usr, d.moi, p, o.plan.zones).catch((e) => [e instanceof Error ? e.message : String(e)]);
  if (soucis.length) console.error(`Zones Nolio du plan ${o.planId} :`, soucis.join(' ; '));
  return soucis;
}

// La séance faite d'un test, ses tours et sa trace (204 : une séance sans fichier ; une source qui interdit la
// transmission rend des flux vides).
async function seanceFaite(o: Objectif, jourId: string, dateIso: string, au: string) {
  const prevue = o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]).find((s) => s.jour_id === jourId && s.nolio_id);
  if (!prevue) return null;
  const d = await destinataire(o.nolioAthlete);
  const q = d.moi ? '' : `athlete=${d.usr}`;
  const reels = await listeNolio<{ id: string; planned?: string | null }>(
    `real/trainings/?date_from=${dateIso}&date_to=${au}&fields=id,planned${q ? `&${q}` : ''}`);
  const reel = reels.find((r) => r.planned === String(prevue.nolio_id));
  if (!reel) return null;
  const l = await appelNolio('GET', `real/trainings/${reel.id}/laps/${q ? `?${q}` : ''}`);
  const tours = (l.statut === 200 ? (l.corps?.data ?? []) : []) as Tour[];
  const f = await appelNolio('GET', `real/trainings/${reel.id}/streams/${q ? `?${q}` : ''}`);
  const c = f.statut === 200 ? f.corps : null;
  const flux: Flux | null = c ? { temps: (c.stream_time ?? []) as number[], distance: (c.stream_distance ?? []) as number[],
    fc: (c.stream_heartrate ?? []) as number[] } : null;
  return { tours, flux: flux && flux.temps.length ? flux : null };
}

export type TestLu = { plan: string; coache: boolean; texte: string };

// Chaque jour (TN3, TN4) : les tests écrits ces 7 derniers jours, pas encore lus, avec l'accord de lecture. Lu et
// valable : enregistré, une note le dit ; illisible : la note renvoie à l'app ; pas encore fait ou pas encore
// synchronisé : relu le lendemain, puis abandonné au bout de 3 jours (le test revient à la prochaine séance qui s'y
// prête, puisque la valeur manque toujours).
export async function lireLesTests(planId: string): Promise<TestLu[]> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete || !o.accordLecture) return [];
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  const { data: ecrites } = await service.from('semaines_ecrites').select('donnees').eq('plan_id', planId)
    .gte('ecrite_le', new Date(Date.now() - 21 * 86400_000).toISOString());
  const { data: lus } = await service.from('tests_lus').select('jour_id').eq('plan_id', planId);
  const dejaLus = new Set((lus ?? []).map((l) => l.jour_id as string));
  const sortie: TestLu[] = [];
  for (const j of (ecrites ?? []).flatMap((e) => ((e.donnees as Semaine | null)?.jours ?? []))) {
    const cle = testEcrit(j);
    if (!cle || !j.date_iso || j.date_iso >= aujourdhui || j.date_iso < ajouterJours(aujourdhui, -7) || dejaLus.has(j.id)) continue;
    const garder = (statut: string, resultat: Record<string, unknown>) =>
      service.from('tests_lus').upsert({ plan_id: planId, jour_id: j.id, cle, statut, resultat, lu_le: new Date().toISOString() });
    const abandon = j.date_iso < ajouterJours(aujourdhui, -3);
    const lienZones = `${site.url}/app/plan/zones`;
    if (cle === 'parole') {
      const d = await destinataire(o.nolioAthlete);
      const resultats = await listeNolio<{ id: string; name?: string; items: { question: string; value: unknown }[] }>(
        `real/quiz_results/?date_from=${j.date_iso}&date_to=${aujourdhui}${d.moi ? '' : `&athlete=${d.usr}`}`).catch(() => []);
      const r = resultats.find((x) => x.name === QUESTIONNAIRE_PAROLE.name);
      const reponse = (n: number) => r?.items.find((i) => i.question === QUESTIONNAIRE_PAROLE.items[n].question)?.value;
      const v = r ? lireParole(reponse(0), reponse(1)) : null;
      if (v) {
        await enregistrerValeurs(o, v);
        const texte = `Ta FC au seuil 1 : ${v.fc_seuil1} bpm${v.v_seuil1_ms ? ` à ${allure(v.v_seuil1_ms)}/km` : ''}. Tes endurances la prennent en repère dès dimanche.`;
        await garderNote(o, `${j.id}:resultat`, aujourdhui, 'Ton test de la parole', texte);
        await garder('lu', v);
        sortie.push({ plan: planId, coache: o.coache, texte });
      } else if (r || abandon) {
        if (r) await garderNote(o, `${j.id}:resultat`, aujourdhui, 'Ton test de la parole', sansApp(o)
          ? 'Ta réponse ne se lit pas : envoie ta FC au seuil 1 à ton coach dans Nolio.'
          : `Ta réponse ne se lit pas : donne ta FC au seuil 1 dans ton app, ${lienZones}`);
        await garder(r ? 'illisible' : 'sans_reponse', {});
      }
      continue;
    }
    const faite = await seanceFaite(o, j.id, j.date_iso, aujourdhui);
    if (!faite) {
      if (abandon) await garder('non_fait', {});
      continue;
    }
    if (cle === 'vitesse_critique') {
      const r = vcDuTest(faite.tours, faite.flux);
      if ('erreur' in r) {
        await garderNote(o, `${j.id}:resultat`, aujourdhui, 'Ton test de vitesse critique',
          `Ton test n’a pas pu se lire tout seul (${r.erreur.toLowerCase().replace(/\.$/, '')}) : ${sansApp(o)
            ? 'envoie tes deux distances à ton coach dans Nolio.' : `donne tes deux distances dans ton app, ${lienZones}`}`);
        await garder('illisible', { erreur: r.erreur });
        continue;
      }
      await enregistrerValeurs(o, { vc_ms: r.vc_ms, d_prime_m: r.d_prime_m });
      const texte = `Ta vitesse critique : ${kmh(r.vc_ms)} km/h (${allure(r.vc_ms)}/km). Tes allures sur le plat partent avec tes séances dès dimanche.`;
      await garderNote(o, `${j.id}:resultat`, aujourdhui, 'Ton test de vitesse critique', texte);
      await garder('lu', r);
      sortie.push({ plan: planId, coache: o.coache, texte });
    } else if (cle === 'fc_seuil2') {
      const fc = fcSeuil2DuTest(faite.tours, faite.flux);
      if (fc === null) {
        await garderNote(o, `${j.id}:resultat`, aujourdhui, 'Ta FC au seuil 2', sansApp(o)
          ? 'Ta FC au seuil 2 n’a pas pu se lire toute seule : envoie-la à ton coach dans Nolio.'
          : `Ta FC au seuil 2 n’a pas pu se lire toute seule : donne-la dans ton app, ${lienZones}`);
        await garder('illisible', {});
        continue;
      }
      await enregistrerValeurs(o, { fc_seuil2: fc });
      const texte = `Ta FC au seuil 2 : ${fc} bpm. Tes séances de seuil 2 la prennent en repère dès dimanche.`;
      await garderNote(o, `${j.id}:resultat`, aujourdhui, 'Ta FC au seuil 2', texte);
      await garder('lu', { fc_seuil2: fc });
      sortie.push({ plan: planId, coache: o.coache, texte });
    }
  }
  return sortie;
}

// ─── L'acheteur dans l'équipe Nolio (P1 à P4) ─────────────────────────────

let equipe: Promise<string | null> | null = null;
export function equipeDuCoach(): Promise<string | null> {
  equipe ??= listeNolio<{ id: string; is_manager?: boolean; role?: string }>('team/teams/')
    .then((t) => (t.find((x) => x.is_manager) ?? t[0])?.id ?? null)
    .catch(() => {
      equipe = null;
      return null;
    });
  return equipe;
}

const NOM_GROUPE = 'Plans CTS';
async function groupePlans(equipeId: string): Promise<string | null> {
  const groupes = await listeNolio<{ id: string; name: string }>('team/groups/');
  const g = groupes.find((x) => x.name === NOM_GROUPE);
  if (g) return g.id;
  const r = await appelNolio('POST', 'team/groups/', { name: NOM_GROUPE, team: equipeId });
  return r.statut === 201 || r.statut === 200 ? String(r.corps?.id ?? '') || null : null;
}

// Le groupe « Plans CTS » (P2) et la sortie de l'équipe une semaine après la course (P3) : posés au départ.
async function rangerAcheteur(o: Objectif) {
  const equipeId = await equipeDuCoach();
  if (!equipeId || !o.nolioAthlete) return;
  const groupe = await groupePlans(equipeId);
  if (groupe) await appelNolio('POST', `team/groups/${groupe}/members/`, { user: o.nolioAthlete, role: 'athlete' });
  await appelNolio('POST', `team/teams/${equipeId}/expirations/`, { user: o.nolioAthlete, date_leaving: ajouterJours(o.plan.course.date, 7) });
}

// Prévenir le coach (P4) : un court e-mail, à son adresse de contact.
export async function prevenirCoach(sujet: string, texte: string) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) return;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: EXPEDITEUR, to: [{ email: site.email }], subject: sujet, textContent: texte }), cache: 'no-store',
  }).catch((e) => console.error('E-mail au coach :', e instanceof Error ? e.message : e));
}

// L'invitation de l'acheteur dans l'équipe, au paiement (P1) : l'adresse Nolio qu'il a donnée, sinon celle de l'achat.
// Un compte existant reçoit l'invitation de Nolio ; une adresse inconnue reçoit un compte créé, déjà dans l'équipe :
// son plan part tout de suite. Équipe pleine ou Nolio indisponible : nouvel essai chaque jour, le coach prévenu.
export async function inviterAcheteur(planId: string, emailAchat: string): Promise<string> {
  const service = clientService();
  // Une seule invitation à la fois (le webhook de Stripe et le retour de paiement arrivent ensemble).
  const { data: pris } = await service.from('plans').update({ nolio_statut: 'en_cours' })
    .eq('id', planId).eq('nolio_statut', 'a_inviter').select('nolio_email, course_nom, compte_id');
  const p = pris?.[0];
  if (!p) return 'deja';
  // Un athlète qui a une fiche de coaché (décision coach du 23/10/2026) est déjà dans l'équipe : son compte Nolio est
  // celui de sa fiche. En mode coaching, son plan attend le bouton de son coach (« Passer en plan »), qui est prévenu ;
  // en mode plan, il démarre.
  const { data: fiches } = await service.from('athletes_coaches').select('*').eq('compte_id', p.compte_id)
    .not('nolio_athlete_id', 'is', null).limit(1);
  const fiche = fiches?.[0];
  if (fiche) {
    const enCoaching = fiche.mode !== 'plan';
    await service.from('plans').update({ nolio_athlete_id: fiche.nolio_athlete_id, nolio_statut: enCoaching ? 'coaching' : 'actif', nolio_email: null })
      .eq('id', planId);
    if (enCoaching) {
      await prevenirCoach(`Plan CTS : ${fiche.nom} a acheté un plan pendant son coaching`,
        `${fiche.nom} a acheté le plan « ${p.course_nom ?? ''} » alors qu'il est en mode coaching. Son plan attend : `
        + 'sur sa fiche, « Passer en plan » arrête son coaching après la semaine en cours et démarre son plan le lundi qui suit.');
      return 'coaching';
    }
    await demarrerObjectif(planId);
    return 'actif';
  }
  // Un acheteur déjà dans l'équipe (un plan précédent, OM1) : pas de nouvelle invitation, son objectif démarre (OM4 le
  // programme après la course en cours) ; sa sortie de l'équipe suit la nouvelle course (P3).
  const { data: membre } = await service.from('plans').select('nolio_athlete_id').eq('compte_id', p.compte_id)
    .eq('nolio_statut', 'actif').not('nolio_athlete_id', 'is', null).neq('id', planId).limit(1);
  if (membre?.[0]?.nolio_athlete_id) {
    await service.from('plans').update({ nolio_athlete_id: membre[0].nolio_athlete_id, nolio_statut: 'actif', nolio_email: null }).eq('id', planId);
    await demarrerObjectif(planId);
    return 'actif';
  }
  const equipeId = await equipeDuCoach();
  const email = String(p?.nolio_email || emailAchat).trim();
  const r = equipeId ? await appelNolio('POST', `team/teams/${equipeId}/invitations/`, { email, role: 'athlete' }) : null;
  if (!r || (r.statut !== 201 && r.statut !== 200)) {
    const pleine = r?.statut === 400;
    await service.from('plans').update({ nolio_statut: 'a_inviter' }).eq('id', planId);
    console.error(`Invitation Nolio du plan ${planId} :`, r ? refusNolio(r, 'l’invitation') : 'équipe introuvable');
    await prevenirCoach(pleine ? 'Plan CTS : ton équipe Nolio est pleine' : 'Plan CTS : invitation Nolio à refaire',
      `${pleine ? 'Ton équipe Nolio est pleine' : 'Nolio n’a pas répondu'} pour l’acheteur du plan « ${p?.course_nom ?? ''} ». `
      + 'Le site réessaie chaque jour ; libère une place ou vérifie ton offre Nolio.');
    return 'a_inviter';
  }
  const statut = r.corps?.status === 'active' ? 'actif' : 'invite';
  await service.from('plans').update({ nolio_athlete_id: String(r.corps?.user ?? ''), nolio_statut: statut, nolio_email: null }).eq('id', planId);
  if (equipeId) {
    const groupe = await groupePlans(equipeId).catch(() => null);
    if (groupe) await appelNolio('POST', `team/groups/${groupe}/members/`, { user: String(r.corps?.user ?? ''), role: 'athlete' });
  }
  if (statut === 'actif') await demarrerObjectif(planId);
  return statut;
}

// Les invitations restées à faire (équipe pleine, Nolio indisponible) : un nouvel essai chaque jour.
export async function reinviter(): Promise<Compte[]> {
  const service = clientService();
  const { data } = await service.from('plans').select('id, compte_id').eq('nolio_statut', 'a_inviter').gte('course_date', aujourdhuiParis());
  const comptes: Compte[] = [];
  for (const p of data ?? []) {
    const { data: u } = await service.auth.admin.getUserById(p.compte_id as string);
    if (!u?.user?.email) continue;
    comptes.push({ plan: p.id as string, quoi: `invitation : ${await inviterAcheteur(p.id as string, u.user.email).catch((e) => `échec (${e instanceof Error ? e.message : e})`)}` });
  }
  return comptes;
}

// Une invitation envoyée et jamais acceptée (décision coach du 21/10/2026 : « relance puis alerte ») : 3 jours après
// l'achat, un e-mail à l'acheteur ; 7 jours après, un e-mail au coach, avec son adresse. Le passage tourne une fois par
// jour : chaque envoi tombe un seul jour, sans rien garder.
export const JOURS_RELANCE = 3;
export const JOURS_ALERTE = 7;
export async function relancerInvitations(): Promise<Compte[]> {
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  const { data } = await service.from('plans').select('id, compte_id, course_nom, cree_le, nom:donnees->athlete->>nom')
    .eq('nolio_statut', 'invite').gte('course_date', aujourdhui);
  const comptes: Compte[] = [];
  for (const p of data ?? []) {
    const depuis = joursEntre(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(p.cree_le as string)), aujourdhui);
    if (depuis !== JOURS_RELANCE && depuis !== JOURS_ALERTE) continue;
    try {
      const { data: u } = await service.auth.admin.getUserById(p.compte_id as string);
      const email = u?.user?.email;
      if (!email) continue;
      if (depuis === JOURS_RELANCE) {
        await envoyerRelanceInvitation(email, String(p.nom ?? ''), `${site.url}/app`);
        comptes.push({ plan: p.id as string, quoi: 'invitation relancée' });
      } else {
        await prevenirCoach('Plan CTS : invitation Nolio toujours en attente',
          `L’acheteur du plan « ${p.course_nom} » n’a toujours pas accepté l’invitation dans ton équipe Nolio, `
          + `${JOURS_ALERTE} jours après son achat : ses séances ne peuvent pas lui arriver. Il a été relancé par e-mail `
          + `au bout de ${JOURS_RELANCE} jours. Son adresse : ${email}.`);
        comptes.push({ plan: p.id as string, quoi: 'coach prévenu (invitation en attente)' });
      }
    } catch (e) {
      comptes.push({ plan: p.id as string, quoi: 'relance non faite', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// ─── Le passage quotidien ─────────────────────────────────────────────────

// Chaque jour : la fatigue franche de chaque plan actif (avec l'accord de lecture), les invitations à refaire, et un
// seul e-mail au coach s'il s'est passé quelque chose chez ses coachés (ajustements du dimanche et du jour, arrêts ;
// question 20).
export async function passageQuotidien(): Promise<Compte[]> {
  const comptes: Compte[] = [];
  const tests: TestLu[] = [];
  for (const planId of await plansActifs()) {
    try {
      const c = await fatigueDuJour(planId);
      if (c) comptes.push(c);
    } catch (e) {
      comptes.push({ plan: planId, quoi: 'fatigue non lue', erreur: e instanceof Error ? e.message : String(e) });
    }
    try {
      const lus = await lireLesTests(planId);
      tests.push(...lus);
      comptes.push(...lus.map((t) => ({ plan: planId, quoi: 'test lu', coache: t.coache })));
    } catch (e) {
      comptes.push({ plan: planId, quoi: 'tests non lus', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  comptes.push(...await reinviter());
  comptes.push(...await relancerInvitations());
  comptes.push(...await departsDuJour());
  await resumeAuCoach(comptes.filter((c) => c.coache && c.journal?.length), tests.filter((t) => t.coache));
  return comptes;
}

const REGLES_EN_CLAIR: Record<string, string> = {
  R1: 'semaine en grande partie manquée', R2: 'séance clé trop dure ou écourtée', R3: 'fatigue', R4: 'arrêt',
  R5: 'disponibilités', R7: 'séance en plus', O3: 'course secondaire',
};

// Le Suivi du coach (décision 8 du document des règles) : les ajustements de ses coachés écrits ces 8 derniers jours,
// chacun avec son geste : « Annuler » pour ceux du dimanche, « Garder la séance d'origine » pour une séance allégée.
export type Ajustement = { planId: string; nom: string; numero: string; lundi: string | null; raisons: string[]; bilan: string | null; allegees: { id: string; nom: string }[] };
export async function ajustementsDuCoach(coachId: string): Promise<Ajustement[]> {
  const service = clientService();
  const { data: coaching } = await service.from('coaching').select('plan_id, athlete_nom').eq('coach_id', coachId);
  const nomDe = new Map((coaching ?? []).map((c) => [c.plan_id as string, c.athlete_nom as string]));
  if (!nomDe.size) return [];
  const depuis = new Date(Date.now() - 8 * 86400_000).toISOString();
  const { data: ecrites } = await service.from('semaines_ecrites').select('plan_id, numero, journal, bilan, donnees, sans_ajustement')
    .in('plan_id', [...nomDe.keys()]).gte('ecrite_le', depuis);
  const liste: Ajustement[] = [];
  for (const e of ecrites ?? []) {
    const journal = e.sans_ajustement ? [] : ((e.journal ?? []) as { regle?: string }[]);
    const jours = ((e.donnees as Semaine | null)?.jours ?? []) as (Semaine['jours'][number] & { origine?: { seance?: string } })[];
    const allegees = jours.filter((j) => j.origine).map((j) => ({ id: j.id, nom: j.origine?.seance ?? j.id }));
    if (!journal.length && !allegees.length) continue;
    liste.push({
      planId: e.plan_id as string, nom: nomDe.get(e.plan_id as string) ?? '', numero: e.numero as string,
      lundi: (e.donnees as Semaine | null)?.lundi ?? null,
      raisons: [...new Set(journal.map((j) => REGLES_EN_CLAIR[j.regle ?? ''] ?? j.regle ?? ''))], bilan: e.bilan as string | null, allegees,
    });
  }
  return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.numero.localeCompare(b.numero, 'fr', { numeric: true }));
}

// Un e-mail par jour au plus : les ajustements de la journée chez les coachés (le dimanche, ceux de la semaine écrite).
async function resumeAuCoach(fatigues: Compte[], tests: TestLu[] = []) {
  const service = clientService();
  // Les dernières 24 heures (décision coach du 21/10/2026) : les semaines écrites par les reprises du dimanche soir, après
  // ce passage, comptent le lendemain ; un ajustement annulé n'est plus une nouveauté.
  const debut = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: ecrites } = await service.from('semaines_ecrites').select('plan_id, numero, journal, sans_ajustement').gte('ecrite_le', debut);
  const { data: coaching } = await service.from('coaching').select('plan_id, athlete_nom');
  const nomDe = new Map((coaching ?? []).map((c) => [c.plan_id as string, c.athlete_nom as string]));
  const lignes: string[] = [];
  for (const e of ecrites ?? []) {
    const nom = nomDe.get(e.plan_id as string);
    const journal = (e.journal ?? []) as { regle?: string }[];
    if (!nom || !journal.length || e.sans_ajustement) continue;
    lignes.push(`${nom}, ${e.numero} : ${[...new Set(journal.map((j) => REGLES_EN_CLAIR[j.regle ?? ''] ?? j.regle))].join(', ')}.`);
  }
  for (const f of fatigues) {
    const nom = nomDe.get(f.plan);
    if (nom) lignes.push(`${nom} : ${f.quoi} (fatigue franche).`);
  }
  // Un mot à la question ouverte du dimanche, noté ces 24 dernières heures (décision coach du 21/10/2026) : à lire dans Nolio.
  const { data: fichesMot } = await service.from('athletes_coaches').select('nom, questionnaires').not('questionnaires', 'is', null);
  for (const f of fichesMot ?? []) {
    const note = String((f.questionnaires as { mot_note?: string | null } | null)?.mot_note ?? '');
    if (note && note >= debut) lignes.push(`${f.nom} a un mot pour toi dans son questionnaire du samedi, à lire dans Nolio.`);
  }
  // TN3 : les valeurs lues dans un test, posées sur la fiche du coaché ; le coach les corrige sur sa fiche.
  const valeurs = tests.map((t) => nomDe.get(t.plan) && `${nomDe.get(t.plan)} : ${t.texte.split('.')[0]}.`).filter(Boolean) as string[];
  if (!lignes.length && !valeurs.length) return;
  await prevenirCoach(`Tes coachés : ${lignes.length + valeurs.length} nouveauté${lignes.length + valeurs.length > 1 ? 's' : ''} aujourd’hui`,
    [lignes.length ? `${lignes.join('\n')}\n\nTout est dans « À regarder » (${site.url}/app/coach) ; chaque ajustement s’annule dans ton Suivi.` : '',
      valeurs.length ? `Tests lus, valeurs posées sur leur fiche :\n${valeurs.join('\n')}` : ''].filter(Boolean).join('\n\n'));
}
