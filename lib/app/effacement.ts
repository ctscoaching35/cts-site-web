/**
 * L'effacement d'un compte (cadrage de l'app, D4 : « supprimer mon compte : tout est effacé ») : par l'athlète
 * (« Supprimer mon compte ») ou après 3 ans sans activité (E7, lib/app/comptesInactifs.ts). Les PDF du compte, puis
 * l'utilisateur : le compte et ses plans partent avec lui (clés étrangères en cascade) ; ses achats restent, sans lien
 * au compte (obligation comptable). Côté serveur seulement.
 * J7 (audits du 05/11/2026, S3) : d'abord, ses préparations achetées s'arrêtent dans Nolio (ce qui est à venir en part),
 * il quitte l'équipe s'il n'y est que pour elles, et ses badges s'effacent (lib/app/ecriture.ts, sortirDeNolioAvantEffacement).
 * Nolio muet ne bloque pas l'effacement : le coach est prévenu de ce qui reste à faire à la main.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function effacerCompte(service: SupabaseClient, id: string) {
  const { sortirDeNolioAvantEffacement } = await import('./ecriture');
  await sortirDeNolioAvantEffacement(id).catch((e) => console.error(`Sortie de Nolio du compte ${id} :`, e instanceof Error ? e.message : e));
  const { data: fichiers } = await service.storage.from('plans-pdf').list(id);
  if (fichiers?.length) await service.storage.from('plans-pdf').remove(fichiers.map((f) => `${id}/${f.name}`));
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) throw new Error(`Suppression du compte impossible : ${error.message}`);
}
