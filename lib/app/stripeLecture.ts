/**
 * LES COACHINGS DANS « CHIFFRES » (l'espace par athlète, maquette validée par le coach le 08/11/2026) : Q11 « A », des
 * totaux par mois (encaissé, nombre de paiements), sans nom ; Q12 « A », lus avec une clé Stripe RESTREINTE, EN LECTURE
 * SEULE, que le coach crée dans son tableau de bord Stripe et colle dans Vercel (une par compte si les coachings et les
 * plans arrivent sur deux comptes : la décision du 07/10/2026 dit « un compte Stripe à part pour CTS », à vérifier par
 * lui sur un paiement de coaching). Lue côté serveur seulement, à l'ouverture de « Chiffres » ; jamais envoyée au navigateur.
 *
 * Aujourd'hui, la clé n'existe pas : rien n'est lu chez Stripe, « Chiffres » le dit. Le point d'entrée est ici, pour la
 * prochaine étape (après sa vérification dans Stripe : H1 paiements directs sur son compte relié à Nolio, H2 virements de
 * la plateforme Nolio ; inventaire du 08/11/2026, § 5.2), où se branchera la lecture des paiements et des remboursements.
 */

// Le nom de la variable dans Vercel (Settings › Environment Variables) : une clé restreinte « rk_live_… » en lecture seule
// (Paiements, Soldes, Remboursements, Sessions Checkout ; ni écriture ni clients).
export const VARIABLE_CLE_COACHINGS = 'STRIPE_CLE_LECTURE_COACHINGS';

// La clé, si elle est posée et a la forme d'une clé restreinte ; jamais une clé secrète (« sk_ »), qui écrirait.
function cleDeLecture(): string | null {
  const cle = process.env[VARIABLE_CLE_COACHINGS]?.trim();
  return cle && /^rk_(live|test)_/.test(cle) ? cle : null;
}

export type CoachingsDuMois = { mois: string; paiements: number; centimes: number };
// etat : « a_brancher » sans clé (aujourd'hui) ; « branchee » une fois la clé posée, la lecture restant à écrire à la
// prochaine étape (aucun appel à Stripe d'ici là).
export type LectureCoachings = { etat: 'a_brancher' | 'branchee'; mois: CoachingsDuMois[] };

export async function coachingsParMois(): Promise<LectureCoachings> {
  if (typeof window !== 'undefined') throw new Error('La clé Stripe ne sert que côté serveur');
  return { etat: cleDeLecture() ? 'branchee' : 'a_brancher', mois: [] };
}
