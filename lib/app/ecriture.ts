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
import { site } from '@/lib/content';
import { API_URL } from '@/lib/plan';
import {
  creer, destinataire, envoyerSemaineCible, garderEnvoi, mettreAJourSemaineCible, profilDe, seancesDuMoteur,
  type Cible, type Envoi, type SeanceEnvoyee,
} from './coaching';
import { EXPEDITEUR } from './emailBienvenue';
import { appelNolio, coachs, listeNolio, refusNolio } from './nolio';
import { ajouterJours, type Plan, type Semaine } from './plan';
import { clientService } from './supabase';

export type Etat = Record<string, unknown>;
export type Objectif = Cible & {
  compteId: string; parametres: Record<string, unknown>; etat: Etat | null; accordLecture: boolean; coache: boolean;
};
export type RetourSeance = { id: string; date: string; faite: boolean; duree_min: number | null; rpe: number | null; ressenti: number | null };
export type Questionnaire = { jours: string[]; jour_sl: string | null; nb_seances: number | null; arret: boolean };
export type Retours = { seances: RetourSeance[]; hooper: { date: string; valeur: number }[]; questionnaire?: Questionnaire };
type SortieMoteur = {
  semaine: Semaine; notes: { regle: string; texte: string }[]; bilan: string | null; journal: Record<string, unknown>[];
  etat: Etat; parametres: Record<string, unknown> | null;
};

// Les clés de nolio_envois qui ne sont pas des semaines : la trame (bandeaux et fiches de tout le plan), les
// questionnaires du dimanche, la note de bilan d'une semaine (« S9:bilan ») et la note d'un ajustement en cours de
// semaine (« S9-jeudi:fatigue »).
const TRAME = 'trame';
const QUESTIONNAIRES = 'questionnaires';
const COULEUR_NOTE = '#0C6E5F';
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LIBELLES = JOURS.map((j) => j[0].toUpperCase() + j.slice(1));
// Le questionnaire du dimanche (décision coach du 19/10/2026, question 13) : quatre questions courtes.
export const QUESTIONNAIRE_SEMAINE = {
  name: 'Ta semaine prochaine',
  description: 'Une minute : tes séances de la semaine prochaine s’écrivent ce soir à partir de tes réponses.',
  items: [
    { order: 1, question: 'Quels jours peux-tu courir la semaine prochaine ?', type: 'multiple_choices', is_mandatory: true,
      choices: { choices: LIBELLES } },
    { order: 2, question: 'Quel jour pour ta sortie longue ?', type: 'unique_choice', is_mandatory: true, choices: { choices: LIBELLES } },
    { order: 3, question: 'Combien de séances veux-tu faire ?', type: 'number', is_mandatory: true, unit: 'séances' },
    { order: 4, question: 'As-tu dû arrêter de courir cette semaine (blessure, maladie) ?', type: 'boolean', is_mandatory: true },
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
  };
  const { data: c } = await service.from('coaching').select('athlete_id, coach_id').eq('plan_id', planId).maybeSingle();
  if (c?.athlete_id) {
    const { data: a } = await service.from('athletes_coaches')
      .select('nolio_athlete_id, fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms').eq('id', c.athlete_id).single();
    const usr = (a?.nolio_athlete_id ?? null) as string | null;
    const { data: accord } = usr
      ? await service.from('nolio_accords').select('accord_le').eq('coach_id', c.coach_id).eq('nolio_athlete_id', usr).maybeSingle()
      : { data: null };
    return { ...base, coachId: c.coach_id as string, nolioAthlete: usr, coache: true, accordLecture: Boolean(accord),
      profil: a ? profilDe({ fc_seuil1: a.fc_seuil1, vc_ms: a.vc_ms, fc_seuil2: a.fc_seuil2, v_seuil1_ms: a.v_seuil1_ms ?? null }) : {} };
  }
  const coachId = (p.coach_id as string | null) ?? (await compteDuCoach());
  if (!coachId) return null;
  const { data: z } = await service.from('zones').select('fc_seuil1, vc_ms, fc_seuil2, v_seuil1_ms').eq('plan_id', planId).maybeSingle();
  return { ...base, coachId, nolioAthlete: (p.nolio_athlete_id ?? null) as string | null, coache: false,
    accordLecture: Boolean(p.accord_lecture_le),
    profil: z ? profilDe({ fc_seuil1: z.fc_seuil1, vc_ms: z.vc_ms, fc_seuil2: z.fc_seuil2, v_seuil1_ms: z.v_seuil1_ms ?? null }) : {} };
}

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

export type LigneTrame = {
  numero: string; type: string; bloc: string; lundi: string; dates: string; volume_h: number; charge: number;
  seances_cles: { jour: string; seance: string; famille: string }[]; week_end_choc: boolean; passee: boolean;
};
export const trameDu = (parametres: Record<string, unknown>) =>
  moteur<{ course: { date: string }; semaines: LigneTrame[] }>('/v1/trame', { parametres });

// ─── Lire Nolio (avec l'accord de l'athlète pour son RPE, son ressenti et son Hooper ; T5) ─────────────

const requeteAthlete = async (o: Objectif) => {
  const d = await destinataire(o.nolioAthlete);
  return d.moi ? '' : `&athlete=${d.usr}`;
};

let hooperItem: Promise<string | null> | null = null;
const indiceHooper = () => {
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

// Ce que le moteur juge : les séances faites (reliées à leur jour du plan par l'envoi), le Hooper, le questionnaire.
// Rien n'est gardé : le moteur en tire ce qu'il garde dans son état (la plus longue sortie courue, le volume fait).
export async function lireRetours(o: Objectif, du: string, au: string): Promise<Retours> {
  const qui = await requeteAthlete(o);
  const parNolio = new Map<string, string>();
  for (const e of o.envois) for (const s of e.seances as SeanceEnvoyee[])
    if (s.nolio_id && (s.genre ?? 'seance') === 'seance' && !s.jour_id.includes(':')) parNolio.set(String(s.nolio_id), s.jour_id);
  type Reel = { id: string; date_start: string; duration?: { value: number } | null; planned?: string | null;
    debrief?: { rpe?: number | null; feeling?: number | null } | null };
  const reels = await listeNolio<Reel>(`real/trainings/?date_from=${du}&date_to=${au}&fields=id,date_start,duration,planned,debrief${qui}`);
  const seances: RetourSeance[] = reels.filter((r) => r.planned && parNolio.has(r.planned)).map((r) => ({
    id: parNolio.get(r.planned as string) as string, date: r.date_start.slice(0, 10), faite: true,
    duree_min: r.duration?.value ? Math.round(r.duration.value / 60) : null,
    rpe: o.accordLecture ? r.debrief?.rpe ?? null : null, ressenti: o.accordLecture ? r.debrief?.feeling ?? null : null,
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
  return { seances, hooper, ...(dernier ? { questionnaire: lireQuestionnaire(dernier.items) } : {}) };
}

// ─── Écrire et envoyer ────────────────────────────────────────────────────

// La semaine qui contient une date, dans les données du plan ; null hors du plan.
export function semaineDu(plan: Plan, dateIso: string): Semaine | null {
  return plan.semaines.find((s) => s.lundi && s.lundi <= dateIso && dateIso <= ajouterJours(s.lundi, 6)) ?? null;
}

async function garderNote(o: Objectif, cle: string, dateIso: string, titre: string, texte: string) {
  const d = await destinataire(o.nolioAthlete);
  const cree = await creer(d, cle, { name: titre, date_start: dateIso, color: COULEUR_NOTE, description: texte }, 'note');
  if (cree.erreur) throw new Error(cree.erreur);
  await garderEnvoi(o.coachId, o.planId, cle, [cree]);
}

// Écrire une semaine et l'envoyer (la créer, ou la mettre à jour si elle est déjà partie : le coach a annulé, la fatigue).
// depuis : les jours d'avant ne partent pas (un départ en milieu de semaine).
export async function ecrireEtEnvoyer(o: Objectif, numero: string, retours: Retours | null, options: {
  sansAjustement?: boolean; depuis?: string;
} = {}): Promise<SortieMoteur> {
  const sortie = await moteur<SortieMoteur>('/v1/semaine', {
    parametres: o.parametres, numero, etat: o.etat, retours, sans_ajustement: Boolean(options.sansAjustement),
  });
  const service = clientService();
  if (sortie.parametres) {
    await service.from('plans').update({ parametres: sortie.parametres }).eq('id', o.planId);
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
export async function demarrerObjectif(planId: string): Promise<string> {
  const o = await objectifEcrit(planId);
  if (!o) throw new Error('Ce plan ne s’écrit pas semaine par semaine.');
  if (!o.nolioAthlete) throw new Error('L’athlète n’a pas encore de compte Nolio relié.');
  const aujourdhui = aujourdhuiParis();
  const debut = o.plan.semaines.find((s) => s.lundi && ajouterJours(s.lundi, 6) >= aujourdhui);
  if (!debut?.lundi) throw new Error('La course est passée.');
  await envoyerTrame(o, aujourdhui);
  await programmerQuestionnaires(o, dimancheSuivant(debut.lundi < aujourdhui ? aujourdhui : debut.lundi));
  const deja = o.envois.some((e) => e.semaine === debut.numero);
  if (!deja) await ecrireEtEnvoyer(o, debut.numero, null, { depuis: aujourdhui > debut.lundi ? aujourdhui : undefined });
  if (!o.coache) await rangerAcheteur(o);
  return debut.numero;
}

// ─── Le dimanche, chaque jour ─────────────────────────────────────────────

// Les plans écrits semaine par semaine dont l'athlète est dans Nolio et la course à venir.
async function plansActifs(): Promise<string[]> {
  const service = clientService();
  const { data } = await service.from('plans').select('id, nolio_statut, course_date').not('parametres', 'is', null)
    .gte('course_date', aujourdhuiParis());
  const { data: coaches } = await service.from('coaching').select('plan_id');
  const coachesIds = new Set((coaches ?? []).map((c) => c.plan_id as string));
  return (data ?? []).filter((p) => p.nolio_statut === 'actif' || coachesIds.has(p.id as string)).map((p) => p.id as string);
}

export type Compte = { plan: string; quoi: string; erreur?: string; coache?: boolean; journal?: Record<string, unknown>[] };

// Chaque dimanche soir : la semaine suivante de chaque plan actif, écrite d'après la semaine écoulée.
export async function passageDuDimanche(): Promise<Compte[]> {
  const aujourdhui = aujourdhuiParis();
  const lundi = ajouterJours(aujourdhui, 1);
  const comptes: Compte[] = [];
  for (const planId of await plansActifs()) {
    try {
      const o = await objectifEcrit(planId);
      if (!o?.nolioAthlete) continue;
      const s = semaineDu(o.plan, lundi);
      if (!s || o.envois.some((e) => e.semaine === s.numero)) continue;
      const retours = await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
      const sortie = await ecrireEtEnvoyer(o, s.numero, retours);
      comptes.push({ plan: planId, quoi: `${s.numero} écrite`, coache: o.coache, journal: sortie.journal });
    } catch (e) {
      comptes.push({ plan: planId, quoi: 'semaine non écrite', erreur: e instanceof Error ? e.message : String(e) });
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
    await garderNote(o, `${r.remplacer}:fatigue`, jour.date_iso, 'Séance allégée', `${r.note} Garder ma séance d’origine : ${lien}`);
  }
  return { plan: planId, quoi: `${r.remplacer} allégée`, coache: o.coache, journal: r.journal ? [r.journal] : [] };
}

// Le veto : l'athlète garde sa séance d'origine, celle d'avant l'allègement (gardée dans le jour allégé) ; l'état
// oublie l'allègement (A8 : la marche n'est pas reprise).
export async function garderSeanceOrigine(planId: string, seance: string, compteId: string): Promise<boolean> {
  const o = await objectifEcrit(planId);
  if (!o || (o.compteId !== compteId && o.coachId !== compteId) || !o.etat) return false;
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
  const { data: p } = await service.from('plans').select('nolio_email, nolio_statut, nolio_athlete_id, course_nom').eq('id', planId).single();
  if (p?.nolio_statut === 'actif' || p?.nolio_statut === 'invite') return p.nolio_statut;
  const equipeId = await equipeDuCoach();
  const email = String(p?.nolio_email || emailAchat).trim();
  const r = equipeId ? await appelNolio('POST', `team/teams/${equipeId}/invitations/`, { email, role: 'athlete' }) : null;
  if (!r || (r.statut !== 201 && r.statut !== 200)) {
    const pleine = r?.statut === 400;
    await service.from('plans').update({ nolio_statut: 'a_inviter' }).eq('id', planId);
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
  for (const planId of await plansActifs()) {
    try {
      const c = await fatigueDuJour(planId);
      if (c) comptes.push(c);
    } catch (e) {
      comptes.push({ plan: planId, quoi: 'fatigue non lue', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  comptes.push(...await reinviter());
  await resumeAuCoach(comptes.filter((c) => c.coache && c.journal?.length));
  return comptes;
}

const REGLES_EN_CLAIR: Record<string, string> = {
  R1: 'semaine en grande partie manquée', R2: 'séance clé trop dure ou écourtée', R3: 'fatigue', R4: 'arrêt',
  R5: 'disponibilités', R7: 'séance en plus', O3: 'course secondaire',
};

// Un e-mail par jour au plus : les ajustements de la journée chez les coachés (le dimanche, ceux de la semaine écrite).
async function resumeAuCoach(fatigues: Compte[]) {
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
  if (!lignes.length) return;
  await prevenirCoach(`Tes coachés : ${lignes.length} ajustement${lignes.length > 1 ? 's' : ''} aujourd’hui`,
    `${lignes.join('\n')}\n\nChaque ajustement s’annule dans ton Suivi (${site.url}/app/coach/suivi).`);
}
