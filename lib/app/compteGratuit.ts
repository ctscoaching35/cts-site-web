/**
 * La clé des tables du compte gratuit : sa ligne `comptes`, posée au besoin par le serveur (sans toucher à un compte
 * existant). Partagée par les actions du profil (actionsGratuit.ts) et du dossier de course (rangerDossier.ts).
 */
import { clientService } from './supabase';

export async function assurerCompte(compteId: string) {
  const { error } = await clientService().from('comptes').upsert({ id: compteId, nom: '' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`comptes : ${error.message}`);
}
