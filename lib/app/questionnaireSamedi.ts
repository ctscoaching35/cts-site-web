/**
 * Le questionnaire du samedi dans Nolio, « Ta semaine prochaine » (décision coach du 19/10/2026, question 13) : ses
 * questions, la lecture d'une réponse et le choix de la réponse qui sert à la semaine (S11). Des fonctions pures, sans
 * Nolio ni base, lues par lib/app/ecriture.ts (le passage du dimanche, l'aperçu) et lib/app/dimanchesCoaches.ts (la pose
 * du questionnaire) ; sondées à part.
 */
import { ajouterJours } from './plan';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LIBELLES = JOURS.map((j) => j[0].toUpperCase() + j.slice(1));

export type Questionnaire = { jours: string[]; jour_sl: string | null; nb_seances: number | null };

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
    { question: 'Quels jours peux-tu courir la semaine prochaine ?', type: 'multiple_choices', is_mandatory: true,
      choices: { choices: LIBELLES } },
    { question: 'Quel jour pour ta sortie longue ?', type: 'unique_choice', is_mandatory: true, choices: { choices: LIBELLES } },
    { question: 'Combien de séances veux-tu faire ?', type: 'number', is_mandatory: true, unit: 'séances' },
  ],
};

// Une réponse du questionnaire du samedi, lue dans Nolio (une réponse de la semaine, samedi ou dimanche).
export function lireQuestionnaire(items: { question: string; value: unknown }[]): Questionnaire | undefined {
  const reponse = (n: number) => items.find((i) => i.question === QUESTIONNAIRE_SEMAINE.items[n].question)?.value;
  const jours = reponse(0);
  if (!Array.isArray(jours)) return undefined;
  // Nolio rend un choix par son rang, de 0 (lundi) à 6 (dimanche) — vu le 25/10/2026 sur le compte du coach : [1, 3, 6]
  // pour mardi, jeudi, dimanche ; jusque-là les jours cochés se perdaient et le moteur reprenait ceux du profil. Un nom
  // reste lu.
  const jour = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < JOURS.length ? JOURS[v]
    : typeof v === 'string' && JOURS.includes(v.toLowerCase()) ? v.toLowerCase() : null);
  const nb = Number(reponse(2));
  return { jours: jours.map(jour).filter((x): x is string => Boolean(x)), jour_sl: jour(reponse(1)),
    nb_seances: Number.isFinite(nb) && nb > 0 ? Math.round(nb) : null };
}

// LES JOURS DE LA DERNIÈRE RÉPONSE (S11, décision coach du 05/11/2026, « A » ; audits A-18 et D8) : la réponse de la
// semaine (6 jours avant le dimanche du passage, au plus) sert entière ; sans elle, la dernière des 8 semaines d'avant,
// plus récente que la déclaration de l'objectif (declaree_le : l'achat, ou le départ recalé), donne ses jours et son
// jour de sortie longue seulement. Son nombre de séances n'est pas repris : il ne vaut que pour sa semaine (la séance en
// plus, R7, ne doit pas se compter sur une réponse d'il y a trois semaines). Sans réponse lisible, rien : le moteur
// reprend les jours de l'achat. Pure : sondée à part.
export const JOURS_DERNIERE_REPONSE = 56;
export function questionnaireDeLaSemaine(resultats: { name?: string; date_start: string; items: { question: string; value: unknown }[] }[],
  au: string, declareeLe = ''): { questionnaire: Questionnaire; du: string } | null {
  const lus = resultats.filter((r) => r.name === QUESTIONNAIRE_SEMAINE.name)
    .map((r) => ({ du: r.date_start.slice(0, 10), q: lireQuestionnaire(r.items) }))
    .filter((r): r is { du: string; q: Questionnaire } => Boolean(r.q))
    .sort((a, b) => b.du.localeCompare(a.du));
  // La réponse de la semaine, telle qu'elle est lue (comme avant le 05/11/2026).
  const semaine = lus.find((r) => r.du >= ajouterJours(au, -6));
  if (semaine) return { questionnaire: semaine.q, du: semaine.du };
  const dernier = lus.find((r) => r.q.jours.length > 0);
  if (!dernier || (declareeLe && dernier.du < declareeLe.slice(0, 10))) return null;
  return { questionnaire: { jours: dernier.q.jours, jour_sl: dernier.q.jour_sl, nb_seances: null }, du: dernier.du };
}
