'use server';
/**
 * La page de retour du paiement : le plan rangé dans le compte, puis l'athlète connecté sans code
 * (D6 : « la page de retour du paiement ouvre directement le plan ») quand rangerLePlan le permet ;
 * sinon, la page de connexion, par code.
 */
import { cookies, headers } from 'next/headers';
import { after } from 'next/server';
import { inviterAcheteur } from './ecriture';
import { coachConnecte } from './nolio';
import { COOKIE_PLAN, DUREE_COOKIE_PLAN } from './planChoisi';
import { ErreurAchat, MESSAGE_RANGEMENT, rangerLePlan } from './rangement';
import { clientServeur } from './supabase';

export async function finaliserAchat(sessionId: string): Promise<{ destination: string } | { erreur: string }> {
  try {
    // Un achat simulé (décision coach du 24/10/2026) ne se range que pour le coach connecté.
    if (sessionId.startsWith('coach_') && !(await coachConnecte())) return { erreur: 'Cette simulation est réservée au coach connecté.' };
    const entetes = await headers();
    const origine = entetes.get('origin') ?? `${entetes.get('x-forwarded-proto') ?? 'http'}://${entetes.get('host')}`;
    const { planId, email, aInviter, jeton, type, sansCode } = await rangerLePlan(sessionId, origine);
    // L'invitation dans l'équipe Nolio, après la réponse (le webhook de Stripe la lance aussi : la première prend la main).
    if (aInviter) after(() => inviterAcheteur(planId, email).catch((e) =>
      console.error(`Invitation Nolio de ${sessionId} :`, e instanceof Error ? e.message : e)));
    // Sur cet appareil, l'app s'ouvre sur le plan qui vient d'être acheté, même si le compte en a un
    // autre dont la course vient avant (retour du coach du 07/10/2026).
    (await cookies()).set(COOKIE_PLAN, planId, { path: '/', maxAge: DUREE_COOKIE_PLAN, sameSite: 'lax' });
    if (sansCode) {
      const { error } = await (await clientServeur()).auth.verifyOtp({ token_hash: jeton, type });
      if (!error) return { destination: '/app' };
      console.error(`Connexion sans code après l'achat ${sessionId} : ${error.message}`);
    }
    return { destination: '/app/connexion?achat=1' };
  } catch (e) {
    console.error(`Rangement de l'achat ${sessionId} :`, e);
    return { erreur: e instanceof ErreurAchat ? e.message : MESSAGE_RANGEMENT };
  }
}
