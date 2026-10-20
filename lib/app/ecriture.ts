/**
 * L'écriture semaine par semaine, côté site (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, dernière section ; décisions
 * coach des 18-19/10/2026 ; moteur 8.326, cts_semaine et cts_ajustements). Un plan qui porte des paramètres ne part plus
 * en entier dans Nolio :
 * - au départ (l'acheteur a rejoint l'équipe, ou le coach a associé l'athlète d'un nouvel objectif), la TRAME part dans
 *   son calendrier — le bandeau de chaque semaine et les fiches au bon moment —, avec le questionnaire du dimanche
 *   (Hooper et « Ta semaine prochaine », récurrents jusqu'à la course), puis la semaine en cours ;
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
  creer, destinataire, envoyerSemaineCible, garderEnvoi, mettreAJourSemaineCible, profilDe, seancesDuMoteur,
  type Cible, type Envoi, type SeanceEnvoyee,
} from './coaching';
import { EXPEDITEUR } from './emailBienvenue';
import { lienFicheCourse } from './ficheCourse';
import { appelNolio, coachs, listeNolio, refusNolio, SPORTS_COURSE } from './nolio';
import { ajouterJours, type Plan, type Semaine } from './plan';
import { clientService } from './supabase';
import type { Fiche } from './tableau';
import { fcSeuil2DuTest, lireParole, vcDuTest, type Flux, type Tour } from './tests';
import { allure, kmh, PROFIL_VIDE } from './zones';
import { reperesDeBase } from './reperes';
import { ecrireZonesNolio } from './zonesNolio';

export type Etat = Record<string, unknown>;
// compteAthlete : le compte d'un coaché invité dans l'app (T6) ; ses gestes (une course, le veto) valent comme ceux du
// propriétaire du plan.
export type Objectif = Cible & {
  compteId: string; parametres: Record<string, unknown>; etat: Etat | null; accordLecture: boolean; coache: boolean;
  compteAthlete: string | null; tempsH: number;
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
// Le questionnaire du dimanche (décision coach du 19/10/2026, question 13) : quatre questions courtes. Sans `order` :
// Nolio le compte à partir de 0 et le déduit de la place dans la liste (refus du 19/10/2026, essai sur « (toi) »).
export const QUESTIONNAIRE_SEMAINE = {
  name: 'Ta semaine prochaine',
  description: 'Une minute : tes séances de la semaine prochaine s’écrivent ce soir à partir de tes réponses.',
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
    etat: (p.etat_ecriture ?? null) as Etat | null, niveau, envois: (envois ?? []) as Envoi[], avecTrame: false,
    tempsH: heures((p.intake as Record<string, unknown> | null)?.temps_cible),
  };
  const { data: c } = await service.from('coaching').select('athlete_id, coach_id').eq('plan_id', planId).maybeSingle();
  if (c?.athlete_id) {
    const { data: a } = await service.from('athletes_coaches')
      .select('nolio_athlete_id, fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms, compte_id').eq('id', c.athlete_id).single();
    const usr = (a?.nolio_athlete_id ?? null) as string | null;
    const { data: accord } = usr
      ? await service.from('nolio_accords').select('accord_le').eq('coach_id', c.coach_id).eq('nolio_athlete_id', usr).maybeSingle()
      : { data: null };
    return { ...base, coachId: c.coach_id as string, nolioAthlete: usr, coache: true, accordLecture: Boolean(accord),
      compteAthlete: (a?.compte_id ?? null) as string | null,
      profil: a ? profilDe({ fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms ?? null }) : {} };
  }
  const coachId = (p.coach_id as string | null) ?? (await compteDuCoach());
  if (!coachId) return null;
  const { data: z } = await service.from('zones').select('fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms').eq('plan_id', planId).maybeSingle();
  return { ...base, coachId, nolioAthlete: (p.nolio_athlete_id ?? null) as string | null, coache: false, compteAthlete: null,
    accordLecture: Boolean(p.accord_lecture_le),
    profil: z ? profilDe({ fc_seuil1: z.fc_seuil1, vc_ms: z.vc_ms, fc_seuil2: z.fc_seuil2, v_seuil1_ms: z.v_seuil1_ms ?? null }) : {} };
}

// Pour l'affichage seulement (la semaine dans Nolio, les badges : l'accueil le lisait deux fois) : lu une fois par page.
// Jamais dans une action ni une tâche, qui relisent l'objectif après l'avoir modifié et le veulent à jour.
export const objectifAffiche = cache(objectifEcrit);

// ─── Le moteur ────────────────────────────────────────────────────────────

async function moteur<T>(chemin: string, corps: unknown): Promise<T> {
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

// Une réponse du questionnaire du dimanche, lue dans Nolio.
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
    elevation_gain?: { value: number } | null; debrief?: { rpe?: number | null; feeling?: number | null } | null };
  const reels = await listeNolio<Reel>(
    `real/trainings/?date_from=${du}&date_to=${au}&fields=id,date_start,sport,duration,elevation_gain,planned,debrief${qui}`);
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
export async function ecrireEtEnvoyer(o: Objectif, numero: string, retours: Retours | null, options: {
  sansAjustement?: boolean; depuis?: string; reprise?: boolean;
} = {}): Promise<SortieMoteur> {
  const sortie = await moteur<SortieMoteur>('/v1/semaine', {
    parametres: o.parametres, numero, etat: o.etat, retours, sans_ajustement: Boolean(options.sansAjustement),
    valeurs: valeursConnues(o), reprise: Boolean(options.reprise),
  });
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
  if (sortie.realise) {
    await service.from('semaines_ecrites').update({ realise: sortie.realise }).eq('plan_id', o.planId).eq('numero', sortie.realise.numero);
  }
  await service.from('plans').update({ etat_ecriture: sortie.etat }).eq('id', o.planId);
  o.etat = sortie.etat;
  return sortie;
}

// La trame dans Nolio, une fois : le bandeau de chaque semaine et les fiches au bon moment, sur tout le plan (T3).
async function envoyerTrame(o: Objectif, depuis: string) {
  if (o.envois.some((e) => e.semaine === TRAME)) return;
  const d = await destinataire(o.nolioAthlete);
  const crees: SeanceEnvoyee[] = [];
  for (const s of o.plan.semaines) {
    if (!s.lundi || ajouterJours(s.lundi, 6) < depuis) continue;
    const { cycle, renfo } = await seancesDuMoteur(o.plan, o.planId, { ...s, jours: [] }, o.profil, o.niveau, true);
    if (cycle) {
      const c = await creer(d, `${TRAME}:${s.numero}`, cycle, 'cycle');
      if (c.erreur) throw new Error(c.erreur);
      if (!c.deja) crees.push(c);
    }
    for (const f of renfo) {
      if (!f.note) continue;
      const n = await creer(d, f.id, f.note, 'note');
      if (n.erreur) throw new Error(n.erreur);
      crees.push(n);
    }
  }
  await garderEnvoi(o.coachId, o.planId, TRAME, crees);
}

// Les questionnaires du dimanche, récurrents jusqu'à la course : « Ta semaine prochaine » pour tous, le Hooper avec
// l'accord de lecture (T5, Hooper chaque dimanche matin, question 12).
async function programmerQuestionnaires(o: Objectif, premierDimanche: string) {
  if (o.envois.some((e) => e.semaine === QUESTIONNAIRES)) return;
  const d = await destinataire(o.nolioAthlete);
  const jusqua = ajouterJours(o.plan.course.date, -1);
  if (premierDimanche > jusqua) return;
  const recurrence = { frequency: 'weekly', weekdays: [7], until: jusqua };
  const pour = (corps: Record<string, unknown>) => (d.moi ? corps : { ...corps, athletes: [d.usr] });
  const crees: SeanceEnvoyee[] = [];
  const semaine = await appelNolio('POST', 'planned/quizzes/', pour({ ...QUESTIONNAIRE_SEMAINE, date_start: premierDimanche,
    hour_start: '08:00', recurrence }));
  if (semaine.statut !== 201 && semaine.statut !== 200) throw new Error(refusNolio(semaine, 'le questionnaire du dimanche'));
  crees.push({ jour_id: 'questionnaire:semaine', nolio_id: String(semaine.corps?.id ?? ''), genre: 'note' });
  // Le Hooper pour les acheteurs, avec leur accord ; les coachés remplissent déjà celui que leur coach programme.
  if (o.accordLecture && !o.coache) {
    const cadres = await listeNolio<{ id: string; scope?: string; quiz_type?: string }>('library/quiz_frames/?type=hooper');
    const hooper = cadres.find((c) => c.scope === 'nolio') ?? cadres[0];
    if (hooper) {
      const h = await appelNolio('POST', 'planned/quizzes/', pour({ quiz_frame: hooper.id, date_start: premierDimanche,
        hour_start: '08:00', recurrence }));
      if (h.statut === 201 || h.statut === 200) crees.push({ jour_id: 'questionnaire:hooper', nolio_id: String(h.corps?.id ?? ''), genre: 'note' });
    }
  }
  await garderEnvoi(o.coachId, o.planId, QUESTIONNAIRES, crees);
}

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const dimancheSuivant = (iso: string) => ajouterJours(iso, (7 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) - 1 + 7) % 7);

// Le départ d'un objectif écrit semaine par semaine : la trame, les questionnaires, la semaine en cours (ou la
// première), et pour un acheteur sa place dans le groupe « Plans CTS » et sa sortie programmée (P2, P3).
// prevu : le départ programmé, après la récupération d'un autre objectif (OM4) ou après les séances que le coach a déjà
// posées à la main (PC1) ; apres : la course, ou la date de la dernière de ces séances.
export type Depart = { numero: string } | { prevu: string; apres: string; raison: 'recuperation' | 'seances' };

// PC1 (décision coach du 19/10/2026) : un coaché à qui le coach a déjà posé des séances à la main ; rien n'est écrasé,
// l'écriture commence le lundi qui suit la dernière d'entre elles. null : rien de posé d'ici la course (hors ce que
// l'app a posé elle-même).
export async function seancesDejaPosees(o: Objectif, aujourdhui: string): Promise<{ derniere: string; lundi: string } | null> {
  if (!o.coache || !o.nolioAthlete) return null;
  const d = await destinataire(o.nolioAthlete);
  const poses = new Set(o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]).map((x) => String(x.nolio_id ?? '')));
  const seances = await listeNolio<{ id: string; date_start: string }>(
    `planned/trainings/?date_from=${aujourdhui}&date_to=${o.plan.course.date}${d.moi ? '' : `&athlete=${d.usr}`}`);
  const derniere = seances.filter((x) => !poses.has(x.id)).map((x) => x.date_start.slice(0, 10)).sort().pop();
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

export async function demarrerObjectif(planId: string): Promise<Depart> {
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
  const fini = ajouterJours(debutApres({ course_date: o.plan.course.date, temps_h: o.tempsH }), 7);
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
  if (apres && apres.lundi > aujourdhui && (!posees || apres.lundi >= posees.lundi)) {
    await clientService().from('plans').update({ depart_prevu: apres.lundi }).eq('id', planId);
    return { prevu: apres.lundi, apres: apres.q.course_nom, raison: 'recuperation' };
  }
  if (posees && posees.lundi > premierJour) {
    await clientService().from('plans').update({ depart_prevu: posees.lundi }).eq('id', planId);
    return { prevu: posees.lundi, apres: posees.derniere, raison: 'seances' };
  }
  // La reprise allégée : la première semaine écrite suit de près la récupération (pas une préparation qui commence des
  // semaines plus tard, QD2).
  const premier = debut.lundi > aujourdhui ? debut.lundi : aujourdhui;
  const reprise = Boolean(apres && apres.lundi >= ajouterJours(premier, -7));
  // Un seul départ à la fois : le premier appel prend la main ; en cas d'échec il la rend, pour un nouvel essai.
  const service = clientService();
  const { data: pris } = await service.from('plans').update({ demarre_le: new Date().toISOString() })
    .eq('id', planId).is('demarre_le', null).select('id');
  if (!pris?.length) return { numero: debut.numero };
  try {
    await envoyerTrame(o, aujourdhui);
    await programmerQuestionnaires(o, dimancheSuivant(debut.lundi < aujourdhui ? aujourdhui : debut.lundi));
    // OM3 : l'objectif et ses courses de préparation, en compétitions dans Nolio.
    const { course } = o.plan;
    await poserCourse(o, { nom: course.nom, date: course.date, distance_km: course.distance_km, dplus_m: course.dplus_m }, true);
    for (const c of ((o.parametres.courses_secondaires ?? []) as Course[])) if (c.date >= aujourdhui) await poserCourse(o, c, false);
    // PO4 : la fiche de chaque course de préparation à venir (après la migration du 19/10/2026).
    const { data: fp } = await service.from('plans').select('fiches_preparation').eq('id', planId).maybeSingle();
    const fiches = ((fp as { fiches_preparation?: Record<string, unknown> } | null)?.fiches_preparation ?? {});
    for (const c of ((o.parametres.courses_secondaires ?? []) as Course[])) if (c.date >= aujourdhui && fiches[c.date]) await poserFichePreparation(o, c);
    const deja = o.envois.some((e) => e.semaine === debut.numero);
    if (!deja) await ecrireEtEnvoyer(o, debut.numero, null, { depuis: aujourdhui > debut.lundi ? aujourdhui : undefined, reprise });
    if (!o.coache) await rangerAcheteur(o);
  } catch (e) {
    await service.from('plans').update({ demarre_le: null }).eq('id', planId);
    throw e;
  }
  return { numero: debut.numero };
}

// Les autres objectifs écrits semaine par semaine du même athlète (sa fiche de coaché, ou son compte d'acheteur).
type Voisin = { id: string; course_nom: string; course_date: string; temps_h: number; demarre: boolean; debut: string | null };
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
    debut: (p.debut ?? null) as string | null,
  }));
}

// « 5h30 », « 5:30 », « 18h » : des heures ; 0 illisible.
function heures(brut: unknown): number {
  const m = /^\s*(\d{1,3})\s*[h:]\s*(\d{0,2})/.exec(String(brut ?? ''));
  return m ? Number(m[1]) + Number(m[2] || 0) / 60 : 0;
}

// Le lundi qui suit la récupération d'une course (O3 : un jour sans séance dure par heure de course, 2 au moins).
function debutApres(q: Pick<Voisin, 'course_date' | 'temps_h'>): string {
  const fin = ajouterJours(q.course_date, Math.max(2, Math.ceil(q.temps_h)));
  const rang = (new Date(`${fin}T12:00:00Z`).getUTCDay() + 6) % 7;
  return ajouterJours(fin, 7 - rang);
}

// Les objectifs programmés (OM4) qui démarrent aujourd'hui.
async function departsDuJour(): Promise<Compte[]> {
  const { data } = await clientService().from('plans').select('id').lte('depart_prevu', aujourdhuiParis()).is('demarre_le', null);
  const comptes: Compte[] = [];
  const aLaMain = await plansALaMain();
  for (const p of (data ?? []).filter((x) => !aLaMain.has(x.id as string))) {
    try {
      const d = await demarrerObjectif(p.id as string);
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
// complet ») : le moteur n'y écrit rien, ni semaine, ni trame, ni questionnaire ; l'app reste leur tableau de bord. Vide
// avant la migration du 20/10/2026 (la colonne n'existe pas encore).
export async function plansALaMain(): Promise<Set<string>> {
  const service = clientService();
  const { data: fiches, error } = await service.from('athletes_coaches').select('id').eq('programmation', 'main');
  if (error || !fiches?.length) return new Set();
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
  const comptes: Compte[] = [];
  const service = clientService();
  for (const planId of await plansActifs()) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: REMIS });
      continue;
    }
    let reservee: string | null = null;
    try {
      const o = await objectifEcrit(planId);
      if (!o?.nolioAthlete) continue;
      const s = semaineDu(o.plan, lundi);
      if (!s || o.envois.some((e) => e.semaine === s.numero)) continue;
      const { data: prise } = await service.from('nolio_envois')
        .upsert({ plan_id: planId, semaine: s.numero, coach_id: o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true })
        .select('plan_id');
      if (!prise?.length) continue;
      reservee = s.numero;
      const retours = await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
      const sortie = await ecrireEtEnvoyer(o, s.numero, retours);
      comptes.push({ plan: planId, quoi: `${s.numero} écrite`, coache: o.coache, journal: sortie.journal });
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
      const r = await appelNolio('DELETE', `planned/quizzes/${q.nolio_id}/?recurrence_action=${recurrence}${d.moi ? '' : `&athlete=${d.usr}`}`)
        .catch(() => null);
      if (r && r.statut !== 204 && r.statut !== 200 && r.statut !== 404) console.error(`Questionnaire de ${planId} non retiré de Nolio : ${r.statut}`);
    }
  }
}

// Le retrait d'un objectif écrit semaine par semaine (décision coach du 19/10/2026) : ce qu'il a posé dans Nolio et qui
// est encore à venir (à partir de demain) en part — bandeaux, notes, séances, compétitions, et la suite de ses
// séries de questionnaires ; le passé reste (les séances faites, les questionnaires remplis). Seuls les éléments que
// l'objectif a lui-même posés (nolio_envois) sont touchés. Rend ce qui n'a pas pu partir, [] si tout va.
export async function retirerDeNolio(planId: string): Promise<string[]> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete || !o.envois.length) return [];
  const d = await destinataire(o.nolioAthlete);
  const qui = d.moi ? '' : `athlete=${d.usr}`;
  // Demain et après : une séance du jour a pu être faite, elle reste reliée à ce qui a été couru.
  const demain = ajouterJours(aujourdhuiParis(), 1);
  const au = ajouterJours(o.plan.course.date, 1);
  const poses = new Set(o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]).map((s) => String(s.nolio_id ?? '')).filter(Boolean));
  const soucis: string[] = [];
  const retirer = async (chemin: string, quoi: string) => {
    const r = await appelNolio('DELETE', `${chemin}${chemin.includes('?') ? (qui ? `&${qui}` : '') : (qui ? `?${qui}` : '')}`).catch(() => null);
    if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, quoi) : `${quoi} : Nolio injoignable`);
  };
  for (const [genre, quoi] of [['trainings', 'une séance'], ['notes', 'une note'], ['cycles', 'un bandeau'], ['competitions', 'une course']]) {
    const avenir = await listeNolio<{ id: string; date_start: string }>(`planned/${genre}/?date_from=${demain}&date_to=${au}${qui ? `&${qui}` : ''}`);
    for (const x of avenir) if (poses.has(x.id) && x.date_start.slice(0, 10) >= demain) await retirer(`planned/${genre}/${x.id}/`, quoi);
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

// Le « Trail » du catalogue de Nolio (cts_nolio.SPORT_TRAIL, GET /api/v2/sports/).
const SPORT_TRAIL = 'spt_YprHS7jgV5vdsz0';
export type Course = { nom: string; date: string; distance_km: number; dplus_m: number; chrono?: string | null; temps_h?: number | null };

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
  const corps = {
    name: c.nom, event: c.nom, date_start: c.date, sport: SPORT_TRAIL, goal_type: principale ? 'a' : 'b',
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
function valeursConnues(o: Objectif) {
  return { fc_seuil1: 'fc_seuil1' in o.profil, vc: 'vc_ms' in o.profil, fc_seuil2: 'fc_seuil2' in o.profil, lecture: o.accordLecture,
    coache: o.coache };
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
function equipeDuCoach(): Promise<string | null> {
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
  const debut = `${aujourdhuiParis()}T00:00:00`;
  const { data: ecrites } = await service.from('semaines_ecrites').select('plan_id, numero, journal').gte('ecrite_le', debut);
  const { data: coaching } = await service.from('coaching').select('plan_id, athlete_nom');
  const nomDe = new Map((coaching ?? []).map((c) => [c.plan_id as string, c.athlete_nom as string]));
  const lignes: string[] = [];
  for (const e of ecrites ?? []) {
    const nom = nomDe.get(e.plan_id as string);
    const journal = (e.journal ?? []) as { regle?: string }[];
    if (!nom || !journal.length) continue;
    lignes.push(`${nom}, ${e.numero} : ${[...new Set(journal.map((j) => REGLES_EN_CLAIR[j.regle ?? ''] ?? j.regle))].join(', ')}.`);
  }
  for (const f of fatigues) {
    const nom = nomDe.get(f.plan);
    if (nom) lignes.push(`${nom} : ${f.quoi} (fatigue franche).`);
  }
  // TN3 : les valeurs lues dans un test, posées sur la fiche du coaché ; le coach les corrige sur sa fiche.
  const valeurs = tests.map((t) => nomDe.get(t.plan) && `${nomDe.get(t.plan)} : ${t.texte.split('.')[0]}.`).filter(Boolean) as string[];
  if (!lignes.length && !valeurs.length) return;
  await prevenirCoach(`Tes coachés : ${lignes.length + valeurs.length} nouveauté${lignes.length + valeurs.length > 1 ? 's' : ''} aujourd’hui`,
    [lignes.length ? `${lignes.join('\n')}\n\nChaque ajustement s’annule dans ton Suivi (${site.url}/app/coach/suivi).` : '',
      valeurs.length ? `Tests lus, valeurs posées sur leur fiche :\n${valeurs.join('\n')}` : ''].filter(Boolean).join('\n\n'));
}
