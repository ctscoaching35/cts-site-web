// Sans import, et lu par personne : PRÉPARÉ, PAS BRANCHÉ.
/**
 * CE QUE LA CONSIGNE APP DU 21/11/2026 CLASSE « APRÈS LE MOTEUR » (mises à jour du 22/11 soir et du 23/11), préparé en données pour
 * le jour où le nouveau moteur est en ligne. Rien ici n'est importé : ni la récupération du plan (lib/plan.ts, joursRecuperation), ni le
 * profil d'entraînement (lib/app/accentFond.ts) ne les lisent encore. Les brancher, c'est remplacer l'ancienne donnée par celle-ci au
 * même endroit, puis retirer l'ancienne ; en cas de doute sur la forme, c'est le contrat (CONTRAT_API_CTS.md, « MOTEUR v1 ») qui fait
 * foi, pas ce fichier. Les textes sont ceux de la consigne (mots du coach).
 *
 * LE QUESTIONNAIRE DU DIMANCHE n'est plus ici : le contrat du moteur 9.0 (23/11/2026) et le rapport Nolio du même jour l'ont fixé, il
 * est dans lib/app/dimancheV9.ts (aussi préparé, pas branché).
 */

// ─── La récupération en semaines (décision 122, 23/11/2026) ─────────────────────────────────────────
// Elle remplace `joursRecuperation` (lib/plan.ts, des jours de 3 à 21) : 1 semaine sous 3 h de course, 2 de 3 h à 10 h et le marathon
// sur route, 3 au-delà. Le lundi de reprise s'en déduit, il se calcule côté moteur (la récupération est un gabarit de `/v1/semaine`,
// contrat 9.0). Bornes à confirmer : 3 h et 10 h comptent dans « de 3 h à 10 h ».
export function semainesRecuperation(heures: number, format?: string): 1 | 2 | 3 {
  if (format === 'R42') return 2;
  if (heures < 3) return 1;
  return heures <= 10 ? 2 : 3;
}

// ─── La saison de fond : la question du point faible (décisions 141 et 144) ────────────────────────
// « Ce qui te coûte le plus » (montées, descentes, technique, fin de course : lib/app/accentFond.ts) devient une seule question à deux
// réponses (`aisance`, « montee » ou « descente », dans `parametres` du contrat 9.0) ; sans réponse, la saison alterne.
export const QUESTION_A_L_AISE = 'Te sens-tu moins à l’aise en montée ou en descente ?';
export const REPONSES_A_L_AISE = [['montee', 'En montée'], ['descente', 'En descente']] as const;

// Pour l'acheteur d'un plan, une phrase au lancement (BROUILLON : la consigne dit le fond, pas les mots) : son plan s'adapte à ce qu'il
// répond chaque dimanche ; sans réponse, il suit sa route.
export const PHRASE_ACHETEUR_DIMANCHE = 'Ton plan s’adapte à ce que tu réponds chaque dimanche ; sans réponse, il suit sa route.';
