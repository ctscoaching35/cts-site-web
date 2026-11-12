/**
 * « LES MOTS DE TA SEMAINE » (lot 2 de l'app, décision du coach du 12/11/2026) : sous « Ta semaine », les mots des
 * séances de la semaine affichée, et seulement eux (avant, une liste fixe qui disait « Seuil 2 » à qui n'en avait pas et
 * oubliait la VO2max). Une séance codée (« S2c 5×3′/1′ R · Seuil 2 court, route », moteur 8.461) se lit par son code
 * (lib/app/codeSeance.ts) ; un nom d'avant les codes (« Seuil 2 court · 15 min — 5 × 3 min », « SL plaisir », toujours
 * dans Nolio ou dans un plan écrit avant) par ses mots. RPE s'ajoute dès qu'une famille est reconnue ; aucune reconnue,
 * aucun mot (pas de bloc). Le Hooper n'y est plus. Les définitions sont celles validées par le coach, mot pour mot.
 * Fonction pure.
 */
import { lireCode } from './codeSeance';
import { nomAffiche } from './nomsSeances';

type Cle = 'ef' | 'sl' | 'seuil1' | 'tempo' | 'seuil2' | 'vo2max' | 'allure' | 'navettes' | 'myo' | 'rpe' | 'tapis'
  | 'renfo' | 'wec';
export type MotDeLaSemaine = { mot: string; sens: string };

// Dans l'ordre de la liste du coach (12/11/2026), RPE en dernier (sa réponse du 12/11). Navettes, « Côtes et renfo »
// (l'ancien « Myocrossmax », le nom que le moteur écrit depuis le 12/11) et RPE : les définitions du 05/11/2026 (1A).
const MOTS: [Cle, string, string][] = [
  ['ef', 'EF', 'endurance fondamentale, RPE 3 : tu tiens une conversation sans gêne.'],
  ['sl', 'SL', 'sortie longue, la plus longue de ta semaine, en endurance.'],
  ['seuil1', 'Seuil 1', 'RPE 4-5 : un effort soutenu mais confortable, tu tiens une phrase courte.'],
  ['tempo', 'Tempo', 'RPE 6 : entre tes deux seuils, quelques mots seulement.'],
  ['seuil2', 'Seuil 2', 'RPE 7 : un effort dur, quelques mots seulement, difficilement.'],
  ['vo2max', 'VO2max', 'RPE 8-9 : très dur, un ou deux mots, sur des répétitions de quelques minutes au plus.'],
  ['allure', 'Allure de course', 'l’allure de ta course, calculée sur ton chrono visé.'],
  ['navettes', 'Navettes', 'des montées et des descentes répétées sur une même pente, pour habituer tes jambes au relief.'],
  ['myo', 'Côtes et renfo', 'de la force en côte : des montées enchaînées avec des exercices de renforcement.'],
  ['tapis', 'Montée sur tapis', 'une montée sur tapis incliné, pour qui n’a pas de longue côte.'],
  ['renfo', 'Renfo', 'du renforcement musculaire, à faire chez toi.'],
  ['wec', 'Week-end choc', 'des sorties longues enchaînées, pour apprendre à courir fatigué.'],
  ['rpe', 'RPE', 'ton effort ressenti, de 0 à 10 : note ton souffle, pas la douleur des jambes.'],
];

// La famille de chaque code (lib/app/codeSeance.ts) ; les sprints, les tests, la course test et la sortie libre n'ont pas
// de mot.
const PAR_CODE: Record<string, Cle> = {
  REC: 'ef', EF: 'ef', ACT: 'ef', 'VÉLO': 'ef', S1: 'seuil1', T: 'tempo', S2c: 'seuil2', S2l: 'seuil2', VO2c: 'vo2max',
  VO2l: 'vo2max', A10: 'allure', AS: 'allure', AM: 'allure', SL: 'sl', WEC: 'wec', NAV: 'navettes', MYO: 'myo',
  TAPIS: 'tapis', RF: 'renfo',
};
// Le mot exact d'une allure (une seule dans la semaine) ; plusieurs : « Allure de course ».
const ALLURES: Record<string, string> = { A10: 'Allure 10 km', AS: 'Allure semi', AM: 'Allure marathon' };
// Une endurance ou une sortie longue qui porte un bloc d'une autre famille : « EF + 10′ S1 », « SL + 2×20′ AM ».
const DANS_LA_STRUCTURE: Record<string, Cle> = { S1: 'seuil1', T: 'tempo', S2: 'seuil2', AM: 'allure', AS: 'allure' };

// Un nom d'avant les codes, par ses mots (« week-end choc » sous ses deux écritures, lib/app/nomsSeances.ts).
const PAR_LES_MOTS: [RegExp, Cle][] = [
  [/^(?:EF|Endurance|Footing|Activation)\b/i, 'ef'],
  [/^(?:SL|Sortie longue)\b/i, 'sl'],
  [/\bSeuil 1\b/i, 'seuil1'],
  [/\bTempo\b/i, 'tempo'],
  [/\bSeuil 2\b/i, 'seuil2'],
  [/\bVO2/i, 'vo2max'],
  [/\bNavettes?\b/i, 'navettes'],
  // L'ancien nom « Myocrossmax » (avant le 12/11/2026), et le nouveau.
  [/\bMyocrossmax\b|^Côtes et renfo\b/i, 'myo'],
  [/\btapis\b/i, 'tapis'],
  [/^Renfo\b/i, 'renfo'],
  [/^Week-end choc\b/i, 'wec'],
];
const ALLURE_EN_MOTS = /\ballure (10 ?km|semi|marathon)\b/i;

export function motsDeLaSemaine(noms: (string | null | undefined)[]): MotDeLaSemaine[] {
  const vues = new Set<Cle>();
  const allures = new Set<string>();
  for (const brut of noms) {
    const nom = nomAffiche(String(brut ?? '').normalize('NFC').replace(/\s+/g, ' ').trim());
    if (!nom) continue;
    const lu = lireCode(nom);
    if (lu) {
      const cle = PAR_CODE[lu.famille];
      if (cle) vues.add(cle);
      if (ALLURES[lu.famille]) allures.add(ALLURES[lu.famille]);
      if (lu.lue === 'seuil1') vues.add('seuil1');
      if (lu.famille === 'EF' || lu.famille === 'SL') {
        for (const m of lu.structure.split(' ')) {
          const autre = DANS_LA_STRUCTURE[m];
          if (!autre) continue;
          vues.add(autre);
          if (ALLURES[m]) allures.add(ALLURES[m]);
        }
      }
      continue;
    }
    for (const [motif, cle] of PAR_LES_MOTS) if (motif.test(nom)) vues.add(cle);
    const allure = ALLURE_EN_MOTS.exec(nom);
    if (allure) {
      vues.add('allure');
      const quelle = allure[1].toLowerCase().replace(/\s+/g, '');
      allures.add(quelle === '10km' ? 'Allure 10 km' : quelle === 'semi' ? 'Allure semi' : 'Allure marathon');
    }
  }
  if (!vues.size) return [];
  vues.add('rpe');
  return MOTS.filter(([cle]) => vues.has(cle)).map(([cle, mot, sens]) => ({
    mot: cle === 'allure' && allures.size === 1 ? [...allures][0] : mot, sens,
  }));
}
