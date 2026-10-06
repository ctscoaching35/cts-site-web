'use server';
/**
 * Les actions du compte (cadrage, 3.6 ; D4 : « supprimer mon compte : tout est effacé »).
 */
import { redirect } from 'next/navigation';
import { clientServeur, clientService } from './supabase';

export async function seDeconnecter() {
  await (await clientServeur()).auth.signOut();
  redirect('/app/connexion');
}

// Efface les PDF du compte, puis l'utilisateur : le compte et ses plans partent avec lui (clés
// étrangères en cascade) ; ses achats restent, sans lien au compte (obligation comptable, D4).
export async function supprimerCompte(formulaire: FormData) {
  if (formulaire.get('confirmation') !== 'oui') return;
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect('/app/connexion');
  const service = clientService();
  const { data: fichiers } = await service.storage.from('plans-pdf').list(id);
  if (fichiers?.length) await service.storage.from('plans-pdf').remove(fichiers.map((f) => `${id}/${f.name}`));
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) throw new Error(`Suppression du compte impossible : ${error.message}`);
  await supabase.auth.signOut();
  redirect('/app/connexion');
}
