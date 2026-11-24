/**
 * LE DÉPART D'UN OBJECTIF SOUS LE MOTEUR v1 (décisions du coach du 24/11/2026) : ce que `demarrerObjectif` (lib/app/ecriture.ts) fait de plus que son calendrier
 * (les règles de départ, les doublons, la saison de fond arrêtée, qui restent celles d'avant) quand le moteur en ligne est une 9.x. Les réglages du moteur de la 8.x
 * (la charge recalée, le départ individualisé, le rythme, la durée au départ, le questionnaire du samedi de l'acheteur) n'existent plus : le moteur v1 prend lui-même
 * son entrée (`entree`), la course qu'il vient de courir (`course_precedente`) et ce que Nolio montre (`lu`, puis `nolio`). Le départ garde l'entrée et la course d'avant avec les
 * réponses du plan, pose les courses dans Nolio, et écrit la première semaine par la chaîne du moteur v1 (lib/app/passagesV9.ts), à partir du jour de départ. `lu` (entrée 203 :
 * sa plus longue sortie des 4 dernières semaines, la moyenne de ses 4 plus grosses semaines des 8 dernières) n'est pas lu ici : un objectif qui démarre est un plan sans état, et
 * son premier passage le lit, une fois, par le seul lecteur (lireLeDepartSiBesoin, lib/app/passeUnPlanV9.ts).
 */
import { aujourdhuiParis, fichesDesPreparations, poserCourse, type Course, type Objectif } from './ecriture';
import { ecrireLaSemaineDemandee } from './passagesV9';
import { entreesDuDepart } from './passeUnPlanV9';
import { clientService } from './supabase';

const ajouterJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function demarrerSousLeMoteurV1(o: Objectif, { premiere, depart, apres }: { premiere: string; depart: string; apres: { course_date: string; temps_h: number } | null }): Promise<{ numero: string }> {
  const aujourdhui = aujourdhuiParis();
  const entrees = entreesDuDepart({ premiere, apres });
  const parametres = { ...o.parametres, champs: { ...((o.parametres.champs ?? {}) as Record<string, unknown>), ...entrees } };
  await clientService().from('plans').update({ parametres, trame: null }).eq('id', o.planId);
  o.parametres = parametres;
  // OM3 : l'objectif et ses courses de préparation, en compétitions dans Nolio ; PO4 : la fiche d'une course de préparation qui tombe dans sa première semaine.
  const { course } = o.plan;
  await poserCourse(o, { nom: course.nom, date: course.date, distance_km: course.distance_km, dplus_m: course.dplus_m }, true);
  for (const c of ((o.parametres.courses_secondaires ?? []) as Course[])) if (c.date >= aujourdhui) await poserCourse(o, c, false);
  await fichesDesPreparations(o, ajouterJours(premiere, 6));
  // La première semaine : écrite par la chaîne du moteur v1 ; les jours d'avant le départ ne partent pas dans Nolio.
  return ecrireLaSemaineDemandee(o.planId, premiere, { depuis: depart > premiere ? depart : undefined });
}
