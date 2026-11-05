/**
 * Deux décisions du lot 1 des audits du 05/11/2026, en fonctions pures (sondées à part), lues par lib/app/ecriture.ts :
 * - E4 : le lundi soir, une semaine due que le dimanche n'a pas écrite se reprend (ni écrite, ni laissée au coach) ;
 * - E3 : à l'arrêt d'une préparation remboursée, ce que devient la place de l'acheteur dans l'équipe Nolio.
 */

// E4 : le jour de la reprise (le lundi, Paris), et une semaine de préparation ni écrite ni laissée au coach.
export function semaineAReprendre({ jour, numero, ecrite, laissee }: {
  jour: string; numero: string | null; ecrite: boolean; laissee: boolean;
}): boolean {
  return new Date(`${jour}T12:00:00Z`).getUTCDay() === 1 && Boolean(numero) && !ecrite && !laissee;
}

// E3 : « reprogrammer » sa sortie quand un autre plan de lui est en cours (elle suit sa dernière course) ; « retirer »
// quand il n'est dans l'équipe que pour cette préparation ; « rester » pour un coaché (une fiche chez le coach), le coach
// lui-même (« (toi) ») ou un compte Nolio inconnu.
export type SortieApresArret = 'reprogrammer' | 'retirer' | 'rester';
export function sortieApresArret({ usr, autresPlans, coache, moi }: {
  usr: string | null; autresPlans: number; coache: boolean; moi: string | null;
}): SortieApresArret {
  if (!usr || !/^usr_/.test(usr)) return 'rester';
  if (autresPlans > 0) return 'reprogrammer';
  if (coache || !moi || usr === moi) return 'rester';
  return 'retirer';
}
