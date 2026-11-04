/**
 * RELIER UNE ACTIVITÉ À SA SÉANCE (Q1, décision coach du 04/11/2026, « A » ; elle remplace la règle des 2 jours de C2,
 * 04/11/2026). Nolio relie une activité à la séance prévue de course du même jour. Le site relie lui-même une activité
 * de course sans lien à une séance de course prévue et pas faite de la même semaine (du lundi au dimanche) seulement si
 * elle tombe le même jour, ou si elle porte le nom de la séance (une séance lancée depuis la montre). Sinon on ne relie
 * pas : la séance clé est manquée et se refait (R8), et l'activité compte comme une sortie en plus (une EF au moteur, RPE
 * 3 supposé sans RPE). Le nom de l'activité est son `name` dans Nolio (demandé dans `fields=`) ; sans nom, le même jour
 * seulement. Entre deux séances possibles : celle dont le nom est le sien, puis celle du même jour, puis la plus
 * ancienne. Les jours de course n'en relient aucune. Fonction pure.
 */
export type ActiviteReelle = { date_start: string; sport?: string | null; planned?: string | null; name?: string | null };
export type SeancePrevue = { id: string; date_start: string; sport?: string | null; name?: string | null };

const JOUR_MS = 86_400_000;
const jourDe = (iso: string) => iso.slice(0, 10);
const lundiDe = (jour: string) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const ecart = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / JOUR_MS);
// Le même nom : sans tenir compte des espaces ni de la casse ; un nom vide ne relie rien.
const normal = (nom: string | null | undefined) => String(nom ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
export const memeNom = (a: string | null | undefined, b: string | null | undefined) => normal(a) !== '' && normal(a) === normal(b);

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
    const nomme = (p: SeancePrevue) => (memeNom(r.name, p.name) ? 0 : 1);
    const candidates = libres.filter((p) => lundiDe(jourDe(p.date_start)) === lundiDe(jour)
      && (ecart(jourDe(p.date_start), jour) === 0 || memeNom(r.name, p.name)))
      .sort((a, b) => nomme(a) - nomme(b) || ecart(jourDe(a.date_start), jour) - ecart(jourDe(b.date_start), jour)
        || a.date_start.localeCompare(b.date_start));
    const p = candidates[0];
    if (!p) continue;
    reliees.set(r, p.id);
    libres.splice(libres.indexOf(p), 1);
  }
  return reels.map((r) => (reliees.has(r) ? { ...r, planned: reliees.get(r) } : r));
}
