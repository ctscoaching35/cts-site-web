/**
 * Les retouches du coach dans Nolio (décision coach du 26/10/2026, « compter tes retouches » : la mesure du temps que
 * l'automatisation lui fait gagner, et la boussole du carnet d'améliorations du moteur, CTS_ETAT_CHANTIER.md). Chaque
 * nuit, pour la semaine en cours et la précédente de chaque objectif coaché écrit par le moteur, par famille de
 * séances : les séances envoyées, modifiées (leur révision Nolio a changé : le contenu, jamais le jour), supprimées, et
 * pour les modifiées la durée prévue et celle de Nolio (« dans quel sens », décision du même jour) ; et les séances de
 * course ajoutées dans la semaine, que l'app n'a pas posées (le moteur n'écrit pas une semaine où le coach a déjà posé
 * les siennes : ce qui s'y trouve en plus est venu après). Seuls des comptes sont gardés (table retouches), aucune
 * séance. Côté serveur seulement.
 */
import { destinataire, type SeanceEnvoyee } from './coaching';
import type { Compte } from './ecriture';
import { listeNolio, nolioConfigure, SPORTS_COURSE } from './nolio';
import { ajouterJours, type Jour, type Semaine } from './plan';
import { clientService } from './supabase';
import { minutesDe } from './tableau';

export const FAMILLES_RETOUCHE = ['ef', 'seuil1', 'seuil2', 'vo2max', 'allure', 'sl', 'mecanique', 'renfo'] as const;
export type FamilleRetouche = (typeof FAMILLES_RETOUCHE)[number];
// min_avant, min_apres : la durée prévue et celle de Nolio des séances modifiées dont la durée se lit (pas le renfo).
export type CompteFamille = { envoyees: number; modifiees: number; supprimees: number; min_avant: number; min_apres: number };
export type Familles = Partial<Record<FamilleRetouche, CompteFamille>>;

const RENFO = ':renfo';

// La famille d'une séance envoyée, d'après le jour écrit par le moteur ; null pour ce qui ne se compte pas (repos,
// course, notes).
export function familleRetouche(jourId: string, j: Pick<Jour, 'famille' | 'seance'> | undefined): FamilleRetouche | null {
  if (jourId.endsWith(RENFO)) return 'renfo';
  if (!j) return null;
  if (j.famille === 'ef' || j.famille === 'sl' || j.famille === 'mecanique') return j.famille;
  if (j.famille !== 'qualite') return null;
  if (j.seance.includes('Seuil 1')) return 'seuil1';
  if (j.seance.includes('Seuil 2')) return 'seuil2';
  if (j.seance.startsWith('Allure')) return 'allure';
  // VO2max, VO2max courte, côtes, course test.
  return 'vo2max';
}

type DansNolio = { id: string; date_start: string; sport?: string | null; revision?: string | null; duration?: { value?: number } | null };

// Les comptes d'une semaine envoyée, d'après ce qui est dans Nolio.
export function compterLaSemaine(semaine: Pick<Semaine, 'jours'>, envoyees: SeanceEnvoyee[], nolio: Map<string, DansNolio>): Familles {
  const familles: Familles = {};
  for (const s of envoyees) {
    if ((s.genre ?? 'seance') !== 'seance' || s.nolio_id === null || s.jour_id.startsWith('fiche:')) continue;
    const jour = semaine.jours.find((j) => j.id === s.jour_id.replace(RENFO, ''));
    const f = familleRetouche(s.jour_id, jour);
    if (!f) continue;
    const c = (familles[f] ??= { envoyees: 0, modifiees: 0, supprimees: 0, min_avant: 0, min_apres: 0 });
    c.envoyees += 1;
    const la = s.supprimee ? undefined : nolio.get(String(s.nolio_id));
    if (!la) {
      c.supprimees += 1;
      continue;
    }
    // Sans révision à l'envoi (un envoi de la v1), rien à comparer.
    if (!s.revision || !la.revision || la.revision === s.revision) continue;
    c.modifiees += 1;
    const avant = f === 'renfo' || !jour ? 0 : minutesDe(jour.duree);
    const apres = Math.round((la.duration?.value ?? 0) / 60);
    if (avant && apres) {
      c.min_avant += avant;
      c.min_apres += apres;
    }
  }
  return familles;
}

// Le lundi de la semaine en cours, à Paris.
function lundiDuJour() {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
}

// La nuit (app/api/retouches/compter) : une lecture Nolio par coaché, ses semaines écrites de la semaine en cours et de
// la précédente recomptées. Un coaché non compté (Nolio injoignable, temps écoulé) l'est la nuit suivante.
export async function compterLesRetouches(budgetMs = 240_000): Promise<Compte[]> {
  if (!nolioConfigure()) return [];
  const debut = Date.now();
  const service = clientService();
  const lundi = lundiDuJour();
  const precedent = ajouterJours(lundi, -7);
  const { data: lignes, error } = await service.from('semaines_ecrites').select('plan_id, numero, donnees')
    .gte('ecrite_le', new Date(Date.now() - 21 * 86400_000).toISOString());
  if (error) throw new Error(`semaines écrites : ${error.message}`);
  const ecrites = (lignes ?? []).filter((e) => [precedent, lundi].includes(String((e.donnees as Semaine | null)?.lundi)));
  if (!ecrites.length) return [];
  const { data: liens } = await service.from('coaching').select('plan_id, coach_id, athlete_id')
    .in('plan_id', [...new Set(ecrites.map((e) => e.plan_id as string))]);
  const athleteIds = [...new Set((liens ?? []).map((l) => l.athlete_id as string | null).filter((x): x is string => Boolean(x)))];
  if (!athleteIds.length) return [];
  const { data: fiches } = await service.from('athletes_coaches').select('id, nolio_athlete_id').in('id', athleteIds);
  // Tous les objectifs de chaque coaché : ce que l'app a posé pour l'un d'eux (sa saison de fond, une course) n'est pas
  // une séance ajoutée par le coach.
  const { data: freres } = await service.from('coaching').select('plan_id, athlete_id').in('athlete_id', athleteIds);
  const { data: envois } = await service.from('nolio_envois').select('plan_id, semaine, seances')
    .in('plan_id', [...new Set((freres ?? []).map((f) => f.plan_id as string))]);
  const comptes: Compte[] = [];
  for (const fiche of fiches ?? []) {
    const sesPlans = new Set((freres ?? []).filter((f) => f.athlete_id === fiche.id).map((f) => f.plan_id as string));
    const sesSemaines = ecrites.filter((e) => (liens ?? []).some((l) => l.plan_id === e.plan_id && l.athlete_id === fiche.id));
    if (!fiche.nolio_athlete_id || !sesSemaines.length) continue;
    if (Date.now() - debut > budgetMs) {
      sesSemaines.forEach((e) => comptes.push({ plan: e.plan_id as string, quoi: 'remis à la nuit suivante' }));
      continue;
    }
    try {
      const d = await destinataire(String(fiche.nolio_athlete_id));
      const lues = await listeNolio<DansNolio>(`planned/trainings/?date_from=${precedent}&date_to=${ajouterJours(lundi, 6)}`
        + `&with_revision=true${d.moi ? '' : `&athlete=${d.usr}`}`);
      const nolio = new Map(lues.map((x) => [x.id, x]));
      const posees = new Set((envois ?? []).filter((e) => sesPlans.has(e.plan_id as string))
        .flatMap((e) => (e.seances ?? []) as SeanceEnvoyee[]).map((s) => String(s.nolio_id ?? '')));
      const dejaComptees = new Set<string>();
      for (const e of sesSemaines) {
        const semaine = e.donnees as Semaine;
        const debutSemaine = semaine?.lundi;
        if (!debutSemaine) continue;
        const envoi = (envois ?? []).find((x) => x.plan_id === e.plan_id && x.semaine === e.numero);
        if (!envoi) continue;
        const fin = ajouterJours(debutSemaine, 6);
        // Une semaine de deux objectifs (une saison arrêtée, la préparation qui part) : ses ajouts comptés une fois.
        const ajoutees = dejaComptees.has(debutSemaine) ? 0 : lues.filter((x) => !posees.has(x.id)
          && SPORTS_COURSE.includes(String(x.sport)) && x.date_start.slice(0, 10) >= debutSemaine && x.date_start.slice(0, 10) <= fin).length;
        dejaComptees.add(debutSemaine);
        const familles = compterLaSemaine(semaine, (envoi.seances ?? []) as SeanceEnvoyee[], nolio);
        const lien = (liens ?? []).find((l) => l.plan_id === e.plan_id);
        const { error } = await service.from('retouches').upsert({
          plan_id: e.plan_id, semaine: e.numero, coach_id: lien?.coach_id, lundi: debutSemaine, familles, ajoutees,
          compte_le: new Date().toISOString(),
        });
        if (error) throw new Error(`retouches : ${error.message}`);
        comptes.push({ plan: e.plan_id as string, quoi: `${e.numero} comptée` });
      }
    } catch (err) {
      comptes.push({ plan: sesSemaines[0].plan_id as string, quoi: 'non comptée', erreur: err instanceof Error ? err.message : String(err) });
    }
  }
  return comptes;
}

// Pour « Chiffres » : les comptes du coach depuis un lundi, sommés par semaine et par famille.
export type RetouchesSemaine = { lundi: string; envoyees: number; modifiees: number; supprimees: number; ajoutees: number };
export async function retouchesDuCoach(coachId: string, depuis: string) {
  const { data, error } = await clientService().from('retouches').select('lundi, familles, ajoutees')
    .eq('coach_id', coachId).gte('lundi', depuis);
  // La table manque tant que la migration n'est pas passée : rien à montrer.
  if (error) return [];
  return (data ?? []) as { lundi: string; familles: Familles; ajoutees: number }[];
}
