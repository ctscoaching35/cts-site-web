// Aucun réseau, aucune base : les heures des passages du dimanche soir, à l'heure de Paris toute l'année (scripts/test-heures-v9.mjs).
/**
 * LES HEURES DU DIMANCHE SOUS LE MOTEUR v1 (décision 211 du coach, 24/11/2026 : les athlètes répondent après leur dernière sortie, souvent le dimanche soir, et le coach retouche le
 * lundi matin) : à l'heure de PARIS toute l'année, alors que les tâches de Vercel (vercel.json, crons) sont en UTC (Paris est à UTC+1 l'hiver, UTC+2 l'été).
 *   - le point du dimanche et le Hooper sont visibles à midi (le Hooper n'est plus à 8 h) ;
 *   - le rappel part vers 19 h, seulement à qui n'a pas répondu ;
 *   - la semaine s'écrit vers 21 h, avec un passage à 22 h en filet ; celui de 18 h est retiré. Le lundi ne change pas.
 * LA MÉTHODE : le planning de vercel.json porte, pour chaque heure de Paris voulue, les deux heures UTC qu'elle peut être (l'hiver et l'été), et la tâche ne fait quelque chose que
 * quand l'heure de Paris du moment est la bonne : l'autre lancement ne fait rien. Une tâche lancée à la main (sans en-tête de planification) n'est jamais écartée.
 * LA 8.x : elle garde ses passages d'avant (leurs expressions, ci-dessous) et ignore ceux qui n'existent que pour la v1 ; sous la 8.x, rien ne change.
 */

export const heureDeParis = (d: Date): number =>
  Number(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(d));
export const jourDeParis = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
const estUnDimancheAParis = (d: Date): boolean => new Date(`${jourDeParis(d)}T12:00:00Z`).getUTCDay() === 0;

// L'écriture de la semaine, sous la v1 : vers 21 h (le passage) et 22 h (la reprise, qui ne fait que ce qui manque), heure de Paris ; la dernière est celle de 22 h.
export const HEURES_D_ECRITURE_V9 = [21, 22] as const;
export const DERNIERE_HEURE_D_ECRITURE_V9 = 22;
export const ecritureDuDimancheV9 = (d: Date): boolean => estUnDimancheAParis(d) && (HEURES_D_ECRITURE_V9 as readonly number[]).includes(heureDeParis(d));
export const derniereEcritureDuDimancheV9 = (d: Date): boolean => estUnDimancheAParis(d) && heureDeParis(d) === DERNIERE_HEURE_D_ECRITURE_V9;

// Le rappel, sous la v1 : vers 19 h, heure de Paris.
export const HEURE_DU_RAPPEL_V9 = 19;
export const rappelDuDimancheV9ALHeure = (d: Date): boolean => estUnDimancheAParis(d) && heureDeParis(d) === HEURE_DU_RAPPEL_V9;

// Ce que la 8.x faisait (vercel.json) : ses expressions, que la v1 ne lit pas ; la v1 a les siennes, la 8.x les ignore. Un lancement sans en-tête (à la main) est celui de tout le monde.
export const ECRITURE_DU_DIMANCHE_8X = ['0 17 * * 0', '0 19 * * 0', '0 21 * * 0'] as const;
export const DERNIERE_ECRITURE_DU_DIMANCHE_8X = '0 21 * * 0';
export const RAPPEL_DU_DIMANCHE_8X = ['0 14 * * 0'] as const;
export const estUnLancementDe8x = (planification: string | null, siens: readonly string[]): boolean => !planification || siens.includes(planification);
