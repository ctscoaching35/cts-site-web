/**
 * Le questionnaire du samedi dans Nolio, « Ta semaine prochaine » (décision coach du 19/10/2026, question 13) : ses
 * questions, la lecture d'une réponse et le choix de la réponse qui sert à la semaine (S11). Des fonctions pures, sans
 * Nolio ni base, lues par lib/app/ecriture.ts (le passage du dimanche, la passe du lundi, l'aperçu) et
 * lib/app/dimanchesCoaches.ts (la pose du questionnaire) ; sondées à part (scripts/test-reponse-samedi.mjs).
 *
 * LA LECTURE ROBUSTE (lot 0 du 16/11/2026, point 1 de la consigne App ; la réponse du samedi se perdait en amont du moteur) :
 * - CHAQUE QUESTION À PART : un champ illisible est `null`, les deux autres restent ; le moteur complète par la dernière
 *   réponse lue et le dit (moteur 8.466) ;
 * - TOUS LES FORMATS : les jours en rangs (de 0, lundi, à 6), en libellés (complets ou abrégés) ou en une chaîne
 *   « 1,3,6 » ; le jour de sortie longue en rang, en `[rang]` ou en libellé ; le nombre en nombre, « 4 » ou « 4 séances » ;
 * - LE QUESTIONNAIRE ET SES QUESTIONS SANS LE TEXTE EXACT : par l'identifiant que le site a posé (`quiz_planned`, gardé dans
 *   nolio_envois), puis par le nom, puis par les textes des questions comparés après normalisation (NFC, espaces, « ? »),
 *   puis, pour une question, par sa place. Le texte de la question du jour de sortie longue a changé (décision du coach du
 *   16/11/2026) : l'ancien et le nouveau se lisent ;
 * - DEUX RÉPONSES LA MÊME SEMAINE : la plus récente, par sa date et son heure (puis son identifiant) ;
 * - L'ÉTAT DE LA LECTURE, dit au moteur (`questionnaire_etat`) et au coach : « lue », « partielle » (au moins un champ lu et
 *   au moins un illisible : les champs lus partent, les autres à `null` ; moteur 8.468, décision du 16/11/2026), « absente »,
 *   « illisible » (AUCUN champ lu), « echec » (la lecture de Nolio a échoué : posé par lib/app/ecriture.ts, pas ici).
 */
import { ajouterJours } from './plan';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LIBELLES = JOURS.map((j) => j[0].toUpperCase() + j.slice(1));

// Un jour de la réponse est `null` quand il ne se lit pas (voir l'en-tête).
export type Questionnaire = { jours: string[] | null; jour_sl: string | null; nb_seances: number | null };
export type Champ = 'jours' | 'jour_sl' | 'nb_seances';
export type EtatLecture = 'lue' | 'partielle' | 'absente' | 'illisible' | 'echec';

export const QUESTION_JOURS = 'Quels jours peux-tu courir la semaine prochaine ?';
// Texte validé par le coach le 16/11/2026 (le moteur ajoute toujours aux jours un jour de sortie longue non coché, et le dit ;
// la question l'évite) ; l'ancien reste lu, pour les réponses déjà dans Nolio.
export const QUESTION_SL = 'Quel jour pour ta sortie longue (parmi les jours cochés) ?';
export const QUESTION_SL_AVANT = 'Quel jour pour ta sortie longue ?';
export const QUESTION_NB = 'Combien de séances veux-tu faire ?';

// Le questionnaire du samedi (décision coach du 19/10/2026, question 13 ; le samedi depuis le 24/10/2026, pour laisser
// le week-end), lu par le passage du dimanche soir : trois questions courtes. Sans `order` :
// Nolio le compte à partir de 0 et le déduit de la place dans la liste (refus du 19/10/2026, essai sur « (toi) »).
// S1 (décision coach du 05/11/2026, audits D1 et J8) : la question « As-tu dû arrêter de courir cette semaine (blessure,
// maladie) ? » est retirée. Un « oui » comptait 8 jours d'arrêt sans rien alléger ni orienter, et la réponse était une
// donnée de santé lue sans accord. Le questionnaire se pose une semaine à la fois (lib/app/dimanchesCoaches.ts) : celui
// déjà posé pour le samedi qui vient la garde une dernière fois, sa réponse n'est plus lue ici, et le moteur l'ignore si
// elle lui arrive encore ; dès le suivant, plus de question. Un arrêt se lit toujours dans Nolio (sept jours sans séance
// faite, R4). La question ouverte des coachés (« Une information à remonter à ton coach ? ») reste.
export const QUESTIONNAIRE_SEMAINE = {
  name: 'Ta semaine prochaine',
  description: 'Une minute, d’ici dimanche 18 h : tes séances de la semaine prochaine s’écrivent dimanche soir à partir de tes réponses.',
  items: [
    { question: QUESTION_JOURS, type: 'multiple_choices', is_mandatory: true, choices: { choices: LIBELLES } },
    { question: QUESTION_SL, type: 'unique_choice', is_mandatory: true, choices: { choices: LIBELLES } },
    { question: QUESTION_NB, type: 'number', is_mandatory: true, unit: 'séances' },
  ],
};

// ─── La normalisation ─────────────────────────────────────────────────────

// Un texte comparable : NFC, minuscules, espaces repliés, sans « ? ».
export const normaliser = (t: unknown) => String(t ?? '').normalize('NFC').toLowerCase().replace(/[?？]/g, ' ').replace(/\s+/g, ' ').trim();
// Pour un libellé de jour : sans accents non plus.
const sansAccents = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const TEXTES: Record<Champ, Set<string>> = {
  jours: new Set([normaliser(QUESTION_JOURS)]),
  jour_sl: new Set([normaliser(QUESTION_SL), normaliser(QUESTION_SL_AVANT)]),
  nb_seances: new Set([normaliser(QUESTION_NB)]),
};
const CHAMPS: Champ[] = ['jours', 'jour_sl', 'nb_seances'];
const NOM = normaliser(QUESTIONNAIRE_SEMAINE.name);

// ─── Les valeurs ──────────────────────────────────────────────────────────

// Un jour : un rang (de 0, lundi, à 6, dimanche — vu le 25/10/2026 sur le compte du coach : [1, 3, 6] pour mardi, jeudi,
// dimanche), son libellé, complet ou abrégé (« mar », « jeu. »), ou le rang écrit.
function unJour(v: unknown): string | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v < JOURS.length ? JOURS[v] : null;
  if (typeof v !== 'string') return null;
  const t = sansAccents(normaliser(v)).replace(/\.$/, '');
  if (/^\d+$/.test(t)) return JOURS[Number(t)] ?? null;
  return t.length >= 3 ? JOURS.find((j) => j.startsWith(t)) ?? null : null;
}

// Des jours : une liste (de rangs, de libellés) ou une chaîne (« 1,3,6 », « Mardi, jeudi et samedi », « [1, 3, 6] »). Un
// élément illisible, ou aucun jour : null (un jour perdu changerait la semaine ; le moteur reprend alors les derniers).
export function lireJours(v: unknown): string[] | null {
  let elements: unknown[];
  if (Array.isArray(v)) elements = v.flat();
  else if (typeof v === 'number') elements = [v];
  else if (typeof v === 'string') elements = v.replace(/[[\]"']/g, ' ').split(/[,;/]|\s+et\s+|\s+/).filter((x) => x.trim() !== '');
  else return null;
  if (!elements.length) return null;
  const jours = elements.map(unJour);
  if (jours.some((j) => j === null)) return null;
  return [...new Set(jours as string[])].sort((a, b) => JOURS.indexOf(a) - JOURS.indexOf(b));
}

// Le jour de la sortie longue : un rang, `[rang]` ou son libellé ; plusieurs jours : illisible.
export function lireJourSl(v: unknown): string | null {
  const jours = lireJours(v);
  return jours && jours.length === 1 ? jours[0] : null;
}

// Le nombre de séances : un nombre, « 4 », « 4 séances », `[4]` ; au moins une séance.
export function lireNombre(v: unknown): number | null {
  if (Array.isArray(v)) return v.length === 1 ? lireNombre(v[0]) : null;
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    const m = /-?\d+(?:[.,]\d+)?/.exec(v);
    n = m ? Number(m[0].replace(',', '.')) : NaN;
  } else return null;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// ─── Une réponse ──────────────────────────────────────────────────────────

export type ItemNolio = { question?: string; order?: number | null; item_type?: string; value: unknown };
export type ResultatNolio = {
  id?: string; name?: string; date_start: string; hour_start?: string | null; is_confirmed?: boolean; quiz_planned?: string;
  items?: ItemNolio[];
};

// Une réponse du questionnaire du samedi : par l'identifiant du questionnaire que le site a posé, puis par son nom, puis par
// les textes de ses questions (comparés après normalisation).
export function estLeQuestionnaire(r: ResultatNolio, idsPoses: ReadonlySet<string> = new Set()): boolean {
  if (r.quiz_planned && idsPoses.has(String(r.quiz_planned))) return true;
  if (normaliser(r.name) === NOM) return true;
  return (r.items ?? []).some((i) => CHAMPS.some((c) => TEXTES[c].has(normaliser(i.question))));
}

// La valeur d'une question : par son texte (l'ancien ou le nouveau), sinon par sa place (la nième des questions, dans l'ordre
// de Nolio) quand cette place ne porte pas le texte d'une autre question.
function valeurDe(items: ItemNolio[], champ: Champ): { trouvee: boolean; value: unknown } {
  const parTexte = items.find((i) => TEXTES[champ].has(normaliser(i.question)));
  if (parTexte) return { trouvee: true, value: parTexte.value };
  const rangees = items.some((i) => typeof i.order === 'number')
    ? [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : items;
  const place = rangees[CHAMPS.indexOf(champ)];
  const autre = place && CHAMPS.some((c) => c !== champ && TEXTES[c].has(normaliser(place.question)));
  return place && !autre ? { trouvee: true, value: place.value } : { trouvee: false, value: undefined };
}

// Chaque question à part : le questionnaire lu (null par champ illisible) et les champs en cause.
export function lireQuestionnaire(items: ItemNolio[]): { questionnaire: Questionnaire; illisibles: Champ[] } {
  const jours = valeurDe(items, 'jours');
  const sl = valeurDe(items, 'jour_sl');
  const nb = valeurDe(items, 'nb_seances');
  const questionnaire: Questionnaire = { jours: lireJours(jours.value), jour_sl: lireJourSl(sl.value), nb_seances: lireNombre(nb.value) };
  return { questionnaire, illisibles: CHAMPS.filter((c) => questionnaire[c] === null) };
}

// La plus récente d'abord : sa date et son heure, puis son identifiant.
const quand = (r: ResultatNolio) => `${r.date_start.slice(0, 10)} ${(r.hour_start ?? r.date_start.slice(11)) || '00:00:00'}`;
export const plusRecenteD = (a: ResultatNolio, b: ResultatNolio) => quand(b).localeCompare(quand(a)) || String(b.id ?? '').localeCompare(String(a.id ?? ''));

// ─── La réponse qui sert à la semaine ─────────────────────────────────────

// LES JOURS DE LA DERNIÈRE RÉPONSE (S11, décision coach du 05/11/2026, « A » ; audits A-18 et D8) : la réponse de la semaine (6
// jours avant le dimanche du passage, au plus) sert ; sans elle, la dernière des 8 semaines d'avant, plus récente que la
// déclaration de l'objectif (declaree_le : l'achat, ou le départ recalé), donne ses jours, son jour de sortie longue ET, depuis
// le lot 0 du 16/11/2026, son nombre de séances et sa date (le moteur prend la plus récente de la sienne et de celle-ci).
export const JOURS_DERNIERE_REPONSE = 56;

// cause : « ancienne » (sans réponse cette semaine, c'est celle d'une semaine d'avant) ou « non_envoyee » (une réponse de la
// semaine ouverte dans Nolio, jamais envoyée).
export type ReponseLue = {
  etat: EtatLecture; questionnaire?: Questionnaire; du?: string; id?: string; cause?: 'ancienne' | 'non_envoyee';
  illisibles?: Champ[]; erreur?: string;
};

export function reponseDuSamedi(resultats: ResultatNolio[], au: string, declareeLe = '', idsPoses: ReadonlySet<string> = new Set()): ReponseLue {
  const reconnus = resultats.filter((r) => estLeQuestionnaire(r, idsPoses));
  const envoyees = reconnus.filter((r) => r.is_confirmed !== false).sort(plusRecenteD);
  const debut = ajouterJours(au, -6);
  const semaine = envoyees.find((r) => r.date_start.slice(0, 10) >= debut);
  if (semaine) {
    const { questionnaire, illisibles } = lireQuestionnaire(semaine.items ?? []);
    const etat: EtatLecture = !illisibles.length ? 'lue' : illisibles.length === CHAMPS.length ? 'illisible' : 'partielle';
    return { etat, questionnaire, du: semaine.date_start.slice(0, 10), id: semaine.id,
      ...(illisibles.length ? { illisibles } : {}) };
  }
  const nonEnvoyee = reconnus.some((r) => r.is_confirmed === false && r.date_start.slice(0, 10) >= debut);
  // Sans réponse de la semaine : la dernière, jours, sortie longue et nombre de séances.
  for (const r of envoyees) {
    const { questionnaire } = lireQuestionnaire(r.items ?? []);
    if (!questionnaire.jours) continue;
    if (declareeLe && r.date_start.slice(0, 10) < declareeLe.slice(0, 10)) break;
    return { etat: 'absente', questionnaire, du: r.date_start.slice(0, 10), id: r.id, cause: nonEnvoyee ? 'non_envoyee' : 'ancienne' };
  }
  return { etat: 'absente', ...(nonEnvoyee ? { cause: 'non_envoyee' as const } : {}) };
}

// ─── « Ses jours » ────────────────────────────────────────────────────────

// La dernière réponse lue de l'athlète, gardée par le site (lot 0, point 2) : ses jours, son jour de sortie longue, son
// nombre de séances et la date de la réponse. Mise à jour à chaque réponse lue ; un champ qui manque garde le dernier lu.
export type SesJours = { jours: string[] | null; jour_sl: string | null; nb_seances: number | null; du: string };
export function sesJoursApres(avant: SesJours | null | undefined, lecture: Pick<ReponseLue, 'etat' | 'questionnaire' | 'du' | 'cause'>): SesJours | null {
  // Seulement la réponse de la semaine, lue en tout ou en partie : jamais un repli sur une réponse plus ancienne.
  if (!lecture.questionnaire || !lecture.du || lecture.cause === 'ancienne' || (lecture.etat !== 'lue' && lecture.etat !== 'partielle' && lecture.etat !== 'illisible')) return avant ?? null;
  if (avant && avant.du > lecture.du) return avant;
  const q = lecture.questionnaire;
  const garde = avant ?? { jours: null, jour_sl: null, nb_seances: null, du: lecture.du };
  const suite: SesJours = { jours: q.jours ?? garde.jours, jour_sl: q.jour_sl ?? garde.jour_sl, nb_seances: q.nb_seances ?? garde.nb_seances, du: lecture.du };
  return suite.jours || suite.jour_sl || suite.nb_seances ? suite : avant ?? null;
}
// Sans réponse lisible dans Nolio, « ses jours » gardés servent de dernière réponse (jamais plus ancienne que la déclaration
// de l'objectif).
export function reponseDepuisSesJours(s: SesJours | null | undefined, declareeLe = ''): ReponseLue | null {
  if (!s?.jours || (declareeLe && s.du < declareeLe.slice(0, 10))) return null;
  return { etat: 'absente', questionnaire: { jours: s.jours, jour_sl: s.jour_sl, nb_seances: s.nb_seances }, du: s.du, cause: 'ancienne' };
}

// « mar, jeu, sam, dim ; sortie longue dim ; 4 séances — réponse du 14/11 » (l'espace coach).
const COURT = (j: string) => j.slice(0, 3);
export function sesJoursEnClair(s: SesJours): string {
  const jm = `${s.du.slice(8, 10)}/${s.du.slice(5, 7)}`;
  const morceaux = [s.jours?.length ? s.jours.map(COURT).join(', ') : null, s.jour_sl ? `sortie longue ${COURT(s.jour_sl)}` : null,
    s.nb_seances ? `${s.nb_seances} séance${s.nb_seances > 1 ? 's' : ''}` : null].filter(Boolean);
  return `${morceaux.join(' ; ') || 'rien de lisible'} — réponse du ${jm}`;
}
