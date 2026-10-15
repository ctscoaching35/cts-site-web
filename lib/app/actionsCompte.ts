'use server';
/**
 * Les actions du compte (cadrage, 3.6 ; D4 : « supprimer mon compte : tout est effacé »).
 */
import { redirect } from 'next/navigation';
import { effacerCompte } from './effacement';
import { clientServeur, clientService } from './supabase';

export async function seDeconnecter() {
  await (await clientServeur()).auth.signOut();
  redirect('/app/connexion');
}

// Le compte, ses plans et leurs PDF effacés (lib/app/effacement.ts) ; ses achats restent, sans lien au compte.
export async function supprimerCompte(formulaire: FormData) {
  if (formulaire.get('confirmation') !== 'oui') return;
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect('/app/connexion');
  await effacerCompte(clientService(), id);
  await supabase.auth.signOut();
  redirect('/app/connexion');
}
