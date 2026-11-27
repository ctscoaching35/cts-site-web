// Côté serveur : de quoi dire un mot par coaché sur « Mes athlètes » sous la 9.x (lib/app/unMot.ts) : trois lectures de la base du site (les fiches, les objectifs en cours, les semaines récentes de la v1), jamais Nolio.
// Une lecture qui échoue (migration pas passée) ne fait rien échouer : la ligne dit alors ce que ses points disent.
import type { SupabaseClient } from '@supabase/supabase-js';
import { gestesDeLObjectif, verifierObjectif, type VerifObjectif } from './pageAthleteSimple';
import { estUneSaisonDeFond } from './reessayerDeSaison';
import { lireLesReponsesRecentes, lireLesSemainesRecentes, sansReponseAuPoint } from './stockageV9';
import { testsASaisir, type SourcesDesReperes } from './testsASaisir';
import { unMot, type DeQuoiDireUnMot, type UnMot } from './unMot';
import type { EtatAthlete } from './mesAthletes';

type Parametres = { champs?: Record<string, unknown>; fond?: unknown } | null;
type Date_ = { id: string; parametres: Parametres; prevu: string | null };
const sansTrace = (v: VerifObjectif): VerifObjectif => {
  const items = v.items.filter((i) => i.cle !== 'gpx');
  const manque = items.filter((i) => i.valeur === null).map((i) => i.manque);
  return { ...v, items, manque, complet: manque.length === 0 };
};

// L'objectif daté à venir de ces coachés, pas encore lancé : le plus proche, hors saisons.
async function objectifsDates(service: SupabaseClient, athletes: string[], jour: string): Promise<Map<string, Date_>> {
  const { data: liens } = await service.from('coaching').select('plan_id, athlete_id').in('athlete_id', athletes);
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  if (!ids.length) return new Map();
  const { data: plans } = await service.from('plans').select('id, course_date, demarre_le, depart_prevu, parametres').in('id', ids);
  const aVenir = ((plans ?? []) as { id: string; course_date: string; demarre_le: string | null; depart_prevu: string | null; parametres: Parametres }[])
    .filter((p) => p.parametres && !estUneSaisonDeFond(p.parametres) && !p.demarre_le && p.course_date >= jour)
    .sort((a, b) => a.course_date.localeCompare(b.course_date));
  const dates = new Map<string, Date_>();
  for (const p of aVenir) {
    const athlete = String((liens ?? []).find((l) => l.plan_id === p.id)?.athlete_id ?? '');
    if (!dates.has(athlete)) dates.set(athlete, { id: p.id, parametres: p.parametres, prevu: p.depart_prevu });
  }
  return dates;
}

const lundiDe = (jour: string) => new Date(Date.parse(`${jour}T12:00:00Z`) - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);

// saison : en saison de fond, dit à côté de son nom même quand un autre mot passe devant (le coach, 27/11/2026).
// tag : à côté de son nom, la saison de fond ou sa prochaine course ; aLaMain : programmé à la main (la liste claire, le coach, 27/11/2026).
export type LigneDUnMot = { id: string; nom: string; un: UnMot; tag?: string | null; aLaMain?: boolean };

// `lignes` : dans l'ordre de Nolio (lib/app/espaceParAthlete.ts, ordonner), que la liste garde (demande du coach du 26/11/2026 ; ce qui l'attend ne change plus l'ordre).
export async function lireLesMots(service: SupabaseClient, coachId: string, lignes: EtatAthlete[], jour: string): Promise<LigneDUnMot[]> {
  const planIds = lignes.flatMap((l) => (l.a.objectif ? [l.a.objectif.plan_id] : []));
  const depuis = new Date(Date.parse(`${jour}T12:00:00Z`) - 70 * 86_400_000).toISOString();
  const [fiches, plans, semaines, reponses] = await Promise.all([
    service.from('athletes_coaches').select('id, profil, reperes_sources').eq('coach_id', coachId).then((r) => r.data ?? [], () => []),
    planIds.length ? service.from('plans').select('id, parametres').in('id', planIds).then((r) => r.data ?? [], () => []) : Promise.resolve([]),
    lireLesSemainesRecentes(service, planIds, depuis).catch(() => []),
    lireLesReponsesRecentes(service, planIds, depuis).catch(() => []),
  ]);
  const ficheDe = new Map((fiches as { id: string; profil: Record<string, unknown> | null; reperes_sources: SourcesDesReperes | null }[]).map((f) => [f.id, f]));
  const parametresDe = new Map((plans as { id: string; parametres: Parametres }[]).map((p) => [p.id, p.parametres]));
  // En saison de fond : son objectif daté à venir, s'il en a un (la saison, plus proche, passe devant lui dans la liste), c'est lui qui attend le coach.
  const enSaison = lignes.filter((l) => l.a.objectif && estUneSaisonDeFond(parametresDe.get(l.a.objectif.plan_id))).map((l) => l.id);
  const dates = enSaison.length ? await objectifsDates(service, enSaison, jour).catch(() => new Map<string, Date_>()) : new Map<string, Date_>();
  return lignes.map((l): LigneDUnMot => {
    const planId = l.a.objectif?.plan_id ?? null;
    const parametres = planId ? parametresDe.get(planId) : null;
    const fiche = ficheDe.get(l.id);
    const saison = Boolean(planId && estUneSaisonDeFond(parametres));
    const date = saison ? dates.get(l.id) ?? null : null;
    const sansObjectif = !planId || (saison && !date);
    // Sans objectif daté (en saison de fond, ou pas encore) : ce que le moteur lit de sa fiche, sa semaine comprise, sans trace.
    const verif = date ? verifierObjectif(date.parametres?.champs ?? {}, fiche?.profil)
      : sansObjectif ? l.a.coache && !l.a.aLaMain ? sansTrace(verifierObjectif(fiche?.profil ?? {}, fiche?.profil)) : null
        : parametres ? verifierObjectif(parametres.champs ?? {}, fiche?.profil) : null;
    const test = planId ? testsASaisir({ semaines: semaines.filter((s) => s.planId === planId), sources: fiche?.reperes_sources, aujourdhui: jour })[0] ?? null : null;
    const entree: DeQuoiDireUnMot = {
      id: l.id, nolio: l.a.nolio, accord: l.a.accord, aLaMain: l.a.aLaMain || !l.a.coache, points: l.points, saison: saison && !date,
      objectif: date && l.a.objectif ? { ...l.a.objectif, plan_id: date.id, demarre: false, prevu: date.prevu } : saison ? l.a.objectif && { ...l.a.objectif, demarre: true } : l.a.objectif,
      manque: verif?.manque[0] ?? null, gesteDuManque: verif ? gestesDeLObjectif(verif)[0] ?? null : null, test,
      sansReponse: planId ? sansReponseAuPoint(reponses, planId, lundiDe(jour)) : false,
    };
    const course = l.a.objectif && l.a.objectif.course_date >= jour ? l.a.objectif.course_nom : null;
    return { id: l.id, nom: l.nom, un: unMot(entree), tag: saison ? 'Saison de fond' : course, aLaMain: l.a.aLaMain };
  });
}
