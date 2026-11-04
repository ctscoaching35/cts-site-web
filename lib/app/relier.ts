/**
 * C2 (audit du 03/11/2026, décision coach du 04/11/2026, « A ») : Nolio ne relie une séance faite à la séance prévue
 * que le jour même. Courue la veille ou le lendemain, elle comptait manquée, et l'activité, sans RPE, pour rien : une
 * semaine entièrement courue pouvait passer pour manquée. Le site relie lui-même une activité de course sans lien à la
 * séance de course prévue et pas faite la plus proche de la même semaine (du lundi au dimanche), à 2 jours au plus — à
 * égalité, la plus ancienne —, comme si Nolio l'avait fait. Les jours de course n'en relient aucune. Fonction pure.
 */
export type ActiviteReelle = { date_start: string; sport?: string | null; planned?: string | null };
export type SeancePrevue = { id: string; date_start: string; sport?: string | null };

const JOUR_MS = 86_400_000;
const jourDe = (iso: string) => iso.slice(0, 10);
const lundiDe = (jour: string) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const ecart = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / JOUR_MS);

export const RELIER_JOURS_MAX = 2;

// reels : les activités de la période ; prevues : les séances prévues (une marge autour) ; sports : ceux de la course ;
// joursDeCourse : les jours où une activité est la course elle-même. Rend les activités, dans leur ordre, reliées.
export function relierAuxPrevues<R extends ActiviteReelle>(reels: R[], prevues: SeancePrevue[], sports: readonly string[],
  joursDeCourse: Set<string> = new Set()): R[] {
  const faites = new Set(reels.map((r) => r.planned).filter((x): x is string => Boolean(x)));
  const libres = prevues.filter((p) => sports.includes(String(p.sport)) && !faites.has(p.id) && !joursDeCourse.has(jourDe(p.date_start)));
  const reliees = new Map<R, string>();
  for (const r of [...reels].sort((a, b) => a.date_start.localeCompare(b.date_start))) {
    const jour = jourDe(r.date_start);
    if (r.planned || !sports.includes(String(r.sport)) || joursDeCourse.has(jour)) continue;
    const candidates = libres.filter((p) => lundiDe(jourDe(p.date_start)) === lundiDe(jour) && ecart(jourDe(p.date_start), jour) <= RELIER_JOURS_MAX)
      .sort((a, b) => ecart(jourDe(a.date_start), jour) - ecart(jourDe(b.date_start), jour) || a.date_start.localeCompare(b.date_start));
    const p = candidates[0];
    if (!p) continue;
    reliees.set(r, p.id);
    libres.splice(libres.indexOf(p), 1);
  }
  return reels.map((r) => (reliees.has(r) ? { ...r, planned: reliees.get(r) } : r));
}
