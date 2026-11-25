/**
 * LE « RÉESSAYER » D'UNE ANCIENNE SAISON DE FOND (décision 220 du coach, 24/11/2026, suite) : tant que la v1 n'écrivait pas les saisons de fond encore en cours, leur « semaine pas partie » et son « Réessayer »
 * étaient cachés sous la 9.x. Depuis qu'elle les écrit (C8, lib/app/passagesV9.ts), « Réessayer » peut réussir et une semaine pas partie doit être dite : plus rien n'est caché, sous aucun moteur.
 *
 * Le calcul seul, sans lecture ni réseau : il s'essaie avec des données fabriquées (scripts/test-espace-coach-simple-6.mjs).
 */

// Le plan est-il une saison de fond ? La même lecture que `estFond` (lib/app/fond.ts), sans en importer la chaîne de lecture (Nolio, le moteur, la base).
export const estUneSaisonDeFond = (parametres: unknown): boolean => Boolean((parametres as { fond?: unknown } | null)?.fond);

// « Réessayer » se propose-t-il pour la semaine de ce plan ? Oui, saison de fond comprise.
export const reessayerPossible = (_v9: boolean, _saison: boolean): boolean => true;

// « Sa semaine qui arrive » : toutes, sous les deux moteurs.
export function semainesSansSaisonPasPartie<T extends { etat: string; fond: boolean }>(semaines: T[], _v9: boolean): T[] {
  return semaines;
}
