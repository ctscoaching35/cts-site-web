/**
 * La démonstration de l'app (cadrage, étape 1c : « le calendrier d'abord, sur un vrai plan du
 * corpus ») : deux plans du corpus de lecture, en données, et un jour simulé. Elle n'existe
 * qu'en développement — en production, /app répond 404 jusqu'aux comptes (étape 1b).
 *
 * Les plans viennent de exemples/corpus_lecture/donnees.py (dépôt du moteur), jamais d'une
 * retouche à la main : on les régénère quand le moteur change.
 */
import L1 from './exemples/L1.json';
import L4 from './exemples/L4.json';
import { SCHEMA_PLAN, aujourdhuiIso, moment, type Plan } from './plan';

export const demonstrationOuverte = () => process.env.NODE_ENV !== 'production';

export const EXEMPLES: Record<string, { titre: string; plan: Plan }> = {
  L4: { titre: 'OCC — confirmé, 7 séances, 24 semaines', plan: L4 as unknown as Plan },
  L1: { titre: 'GRF18 — débutant, 3 séances, 12 semaines', plan: L1 as unknown as Plan },
};

export type Contexte = { cle: string; plan: Plan; jour: string };
export type Recherche = Promise<Record<string, string | string[] | undefined>>;

// Le jour simulé par défaut : un mardi au milieu du plan, pour voir une semaine de travail
// plutôt que la date réelle, souvent avant le début des plans d'exemple.
function jourParDefaut(plan: Plan) {
  const reel = aujourdhuiIso();
  if (moment(plan, reel) === 'pendant') return reel;
  const semaine = plan.semaines[Math.floor(plan.semaines.length * 0.6)];
  return semaine.jours[1]?.date_iso ?? plan.course.date_debut_plan;
}

export async function contexte(recherche: Recherche): Promise<Contexte> {
  const r = await recherche;
  const cle = typeof r.plan === 'string' && r.plan in EXEMPLES ? r.plan : 'L4';
  const plan = EXEMPLES[cle].plan;
  if (plan.schema !== SCHEMA_PLAN) throw new Error(`Plan au schéma ${plan.schema}, l'app lit le ${SCHEMA_PLAN}`);
  const jour = typeof r.jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.jour) ? r.jour : jourParDefaut(plan);
  return { cle, plan, jour };
}

// Un lien de l'app garde le plan et le jour simulés.
export const lien = (chemin: string, ctx: Contexte, extra: Record<string, string> = {}) =>
  `${chemin}?${new URLSearchParams({ plan: ctx.cle, jour: ctx.jour, ...extra })}`;
