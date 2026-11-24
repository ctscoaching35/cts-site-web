// Aucun réseau, aucune base : le profil d'une trace pour le moteur v1 (scripts/test-gpx-v9.mjs).
/**
 * LE GPX DU MOTEUR v1 (réponse du moteur v1 au site, 24/11/2026 ; règles 2 et 9, C1) : `POST /v1/trace` rend, pour une trace lue, l'objet
 * `gpx: { montees: [{ dplus_m }], dplus_par_pente: { vallonne, cote_moderee, cote_raide } }`. Le site le garde avec les paramètres du plan
 * (`parametres.champs.gpx`, comme `entree` et `lu`) et le renvoie à chaque appel dans `parametres.gpx` (lib/app/moteurV9.ts, parametresV9), sous la 9.x
 * seulement. Sans trace lue, rien ne part : le moteur se replie sur la classe de la course. Une forme qui n'est pas celle-ci n'est jamais envoyée.
 */
export type GpxV9 = { montees: { dplus_m: number }[]; dplus_par_pente: { vallonne: number; cote_moderee: number; cote_raide: number } };

const PENTES = ['vallonne', 'cote_moderee', 'cote_raide'] as const;
const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// L'objet `gpx` si c'est bien celui du contrat (des montées en D+, le D+ de chaque classe de pente), sinon null.
export function lireGpx(x: unknown): GpxV9 | null {
  const o = x as { montees?: unknown; dplus_par_pente?: unknown } | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.montees)) return null;
  if (!o.montees.every((m) => m && typeof m === 'object' && nombre((m as { dplus_m?: unknown }).dplus_m))) return null;
  const p = o.dplus_par_pente as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || !PENTES.every((k) => nombre(p[k]))) return null;
  return {
    montees: (o.montees as { dplus_m: number }[]).map((m) => ({ dplus_m: m.dplus_m })),
    dplus_par_pente: { vallonne: p.vallonne as number, cote_moderee: p.cote_moderee as number, cote_raide: p.cote_raide as number },
  };
}

// Le `gpx` de la réponse de `POST /v1/trace` ; null si elle n'en porte pas (trace illisible : le moteur dit alors son message).
export const gpxDeLaTrace = (reponse: unknown): GpxV9 | null => lireGpx((reponse as { gpx?: unknown } | null)?.gpx);

/**
 * Les paramètres d'un plan avec son profil de trace gardé dans ses réponses (`champs.gpx`). `nouveau` : celui d'une trace qui vient d'être lue ; sans lui, celui des
 * paramètres d'avant (`avant`, un objectif refait à sa place garde sa trace). Sans aucun des deux, les paramètres sont rendus tels quels (la même référence).
 */
export function avecLeGpx(parametres: Record<string, unknown>, nouveau: GpxV9 | null, avant?: Record<string, unknown> | null): Record<string, unknown> {
  const gpx = nouveau ?? lireGpx(((avant?.champs ?? {}) as Record<string, unknown>).gpx);
  if (!gpx) return parametres;
  return { ...parametres, champs: { ...((parametres.champs ?? {}) as Record<string, unknown>), gpx } };
}
