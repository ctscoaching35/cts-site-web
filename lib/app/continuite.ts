/**
 * LA CONTINUITÉ, CÔTÉ SITE (décisions coach du 26/10/2026, CTS_CONTINUITE_REFLEXION.md dans le dépôt du moteur ; audit du
 * 30/10/2026, CTS_AUDIT_AUTOMATISATION_30_10.md) : le dimanche, avant d'écrire la semaine, les séances de course faites
 * des 4 dernières semaines, quel qu'en soit l'auteur (le moteur, le coach qui a réécrit, avant l'automatisation), lues
 * dans Nolio et classées par leur structure (lib/app/classement.ts). Le moteur en tire la marche de chaque famille
 * (cts_ajustements.continuite, règle C1). Seules les séances dont le RPE prévu dit une qualité (5 ou plus, ou sans RPE)
 * sont ouvertes une à une. Côté serveur seulement.
 */
import { classerSeance, type FamilleLue, type NoeudNolio, type ProfilLu } from './classement';
import { appelNolio, SPORTS_COURSE } from './nolio';
import { ajouterJours } from './plan';

// L'interrupteur (décision du coach attendue, audit du 30/10/2026) : faux, rien n'est lu ni envoyé au moteur.
export const CONTINUITE_ACTIVE = false;
// Les séances lues : les 4 dernières semaines.
const SEMAINES_LUES = 4;

export type SeanceLue = { date: string; famille: FamilleLue; minutes: number; reps: number; bloc_min: number;
  rpe_prevu: number | null; rpe: number | null; moteur: boolean };
type Prevue = { id: string; date_start: string; sport?: string | null; rpe?: number | null; duration?: { value?: number } | null };
type Reelle = { planned?: string | null; debrief?: { rpe?: number | null } | null };

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// planifiees, reelles : ce que lireRetours a déjà lu ; moteur : les identifiants Nolio des séances qu'il a envoyées ;
// athlete : le paramètre d'athlète des requêtes (vide pour le coach lui-même) ; au : la veille du lundi écrit.
export async function seancesLues(args: { planifiees: Prevue[]; reelles: Reelle[]; moteur: Set<string>; profil: ProfilLu;
  accordLecture: boolean; athlete: string; au: string }): Promise<SeanceLue[]> {
  const du = ajouterJours(args.au, -7 * SEMAINES_LUES + 1);
  const faites = new Map(args.reelles.filter((r) => r.planned).map((r) => [String(r.planned), r]));
  const candidates = args.planifiees.filter((p) => SPORTS_COURSE.includes(String(p.sport)) && faites.has(p.id)
    && p.date_start.slice(0, 10) >= du && p.date_start.slice(0, 10) <= args.au && (p.rpe == null || p.rpe >= 5));
  const lues: SeanceLue[] = [];
  for (const p of candidates) {
    await pause(150);
    const r = await appelNolio('GET', `planned/trainings/${p.id}/${args.athlete ? `?athlete=${args.athlete}` : ''}`);
    // Une séance illisible (un refus, un quota) se classe à son RPE prévu, sans structure.
    const workout = r.statut === 200 ? ((r.corps?.workout ?? []) as NoeudNolio[]) : [];
    const duree = typeof p.duration?.value === 'number' ? Math.round(p.duration.value / 60) : null;
    const c = classerSeance(workout, args.profil, p.rpe ?? null, duree);
    if (!c) continue;
    const reelle = faites.get(p.id);
    lues.push({ date: p.date_start.slice(0, 10), famille: c.famille, minutes: c.minutes, reps: c.reps, bloc_min: c.bloc_min,
      rpe_prevu: typeof p.rpe === 'number' ? p.rpe : null,
      rpe: args.accordLecture && typeof reelle?.debrief?.rpe === 'number' ? reelle.debrief.rpe : null,
      moteur: args.moteur.has(p.id) });
  }
  return lues;
}
