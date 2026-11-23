// Sans import, et lu par personne : PRÉPARÉ, PAS BRANCHÉ.
/**
 * CE QUE LA CONSIGNE APP DU 21/11/2026 CLASSE « APRÈS LE MOTEUR » (mises à jour du 22/11 soir et du 23/11), préparé en données pour
 * le jour où le nouveau moteur est en ligne et que son contrat d'API est connu. Rien ici n'est importé : ni le questionnaire du
 * dimanche dans Nolio (lib/app/questionnaireSamedi.ts, dimanchesCoaches.ts), ni la récupération du plan (lib/plan.ts,
 * joursRecuperation), ni le profil d'entraînement (lib/app/accentFond.ts) ne les lisent encore. Les brancher, c'est remplacer
 * l'ancienne donnée par celle-ci au même endroit, puis retirer l'ancienne ; en cas de doute sur la forme, c'est le contrat qui
 * fait foi, pas ce fichier. Les textes sont ceux de la consigne (mots du coach) ; les clés et les conditions sont PROVISOIRES.
 */

// ─── La récupération en semaines (décision 122, 23/11/2026) ─────────────────────────────────────────
// Elle remplace `joursRecuperation` (lib/plan.ts, des jours de 3 à 21) : 1 semaine sous 3 h de course, 2 de 3 h à 10 h et le marathon
// sur route, 3 au-delà. Le lundi de reprise s'en déduit, il se calcule côté moteur. Bornes à confirmer : 3 h et 10 h comptent dans « de
// 3 h à 10 h ».
export function semainesRecuperation(heures: number, format?: string): 1 | 2 | 3 {
  if (format === 'R42') return 2;
  if (heures < 3) return 1;
  return heures <= 10 ? 2 : 3;
}

// ─── La saison de fond : la question du point faible (décisions 141 et 144) ────────────────────────
// « Ce qui te coûte le plus » (montées, descentes, technique, fin de course : lib/app/accentFond.ts) devient une seule question à deux
// réponses ; sans réponse, la saison alterne.
export const QUESTION_A_L_AISE = 'Te sens-tu moins à l’aise en montée ou en descente ?';
export const REPONSES_A_L_AISE = [['montee', 'En montée'], ['descente', 'En descente']] as const;

// ─── Le questionnaire du dimanche dans Nolio (mise à jour du 22/11 soir, entrées 88 à 116) ─────────
// Trois versions, choisies par le moteur athlète par athlète : normale, « aucune séance vue », « fatigue ». Chaque version ajoute son
// mot d'ouverture aux questions communes. Le moteur donne la ligne d'effet de la version « fatigue » (null ici).
export type VersionDimanche = 'normale' | 'aucune_seance' | 'fatigue';
export const OUVERTURES_DIMANCHE: Record<VersionDimanche, { texte: string | null; ligneEffet: string | null }> = {
  normale: { texte: null, ligneEffet: null },
  aucune_seance: {
    texte: 'On n’a vu aucune séance cette semaine. Si tu as couru sans montre, réponds « Non ». Si tu as arrêté de courir, dis-le-nous : depuis combien de temps et pourquoi.',
    ligneEffet: null,
  },
  fatigue: {
    texte: 'Cette semaine, ton ressenti, ton RPE ou ton Hooper sortent de tes habitudes. Veux-tu une semaine plus légère ?',
    ligneEffet: null,
  },
};

export type QuestionDimanche = {
  cle: string;
  question: string;
  type: 'unique_choice' | 'multiple_choices' | 'number';
  choix?: string[];
  // Posée seulement si la réponse à `cle` n'est pas l'une de `sauf` (CONDITION À VÉRIFIER dans Nolio : questions conditionnelles).
  condition?: { cle: string; sauf: string[] };
};

// Les quatre premières questions sont celles de la consigne, mot pour mot ; les trois dernières (la semaine prochaine : ses jours, le
// nombre de séances au plus, le jour de la sortie longue parmi les sept jours) gardent le fond de la consigne et la forme des
// questions d'aujourd'hui (lib/app/questionnaireSamedi.ts) : leur rédaction est un BROUILLON, à faire valider par le coach.
const SEPT_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const QUESTIONS_DIMANCHE: QuestionDimanche[] = [
  { cle: 'arret', question: 'As-tu arrêté de courir cette semaine ?', type: 'unique_choice', choix: ['Non', 'Quelques jours', 'Oui, toute la semaine'] },
  { cle: 'arret_semaines', question: 'Depuis combien de semaines as-tu arrêté, en tout ?', type: 'unique_choice', choix: ['1', '2', '3', '4', 'Plus de 4'],
    condition: { cle: 'arret', sauf: ['Non'] } },
  { cle: 'arret_pourquoi', question: 'Pourquoi ?', type: 'unique_choice', choix: ['Blessure', 'Maladie', 'Autre'], condition: { cle: 'arret', sauf: ['Non'] } },
  { cle: 'seance_cle', question: 'Une séance clé pas faite comme écrite ?', type: 'multiple_choices',
    choix: ['Aucune', 'La 1re séance d’intensité', 'La 2e', 'La mécanique', 'La sortie longue'] },
  { cle: 'jours', question: 'Quels jours peux-tu courir la semaine prochaine ?', type: 'multiple_choices', choix: SEPT_JOURS },
  { cle: 'nb_seances', question: 'Combien de séances au plus ?', type: 'number' },
  { cle: 'jour_sl', question: 'Quel jour pour ta sortie longue ?', type: 'unique_choice', choix: SEPT_JOURS },
];
// Pour l'acheteur d'un plan, une phrase au lancement (BROUILLON : la consigne dit le fond, pas les mots) : son plan s'adapte à ce qu'il
// répond chaque dimanche ; sans réponse, il suit sa route.
export const PHRASE_ACHETEUR_DIMANCHE = 'Ton plan s’adapte à ce que tu réponds chaque dimanche ; sans réponse, il suit sa route.';
