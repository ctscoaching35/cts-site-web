/**
 * La démonstration de l'app (cadrage, étape 1c : « le calendrier d'abord, sur un vrai plan du
 * corpus ») : deux plans du corpus de lecture, en données, et un jour simulé. Elle ne sert que
 * tant que Supabase n'est pas configuré, et en développement seulement (lib/app/contexte.ts).
 *
 * Les plans viennent de exemples/corpus_lecture/donnees.py (dépôt du moteur), jamais d'une
 * retouche à la main : on les régénère quand le moteur change.
 */
import L1 from './exemples/L1.json';
import L4 from './exemples/L4.json';
import { aujourdhuiIso, moment, type Plan } from './plan';

export const demonstrationOuverte = () => process.env.NODE_ENV !== 'production';

export const EXEMPLES: Record<string, { titre: string; plan: Plan }> = {
  L4: { titre: 'OCC — confirmé, 7 séances, 24 semaines', plan: L4 as unknown as Plan },
  L1: { titre: 'GRF18 — débutant, 3 séances, 12 semaines', plan: L1 as unknown as Plan },
};

// Le jour simulé par défaut : un mardi au milieu du plan, pour voir une semaine de travail
// plutôt que la date réelle, souvent avant le début des plans d'exemple.
export function jourParDefaut(plan: Plan) {
  const reel = aujourdhuiIso();
  if (moment(plan, reel) === 'pendant') return reel;
  const semaine = plan.semaines[Math.floor(plan.semaines.length * 0.6)];
  return semaine.jours[1]?.date_iso ?? plan.course.date_debut_plan;
}
