/**
 * Les signaux du suivi des athlètes coachés (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, T4) : la comparaison seule,
 * sans lecture ni écriture, avec les seuils que rend le moteur (cts_suivi, /v1/config). Séparée pour se tester sur des
 * données fabriquées, jamais sur celles d'un athlète.
 */
import { ajouterJours } from './plan';

export type Seuils = { jours: number; rpe_au_dessus: number; rpe_au_dessus_sl?: number; sensations_max: number; hooper_semaines: number;
  hooper_ecart: number };
// Une sortie longue, d'après son nom dans Nolio (« SL plaisir », « Back-to-back — Jour 1/2 (sortie longue) ») : son RPE
// se juge à prévu + 3 (décision coach du 21/10/2026, comme la règle R2 du moteur).
const SORTIE_LONGUE = /^SL\b|back-to-back|sortie longue/i;
export type Prevue = { id: string; name: string; date_start: string; rpe?: number | null };
export type Realisee = {
  id: string; name: string; date_start: string; planned?: string | null;
  debrief?: { rpe?: number | null; feeling?: number | null; comment?: string | null } | null;
};
export type ValeurHooper = { id: string; date_start: string; value: number | null };
export type GenreSignal = 'manquee' | 'plus_dur' | 'sensations' | 'hooper' | 'commentaire';
export type Signal = { genre: GenreSignal; jour: string; seance: string; detail: string };
export type Suivi = {
  prevues: number; faites: number; signaux: Signal[];
  hooper: { valeur: number; jour: string; moyenne: number | null } | null;
};

// Aujourd'hui en France, « AAAA-MM-JJ ».
export const aujourdhuiParis = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// T4 : ce qui mérite le regard du coach sur les « jours » derniers jours (aujourd'hui compris) — séance prévue passée
// sans réalisé rattaché, RPE noté au-dessus du prévu, mauvaises sensations, commentaire, et l'indice Hooper comparé à
// la moyenne de l'athlète sur les semaines précédentes (sans assez de valeurs, affiché sans alerte).
export function signaux(prevues: Prevue[], realisees: Realisee[], hooper: ValeurHooper[], s: Seuils, aujourdhui: string): Suivi {
  const debut = ajouterJours(aujourdhui, -(s.jours - 1));
  const dans = (jour: string) => jour >= debut && jour <= aujourdhui;
  const fenetre = prevues.filter((p) => dans(p.date_start));
  const rattachees = new Set(realisees.map((r) => r.planned).filter(Boolean));
  const prevueDe = new Map(prevues.map((p) => [p.id, p]));
  const liste: Signal[] = [];
  for (const p of fenetre)
    if (p.date_start < aujourdhui && !rattachees.has(p.id))
      liste.push({ genre: 'manquee', jour: p.date_start, seance: p.name, detail: 'aucune séance réalisée rattachée' });
  for (const r of realisees.filter((x) => dans(x.date_start))) {
    const d = r.debrief ?? {};
    const prevue = r.planned ? prevueDe.get(r.planned) : undefined;
    const ecart = prevue && SORTIE_LONGUE.test(prevue.name ?? '') ? (s.rpe_au_dessus_sl ?? 3) : s.rpe_au_dessus;
    if (prevue?.rpe != null && d.rpe != null && d.rpe >= prevue.rpe + ecart)
      liste.push({ genre: 'plus_dur', jour: r.date_start, seance: r.name, detail: `RPE ${d.rpe} pour ${prevue.rpe} prévu` });
    if (d.feeling != null && d.feeling <= s.sensations_max)
      liste.push({ genre: 'sensations', jour: r.date_start, seance: r.name, detail: `sensations ${d.feeling}/5` });
    if (d.comment?.trim())
      liste.push({ genre: 'commentaire', jour: r.date_start, seance: r.name, detail: 'à lire dans Nolio' });
  }
  const valeurs = hooper.filter((v): v is ValeurHooper & { value: number } => v.value !== null)
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const derniere = valeurs[valeurs.length - 1];
  let indice: Suivi['hooper'] = null;
  if (derniere && dans(derniere.date_start)) {
    const depuis = ajouterJours(derniere.date_start, -(7 * s.hooper_semaines + 3));
    const avant = valeurs.slice(0, -1).filter((v) => v.date_start >= depuis && v.date_start < derniere.date_start);
    const moyenne = avant.length >= s.hooper_semaines ? avant.reduce((t, v) => t + v.value, 0) / avant.length : null;
    indice = { valeur: derniere.value, jour: derniere.date_start, moyenne };
    if (moyenne !== null && derniere.value >= moyenne + s.hooper_ecart)
      liste.push({
        genre: 'hooper', jour: derniere.date_start, seance: 'Hooper',
        detail: `indice ${derniere.value} pour ${Math.round(moyenne * 10) / 10} en moyenne sur ${s.hooper_semaines} semaines`,
      });
  }
  liste.sort((a, b) => a.jour.localeCompare(b.jour));
  // Les séances d'aujourd'hui ne comptent qu'une fois faites : la journée n'est pas finie.
  const comptees = fenetre.filter((p) => p.date_start < aujourdhui || rattachees.has(p.id));
  return { prevues: comptees.length, faites: comptees.filter((p) => rattachees.has(p.id)).length, signaux: liste, hooper: indice };
}
