/**
 * Les chiffres du coaching individualisé (maquette validée par le coach le 24/10/2026, onglet « Coaching
 * individualisé » de « Chiffres ») : ses athlètes coachés, leurs objectifs en route, et semaine par semaine ce que le
 * moteur a écrit, ce qu'il a ajusté, et les Hooper reçus ; ses retouches dans Nolio (décision coach du 26/10/2026),
 * comptées la nuit (lib/app/retouches.ts). Tout vient de la base, rien n'est lu dans Nolio. Côté serveur seulement.
 */
import { athletesCoaches } from './coaching';
import type { Realise } from './ecriture';
import { ajouterJours } from './plan';
import { FAMILLES_RETOUCHE, retouchesDuCoach, type FamilleRetouche, type RetouchesSemaine } from './retouches';
import { clientService } from './supabase';

export type SemaineCoaching = { lundi: string; ecrites: number; ajustements: number; hooper: number; resumees: number };
// Par famille, sur les 4 dernières semaines : ecart, l'écart de durée des séances modifiées (−0,15 : 15 % plus courtes),
// null sans durée lue.
export type RetouchesFamille = { famille: FamilleRetouche; envoyees: number; modifiees: number; supprimees: number; ecart: number | null };
export type ChiffresCoaching = {
  coaches: number; aLaMain: number; enRoute: number; semaines: SemaineCoaching[];
  retouches: { semaines: RetouchesSemaine[]; familles: RetouchesFamille[] } | null;
};

const SEMAINES = 8;

export async function chiffresDuCoaching(coachId: string): Promise<ChiffresCoaching> {
  const service = clientService();
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const lundi = ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const lundis = Array.from({ length: SEMAINES }, (_, i) => ajouterJours(lundi, -7 * i));
  const fiches = (await athletesCoaches(coachId)).filter((a) => a.mode === 'coaching');
  const planIds = fiches.flatMap((a) => a.objectifs.map((o) => o.plan_id));
  const { data: plans } = planIds.length
    ? await service.from('plans').select('id, demarre_le, course_date, parametres').in('id', planIds)
    : { data: [] };
  const { data: ecrites } = planIds.length
    ? await service.from('semaines_ecrites').select('lundi:donnees->>lundi, journal, sans_ajustement, realise').in('plan_id', planIds)
      .gte('ecrite_le', new Date(Date.parse(`${lundis[SEMAINES - 1]}T00:00:00Z`) - 7 * 86400_000).toISOString())
    : { data: [] };
  const { data: horsMoteur } = fiches.length
    ? await service.from('semaines_athlete').select('lundi, realise').in('athlete_id', fiches.map((a) => a.id)).gte('lundi', lundis[SEMAINES - 1])
    : { data: [] };
  type Ecrite = { lundi: string | null; journal: unknown[] | null; sans_ajustement: boolean | null; realise: Realise | null };
  const lignes = (ecrites ?? []) as Ecrite[];
  const semaines = lundis.map((l): SemaineCoaching => {
    const duLundi = lignes.filter((x) => x.lundi === l);
    const resumes = [...duLundi.map((x) => x.realise), ...(horsMoteur ?? []).filter((x) => x.lundi === l).map((x) => x.realise as Realise | null)]
      .filter((r): r is Realise => Boolean(r));
    return {
      lundi: l, ecrites: duLundi.length,
      ajustements: duLundi.filter((x) => !x.sans_ajustement && (x.journal ?? []).length > 0).length,
      hooper: resumes.filter((r) => r.hooper !== null).length, resumees: resumes.length,
    };
  });
  // Les retouches : rien tant qu'aucune semaine n'a été comptée.
  const comptees = await retouchesDuCoach(coachId, lundis[SEMAINES - 1]);
  const retouches = comptees.length ? {
    semaines: lundis.map((l): RetouchesSemaine => {
      const duLundi = comptees.filter((x) => x.lundi === l);
      const somme = (k: 'envoyees' | 'modifiees' | 'supprimees') =>
        duLundi.reduce((t, x) => t + Object.values(x.familles).reduce((u, f) => u + (f?.[k] ?? 0), 0), 0);
      return { lundi: l, envoyees: somme('envoyees'), modifiees: somme('modifiees'), supprimees: somme('supprimees'),
        ajoutees: duLundi.reduce((t, x) => t + x.ajoutees, 0) };
    }),
    familles: FAMILLES_RETOUCHE.map((famille): RetouchesFamille => {
      const f = comptees.filter((x) => lundis.slice(0, 4).includes(x.lundi)).map((x) => x.familles[famille]).filter((x) => x !== undefined);
      const somme = (k: 'envoyees' | 'modifiees' | 'supprimees' | 'min_avant' | 'min_apres') => f.reduce((t, x) => t + x[k], 0);
      const avant = somme('min_avant');
      return { famille, envoyees: somme('envoyees'), modifiees: somme('modifiees'), supprimees: somme('supprimees'),
        ecart: avant ? somme('min_apres') / avant - 1 : null };
    }).filter((f) => f.envoyees > 0),
  } : null;
  return {
    coaches: fiches.length, aLaMain: fiches.filter((a) => a.programmation === 'main').length,
    // Les saisons de fond ne sont pas des objectifs (décisions coach du 24/10/2026).
    enRoute: (plans ?? []).filter((p) => p.demarre_le && String(p.course_date) >= jour
      && !(p.parametres as { fond?: unknown } | null)?.fond).length,
    semaines, retouches,
  };
}
