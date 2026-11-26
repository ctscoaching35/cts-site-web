/**
 * UNE SÉRIE DU SAMEDI RETIRÉE DANS NOLIO PART D'ELLE-MÊME (demande du coach du 26/11/2026 : quand une chose est faite dans Nolio, la ligne s'en va), sous la 9.x (l'appelant le vérifie) : chaque athlète encore listé par la
 * base (lib/app/seriesDuSamedi.ts) est relu dans Nolio, ses questionnaires prévus de ce week-end ; sans « Ta semaine prochaine », la base l'oublie (`athletes_coaches.questionnaires.semaine`, ou la ligne
 * `questionnaire:semaine` d'un acheteur) et il n'est plus ni listé ni relu. Rien n'est écrit ni supprimé dans Nolio ; le Hooper n'est pas regardé. Une lecture ou un enregistrement qui échoue garde la ligne.
 * Côté serveur : les modules de Nolio et de la base se chargent à l'appel, pour que les écrans qui lisent « À faire » ne les emportent pas.
 */
import { QUESTIONNAIRE_SEMAINE } from './questionnaireSamedi';
import { lireLesSeriesDuSamedi, type SerieARetirer } from './seriesDuSamedi';

// Vrai seulement quand Nolio a répondu et n'a plus ce questionnaire du samedi au dimanche.
async function plusDansNolio(s: SerieARetirer): Promise<boolean> {
  if (!s.usr) return false;
  const { listeNolio, moiNolio } = await import('./nolio');
  const qui = (await moiNolio()).id === s.usr ? '' : `&athlete=${s.usr}`;
  const prevus = await listeNolio<{ id: string; name?: string }>(`planned/quizzes/?date_from=${s.samedi}&date_to=${s.dimanche}${qui}`);
  return !prevus.some((q) => q.name === QUESTIONNAIRE_SEMAINE.name);
}

async function oublier(coachId: string, s: SerieARetirer): Promise<void> {
  const { clientService } = await import('./supabase');
  const service = clientService();
  if (s.athleteId) {
    const { data, error } = await service.from('athletes_coaches').select('questionnaires').eq('id', s.athleteId).eq('coach_id', coachId).maybeSingle();
    if (error || !data?.questionnaires) throw new Error(error?.message ?? 'fiche sans questionnaires');
    const ecrit = await service.from('athletes_coaches').update({ questionnaires: { ...(data.questionnaires as Record<string, unknown>), semaine: null } })
      .eq('id', s.athleteId).eq('coach_id', coachId);
    if (ecrit.error) throw new Error(ecrit.error.message);
    return;
  }
  const { data, error } = await service.from('nolio_envois').select('seances').eq('plan_id', s.planId).eq('coach_id', coachId).eq('semaine', 'questionnaires').maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'envoi des questionnaires introuvable');
  const seances = ((data.seances ?? []) as { jour_id?: string }[]).filter((x) => x.jour_id !== 'questionnaire:semaine');
  const ecrit = await service.from('nolio_envois').update({ seances }).eq('plan_id', s.planId).eq('coach_id', coachId).eq('semaine', 'questionnaires');
  if (ecrit.error) throw new Error(ecrit.error.message);
}

// Les séries encore en place : celles de la base, moins celles que Nolio n'a plus. null si la base ne se lit pas.
export async function lireLesSeriesEncoreEnPlace(coachId: string, aujourdhui: string): Promise<SerieARetirer[] | null> {
  const series = await lireLesSeriesDuSamedi(coachId, aujourdhui);
  if (!series?.length) return series;
  const restent = await Promise.all(series.map(async (s) => {
    try {
      if (!(await plusDansNolio(s))) return s;
      await oublier(coachId, s);
      return null;
    } catch (e) {
      console.error(`Série du samedi (${s.cle}) non relue :`, e instanceof Error ? e.message : e);
      return s;
    }
  }));
  return restent.filter((s): s is SerieARetirer => s !== null);
}
