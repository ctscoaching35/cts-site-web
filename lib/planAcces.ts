/**
 * Le parcours « plan clé en main » (/plan, /plan/merci) répond 404 sauf :
 * - ouvert à tous : CTS_PLAN_OUVERT=1 dans l'environnement ;
 * - BÊTA PRIVÉE (décision coach du 07/10/2026) : ouvert sur invitation. Le lien
 *   /plan?invitation=<CTS_INVITATION> pose un cookie (proxy.ts), qui ouvre ensuite le
 *   questionnaire et la page de retour du paiement dans ce navigateur. Changer CTS_INVITATION
 *   referme les liens donnés.
 * Pour tester en local : l'une ou l'autre dans .env.local (fichier jamais versionné).
 */
import { cookies } from 'next/headers';

export const COOKIE_INVITATION = 'cts_invitation';

export const invitationValide = (valeur: string | undefined | null) => {
  const attendue = process.env.CTS_INVITATION?.trim();
  return Boolean(attendue) && valeur === attendue;
};

export async function planOuvert() {
  if (process.env.CTS_PLAN_OUVERT === '1') return true;
  return invitationValide((await cookies()).get(COOKIE_INVITATION)?.value);
}
