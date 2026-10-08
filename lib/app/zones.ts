/**
 * « Tes zones » (cadrage de l'app §7.1, décisions coach Z1 à Z9 des 07 et 08/10/2026) : le profil de
 * l'athlète (FC au seuil 1, vitesse critique et D′, FC au seuil 2) et les calculs qui en tirent les
 * repères des séances. La règle (quelles séances, quels écarts, quels %) vient du moteur, dans le plan
 * (Jour.reperes, Plan.zones) : ici, seulement l'arithmétique. LE RPE PRIME.
 */
import type { CleTest, Plan, Reperes, SpecAllure, SpecFc, Zones } from './plan';

export type Profil = {
  fc_seuil1: number | null;
  fc_seuil1_le: string | null;
  vc_ms: number | null;
  d_prime_m: number | null;
  vc_le: string | null;
  fc_seuil2: number | null;
  fc_seuil2_le: string | null;
};

export const PROFIL_VIDE: Profil = {
  fc_seuil1: null, fc_seuil1_le: null, vc_ms: null, d_prime_m: null, vc_le: null, fc_seuil2: null, fc_seuil2_le: null,
};

const valeur = (ref: 'seuil1' | 'seuil2', p: Profil) => (ref === 'seuil1' ? p.fc_seuil1 : p.fc_seuil2);

// « FC sous 147 », « FC de 152 à 157 » ; null si une référence manque : la séance reste au RPE seul.
export function texteFc(spec: SpecFc | null | undefined, p: Profil): string | null {
  if (!spec) return null;
  const borne = (b?: [ 'seuil1' | 'seuil2', number ]) => {
    if (!b) return undefined;
    const v = valeur(b[0], p);
    return v === null ? null : v + b[1];
  };
  const bas = borne(spec.bas);
  const haut = borne(spec.haut);
  if (bas === null || haut === null) return null;
  if (bas !== undefined && haut !== undefined) return `FC de ${bas} à ${haut}`;
  if (haut !== undefined) return `FC sous ${haut}`;
  if (bas !== undefined) return `FC au-dessus de ${bas}`;
  return null;
}

// Une allure au kilomètre, « 4:05 ».
export function allure(vitesse_ms: number) {
  const s = Math.round(1000 / vitesse_ms);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// « 4:13 à 4:05/km » : du plus lent au plus rapide.
export function texteAllure(spec: SpecAllure | null | undefined, p: Profil): string | null {
  if (!spec || p.vc_ms === null) return null;
  return `${allure((p.vc_ms * spec[0]) / 100)} à ${allure((p.vc_ms * spec[1]) / 100)}/km`;
}

export const kmh = (vitesse_ms: number) => (vitesse_ms * 3.6).toFixed(1).replace('.', ',');

// Les repères d'une séance, en une ligne : « FC sous 147 », « 4:13 à 4:05/km sur le plat ».
export function texteReperes(r: Reperes | null | undefined, p: Profil): string | null {
  if (!r) return null;
  const morceaux = [texteFc(r.fc, p), r.allure_vc && texteAllure(r.allure_vc, p) ? `${texteAllure(r.allure_vc, p)} sur le plat` : null];
  const ligne = morceaux.filter(Boolean).join(' · ');
  return ligne || null;
}

export const testFait = (cle: CleTest, p: Profil) =>
  cle === 'parole' ? p.fc_seuil1 !== null : cle === 'vitesse_critique' ? p.vc_ms !== null : p.fc_seuil2 !== null;

// Les tests que l'athlète peut faire maintenant : la FC au seuil 2 attend la vitesse critique (Z5).
export const testOuvert = (cle: CleTest, zones: Zones, p: Profil) =>
  zones.tests_disponibles.includes(cle) && (cle !== 'fc_seuil2' || p.vc_ms !== null);

// Les valeurs qui remplissent les phrases « Ce que ça change » du moteur.
export function valeursChange(p: Profil): Record<string, string> | null {
  const v: Record<string, string> = {};
  if (p.fc_seuil1 !== null) {
    v.fc_ef_haut = String(p.fc_seuil1 - 5);
    v.fc_s1_bas = String(p.fc_seuil1);
    v.fc_s1_haut = String(p.fc_seuil1 + 5);
  }
  if (p.fc_seuil2 !== null) {
    v.fc_s2_bas = String(p.fc_seuil2 - 5);
    v.fc_s2_haut = String(p.fc_seuil2);
    if (p.fc_seuil1 !== null) {
      v.fc_tempo_bas = String(p.fc_seuil1 + 5);
      v.fc_tempo_haut = String(p.fc_seuil2 - 5);
    }
  }
  if (p.vc_ms !== null) v.allure_exemple = texteAllure([95, 98], p) ?? '';
  return v;
}

// Une phrase du moteur aux valeurs de l'athlète ; null s'il en manque une.
export function remplir(modele: string, valeurs: Record<string, string>) {
  let complet = true;
  const texte = modele.replace(/\{(\w+)\}/g, (_, cle: string) => {
    if (!(cle in valeurs)) complet = false;
    return valeurs[cle] ?? '';
  });
  return complet ? texte : null;
}

// La prochaine séance qui peut servir de test (Z1) : à partir d'aujourd'hui, tant que la valeur manque.
export function prochaineSeanceTest(plan: Plan, cle: CleTest, aPartirDe: string) {
  for (const s of plan.semaines)
    for (const j of s.jours)
      if (j.reperes?.test?.cle === cle && j.date_iso && j.date_iso >= aPartirDe) return j.id;
  return null;
}

// ─── La vitesse critique (Z4) ──────────────────────────────────────────────
// Deux efforts maximaux : CS = (d2 − d1) / (t2 − t1), D′ = d1 − CS·t1 (Galbraith et al., 2014).
export type Effort = { distance_m: number; duree_s: number };

export function vitesseCritique(a: Effort, b: Effort): { vc_ms: number; d_prime_m: number } | { erreur: string } {
  const [court, long] = a.duree_s <= b.duree_s ? [a, b] : [b, a];
  const refaire = 'Les deux efforts ne collent pas ensemble : refais le test, en partant moins vite sur le long.';
  if ([court, long].some((e) => e.duree_s < 120 || e.duree_s > 900))
    return { erreur: 'Chaque effort doit durer de 2 à 15 minutes.' };
  if (long.duree_s - court.duree_s < 300) return { erreur: 'Les deux efforts doivent être bien écartés : au moins 5 minutes de différence.' };
  if (court.distance_m / court.duree_s < 1.03 * (long.distance_m / long.duree_s)) return { erreur: refaire };
  const vc_ms = (long.distance_m - court.distance_m) / (long.duree_s - court.duree_s);
  const d_prime_m = court.distance_m - vc_ms * court.duree_s;
  if (vc_ms < 2 || vc_ms > 7 || d_prime_m < 20 || d_prime_m > 600) return { erreur: refaire };
  return { vc_ms, d_prime_m };
}

// « 12 », « 12:00 », « 11:42 » -> secondes ; « 3150 », « 3,15 » (km) -> mètres.
export function lireDuree(texte: string): number | null {
  const m = /^\s*(\d{1,2})(?:[:'h](\d{1,2}))?\s*$/.exec(texte);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}

export function lireDistance(texte: string): number | null {
  const n = Number(texte.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 50 ? Math.round(n * 1000) : Math.round(n);
}
