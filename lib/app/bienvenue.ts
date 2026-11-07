// Le cookie qui retient, sur un appareil, que l'écran de bienvenue a été lu (actionsBienvenue.ts).
export const COOKIE_BIENVENUE = 'cts_bienvenue';
// Celui qui retient, sur un appareil, les plans où « Pour bien démarrer » est masquée (components/app/PourBienDemarrer.tsx ;
// C12, audits du 05/11/2026 : par plan). Un nouveau nom : l'ancien cookie (« 1 », tous les plans) ne masque plus rien.
export const COOKIE_DEMARRAGE = 'cts_demarrage_plans';
// L'ancien, effacé par ?reinitialiser=1 de la démonstration (proxy.ts).
export const COOKIE_DEMARRAGE_ANCIEN = 'cts_demarrage';
// Celui qui retient, sur un appareil, les plans où « Installe l'appli Nolio et relie ta montre » est cochée d'un appui
// (décision coach du 07/11/2026 ; components/app/PourBienDemarrer.tsx).
export const COOKIE_MONTRE = 'cts_montre_plans';
export const plansMasques = (valeur: string | undefined) => (valeur ?? '').split('.').filter((x) => /^[A-Za-z0-9-]{1,64}$/.test(x));
export const demarrageMasque = (valeur: string | undefined, planId: string) => plansMasques(valeur).includes(planId);
export const montreCochee = (valeur: string | undefined, planId: string) => plansMasques(valeur).includes(planId);
