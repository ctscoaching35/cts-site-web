/**
 * LE GARDE-FOU DES DÉPARTS EN DOUBLE (05/11/2026 au soir) : OM4 range les objectifs d'un même athlète dans l'ordre de
 * leurs courses (un objectif plus lointain se reprogramme après la récupération d'un plus proche ; un objectif qui tombe
 * avant un autre déjà en route est refusé). Deux objectifs dont la course a la MÊME date (un doublon) passaient pourtant
 * tous les deux : deux premières semaines dans le même Nolio. Un objectif ne démarre donc pas si un autre objectif du même
 * athlète est déjà démarré (ou vient de démarrer au même passage) et que ses semaines couvrent celle qui partirait.
 * Fonction pure, sans lecture : lib/app/ecriture.ts (demarrerObjectif) lui passe les autres objectifs.
 */

// Un autre objectif du même athlète : sa course, son départ, le lundi de sa première semaine (null : inconnu), et s'il
// s'agit d'une saison de fond (elle s'arrête d'elle-même quand une préparation part : lib/app/fond.ts, arreterLaSaison).
export type ObjectifVoisin = { course_nom: string; course_date: string; demarre: boolean; debut: string | null; fond?: boolean };

const dimancheDe = (lundi: string) => {
  const d = new Date(`${lundi}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
};

// L'objectif déjà démarré dont les semaines couvrent la semaine de ce lundi (de sa première semaine à celle de sa
// course), ou null. Une saison de fond ne compte pas ; un objectif dont la course est passée avant ce lundi non plus (sa
// récupération : OM4 et C5 placent déjà le départ de celui-ci).
export function objectifQuiCouvre<T extends ObjectifVoisin>(lundi: string, autres: T[]): T | null {
  const dimanche = dimancheDe(lundi);
  return autres.find((q) => q.demarre && !q.fond && q.course_date >= lundi && (!q.debut || q.debut <= dimanche)) ?? null;
}

// Le message au coach (une fois, comme les autres échecs de départ) et l'erreur du départ refusé.
export const messageDoublon = (athlete: string, parti: string, refuse: string) =>
  `${athlete} a deux objectifs qui partiraient la même semaine (${parti}, ${refuse}) : un seul est parti. Retire celui qui est en trop.`;
