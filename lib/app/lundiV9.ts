// Fonctions pures, sans réseau ni base : PRÉPARÉ, PAS BRANCHÉ pour la décision (rien ne la lit encore ; scripts/test-lundi-v9.mjs). Les heures
// des passages, elles, sont celles de vercel.json (le test les compare).
/**
 * LES PASSAGES DU LUNDI SOUS LE MOTEUR 9.0 (décisions du coach du 24/11/2026, entrée 191, point 3 et « point site relevé ») : les lectures
 * des réponses s'arrêtaient lundi 5 h UTC ; une réponse donnée lundi avant la première séance de la semaine doit être lue et réécrire la
 * semaine. La passe du lundi (`/api/ecriture/lundi`) passe donc toutes les deux heures, de 5 h à 21 h UTC (23 h à Paris l'hiver).
 *
 *   - une réponse nouvelle, aucune séance de la semaine faite : la semaine se réécrit, `POST /v1/semaine` avec `nolio` et `reponses` ;
 *   - une réponse nouvelle, une séance déjà faite : `POST /v1/reponse-tardive`, qui ne garde que l'arrêt et les séances clés pas faites
 *     (le reste, dont le « oui » à la semaine plus légère, attend le questionnaire suivant) ;
 *   - rien de nouveau, ou Nolio illisible : rien ; le passage de deux heures plus tard reprend.
 */

export const HEURES_DES_PASSAGES_DU_LUNDI = [5, 7, 9, 11, 13, 15, 17, 19, 21];

export type ActionDuLundi = 'rien' | 'reecrire' | 'reponse_tardive';

// Ce que Nolio montre de la semaine écrite, comme l'entrée `nolio` du moteur 9.0 (lib/app/moteurV9.ts) : seul ce que la décision lit.
export type SemaineEnCours = { seances: { faite: boolean | null; duree_faite_min: number | null }[]; activites_vues: number };

// Une séance de la semaine est faite : l'athlète l'a faite ou une activité est montrée cette semaine-là, reliée ou non (au doute, la
// semaine déjà commencée n'est pas réécrite : elle ne se refait pas sous ses pieds).
export const uneSeanceEstFaite = (s: SemaineEnCours): boolean =>
  s.activites_vues > 0 || s.seances.some((x) => x.faite === true || (x.duree_faite_min ?? 0) > 0);

/**
 * L'action du passage. reponseNouvelle : une réponse arrivée depuis la dernière lecture (la signature des réponses vues a changé) ;
 * semaine : ce que Nolio montre de la semaine écrite, ou null s'il n'a pas pu se lire (jamais de réécriture sur une lecture manquée).
 */
export function actionDuLundi({ reponseNouvelle, semaine }: { reponseNouvelle: boolean; semaine: SemaineEnCours | null }): ActionDuLundi {
  if (!reponseNouvelle || semaine === null) return 'rien';
  return uneSeanceEstFaite(semaine) ? 'reponse_tardive' : 'reecrire';
}
