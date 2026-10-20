/**
 * Les semaines que le moteur n'a pas écrites (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur ; décision coach du
 * 20/10/2026, « tableau de bord complet ») : celles d'un athlète que le coach programme à la main, et, pour tous, celles
 * d'entre deux objectifs ou d'avant une préparation. Chaque nuit, pour chaque coaché qui a donné son accord de lecture,
 * la semaine en cours et la précédente se résument depuis Nolio, dans la forme de semaines_ecrites.realise : ses
 * séances prévues et réalisées, leur durée et leur RPE (la charge), la plus longue, le dénivelé, son Hooper. Une
 * semaine que le moteur a écrite garde son propre résumé. Aucune séance n'est gardée (table semaines_athlete). Côté
 * serveur seulement.
 */
import { indiceHooper, type Realise } from './ecriture';
import { resumeDeLaSemaine, type Prevue, type Reelle } from './resumeSemaine';
import { listeNolio, moiNolio, nolioConfigure } from './nolio';
import { ajouterJours } from './plan';
import { clientService } from './supabase';

const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));

// Les lundis des semaines que le moteur a écrites pour ces objectifs.
async function lundisEcrits(planIds: string[]): Promise<Set<string>> {
  if (!planIds.length) return new Set();
  const { data } = await clientService().from('semaines_ecrites').select('plan_id, lundi:donnees->>lundi').in('plan_id', planIds);
  return new Set((data ?? []).map((l) => String((l as { lundi?: string | null }).lundi ?? '')).filter(Boolean));
}

export type CompteSemaines = { athlete: string; quoi: string; erreur?: string };
const REMIS = 'remis à la nuit suivante';

export async function resumerSemaines(budgetMs = 240_000): Promise<CompteSemaines[]> {
  if (!nolioConfigure()) return [];
  const debut = Date.now();
  const service = clientService();
  const moi = (await moiNolio()).id;
  const cetteSemaine = lundiDe(aujourdhuiParis());
  const lundis = [ajouterJours(cetteSemaine, -7), cetteSemaine];
  const { data: accords } = await service.from('nolio_accords').select('coach_id, nolio_athlete_id');
  const comptes: CompteSemaines[] = [];
  for (const a of accords ?? []) {
    const usr = String(a.nolio_athlete_id ?? '');
    if (!/^usr_/.test(usr)) continue;
    if (Date.now() - debut > budgetMs) {
      comptes.push({ athlete: usr, quoi: REMIS });
      continue;
    }
    try {
      const { data: fiches } = await service.from('athletes_coaches').select('id').eq('coach_id', a.coach_id).eq('nolio_athlete_id', usr);
      if (!fiches?.length) continue;
      const { data: liens } = await service.from('coaching').select('plan_id').in('athlete_id', fiches.map((f) => f.id));
      const ecrits = await lundisEcrits((liens ?? []).map((l) => l.plan_id as string));
      const aResumer = lundis.filter((l) => !ecrits.has(l));
      if (!aResumer.length) {
        comptes.push({ athlete: usr, quoi: 'semaines écrites par le moteur' });
        continue;
      }
      const qui = usr === moi ? '' : `&athlete=${usr}`;
      const item = await indiceHooper();
      for (const lundi of aResumer) {
        const dimanche = ajouterJours(lundi, 6);
        const prevues = await listeNolio<Prevue>(`planned/trainings/?date_from=${lundi}&date_to=${dimanche}${qui}`);
        const reelles = await listeNolio<Reelle>(`real/trainings/?date_from=${lundi}&date_to=${dimanche}`
          + `&fields=id,date_start,duration,elevation_gain,planned,debrief${qui}`);
        const valeurs = item
          ? await listeNolio<{ id: string; date_start: string; value: number | null }>(`metrics/values/?item=${item}&date_from=${lundi}&date_to=${dimanche}${qui}`)
          : [];
        const hooper = valeurs.filter((v) => typeof v.value === 'number').sort((x, y) => x.date_start.localeCompare(y.date_start)).at(-1)?.value ?? null;
        const realise = resumeDeLaSemaine(lundi, prevues, reelles, hooper);
        const rien = !realise.seances_prevues && !realise.seances_faites && realise.hooper === null;
        for (const f of fiches) {
          const { error } = rien
            ? await service.from('semaines_athlete').delete().eq('athlete_id', f.id).eq('lundi', lundi)
            : await service.from('semaines_athlete').upsert({ athlete_id: f.id, lundi, realise, maj_le: new Date().toISOString() });
          if (error) throw new Error(error.message);
        }
      }
      comptes.push({ athlete: usr, quoi: `${aResumer.length} semaine${aResumer.length > 1 ? 's' : ''} résumée${aResumer.length > 1 ? 's' : ''}` });
    } catch (e) {
      comptes.push({ athlete: usr, quoi: 'non résumé', erreur: e instanceof Error ? e.message : String(e) });
    }
  }
  return comptes;
}

// Les semaines résumées d'une fiche, pour sa saison (tableauDuPlan.saisonDuCoureur) ; vides avant la migration.
export async function semainesDeLaFiche(athleteId: string): Promise<Realise[]> {
  const { data, error } = await clientService().from('semaines_athlete').select('realise').eq('athlete_id', athleteId);
  if (error) return [];
  return (data ?? []).map((l) => l.realise as Realise);
}
