'use server';
/**
 * La page de retour du paiement : le plan rangé dans le compte, puis l'athlète connecté sans code
 * (D6 : « la page de retour du paiement ouvre directement le plan ») quand rangerLePlan le permet ;
 * sinon, la page de connexion, par code.
 */
import { ErreurAchat, MESSAGE_RANGEMENT, rangerLePlan } from './rangement';
import { clientServeur } from './supabase';

export async function finaliserAchat(sessionId: string): Promise<{ destination: string } | { erreur: string }> {
  try {
    const { jeton, type, sansCode } = await rangerLePlan(sessionId);
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
