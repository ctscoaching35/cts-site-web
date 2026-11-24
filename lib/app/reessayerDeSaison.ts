/**
 * LE « RÉESSAYER » D'UNE ANCIENNE SAISON DE FOND NE SE MONTRE PLUS, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026, suite ; la saison de fond est cachée sous la 9.x, lib/app/cacherSousLaV1.ts (c)).
 * Une saison de fond de la 8.x encore en cours (son plan : `parametres.fond`, ou la trame que le moteur lui rend : `fond`) n'a plus de moteur qui l'écrive sous la 9.x : « Réessayer » ne pourrait pas
 * réussir (`contextePlan` rend null pour un plan de fond, lib/app/passagesV9.ts). Le point « sa semaine n'est pas partie dans Nolio » d'une telle saison n'est donc gardé nulle part : ni dans « À faire »
 * de « Mes athlètes » (lib/app/espaceCoach.ts, vueDuCoach ; lib/app/mesAthletes.ts, le point du dimanche soir), ni dans « À faire pour lui » de sa page, ni dans « Sa semaine qui arrive »
 * (app/app/coach/athlete/[id]/page.tsx). Sous la 8.x, rien ne change : chaque fonction de ce fichier est appelée derrière `v9` (moteurEstV9, lib/app/moteurEnLigne.ts).
 *
 * Le calcul seul, sans lecture ni réseau : il s'essaie avec des données fabriquées (scripts/test-espace-coach-simple-6.mjs).
 */

// Le plan est-il une saison de fond ? La même lecture que `estFond` (lib/app/fond.ts), sans en importer la chaîne de lecture (Nolio, le moteur, la base).
export const estUneSaisonDeFond = (parametres: unknown): boolean => Boolean((parametres as { fond?: unknown } | null)?.fond);

// « Réessayer » se propose-t-il pour la semaine de ce plan ? `saison` : c'est une saison de fond (estUneSaisonDeFond, ou la trame que le moteur lui rend : `infosFond`).
export const reessayerPossible = (v9: boolean, saison: boolean): boolean => !(v9 && saison);

// « Sa semaine qui arrive » : sous la 9.x, la semaine pas partie d'une saison de fond (son bouton « Réessayer » et son « Pas encore partie ») n'est pas montrée ; ses autres états, oui.
export function semainesSansSaisonPasPartie<T extends { etat: string; fond: boolean }>(semaines: T[], v9: boolean): T[] {
  return v9 ? semaines.filter((s) => !(s.etat === 'pas_partie' && s.fond)) : semaines;
}
