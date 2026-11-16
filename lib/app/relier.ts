/**
 * RELIER UNE ACTIVITÉ À SA SÉANCE (Q1, décision coach du 04/11/2026, « A » ; elle remplace la règle des 2 jours de C2,
 * 04/11/2026 ; complétée par la décision du coach du 16/11/2026, lot 0). Nolio relie une activité à la séance prévue de
 * course du même jour. Le site relie lui-même une activité de course sans lien à une séance de course prévue et pas faite
 * de la même semaine (du lundi au dimanche) :
 *   1. d'abord, comme avant : si elle tombe le même jour, ou si elle porte le nom de la séance (une séance lancée depuis la
 *      montre). Entre deux séances possibles : celle dont le nom est le sien, puis celle du même jour, puis la plus ancienne ;
 *   2. ensuite (16/11/2026), pour les activités que la première règle n'a pas reliées : à la séance prévue non faite la
 *      plus proche de la même semaine, en jour puis en durée, SI sa durée est à ±25 % de la durée prévue (une séance courue
 *      un autre jour que prévu reste la sienne). Une durée inconnue, d'un côté ou de l'autre, ne relie rien.
 * Sinon on ne relie pas : la séance clé est manquée et se refait (R8), et l'activité compte comme une sortie en plus (une EF
 * au moteur, RPE 3 supposé sans RPE). Le nom de l'activité est son `name` dans Nolio (demandé dans `fields=`) ; sans nom, le
 * même jour seulement. Les jours de course n'en relient aucune. Fonction pure.
 */
import { lireCode } from './codeSeance';
import { nomComparable } from './nomsSeances';

// duration : celle de Nolio, `{ value }` en secondes (ou un nombre de secondes).
type Duree = { value?: number | null } | number | null;
export type ActiviteReelle = { date_start: string; sport?: string | null; planned?: string | null; name?: string | null; duration?: Duree };
export type SeancePrevue = { id: string; date_start: string; sport?: string | null; name?: string | null; duration?: Duree };

// La tolérance de la durée (décision du coach du 16/11/2026) : ±25 % de la durée prévue.
export const TOLERANCE_DUREE = 0.25;
const secondes = (d: Duree | undefined) => (typeof d === 'number' ? d : typeof d?.value === 'number' ? d.value : 0);

const JOUR_MS = 86_400_000;
const jourDe = (iso: string) => iso.slice(0, 10);
const lundiDe = (jour: string) => {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const ecart = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / JOUR_MS);
// Le même nom : sans tenir compte des espaces ni de la casse ; un nom vide ne relie rien. « Back-to-back » et « week-end
// choc » sont le même nom (Q2, 05/11/2026 au soir : le moteur écrit le second, Nolio garde le premier pour les séances
// déjà écrites ; lib/app/nomsSeances.ts).
const normal = (nom: string | null | undefined) => nomComparable(nom);
export const memeNom = (a: string | null | undefined, b: string | null | undefined) => normal(a) !== '' && normal(a) === normal(b);

// La famille d'un nom, simple et prudente (sans casse ni accents) : « sl » (sortie longue, SL), « vo2 », « seuil », « tempo »,
// « ef » (EF, endurance) ; null sans mot reconnu. Pour une séance prévue, son code (« S2c … », « EF … ») passe d'abord.
const sansAccents = (nom: string) => nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const CODES: Record<string, string> = { seuil1: 'seuil', seuil2: 'seuil', tempo: 'tempo', vo2max: 'vo2', ef: 'ef' };
export function familleDuNom(nom: string | null | undefined, parCode = false): string | null {
  if (!nom) return null;
  if (parCode) {
    const c = lireCode(nom);
    if (c) return c.famille === 'SL' ? 'sl' : c.lue ? CODES[c.lue] ?? null : null;
  }
  const n = sansAccents(nom);
  if (/sortie longue|\bsl\b/.test(n)) return 'sl';
  if (/\bvo2/.test(n)) return 'vo2';
  if (/\bseuil/.test(n)) return 'seuil';
  if (/\btempo\b/.test(n)) return 'tempo';
  if (/\bef\b|endurance/.test(n)) return 'ef';
  return null;
}
// 0 si la séance prévue est de la famille que le nom de l'activité indique, 1 sinon.
const memeFamille = (r: { name?: string | null }) => {
  const f = familleDuNom(r.name);
  return (p: { name?: string | null }) => (f !== null && familleDuNom(p.name, true) === f ? 0 : 1);
};

// reels : les activités de la période ; prevues : les séances prévues (une marge autour) ; sports : ceux de la course ;
// joursDeCourse : les jours où une activité est la course elle-même ; jusquau : le dernier jour lu (la deuxième règle ne relie
// jamais à une séance prévue après lui : un jour pas encore couru). Rend les activités, dans leur ordre, reliées.
export function relierAuxPrevues<R extends ActiviteReelle>(reels: R[], prevues: SeancePrevue[], sports: readonly string[],
  joursDeCourse: Set<string> = new Set(), jusquau = ''): R[] {
  const faites = new Set(reels.map((r) => r.planned).filter((x): x is string => Boolean(x)));
  const libres = prevues.filter((p) => sports.includes(String(p.sport)) && !faites.has(p.id) && !joursDeCourse.has(jourDe(p.date_start)));
  const reliees = new Map<R, string>();
  const trie = [...reels].sort((x, y) => x.date_start.localeCompare(y.date_start));
  const reliable = (r: R) => !r.planned && sports.includes(String(r.sport)) && !joursDeCourse.has(jourDe(r.date_start));
  const lier = (r: R, p: SeancePrevue) => {
    reliees.set(r, p.id);
    libres.splice(libres.indexOf(p), 1);
  };
  // 1. Les règles d'avant : le même nom, le même jour.
  for (const r of trie) {
    if (!reliable(r)) continue;
    const jour = jourDe(r.date_start);
    const nomme = (p: SeancePrevue) => (memeNom(r.name, p.name) ? 0 : 1);
    const famille = memeFamille(r);
    const candidates = libres.filter((p) => lundiDe(jourDe(p.date_start)) === lundiDe(jour)
      && (ecart(jourDe(p.date_start), jour) === 0 || memeNom(r.name, p.name)))
      .sort((a, b) => nomme(a) - nomme(b) || ecart(jourDe(a.date_start), jour) - ecart(jourDe(b.date_start), jour)
        || famille(a) - famille(b) || a.date_start.localeCompare(b.date_start));
    if (candidates[0]) lier(r, candidates[0]);
  }
  // 2. La séance non faite la plus proche de la semaine, en jour puis en durée, à ±25 % de sa durée.
  for (const r of trie) {
    if (!reliable(r) || reliees.has(r)) continue;
    const jour = jourDe(r.date_start);
    const faite = secondes(r.duration);
    const famille = memeFamille(r);
    if (!faite) continue;
    const candidates = libres.filter((p) => lundiDe(jourDe(p.date_start)) === lundiDe(jour) && secondes(p.duration) > 0 && (!jusquau || jourDe(p.date_start) <= jusquau)
      && Math.abs(faite - secondes(p.duration)) <= TOLERANCE_DUREE * secondes(p.duration))
      .sort((a, b) => ecart(jourDe(a.date_start), jour) - ecart(jourDe(b.date_start), jour)
        || Math.abs(faite - secondes(a.duration)) - Math.abs(faite - secondes(b.duration))
        || famille(a) - famille(b) || a.date_start.localeCompare(b.date_start));
    if (candidates[0]) lier(r, candidates[0]);
  }
  return reels.map((r) => (reliees.has(r) ? { ...r, planned: reliees.get(r) } : r));
}
