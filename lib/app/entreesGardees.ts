// Aucun réseau, aucune base : ce que le site garde avec les réponses d'un plan en route (scripts/test-preparer-coaches-v1.mjs).
/**
 * CE QUE « MODIFIER L'OBJECTIF » NE DOIT PAS PERDRE, SOUS LA 9.x (inventaire du 25/11/2026, « Préparer ses coachés pour la v1 ») : le moteur v1 lit, dans les réponses du plan
 * (`parametres.champs`), trois choses que le site y a posées lui-même et que le questionnaire ne redemande pas : `entree` (le lundi où le coaché entre), `course_precedente`
 * (la course qu'il vient de courir : sa date et sa durée) et `lu` (ce qu'il court au départ, lu dans Nolio, entrée 203). Or le coach qui modifie un objectif déjà parti
 * enregistre les réponses neuves du questionnaire À LA PLACE des anciennes (app/app/coach/athletes/route.ts) : sans ces trois-là, le moteur perd la reprise après sa course
 * d'avant, et le départ lu. Cette fonction les reporte de l'ancien plan sur le nouveau, jamais par-dessus ce que le nouveau dit déjà. (`gpx` a la sienne : lib/app/gpxV9.ts, avecLeGpx.)
 */
export const ENTREES_GARDEES = ['entree', 'course_precedente', 'lu'] as const;

export function avecLesEntreesGardees(parametres: Record<string, unknown>, avant?: Record<string, unknown> | null): Record<string, unknown> {
  const anciens = ((avant?.champs ?? {}) as Record<string, unknown>) ?? {};
  const champs = { ...((parametres.champs ?? {}) as Record<string, unknown>) };
  let change = false;
  for (const cle of ENTREES_GARDEES) {
    if (champs[cle] === undefined && anciens[cle] !== undefined) {
      champs[cle] = anciens[cle];
      change = true;
    }
  }
  return change ? { ...parametres, champs } : parametres;
}
