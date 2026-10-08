/**
 * Le journal de séance (cadrage de l'app §7.2, décisions coach J1 à J7 du 08/10/2026) : les retours de
 * l'athlète et la jauge de préparation qu'on en tire. Compter les séances faites n'est pas une règle
 * d'entraînement : tout se calcule ici, sans le moteur. Jamais de douleur (J6).
 */
import { tousLesJours, type Jour, type Plan } from './plan';

export type Statut = 'faite' | 'raccourcie' | 'pas_faite';
export type Retour = { jour_id: string; statut: Statut; rpe: number | null; sensations: number | null };
export type Retours = Record<string, Retour>;

// « Ignorer » l'encart « Et hier ? » (actionsJournal.ignorerHier) : retenu sur l'appareil.
export const COOKIE_HIER = 'cts_hier_ignore';

export const SENSATIONS = ['Vidé', 'Fatigué', 'Normal', 'En forme', 'En pleine forme'] as const;
export const STATUTS: [Statut, string][] = [['faite', 'Faite'], ['raccourcie', 'Raccourcie'], ['pas_faite', 'Pas faite']];

// Une séance compte pour le journal : tout sauf le repos et la course.
export const seanceDuJournal = (j: Jour) => j.famille !== 'repos' && j.famille !== 'course';
export const faite = (r?: Retour) => r?.statut === 'faite' || r?.statut === 'raccourcie';

// Le RPE prévu d'une séance, pour régler la réglette : le haut d'une fourchette (« 4-5 » -> 5).
export function rpePrevu(j: Jour): number {
  const n = (j.rpe.match(/\d+/g) ?? []).map(Number);
  return n.length ? Math.max(...n) : 5;
}

// La marque du calendrier (J5) : ✓ faite, ½ raccourcie, – pas faite ; rien sans retour.
export const marque = (r?: Retour) =>
  r?.statut === 'faite' ? '✓' : r?.statut === 'raccourcie' ? '½' : r?.statut === 'pas_faite' ? '–' : null;

// « Faite · RPE ressenti 6 (prévu 7) · sensations 4/5 »
export function resume(r: Retour, j: Jour) {
  const libelle = STATUTS.find(([s]) => s === r.statut)![1];
  return [
    libelle,
    r.rpe !== null ? `RPE ressenti ${r.rpe} (prévu ${j.rpe})` : null,
    r.sensations !== null ? `sensations ${r.sensations}/5` : null,
  ].filter(Boolean).join(' · ');
}

export type EtatSemaine = 'pleine' | 'partielle' | 'manquee' | 'neutre' | 'encours' | 'avenir';

// La jauge de préparation (J4, forme A) : une case par semaine jusqu'à la course, les séances faites et
// les sorties longues faites sur celles déjà passées, les séances passées sans retour à part. Une
// séance passée : avant aujourd'hui, ou aujourd'hui si elle a déjà son retour.
export function jauge(plan: Plan, retours: Retours, aujourdhui: string) {
  const passee = (j: Jour) => !!j.date_iso && (j.date_iso < aujourdhui || (j.date_iso === aujourdhui && !!retours[j.id]));
  const seances = tousLesJours(plan).filter((j) => seanceDuJournal(j) && !j.semaine.passee && passee(j));
  const sl = seances.filter((j) => j.famille === 'sl');
  const enCours = plan.semaines.findIndex((s) => s.jours.some((j) => j.date_iso === aujourdhui));
  const cases: EtatSemaine[] = plan.semaines.map((s, i) => {
    if (s.passee) return 'neutre';
    if (i === enCours) return 'encours';
    if (s.jours.every((j) => !j.date_iso || j.date_iso > aujourdhui)) return 'avenir';
    const passees = s.jours.filter((j) => seanceDuJournal(j) && passee(j));
    const avecRetour = passees.filter((j) => retours[j.id]);
    if (avecRetour.length === 0) return 'neutre';
    const faites = passees.filter((j) => faite(retours[j.id])).length;
    if (faites === passees.length) return 'pleine';
    return faites > 0 ? 'partielle' : 'manquee';
  });
  return {
    semaine: enCours >= 0 ? enCours + 1 : null,
    total: plan.semaines.length,
    cases,
    faites: seances.filter((j) => faite(retours[j.id])).length,
    passees: seances.length,
    slFaites: sl.filter((j) => faite(retours[j.id])).length,
    slPassees: sl.length,
    sansRetour: seances.filter((j) => !retours[j.id]),
  };
}

// La séance d'hier sans retour, pour l'encart « Et hier ? » (J2).
export function seanceDHier(plan: Plan, retours: Retours, hier: string) {
  const j = tousLesJours(plan).find((x) => x.date_iso === hier);
  return j && seanceDuJournal(j) && !retours[j.id] ? j : null;
}
