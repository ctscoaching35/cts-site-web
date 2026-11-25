// Fonctions pures, sans réseau ni base (scripts/test-saison-de-fond-v9.mjs). Sous le moteur v1, une saison de fond est sans fin : elle ne s'écrit plus quand une saison plus récente du même coaché
// a commencé à la semaine `lundi`. `debut`, `autres` : des lundis de début (AAAA-MM-JJ).
const dimancheDe = (lundi: string) => new Date(Date.parse(`${lundi}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
export const remplaceeParLaSuivante = (debut: string, autres: string[], lundi: string): boolean => autres.some((d) => d > debut && d <= dimancheDe(lundi));

// UN COACHÉ N'EST JAMAIS SANS SEMAINE (C6, C3) : le lundi `lundi` n'est pris que par une saison, par une préparation en route dont la course n'est pas passée, ou par une préparation qui part cette semaine-là.
// Après une dernière course, la saison commence donc tout de suite, par sa récupération (le moteur l'écrit d'après `course_precedente`). `parametres.fond` : une saison.
export type PlanCouvrant = { parametres: Record<string, unknown> | null; course_date: string; demarre_le: string | null; depart_prevu: string | null };
export function couvertV1(plans: PlanCouvrant[], lundi: string): boolean {
  return plans.some((p) => Boolean(p.parametres) && (p.parametres?.fond ? p.course_date >= lundi
    : (Boolean(p.demarre_le) && p.course_date >= lundi) || (!p.demarre_le && Boolean(p.depart_prevu) && String(p.depart_prevu) <= dimancheDe(lundi))));
}
