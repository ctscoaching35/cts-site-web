/**
 * Ce que le moteur reçoit de la stratégie de course gardée (lib/app/strategie.ts) : ses glucides par heure, comme avant
 * (glucides_cible, décision coach du 26/10/2026), et depuis la décision coach du 12/11/2026 (« Q2 A ») ses quatre repères
 * (parametres.strategie) : glucides, boisson, sodium par litre bu, caféine et son moment, avec ses réponses sur sa sueur,
 * la chaleur et son intestin. Ni son poids ni rien de nouveau dans la base : le site les renvoie chaque semaine. Fonctions
 * pures (scripts/test-strategie-moteur.mjs).
 */
import type { Strategie } from './strategie';

export type Fourchette = [number, number];
export type StrategieMoteur = {
  glucides_g_h: Fourchette;
  boisson_ml_h: Fourchette | null;
  sodium_mg_l: Fourchette | null; // null : rien de systématique (la carte « Rien »)
  cafeine_mg: Fourchette | null;
  cafeine_moment: string | null; // le « sous » de la carte Caféine (« une heure avant »)
  sueur: string; conditions: string; intestin: string; // ses réponses au calculateur
};
type Lue = Pick<Strategie, 'entrees' | 'cartes'> | null | undefined;

// Une fourchette lue dans une carte (« 45 à 55 g », « 70 g », « 500-700 mL ») : [bas, haut] entre min et max, null sinon.
export function fourchetteDe(valeur: string, min: number, max: number): Fourchette | null {
  const m = /(\d{2,3})(?:\s*(?:-|–|à)\s*(\d{2,3}))?/.exec(valeur);
  if (!m) return null;
  const bas = Number(m[1]);
  const haut = m[2] ? Number(m[2]) : bas;
  return bas >= min && haut <= max && bas <= haut ? [bas, haut] : null;
}

const carte = (s: Lue, nom: string) => s?.cartes.find((c) => c.nom === nom);

// Ses glucides par heure du jour J, [bas, haut], tirés de la carte « Glucides » (« 70 g/h », « 60-75 g/h ») ; null sans
// stratégie. Le moteur y fait arriver l'entraînement de l'intestin de ses sorties longues (décision coach du 26/10/2026,
// « la stratégie dépend surtout de l'athlète »).
export const glucidesDeLaStrategie = (s: Lue): Fourchette | null => fourchetteDe(carte(s, 'Glucides')?.valeur ?? '', 20, 130);

// Le sodium par litre bu, la règle du calculateur (public/calculateur-nutrition.html, « Le sodium : la concentration par
// litre bu ») : jusqu'à 3 h, 500 à 700 mg (la boisson salée par forte chaleur) ; au-delà selon la sueur, peu 500, moyenne
// 500 à 700, salée 700 à 800, et jusqu'à 800 par forte chaleur (chaud ou humide) quand elle n'est pas salée. Sa carte
// donne des mg par heure (ce litre fois le milieu de sa boisson) ; scripts/test-strategie-moteur.mjs vérifie que cette
// règle reste celle du calculateur.
export function sodiumParLitre(dureeH: number, sueur: string | null, conditions: string | null): Fourchette {
  const chaud = conditions === 'chaud' || conditions === 'humide';
  let parL: Fourchette = dureeH <= 3 ? [500, 700] : sueur === 'faible' ? [500, 500] : sueur === 'elevee' ? [700, 800] : [500, 700];
  if (dureeH > 3 && chaud && sueur !== 'elevee') parL = [parL[0], 800];
  return parL;
}

// Les réponses cochées d'avance dans le calculateur : une stratégie gardée sans elles a été calculée avec elles.
const PAR_DEFAUT = { sueur: 'moderee', conditions: 'tempere', intestin: 'non' };

// Ses quatre repères pour le moteur ; null sans stratégie, ou si sa carte Glucides ne se lit pas (comme glucides_cible).
// Une autre carte qui ne se lit pas donne null pour elle seule ; la carte Sodium « Rien » aussi.
export function strategiePourLeMoteur(s: Lue): StrategieMoteur | null {
  const glucides = glucidesDeLaStrategie(s);
  if (!s || !glucides) return null;
  const e = s.entrees;
  const reponses = {
    sueur: e.sueur || PAR_DEFAUT.sueur, conditions: e.conditions || PAR_DEFAUT.conditions, intestin: e.intestin || PAR_DEFAUT.intestin,
  };
  const sodium = carte(s, 'Sodium')?.valeur ?? '';
  const sale = !/^rien/i.test(sodium) && fourchetteDe(sodium, 50, 1500) !== null;
  const dureeH = Number(e.heures || 0) + Number(e.minutes || 0) / 60;
  const cafeine = fourchetteDe(carte(s, 'Caféine')?.valeur ?? '', 10, 400);
  return {
    glucides_g_h: glucides,
    boisson_ml_h: fourchetteDe(carte(s, 'Boisson')?.valeur ?? '', 200, 1200),
    sodium_mg_l: sale ? sodiumParLitre(dureeH, reponses.sueur, reponses.conditions) : null,
    cafeine_mg: cafeine,
    cafeine_moment: cafeine ? carte(s, 'Caféine')?.sous || null : null,
    ...reponses,
  };
}

// Les paramètres envoyés au moteur sans sa stratégie : rien d'une semaine passée ne repart, ni ne se garde dans la base
// quand le moteur rend ses paramètres (envoyerEtRanger).
export function sansLaStrategie(parametres: Record<string, unknown>): Record<string, unknown> {
  if (!('strategie' in parametres)) return parametres;
  const { strategie: _passee, ...reste } = parametres;
  return reste;
}

// Les paramètres de la semaine pour le moteur : glucides_cible comme avant, et sa stratégie à côté, d'une seule lecture.
export function parametresAvecLaStrategie(parametres: Record<string, unknown>, s: Lue): Record<string, unknown> {
  const strategie = strategiePourLeMoteur(s);
  const base = sansLaStrategie(parametres);
  return strategie ? { ...base, glucides_cible: strategie.glucides_g_h, strategie } : base;
}
