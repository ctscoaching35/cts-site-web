/**
 * L'OBJECTIF CONFRONTÉ À LA VITESSE CRITIQUE (C12 de la revue des huit plans, décision coach du 12/11/2026, « A » ; moteur
 * 8.462) : sur la route, quand le chrono visé s'écarte de plus de 5 % de celui que sa vitesse critique prédit, l'app le dit
 * à l'athlète et lui propose une cible, à mi-chemin des deux. Il garde son choix : pas de porte, rien d'imposé. La
 * prédiction est celle du moteur (cts_route.PART_VC_COURSE : le 10 km à 98 % de la VC, le semi à 93 %, le marathon à
 * 85 %). Les textes sont des BROUILLONS (CTS_TEXTES_A_VALIDER.md du moteur, section AA) ; jamais une invitation à
 * échanger avec le coach.
 */
export const PART_VC_COURSE: Record<string, number> = { R10: 0.98, R21: 0.93, R42: 0.85 };
export const DISTANCE_ROUTE_KM: Record<string, number> = { R10: 10, R21: 21.0975, R42: 42.195 };
export const ECART_OBJECTIF_VC_MAX = 0.05;

// « 1h45 », « 0h55 », « 3h » : des heures décimales ; null si illisible.
export function heuresDuChrono(chrono: string | null | undefined): number | null {
  const texte = String(chrono ?? '').trim();
  const m = texte.match(/^(\d+)\s*h\s*(\d{0,2})$/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const mn = texte.match(/^(\d+)\s*min$/);
  return mn ? Number(mn[1]) / 60 : null;
}

// « 1 h 36 », « 55 min » : un chrono arrondi à la minute.
export function chronoEnClair(heures: number): string {
  const total = Math.round(heures * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return h ? `${h} h ${String(min).padStart(2, '0')}` : `${min} min`;
}

export type EcartObjectifVc = { predit_h: number; vise_h: number; cible_h: number; ecart: number; sens: 'prudent' | 'ambitieux' };

// L'écart entre le chrono visé et celui que prédit la VC (m/s) ; null hors route, sans VC, ou sous 5 %.
export function ecartObjectifVc(format: string | null | undefined, chronoVise: string | null | undefined,
  vcMs: number | null | undefined): EcartObjectifVc | null {
  const part = PART_VC_COURSE[String(format ?? '')];
  const km = DISTANCE_ROUTE_KM[String(format ?? '')];
  const vise = heuresDuChrono(chronoVise);
  if (!part || !km || !vise || !vcMs || vcMs <= 0) return null;
  const predit = (km * 1000) / (vcMs * part) / 3600;
  const ecart = (vise - predit) / predit;
  if (Math.abs(ecart) <= ECART_OBJECTIF_VC_MAX) return null;
  return { predit_h: predit, vise_h: vise, cible_h: (vise + predit) / 2, ecart, sens: ecart > 0 ? 'prudent' : 'ambitieux' };
}

// Le message (BROUILLON) : ce que dit la VC, l'écart, la cible proposée, et son choix qu'il garde.
export function texteEcartObjectifVc(e: EcartObjectifVc): string {
  const pct = Math.round(Math.abs(e.ecart) * 100);
  return `Ta vitesse critique annonce un chrono autour de ${chronoEnClair(e.predit_h)}. Ton objectif de `
    + `${chronoEnClair(e.vise_h)} est ${pct} % plus ${e.sens === 'prudent' ? 'lent' : 'rapide'} : une cible autour de `
    + `${chronoEnClair(e.cible_h)} te correspondrait mieux. C’est toi qui choisis : tu peux changer ton chrono visé dans `
    + 'ton objectif, ou garder le tien.';
}
