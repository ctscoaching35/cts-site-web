/**
 * LA JONCTION DE DEUX OBJECTIFS, côté site (moteur 8.457 ; décisions coach du 07/11/2026, « tout A » ;
 * CTS_JONCTION_OBJECTIFS.md du moteur, §8). Un objectif qui démarre après la course d'un autre, ou qui coupe une saison
 * de fond : ce que le site décide et pose à son départ. Des dates seulement, sans base ni réseau
 * (node --test scripts/test-jonction.mjs).
 */
import { joursRecuperation } from '../plan';
import { ajouterJours } from './plan';

const rangDuJour = (jour: string) => (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;
export const lundiDe = (jour: string) => ajouterJours(jour, -rangDuJour(jour));

// LA RÉCUPÉRATION APRÈS L'OBJECTIF (lib/plan.ts, joursRecuperation : deux jours par heure de course, 3 à 21 ; 14 au moins
// dès 3 h et après un marathon sur route), jusqu'au lundi qui suit : le lundi de reprise.
export function debutApres(q: { course_date: string; temps_h: number; format?: string }): string {
  const fin = ajouterJours(q.course_date, joursRecuperation(q.temps_h, q.format));
  return ajouterJours(fin, 7 - rangDuJour(fin));
}

// La reprise allégée : la première semaine écrite suit de près la récupération, au plus une semaine après le lundi de
// reprise (pas une préparation qui commence des semaines plus tard, QD2).
export const enReprise = (lundiReprise: string, premier: string) => lundiReprise >= ajouterJours(premier, -7);

// LE DÉPART D'UNE PRÉPARATION LOINTAINE (décision 12, « A ») : sa semaine 1 commence plus d'une semaine après le lundi de
// reprise. Son départ se programme à sa semaine 1, et la saison de fond tourne entre-temps. Avant, il se programmait au
// lundi de reprise : sa semaine 1 partait ce jour-là dans Nolio, des semaines d'avance, et la saison ne démarrait jamais.
export const preparationLointaine = (debutPreparation: string, lundiReprise: string) =>
  debutPreparation > ajouterJours(lundiReprise, 7);

// Le départ programmé d'un objectif (demarrerObjectif), dans l'ordre : après la récupération d'un objectif précédent
// (OM4), sauf une préparation lointaine ; après les séances que le coach a déjà posées (PC1) ; au premier lundi d'une
// préparation qui commence plus tard (décision coach du 22/10/2026) ; au lundi programmé. null : il part maintenant.
// debut : le lundi de la première semaine pas encore finie du plan ; premierJour : le jour où sa première semaine partirait.
export type Programme = { prevu: string; apres: string; raison: 'recuperation' | 'seances' | 'preparation' };
export function departCalcule(x: {
  aujourdhui: string; debut: string; premierJour: string; lundi?: string;
  apres: { lundi: string; nom: string } | null; posees: { lundi: string; derniere: string } | null;
}): Programme | null {
  const { aujourdhui, debut, premierJour, lundi, apres, posees } = x;
  if (apres && apres.lundi > aujourdhui && (!posees || apres.lundi >= posees.lundi) && !preparationLointaine(debut, apres.lundi)) {
    return { prevu: apres.lundi, apres: apres.nom, raison: 'recuperation' };
  }
  if (posees && posees.lundi > premierJour) return { prevu: posees.lundi, apres: posees.derniere, raison: 'seances' };
  if (debut > ajouterJours(aujourdhui, 1)) return { prevu: debut, apres: debut, raison: 'preparation' };
  if (lundi && lundi > aujourdhui) return { prevu: lundi, apres: aujourdhui, raison: 'seances' };
  return null;
}

// LE LUNDI D'OÙ REPART LE RYTHME (« rythme_depuis » des paramètres, que le moteur lit depuis 8.457 ; la règle commune) :
// cette semaine est l'allégée du cycle, puis 3 semaines de charge et 1 allégée jusqu'à l'affûtage ; les blocs restent
// calés sur la course. Après une course (la reprise, et l'acheteur d'un second plan, décision 11) : le lundi de la
// première semaine écrite en reprise. Une préparation qui coupe une saison de fond (décision 7) : le lundi de la dernière
// allégée de la saison, dans les 4 semaines d'avant (ses semaines telles que son plan les prévoit ; la saison courait
// la semaine d'avant). Sinon null : un départ en cours de route, et rien pour un objectif déjà parti (décision 13).
export function lundiDuRythme(x: { premier: string; reprise: boolean; saison?: { lundi?: string | null; type: string }[] | null }): string | null {
  const lundi = lundiDe(x.premier);
  if (x.reprise) return lundi;
  const avant = (x.saison ?? []).flatMap((s) => (s.lundi && s.lundi < lundi ? [{ lundi: s.lundi, type: s.type }] : []));
  if (!avant.some((s) => s.lundi === ajouterJours(lundi, -7))) return null;
  return avant.filter((s) => s.type === 'Assimilation' && s.lundi >= ajouterJours(lundi, -28)).map((s) => s.lundi).sort().pop() ?? null;
}

// LA PREMIÈRE SORTIE LONGUE APRÈS LA COURSE (décision 6, « A ») : le recalage sur l'objectif précédent part de 75 % de sa
// plus longue sortie d'avant l'affûtage (la course a abîmé les tissus) ; la règle de saut du moteur (+10 % par semaine au
// plus) la fait remonter. Avant, 100 % : la première sortie longue après la reprise dépassait souvent celle d'avant la
// course.
// Jamais sous le plancher du questionnaire (45 min, cts_intake.SORTIE_LONGUE_MIN_H), que le moteur refuserait.
export const PART_SL_APRES_COURSE = 0.75;
const PLANCHER_SL_MIN = 45;
export const slApresCourse = (minutes: number) => Math.max(Math.min(minutes, PLANCHER_SL_MIN), minutes * PART_SL_APRES_COURSE);
// « 4h05 », à la minute, comme le moteur les écrit (cts_semaine._duree_texte).
export const dureeTexte = (minutes: number) => {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

// LA SAISON DE FOND QUI SUIT UNE RÉCUPÉRATION (décision 8, « A ») : sa première semaine s'écrit en reprise (allégée, une
// seule qualité), comme une préparation. lundi : celui de sa première semaine ; precedents : les objectifs déjà partis du
// coaché, saisons de fond exclues.
export function saisonEnReprise(lundi: string, precedents: { course_date: string; temps_h: number; format?: string }[]): boolean {
  return precedents.some((q) => q.course_date < lundi && enReprise(debutApres(q), lundi));
}
