// Aucun réseau, aucune base : tout passe par le CONTEXTE d'un plan, que lib/app/passagesV9.ts remplit avec le vrai Nolio et la vraie base et que les essais
// remplissent de fausses pièces (scripts/test-passes-v9.mjs).
/**
 * CE QUE FAIT UN PASSAGE SUR UN PLAN, SOUS LE MOTEUR v1 (décisions du coach du 24/11/2026, entrée 191) : le dimanche matin le questionnaire, le dimanche
 * soir la semaine suivante, le lundi (de 5 h à 21 h UTC, toutes les deux heures) la réponse arrivée tard.
 *
 *   - LE DIMANCHE MATIN : le moteur choisit la version du questionnaire d'après ce que Nolio montre de la semaine écrite ; il se pose dans Nolio (12 h) et
 *     se garde avec la semaine qu'il interroge (sa version, ses séances clés dans l'ordre posé : la réponse les dit par leur rang). Posé une fois ;
 *   - LE DIMANCHE SOIR : la semaine du lundi qui vient s'écrit (trois passages, 17 h, 19 h, 21 h UTC : un lundi déjà écrit est sauté) ;
 *   - LE LUNDI : une semaine pas encore écrite s'écrit (le filet) ; une réponse nouvelle réécrit la semaine tant qu'aucune séance n'est faite, sinon c'est
 *     une réponse tardive ; une semaine que le coach a retouchée dans Nolio n'est pas réécrite (« Nolio fait foi ») et le dit.
 */
import type { QuestionnaireDimanche, ReponsesDimanche, SeanceCle, VersionDimanche } from './dimancheV9';
import {
  etatApresEcriture, ecrireLaSemaine, lireLaTrame, preparerLeQuestionnaire, signatureDesReponses, suiteDeLaReponse, type Ports, type SemaineEcriteV9,
} from './ecritureV9';
import type { EtatDuPlan } from './etatMoteur';
import { numeroDeLaSemaine, parametresV9, type NolioVu, type SortieV9 } from './moteurV9';

export type QuestionnairePoseV9 = { version: VersionDimanche; cles: SeanceCle[]; nolio_id: string | null; pose_le: string };
export type SemaineEnMemoire = { numero: number; lundi: string | null; semaine: SortieV9['semaine']; reponsesLues: ReponsesDimanche | null;
  questionnaire: QuestionnairePoseV9 | null };

export type ContextePlan = {
  planId: string; coache: boolean; parametres: Record<string, unknown>; ports: Ports; etat: EtatDuPlan;
  // La dernière semaine écrite par le moteur v1, ou null.
  derniere: SemaineEnMemoire | null;
  // Ce que Nolio montre des semaines avant `lundi` (avec la sienne si avecLaSemaine) ; null si la lecture a manqué ou qu'il n'y a rien à lire.
  lireNolio: (lundi: string, avecLaSemaine: boolean) => Promise<NolioVu | null>;
  // Les réponses au questionnaire posé à la fin de la semaine `numero` (0 : celui d'avant la première), lues dans Nolio ; null si aucune n'est revenue.
  lireLesReponses: (numero: number, pose: QuestionnairePoseV9 | null) => Promise<{ reponses: ReponsesDimanche; illisibles: string[] } | null>;
  // Le questionnaire posé à la fin de la semaine `numero` (gardé avec elle), ou null.
  questionnaireDe: (numero: number) => Promise<QuestionnairePoseV9 | null>;
  envoyer: (ecrite: SemaineEcriteV9) => Promise<void>;
  garderEcriture: (ecrite: SemaineEcriteV9, apres: EtatDuPlan) => Promise<void>;
  garderEtat: (etat: EtatDuPlan['courant']) => Promise<void>;
  garderReponsesLues: (numero: number, reponses: ReponsesDimanche) => Promise<void>;
  retouchee: (numero: number, lundi: string) => Promise<boolean>;
  poserLaNote: (numero: number, lundi: string, lignes: string[]) => Promise<void>;
  poserLeQuiz: (quiz: QuestionnaireDimanche, jour: string) => Promise<string | null>;
  garderLeQuestionnaire: (numero: number, q: QuestionnairePoseV9) => Promise<void>;
};

export type Resultat = { quoi: string } | null;
const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Des réponses où seule la version est lue valent « pas de réponse lue » : le moteur le dit alors à l'athlète, sans rien deviner.
// QUESTION OUVERTE (posée à la session moteur-v1 le 24/11/2026) : `moteur/note.py` lit une clé `reponses.illisible`, absente du contrat. Tant qu'elle n'est pas
// tranchée, une réponse illisible ne part PAS (« pas de réponse lue ») : le comportement garde ce choix, un seul endroit à changer.
export function reponsesOuRien(r: { reponses: ReponsesDimanche } | null): ReponsesDimanche | null {
  if (!r) return null;
  return Object.keys(r.reponses).some((k) => k !== 'version') ? r.reponses : null;
}

async function reponsesDeLaVeille(c: ContextePlan): Promise<ReponsesDimanche | null> {
  const numero = c.derniere?.numero ?? 0;
  return reponsesOuRien(await c.lireLesReponses(numero, c.derniere?.questionnaire ?? null));
}

// ─── Le dimanche soir : la semaine du lundi qui vient ───────────────────────────────────────────────

export async function ecrireLaSemaineDuLundi(c: ContextePlan, lundi: string): Promise<Resultat> {
  const trame = await lireLaTrame(c.ports, c.parametres);
  const numero = numeroDeLaSemaine(trame, lundi);
  if (numero === null) return null; // pas avant l'entrée du plan, ni après sa fin : rien à écrire
  if (c.etat.ecrites.some((w) => w.numero === numero)) return null; // déjà écrite : les reprises du soir et du lundi la sautent
  const reponses = await reponsesDeLaVeille(c);
  const nolio = c.etat.ecrites.length ? await c.lireNolio(lundi, false) : null;
  const ecrite = await ecrireLaSemaine(c.ports, { parametres: c.parametres, lundi, etat: c.etat, nolio, reponses, trame });
  await c.envoyer(ecrite);
  await c.garderEcriture(ecrite, etatApresEcriture(c.etat, ecrite));
  return { quoi: `S${numero} écrite` };
}

// ─── Le lundi ───────────────────────────────────────────────────────────────────────────────────────

export async function passeDuLundiSurUnPlan(c: ContextePlan, lundi: string): Promise<Resultat> {
  // Une semaine pas encore écrite (un dimanche manqué) : le filet l'écrit.
  if (!c.derniere || c.derniere.lundi !== lundi) return ecrireLaSemaineDuLundi(c, lundi);
  const derniere = c.derniere;
  // Les réponses au questionnaire posé à la fin de la semaine d'avant, dont celles qui sont arrivées depuis dimanche soir.
  const avant = derniere.numero - 1;
  const reponses = reponsesOuRien(await c.lireLesReponses(avant, avant >= 1 ? await c.questionnaireDe(avant) : null));
  const reponseNouvelle = reponses !== null && signatureDesReponses(reponses) !== signatureDesReponses(derniere.reponsesLues);
  if (!reponseNouvelle) return null;
  const nolio = await c.lireNolio(lundi, true);
  // Une semaine que le coach a retouchée dans Nolio n'est pas réécrite : seule la réponse tardive ne touche à aucune séance.
  const suite = await suiteDeLaReponse(c.ports, { parametres: c.parametres, lundi, etat: c.etat, nolio, reponses, reponseNouvelle });
  if (suite.action === 'rien') return null;
  if (suite.action === 'reponse_tardive') {
    await c.garderEtat(suite.etat.courant);
    if (suite.note.length) await c.poserLaNote(derniere.numero, lundi, suite.note);
    await c.garderReponsesLues(derniere.numero, reponses as ReponsesDimanche);
    return { quoi: `S${derniere.numero} : réponse tardive gardée` };
  }
  if (await c.retouchee(derniere.numero, lundi)) {
    await c.garderReponsesLues(derniere.numero, reponses as ReponsesDimanche);
    return { quoi: `S${derniere.numero} pas réécrite : retouchée dans Nolio` };
  }
  await c.envoyer(suite.ecrite);
  await c.garderEcriture(suite.ecrite, suite.etat);
  return { quoi: `S${derniere.numero} réécrite` };
}

// ─── Le dimanche matin : le questionnaire ───────────────────────────────────────────────────────────

export async function poserLeQuestionnaireDuDimanche(c: ContextePlan, jour: string): Promise<Resultat> {
  const lundiASuivre = ajouterJours(jour, 1);
  const derniere = c.derniere && c.derniere.lundi === ajouterJours(jour, -6) ? c.derniere : null;
  // Ni une semaine écrite cette semaine, ni le dimanche d'avant la première : le plan n'est pas en route, rien à poser.
  if (!derniere && c.etat.ecrites.length) return null;
  if (derniere?.questionnaire?.nolio_id) return null; // posé une fois
  const trame = await lireLaTrame(c.ports, c.parametres);
  if (numeroDeLaSemaine(trame, lundiASuivre) === null) return null;
  const nolio = derniere ? await c.lireNolio(lundiASuivre, false) : null;
  const q = await preparerLeQuestionnaire(c.ports, { parametres: c.parametres, lundiASuivre, etat: c.etat, nolio, derniere: derniere?.semaine ?? null, coache: c.coache, trame });
  const nolioId = await c.poserLeQuiz(q.quiz, jour);
  if (derniere) await c.garderLeQuestionnaire(derniere.numero, { version: q.version, cles: q.cles, nolio_id: nolioId, pose_le: new Date().toISOString() });
  return { quoi: `questionnaire ${q.version} posé${nolioId ? '' : ' (sans identifiant)'}` };
}


// ─── Les paramètres du moteur, d'après le plan et la fiche ──────────────────────────────────────────

const CATEGORIES = ['jamais', 'parfois', 'regulier'] as const;
const categorie = (v: unknown) => ((CATEGORIES as readonly unknown[]).includes(v) ? (v as (typeof CATEGORIES)[number]) : undefined);

/**
 * Les `parametres` de POST /v1/semaine pour un plan (CONTRAT_API_CTS.md, « MOTEUR v1 ») : les réponses du questionnaire d'achat (`parametres.champs`),
 * les tests de l'athlète tels que Nolio les a, et, d'un coaché, ce que son coach a rempli sur sa fiche (les deux critères, sa côte en minutes, le tapis).
 * Un acheteur n'a pas de fiche : ses critères manquent (le moteur lit « jamais » et le dit), sa côte vient de l'ancien terrain (la tranche).
 * `entree` : le lundi où un coaché entre (la première semaine de son plan) ; `course_precedente` n'est pas donnée (à brancher avec l'objectif mineur).
 */
export function parametresDuPlanV9({ parametres, profil, coache, accordLecture, premierLundi, glucides = null }: {
  parametres: Record<string, unknown>; profil: Record<string, number | null | undefined>; coache: boolean; accordLecture: boolean;
  premierLundi: string | null; glucides?: number | [number, number] | null;
}, fiche: Record<string, string | string[]> | null): Record<string, unknown> {
  const champs = (parametres.champs ?? {}) as Record<string, unknown>;
  const tests = Object.fromEntries(['vc_ms', 'fc_seuil1', 'fc_seuil2'].flatMap((k) => (typeof profil[k] === 'number' && (profil[k] as number) > 0 ? [[k, profil[k]]] : [])));
  const unTexte = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return parametresV9({ ...champs, ...tests }, {
    criteres: { intensite: categorie(fiche?.critere_intensite), mecanique: categorie(fiche?.critere_denivele) },
    cote_min: unTexte(fiche?.cote_min), tapis: fiche?.tapis === 'oui' ? 'oui' : fiche?.tapis === 'non' ? 'non' : undefined,
    coaching: coache, entree: coache ? premierLundi : null, glucides, accord_lecture: accordLecture,
  });
}
