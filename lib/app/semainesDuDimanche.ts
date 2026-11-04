/**
 * Les semaines du dimanche (« Dimanche », EC4, et le bilan de « Cette semaine ») : les objectifs dont la semaine du lundi
 * qui vient s'écrit au passage du dimanche soir, ceux qui sont déjà partis, et ceux que le coach écrit lui-même. Une seule
 * lecture, pour que les deux écrans comptent la même chose. Tout vient de la base. Côté serveur seulement.
 */
import { athletesCoaches, type FicheAthlete, type Objectif } from './coaching';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

// Le premier passage du dimanche (vercel.json, 17 h UTC) ; les reprises suivent à 19 h et 21 h.
export const HEURE_PASSAGE_UTC = 17;
export const apresLePassage = (d = new Date()) => d.getUTCDay() === 0 && d.getUTCHours() >= HEURE_PASSAGE_UTC;

// Le lundi qui vient, d'après un jour « AAAA-MM-JJ » (le lendemain un dimanche).
export const lundiQuiVient = (jour: string) => ajouterJours(jour, 7 - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));

export type SemaineDuDimanche = { a: FicheAthlete; o: Objectif; plan: Record<string, unknown> };
export type SemainesDuDimanche = {
  lundi: string;
  // Celles que le moteur écrit (programmation automatique), et les noms de ceux qu'il n'écrit pas.
  ecrites: SemaineDuDimanche[]; aLaMain: string[];
  // Les objectifs dont la semaine de ce lundi est déjà partie dans Nolio.
  partis: Set<string>;
};

// La semaine du lundi qui suit `jour`.
export async function semainesDuDimanche(coachId: string, jour: string): Promise<SemainesDuDimanche> {
  const service = clientService();
  const lundi = lundiQuiVient(jour);
  const fiches = (await athletesCoaches(coachId)).filter((a) => a.nolio_athlete_id);
  // Les objectifs encore en route, et ceux d'une course passée depuis moins de 6 semaines (sa récupération).
  const objectifs = fiches.flatMap((a) => a.objectifs.filter((o) => o.course_date >= ajouterJours(jour, -42)).map((o) => ({ a, o })));
  const ids = objectifs.map((x) => x.o.plan_id);
  const { data: plans } = ids.length
    ? await service.from('plans').select('id, parametres, demarre_le, depart_prevu').in('id', ids) : { data: [] };
  const parId = new Map((plans ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  const lignes = objectifs.flatMap(({ a, o }) => {
    const plan = parId.get(o.plan_id);
    return plan?.parametres && (plan.demarre_le || (plan.depart_prevu && String(plan.depart_prevu) <= lundi)) ? [{ a, o, plan }] : [];
  });
  // Une fiche passée en mode plan avant le 04/11/2026 (le mode n'est plus dans l'interface) : rien ne s'écrit pour elle,
  // comme pour une programmation à la main.
  const ecrites = lignes.filter(({ a }) => a.programmation === 'auto' && a.mode === 'coaching');
  const aLaMain = [...new Set(lignes.filter(({ a }) => !ecrites.some((e) => e.a.id === a.id)).map(({ a }) => a.nom))];
  const { data: parties } = ids.length
    ? await service.from('semaines_ecrites').select('plan_id').in('plan_id', ids).eq('donnees->>lundi', lundi) : { data: [] };
  return { lundi, ecrites, aLaMain, partis: new Set((parties ?? []).map((x) => x.plan_id as string)) };
}
