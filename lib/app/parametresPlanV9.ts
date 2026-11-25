/**
 * LES PARAMÈTRES DU MOTEUR v1 POUR UN PLAN (CONTRAT_API_CTS.md, « MOTEUR v1 ») : ses réponses d'achat, ses tests tels que Nolio les a, et, d'un coaché, ce que son
 * coach a rempli sur sa fiche ; sa cible de glucides. Ce que lisent le passage du dimanche, la trame (« Mon plan ») et le questionnaire du matin. Côté serveur.
 */
import { clientService } from './supabase';
import type { Objectif } from './ecriture';
import { heuresDuTemps } from './jonction';
import { mineursRecus, type MajeurDuCoache } from './mineursDesMajeurs';
import { parametresDuPlanV9 } from './passeUnPlanV9';
import { profilDeLaFiche } from './profilEntrainement';
import { strategieDeLaCourse } from './strategie';
import { parametresAvecLaStrategie } from './strategieMoteur';

// Les courses d'un coaché qui tombent dans la récupération de son objectif d'avant (241, C3) : ce plan écrit cette récupération, elles partent avec ses courses de préparation (`courses_mineures`). Une lecture qui échoue n'en ajoute pas.
async function mineursDeCePlan(athleteId: string): Promise<(planId: string) => { date: string; temps_h: number | null; nom: string }[]> {
  const service = clientService();
  const { data: liens } = await service.from('coaching').select('plan_id').eq('athlete_id', athleteId);
  const ids = (liens ?? []).map((l) => l.plan_id as string);
  if (ids.length < 2) return () => [];
  const { data } = await service.from('plans').select('id, course_nom, course_date, intake, parametres').in('id', ids).not('parametres', 'is', null);
  const courses: MajeurDuCoache[] = (data ?? []).map((p) => {
    const champs = { ...((p.intake ?? {}) as Record<string, unknown>), ...(((p.parametres as { champs?: Record<string, unknown> } | null)?.champs) ?? {}) };
    return { id: p.id as string, course_nom: p.course_nom as string, course_date: p.course_date as string, temps_h: heuresDuTemps(champs.temps_cible),
      format: String(champs.format ?? ''), fond: Boolean((p.parametres as { fond?: unknown } | null)?.fond) };
  });
  return (planId) => mineursRecus(planId, courses);
}

export async function parametresDuObjectifV9(o: Objectif): Promise<Record<string, unknown>> {
  let fiche: Record<string, string | string[]> | null = null;
  // Les courses de préparation du plan, et, d'un coaché, ses autres courses qui tombent dans la récupération que ce plan écrit (une course gardée avec le plan passe avant : même date, une seule fois).
  let parametres = o.parametres;
  if (o.coache) {
    const { data } = await clientService().from('coaching').select('athlete_id').eq('plan_id', o.planId).maybeSingle();
    if (data?.athlete_id) {
      fiche = await profilDeLaFiche(String(data.athlete_id)).catch(() => null);
      const dans = await mineursDeCePlan(String(data.athlete_id)).then((f) => f(o.planId), () => []);
      if (dans.length) parametres = { ...o.parametres, courses_secondaires: [...((o.parametres.courses_secondaires ?? []) as unknown[]), ...dans] };
    }
  }
  const strategie = await strategieDeLaCourse(o.planId).catch(() => null);
  const glucides = (parametresAvecLaStrategie(o.parametres, strategie) as { glucides_cible?: unknown }).glucides_cible;
  return parametresDuPlanV9({ parametres, profil: o.profil as Record<string, number>, coache: o.coache, accordLecture: o.accordLecture,
    premierLundi: o.plan.semaines.find((s) => s.lundi)?.lundi ?? null, glucides: typeof glucides === 'number' ? glucides : null }, fiche);
}
