// Le cookie qui retient, sur un appareil, le plan que l'athlète a choisi d'afficher quand son compte
// en a plusieurs (« Tes plans », page Compte ; décision coach du 07/10/2026). Lu par contexte.ts,
// posé par actionsPlan.ts et par la page de retour du paiement (le plan qui vient d'être acheté).
export const COOKIE_PLAN = 'cts_plan';
// 13 mois (A-42, audits du 05/11/2026 : la durée que recommande la CNIL), plus 400 jours.
export const DUREE_COOKIE_PLAN = 395 * 24 * 60 * 60;
