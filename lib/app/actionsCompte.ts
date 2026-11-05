'use server';
/**
 * Les actions du compte (cadrage, 3.6 ; D4 : « supprimer mon compte : tout est effacé »).
 */
import { redirect } from 'next/navigation';
import { effacerCompte } from './effacement';
import { clientServeur, clientService } from './supabase';
import { demonstrationOuverte } from './demonstrationPorte';

// Seulement cet appareil, cette app (décision coach du 22/10/2026) : ses autres connexions restent ouvertes (son
// téléphone, l'app « CTS Coach » à côté de celle de l'athlète).
// La démonstration (développement seulement) : ni déconnexion ni suppression ; retour à l'app.
export async function seDeconnecter() {
  if (demonstrationOuverte()) redirect('/app');
  await (await clientServeur()).auth.signOut({ scope: 'local' });
  redirect('/app/connexion');
}

// Le compte, ses plans et leurs PDF effacés (lib/app/effacement.ts) ; ses achats restent, sans lien au compte.
export async function supprimerCompte(formulaire: FormData) {
  if (formulaire.get('confirmation') !== 'oui' || demonstrationOuverte()) return;
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect('/app/connexion');
  await effacerCompte(clientService(), id);
  await supabase.auth.signOut();
  redirect('/app/connexion');
}
