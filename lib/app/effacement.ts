/**
 * L'effacement d'un compte (cadrage de l'app, D4 : « supprimer mon compte : tout est effacé ») : par l'athlète
 * (« Supprimer mon compte ») ou après 3 ans sans activité (E7, lib/app/comptesInactifs.ts). Les PDF du compte, puis
 * l'utilisateur : le compte et ses plans partent avec lui (clés étrangères en cascade) ; ses achats restent, sans lien
 * au compte (obligation comptable). Côté serveur seulement.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function effacerCompte(service: SupabaseClient, id: string) {
  const { data: fichiers } = await service.storage.from('plans-pdf').list(id);
  if (fichiers?.length) await service.storage.from('plans-pdf').remove(fichiers.map((f) => `${id}/${f.name}`));
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) throw new Error(`Suppression du compte impossible : ${error.message}`);
}
