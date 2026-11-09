/**
 * Les repères de l'athlète entre l'app et Nolio, la règle seule (sans réseau ni base) : ce que reperesNolio.ts reprend de
 * Nolio chaque nuit, et quelles fiches le rattrapage de nuit écrit dans Nolio (ecriture.ts, rattraperLesZones).
 *
 * DÉCISION 10 DU COACH (09/11/2026, CTS_DOCTRINE_SEMAINE.md dans le dépôt du moteur ; moteur 8.460) : « on ne prescrit pas
 * avec une valeur qu'on n'a pas dans Nolio ». Le moteur vise les valeurs que le site lui envoie (`profil`, celles de la
 * fiche ou de « Tes zones ») ; elles doivent être celles de Nolio. Deux écarts fermés ici :
 * - la FC au seuil 1 que le coach écrit dans Nolio n'était pas reprise (la VC et la FC au seuil 2 l'étaient) : l'app
 *   gardait l'ancienne, ou n'en avait pas ;
 * - le rattrapage de nuit ne prenait que les fiches à zones (la VC, ou les deux FC) : une FC au seuil 1 seule, gardée avant
 *   la création de sa métrique (26/10/2026) ou dont l'écriture avait échoué, n'arrivait jamais dans Nolio.
 * Et une valeur de Nolio égale à celle de l'app ne change plus sa source ni sa date (celle du test, qui dit quand le
 * refaire) : l'app l'y avait écrite elle-même.
 */

export type MetriqueLue = { cle: 'vc_ms' | 'fc_seuil2' | 'fc_seuil1'; item: string; valeur: (x: number) => number | null;
  egal: (a: number, b: number) => boolean };

// Les métriques de Nolio (lues le 24/10/2026 sur le compte du coach) : la VC du catalogue (en s/km), la FC au seuil 2 du
// catalogue, la FC au seuil 1 que le coach a créée le 26/10/2026 (metriquesNolio.ts l'écrit).
export const METRIQUES_LUES: MetriqueLue[] = [
  { cle: 'vc_ms', item: 'mti_AUit0R4USmTdyFZ', valeur: (s) => (s >= 120 && s <= 600 ? Math.round((1000 / s) * 1000) / 1000 : null),
    egal: (a, b) => Math.round(1000 / a) === Math.round(1000 / b) },
  { cle: 'fc_seuil2', item: 'mti_zBpan6mEubaMh4i', valeur: (b) => (b >= 100 && b <= 230 ? Math.round(b) : null),
    egal: (a, b) => Math.round(a) === Math.round(b) },
  { cle: 'fc_seuil1', item: 'mti_z68Hn6mEubaMh4i', valeur: (b) => (b >= 80 && b <= 220 ? Math.round(b) : null),
    egal: (a, b) => Math.round(a) === Math.round(b) },
];

// La valeur de Nolio remplace-t-elle celle de l'app ? L'app n'en a pas : oui, quel que soit son âge (décision coach du
// 26/10/2026) ; l'app en a une : si celle de Nolio a moins de 6 mois (limite), qu'elle est plus récente et qu'elle diffère.
export function reprendreDeNolio(m: MetriqueLue, actuelle: number | null | undefined, avantLe: string | undefined,
  valeur: number | null, le: string, limite: string): boolean {
  if (valeur === null || !le) return false;
  if (actuelle === null || actuelle === undefined) return true;
  if (le < limite || !avantLe || avantLe >= le) return false;
  return !m.egal(actuelle, valeur);
}

// Les fiches que le rattrapage de nuit écrit dans Nolio : toute fiche qui a une valeur (les métriques s'écrivent valeur
// par valeur ; les zones de FC, avec les deux FC seulement, et d'allure, avec la VC, zonesNolio.ts).
export const aDesReperes = (f: { vc_ms?: number | null; fc_seuil1?: number | null; fc_seuil2?: number | null }) =>
  Boolean(f.vc_ms || f.fc_seuil1 || f.fc_seuil2);
