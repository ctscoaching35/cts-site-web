/**
 * L'APP GRATUITE (lot A1, « le socle du gratuit », maquette validée par le coach le 16/11/2026) : l'interrupteur et la
 * règle qui décide qui voit quoi. Pur : aucune lecture de session ni de cookie ici (lib/app/gratuit.ts et
 * lib/app/acces.ts les lisent), pour que les tests prouvent la règle sans réseau ni base.
 *
 * LES DEUX VARIABLES D'ENVIRONNEMENT (côté serveur, à créer chez Vercel ; jamais dans le dépôt) :
 *   APP_GRATUITE        coupe (par défaut, et pour toute autre valeur) | invitation | ouvert
 *   APP_GRATUITE_SECRET le mot du lien secret du mode « invitation » : /app?essai=<mot> pose un cookie (proxy.ts), puis
 *                       renvoie sur /app sans le mot. Changer le mot referme les liens donnés.
 *
 * - coupe : l'app est EXACTEMENT celle d'avant (aucun visiteur, aucun compte gratuit, aucune nouvelle adresse).
 * - invitation : l'app gratuite ne s'ouvre qu'à qui a le cookie du lien secret.
 * - ouvert : à tous.
 */

export type ModeAppGratuite = 'coupe' | 'invitation' | 'ouvert';

export const modeAppGratuite = (brut: string | undefined = process.env.APP_GRATUITE): ModeAppGratuite => {
  const v = (brut ?? '').trim().toLowerCase();
  return v === 'invitation' || v === 'ouvert' ? v : 'coupe';
};

export const COOKIE_ESSAI = 'cts_essai';
export const PARAMETRE_ESSAI = 'essai';

// Comparaison à temps constant ; un mot attendu vide n'ouvre rien.
const egal = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
};

export const essaiValide = (valeur: string | undefined | null, secret: string | undefined = process.env.APP_GRATUITE_SECRET) => {
  const attendu = (secret ?? '').trim();
  return attendu.length > 0 && typeof valeur === 'string' && egal(valeur, attendu);
};

// L'app gratuite est-elle ouverte pour qui porte (ou non) le cookie du lien secret ?
export const gratuitOuvertPour = (mode: ModeAppGratuite, cookieEssai: string | undefined | null, secret?: string) =>
  mode === 'ouvert' || (mode === 'invitation' && essaiValide(cookieEssai, secret));

// Les quatre cas d'une visite de l'app :
// - connexion : sans session, l'app n'est pas ouverte : la connexion de toujours ;
// - normal : tout ce qui existait (un acheteur, un coaché, le coach, ou un compte sans plan que l'app gratuite n'accueille pas) ;
// - visiteur : sans session, l'app gratuite est ouverte pour lui ;
// - gratuit : un compte connecté, sans plan ni coach ni coaché (sansPlan), quand l'app gratuite est ouverte pour lui.
export type CasDeVisite = 'connexion' | 'normal' | 'visiteur' | 'gratuit';

export function decider(entree: { mode: ModeAppGratuite; ouvertPourLui: boolean; session: boolean; sansPlan: boolean }): CasDeVisite {
  if (!entree.session) return entree.mode !== 'coupe' && entree.ouvertPourLui ? 'visiteur' : 'connexion';
  return entree.mode !== 'coupe' && entree.ouvertPourLui && entree.sansPlan ? 'gratuit' : 'normal';
}
