/**
 * « WEEK-END CHOC » PARTOUT (Q2, décision coach du 05/11/2026 au soir, « A ») : le moteur écrit désormais
 * « Week-end choc — jour 1/2 (sortie longue) » et « EF plate (avant le week-end choc) » là où il écrivait
 * « Back-to-back — Jour 1/2 (sortie longue) » et « EF plate (avant back-to-back) ». Les séances déjà écrites dans Nolio
 * gardent l'ancien nom : tout ce que le site lit d'un nom de séance (relier une activité à sa séance, juger une sortie
 * longue, trouver une séance dans la barre latérale, le type d'une semaine) reconnaît les DEUX noms, et l'app des
 * athlètes n'affiche plus que le nouveau (nomAffiche). Fonctions pures.
 */

// Les tournures de l'ancien nom, de la plus précise à la plus générale, et leur équivalent nouveau.
const VERS_LE_NOUVEAU: [RegExp, string][] = [
  [/\(\s*avant\s+back-to-back\s*\)/gi, '(avant le week-end choc)'],
  [/\(\s*reprise\s+post-back-to-back\s*\)/gi, '(reprise après le week-end choc)'],
  [/^back-to-back\s+—\s+jour\b/i, 'Week-end choc — jour'],
  [/^back-to-back\b/i, 'Week-end choc'],
  [/back-to-back/gi, 'week-end choc'],
];
const VERS_L_ANCIEN: [RegExp, string][] = [
  [/\(\s*avant\s+le\s+week-end\s+choc\s*\)/gi, '(avant back-to-back)'],
  [/\(\s*reprise\s+(?:après\s+le|post-)\s*week-end\s+choc\s*\)/gi, '(reprise post-back-to-back)'],
  [/^week-end\s+choc\s+—\s+jour\b/i, 'Back-to-back — Jour'],
  [/^week-end\s+choc\b/i, 'Back-to-back'],
];

const remplacer = (nom: string, regles: [RegExp, string][]) => regles.reduce((n, [motif, par]) => n.replace(motif, par), nom);

// Le nom d'une séance tel que l'app le montre : l'ancien « back-to-back » devient « week-end choc ».
export const nomAffiche = (nom: string) => remplacer(nom, VERS_LE_NOUVEAU);

// L'autre écriture d'un même nom (l'ancienne pour un nom nouveau, la nouvelle pour un ancien) ; le nom lui-même s'il n'a
// pas d'autre écriture.
export const autreEcriture = (nom: string) => {
  const nouveau = nomAffiche(nom);
  return nouveau !== nom ? nouveau : remplacer(nom, VERS_L_ANCIEN);
};

// Deux noms comparés sans tenir compte des espaces, de la casse ni de l'écriture du week-end choc.
export const nomComparable = (nom: string | null | undefined) => {
  const n = nomAffiche(String(nom ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()).toLowerCase();
  return n.replace(/\(avant (?:le )?week-end choc\)/g, '(avant le week-end choc)')
    .replace(/\(reprise (?:post-|après (?:le )?)week-end choc\)/g, '(reprise après le week-end choc)');
};

// Le nom d'une séance du week-end choc, sous l'une ou l'autre écriture (« Back-to-back — Jour 2/2 », « Week-end choc —
// jour 2/2 »), ou d'une séance qui s'y rapporte (« EF plate (avant back-to-back) ») : le motif que le site cherchait dans
// un nom (« back-to-back »), et le nouveau.
export const MOTIF_WEEK_END_CHOC = /back-to-back|week-end choc/i;

// Le type d'une semaine dans la trame : « Back-to-back » (l'ancien) ou « Week-end choc » (le nouveau, s'il change aussi).
export const estSemaineDeWeekEndChoc = (type: string | null | undefined) => MOTIF_WEEK_END_CHOC.test(String(type ?? ''));
