/**
 * LE CODE EN TÊTE DU NOM D'UNE SÉANCE (décision 12 du coach du 09/11/2026, « tout A » ; moteur 8.461, cts_codes.py — les
 * deux lectures se tiennent l'une l'autre par leurs tests) : la barre du coach est faite de séances clés en main aux noms
 * courts, la famille, la structure, le terrain (« S2c 5×3′/1′ R », « SL + 2×15′ EC », « AM 3×3km/3′ ») ; les séances que
 * le moteur écrit portent le même code en tête, puis les mots pour l'athlète (« S2c 5×3′/1′ R · Seuil 2 court, route »).
 * Le site le lit comme une grammaire (le premier mot du nom), au lieu d'une liste de noms : « le contenu décide, le code
 * tranche quand le contenu hésite » (décision 12-5, lib/app/classement.ts). L'app de l'athlète n'affiche que les mots.
 *
 *   CODE := FAMILLE [STRUCTURE] [TERRAIN]      (ce qui précède le premier « · »)
 *   FAMILLE   REC EF ACT S1 T S2c S2l VO2c VO2l SPR A10 AS AM SL WEC NAV MYO TAPIS RF TEST CT VÉLO LIBRE
 *   TERRAIN   R (route ou plat), V (vallonné), C (côte), C+ (côte raide), en dernier mot
 *
 * Un nom de l'ancienne barre ou du moteur qui commence par une famille (« EF plate », « SL plaisir ») n'est pas un code :
 * un de ses mots n'est pas de la convention, il se lit comme avant (lib/app/barreFamilles.ts, puis le contenu).
 */
export type FamilleCode = 'ef' | 'seuil1' | 'tempo' | 'seuil2' | 'vo2max' | 'sprint' | 'allure' | 'mecanique';

// La famille lue par la continuité (null : pas une qualité), et les mots pour l'athlète.
const FAMILLES: Record<string, [FamilleCode | null, string]> = {
  REC: [null, 'Footing de récupération'], EF: [null, 'Endurance'], ACT: [null, 'Activation de la veille'],
  S1: ['seuil1', 'Seuil 1'], T: ['tempo', 'Tempo'], S2c: ['seuil2', 'Seuil 2 court'], S2l: ['seuil2', 'Seuil 2 long'],
  VO2c: ['vo2max', 'VO2max court'], VO2l: ['vo2max', 'VO2max long'], SPR: ['sprint', 'Sprints en côte'],
  A10: ['allure', 'Allure 10 km'], AS: ['allure', 'Allure semi'], AM: ['allure', 'Allure marathon'],
  SL: [null, 'Sortie longue'], WEC: [null, 'Week-end choc'], NAV: ['mecanique', 'Navettes'],
  MYO: ['mecanique', 'Myocrossmax'], TAPIS: ['mecanique', 'Montée sur tapis'], RF: [null, 'Renfo'], TEST: [null, 'Test'],
  CT: ['vo2max', 'Course test'], 'VÉLO': [null, 'EF à vélo'], LIBRE: [null, 'Sortie libre'],
};
const TERRAINS = ['R', 'V', 'C', 'C+'];
// Les codes qui tranchent contre le contenu : une sortie longue avec des blocs reste une sortie longue, un week-end choc un
// week-end choc, un test un test — jamais une séance de qualité de la semaine (la maquette du 09/11).
export const TRANCHENT_HORS_QUALITE = ['SL', 'WEC', 'TEST', 'RF', 'VÉLO', 'LIBRE'];
const SEP = ' · ';
const MOT_DE_CODE = /^(?:[\d(].*|R|V|C|C\+|UD|UO|LD|SC|DE|DA|EC|RC|D\+\d*|S1|S2|T|AM|AS|J\d|\+|%|prog|cible|test|vite|lent|mix|veille|marche|chaise|squats|fentes|parole|VC|EF|force|puissance|spé|montée|descente|\(freiner\)|\(pousser\)|A|B|pyr)$/u;

const normal = (nom: string | null | undefined) => String(nom ?? '').normalize('NFC').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export type CodeLu = { code: string; famille: string; lue: FamilleCode | null; terrain: string | null; structure: string;
  ud: boolean; mots: string };

// Le code en tête d'un nom, ou null (cts_codes.code_du_nom) : son premier mot n'est pas une famille, ou un de ses mots
// n'est pas de la convention — sauf quand son deuxième mot est une structure ou un terrain (le coach a ajouté un mot).
export function codeDuNom(nom: string | null | undefined): string | null {
  const tete = normal(nom).split(SEP)[0].trim();
  const mots = tete.split(' ');
  if (mots[0] === 'VELO') mots[0] = 'VÉLO';
  if (!(mots[0] in FAMILLES)) return null;
  if (mots.slice(1).every((m) => MOT_DE_CODE.test(m))) return tete;
  const deux = mots[1];
  if (deux && deux !== '+' && MOT_DE_CODE.test(deux) && (/^\d/.test(deux) || TERRAINS.includes(deux) || deux.startsWith('D+'))) return tete;
  return null;
}

export function lireCode(nom: string | null | undefined): CodeLu | null {
  const code = codeDuNom(nom);
  if (!code) return null;
  const m = code.split(' ');
  const famille = m[0] === 'VELO' ? 'VÉLO' : m[0];
  const terrain = m.length > 1 && TERRAINS.includes(m[m.length - 1]) ? m[m.length - 1] : null;
  const structure = m.slice(1, terrain ? -1 : undefined).join(' ');
  let [lue, mots] = FAMILLES[famille];
  // « EF + 10′ S1 » : une EF finie au Seuil 1 (le progressif), lue Seuil 1.
  if (famille === 'EF' && /^\+ .*\bS1$/u.test(structure)) lue = 'seuil1';
  const n = normal(nom);
  if (n.includes(SEP)) mots = n.slice(n.indexOf(SEP) + SEP.length).trim();
  return { code, famille, lue, terrain, structure, ud: structure.startsWith('UD '), mots };
}

// Ce que l'app de l'athlète affiche : les mots après le code (« Seuil 2 court, route ») ; un nom sans code, tel quel.
export function motsDuNom(nom: string | null | undefined): string {
  const n = normal(nom);
  return codeDuNom(n) && n.includes(SEP) ? n.slice(n.indexOf(SEP) + SEP.length).trim() : n;
}

// Le nom d'une séance pour une phrase (« Séance … de mardi allégée ») : les mots d'une séance codée ; d'un nom de
// l'ancienne écriture, sa tête (« Seuil 2 court route »).
export function nomCourt(nom: string | null | undefined): string {
  const n = normal(nom);
  return codeDuNom(n) ? motsDuNom(n) : n.split(' — ')[0].split(' · ')[0];
}
