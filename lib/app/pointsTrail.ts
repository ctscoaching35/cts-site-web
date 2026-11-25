// Aucun réseau, aucune base : ses points forts et faibles en trail (scripts/test-points-trail.mjs). Lu dans le navigateur comme sur le serveur.
/**
 * SES POINTS FORTS ET FAIBLES EN TRAIL (demande du coach du 25/11/2026 : « point fort trail, point faible trail […] avec la liste des choses sur lesquelles il est plus fort ou moins fort ») : montées, descentes,
 * technique, fin de course, les quatre de « Ce qui te coûte le plus » (lib/app/accentFond.ts). Chacun est un point fort, un point faible ou neutre, gardé sur sa fiche (`profil.trail_…`), saisi par l'athlète ou par son
 * coach, sous la 9.x. Sans réponse, la réponse d'avant (`cout_trail`) vaut un point faible. Rien n'en part au moteur. Textes : BROUILLONS.
 */
export const POINTS_TRAIL = [
  { champ: 'trail_montees', accent: 'montees', titre: 'Montées' },
  { champ: 'trail_descentes', accent: 'descentes', titre: 'Descentes' },
  { champ: 'trail_technique', accent: 'technique', titre: 'Technique' },
  { champ: 'trail_fin', accent: 'fin', titre: 'Fin de course' },
] as const;

export type ChampTrail = (typeof POINTS_TRAIL)[number]['champ'];
export type ValeursTrail = Record<ChampTrail, string>;

export const CHOIX_TRAIL = [['fort', 'Point fort'], ['faible', 'Point faible'], ['neutre', 'Neutre']] as const;

export const TEXTES_TRAIL = {
  ton: 'Tes points forts et faibles en trail',
  son: 'Ses points forts et faibles en trail',
  forts: 'Points forts trail',
  faibles: 'Points faibles trail',
} as const;

const estUnChoix = (v: unknown): v is string => CHOIX_TRAIL.some(([choix]) => choix === v);

// Les réponses données, et elles seules.
export function pointsSaisis(lire: (champ: ChampTrail) => unknown): Partial<ValeursTrail> {
  return Object.fromEntries(POINTS_TRAIL.flatMap((p) => {
    const v = lire(p.champ);
    return estUnChoix(v) ? [[p.champ, v]] : [];
  }));
}

// Les quatre points d'un profil, « » sans réponse.
export function pointsTrail(profil: Record<string, unknown> | null | undefined): ValeursTrail {
  const saisis = pointsSaisis((champ) => profil?.[champ]);
  const repondu = Object.keys(saisis).length > 0;
  return Object.fromEntries(POINTS_TRAIL.map((p) => [p.champ, repondu ? saisis[p.champ] ?? '' : profil?.cout_trail === p.accent ? 'faible' : ''])) as ValeursTrail;
}

// « Montées, descentes » : les points de ce côté ; « » quand il n'y en a pas.
export function listeDesPoints(points: Partial<ValeursTrail>, cote: 'fort' | 'faible'): string {
  return POINTS_TRAIL.filter((p) => points[p.champ] === cote).map((p, i) => (i ? p.titre.toLowerCase() : p.titre)).join(', ');
}
