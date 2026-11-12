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
import { API_URL, dureeConseillee, dureesPossibles, lireTemps, type Champs, type ConfigPlan } from '@/lib/plan';
import {
  chargeDepuisNolio, creer, destinataire, envoyerSemaineCible, ficheAthlete, garderEnvoi, mettreAJourSemaineCible, profilDe, seancesDuMoteur,
  volumeDuMoment,
  type Cible, type Envoi, type SeanceEnvoyee,
} from './coaching';
import { envoyerRelanceInvitation, EXPEDITEUR } from './emailBienvenue';
import { lienFicheCourse } from './ficheCourse';
import { glucidesDeLaStrategie } from './strategie';
import { dateDe } from './trameNolio';
import { appelNolio, athletesNolio, coachs, listeNolio, moiNolio, refusNolio, sansVitesseImpossible, SPORTS_COURSE, type ReponseNolio } from './nolio';
import { estAncien, sansEcriture } from './anciens';
import { ajouterJours, joursEntre, SCHEMA_PLAN, type Plan, type Semaine } from './plan';
import { clientService } from './supabase';
import type { Fiche } from './tableau';
import { fcSeuil2DuTest, lireParole, vcDuTest, type Flux, type Tour } from './tests';
import { allure, coefficientRiegel, kmh, PROFIL_VIDE } from './zones';
import { reperesDeBase } from './reperes';
import { aDesReperes } from './reperesLus';
import { ecrireZonesNolio } from './zonesNolio';
import { allureViseeKmh, ecrireAllureVisee } from './metriquesNolio';
import { chargeChangee, chargeDe, jourAlerteNolio, jourDInvitation, JOURS_RELANCE_INVITATION } from './invitation';
import { lireConfirmation, rappelerLesConfirmations } from './confirmation';
import { CONTINUITE_ACTIVE, lireLesRetouches, seancesLues, type SeanceLue } from './continuite';
import { relierAuxPrevues } from './relier';
import { derniereCourse, JOURS_DERNIERE_COURSE, rienDeLu } from './derniereCourse';
import { semaineAReprendre, sortieApresArret } from './reprises';
import { historiqueDejaRecu, historiqueParSemaine, niveauHabituel, plusLonguesParSemaine, SEMAINES_HISTORIQUE, type HistoriqueSemaine } from './charge';
import { correctionsAEnvoyer, CORRECTIONS_ACTIVES, marquerAppliquees } from './corrections';
import { derniereActivite, garderLesSignaux } from './signauxGardes';
import { demonstrationCoachOuverte, moteurDemonstration } from './demonstrationCoach';
import { enTetesMoteur } from './cleMoteur';
import { signaux } from './signauxSuivi';
import { JOURS_DERNIERE_REPONSE, QUESTIONNAIRE_SEMAINE, questionnaireDeLaSemaine, type Questionnaire } from './questionnaireSamedi';

export { QUESTIONNAIRE_SEMAINE, type Questionnaire };
import { seuilsSuivi } from './suivi';
import type { FamilleLue, ProfilLu } from './classement';
import { messageDoublon, objectifQuiCouvre } from './departs';
import { debutApres, departCalcule, dureeTexte, enReprise, heuresDuTemps as heures, lundiDuRythme, partApres, partEnSuite,
  precedentDuDepart, saisonEnReprise, slApresCourse, enUneLigne, texteDeLaSuite, texteDepartLundiApres, type ObjectifVoisin } from './jonction';

export { debutApres };

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
export type Retours = {
  seances: RetourSeance[]; hooper: { date: string; valeur: number }[]; questionnaire?: Questionnaire; nolio?: SemaineNolio;
  // S11 : le jour de la réponse au questionnaire du samedi qui sert (celle de la semaine, ou la dernière, plus ancienne) ;
  // pour « Ce qu'il a lu » du coach. Le moteur ne la lit pas.
  questionnaire_du?: string;
  // La continuité (audit du 30/10/2026) : les séances faites des 4 dernières semaines, classées par leur structure.
  lues?: SeanceLue[];
  // La dernière course lue dans Nolio (course, trail, tapis ; moteur 8.460, lib/app/derniereCourse.ts) : l'arrêt (R4) se
  // lit même quand elle précède le plan ou sort de la fenêtre lue ; absente sans aucune course lue.
  derniere_course?: string;
  // LA DOSE VIENT DE L'ATHLÈTE (décision du coach du 10/11/2026, au soir ; moteur 8.461) : à la première semaine d'un départ,
  // les lundis des semaines creuses d'un objectif d'avant (son affûtage, sa course, sa récupération), qui ne comptent pas
  // dans la fenêtre d'une séance récente.
  creux?: string[];
};
// « Nolio fait foi » (décisions coach du 20/10/2026) : la semaine telle qu'elle est dans Nolio, que le moteur juge
// (cts_ajustements.semaine_reelle) : chaque séance qu'il a écrite et qui y est encore, avec sa durée et son RPE (une
// absente et non faite, le coach l'a supprimée) — et, retouchée par le coach (son contenu a changé, D4), la famille
// qu'elle a dans Nolio (D1, 04/11/2026) ; les séances de course et de trail ajoutées, posées par le coach ou courues par
// l'athlète, hors jours de course.
type SemaineNolio = {
  prevues: Record<string, { duree_min: number | null; rpe: number | null; famille?: FamilleLue }>;
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
  // Le pourquoi de la semaine, pour le coach (moteur, cts_pourquoi ; demande du coach du 31/10/2026).
  pourquoi?: Pourquoi;
  // D7 (moteur 8.451, audits du 05/11/2026) : la semaine que le contrôle du moteur refusait, écrite par un repli (1 : la
  // même, sortie longue plafonnée ; 2 : celle du plan de l'achat, plafonnée ; 3 : celle du plan de l'achat) ; null sinon.
  repli?: { niveau: number; effet?: string; refus?: string } | null;
  // Moteur 8.460 (la doctrine de la semaine) : le niveau habituel, et ce que « la semaine suivante » a décidé élément par
  // élément (les sept réponses, elles, sont dans `semaine.pourquoi`).
  niveau_habituel?: NiveauHabituel | null;
  semaine_suivante?: Record<string, unknown> | null;
};
export type Pourquoi = {
  profil: string[]; ou: string; semaine_passee: string | null; regles: Record<string, unknown>[];
  seances: { jour: string; seance: string | null; pourquoi: string }[]; placement: string;
};
// Le niveau habituel (moteur 8.460, décisions 8 et 11 du coach du 09/11/2026 : « Ses repères », côté coach seulement) :
// sa semaine typique et chaque semaine lue, retenue ou écartée avec sa raison. Rien ne l'affiche encore.
export type NiveauHabituel = {
  volume_min: number; sl_min: number | null; semaines: number; source: 'nolio' | 'declare';
  detail?: { lundi: string; volume_min: number; sl_min: number; retenue: boolean; raison?: string; source?: string }[];
};
export type Realise = {
  numero: string; lundi: string; type: string | null; charge_prevue: number; charge_faite: number; charge_tenue: number; rpe_lu: boolean;
  seances_prevues: number; seances_faites: number; duree_prevue_min: number; duree_faite_min: number;
  sl_prevue_min: number | null; sl_faite_min: number | null; cles_prevues: number; cles_reussies: number;
  dplus_m: number | null; hooper: number | null;
  // Une semaine résumée depuis Nolio (resumeSemaine.ts) : chaque séance faite a son RPE, la charge est entière.
  rpe_complet?: boolean;
};

// LA REVUE DU DIMANCHE, GARDÉE AU PASSAGE (l'espace par athlète, Q4 « A », décision coach du 08/11/2026) : ce que l'aperçu
// du dimanche montre et que la semaine écrite ne garde pas, pour « Sa semaine qui arrive » le dimanche soir — le
// « pourquoi » du moteur, et ce qu'il a lu (sa réponse du samedi, la semaine écoulée telle qu'il l'a jugée, ses séances de
// qualité des 4 dernières semaines). Jamais le détail des séances lues dans Nolio (les retours entiers) : seulement ce que
// l'aperçu affiche. Colonne semaines_ecrites.revue (supabase/migrations/20261108000000_revue_du_dimanche.sql) ; elle
// s'efface avec l'accord de lecture. premiere : la première semaine d'une saison de fond, lue avec son questionnaire seul ;
// sansRetours : rien de lu (une première semaine).
export type Revue = {
  quoi: string; pourquoi: Pourquoi | null; realise: Realise | null;
  lu: { questionnaire?: Questionnaire; questionnaire_du?: string; lues?: SeanceLue[]; premiere?: boolean; sansRetours?: boolean };
};
export function revueDe(sortie: Pick<SortieMoteur, 'pourquoi' | 'realise'>, retours: Retours | null, quoi: string, premiere = false): Revue {
  return {
    quoi, pourquoi: sortie.pourquoi ?? null, realise: sortie.realise ?? null,
    // Une première semaine qui ne porte que la dernière course (8.460) : « rien n'est lu », comme sans retours.
    lu: retours === null || rienDeLu(retours) ? { sansRetours: true } : {
      ...(retours.questionnaire ? { questionnaire: retours.questionnaire } : {}),
      ...(retours.questionnaire_du ? { questionnaire_du: retours.questionnaire_du } : {}),
      ...(retours.lues ? { lues: retours.lues } : {}),
      ...(premiere ? { premiere: true } : {}),
    },
  };
}
// Gardée à part, après l'écriture : une erreur ici (la migration pas encore passée, la base qui ne répond pas) n'empêche
// jamais une semaine de partir, et ne fait rien échouer.
async function garderLaRevue(planId: string, numero: string, revue: Revue | ((avant: Revue | null) => Revue | null)): Promise<void> {
  try {
    const service = clientService();
    let valeur = typeof revue === 'function' ? null : revue;
    if (typeof revue === 'function') {
      const { data, error } = await service.from('semaines_ecrites').select('revue').eq('plan_id', planId).eq('numero', numero).maybeSingle();
      if (error) return;
      valeur = revue((data?.revue ?? null) as Revue | null);
      if (!valeur) return;
    }
    const { error } = await service.from('semaines_ecrites').update({ revue: valeur }).eq('plan_id', planId).eq('numero', numero);
    if (error) console.error(`Revue de ${planId} ${numero} non gardée :`, error.message);
  } catch (e) {
    console.error(`Revue de ${planId} ${numero} non gardée :`, e instanceof Error ? e.message : e);
  }
}

// Les clés de nolio_envois qui ne sont pas des semaines : la trame (bandeaux et fiches de tout le plan), les
// questionnaires du dimanche, la note de bilan d'une semaine (« S9:bilan ») et la note d'un ajustement en cours de
// semaine (« S9-jeudi:fatigue »).
export const TRAME = 'trame';
const QUESTIONNAIRES = 'questionnaires';
const COULEUR_NOTE = '#0C6E5F';

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
  // En démonstration (lib/app/demonstrationCoach.ts) : ce que le moteur a écrit pour elle, rien d'autre.
  if (demonstrationCoachOuverte()) return moteurDemonstration<T>(chemin, corps);
  const r = await fetch(`${API_URL}${chemin}`, {
    method: 'POST', headers: enTetesMoteur({ 'Content-Type': 'application/json' }), body: JSON.stringify(corps), cache: 'no-store',
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
  seances_cles: { jour: string; seance: string; nom?: string; famille: string }[]; week_end_choc: boolean; sl_min: number | null;
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

const requeteAthlete = async (o: Pick<Objectif, 'nolioAthlete'>) => {
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


// Ce que le moteur juge : les séances faites (reliées à leur jour du plan par l'envoi), le Hooper, le questionnaire, et
// la semaine telle qu'elle est dans Nolio (« Nolio fait foi »). Rien n'est gardé : le moteur en tire ce qu'il garde dans
// son état (la plus longue sortie courue, le volume fait).
// garder : ce qui a été lu, tel quel (les séances prévues, les activités, le Hooper), pour les signaux gardés du soir
// (EC2, lib/app/signauxGardes.ts) : aucun appel de plus à Nolio.
export type LuDansNolio = { planifiees: { id: string; name?: string | null; date_start: string; sport?: string | null; rpe?: number | null }[];
  reels: { id: string; date_start: string; planned?: string | null; debrief?: { rpe?: number | null; feeling?: number | null; comment?: string | null } | null }[];
  hooper: { id: string; date_start: string; value: number | null }[] };
export async function lireRetours(o: Objectif, du: string, au: string, garder?: (lu: LuDansNolio) => void): Promise<Retours> {
  const qui = await requeteAthlete(o);
  const parNolio = new Map<string, string>();
  for (const e of o.envois) for (const s of e.seances as SeanceEnvoyee[])
    if (s.nolio_id && (s.genre ?? 'seance') === 'seance' && !s.jour_id.includes(':')) parNolio.set(String(s.nolio_id), s.jour_id);
  type Reel = { id: string; name?: string | null; date_start: string; sport?: string | null; duration?: { value: number } | null; planned?: string | null;
    elevation_gain?: { value: number } | null; distance?: { value?: number; unit?: string } | number | null;
    debrief?: { rpe?: number | null; feeling?: number | null } | null };
  // « Nolio fait foi » : les séances prévues de ces semaines, une semaine de marge de chaque côté (une séance déplacée
  // juste à côté reste la sienne).
  type Prevue = { id: string; name?: string | null; date_start: string; sport?: string | null; duration?: { value?: number } | null;
    rpe?: number | null; revision?: string | null };
  // Avec la continuité, la révision de chaque séance (une séance du moteur retouchée par le coach devient la sienne).
  const planifiees = await listeNolio<Prevue>(`planned/trainings/?date_from=${ajouterJours(du, -7)}&date_to=${ajouterJours(au, 7)}${qui}`
    + (CONTINUITE_ACTIVE ? '&with_revision=true' : ''));
  const jours = new Set([o.plan.course.date, ...((o.parametres.courses_secondaires ?? []) as Course[]).map((c) => c.date)]);
  // Q1 : une activité que Nolio n'a pas reliée se relie à la séance du même jour, ou à celle de la semaine dont elle porte
  // le nom (lancée depuis la montre) ; sinon elle reste une sortie en plus (lib/app/relier.ts). Son nom : `name`.
  // A-44 (audits du 05/11/2026) : le debrief (RPE, ressenti) ne se demande à Nolio qu'avec l'accord de lecture ; sans lui,
  // les séances et leur durée seulement, comme le dit la politique de confidentialité.
  const reels = relierAuxPrevues((await listeNolio<Reel>(
    `real/trainings/?date_from=${du}&date_to=${au}&fields=id,name,date_start,sport,duration,distance,elevation_gain,planned${o.accordLecture ? ',debrief' : ''}${qui}`))
    .map(sansVitesseImpossible), planifiees, SPORTS_COURSE, jours);
  // D4 et D1 : les retouches du coach, jugées sur le contenu des séances (lib/app/continuite.ts) ; avec la continuité,
  // une lecture qui échoue n'empêche pas la semaine (la règle de la révision, sans famille).
  const envoyees = o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]);
  const d = CONTINUITE_ACTIVE ? await destinataire(o.nolioAthlete).catch(() => null) : null;
  const retouches = d ? await lireLesRetouches({ planifiees, envoyees, profil: o.profil as ProfilLu,
    athlete: d.moi ? '' : d.usr, du, au }).catch((e) => {
    console.error(`Retouches lues de ${o.planId} :`, e instanceof Error ? e.message : e);
    return null;
  }) : null;
  const seances: RetourSeance[] = reels.filter((r) => r.planned && parNolio.has(r.planned)).map((r) => ({
    id: parNolio.get(r.planned as string) as string, date: r.date_start.slice(0, 10), faite: true,
    duree_min: r.duration?.value ? Math.round(r.duration.value / 60) : null,
    rpe: o.accordLecture ? r.debrief?.rpe ?? null : null, ressenti: o.accordLecture ? r.debrief?.feeling ?? null : null,
    dplus_m: typeof r.elevation_gain?.value === 'number' ? Math.round(r.elevation_gain.value) : null,
  }));
  let hooper: Retours['hooper'] = [];
  let valeursHooper: LuDansNolio['hooper'] = [];
  const item = o.accordLecture ? await indiceHooper() : null;
  if (item) {
    valeursHooper = await listeNolio<{ id: string; date_start: string; value: number | null }>(
      `metrics/values/?item=${item}&date_from=${ajouterJours(au, -42)}&date_to=${au}${qui}`);
    hooper = valeursHooper.filter((v) => typeof v.value === 'number')
      .map((v) => ({ date: v.date_start.slice(0, 10), valeur: v.value as number }));
  }
  garder?.({ planifiees, reels, hooper: valeursHooper });
  const reponse = await lireLeQuestionnaire(o, au, qui);
  const minutes = (d: { value?: number } | null | undefined) => (typeof d?.value === 'number' ? Math.round(d.value / 60) : null);
  const rpe = (x: unknown) => (typeof x === 'number' ? x : null);
  // Course ou trail, dans la période, hors jours de course (la course n'est pas une charge d'entraînement).
  const deCourse = (sport: unknown, date: string) =>
    SPORTS_COURSE.includes(String(sport)) && date.slice(0, 10) >= du && date.slice(0, 10) <= au && !jours.has(date.slice(0, 10));
  const prevues: SemaineNolio['prevues'] = Object.fromEntries(planifiees.filter((p) => parNolio.has(p.id))
    .map((p) => [parNolio.get(p.id) as string, { duree_min: minutes(p.duration), rpe: rpe(p.rpe),
      ...(retouches?.familles.has(p.id) ? { famille: retouches.familles.get(p.id) } : {}) }]));
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
  // LA CONTINUITÉ (décisions coach du 26/10/2026) : ses séances faites, classées par leur structure, quel qu'en soit
  // l'auteur ; derrière son interrupteur (lib/app/continuite.ts), une lecture qui échoue n'empêche pas la semaine.
  const lues = CONTINUITE_ACTIVE && d ? await (async () => {
    // Une séance du moteur que le coach a retouchée (son contenu a changé depuis l'envoi, D4) est la sienne : sa dose
    // compte. Sans la lecture des retouches, la règle de la révision.
    const revisions = new Map(envoyees.filter((x) => x.nolio_id).map((x) => [String(x.nolio_id), x.revision ?? null]));
    const intactes = retouches?.intactes ?? new Set(planifiees.filter((p) => revisions.has(p.id)
      && (!revisions.get(p.id) || !p.revision || revisions.get(p.id) === p.revision)).map((p) => p.id));
    return seancesLues({ planifiees, reelles: reels, moteur: intactes, profil: o.profil as ProfilLu,
      accordLecture: o.accordLecture, athlete: d.moi ? '' : d.usr, au, corps: retouches?.corps });
  })().catch((e) => {
    console.error(`Séances lues de ${o.planId} :`, e instanceof Error ? e.message : e);
    return undefined;
  }) : undefined;
  // La dernière course lue (8.460), jours de course compris (une course est une course) : le moteur la garde dans son état.
  const derniere = derniereCourse(reels, SPORTS_COURSE, au);
  return { seances, hooper, nolio: { prevues, ajoutees }, ...reponse, ...(lues ? { lues } : {}),
    ...(derniere ? { derniere_course: derniere } : {}) };
}

// La dernière course de l'athlète dans Nolio, sur les 90 jours qui finissent à `au` (lib/app/derniereCourse.ts) : la date
// seulement, lue sans débrief (comme les séances et leur durée sans accord de lecture) ; null sans aucune course.
async function derniereCourseLue(o: Objectif, au: string): Promise<string | null> {
  const qui = await requeteAthlete(o);
  const reels = await listeNolio<{ id: string; date_start: string; sport?: string | null }>(
    `real/trainings/?date_from=${ajouterJours(au, -JOURS_DERNIERE_COURSE)}&date_to=${au}&fields=id,date_start,sport${qui}`);
  return derniereCourse(reels, SPORTS_COURSE, au);
}

// Le questionnaire du samedi, lu dans Nolio. Les réponses envoyées seulement (is_confirmed) : Nolio liste aussi les
// questionnaires ouverts et pas envoyés, aux valeurs de brouillon (25/10/2026 : un « 3 » lu « −6 » avant l'envoi).
// S11 (décision coach du 05/11/2026, audit A-18) : sans réponse cette semaine, la semaine s'écrit sur les jours de sa
// DERNIÈRE réponse, plus ceux de l'achat : les 8 dernières semaines sont lues en une fois (questionnaireDeLaSemaine).
async function lireLeQuestionnaire(o: Objectif, au: string, qui?: string): Promise<Pick<Retours, 'questionnaire' | 'questionnaire_du'>> {
  const athlete = qui ?? await requeteAthlete(o);
  // Une lecture qui échoue se dit dans les journaux (08/11/2026 : « Pas de réponse au questionnaire du samedi » d'un
  // coaché dont la réponse du samedi se voyait dans Nolio ; un échec de Nolio ne laissait aucune trace, rien ne le
  // distinguait d'une absence de réponse). La semaine s'écrit toujours, sur ses jours habituels.
  const resultats = (await listeNolio<{ id: string; name?: string; date_start: string; is_confirmed?: boolean; items: { question: string; value: unknown }[] }>(
    `real/quiz_results/?date_from=${ajouterJours(au, -JOURS_DERNIERE_REPONSE)}&date_to=${au}${athlete}`).catch((e) => {
    console.error(`Questionnaire du samedi de ${o.planId} non lu :`, e instanceof Error ? e.message : e);
    return [];
  })).filter((r) => r.is_confirmed !== false);
  const reponse = questionnaireDeLaSemaine(resultats, au, String(o.parametres.declaree_le ?? ''));
  return reponse ? { questionnaire: reponse.questionnaire, questionnaire_du: reponse.du } : {};
}

// LA PREMIÈRE SEMAINE D'UNE SAISON DE FOND (bogue vu par le coach le 08/11/2026, correction « A ») : sans semaine écrite
// avant, ses retours restaient nuls, pour que le moteur ne lise pas un arrêt ; le questionnaire du samedi partait avec,
// et la semaine s'écrivait sur les jours et le nombre de séances de l'inscription (4 séances écrites, réponse « 3 »).
// Maintenant la réponse du questionnaire seule, sans séances, Hooper ni semaine Nolio : le moteur (cts_semaine,
// vérifié sur 8.459) n'y lit ni arrêt (R4 : aucune séance faite connue, ni dans son état), ni séance manquée (R1, R2 et
// R3 attendent une semaine écrite), ni résumé ; il place la semaine sur ses jours et son nombre de séances. Sans
// réponse : rien, comme avant. Le passage du dimanche, son aperçu et « Réessayer » la lisent ainsi tous les trois.
// L'ARRÊT D'AVANT LE PLAN (moteur 8.460, défaut vu par le coach le 08/11/2026) : avec elle, la date de sa dernière course
// lue dans Nolio (90 jours) ; le moteur la garde dans son état, sans rien changer à cette première semaine, et dit
// l'arrêt au premier dimanche si l'athlète ne court plus. Une lecture qui échoue n'empêche rien (la date manque, comme
// avant) ; sans réponse ni course lue : rien, comme avant.
// D1 (accord du coach du 10/11/2026, au soir ; la règle « la dose vient de l'athlète », moteur 8.461) : la première semaine
// lit aussi ses séances d'avant le plan — ses séances de qualité faites des 12 dernières semaines, lues dans Nolio et
// classées comme les dimanches suivants (seancesLues : la fenêtre d'une séance récente va jusqu'à 8 semaines chez le
// confirmé, sans les semaines creuses), derrière le même interrupteur ; et les semaines creuses d'un objectif d'avant. Une
// lecture qui échoue n'empêche rien (la semaine part du bas de l'échelle du bloc).
async function retoursDeLaPremiere(o: Objectif, au: string): Promise<Retours | null> {
  const reponse = await lireLeQuestionnaire(o, au);
  const derniere = await derniereCourseLue(o, au).catch((e) => {
    console.error(`Dernière course de ${o.planId} :`, e instanceof Error ? e.message : e);
    return null;
  });
  const lues = await luesDuDepart(o, au).catch((e) => {
    console.error(`Séances lues au départ de ${o.planId} :`, e instanceof Error ? e.message : e);
    return undefined;
  });
  const creux = await semainesCreusesAvant(o, au).catch((e) => {
    console.error(`Semaines creuses avant ${o.planId} :`, e instanceof Error ? e.message : e);
    return [] as string[];
  });
  if (!reponse.questionnaire && !derniere && !lues?.length && !creux.length) return null;
  return { seances: [], hooper: [], ...reponse, ...(derniere ? { derniere_course: derniere } : {}),
    ...(lues?.length ? { lues } : {}), ...(creux.length ? { creux } : {}) };
}

export const SEMAINES_LUES_DEPART = 12;
async function luesDuDepart(o: Objectif, au: string): Promise<SeanceLue[] | undefined> {
  const d = CONTINUITE_ACTIVE ? await destinataire(o.nolioAthlete).catch(() => null) : null;
  if (!d) return undefined;
  const qui = await requeteAthlete(o);
  const du = ajouterJours(au, -7 * SEMAINES_LUES_DEPART + 1);
  type Prevue = { id: string; name?: string | null; date_start: string; sport?: string | null; duration?: { value?: number } | null;
    rpe?: number | null; revision?: string | null };
  // Les mêmes champs que lireRetours (relierAuxPrevues, sansVitesseImpossible).
  type Reel = { id: string; name?: string | null; date_start: string; sport?: string | null; duration?: { value: number } | null;
    planned?: string | null; elevation_gain?: { value: number } | null; distance?: { value?: number; unit?: string } | number | null;
    debrief?: { rpe?: number | null; feeling?: number | null } | null };
  const planifiees = await listeNolio<Prevue>(`planned/trainings/?date_from=${ajouterJours(du, -7)}&date_to=${ajouterJours(au, 7)}${qui}&with_revision=true`);
  const jours = new Set([o.plan.course.date, ...((o.parametres.courses_secondaires ?? []) as Course[]).map((c) => c.date)]);
  const reels = relierAuxPrevues((await listeNolio<Reel>(
    `real/trainings/?date_from=${du}&date_to=${au}&fields=id,name,date_start,sport,duration,distance,elevation_gain,planned${o.accordLecture ? ',debrief' : ''}${qui}`))
    .map(sansVitesseImpossible), planifiees, SPORTS_COURSE, jours);
  // Ses séances déjà envoyées par le moteur, intactes (un départ réessayé) : les siennes, sa progression continue.
  const revisions = new Map(o.envois.flatMap((e) => e.seances as SeanceEnvoyee[]).filter((x) => x.nolio_id)
    .map((x) => [String(x.nolio_id), x.revision ?? null]));
  const intactes = new Set(planifiees.filter((p) => revisions.has(p.id)
    && (!revisions.get(p.id) || !p.revision || revisions.get(p.id) === p.revision)).map((p) => p.id));
  return seancesLues({ planifiees, reelles: reels, moteur: intactes, profil: o.profil as ProfilLu,
    accordLecture: o.accordLecture, athlete: d.moi ? '' : d.usr, au, semaines: SEMAINES_LUES_DEPART });
}

// Les semaines creuses d'un objectif d'avant dont la course tombe dans les 12 semaines lues : celles que son plan type en
// affûtage (« Affûtage actif », « Décharge ») ou en récupération, et de la semaine de sa course jusqu'au départ (sa course,
// sa récupération).
const TYPES_CREUX = ['Affûtage actif', 'Décharge', 'Récupération'];
async function semainesCreusesAvant(o: Objectif, au: string): Promise<string[]> {
  const debut = ajouterJours(au, -7 * SEMAINES_LUES_DEPART + 1);
  const precedents = (await autresObjectifs(o)).filter((q) => !q.fond && q.demarre && q.course_date
    && q.course_date >= debut && q.course_date <= au);
  if (!precedents.length) return [];
  const { data } = await clientService().from('plans').select('id, semaines:donnees->semaines').in('id', precedents.map((q) => q.id));
  const creux = new Set<string>();
  for (const p of data ?? []) {
    for (const s of ((p as { semaines?: unknown }).semaines ?? []) as { lundi?: string | null; type?: string | null }[]) {
      if (s.lundi && s.lundi >= lundiDe(debut) && s.lundi <= au && TYPES_CREUX.includes(String(s.type))) creux.add(s.lundi);
    }
  }
  for (const q of precedents) for (let l = lundiDe(q.course_date); l <= au; l = ajouterJours(l, 7)) creux.add(l);
  return [...creux].sort();
}


// ─── Écrire et envoyer ────────────────────────────────────────────────────

// La semaine qui contient une date, dans les données du plan ; null hors du plan.
export function semaineDu(plan: Plan, dateIso: string): Semaine | null {
  return plan.semaines.find((s) => s.lundi && s.lundi <= dateIso && dateIso <= ajouterJours(s.lundi, 6)) ?? null;
}

// La semaine en cours rattrapée à la main (« Réessayer » dans « À regarder », décision coach du 21/10/2026) : écrite et
// envoyée comme le dimanche, à partir d'aujourd'hui, avec la même réservation qui empêche de la doubler.
// depuis : le premier jour écrit (aujourd'hui par défaut ; le lendemain pour la reprise du soir, E4).
export async function rattraperLaSemaine(planId: string, { depuis }: { depuis?: string } = {}): Promise<string> {
  const o = await objectifEcrit(planId);
  if (!o?.nolioAthlete) throw new Error('L’athlète n’a pas encore de compte Nolio relié.');
  if ((await plansALaMain()).has(planId)) throw new Error('Tu programmes cet athlète à la main : rien ne s’écrit dans son Nolio.');
  const aujourdhui = aujourdhuiParis();
  const lundi = ajouterJours(aujourdhui, -((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  const s = semaineDu(o.plan, lundi);
  if (!s) throw new Error('Pas de semaine de préparation cette semaine.');
  const reservation = await etatDeLaReservation(o, s.numero);
  if (reservation === 'finie') return s.numero;
  if (reservation === 'en_cours') throw new Error('Cette semaine est en train de partir : regarde dans une minute.');
  // B-EC-5 : des séances de course déjà dans son Nolio cette semaine (les tiennes, laissées dimanche) restent : rien ne
  // s'écrit par-dessus.
  if (o.envois.some((e) => e.semaine === cleLaissee(lundi)) || await seancesDejaPosees(o, lundi, ajouterJours(lundi, 6))) {
    throw new Error('Des séances que tu as posées sont déjà dans son Nolio cette semaine : elles restent les tiennes, rien ne s’écrit par-dessus.');
  }
  const service = clientService();
  if (reservation === 'orpheline') {
    if (!await reprendreLaReservation(planId, s.numero)) throw new Error('Cette semaine est en train de partir : regarde dans une minute.');
  } else {
    const { data: prise } = await service.from('nolio_envois')
      .upsert({ plan_id: planId, semaine: s.numero, coach_id: o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true })
      .select('plan_id');
    if (!prise?.length) throw new Error('Cette semaine est déjà en train de partir : regarde dans une minute.');
  }
  try {
    // La première semaine d'une saison de fond, avec son questionnaire seul, comme le dimanche.
    const premiere = Boolean((o.parametres as { fond?: unknown }).fond) && !o.envois.some((e) => /^S\d+$/.test(e.semaine));
    const retours = premiere ? await retoursDeLaPremiere(o, aujourdhui) : await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
    const sortie = await ecrireEtEnvoyer(o, s.numero, retours, { depuis: depuis && depuis > aujourdhui ? depuis : aujourdhui });
    // Q4 (08/11/2026) : son pourquoi et ce qu'il a lu, gardés à part (jamais une raison d'échec).
    await garderLaRevue(planId, s.numero, revueDe(sortie, retours, 'Semaine', premiere));
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
// Les paramètres avec le profil du jour, sans rien écrire (l'aperçu du dimanche les prend tels quels).
function avecLeProfil(o: Objectif): Record<string, unknown> {
  const vc = (o.profil as { vc_ms?: number }).vc_ms;
  const profil = vc && o.dPrime ? (coefficientRiegel(vc, o.dPrime) < 0.9 ? 'rapide' : 'endurant') : null;
  if ((o.parametres.profil_coureur ?? null) === profil) return o.parametres;
  const { profil_coureur: ancien, ...reste } = o.parametres;
  // EN SAISON DE FOND, LE TROISIÈME BLOC SUIT LE NOUVEAU PROFIL (moteur 8.460, étape D3 ; décision 7 c du coach du
  // 09/11/2026 : « test refait à la fin du premier bloc, les blocs suivants s'adaptent au nouveau profil ») : le profil du
  // début de la saison reste dans `fond.profil_depart` (posé au premier changement), qui garde les deux premiers blocs ;
  // celui d'aujourd'hui décide du troisième. Avant 8.460, le profil ne changeait pas en cours de saison.
  const fond = (o.parametres as { fond?: Record<string, unknown> }).fond;
  const fondSuivi = fond ? { fond: 'profil_depart' in fond ? fond : { ...fond, profil_depart: ancien ?? null } } : {};
  return profil ? { ...reste, ...fondSuivi, profil_coureur: profil } : { ...reste, ...fondSuivi };
}

async function suivreLeProfil(o: Objectif) {
  const parametres = avecLeProfil(o);
  if (parametres === o.parametres) return;
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// JAMAIS DEUX SEMAINES LÉGÈRES DE SUITE (décision coach du 02/11/2026, « A ») : les charges faites des quatre semaines
// d'avant celle qui s'écrit, la plus ancienne d'abord, que le moteur prend quand son état ne les a pas (la reprise d'un
// athlète programmé à la main) : le résumé d'une semaine qu'il a écrite, sinon celui lu depuis Nolio chaque nuit
// (semainesNolio.ts), quand chaque séance faite a son RPE — sans, la charge serait trop basse et la semaine passerait
// pour légère ; null sinon. Rien de nouveau n'est lu dans Nolio.
async function chargesAvant(planId: string, lundi: string | null | undefined): Promise<(number | null)[] | null> {
  if (!lundi) return null;
  const lundis = [28, 21, 14, 7].map((j) => ajouterJours(lundi, -j));
  const service = clientService();
  const { data: ecrites } = await service.from('semaines_ecrites').select('realise').eq('plan_id', planId);
  const { data: c } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
  const { data: lues } = c?.athlete_id
    ? await service.from('semaines_athlete').select('lundi, realise').eq('athlete_id', c.athlete_id).in('lundi', lundis)
    : { data: null };
  const duMoteur = new Map((ecrites ?? []).map((l) => l.realise as Realise | null).filter((r): r is Realise => Boolean(r?.lundi))
    .map((r) => [r.lundi, r.charge_faite]));
  const deNolio = new Map((lues ?? []).map((l) => [String(l.lundi), l.realise as Realise]));
  return lundis.map((l) => duMoteur.get(l) ?? (deNolio.get(l)?.rpe_complet ? deNolio.get(l)!.charge_faite : null));
}

// LA SORTIE LONGUE D'UNE SAISON DE FOND PART DE CE QU'IL A COURU (moteur 8.460, décision « B » du coach du 08/11/2026 au
// soir) : la plus longue sortie courue de chacune des 4 semaines d'avant celle qui s'écrit, la plus ancienne d'abord, lue
// dans Nolio (course, trail et tapis, sans les jours de course ; la durée seulement, comme lireRetours sans l'accord de
// lecture) ; le moteur la prend pour les semaines que son état n'a pas, celles d'avant la saison (la fin de sa
// préparation, sa récupération). Avant, la saison partait de 60 % de la plus longue de sa dernière préparation : 1h15
// pour une préparation dont la plus longue faisait 2 h. Seulement les 4 premières semaines d'une saison (ensuite l'état a
// tout) ; null hors d'une saison, ou si Nolio ne répond pas (le moteur garde alors les 60 %).
async function plusLonguesAvant(o: Objectif, lundi: string | null | undefined): Promise<number[] | null> {
  const debutSaison = (o.parametres as { fond?: { debut?: string } }).fond?.debut;
  if (!debutSaison || !lundi || !o.nolioAthlete || joursEntre(String(debutSaison).slice(0, 10), lundi) >= 28) return null;
  const debut = ajouterJours(lundi, -28);
  const { seances, competitions } = await courueDansNolio(o, debut, ajouterJours(lundi, -1));
  return plusLonguesParSemaine(debut, seances, competitions);
}

// Ce qu'il a couru dans Nolio du `debut` au `veille` compris (plusLonguesAvant, historiqueNolio) : ses activités de
// course, de trail et de tapis, la durée seulement (sans l'accord de lecture, comme lireRetours), une vitesse impossible
// écartée (sansVitesseImpossible) ; et ses jours de course (planned/competitions), que chacun met à part.
async function courueDansNolio(o: Pick<Objectif, 'nolioAthlete'>, debut: string, veille: string): Promise<{
  seances: { date: string; min: number }[]; competitions: string[];
}> {
  const qui = await requeteAthlete(o);
  const competitions = (await listeNolio<{ id: string; date_start: string }>(
    `planned/competitions/?date_from=${debut}&date_to=${veille}&fields=id,date_start${qui}`)).map((c) => c.date_start.slice(0, 10));
  type Reel = { id: string; date_start: string; sport?: string | null; duration?: { value?: number } | null;
    distance?: { value?: number; unit?: string } | number | null };
  const reels = (await listeNolio<Reel>(`real/trainings/?date_from=${debut}&date_to=${veille}&fields=id,date_start,duration,distance,sport${qui}`))
    .map(sansVitesseImpossible);
  const seances = reels.filter((r) => SPORTS_COURSE.includes(String(r.sport)) && r.duration?.value)
    .map((r) => ({ date: r.date_start.slice(0, 10), min: (r.duration as { value: number }).value / 60 }));
  return { seances, competitions };
}

// LE NIVEAU HABITUEL (décision 8 du coach du 09/11/2026, doctrine de la semaine : « le niveau habituel se lit dans Nolio
// sur ses semaines d'entraînement normales des 3 derniers mois ; sans historique, sa déclaration ») : les 13 semaines
// complètes d'avant celle qui s'écrit (du lundi 91 jours avant à la veille), la plus ancienne d'abord, lues dans Nolio
// comme plusLonguesAvant (courueDansNolio) : le volume de course et la plus longue sortie de chaque semaine, sans les
// jours de course, et la course à part (lib/app/charge.ts, historiqueParSemaine). Pour les semaines d'avant le moteur (le
// départ d'un objectif, le début d'une saison de fond) : le moteur en tire sa semaine typique en écartant lui-même les
// semaines allégées, de course et de récupération, puis la tient à jour de son état. Une seule fois : le moteur pose sa
// marque dans son état quand il le reçoit (niveau_habituel.historique, historiqueDejaRecu) ; avant elle, il part une
// fois, même pour un objectif déjà en cours. null ensuite, sans athlète Nolio ni lundi, ou si Nolio ne répond pas (le
// moteur garde alors sa déclaration, et l'historique repart la semaine d'après, la marque n'étant pas posée).
async function historiqueNolio(o: Objectif, lundi: string | null | undefined): Promise<HistoriqueSemaine[] | null> {
  if (!o.nolioAthlete || !lundi || historiqueDejaRecu(o.etat)) return null;
  return semainesDansNolio(o.nolioAthlete, lundi);
}

// Ses 13 semaines complètes d'avant `lundi`, lues dans Nolio (historiqueNolio, sans la marque de l'état) : pour le
// niveau habituel d'où part une saison de fond (lib/app/fond.ts, creerSaison ; décision 8 du coach du 09/11/2026) et la
// sortie longue de référence d'un départ (deciderLeDepart).
export async function semainesDansNolio(nolioAthlete: string, lundi: string): Promise<HistoriqueSemaine[]> {
  const debut = ajouterJours(lundi, -7 * SEMAINES_HISTORIQUE);
  const { seances, competitions } = await courueDansNolio({ nolioAthlete }, debut, ajouterJours(lundi, -1));
  return historiqueParSemaine(debut, seances, competitions);
}

// La semaine écrite par le moteur, rien d'envoyé ni de gardé.
async function semaineDuMoteur(o: Objectif, numero: string, retours: Retours | null, options: {
  sansAjustement?: boolean; reprise?: boolean;
} = {}): Promise<SortieMoteur> {
  // Sa stratégie du jour J gardée (le calculateur de nutrition) : le ravito de ses sorties longues y arrive.
  const glucides = await glucidesDeLaStrategie(o.planId).catch(() => null);
  const lundi = o.plan.semaines.find((x) => x.numero === numero)?.lundi;
  const faits = await testsFaitsSansValeur(o.planId, lundi, o.accordLecture).catch(() => new Set<string>());
  // EC3 : les corrections que le coach a choisies sur l'aperçu, derrière leur interrupteur (lib/app/corrections.ts).
  const corrections = await correctionsAEnvoyer(o.planId, lundi, Boolean(options.sansAjustement));
  return moteur<SortieMoteur>('/v1/semaine', {
    ...(corrections.length ? { corrections } : {}),
    parametres: glucides ? { ...o.parametres, glucides_cible: glucides } : o.parametres, numero, etat: o.etat, retours,
    sans_ajustement: Boolean(options.sansAjustement),
    valeurs: valeursConnues(o, lundi, faits), reprise: Boolean(options.reprise),
    charges_avant: await chargesAvant(o.planId, lundi).catch(() => null),
    sl_avant: await plusLonguesAvant(o, lundi).catch(() => null),
    // Le niveau habituel (décision 8 du coach du 09/11/2026) : les 13 semaines d'avant, une fois.
    historique: await historiqueNolio(o, lundi).catch(() => null),
  });
}

export async function ecrireEtEnvoyer(o: Objectif, numero: string, retours: Retours | null, options: {
  sansAjustement?: boolean; depuis?: string; reprise?: boolean;
} = {}): Promise<SortieMoteur> {
  await suivreLeProfil(o);
  return envoyerEtRanger(o, numero, await semaineDuMoteur(o, numero, retours, options), options);
}

// LA RÉCUPÉRATION APRÈS LA COURSE (décision coach du 23/10/2026 ; pour l'acheteur aussi depuis le 04/11/2026, PL5
// « A » : il quitte l'équipe à la fin de celle-ci) : pour un coaché ou un acheteur, les semaines entre celle de sa course
// et son lundi de reprise (debutApres : deux jours sans séance dure par heure de course, 3 à 21, jusqu'au lundi
// qui suit), numérotées à la suite du plan ; le moteur les écrit (repos les 2 jours d'après la course, puis une EF
// courte un jour disponible sur deux) et elles partent dans Nolio comme les autres. null hors de cette fenêtre.
export function semaineDeRecuperation(o: Pick<Objectif, 'coache' | 'plan' | 'tempsH' | 'parametres'>, lundi: string): { numero: string; jusqua: string } | null {
  const derniere = [...o.plan.semaines].reverse().find((s) => s.lundi);
  if (!derniere?.lundi || lundi <= derniere.lundi) return null;
  const jusqua = debutApres({ course_date: o.plan.course.date, temps_h: o.tempsH, format: formatDe(o) });
  if (lundi >= jusqua) return null;
  return { numero: `S${o.plan.semaines.length + Math.round(joursEntre(derniere.lundi, lundi) / 7)}`, jusqua };
}

const recuperationDuMoteur = (o: Objectif, numero: string, jusqua: string, retours: Retours | null) =>
  // « coache » (moteur 8.452, M-13) : un acheteur lit qu'il quitte l'équipe à la fin de sa récupération.
  moteur<SortieMoteur>('/v1/recuperation', { parametres: o.parametres, numero, jusqua, etat: o.etat, retours, coache: o.coache });

async function ecrireLaRecuperation(o: Objectif, numero: string, jusqua: string, retours: Retours | null): Promise<SortieMoteur> {
  return envoyerEtRanger(o, numero, await recuperationDuMoteur(o, numero, jusqua, retours));
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
  // D7 : une semaine partie par un repli prévient le coach (la semaine est dans Nolio, à relire).
  if (sortie.repli) await prevenirDuRepli(o, numero, sortie.repli).catch((e) => console.error(`Repli de ${o.planId} :`, e instanceof Error ? e.message : e));
  return sortie;
}

// Un acheteur : plus de « réponds à son e-mail de bienvenue si elle doit changer » (« pour les plans, pas d'interaction
// avec moi », décision coach du 05/11/2026 au soir) ; le coach peut toujours corriger la séance dans Nolio.
async function prevenirDuRepli(o: Objectif, numero: string, repli: NonNullable<SortieMoteur['repli']>) {
  const nom = (await nomsDesPlans([o.planId])).get(o.planId) ?? 'Un athlète';
  await prevenirCoach(`Plan CTS : la semaine ${numero.replace('S', '')} de ${nom} écrite par un repli`,
    `Le contrôle du moteur refusait la semaine ${numero.replace('S', '')} de ${nom} (« ${o.plan.course.nom} »)`
    + `${repli.refus ? ` : ${repli.refus}` : ''}. Elle est partie dans Nolio par un repli (${repli.niveau === 1
      ? 'la même semaine, sortie longue plafonnée' : repli.niveau === 2 ? 'la semaine du plan de l’achat, sortie longue plafonnée'
        : 'la semaine du plan de l’achat'})${repli.effet ? ` : ${repli.effet}` : ''}. Relis-la dans son Nolio.`,
    o.coache ? o.coachId : null);
}

// Le nom de chaque plan, pour un e-mail au coach (E4, D7) : le coaché par sa fiche, l'acheteur par son plan.
export async function nomsDesPlans(ids: string[]): Promise<Map<string, string>> {
  const noms = new Map<string, string>();
  if (!ids.length) return noms;
  const service = clientService();
  const [{ data: coaches }, { data: plans }] = await Promise.all([
    service.from('coaching').select('plan_id, athlete_nom').in('plan_id', ids),
    service.from('plans').select('id, nom:donnees->athlete->>nom').in('id', ids),
  ]);
  for (const p of plans ?? []) if (String(p.nom ?? '').trim()) noms.set(String(p.id), String(p.nom).trim());
  for (const c of coaches ?? []) if (String(c.athlete_nom ?? '').trim()) noms.set(String(c.plan_id), String(c.athlete_nom).trim());
  return noms;
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
  // LA PREMIÈRE SÉANCE D'UN ACHETEUR, LE LENDEMAIN (C9, audit de l'app plan du 03/11/2026) : sa première semaine part
  // du lendemain de son achat, plus du jour même (un Seuil 2 le soir de l'achat) ; acheté un dimanche, c'est la semaine
  // du lendemain qui part (B-PL-34). Un coaché garde le jour même : son coach le lance.
  const jourDeDepart = o.coache ? aujourdhui : ajouterJours(aujourdhui, 1);
  const debut = o.plan.semaines.find((s) => s.lundi && ajouterJours(s.lundi, 6) >= jourDeDepart);
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
  // Les précédents : course avant celle-ci, moins de 60 jours avant aujourd'hui (precedentDuDepart, lib/app/jonction.ts ;
  // l'écran du coach le refait pour dire la continuité, continuiteDe).
  // C5 (décision coach du 04/11/2026, « A » ; moteur 8.445) : une course qui tombe dans la récupération de la précédente
  // part au lundi de sa semaine de course, avec la reprise : le moteur écrit cette semaine en semaine de course, sans rien
  // de dur. Avant, son départ attendait la fin de la récupération, après elle : rien ne s'écrivait pour elle.
  const apres = precedentDuDepart(o.plan.course.date, autres, aujourdhui) ?? undefined;
  // PC1 : les séances que le coach a déjà posées restent ; l'écriture attend le lundi qui suit la dernière.
  const posees = await seancesDejaPosees(o, aujourdhui);
  const premierJour = debut.lundi > jourDeDepart ? debut.lundi : jourDeDepart;
  const derniere = [...o.plan.semaines].reverse().find((s) => s.lundi)?.lundi;
  if (aPartirDu && derniere && aPartirDu > derniere) throw new Error('Choisis un lundi avant la semaine de sa course.');
  // UN OBJECTIF LOINTAIN (décision coach du 22/10/2026) : sa préparation commence plus tard ; rien ne se pose d'avance,
  // le départ se programme au premier lundi de sa préparation (la veille au soir, comme les autres). Après la course d'un
  // autre objectif aussi, quand sa semaine 1 commence plus d'une semaine après la reprise (décision 12 du 07/11/2026,
  // « A », lib/app/jonction.ts) : la saison de fond tourne entre-temps.
  const calcule = departCalcule({ aujourdhui, debut: debut.lundi, premierJour, lundi, posees,
    apres: apres ? { lundi: apres.lundi, nom: apres.q.course_nom } : null });
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
  // C4 : la préparation qui suit un autre objectif prend sa durée à son départ réel.
  if (o.coache && apres && !o.envois.some((e) => /^S\d+$/.test(e.semaine))) {
    await dureeAuDepart(o, prevu ? prevu.prevu : aujourdhui)
      .catch((e) => console.error(`Durée au départ de ${planId} :`, e instanceof Error ? e.message : e));
  }
  // La première semaine : celle d'aujourd'hui, ou, partie la veille, la première à partir du lundi qui vient.
  const debutReel = o.plan.semaines.find((s) => s.lundi && ajouterJours(s.lundi, 6) >= jourDeDepart) ?? debut;
  const premiere = prevu ? o.plan.semaines.find((s) => s.lundi && ajouterJours(s.lundi, 6) >= prevu.prevu) : debutReel;
  if (!premiere?.lundi) throw new Error('La course est passée.');
  const depart = prevu ? prevu.prevu : jourDeDepart;
  // LE GARDE-FOU DES DÉPARTS EN DOUBLE (05/11/2026 au soir, lib/app/departs.ts) : un autre objectif du même athlète déjà
  // démarré (ou parti plus tôt au même passage : departsDuJour les prend un par un) dont les semaines couvrent celle qui
  // partirait. OM4 a déjà reprogrammé, plus haut, un objectif plus lointain après la récupération d'un plus proche : ce
  // refus ne touche que des courses de la même semaine (un doublon). Rien ne s'écrit ; le coach est prévenu une fois.
  const couvre = objectifQuiCouvre(premiere.lundi, autres);
  if (couvre) {
    const message = messageDoublon(o.plan.athlete.nom || 'Un athlète', couvre.course_nom, o.plan.course.nom);
    if (prevenir) await prevenirCoach('Deux objectifs partiraient la même semaine', message, o.coachId).catch(() => null);
    throw new Error(message);
  }
  // La reprise allégée : la première semaine écrite suit de près la récupération (pas une préparation qui commence des
  // semaines plus tard, QD2).
  const premier = premiere.lundi > depart ? premiere.lundi : depart;
  const reprise = Boolean(apres && enReprise(apres.lundi, premier));
  // Un seul départ à la fois : le premier appel prend la main ; en cas d'échec il la rend, pour un nouvel essai.
  const service = clientService();
  const { data: pris } = await service.from('plans').update({ demarre_le: new Date().toISOString() })
    .eq('id', planId).is('demarre_le', null).select('id');
  if (!pris?.length) return { numero: premiere.numero };
  try {
    // La saison de fond (décisions coach du 24/10/2026) : la préparation prend la suite, la saison s'arrête la veille de
    // sa première semaine et ses séances à venir quittent Nolio.
    // LA JONCTION DE DEUX OBJECTIFS (décisions coach du 07/11/2026, « tout A ») : le lundi d'où repart son rythme
    // charge/allégée, sa reprise, ou la dernière allégée de la saison qu'elle coupe (lue avant que la saison s'arrête).
    const sansSemaine = !o.envois.some((e) => /^S\d+$/.test(e.semaine));
    let rythme = sansSemaine ? lundiDuRythme({ premier, reprise }) : null;
    if (o.coache) {
      const { arreterLaSaison, semainesDeLaSaison } = await import('./fond');
      const { data: lien } = await service.from('coaching').select('athlete_id').eq('plan_id', planId).maybeSingle();
      if (lien && sansSemaine && !rythme) {
        rythme = lundiDuRythme({ premier, reprise, saison: await semainesDeLaSaison(String(lien.athlete_id), premiere.lundi).catch(() => []) });
      }
      for (const saison of lien ? await arreterLaSaison(String(lien.athlete_id), premiere.lundi) : []) {
        await retirerDeNolio(saison, { depuis: premier });
      }
    }
    // D9 (audits du 05/11/2026, lot 1) : les recalages du départ se refont tant qu'aucune semaine n'est partie. Avant, un
    // départ qui échouait après avoir posé ses questionnaires ou sa course (des envois notés) ne recalait plus rien au
    // réessai : la première semaine partait des réponses de l'achat (sansSemaine, plus haut).
    // Juste après la course d'un autre objectif : calé sur ce que l'athlète y a vraiment couru (sa sortie longue à 75 %).
    let slRecalee: string | null = null;
    if (reprise && apres && sansSemaine) slRecalee = await recalerSurLePrecedent(o, apres.q.id, premier);
    // Une charge déclarée il y a plus de 4 semaines (un objectif lointain) : relue dans Nolio au départ réel.
    else if (o.coache && sansSemaine && String(o.parametres.declaree_le ?? '') < ajouterJours(premier, -28)) {
      await recalerSurNolio(o, premier).catch((e) => console.error(`Recalage de ${planId} :`, e instanceof Error ? e.message : e));
    }
    // Un acheteur qui a corrigé sa charge sur la carte de son app (décision coach du 04/11/2026 au soir). Le moteur muet
    // fait échouer le départ (il se reprend, le recalage avec) ; un refus garde les réponses de l'achat.
    else if (!o.coache && sansSemaine) await recalerSurLaConfirmation(o, premier);
    if (o.coache && sansSemaine) {
      await ancrerAuDepart(o, premier).catch((e) => console.error(`Ancrage de ${planId} :`, e instanceof Error ? e.message : e));
    }
    // Le rythme qui repart de la reprise (coaché et acheteur d'un second plan, décision 11), ou de la saison coupée.
    if (rythme) await poserLeRythme(o, rythme).catch((e) => console.error(`Rythme de ${planId} :`, e instanceof Error ? e.message : e));
    // LE DÉPART INDIVIDUALISÉ (décisions coach du 26/10/2026) : au rang du plan, fondations sautées, semaine allégée
    // passée en charge, plus longue sortie sur 8 semaines ; ce qui a été lu, pour la carte « Son départ ».
    if (o.coache && sansSemaine) {
      await deciderLeDepart(o, premiere, { apresCourse: reprise, slRecalee }).catch((e) => console.error(`Départ de ${planId} :`, e instanceof Error ? e.message : e));
    }
    await dimancheDeLAcheteur(o);
    // OM3 : l'objectif et ses courses de préparation, en compétitions dans Nolio.
    const { course } = o.plan;
    await poserCourse(o, { nom: course.nom, date: course.date, distance_km: course.distance_km, dplus_m: course.dplus_m }, true);
    for (const c of ((o.parametres.courses_secondaires ?? []) as Course[])) if (c.date >= aujourdhui) await poserCourse(o, c, false);
    // PO4 : la fiche d'une course de préparation qui tombe dans sa première semaine ; les suivantes partent avec la leur.
    await fichesDesPreparations(o, ajouterJours(premiere.lundi, 6));
    // E5 (audits du 05/11/2026, lot 1) : la semaine se juge d'après les semaines écrites, comme le dimanche ; une semaine 1
    // envoyée à moitié (Nolio coupé en route) se complète au réessai, sans rien doubler (la mise à jour crée ce qui manque).
    const { data: ecrite } = await service.from('semaines_ecrites').select('numero').eq('plan_id', planId).eq('numero', premiere.numero).maybeSingle();
    // LA PREMIÈRE SEMAINE D'UN DÉPART LIT LA RÉPONSE DU SAMEDI (vu par le coach le 08/11/2026 : un coaché qui enchaîne un
    // second objectif avait répondu lundi, mercredi, vendredi, samedi, sortie longue le vendredi ; sa semaine de reprise
    // est partie sur les jours de son profil). Comme la première semaine d'une saison de fond (retoursDeLaPremiere) : la
    // réponse seule, sans séances ni Hooper ; le moteur n'y lit ni arrêt ni séance manquée (vérifié sur 8.459, en
    // reprise comme sans). Sans réponse (un premier achat), rien, comme avant ; une lecture qui échoue n'empêche rien.
    const retoursDepart = await retoursDeLaPremiere(o, aujourdhui).catch(() => null);
    if (!ecrite) await ecrireEtEnvoyer(o, premiere.numero, retoursDepart, { depuis: depart > premiere.lundi ? depart : undefined, reprise });
    if (!o.coache) await rangerAcheteur(o);
  } catch (e) {
    await service.from('plans').update({ demarre_le: null }).eq('id', planId);
    if (prevenir && !o.coache) {
      await prevenirCoach('Plan CTS : une préparation n’a pas démarré dans Nolio',
        `La préparation de l’acheteur du plan « ${o.plan.course.nom} » n’a pas démarré dans Nolio : `
        + `${e instanceof Error ? e.message : String(e)} Le site réessaie chaque soir ; sa première semaine part (ou se `
        + 'complète) au premier essai réussi, à partir de ce jour-là.');
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

// LA CHARGE CONFIRMÉE PAR L'ACHETEUR (décision coach du 04/11/2026 au soir, « A » ; lib/app/confirmation.ts) : un achat
// fait plus de 3 semaines avant son invitation, et l'acheteur a corrigé sur la carte de son app son volume, sa plus
// longue sortie ou un arrêt récent. Sa première semaine part de ces réponses, comme le recalage d'un coaché : les champs
// changés, déclarés au lundi du départ, relus par le moteur, la trame remise à zéro. « Oui », sans réponse, ou refusé par
// le moteur : ses réponses de l'achat restent.
async function recalerSurLaConfirmation(o: Objectif, lundi: string) {
  const { reponse } = await lireConfirmation(o.planId);
  if (reponse?.reponse !== 'corrige') return;
  const avant = (o.parametres.champs ?? {}) as Record<string, unknown>;
  if (!chargeChangee(chargeDe(avant), reponse.charge)) return;
  const parametres = { ...o.parametres, champs: { ...avant, ...reponse.charge }, declaree_le: lundi };
  try {
    await moteur('/v1/trame', { parametres });
  } catch (e) {
    // D9 : un refus (400) garde les réponses de l'achat ; le moteur muet fait échouer le départ, qui se reprend.
    if (e instanceof Error && /: 400\b/.test(e.message)) return;
    throw e;
  }
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// LE DÉPART INDIVIDUALISÉ (décisions coach du 26/10/2026, CTS_DEPART_INDIVIDUALISE.md) : au départ d'un coaché, une
// lecture de Nolio (chargeDepuisNolio, avec son accord) décide, dans les paramètres que le moteur lit :
// - « au_rang_du_plan » : ses échelles au rang du plan (un coaché a fait ses semaines avec son coach) ;
// - « fondations_sautees » : il part en fondations après au moins une séance dure par semaine (RPE 7 ou plus) sur 4 ;
// - « allegee_en_charge » : sa première semaine, allégée dans le plan, juste après une semaine déjà basse ;
// - la plus longue sortie de référence : celle des 8 semaines sans coupure, si elle dépasse la déclarée ; juste après
//   une course (apresCourse), 75 % de celle-ci (décision 6 du 07/11/2026, lib/app/jonction.ts).
// Avec le rythme repris d'une reprise ou d'une saison (« rythme_depuis », décisions du 07/11/2026), plus d'allégée passée
// en charge : la reprise est déjà l'allégée du cycle, la semaine qui la suit une semaine de charge.
// Ce qui a été lu et décidé reste (« depart_lu ») pour la carte « Son départ » de l'espace coach.
const SEANCES_DURES_MIN = 4;
async function deciderLeDepart(o: Objectif, premiere: Semaine, jonction: { apresCourse?: boolean; slRecalee?: string | null } = {}) {
  const lu = await chargeDepuisNolio(o.coachId, o.nolioAthlete).catch(() => null);
  const champs = { ...((o.parametres.champs ?? {}) as Record<string, unknown>) };
  const apresCourse = Boolean(jonction.apresCourse);
  const rythme = typeof o.parametres.rythme_depuis === 'string' ? o.parametres.rythme_depuis : null;
  const fondationsSautees = Boolean(lu?.lu && premiere.bloc === 'Bloc fondations' && (lu.seancesDures ?? 0) >= SEANCES_DURES_MIN);
  const allegeeEnCharge = Boolean(!rythme && lu?.lu && premiere.type === 'Assimilation' && lu.derniereAllegee);
  const declaree = lireTemps(String(champs.sortie_longue_actuelle ?? ''));
  // LA SORTIE LONGUE DE RÉFÉRENCE EST SA SORTIE LONGUE HABITUELLE (moteur 8.460, étape D3 ; décision 8 du coach du
  // 09/11/2026 : son niveau habituel, ses semaines normales des 3 derniers mois, lues dans Nolio) : plus la plus longue
  // sortie des 8 dernières semaines, qu'une seule sortie longue isolée relevait. Juste après une course, la jonction garde
  // sa règle (75 % de la plus longue d'avant l'affûtage, décision 6 du 07/11/2026). Sans assez de semaines normales lues,
  // rien n'est relevé (sa déclaration reste).
  const habituel = !apresCourse && o.nolioAthlete && premiere.lundi
    ? niveauHabituel(await semainesDansNolio(o.nolioAthlete, premiere.lundi).catch(() => [])) : null;
  const longueMin = apresCourse ? (lu?.longueMin ? slApresCourse(lu.longueMin) : 0) : (habituel?.sl_min ?? 0);
  const slRelevee = Boolean(longueMin && (apresCourse ? lu?.champs.sortie_longue_actuelle : true)
    && (!declaree || longueMin / 60 > declaree + 1e-9));
  const releveeA = slRelevee ? dureeTexte(longueMin) : null;
  if (releveeA) champs.sortie_longue_actuelle = releveeA;
  // Sa sortie longue de départ à 75 % (décision 6) : relevée ici, ou posée par le recalage sur l'objectif précédent.
  const slApres = apresCourse ? (releveeA ?? jonction.slRecalee ?? null) : null;
  // Le rythme posé : plus d'allégée passée en charge, même laissée par un essai de départ précédent.
  const avant = Object.fromEntries(Object.entries(o.parametres).filter(([cle]) => !(rythme && cle === 'allegee_en_charge')));
  const parametres = {
    ...avant, champs, au_rang_du_plan: true,
    ...(fondationsSautees ? { fondations_sautees: true } : {}),
    ...(allegeeEnCharge && premiere.lundi ? { allegee_en_charge: premiere.lundi } : {}),
    depart_lu: {
      le: aujourdhuiParis(), lu: Boolean(lu?.lu), detail: lu?.detail ?? null, seances_dures: lu?.seancesDures ?? null,
      derniere_allegee: lu?.derniereAllegee ?? null, sl_semaines: lu?.slSemaines ?? null,
      sl_relevee: slApres ? null : releveeA, ...(slApres ? { sl_apres_course: slApres } : {}),
      fondations_sautees: fondationsSautees, allegee_en_charge: allegeeEnCharge,
      ...(rythme ? { rythme_depuis: rythme, rythme_apres: apresCourse ? 'reprise' : 'saison' } : {}),
    },
  };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return;
  }
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
}

// Les coachés déjà partis avant le départ individualisé (le dimanche, avant d'écrire leur semaine) : la marque « au rang
// du plan », et, s'ils sont encore en fondations, la décision des fondations sautées, prise une fois (gardée vraie ou
// fausse).
// Ses paramètres complétés, sans rien écrire (l'aperçu du dimanche les prend tels quels) ; null : rien ne change.
async function departComplete(o: Objectif, semaine: Semaine): Promise<Record<string, unknown> | null> {
  const p = o.parametres as Record<string, unknown>;
  const champs = (p.champs ?? {}) as Record<string, unknown>;
  const marquer = !p.au_rang_du_plan && champs.coaching !== 'oui';
  // Seulement juste après le départ (une semaine écrite au plus) : plus tard, ses séances dures sont celles du plan.
  const decider = p.fondations_sautees === undefined && semaine.bloc === 'Bloc fondations'
    && o.envois.filter((e) => /^S\d+$/.test(e.semaine)).length <= 1;
  if (!marquer && !decider) return null;
  const lu = decider ? await chargeDepuisNolio(o.coachId, o.nolioAthlete).catch(() => null) : null;
  const parametres = { ...p, au_rang_du_plan: true,
    ...(decider ? { fondations_sautees: Boolean(lu?.lu && (lu.seancesDures ?? 0) >= SEANCES_DURES_MIN) } : {}) };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return null;
  }
  return parametres;
}

async function completerLeDepart(o: Objectif, semaine: Semaine) {
  const parametres = await departComplete(o, semaine);
  if (!parametres) return;
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

// LE RYTHME QUI REPART DE LA REPRISE (décisions coach du 07/11/2026, « tout A » ; moteur 8.457, lib/app/jonction.ts) :
// « rythme_depuis » dans ses paramètres, posé une fois, au départ ; validé par le moteur comme les autres recalages (la
// trame) ; refusé, les paramètres d'avant restent. « Mon plan » le montre de lui-même : sa trame est construite avec.
async function poserLeRythme(o: Objectif, lundi: string) {
  if (o.parametres.rythme_depuis === lundi) return;
  const parametres = { ...o.parametres, rythme_depuis: lundi };
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

// Rend la sortie longue de départ posée (« 1h53 »), ou null.
async function recalerSurLePrecedent(o: Objectif, precedentId: string, lundi: string): Promise<string | null> {
  const service = clientService();
  const { data } = await service.from('plans').select('etat_ecriture, donnees').eq('id', precedentId).maybeSingle();
  const etat = (data?.etat_ecriture ?? null) as { volumes_reels?: Record<string, number>; sl_reelles?: Record<string, number> } | null;
  const { volumes, sl } = avantAffutage(((data?.donnees ?? null) as Plan | null)?.semaines ?? [], etat);
  if (!volumes.some((v) => v > 0)) return null;
  // La première sortie longue après la course (décision 6 du 07/11/2026, « A ») : 75 % de sa plus longue d'avant
  // l'affûtage, puis la règle de saut du moteur.
  const slDepart = sl.length ? dureeTexte(slApresCourse(Math.max(...sl))) : null;
  const champs = {
    ...((o.parametres.champs ?? {}) as Record<string, unknown>),
    // Le volume du moment (décision coach du 24/10/2026) : sa dernière semaine, bornée par la moyenne et la moyenne +30 %.
    volume_hebdo_actuel: dureeTexte(volumeDuMoment(volumes).retenu),
    ...(slDepart ? { sortie_longue_actuelle: slDepart } : {}),
  };
  const parametres = { ...o.parametres, champs, declaree_le: lundi };
  try {
    await moteur('/v1/trame', { parametres });
  } catch {
    return null;
  }
  await service.from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
  return slDepart;
}

// C4 (audit du 03/11/2026, décision coach du 04/11/2026, « A ») : la préparation d'un objectif qui suit un autre prend sa
// durée à son départ réel, le lundi après la récupération, et non au jour de sa saisie : la plus courte formule qui
// couvre le temps restant, la même lecture qu'à la saisie (lib/plan.ts, dureeConseillee). Saisie tôt, la formule la plus
// longue, rejointe tard, servait jusqu'à 10 semaines de spécifique d'affilée juste après une course, sans développement.
// Le plan se refait par le moteur (POST /v1/donnees) avant sa première semaine ; une durée inchangée ne touche à rien.
async function dureeAuDepart(o: Objectif, depart: string) {
  const champs = (o.parametres.champs ?? {}) as Record<string, unknown>;
  const config = await fetch(`${API_URL}/v1/config`, { cache: 'no-store', headers: enTetesMoteur() }).then((r) => (r.ok ? r.json() : null)) as ConfigPlan | null;
  if (!config?.semaines_par_formule) return;
  const c = champs as unknown as Champs;
  const veille = new Date(`${ajouterJours(depart, -1)}T12:00:00Z`);
  const duree = dureeConseillee(c, config, dureesPossibles(c, config), veille);
  if (!duree || String(duree) === String(champs.duree_mois ?? '')) return;
  const parametres = { ...o.parametres, champs: { ...champs, duree_mois: String(duree) } };
  const donnees = await moteur<Plan>('/v1/donnees', { parametres, donnees_avant: o.plan });
  if (donnees.schema !== SCHEMA_PLAN) return;
  const { error } = await clientService().from('plans')
    .update({ parametres, donnees, version_moteur: donnees.version_moteur, schema: donnees.schema, trame: null }).eq('id', o.planId);
  if (error) throw new Error(error.message);
  o.parametres = parametres;
  o.plan = donnees;
}

// Les autres objectifs écrits semaine par semaine du même athlète (sa fiche de coaché, ou son compte d'acheteur).
// fond : une saison de fond (le garde-fou des départs en double ne la compte pas : elle s'arrête quand une préparation part).
// depart_prevu : son départ programmé (gardé après le départ).
type Voisin = { id: string; course_nom: string; course_date: string; temps_h: number; demarre: boolean; debut: string | null;
  format: string; fond: boolean; depart_prevu: string | null };
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
  const { data } = await service.from('plans')
    .select('id, course_nom, course_date, intake, demarre_le, depart_prevu, debut:donnees->semaines->0->>lundi, fond:parametres->fond')
    .in('id', ids).not('parametres', 'is', null);
  return (data ?? []).map((p) => ({
    id: p.id as string, course_nom: p.course_nom as string, course_date: p.course_date as string,
    temps_h: heures((p.intake as Record<string, unknown> | null)?.temps_cible), demarre: Boolean(p.demarre_le),
    debut: (p.debut ?? null) as string | null, format: String((p.intake as Record<string, unknown> | null)?.format ?? ''),
    fond: Boolean((p as { fond?: unknown }).fond), depart_prevu: (p.depart_prevu ?? null) as string | null,
  }));
}

// LA CONTINUITÉ ENTRE DEUX OBJECTIFS, À L'ÉCRAN DU COACH (décisions coach du 08/11/2026, « Je valide » ; cas réel : un
// semi couru le 1/11, un trail qui démarre le 9/11 dans sa continuité). La programmation enchaînait déjà (la jonction,
// 8.457) ; l'écran le dit : sur la page et l'aperçu de l'objectif couru, sa suite ; sur ceux de l'objectif qui part
// après lui, avant son départ, la reprise. precedent : l'objectif après la récupération duquel celui-ci part (partApres) ;
// suivant : celui qui part après la récupération de celui-ci, et son lundi de départ (partEnSuite) ; objectifApres : un
// autre objectif (pas une saison de fond) dont la course vient après la sienne ; reprise : son lundi de reprise. Le lundi
// de départ d'un objectif : son départ programmé, sinon, parti sans être programmé, sa première semaine écrite.
export type Continuite = {
  precedent: { id: string; course_nom: string } | null; suivant: { id: string; course_nom: string; depart: string } | null;
  objectifApres: boolean; reprise: string;
};
export async function continuiteDe(planId: string): Promise<Continuite | null> {
  const o = await objectifEcrit(planId);
  return o ? continuiteDeLObjectif(o) : null;
}
async function continuiteDeLObjectif(o: Objectif): Promise<Continuite> {
  const service = clientService();
  const autres = await autresObjectifs(o);
  const { data: p } = await service.from('plans').select('demarre_le, depart_prevu, intake').eq('id', o.planId).maybeSingle();
  const partis = [o.planId, ...autres.filter((q) => q.demarre && !q.depart_prevu).map((q) => q.id)];
  const { data: ecrites } = await service.from('semaines_ecrites').select('plan_id, lundi:donnees->>lundi').in('plan_id', partis);
  const premiere = (id: string) => ((ecrites ?? []) as { plan_id: string; lundi: string | null }[])
    .filter((e) => e.plan_id === id && e.lundi).map((e) => e.lundi as string).sort()[0] ?? null;
  const fond = Boolean((o.parametres as { fond?: unknown }).fond);
  // Ses heures et son format comme autresObjectifs les lit (le départ d'un autre le prend ainsi pour précédent).
  const moi: ObjectifVoisin = { id: o.planId, course_nom: o.plan.course.nom, course_date: o.plan.course.date, temps_h: o.tempsH,
    format: String((p?.intake as Record<string, unknown> | null)?.format ?? ''), fond, depart: (p?.depart_prevu as string | null) ?? (p?.demarre_le ? premiere(o.planId) : null) };
  const tous: ObjectifVoisin[] = [moi, ...autres.map((q) => ({ id: q.id, course_nom: q.course_nom, course_date: q.course_date,
    temps_h: q.temps_h, format: q.format, fond: q.fond, depart: q.depart_prevu ?? (q.demarre ? premiere(q.id) : null) }))];
  const precedent = partApres(moi, tous);
  const suivant = partEnSuite(moi, tous);
  return {
    precedent: precedent ? { id: precedent.id, course_nom: precedent.course_nom } : null,
    suivant: suivant?.depart ? { id: suivant.id, course_nom: suivant.course_nom, depart: suivant.depart } : null,
    objectifApres: !fond && autres.some((q) => !q.fond && q.course_date > o.plan.course.date),
    reprise: debutApres({ course_date: o.plan.course.date, temps_h: o.tempsH, format: formatDe(o) }),
  };
}

// « 5h30 », « 5:30 », « 18h » : des heures ; 0 illisible (heuresDuTemps, lib/app/jonction.ts, importé plus haut).

// Le format d'un objectif (« R42 » pour un marathon sur route), tel que ses paramètres le gardent.
function formatDe(o: Pick<Objectif, 'parametres'>): string {
  return String(((o.parametres.champs ?? {}) as Record<string, unknown>).format ?? '');
}

// LA RÉCUPÉRATION APRÈS L'OBJECTIF, jusqu'au lundi qui suit : debutApres (lib/app/jonction.ts, exporté plus haut).

// C5 : la course d'un autre objectif du même athlète qui tombe dans la semaine de ce lundi ou avant, pendant la
// récupération de celui-ci ; son nom, ou null.
async function courseDansLaRecuperation(o: Objectif, lundi: string): Promise<string | null> {
  const autres = await autresObjectifs(o);
  const suivante = autres.filter((q) => q.course_date > o.plan.course.date && lundiDe(q.course_date) <= lundi)
    .sort((a, b) => a.course_date.localeCompare(b.course_date))[0];
  return suivante?.course_nom ?? null;
}

const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));

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
// ceux des athlètes passés en mode plan (décision coach du 23/10/2026) : rien ne s'y écrit non plus. Et ceux des anciens
// athlètes, sortis de l'équipe Nolio (lot 2 de l'app, décision A du coach du 12/11/2026 ; lib/app/anciens.ts) : ni le
// dimanche, ni les reprises, ni les départs, ni le passage du soir. Les colonnes lues après coup : sans la migration, rien
// n'est retenu.
export async function plansALaMain(): Promise<Set<string>> {
  const service = clientService();
  const { data: toutes, error } = await service.from('athletes_coaches').select('*');
  const fiches = (toutes ?? []).filter(sansEcriture);
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

// Les objectifs de coachés dont la course est passée depuis moins de 6 semaines, démarrés, en programmation automatique,
// et ceux des acheteurs encore dans l'équipe (PL5, décision coach du 04/11/2026) : leurs semaines de récupération
// s'écrivent le dimanche (semaineDeRecuperation, décision coach du 23/10/2026).
async function plansEnRecuperation(): Promise<string[]> {
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  const { data: tous } = await service.from('plans').select('id, parametres, nolio_statut').not('parametres', 'is', null).not('demarre_le', 'is', null)
    .lt('course_date', aujourdhui).gte('course_date', ajouterJours(aujourdhui, -42));
  // Une saison de fond n'a pas de course : rien à récupérer (décisions coach du 24/10/2026).
  const data = (tous ?? []).filter((p) => !(p.parametres as { fond?: unknown } | null)?.fond);
  if (!data.length) return [];
  const { data: coaches } = await service.from('coaching').select('plan_id');
  const coachesIds = new Set((coaches ?? []).map((c) => c.plan_id as string));
  const aLaMain = await plansALaMain();
  return data.filter((p) => (coachesIds.has(p.id as string) || p.nolio_statut === 'actif') && !aLaMain.has(p.id as string))
    .map((p) => p.id as string);
}

export type Compte = { plan: string; quoi: string; erreur?: string; coache?: boolean; journal?: Record<string, unknown>[] };

// B-EC-5 (audit du 03/11/2026, décision coach du 04/11/2026) : une semaine laissée au coach, ses séances posées avant
// le passage, se note (une ligne « laissee:<lundi> » de nolio_envois, sans séance) : « À regarder » ne la dit plus « pas
// partie », et « Réessayer » n'écrit jamais par-dessus.
export const cleLaissee = (lundi: string) => `laissee:${lundi}`;
async function noterLaissee(o: Objectif, lundi: string) {
  const { error } = await clientService().from('nolio_envois')
    .upsert({ plan_id: o.planId, semaine: cleLaissee(lundi), coach_id: o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true });
  if (error) console.error(`Semaine laissée de ${o.planId} :`, error.message);
}

// B-EC-2 (audit du 03/11/2026, décision coach du 04/11/2026) : une semaine réservée (sa ligne de nolio_envois) dont
// l'écriture a été coupée en route (les 300 s, un plantage, une mise en ligne) n'a pas de semaine écrite. Chaque séance
// créée se note au fil de l'envoi (lib/app/coaching.ts) : au-delà de 10 minutes sans rien de nouveau, la réservation est
// tenue pour libre, et le passage suivant ou « Réessayer » la reprend ; la mise à jour crée ce qui manque, sans rien
// doubler. Seulement une réservation de moins de 8 jours : un envoi plus ancien (un plan passé au format semaine par
// semaine, ses semaines déjà dans Nolio) reste tel quel.
const ORPHELINE_MS = 10 * 60_000;
type Reservation = 'libre' | 'finie' | 'en_cours' | 'orpheline';
async function etatDeLaReservation(o: Objectif, numero: string): Promise<Reservation> {
  const envoi = o.envois.find((e) => e.semaine === numero);
  if (!envoi) return 'libre';
  const { data: ecrite } = await clientService().from('semaines_ecrites').select('numero').eq('plan_id', o.planId).eq('numero', numero).maybeSingle();
  if (ecrite) return 'finie';
  const age = Date.now() - new Date(envoi.envoye_le).getTime();
  return age < ORPHELINE_MS ? 'en_cours' : age < 8 * 86400_000 ? 'orpheline' : 'finie';
}

// Reprendre une réservation orpheline : un seul preneur, la date de la ligne servant de verrou.
async function reprendreLaReservation(planId: string, numero: string): Promise<boolean> {
  const { data } = await clientService().from('nolio_envois').update({ envoye_le: new Date().toISOString() })
    .eq('plan_id', planId).eq('semaine', numero).lt('envoye_le', new Date(Date.now() - ORPHELINE_MS).toISOString()).select('plan_id');
  return Boolean(data?.length);
}

// Chaque dimanche soir : la semaine suivante de chaque plan actif, écrite d'après la semaine écoulée. Un budget de temps
// (la fonction est coupée à 300 s) : au-delà, les plans restants sont remis aux reprises du soir (vercel.json), qui ne
// font que ce qui manque. Un verrou par semaine : le passage la réserve (une ligne vide de nolio_envois, unique par plan
// et par semaine) avant de l'écrire, si bien que deux passages lancés ensemble ne la doublent jamais dans Nolio ; un
// échec avant toute création la libère pour la reprise (décision coach du 20/10/2026 : sécuriser le dimanche).
// L'aperçu du dimanche (apercuDuDimanche) suit le même chemin, sans rien envoyer : ils changent ensemble.
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
      if (!numero) continue;
      // C5 : la course suivante tombe dans cette récupération ; sa semaine de course la remplace (son départ, ce soir).
      const suivante = recuperation ? await courseDansLaRecuperation(o, lundi) : null;
      if (suivante) {
        comptes.push({ plan: planId, quoi: `${numero} : récupération arrêtée, ${suivante} prend la semaine`, coache: true });
        continue;
      }
      const reservation = await etatDeLaReservation(o, numero);
      if (reservation === 'finie' || reservation === 'en_cours') continue;
      // PC1 pour la récupération : une séance de course que le coach a posée cette semaine-là, et elle reste la sienne.
      if (recuperation && await seancesDejaPosees(o, lundi, ajouterJours(lundi, 6))) {
        await noterLaissee(o, lundi);
        comptes.push({ plan: planId, quoi: `${numero} : récupération laissée, séances du coach gardées`, coache: true });
        continue;
      }
      // LA SAISON DE FOND (décisions coach du 24/10/2026) : une préparation qui a pris cette semaine arrête la saison ;
      // des séances que le coach a déjà posées cette semaine restent, rien ne s'y écrit (comme la récupération) ; sa
      // première semaine s'écrit sans les retours, comme un départ (sans semaine écrite avant, le moteur lirait un arrêt),
      // mais avec la réponse du questionnaire du samedi (08/11/2026).
      const fond = Boolean((o.parametres as { fond?: unknown }).fond);
      if (fond) {
        const { arreterLaSaison, semainePriseParUnObjectif } = await import('./fond');
        const athlete = await semainePriseParUnObjectif(planId, lundi);
        if (athlete) {
          await arreterLaSaison(athlete, lundi);
          comptes.push({ plan: planId, quoi: `${numero} : saison de fond arrêtée, une préparation prend la suite`, coache: true });
          continue;
        }
      }
      // PC1 POUR TOUTES LES SEMAINES (décision coach du 19/10/2026, « rien n'est écrasé » ; audit du 30/10/2026) : des
      // séances de course que le coach a déjà posées dans la semaine qui vient restent les siennes, rien ne s'y écrit,
      // comme au départ, en récupération et en saison de fond. Avant, une semaine de préparation s'écrivait par-dessus et
      // ses séances se doublaient dans Nolio.
      if (s && await seancesDejaPosees(o, lundi, ajouterJours(lundi, 6))) {
        await noterLaissee(o, lundi);
        comptes.push({ plan: planId, quoi: `${numero} : ${fond ? 'saison de fond' : 'semaine'} laissée, séances du coach gardées`,
          coache: true });
        continue;
      }
      if (o.coache && !fond && s && reservation === 'libre') {
        await completerLeDepart(o, s).catch((e) => console.error(`Départ complété de ${planId} :`, e instanceof Error ? e.message : e));
      }
      if (reservation === 'orpheline') {
        if (!await reprendreLaReservation(planId, numero)) continue;
      } else {
        const { data: prise } = await service.from('nolio_envois')
          .upsert({ plan_id: planId, semaine: numero, coach_id: o.coachId, seances: [] }, { onConflict: 'plan_id,semaine', ignoreDuplicates: true })
          .select('plan_id');
        if (!prise?.length) continue;
      }
      reservee = numero;
      const premiereDuFond = fond && !o.envois.some((e) => /^S\d+$/.test(e.semaine));
      // Sa première semaine : la réponse du questionnaire du samedi seule (retoursDeLaPremiere, 08/11/2026).
      const retours = premiereDuFond ? await retoursDeLaPremiere(o, aujourdhui) : await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
      const sortie = recuperation
        ? await ecrireLaRecuperation(o, numero, recuperation.jusqua, retours)
        : await ecrireEtEnvoyer(o, numero, retours, { reprise: premiereDuFond && await saisonApresUneCourse(o, lundi) });
      // EC3 : les corrections de cette semaine, envoyées, se comptent (« Chiffres »).
      if (s && CORRECTIONS_ACTIVES) await marquerAppliquees(planId, lundi, sortie.journal ?? []).catch(() => null);
      // Q4 (08/11/2026) : son pourquoi et ce qu'il a lu, gardés à part pour la revue du dimanche soir (jamais une raison
      // d'échec : la semaine est déjà partie).
      await garderLaRevue(planId, numero, revueDe(sortie, retours, recuperation ? 'Semaine de récupération' : 'Semaine', premiereDuFond));
      comptes.push({ plan: planId, quoi: `${numero} écrite${recuperation ? ' (récupération)' : ''}${reservation === 'orpheline' ? ', reprise d’une écriture coupée' : ''}`,
        coache: o.coache, journal: sortie.journal });
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

// L'APERÇU DU DIMANCHE (proposé au coach le 30/10/2026, avant le premier dimanche de la continuité) : ce que le passage
// du dimanche ferait maintenant d'un objectif, par le même chemin que passageDuDimanche (à garder ensemble) : la semaine
// laissée et pourquoi, ou celle que le moteur écrirait, avec ce qu'il a lu. Rien n'est envoyé ni gardé, ni dans Nolio
// ni dans la base : le profil du coureur et le départ complété se calculent sans s'écrire. Ce qui sera couru ou rempli
// d'ici dimanche soir peut encore la changer.
// suite (la continuité entre deux objectifs, décisions coach du 08/11/2026) : l'objectif couru, sa récupération finie,
// l'objectif qui part en suite (son lien sur l'aperçu), null sans objectif suivant ; absente sinon.
// premiere : la première semaine d'une saison de fond, lue avec son questionnaire seul (retoursDeLaPremiere).
// Ce que l'aperçu montre en plus de la semaine (son pourquoi, ce qu'il a lu) se garde au passage (revueDe, Q4 du
// 08/11/2026) : la page de l'athlète le montre le dimanche soir ; les deux changent ensemble.
export type Apercu = { lundi: string; numero: string | null; quoi: string; sortie?: SortieMoteur; retours?: Retours | null;
  suite?: Continuite['suivant']; premiere?: boolean };
export async function apercuDuDimanche(planId: string): Promise<Apercu> {
  const aujourdhui = aujourdhuiParis();
  // Le lundi qui vient (le dimanche, celui du lendemain).
  const lundi = ajouterJours(aujourdhui, 7 - ((new Date(`${aujourdhui}T12:00:00Z`).getUTCDay() + 6) % 7));
  const rien = (quoi: string, numero: string | null = null): Apercu => ({ lundi, numero, quoi });
  const o = await objectifEcrit(planId);
  if (!o) return rien('Ancien format, envoyé en entier : rien ne s’écrit le dimanche.');
  if (!o.nolioAthlete) return rien('Pas de compte Nolio relié : rien ne s’écrit.');
  if ((await plansALaMain()).has(planId)) return rien('Programmé à la main : le moteur n’écrit rien.');
  const { data: p } = await clientService().from('plans').select('demarre_le, depart_prevu, nolio_statut').eq('id', planId).single();
  if (!p?.demarre_le) {
    if (!p?.depart_prevu || String(p.depart_prevu) > lundi) return rien('Pas encore démarré dans Nolio.');
    // Après la récupération d'un objectif précédent (décision coach du 08/11/2026) : sa première semaine, une reprise.
    const { precedent } = await continuiteDeLObjectif(o);
    return rien(precedent ? texteDepartLundiApres(precedent.course_nom) : 'Départ lundi : sa première semaine part avec son départ, dimanche soir.');
  }
  if (!o.coache && p.nolio_statut !== 'actif') return rien('Pas actif dans Nolio : rien ne s’écrit.');
  const s = semaineDu(o.plan, lundi);
  const recuperation = s ? null : semaineDeRecuperation(o, lundi);
  const numero = s?.numero ?? recuperation?.numero ?? null;
  if (!numero) {
    // L'objectif couru, sa récupération finie (décision coach du 08/11/2026) : sa suite, ou plus rien ; un autre objectif
    // plus loin, qui ne part pas dans sa continuité (une préparation lointaine, pas encore programmée) : comme avant.
    if (!(o.parametres as { fond?: unknown }).fond && o.plan.course.date < lundi) {
      const c = await continuiteDeLObjectif(o);
      if (c.suivant || !c.objectifApres) return { ...rien(enUneLigne(texteDeLaSuite(c.suivant))), suite: c.suivant };
    }
    return rien('Pas de semaine à écrire lundi.');
  }
  const suivante = recuperation ? await courseDansLaRecuperation(o, lundi) : null;
  if (suivante) return rien(`Récupération arrêtée : ${suivante} tombe cette semaine, sa semaine de course prend la place.`, numero);
  const reservation = await etatDeLaReservation(o, numero);
  if (reservation === 'orpheline') return rien('Coupée en cours d’écriture : elle se complète au prochain passage, ou par « Réessayer ».', numero);
  if (reservation !== 'libre') return rien('Déjà partie dans Nolio.', numero);
  const posees = await seancesDejaPosees(o, lundi, ajouterJours(lundi, 6));
  if (recuperation && posees) return rien('Récupération laissée : tu as déjà posé des séances cette semaine-là, elles restent les tiennes.', numero);
  const fond = Boolean((o.parametres as { fond?: unknown }).fond);
  if (fond) {
    const { semainePriseParUnObjectif } = await import('./fond');
    if (await semainePriseParUnObjectif(planId, lundi)) return rien('La saison de fond s’arrête : une préparation prend la suite.', numero);
  }
  if (s && posees) return rien('Semaine laissée : tu as déjà posé des séances cette semaine-là, elles restent les tiennes.', numero);
  if (o.coache && !fond && s) o.parametres = (await departComplete(o, s).catch(() => null)) ?? o.parametres;
  const premiereDuFond = fond && !o.envois.some((e) => /^S\d+$/.test(e.semaine));
  const retours = premiereDuFond ? await retoursDeLaPremiere(o, aujourdhui) : await lireRetours(o, ajouterJours(lundi, -35), aujourdhui);
  if (recuperation) {
    return { lundi, numero, quoi: 'Semaine de récupération', sortie: await recuperationDuMoteur(o, numero, recuperation.jusqua, retours), retours };
  }
  o.parametres = avecLeProfil(o);
  const reprise = premiereDuFond && await saisonApresUneCourse(o, lundi);
  return { lundi, numero, quoi: 'Semaine', sortie: await semaineDuMoteur(o, numero, retours, { reprise }), retours,
    ...(premiereDuFond ? { premiere: true } : {}) };
}

// LA SAISON DE FOND QUI SUIT UNE RÉCUPÉRATION (décision 8 du 07/11/2026, « A » ; lib/app/jonction.ts) : sa première
// semaine s'écrit en reprise (allégée, une seule qualité), comme la première semaine d'une préparation qui suit une course.
// Avant, une semaine de charge, juste après la récupération.
async function saisonApresUneCourse(o: Objectif, lundi: string): Promise<boolean> {
  const precedents = (await autresObjectifs(o)).filter((q) => !q.fond && q.demarre);
  return saisonEnReprise(lundi, precedents);
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
  const lecture: { lu?: LuDansNolio } = {};
  const retours = await lireRetours(o, ajouterJours(aujourdhui, -10), aujourdhui, (lu) => { lecture.lu = lu; });
  // EC2 : les signaux de la semaine d'un coaché, gardés avec ce qui vient d'être lu, pour l'accueil du coach.
  if (o.coache && lecture.lu) await garderLesSignauxDuSoir(o, lecture.lu, aujourdhui)
    .catch((e) => console.error(`Signaux de ${planId} :`, e instanceof Error ? e.message : e));
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

async function garderLesSignauxDuSoir(o: Objectif, lu: LuDansNolio, aujourdhui: string) {
  if (!o.nolioAthlete) return;
  const suivi = signaux(lu.planifiees.map((p) => ({ ...p, name: p.name ?? '' })), lu.reels.map((r) => ({ ...r, name: '' })),
    lu.hooper, await seuilsSuivi(), aujourdhui);
  await garderLesSignaux(o.coachId, o.nolioAthlete, suivi, derniereActivite(lu.reels));
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
// B-EC-1 (audit du 03/11/2026, décision coach du 04/11/2026) : seulement la dernière semaine écrite. Une plus ancienne
// repartirait de son état d'avant et l'écrirait sur le plan : la suite de sa préparation reculerait.
export async function derniereSemaineEcrite(planId: string): Promise<string | null> {
  const { data } = await clientService().from('semaines_ecrites').select('numero').eq('plan_id', planId);
  return (data ?? []).map((x) => String(x.numero)).filter((n) => /^S\d+$/.test(n))
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0] ?? null;
}

export async function annulerAjustements(planId: string, numero: string): Promise<void> {
  const o = await objectifEcrit(planId);
  if (!o) throw new Error('Plan introuvable');
  const { data: ecrite } = await clientService().from('semaines_ecrites').select('etat_avant').eq('plan_id', planId).eq('numero', numero).maybeSingle();
  if (!ecrite) throw new Error('Semaine pas encore écrite');
  if (numero !== await derniereSemaineEcrite(planId)) {
    throw new Error('Seule la dernière semaine écrite s’annule : annuler une semaine plus ancienne ferait reculer sa préparation.');
  }
  o.etat = (ecrite.etat_avant ?? null) as Etat | null;
  const sortie = await ecrireEtEnvoyer(o, numero, null, { sansAjustement: true });
  // Q4 (08/11/2026) : le pourquoi de la semaine réécrite ; ce qu'il avait lu reste.
  await garderLaRevue(planId, numero, (avant) => (avant ? { ...avant, pourquoi: sortie.pourquoi ?? null } : null));
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
  // Ce que la revue du dimanche avait gardé de ce qu'il a lu (Q4, 08/11/2026) ; sans la migration, rien à effacer.
  await service.from('semaines_ecrites').update({ revue: null }).eq('plan_id', planId);
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
  discipline?: 'trail' | 'route'; mode?: 'gestion' | 'a_fond' };

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
// Une valeur connue et un test fait sans valeur, à part (décision coach du 07/11/2026, « A » ; moteur 8.456) : fc_seuil1,
// vc et fc_seuil2 ne disent que la valeur présente et fraîche ; faits_sans_valeur, les tests à ne pas reproposer. Avant,
// un test fait sans valeur comptait comme une valeur connue : la semaine suivante, le moteur écrivait la mesure de la FC
// au seuil 2 « à 95 % de ta vitesse critique » sans vitesse critique, et gardait les phrases de VC dans les séances.
function valeursConnues(o: Objectif, lundi?: string | null, faits: Set<string> = new Set()) {
  const loin = o.coache && Boolean(lundi) && joursEntre(lundi as string, o.plan.course.date) > RETEST_HORS_COURSE_J;
  const frais = (cle: string) => !loin || String(o.reperesSources?.[cle]?.le ?? '').slice(0, 10) >= ajouterJours(lundi as string, -RETEST_J);
  return { fc_seuil1: 'fc_seuil1' in o.profil && frais('fc_seuil1'), vc: 'vc_ms' in o.profil && frais('vc_ms'),
    fc_seuil2: 'fc_seuil2' in o.profil && frais('fc_seuil2'), faits_sans_valeur: [...faits].sort(),
    lecture: o.accordLecture, coache: o.coache,
    // Sa vitesse critique elle-même (moteur 8.462, C12 de la revue des plans du 12/11/2026) : sur la route, le RPE de
    // l'allure de course se lit à sa part de la VC.
    ...(typeof o.profil.vc_ms === 'number' && frais('vc_ms') ? { vc_ms: o.profil.vc_ms } : {}) };
}

// Un test fait sans valeur ne revient pas avant 6 semaines (décision coach du 01/11/2026 : « l'athlète ne refait jamais
// un test qu'il vient de faire ») : « À regarder » prévient le coach (« Test à revoir »), qui entre la valeur ou relance
// l'athlète. Fait sans valeur : lu illisible ou sans réponse ; le test de la parole passé et pas encore lu (son
// questionnaire peut arriver jusqu'à 3 jours après) aussi. Une séance de test non faite revient.
// D5 (audits du 05/11/2026, lot 2, côté site) : sans accord de lecture, rien ne se lit ; un test de vitesse critique ou
// de FC au seuil 2 proposé compte alors comme fait sans valeur, comme le test de la parole (avant, il revenait à chaque
// semaine d'assimilation). Et au plus deux propositions sans valeur d'un même test sur tout le plan : ensuite il ne
// revient plus, l'athlète donne sa valeur dans « Tes zones ».
const TEST_FAIT_J = 42;
export const TESTS_SANS_VALEUR_MAX = 2;
async function testsFaitsSansValeur(planId: string, lundi?: string | null, accordLecture = true): Promise<Set<string>> {
  if (!lundi) return new Set();
  const service = clientService();
  const depuis = ajouterJours(lundi, -TEST_FAIT_J);
  const [{ data: lus }, { data: ecrites }] = await Promise.all([
    service.from('tests_lus').select('jour_id, statut').eq('plan_id', planId),
    service.from('semaines_ecrites').select('donnees').eq('plan_id', planId),
  ]);
  const statut = new Map((lus ?? []).map((l) => [l.jour_id as string, l.statut as string]));
  const faits = new Set<string>();
  const sansValeur = new Map<string, number>();
  for (const j of (ecrites ?? []).flatMap((e) => ((e.donnees as Semaine | null)?.jours ?? []))) {
    const cle = testEcrit(j);
    if (!cle || !j.date_iso || j.date_iso >= lundi) continue;
    const s = statut.get(j.id);
    if (!(s === 'illisible' || s === 'sans_reponse' || (s === undefined && (cle === 'parole' || !accordLecture)))) continue;
    sansValeur.set(cle, (sansValeur.get(cle) ?? 0) + 1);
    if (j.date_iso >= depuis) faits.add(cle);
  }
  for (const [cle, n] of sansValeur) if (n >= TESTS_SANS_VALEUR_MAX) faits.add(cle);
  return faits;
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
// Toute fiche qui a une valeur (moteur 8.460, décision 10 du coach du 09/11/2026, reperesLus.ts) : avant, une FC au seuil 1
// seule n'arrivait jamais dans les métriques Nolio, et le moteur la visait quand même.
export async function rattraperLesZones(budgetMs = 150_000): Promise<Compte[]> {
  const debut = Date.now();
  // Toute la fiche : ancien_le, sans la migration du 12/11/2026, n'existe pas.
  const { data: fiches } = await clientService().from('athletes_coaches').select('*')
    .not('nolio_athlete_id', 'is', null);
  const comptes: Compte[] = [];
  // Pas un ancien athlète, sorti de l'équipe Nolio (lot 2, 12/11/2026).
  for (const f of (fiches ?? []).filter((x) => x.mode !== 'plan' && !estAncien(x) && aDesReperes(x))) {
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
  // L'allure visée d'un objectif de route (décision A3 du 27/10/2026), avec ses repères.
  const kmh = allureViseeKmh(formatDe(o), o.tempsH);
  if (kmh) soucis.push(...await ecrireAllureVisee(d.usr, d.moi, kmh).catch((e) => [e instanceof Error ? e.message : String(e)]));
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
      const resultats = (await listeNolio<{ id: string; name?: string; is_confirmed?: boolean; items: { question: string; value: unknown }[] }>(
        `real/quiz_results/?date_from=${j.date_iso}&date_to=${aujourdhui}${d.moi ? '' : `&athlete=${d.usr}`}`).catch(() => []))
        .filter((x) => x.is_confirmed !== false);
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

// Le groupe « Plans CTS » (P2) et la sortie de l'équipe (P3) : posés au départ.
async function rangerAcheteur(o: Objectif) {
  const equipeId = await equipeDuCoach();
  if (!equipeId || !o.nolioAthlete) return;
  const groupe = await groupePlans(equipeId);
  if (groupe) await appelNolio('POST', `team/groups/${groupe}/members/`, { user: o.nolioAthlete, role: 'athlete' });
  await reprogrammerSortie(o.nolioAthlete);
}

// LA SORTIE DE L'ÉQUIPE D'UN ACHETEUR (P3 ; PL5 et B-PL-33, décision coach du 04/11/2026) : à la fin de la récupération
// de sa dernière course achetée (son lundi de reprise, debutApres), qui lui est désormais écrite comme à un coaché ; et
// refaite à chaque achat, avant même son départ : un deuxième plan programmé après la récupération du premier ne part
// plus avec lui, à la course 1 + 7 jours. Ses anciennes dates sont retirées avant de poser la nouvelle.
export function finDeLaPreparation(q: { course_date: string; intake: unknown }): string {
  const intake = (q.intake ?? {}) as Record<string, unknown>;
  return debutApres({ course_date: q.course_date, temps_h: heures(intake.temps_cible), format: String(intake.format ?? '') });
}
export async function reprogrammerSortie(usr: string) {
  const equipeId = await equipeDuCoach();
  if (!equipeId) return;
  const { data: plans } = await clientService().from('plans').select('course_date, intake')
    .eq('nolio_athlete_id', usr).in('nolio_statut', ['actif', 'invite']).not('parametres', 'is', null);
  const date = (plans ?? []).map((p) => finDeLaPreparation(p as { course_date: string; intake: unknown })).sort().pop();
  if (!date) return;
  const sorties = await listeNolio<{ id: string; user?: string; date_leaving?: string }>(`team/teams/${equipeId}/expirations/`);
  const siennes = sorties.filter((x) => x.user === usr);
  if (siennes.length === 1 && siennes[0].date_leaving?.slice(0, 10) === date) return;
  for (const x of siennes) await appelNolio('DELETE', `team/teams/${equipeId}/expirations/${x.id}/`);
  await appelNolio('POST', `team/teams/${equipeId}/expirations/`, { user: usr, date_leaving: date });
}

// Prévenir le coach (P4) : un court e-mail, à son adresse de contact. coachId : celui d'un coaché (B-AT-52, audit du
// 03/11/2026) : l'e-mail part à l'adresse de son compte (une athlète de Juliette, à Juliette), l'adresse de contact à
// défaut.
export async function prevenirCoach(sujet: string, texte: string, coachId: string | null = null) {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) return;
  const adresse = coachId
    ? await clientService().auth.admin.getUserById(coachId).then((r) => r.data?.user?.email ?? null).catch(() => null)
    : null;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: EXPEDITEUR, to: [{ email: adresse || site.email }], subject: sujet, textContent: texte }), cache: 'no-store',
  }).catch((e) => console.error('E-mail au coach :', e instanceof Error ? e.message : e));
}

// L'INVITATION LA SEMAINE AVANT LE DÉPART (décision coach du 04/11/2026 au soir, à la place de « la veille du premier
// lundi » du matin) : un achat n'entre dans l'équipe que le lundi de la semaine qui précède son départ (J-7), ou tout de
// suite si son départ tombe dans les 7 jours qui suivent l'achat ; d'ici là, il reste « à inviter », et le passage
// quotidien l'invite le jour venu (reinviter). Ses relances comptent à partir de ce jour (lib/app/invitation.ts).
export { jourDInvitation };

// UN ACHETEUR DÉJÀ DANS L'ÉQUIPE PAR UN PLAN PRÉCÉDENT (OM1) : un autre de ses plans y est actif, relié à son compte
// Nolio ; rend son identifiant d'athlète Nolio, ou null. inviterAcheteur ne l'invite pas de nouveau ; l'e-mail de
// bienvenue ne lui annonce pas d'invitation (lib/app/rangement.ts ; D4, cas fictifs du 09/11/2026, décision coach du
// 08/11/2026, « A »). La même requête pour les deux.
export async function planActifDansLEquipe(compteId: string, planId: string): Promise<string | number | null> {
  const { data } = await clientService().from('plans').select('nolio_athlete_id').eq('compte_id', compteId)
    .eq('nolio_statut', 'actif').not('nolio_athlete_id', 'is', null).neq('id', planId).limit(1);
  return (data?.[0]?.nolio_athlete_id as string | number | undefined) || null;
}

// UN ACHETEUR DÉJÀ DANS L'ÉQUIPE PAR SA FICHE DE COACHÉ (inviterAcheteur, la même requête) : « coaching », son plan
// attend, rien n'en part dans Nolio ; « plan », une fiche passée en mode plan avant le 04/11/2026, son plan démarre ; null
// sans fiche reliée à Nolio. L'e-mail de bienvenue ne lui annonce pas d'invitation (décision coach du 08/11/2026).
export async function ficheDansLEquipe(compteId: string): Promise<'coaching' | 'plan' | null> {
  const { data } = await clientService().from('athletes_coaches').select('mode').eq('compte_id', compteId)
    .not('nolio_athlete_id', 'is', null).limit(1);
  const fiche = data?.[0];
  return fiche ? (fiche.mode !== 'plan' ? 'coaching' : 'plan') : null;
}

// L'invitation de l'acheteur dans l'équipe, au paiement (P1) : l'adresse Nolio qu'il a donnée, sinon celle de l'achat.
// Un compte existant reçoit l'invitation de Nolio ; une adresse inconnue reçoit un compte créé, déjà dans l'équipe :
// son plan part tout de suite. Refusée ou Nolio indisponible : nouvel essai chaque jour, le coach prévenu une fois
// (prevenir : false pour les reprises), avec le vrai refus de Nolio (C6, B-PL-32 : un 400 n'est plus lu « équipe
// pleine »). Une erreur ou une coupure pendant l'appel la remet « à inviter » (B-PL-30) : elle ne reste plus « en cours ».
export async function inviterAcheteur(planId: string, emailAchat: string, { prevenir = true }: { prevenir?: boolean } = {}): Promise<string> {
  const service = clientService();
  // Une seule invitation à la fois (le webhook de Stripe et le retour de paiement arrivent ensemble).
  const { data: pris } = await service.from('plans').update({ nolio_statut: 'en_cours' })
    .eq('id', planId).eq('nolio_statut', 'a_inviter').select('nolio_email, course_nom, compte_id, debut_plan');
  const p = pris?.[0];
  if (!p) return 'deja';
  // Un athlète qui a une fiche de coaché (décision coach du 23/10/2026) est déjà dans l'équipe : son compte Nolio est
  // celui de sa fiche. En coaching, son plan attend ; son coach est prévenu et voit avec lui au cas par cas (décision
  // coach du 04/11/2026 au soir, « A » : le bouton « Passer en plan » n'existe plus). Une fiche passée en mode plan
  // avant le 04/11/2026 : il démarre.
  const { data: fiches } = await service.from('athletes_coaches').select('*').eq('compte_id', p.compte_id)
    .not('nolio_athlete_id', 'is', null).limit(1);
  const fiche = fiches?.[0];
  if (fiche) {
    const enCoaching = fiche.mode !== 'plan';
    await service.from('plans').update({ nolio_athlete_id: fiche.nolio_athlete_id, nolio_statut: enCoaching ? 'coaching' : 'actif', nolio_email: null })
      .eq('id', planId);
    if (enCoaching) {
      await prevenirCoach(`Plan CTS : ${fiche.nom} a acheté un plan pendant son coaching`,
        `${fiche.nom} a acheté le plan « ${p.course_nom ?? ''} » pendant son coaching. Son plan reste en attente : rien `
        + `n’en part dans Nolio. C’est à voir au cas par cas avec ${String(fiche.nom).split(' ')[0]}.`);
      return 'coaching';
    }
    await demarrerObjectif(planId);
    return 'actif';
  }
  // Un acheteur déjà dans l'équipe (un plan précédent, OM1) : pas de nouvelle invitation, son objectif démarre (OM4 le
  // programme après la course en cours) ; sa sortie de l'équipe suit la nouvelle course (P3).
  const membre = await planActifDansLEquipe(String(p.compte_id), planId);
  if (membre) {
    await service.from('plans').update({ nolio_athlete_id: membre, nolio_statut: 'actif', nolio_email: null }).eq('id', planId);
    // B-PL-33 : sa sortie de l'équipe suit dès maintenant sa nouvelle course, avant son départ programmé.
    await reprogrammerSortie(String(membre))
      .catch((e) => console.error(`Sortie de l’équipe du plan ${planId} :`, e instanceof Error ? e.message : e));
    await demarrerObjectif(planId);
    return 'actif';
  }
  // Pas avant le lundi de la semaine qui précède son départ ; le passage quotidien l'invitera ce jour-là.
  if (jourDInvitation(p.debut_plan as string | null, aujourdhuiParis()) > aujourdhuiParis()) {
    await service.from('plans').update({ nolio_statut: 'a_inviter' }).eq('id', planId).eq('nolio_statut', 'en_cours');
    return 'attente';
  }
  const email = String(p?.nolio_email || emailAchat).trim();
  let r: ReponseNolio | null;
  let equipeId: string | null;
  try {
    equipeId = await equipeDuCoach();
    r = equipeId ? await appelNolio('POST', `team/teams/${equipeId}/invitations/`, { email, role: 'athlete' }) : null;
  } catch (e) {
    // B-PL-30 : Nolio muet, ou la fonction coupée ici : l'invitation se refait, rien ne reste « en cours ».
    await service.from('plans').update({ nolio_statut: 'a_inviter' }).eq('id', planId).eq('nolio_statut', 'en_cours');
    console.error(`Invitation Nolio du plan ${planId} :`, e instanceof Error ? e.message : e);
    if (prevenir) {
      await prevenirCoach('Plan CTS : invitation Nolio à refaire',
        `Nolio n’a pas répondu à l’invitation de l’acheteur du plan « ${p?.course_nom ?? ''} » `
        + `(${e instanceof Error ? e.message : String(e)}). Le site réessaie chaque soir.`);
    }
    return 'a_inviter';
  }
  if (!r || (r.statut !== 201 && r.statut !== 200)) {
    await service.from('plans').update({ nolio_statut: 'a_inviter' }).eq('id', planId);
    const raison = r ? refusNolio(r, 'l’invitation') : 'Ton équipe Nolio est introuvable avec la clé de l’API.';
    console.error(`Invitation Nolio du plan ${planId} :`, raison);
    if (prevenir) {
      await prevenirCoach('Plan CTS : invitation Nolio à refaire',
        `L’invitation dans ton équipe Nolio de l’acheteur du plan « ${p?.course_nom ?? ''} » (${email}) n’est pas partie : `
        + `${raison} Le site réessaie chaque soir ; si ton équipe est pleine, libère une place.`);
    }
    return 'a_inviter';
  }
  const statut = r.corps?.status === 'active' ? 'actif' : 'invite';
  // E1 (audits du 05/11/2026) : l'adresse Nolio donnée en plus reste jusqu'à son adhésion, pour l'alerte au coach ;
  // effacée dès qu'il est dans l'équipe (ici, le webhook de Nolio ou la relecture de l'équipe).
  await service.from('plans').update({ nolio_athlete_id: String(r.corps?.user ?? ''), nolio_statut: statut,
    nolio_email: statut === 'actif' ? null : (p?.nolio_email ?? null) }).eq('id', planId);
  if (equipeId) {
    const groupe = await groupePlans(equipeId).catch(() => null);
    if (groupe) await appelNolio('POST', `team/groups/${groupe}/members/`, { user: String(r.corps?.user ?? ''), role: 'athlete' }).catch(() => null);
  }
  if (statut === 'actif') await demarrerObjectif(planId);
  return statut;
}

// Les invitations restées à faire (équipe pleine, Nolio indisponible), et celles qui attendaient la semaine d'avant le
// départ : un essai chaque jour. Le coach est prévenu le jour où l'invitation devait partir, pas les jours suivants.
// B-PL-30 : une invitation restée « en cours » plus d'une heure après l'achat (une coupure pendant l'appel) se reprend.
const UNE_HEURE_MS = 3600_000;
export async function reinviter(): Promise<Compte[]> {
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  await service.from('plans').update({ nolio_statut: 'a_inviter' }).eq('nolio_statut', 'en_cours')
    .lt('cree_le', new Date(Date.now() - UNE_HEURE_MS).toISOString());
  const { data } = await service.from('plans').select('id, compte_id, debut_plan, cree_le').eq('nolio_statut', 'a_inviter')
    .gte('course_date', aujourdhui);
  const comptes: Compte[] = [];
  for (const p of data ?? []) {
    const jour = jourDInvitation(p.debut_plan as string | null, jourParis(p.cree_le as string));
    if (jour > aujourdhui) continue;
    const { data: u } = await service.auth.admin.getUserById(p.compte_id as string);
    if (!u?.user?.email) continue;
    const quoi = await inviterAcheteur(p.id as string, u.user.email, { prevenir: jour === aujourdhui })
      .catch((e) => `échec (${e instanceof Error ? e.message : e})`);
    comptes.push({ plan: p.id as string, quoi: `invitation : ${quoi}` });
  }
  return comptes;
}
const jourParis = (horodatage: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(horodatage));

// Une invitation envoyée et jamais acceptée (décision coach du 21/10/2026 : « relance puis alerte ») : 3 jours après
// l'invitation, un e-mail à l'acheteur. L'alerte au coach part le samedi qui précède son départ (E1, alerterLeCoach), et
// plus 7 jours après l'invitation, le lundi du départ. Le passage tourne une fois par jour : chaque envoi tombe un seul
// jour, sans rien garder.
export const JOURS_RELANCE = JOURS_RELANCE_INVITATION;
export async function relancerInvitations(): Promise<Compte[]> {
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  const { data } = await service.from('plans').select('id, compte_id, course_nom, cree_le, debut_plan, nom:donnees->athlete->>nom')
    .eq('nolio_statut', 'invite').gte('course_date', aujourdhui);
  const comptes: Compte[] = [];
  for (const p of data ?? []) {
    // Les jours depuis l'invitation (la semaine d'avant le départ pour une course lointaine), plus depuis l'achat.
    const depuis = joursEntre(jourDInvitation(p.debut_plan as string | null, jourParis(p.cree_le as string)), aujourdhui);
    if (depuis !== JOURS_RELANCE) continue;
    try {
      const { data: u } = await service.auth.admin.getUserById(p.compte_id as string);
      const email = u?.user?.email;
      if (!email) continue;
      await envoyerRelanceInvitation(email, String(p.nom ?? ''), `${site.url}/app`);
      comptes.push({ plan: p.id as string, quoi: 'invitation relancée' });
    } catch (e) {
      comptes.push({ plan: p.id as string, quoi: 'relance non faite', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// E1 (audits du 05/11/2026, lot 1, « le filet Nolio ») : le samedi qui précède le départ d'un acheteur (jourAlerteNolio),
// un e-mail au coach pour tout plan acheté pas encore dans l'équipe — invitation pas acceptée, refusée ou pas partie —,
// avec l'adresse invitée ; sans lui dans l'équipe, aucune séance ne lui arrive. Un seul jour par plan, sans rien garder.
const ETAT_INVITATION: Record<string, string> = {
  invite: 'l’invitation est partie, il ne l’a pas encore acceptée (il a été relancé par e-mail)',
  refuse: 'il a refusé l’invitation',
  a_inviter: 'l’invitation n’a pas pu partir (le site réessaie chaque soir)',
  en_cours: 'l’invitation n’a pas pu partir (le site réessaie chaque soir)',
};
export async function alerterLeCoach(): Promise<Compte[]> {
  const service = clientService();
  const aujourdhui = aujourdhuiParis();
  const { data } = await service.from('plans').select('id, compte_id, course_nom, cree_le, debut_plan, nolio_statut, nolio_email, nom:donnees->athlete->>nom')
    .in('nolio_statut', Object.keys(ETAT_INVITATION)).is('demarre_le', null).not('parametres', 'is', null).gte('course_date', aujourdhui);
  const comptes: Compte[] = [];
  for (const p of data ?? []) {
    if (jourAlerteNolio(p.debut_plan as string | null, jourParis(p.cree_le as string)) !== aujourdhui) continue;
    try {
      const { data: u } = await service.auth.admin.getUserById(p.compte_id as string);
      const adresse = String(p.nolio_email || u?.user?.email || '');
      const debut = String(p.debut_plan ?? '').slice(0, 10);
      const premiere = debut > ajouterJours(jourParis(p.cree_le as string), 1) ? debut : ajouterJours(jourParis(p.cree_le as string), 1);
      const le = new Date(`${premiere > aujourdhui ? premiere : ajouterJours(aujourdhui, 1)}T12:00:00Z`)
        .toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
      await prevenirCoach(`Plan CTS : ${String(p.nom ?? '').trim() || 'un acheteur'} n’est pas encore dans ton équipe Nolio`,
        `${String(p.nom ?? '').trim() || 'L’acheteur'} (plan « ${p.course_nom} ») n’est pas encore dans ton équipe Nolio, et sa `
        + `préparation commence le ${le} : ${ETAT_INVITATION[String(p.nolio_statut)]}. L’adresse invitée : ${adresse || 'inconnue'}. `
        + 'Sans lui dans l’équipe, aucune séance ne lui arrive : regarde l’invitation dans Nolio, ou écris-lui.');
      comptes.push({ plan: p.id as string, quoi: 'coach prévenu (pas encore dans l’équipe)' });
    } catch (e) {
      comptes.push({ plan: p.id as string, quoi: 'alerte non faite', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// E1 : une adhésion que le webhook de Nolio n'a pas transmise (manquée, ou Nolio l'a envoyée pendant une mise en ligne) :
// chaque jour, l'équipe relue (GET me/athletes/) ; un acheteur invité ou refusé qui y est déjà passe « actif » et sa
// préparation démarre, comme à l'événement d'adhésion. Rien à lire sans plan en attente.
export async function relireLEquipe(): Promise<Compte[]> {
  const service = clientService();
  const { data } = await service.from('plans').select('id, nolio_athlete_id').in('nolio_statut', ['invite', 'refuse'])
    .not('nolio_athlete_id', 'is', null).not('parametres', 'is', null).gte('course_date', aujourdhuiParis());
  if (!data?.length) return [];
  const membres = new Set((await athletesNolio()).map((a) => a.id));
  const comptes: Compte[] = [];
  for (const p of data.filter((x) => membres.has(String(x.nolio_athlete_id)))) {
    try {
      await service.from('plans').update({ nolio_statut: 'actif', nolio_email: null }).eq('id', p.id).in('nolio_statut', ['invite', 'refuse']);
      const d = await demarrerObjectif(String(p.id));
      comptes.push({ plan: String(p.id), quoi: `adhésion relue dans l’équipe : ${'numero' in d ? `démarré (${d.numero})` : `programmé au ${d.prevu}`}` });
    } catch (e) {
      comptes.push({ plan: String(p.id), quoi: 'adhésion relue, départ non fait', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// ─── Le passage quotidien ─────────────────────────────────────────────────

// E4 (audits du 05/11/2026, lot 1) : le lundi soir, les semaines dues que le dimanche n'a pas écrites (Nolio ou le moteur
// muets toute la soirée, une mise en ligne) s'écrivent, à partir du mardi, par le chemin de « Réessayer »
// (rattraperLaSemaine : sa réservation, les séances que le coach a posées gardées). Les écrites, laissées au coach ou en
// cours ne bougent pas ; une semaine de récupération attend « Réessayer ». Le coach reçoit les noms : reprises, et celles
// qui restent à faire. jour : aujourd'hui (Paris), simulable.
export async function reprendreLesSemainesDues(budgetMs = 90_000, jour = aujourdhuiParis()): Promise<Compte[]> {
  if (!semaineAReprendre({ jour, numero: 'S', ecrite: false, laissee: false })) return [];
  const debut = Date.now();
  const service = clientService();
  const comptes: Compte[] = [];
  const reprises: string[] = [];
  const restent: string[] = [];
  for (const planId of await plansActifs()) {
    if (Date.now() - debut > budgetMs) {
      restent.push(planId);
      continue;
    }
    // Rien à reprendre : la semaine du jour est écrite, ou n'est pas une semaine de préparation.
    const o = await objectifEcrit(planId).catch(() => null);
    const s = o ? semaineDu(o.plan, jour) : null;
    if (!o?.nolioAthlete || !s) continue;
    const { data: ecrite } = await service.from('semaines_ecrites').select('numero').eq('plan_id', planId).eq('numero', s.numero).maybeSingle();
    if (!semaineAReprendre({ jour, numero: s.numero, ecrite: Boolean(ecrite), laissee: o.envois.some((e) => e.semaine === cleLaissee(jour)) })) continue;
    try {
      await rattraperLaSemaine(planId, { depuis: ajouterJours(jour, 1) });
      reprises.push(planId);
      comptes.push({ plan: planId, quoi: `${s.numero} écrite le lundi (dimanche raté)`, coache: o.coache });
    } catch (e) {
      // Des séances que le coach a posées entre-temps : la semaine est la sienne, rien à reprendre.
      if (e instanceof Error && e.message.startsWith('Des séances que tu as posées')) {
        await noterLaissee(o, jour);
        comptes.push({ plan: planId, quoi: `${s.numero} laissée, séances du coach gardées`, coache: o.coache });
        continue;
      }
      restent.push(planId);
      comptes.push({ plan: planId, quoi: `${s.numero} toujours pas écrite`, erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  if (reprises.length || restent.length) {
    const noms = await nomsDesPlans([...reprises, ...restent]);
    const liste = (ids: string[]) => ids.map((id) => noms.get(id) ?? 'un athlète').join(', ');
    await prevenirCoach(`Plans CTS : ${reprises.length + restent.length} semaine${reprises.length + restent.length > 1 ? 's' : ''} du dimanche reprise${reprises.length + restent.length > 1 ? 's' : ''} ce lundi`,
      [reprises.length ? `Écrites ce soir, à partir de demain : ${liste(reprises)}.` : '',
        restent.length ? `Toujours pas écrites : ${liste(restent)}. Pour un coaché, « Réessayer » dans « Urgent » (${site.url}/app/coach/urgent) ; pour un acheteur, le site ne réessaie plus de lui-même : préviens-le en réponse à son e-mail de bienvenue.` : '',
      ].filter(Boolean).join('\n\n'));
  }
  return comptes;
}

// E3 (audits du 05/11/2026, lot 1) : « Arrêter cette préparation (remboursée) », dans Chiffres › Plans. Le remboursement
// reste fait dans Stripe ; ici, plus rien ne part : ce que la préparation a posé et qui est encore à venir quitte son
// Nolio (séances, notes, bandeaux, courses, questionnaires de cet objectif), le statut passe à « sorti » (plus
// d'invitation, de relance, de dimanche, de départ), et l'acheteur quitte l'équipe s'il n'y est pour rien d'autre. Jamais
// le coach lui-même (« (toi) »), ni un athlète qui a une fiche de coaché : il reste dans l'équipe, sa préparation s'arrête.
// Rend ce qui n'a pas pu partir de Nolio, en phrases.
export async function arreterLaPreparation(planId: string): Promise<string[]> {
  const service = clientService();
  const { data: p } = await service.from('plans').select('id, nolio_athlete_id, nolio_statut, demarre_le, parametres').eq('id', planId).maybeSingle();
  if (!p?.parametres || !p.nolio_statut || p.nolio_statut === 'coaching') throw new Error('Ce plan n’est pas une préparation achetée en cours.');
  const { data: coache } = await service.from('coaching').select('plan_id').eq('plan_id', planId).maybeSingle();
  if (coache) throw new Error('C’est un objectif de coaching : retire-le depuis la fiche de l’athlète.');
  const soucis: string[] = [];
  const usr = (p.nolio_athlete_id ?? null) as string | null;
  if (usr && p.demarre_le) soucis.push(...await retirerDeNolio(planId).catch((e) => [e instanceof Error ? e.message : String(e)]));
  const { error } = await service.from('plans').update({ nolio_statut: 'sorti', depart_prevu: null, etat_ecriture: null }).eq('id', planId);
  if (error) throw new Error(error.message);
  // La date de l'arrêt, que l'app de l'acheteur lit (migration du 05/11/2026 ; sans elle, l'app le dit comme une sortie).
  await service.from('plans').update({ arretee_le: new Date().toISOString() }).eq('id', planId).then(() => null, () => null);
  if (usr && /^usr_/.test(usr)) {
    const { data: autres } = await service.from('plans').select('id').eq('nolio_athlete_id', usr).in('nolio_statut', ['actif', 'invite']).neq('id', planId);
    const { data: fiches } = await service.from('athletes_coaches').select('id').eq('nolio_athlete_id', usr).limit(1);
    const moi = await moiNolio().then((m) => m.id).catch(() => null);
    const geste = sortieApresArret({ usr, autresPlans: autres?.length ?? 0, coache: Boolean(fiches?.length), moi });
    const equipeId = await equipeDuCoach();
    if (geste === 'reprogrammer') {
      // Un autre plan en cours : sa sortie suit sa dernière course.
      await reprogrammerSortie(usr).catch((e) => soucis.push(e instanceof Error ? e.message : String(e)));
    } else if (geste === 'retirer' && equipeId) {
      const sorties = await listeNolio<{ id: string; user?: string }>(`team/teams/${equipeId}/expirations/`).catch(() => []);
      for (const x of sorties.filter((y) => y.user === usr)) await appelNolio('DELETE', `team/teams/${equipeId}/expirations/${x.id}/`).catch(() => null);
      const r = await appelNolio('DELETE', `team/teams/${equipeId}/members/${usr}/`).catch(() => null);
      if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, 'sa sortie de l’équipe') : 'sa sortie de l’équipe : Nolio injoignable');
    }
  }
  return soucis;
}

// J7 (audits du 05/11/2026, S3) : avant l'effacement d'un compte, ses préparations achetées s'arrêtent dans Nolio (ce
// qu'elles y ont posé et qui est à venir en part), il quitte l'équipe s'il n'y est que pour elles (jamais un coaché, ni
// le coach), et ses badges s'effacent. Ce qui n'a pas pu se faire part au coach, à finir à la main.
export async function sortirDeNolioAvantEffacement(compteId: string): Promise<string[]> {
  const service = clientService();
  const { data: plans } = await service.from('plans').select('id, nolio_athlete_id, nolio_statut, demarre_le, nom:donnees->athlete->>nom')
    .eq('compte_id', compteId).not('nolio_statut', 'is', null);
  if (!plans?.length) return [];
  const { data: coaches } = await service.from('coaching').select('plan_id').in('plan_id', plans.map((p) => p.id));
  const deCoaching = new Set((coaches ?? []).map((c) => String(c.plan_id)));
  const achetes = plans.filter((p) => !deCoaching.has(String(p.id)) && p.nolio_statut !== 'coaching');
  const soucis: string[] = [];
  for (const p of achetes) {
    if (p.nolio_athlete_id && p.demarre_le && p.nolio_statut !== 'sorti') {
      soucis.push(...await retirerDeNolio(String(p.id)).catch((e) => [e instanceof Error ? e.message : String(e)]));
    }
    await service.from('plans').update({ nolio_statut: 'sorti', depart_prevu: null }).eq('id', p.id);
  }
  const moi = await moiNolio().then((m) => m.id).catch(() => null);
  const equipeId = await equipeDuCoach();
  for (const usr of new Set(achetes.map((p) => String(p.nolio_athlete_id ?? '')).filter((u) => /^usr_/.test(u)))) {
    const { data: fiches } = await service.from('athletes_coaches').select('id').eq('nolio_athlete_id', usr).limit(1);
    const { data: autres } = await service.from('plans').select('id').eq('nolio_athlete_id', usr).neq('compte_id', compteId)
      .in('nolio_statut', ['actif', 'invite']);
    const geste = sortieApresArret({ usr, autresPlans: autres?.length ?? 0, coache: Boolean(fiches?.length), moi });
    if (geste === 'reprogrammer') continue;
    if (!fiches?.length) await service.from('badges').delete().eq('nolio_athlete_id', usr);
    if (geste !== 'retirer' || !equipeId) continue;
    const sorties = await listeNolio<{ id: string; user?: string }>(`team/teams/${equipeId}/expirations/`).catch(() => []);
    for (const x of sorties.filter((y) => y.user === usr)) await appelNolio('DELETE', `team/teams/${equipeId}/expirations/${x.id}/`).catch(() => null);
    const r = await appelNolio('DELETE', `team/teams/${equipeId}/members/${usr}/`).catch(() => null);
    if (!r || (r.statut !== 204 && r.statut !== 200 && r.statut !== 404)) soucis.push(r ? refusNolio(r, 'sa sortie de l’équipe') : 'sa sortie de l’équipe : Nolio injoignable');
  }
  if (soucis.length) {
    const nom = String(achetes[0]?.nom ?? '').trim() || 'Un acheteur';
    await prevenirCoach('Plan CTS : un compte supprimé, Nolio à finir à la main',
      `${nom} a supprimé son compte de l’app : sa préparation s’arrête. Dans Nolio, à finir à la main : ${soucis.join(' ; ')}.`);
  }
  return soucis;
}

// Chaque jour, en tête (X1, audits du 05/11/2026, lot 2 : « les appels légers d'abord ») : les invitations à refaire, la
// relance de J+3, l'alerte du samedi et la relecture de l'équipe (E1), le rappel du samedi de la confirmation de charge,
// les départs du jour, et le lundi les semaines du dimanche à reprendre (E4) : avant les tâches longues, que la limite des
// 300 s de la tâche coupe en premier.
export async function passageQuotidienLeger(): Promise<Compte[]> {
  const comptes: Compte[] = [];
  const garder = async (quoi: string, f: () => Promise<Compte[]>) => {
    comptes.push(...await f().catch((e) => [{ plan: '', quoi, erreur: e instanceof Error ? e.message : String(e) }]));
  };
  await garder('invitations non refaites', reinviter);
  await garder('relances non faites', relancerInvitations);
  await garder('alertes non faites', alerterLeCoach);
  await garder('équipe non relue', relireLEquipe);
  // Le samedi, la confirmation de charge restée sans réponse (décision coach du 04/11/2026 au soir).
  await garder('confirmations non rappelées', rappelerLesConfirmations);
  await garder('départs non faits', () => departsDuJour(90_000));
  await garder('semaines du dimanche non reprises', () => reprendreLesSemainesDues(60_000));
  return comptes;
}

// Chaque jour, après le reste (X1) : la fatigue franche de chaque plan actif (avec l'accord de lecture) et ses tests, en
// temps compté (les plans restants le soir suivant), puis un seul e-mail au coach s'il s'est passé quelque chose chez ses
// coachés (ajustements du dimanche et du jour, arrêts ; question 20).
export async function passageQuotidienLong(budgetMs = 150_000): Promise<Compte[]> {
  const debut = Date.now();
  const comptes: Compte[] = [];
  const tests: TestLu[] = [];
  for (const planId of await plansActifs()) {
    if (Date.now() - debut > budgetMs) {
      comptes.push({ plan: planId, quoi: 'fatigue remise au soir suivant' });
      continue;
    }
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
  await resumeAuCoach(comptes.filter((c) => c.coache && c.journal?.length), tests.filter((t) => t.coache));
  return comptes;
}

const REGLES_EN_CLAIR: Record<string, string> = {
  R1: 'semaine en grande partie manquée', R2: 'séance clé trop dure ou écourtée', R3: 'fatigue', R4: 'arrêt',
  R8: 'séance clé pas faite, refaite sous une autre forme', C5: 'semaine de course juste après la récupération, sans séance dure',
  COACH: 'ta correction avant l’envoi',
  R5: 'disponibilités', R7: 'séance en plus', O3: 'course secondaire', CH: 'charge reprise après une semaine légère',
  REPLI: 'semaine refusée par le contrôle du moteur, écrite par un repli',
  // Validé par le coach le 06/11/2026 (A)
  OM4: 'semaine de reprise allégée', S4: 'course hors de portée après la reconstruction',
  TN: 'test de vitesse critique non reproposé', REC: 'récupération',
};

// Ce qui n'est pas un ajustement du moteur : les corrections du coach (EC3, « COACH »), et ce que le moteur reprend de ses
// retouches (décision coach du 06/11/2026, « A ») : C1, la sortie longue ou la marche reprise de ce que le coach a posé ;
// D6, la semaine qu'il a posée, lue comme une semaine écrite. Elles restent au journal de la semaine, sans allumer
// « Semaine ajustée », ni « Le moteur s'en est chargé », ni l'e-mail de résumé.
export const PAS_UN_AJUSTEMENT = new Set(['COACH', 'C1', 'D6']);

// Une raison en clair : son libellé, sinon l'effet écrit par le moteur, sinon rien ; jamais le code de la règle.
const raisonEnClair = (j: { regle?: string; effet?: unknown }) =>
  REGLES_EN_CLAIR[j.regle ?? ''] ?? (typeof j.effet === 'string' ? j.effet.trim().replace(/\.$/, '') : '');

// Le Suivi du coach (décision 8 du document des règles) : les ajustements de ses coachés écrits ces 8 derniers jours,
// chacun avec son geste : « Annuler » pour ceux du dimanche, « Garder la séance d'origine » pour une séance allégée.
// annulable : la dernière semaine écrite de son objectif (B-EC-1) ; « Annuler » ne s'offre que là.
// allegees : le jour de chaque séance allégée en EF et son nom d'origine ; joursArret : les jours sans courir lus à son
// lundi (R4), pour le signal de « Mes athlètes » (décision 1A du coach, 05/11/2026).
export type Ajustement = { planId: string; nom: string; numero: string; lundi: string | null; raisons: string[]; bilan: string | null;
  allegees: { id: string; nom: string; jour: string }[]; annulable: boolean; joursArret: number | null };
export async function ajustementsDuCoach(coachId: string): Promise<Ajustement[]> {
  const service = clientService();
  const { data: coaching } = await service.from('coaching').select('plan_id, athlete_nom').eq('coach_id', coachId);
  const nomDe = new Map((coaching ?? []).map((c) => [c.plan_id as string, c.athlete_nom as string]));
  if (!nomDe.size) return [];
  const depuis = new Date(Date.now() - 8 * 86400_000).toISOString();
  const { data: ecrites } = await service.from('semaines_ecrites').select('plan_id, numero, journal, bilan, donnees, sans_ajustement')
    .in('plan_id', [...nomDe.keys()]).gte('ecrite_le', depuis);
  const { data: numeros } = await service.from('semaines_ecrites').select('plan_id, numero').in('plan_id', [...nomDe.keys()]);
  const derniere = new Map<string, number>();
  for (const x of numeros ?? []) {
    if (!/^S\d+$/.test(String(x.numero))) continue;
    const n = Number(String(x.numero).slice(1));
    if (n > (derniere.get(x.plan_id as string) ?? -1)) derniere.set(x.plan_id as string, n);
  }
  const liste: Ajustement[] = [];
  for (const e of ecrites ?? []) {
    // Les corrections du coach (EC3, « COACH ») sont les siennes, pas des ajustements du moteur ; C1 et D6 suivent ses
    // retouches (décision coach du 06/11/2026).
    const journal = e.sans_ajustement ? [] : ((e.journal ?? []) as { regle?: string; effet?: unknown; jours?: number }[])
      .filter((j) => !PAS_UN_AJUSTEMENT.has(j.regle ?? ''));
    const jours = ((e.donnees as Semaine | null)?.jours ?? []) as (Semaine['jours'][number] & { origine?: { seance?: string } })[];
    const allegees = jours.filter((j) => j.origine).map((j) => ({ id: j.id, nom: j.origine?.seance ?? j.id, jour: j.jour }));
    if (!journal.length && !allegees.length) continue;
    liste.push({
      planId: e.plan_id as string, nom: nomDe.get(e.plan_id as string) ?? '', numero: e.numero as string,
      lundi: (e.donnees as Semaine | null)?.lundi ?? null,
      raisons: [...new Set(journal.map(raisonEnClair).filter(Boolean))], bilan: e.bilan as string | null, allegees,
      annulable: derniere.get(e.plan_id as string) === Number(String(e.numero).slice(1)),
      joursArret: journal.find((j) => j.regle === 'R4' && typeof j.jours === 'number')?.jours ?? null,
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
    const journal = ((e.journal ?? []) as { regle?: string; effet?: unknown }[]).filter((j) => !PAS_UN_AJUSTEMENT.has(j.regle ?? ''));
    if (!nom || !journal.length || e.sans_ajustement) continue;
    const raisons = [...new Set(journal.map(raisonEnClair).filter(Boolean))];
    // Validé par le coach le 06/11/2026 (A) : « semaine ajustée », quand aucune de ses règles n'a de mot ni d'effet.
    lignes.push(`${nom}, ${e.numero}${raisons.length ? ` : ${raisons.join(', ')}` : ' : semaine ajustée'}.`);
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
    [lignes.length ? `${lignes.join('\n')}\n\nTout est dans « Mes athlètes » (${site.url}/app/coach), sur la page de chaque athlète ; chaque ajustement s’y annule, dans « Sa semaine qui arrive ».` : '',
      valeurs.length ? `Tests lus, valeurs posées sur leur fiche :\n${valeurs.join('\n')}` : ''].filter(Boolean).join('\n\n'));
}
