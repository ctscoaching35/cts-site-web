/**
 * LA PLUS LONGUE CÔTE, EN MINUTES (décision du coach du 23/11/2026, entrée 188 ; « pas de côte » retiré le 24/11, entrée 191) : elle se
 * dit en minutes, à la place des quatre cases du terrain (« jusqu'à 1 min 30 », « de 2 à 5 min », « de 5 à 10 min », « plus de 10 min »).
 * Tout athlète a accès à une côte, même courte (un pont, une rampe de parking, des escaliers) : la question demande toujours des minutes.
 * Fonctions pures, sans réseau ni base, partagées par l'achat, le coaching et la fiche du coaché.
 *
 * LE PLANCHER : 1 minute, comme le moteur (CONTRAT_API_CTS.md, 24/11/2026) : une réponse sous 1 min vaut 1 min (la réponse est lue, jamais
 * refusée), une réponse absente reste absente (le moteur lui donne 1 min).
 *
 * CE QUE LIT LE MOTEUR : le moteur en ligne (8.474) lit encore l'ancien `terrain`, à quatre valeurs ; il vient de ce nombre
 * (`terrainDeLaCote`), et les minutes ne partent pas à l'achat tant que l'achat reste sur la 8.474. La 9.0 lit `parametres.cote_min`,
 * le nombre de minutes (lib/app/moteurV9.ts) ; sa tranche `cote_max` (`1m30` | `2-5` | `5-10` | `10+`) n'est lue que sans `cote_min`, en
 * transition : `coteMaxDe` la donne.
 *
 * LES BORNES de la tranche (celles du moteur : 1,5 / 5 / 10 min, « 10+ » vaut 10 min) : jusqu'à 1 min 30, `1m30` ; moins de 5 min,
 * `2-5` (le tapis sert sous 5 min) ; moins de 10 min, `5-10` ; 10 min et plus, `10+`.
 */

// Le plancher : la plus petite côte que lit le moteur, en minutes.
export const COTE_PLANCHER_MIN = 1;
// Au-delà, la réponse n'est pas lue (une faute de frappe, pas une côte).
export const COTE_MAX_MIN = 240;

export type CoteMax = '1m30' | '2-5' | '5-10' | '10+';
export type Terrain = 'vallonne' | 'intermediaire' | 'pentu' | 'tres_pentu';

// Les textes de la question, validés par le coach (23/11/2026) : l'achat, le coaching et la fiche disent la même chose.
export const TEXTES_COTE = {
  question:
    'Ta plus longue côte près de chez toi : combien de minutes pour la monter de bas en haut, en trottinant à ton allure d’endurance (tu peux parler), sans t’arrêter ? Si elle est trop raide pour trottiner, compte en marchant vite. Si tu ne sais pas, chronomètre-la à ta prochaine sortie.',
  unite: 'minutes',
  // Sous la question (le coach, 24/11/2026) : l'aide de qui n'a pas de vraie côte.
  aide: 'Pas de vraie côte ? Pense à un pont, une rampe de parking ou des escaliers.',
  // Posée à tous, plus seulement avec une côte de moins de 5 min (23/11/2026).
  tapis: 'As-tu accès à un tapis de course qui monte ?',
  // TEXTES : BROUILLONS, à faire valider par le coach.
  illisible: 'Ta plus longue côte ne se lit pas : un nombre de minutes, par exemple 12.',
  // La fiche du coaché, dite par le coach.
  sa: 'Sa plus longue côte, en minutes',
  illisibleSa: 'Sa plus longue côte ne se lit pas : un nombre de minutes, par exemple 12.',
};

/**
 * Ce que dit la réponse : un nombre de minutes, au dixième, d'au moins 1 (une réponse plus courte, 0 compris, vaut 1 : le plancher du
 * moteur) et d'au plus 240 ; null si elle ne se lit pas ou manque. Lit « 12 », « 12,5 », « 12 min » et un nombre déjà lu.
 */
export function lireCote(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else {
    const m = /^(\d+(?:[.,]\d+)?)\s*(?:min|minutes?)?$/.exec(String(v ?? '').trim().toLowerCase());
    if (!m) return null;
    n = Number(m[1].replace(',', '.'));
  }
  if (!Number.isFinite(n) || n < 0 || n > COTE_MAX_MIN) return null;
  return Math.max(COTE_PLANCHER_MIN, Math.round(n * 10) / 10);
}

// La tranche de la côte, pour la 9.0 en transition (`cote_max`) ; null si la réponse ne se lit pas.
export function coteMaxDe(v: unknown): CoteMax | null {
  const c = lireCote(v);
  if (c === null) return null;
  if (c <= 1.5) return '1m30';
  if (c < 5) return '2-5';
  return c < 10 ? '5-10' : '10+';
}

// Les quatre anciennes valeurs du terrain, que lit le moteur en ligne : leur tranche de côte.
export const TERRAIN_DE_COTE: Record<CoteMax, Terrain> = { '1m30': 'vallonne', '2-5': 'intermediaire', '5-10': 'pentu', '10+': 'tres_pentu' };

// L'ancien terrain que donne la réponse ; null si elle ne se lit pas (alors la valeur d'avant reste, ou rien).
export function terrainDeLaCote(v: unknown): Terrain | null {
  const t = coteMaxDe(v);
  return t ? TERRAIN_DE_COTE[t] : null;
}

// La réponse en clair, telle que le moteur la lit : « 12 min », « 1,5 min » ; null si elle ne se lit pas ou manque.
export function coteEnClair(v: unknown): string | null {
  const c = lireCote(v);
  return c === null ? null : `${String(c).replace('.', ',')} min`;
}
