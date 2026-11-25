/**
 * « SA SEMAINE PASSÉE » NE SE MONTRE QUE QUAND IL Y A UN RÉALISÉ À MONTRER, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026, suite : « l'espace coach doit être très simple sous la 9.x » ;
 * reports/Application coach — revue de simplicité, 24-11.md, proposition 3 : pas de ligne vide). SIXIÈME ÉTAPE, après les cinq de la simplification (« À faire » fondu dans « Mes athlètes »,
 * pageAthleteSimple.ts, cacherSousLaV1.ts, motsDuCoach.ts). Sous la 8.x, rien ne change : chaque fonction de ce fichier est appelée derrière `v9` (moteurEstV9, lib/app/moteurEnLigne.ts) et rend, sans `v9`,
 * ce que les écrans montraient avant.
 *
 * D'OÙ VIENT LE « RÉALISÉ » D'UNE SEMAINE (vérifié dans le code, 24/11/2026) :
 *   - `semaines_ecrites.realise` : sous la 8.x, rendu par `POST /v1/semaine` (lib/app/ecriture.ts, `envoyerEtRanger`) et rafraîchi chaque nuit (`refaireLesResumes`) ; sous le moteur v1 (9.x), le moteur n'en rend plus,
 *     et la nuit le tire de Nolio pour les semaines qu'il a écrites (lib/app/realiseDuV1.ts, décisions 198 et 199), avec l'accord de lecture, une fois la semaine finie. La semaine elle-même s'écrit sans (stockageV9.ts).
 *   - `semaines_athlete.realise` : écrit par `resumerSemaines` (lib/app/semainesNolio.ts, la nuit), pour les semaines que le moteur n'a PAS écrites (`lundisEcrits` saute celles de
 *     `semaines_ecrites`, la 9.x comprise : son `donnees.lundi` y est). C'est le cas de l'athlète programmé à la main et des semaines d'entre deux objectifs : leur réalisé existe encore
 *     sous la 9.x.
 * Le coach voit, pour les autres, sa semaine passée dans Nolio. Rien n'est donc supposé ici : « Sa semaine passée » se montre si, et seulement si, la donnée est là (lib/app/espaceCoach.ts :
 * `semaine` et `hooper`, lus de `rPassee`).
 *
 * Le calcul seul, sans lecture ni réseau : il s'essaie avec des données fabriquées (scripts/test-espace-coach-simple-6.mjs).
 */
// Ce que la ligne d'un athlète (LigneAthlete, lib/app/espaceCoach.ts) dit de sa semaine passée : ses séances faites sur prévues et sa charge tenue (`semaine`), sa fatigue déclarée (`hooper`).
// Le même critère que celui qui, depuis toujours, met « — » dans la colonne de « Mes athlètes » : ni l'un ni l'autre, rien à montrer.
type Passee = { semaine: unknown; hooper: unknown };
export const aUneSemainePassee = (a: Passee): boolean => Boolean(a.semaine || a.hooper);

// Le bloc « Sa semaine passée » de la page d'un athlète, la colonne de ses chiffres : sous la 9.x, seulement avec un réalisé ; sous la 8.x, toujours (avec ses « — »).
export const semainePasseeVisible = (v9: boolean, a: Passee): boolean => !v9 || aUneSemainePassee(a);

// La colonne « Semaine passée » de « Mes athlètes », en-tête compris : sous la 9.x, elle disparaît quand aucun athlète affiché n'a de réalisé. Sous la 8.x, toujours là.
export const colonnePasseeVisible = (v9: boolean, affiches: { a: Passee }[]): boolean => !v9 || affiches.some((e) => aUneSemainePassee(e.a));

// Les lignes de légende de « Mes athlètes » qui parlent de cette colonne (lib/app/motsDuCoach.ts, legendeDesChiffres) : sans la colonne, elles ne disent plus rien ; la ligne « Objectif : … »
// (la montée, dans la colonne de l'objectif) reste.
export const LEGENDE_DE_LA_COLONNE_PASSEE = ['Part du prévu', 'Fatigue déclarée'] as const;

export const legendeSansLaColonnePassee = (legende: string[], avecLaColonne: boolean): string[] =>
  avecLaColonne ? legende : legende.filter((l) => !LEGENDE_DE_LA_COLONNE_PASSEE.some((debut) => l.startsWith(debut)));

// « Semaine par semaine », sur la page d'un objectif : la légende qui dit ce que sont les chiffres des lignes (« Semaine tenue… », « Charge faite… », « Fatigue déclarée… ») n'a de sens que
// si une semaine écrite en a un à montrer. Une semaine écrite par le moteur v1 n'a pas de réalisé (voir plus haut) : sa ligne dit « Écrite le … » et porte sa note, sans chiffres, et
// la légende ne se montre pas. Sous la 8.x, la légende est vide : rien ne change.
export function legendeDesSemainesLues(legende: string[], semaines: { realise?: unknown }[], v9: boolean): string[] {
  return v9 && !semaines.some((w) => Boolean(w.realise)) ? [] : legende;
}
