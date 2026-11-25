// Côté serveur : de quoi dire un mot par coaché sur « Mes athlètes » sous la 9.x (lib/app/unMot.ts) : trois lectures de la base du site (les fiches, les objectifs en cours, les semaines récentes de la v1), jamais Nolio.
// Une lecture qui échoue (migration pas passée) ne fait rien échouer : la ligne dit alors ce que ses points disent.
import type { SupabaseClient } from '@supabase/supabase-js';
import { gestesDeLObjectif, verifierObjectif } from './pageAthleteSimple';
import { lireLesReponsesRecentes, lireLesSemainesRecentes, sansReponseAuPoint } from './stockageV9';
import { testsASaisir, type SourcesDesReperes } from './testsASaisir';
import { rangerLesMots, unMot, type DeQuoiDireUnMot, type UnMot } from './unMot';
import type { EtatAthlete } from './mesAthletes';

const lundiDe = (jour: string) => new Date(Date.parse(`${jour}T12:00:00Z`) - ((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);

export type LigneDUnMot = { id: string; nom: string; un: UnMot };

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
  const parametresDe = new Map((plans as { id: string; parametres: { champs?: Record<string, unknown> } | null }[]).map((p) => [p.id, p.parametres]));
  return rangerLesMots(lignes.map((l): LigneDUnMot => {
    const planId = l.a.objectif?.plan_id ?? null;
    const parametres = planId ? parametresDe.get(planId) : null;
    const fiche = ficheDe.get(l.id);
    const verif = parametres ? verifierObjectif(parametres.champs ?? {}, fiche?.profil) : null;
    const test = planId ? testsASaisir({ semaines: semaines.filter((s) => s.planId === planId), sources: fiche?.reperes_sources, aujourdhui: jour })[0] ?? null : null;
    const entree: DeQuoiDireUnMot = {
      id: l.id, nolio: l.a.nolio, accord: l.a.accord, aLaMain: l.a.aLaMain || !l.a.coache, objectif: l.a.objectif, points: l.points,
      manque: verif?.manque[0] ?? null, gesteDuManque: verif ? gestesDeLObjectif(verif)[0] ?? null : null, test,
      sansReponse: planId ? sansReponseAuPoint(reponses, planId, lundiDe(jour)) : false,
    };
    return { id: l.id, nom: l.nom, un: unMot(entree) };
  }));
}
