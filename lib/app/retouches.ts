/**
 * Les retouches du coach dans Nolio (décision coach du 26/10/2026, « compter tes retouches » : la mesure du temps que
 * l'automatisation lui fait gagner, et la boussole du carnet d'améliorations du moteur, CTS_ETAT_CHANTIER.md). Chaque
 * nuit, pour la semaine en cours et la précédente de chaque objectif coaché écrit par le moteur, par famille de
 * séances : les séances envoyées, modifiées (leur révision Nolio a changé : le contenu, jamais le jour), dont déplacées
 * (Nolio change aussi la révision d'une séance seulement déplacée : une retouche, décision du coach du 16/11/2026),
 * supprimées, et pour les modifiées la durée prévue et celle de Nolio (« dans quel sens », décision du même jour) ; et les séances de
 * course ajoutées dans la semaine, que l'app n'a pas posées (le moteur n'écrit pas une semaine où le coach a déjà posé
 * les siennes : ce qui s'y trouve en plus est venu après). Seuls des comptes sont gardés (table retouches), aucune
 * séance. Côté serveur seulement.
 */
import { destinataire, type SeanceEnvoyee } from './coaching';
import { compterLaSemaine, type DansNolio, type Familles } from './retouchesCompte';
import type { Compte } from './ecriture';
import { listeNolio, nolioConfigure, SPORTS_COURSE } from './nolio';
import { ajouterJours, type Semaine } from './plan';
import { clientService } from './supabase';

// Le calcul pur (les familles, compterLaSemaine, la part sans retouche et la cible), à part pour se tester sans Next ni base.
export { FAMILLES_RETOUCHE, compterLaSemaine, familleRetouche, type CompteFamille, type FamilleRetouche, type Familles } from './retouchesCompte';
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
export type RetouchesSemaine = { lundi: string; envoyees: number; modifiees: number; deplacees: number; supprimees: number; ajoutees: number };
export async function retouchesDuCoach(coachId: string, depuis: string) {
  const { data, error } = await clientService().from('retouches').select('lundi, familles, ajoutees')
    .eq('coach_id', coachId).gte('lundi', depuis);
  // La table manque tant que la migration n'est pas passée : rien à montrer.
  if (error) return [];
  return (data ?? []) as { lundi: string; familles: Familles; ajoutees: number }[];
}
