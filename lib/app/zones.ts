/**
 * « Tes zones » (cadrage de l'app §7.1, décisions coach Z1 à Z9 des 07 et 08/10/2026) : le profil de
 * l'athlète (FC au seuil 1, vitesse critique et D′, FC au seuil 2) et les calculs qui en tirent les
 * repères des séances. La règle (quelles séances, quels écarts, quels %) vient du moteur, dans le plan
 * (Jour.reperes, Plan.zones) : ici, seulement l'arithmétique. LE RPE PRIME.
 */
import type { CleTest, LigneZone, Plan, Recoupement, Reperes, SpecAllure, SpecFc, Zones } from './plan';

export type Profil = {
  fc_seuil1: number | null;
  fc_seuil1_le: string | null;
  vc_ms: number | null;
  d_prime_m: number | null;
  vc_le: string | null;
  fc_seuil2: number | null;
  fc_seuil2_le: string | null;
  // L'allure du palier du test de la parole, en m/s (moteur 8.320).
  v_seuil1_ms: number | null;
};

export const PROFIL_VIDE: Profil = {
  fc_seuil1: null, fc_seuil1_le: null, vc_ms: null, d_prime_m: null, vc_le: null, fc_seuil2: null, fc_seuil2_le: null,
  v_seuil1_ms: null,
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

// « 4:13 à 4:05/km » : du plus lent au plus rapide ; decalage : les points de VC du seuil 1 recoupé.
export function texteAllure(spec: SpecAllure | null | undefined, p: Profil, decalage = 0): string | null {
  if (!spec || p.vc_ms === null) return null;
  const [lent, rapide] = [allure((p.vc_ms * (spec[0] + decalage)) / 100), allure((p.vc_ms * (spec[1] + decalage)) / 100)];
  return lent === rapide ? `${lent}/km` : `${lent} à ${rapide}/km`;
}

// LE SEUIL 1 RECOUPÉ (moteur 8.320, décision coach du 13/10/2026) : l'allure du palier du test de la parole
// rapportée à la VC, située par la règle du moteur, à l'identique du calculateur en ligne. Le décalage (en
// points de VC) que suivent les allures de récupération, d'endurance, de seuil 1 et le bas du tempo. null sans
// VC, ou dans un plan produit avant 8.320 (pas de règle : rien n'est décalé).
export type Situation = { decalage: number; statut: 'estime' | 'concorde' | 'possible' | 'verifie'; part: number | null };
export function situerSeuil1(p: Profil, r: Recoupement | undefined): Situation | null {
  if (!r || p.vc_ms === null) return null;
  if (p.v_seuil1_ms === null) return { decalage: 0, statut: 'estime', part: null };
  const part = p.v_seuil1_ms / p.vc_ms;
  const retenu = part >= r.retenu[0] / 100 && part < r.retenu[1] / 100;
  const statut = part >= r.concorde[0] / 100 && part <= r.concorde[1] / 100 ? 'concorde' : retenu ? 'possible' : 'verifie';
  const s1 = retenu ? part : r.centre / 100;
  return { decalage: Math.max(r.decalage[0], Math.min(r.decalage[1], s1 * 100 - r.centre)), statut, part };
}
export const decalageSeuil1 = (p: Profil, zones: Pick<Zones, 'recoupement'> | null | undefined) =>
  situerSeuil1(p, zones?.recoupement)?.decalage ?? 0;

// La phrase du recoupement, comme le calculateur : la situation, puis la phrase de transparence.
export function texteRecoupement(p: Profil, zones: Pick<Zones, 'recoupement'> | null | undefined): string | null {
  const r = zones?.recoupement;
  const s = situerSeuil1(p, r);
  if (!r || !s || p.vc_ms === null) return null;
  const situation = r.textes[s.statut]
    .replace('{pct}', `${Math.round((s.part ?? 0) * 100)} %`)
    .replace('{kmh_bas}', kmh((p.vc_ms * r.concorde[0]) / 100))
    .replace('{kmh_haut}', kmh((p.vc_ms * r.concorde[1]) / 100));
  return `${situation} ${r.textes.transparence}`;
}

// L'allure d'une ligne du tableau des zones : « Plus lent que 7:01/km » (récupération), une plage décalée selon
// ce qui suit le seuil 1 ; le tempo disparaît quand le seuil 1 décalé atteint son haut (comme le calculateur).
export function texteAllureLigne(l: LigneZone | undefined, p: Profil, decalage = 0): string | null {
  if (!l || p.vc_ms === null) return null;
  if (l.allure_sous_vc !== undefined) {
    const sous = l.allure_sous_vc + (l.allure_decalee ? decalage : 0);
    return `Plus lent que ${allure((p.vc_ms * sous) / 100)}/km`;
  }
  if (!l.allure_vc) return null;
  if (l.allure_decalee === 'bas') {
    const bas = l.allure_vc[0] + decalage;
    return bas < l.allure_vc[1] - 0.5 ? texteAllure([bas, l.allure_vc[1]], p) : null;
  }
  return texteAllure(l.allure_vc, p, l.allure_decalee === 'tout' ? decalage : 0);
}

export const kmh = (vitesse_ms: number) => (vitesse_ms * 3.6).toFixed(1).replace('.', ',');

// Les repères d'une séance, en une ligne : « FC sous 147 », « 4:13 à 4:05/km sur le plat » ; decalage : celui du
// seuil 1 recoupé, pour une allure qui le suit.
export function texteReperes(r: Reperes | null | undefined, p: Profil, decalage = 0): string | null {
  if (!r) return null;
  const fc = texteFc(r.fc, p);
  const a = r.allure_vc ? texteAllure(r.allure_vc, p, r.allure_decalee === 'tout' ? decalage : 0) : null;
  const morceaux = [
    fc && r.fc_precision ? `${fc} ${r.fc_precision}` : fc,
    a ? `${a} sur le plat` : null,
  ];
  const ligne = morceaux.filter(Boolean).join(' · ');
  return ligne || null;
}

export const testFait = (cle: CleTest, p: Profil) =>
  cle === 'parole' ? p.fc_seuil1 !== null : cle === 'vitesse_critique' ? p.vc_ms !== null : p.fc_seuil2 !== null;

// Les tests que « Tes zones » propose : ceux du plan, et la FC au seuil 2 dès que la vitesse critique l'est, même quand
// le plan n'a pas de séance de fractions sur le plat où écrire sa mesure (décision coach du 20/10/2026, « ouverte pour
// tous ») : une valeur mesurée hors du plan règle aussi les zones et les séances.
export const testsProposes = (zones: Zones): CleTest[] =>
  zones.tests_disponibles.includes('vitesse_critique') && !zones.tests_disponibles.includes('fc_seuil2')
    ? [...zones.tests_disponibles, 'fc_seuil2'] : zones.tests_disponibles;
// La FC au seuil 2 proposée hors du plan : il n'écrit pas sa séance de mesure.
export const fcSeuil2HorsPlan = (zones: Zones) => !zones.tests_disponibles.includes('fc_seuil2') && testsProposes(zones).includes('fc_seuil2');
export const QUAND_FC_SEUIL2_HORS_PLAN = 'Ta préparation n’a pas de séance sur le plat où l’écrire : fais-le de toi-même, sur du plat, '
  + 'à la place d’une séance de seuil 2, hors des deux dernières semaines avant ta course.';

// Les tests que l'athlète peut faire maintenant : la FC au seuil 2 attend la vitesse critique (Z5).
export const testOuvert = (cle: CleTest, zones: Zones, p: Profil) =>
  testsProposes(zones).includes(cle) && (cle !== 'fc_seuil2' || p.vc_ms !== null);

// Les valeurs qui remplissent les phrases « Ce que ça change » du moteur. La plage du seuil 1 est lue dans le
// tableau des zones du plan (D3) : de S1 − 5 à S1 + 5 depuis le 13/10/2026 (décision coach), de S1 à S1 + 5 dans
// un plan produit avant ; chaque plan reste d'accord avec les repères de ses séances.
export function valeursChange(p: Profil, zones?: Pick<Zones, 'tableau'> | null): Record<string, string> | null {
  const v: Record<string, string> = {};
  if (p.fc_seuil1 !== null) {
    const s1 = zones?.tableau.lignes.find((l) => l.fc?.bas?.[0] === 'seuil1' && l.fc?.haut?.[0] === 'seuil1')?.fc;
    v.fc_ef_haut = String(p.fc_seuil1 - 5);
    v.fc_s1_bas = String(p.fc_seuil1 + (s1?.bas?.[1] ?? -5));
    v.fc_s1_haut = String(p.fc_seuil1 + (s1?.haut?.[1] ?? 5));
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

// LE PROFIL DU COUREUR (CTS_NOLIO_CADRAGE.md, AP4, décision coach du 19/10/2026 : la règle du calculateur « Ton profil
// de traileur », public/calculateur.html, à l'identique). Le coefficient de Riegel : 1 + la pente de ln(vitesse) en
// fonction de ln(durée), RAMENÉ au test de référence (5:00, 12:00, 16:40) pour cette VC et cette D′ (décision coach
// du 13/10/2026) ; sous 0,90 (un repère de coach), « plutôt rapide », sinon « plutôt endurant ». Rien sans D′ : le
// profil se tire du test de vitesse critique.
export function coefficientRiegel(vc_ms: number, d_prime_m: number): number {
  const REF = [300, 720, 1000];
  const lnv = (t: number) => Math.log(vc_ms + d_prime_m / t);
  const lx = REF.reduce((a, t) => a + Math.log(t), 0) / REF.length;
  const ly = REF.reduce((a, t) => a + lnv(t), 0) / REF.length;
  const lxy = REF.reduce((a, t) => a + (Math.log(t) - lx) * (lnv(t) - ly), 0);
  const lxx = REF.reduce((a, t) => a + (Math.log(t) - lx) ** 2, 0);
  return 1 + lxy / lxx;
}

export type ProfilCoureur = { coefficient: number; nom: string; texte: string; loin: string; pres: string; note: string };
export function profilCoureur(p: Pick<Profil, 'vc_ms' | 'd_prime_m'>): ProfilCoureur | null {
  if (p.vc_ms === null || p.d_prime_m === null || !p.d_prime_m) return null;
  const r = coefficientRiegel(p.vc_ms, p.d_prime_m);
  const rapide = r < 0.9;
  const coef = r.toFixed(2).replace('.', ',');
  return {
    coefficient: r,
    nom: rapide ? 'Plutôt rapide' : 'Plutôt endurant',
    texte: rapide
      ? `Ton coefficient de Riegel est de ${coef} : ta vitesse baisse plus que la moyenne quand l’effort s’allonge. Ta marge de progrès est surtout en endurance : tenir plus longtemps une plus grande part de ta vitesse.`
      : `Ton coefficient de Riegel est de ${coef} : tu tiens bien ta vitesse quand l’effort s’allonge. Ta marge de progrès est surtout en vitesse, sur les efforts courts.`,
    loin: rapide
      ? 'Travaille ton point faible, l’endurance : des blocs longs juste sous ta vitesse critique, du tempo, du seuil 1 et du volume d’endurance. Garde quelques rappels de vitesse.'
      : 'Travaille ton point faible, la vitesse : des intervalles courts au-dessus de ta vitesse critique, des côtes courtes, des accélérations. Garde ton volume d’endurance.',
    pres: rapide
      ? 'Appuie-toi sur ta vitesse, ton point fort, et sur la spécificité de ton épreuve : sa durée, son dénivelé, son allure de course. Sur un format long, des sorties longues sur un terrain proche de la course.'
      : 'Appuie-toi sur ton endurance, ton point fort, et sur la spécificité de ton épreuve : sa durée, son dénivelé, son allure de course. Sur un format court, des séances à l’allure de course.',
    note: 'Le repère de 0,90 est un repère de coach. Ce profil oriente l’entraînement ; tes sensations et ton objectif décident.',
  };
}
