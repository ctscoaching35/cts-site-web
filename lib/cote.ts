/**
 * LA PLUS LONGUE CÔTE, EN MINUTES (décision du coach du 23/11/2026, entrée 188) : elle se dit en minutes, à la place des quatre
 * cases du terrain (« jusqu'à 1 min 30 », « de 2 à 5 min », « de 5 à 10 min », « plus de 10 min »). Fonctions pures, sans réseau ni
 * base, partagées par l'achat, le coaching et la fiche du coaché.
 *
 * CE QUE LIT LE MOTEUR : le moteur en ligne (8.474) lit encore l'ancien `terrain`, à quatre valeurs ; il vient de ce nombre
 * (`terrainDeLaCote`) et la clé des minutes ne part pas au moteur tant que CONTRAT_API_CTS.md n'a pas écrit son nom (Moteur v1 le
 * dira). La 9.0 lit `cote_max` (`1m30` | `2-5` | `5-10` | `10+`) : `coteMaxDe` donne la même tranche.
 *
 * LES BORNES (provisoires, à confirmer avec le moteur) : jusqu'à 1 min 30, `1m30` ; moins de 5 min, `2-5` (le tapis sert sous
 * 5 min) ; moins de 10 min, `5-10` ; 10 min et plus, `10+`. Pas de côte : `1m30` (sa valeur par défaut, comme une clé absente).
 */

// La réponse « je n'ai pas de côte » : la valeur gardée à la place d'un nombre de minutes.
export const SANS_COTE = 'aucune';
// Au-delà, la réponse n'est pas lue (une faute de frappe, pas une côte).
export const COTE_MAX_MIN = 240;

export type CoteMax = '1m30' | '2-5' | '5-10' | '10+';
export type Terrain = 'vallonne' | 'intermediaire' | 'pentu' | 'tres_pentu';

// Les textes de la question, validés par le coach (23/11/2026) : l'achat, le coaching et la fiche disent la même chose.
export const TEXTES_COTE = {
  question:
    'Ta plus longue côte près de chez toi : combien de minutes pour la monter de bas en haut, en trottinant à ton allure d’endurance (tu peux parler), sans t’arrêter ? Si elle est trop raide pour trottiner, compte en marchant vite. Si tu ne sais pas, chronomètre-la à ta prochaine sortie.',
  unite: 'minutes',
  aucune: 'Je n’ai pas de côte',
  // Posée à tous, plus seulement avec une côte de moins de 5 min (23/11/2026).
  tapis: 'As-tu accès à un tapis de course qui monte ?',
  // TEXTES : BROUILLONS, à faire valider par le coach.
  illisible: 'Ta plus longue côte ne se lit pas : un nombre de minutes, par exemple 12, ou coche « Je n’ai pas de côte ».',
  // La fiche du coaché, dite par le coach.
  sa: 'Sa plus longue côte, en minutes',
};

/**
 * Ce que dit la réponse : un nombre de minutes (au dixième, de plus de 0 à 240), `SANS_COTE`, ou null si elle ne se lit pas ou
 * manque. Lit « 12 », « 12,5 », « 12 min » et un nombre déjà lu.
 */
export function lireCote(v: unknown): number | typeof SANS_COTE | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v <= COTE_MAX_MIN ? Math.round(v * 10) / 10 : null;
  const t = String(v ?? '').trim().toLowerCase();
  if (t === SANS_COTE) return SANS_COTE;
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:min|minutes?)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return n > 0 && n <= COTE_MAX_MIN ? Math.round(n * 10) / 10 : null;
}

// La tranche de la côte, pour la 9.0 (`cote_max`) ; null si la réponse ne se lit pas.
export function coteMaxDe(v: unknown): CoteMax | null {
  const c = lireCote(v);
  if (c === null) return null;
  if (c === SANS_COTE || c <= 1.5) return '1m30';
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

// La réponse en clair : « 12 min », « 1,5 min », « Pas de côte » ; null si elle ne se lit pas ou manque.
export function coteEnClair(v: unknown): string | null {
  const c = lireCote(v);
  if (c === null) return null;
  return c === SANS_COTE ? 'Pas de côte' : `${String(c).replace('.', ',')} min`;
}
