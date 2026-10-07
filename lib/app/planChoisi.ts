// Le cookie qui retient, sur un appareil, le plan que l'athlète a choisi d'afficher quand son compte
// en a plusieurs (« Tes plans », page Compte ; décision coach du 07/10/2026). Lu par contexte.ts,
// posé par actionsPlan.ts et par la page de retour du paiement (le plan qui vient d'être acheté).
export const COOKIE_PLAN = 'cts_plan';
export const DUREE_COOKIE_PLAN = 400 * 24 * 60 * 60;
