// Fonctions pures, sans réseau ni base : la réponse à « Séance tenue ? » d'une séance faite (scripts/test-seance-tenue.mjs).
/**
 * SÉANCE TENUE (décision 262 du coach, 26/11/2026) : une question de débrief Nolio après chaque séance, réglée par le coach dans Nolio, « Séance tenue ? (une récup raccourcie compte comme
 * entièrement) » : « Entièrement » / « Partiellement » / « Pas du tout » ; pas de réponse vaut « Entièrement ». Partiellement ou pas du tout : un écart. Nolio rend les réponses dans
 * `debrief.questions` de l'activité (avec l'accord de lecture, comme le RPE). Le moteur 9.1 lit `tenue` sur chaque séance (CONTRAT_API_CTS.md) ; le 9.0 ignore ce champ.
 *
 * PAS AVANT L'ESSAI (262 : « le coach ajoute la question dans Nolio, l'essai, puis la question du dimanche part ») : tant que `CTS_SEANCE_TENUE` n'est pas « oui » (Vercel), la réponse ne se lit que
 * sur le compte du coach, « (toi) », où l'essai se fait : rien ne compte sur un coaché ni un acheteur.
 */
import { normaliser } from './questionnaireSamedi';

export type Tenue = 'entierement' | 'partiellement' | 'pas_du_tout';
export type QuestionDeDebrief = { question?: string | null; value?: unknown; choices?: unknown };

export const seanceTenueActive = (env: Record<string, string | undefined> = process.env) => env.CTS_SEANCE_TENUE?.trim().toLowerCase() === 'oui';

const sansAccents = (t: unknown) => normaliser(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const REPONSES: Record<string, Tenue> = { entierement: 'entierement', partiellement: 'partiellement', 'pas du tout': 'pas_du_tout' };
const CHOIX = ['Entièrement', 'Partiellement', 'Pas du tout'];

// Les choix de la question, dans la forme que Nolio rend (une liste, ou { choices: [...] }) ; à défaut, ceux de la question du coach.
function choixDe(choices: unknown): string[] {
  const liste = Array.isArray(choices) ? choices : (choices as { choices?: unknown } | null)?.choices;
  return Array.isArray(liste) && liste.every((x) => typeof x === 'string') ? (liste as string[]) : CHOIX;
}

// La réponse : le libellé, ou son rang dans les choix, seul ou dans une liste d'un seul.
function reponse(value: unknown, choices: unknown): Tenue | null {
  if (Array.isArray(value)) return value.length === 1 ? reponse(value[0], choices) : null;
  const libelle = typeof value === 'number' && Number.isInteger(value) ? choixDe(choices)[value] : value;
  return typeof libelle === 'string' ? REPONSES[sansAccents(libelle)] ?? null : null;
}

// Ce que l'athlète a répondu à « Séance tenue ? » ; null sans la question ou sans réponse lisible (le moteur prend « entièrement »).
export function tenueDeLaSeance(questions: QuestionDeDebrief[] | null | undefined): Tenue | null {
  const q = (questions ?? []).find((x) => sansAccents(x.question).startsWith('seance tenue'));
  return q ? reponse(q.value, q.choices) : null;
}
