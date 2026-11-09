/**
 * LA DERNIÈRE COURSE LUE DANS NOLIO (moteur 8.460, défaut vu par le coach le 08/11/2026 : un coaché malade, ses
 * dernières courses le 27 et le 31/10, avant sa première semaine écrite ; l'arrêt, R4, n'était pas dit le dimanche 8/11).
 * Le site transmet au moteur la date de la dernière activité de course, de trail ou de tapis qu'il a lue
 * (`retours.derniere_course`), quel qu'en soit l'auteur : au départ (la première semaine, avec la réponse du samedi) et
 * à chaque passage du dimanche. Le moteur la garde dans son état : l'arrêt se lit au premier dimanche, même quand la
 * dernière course précède le plan ou sort des 35 jours que le site relit. Rien de lu (aucun historique) : rien n'est
 * transmis, le moteur ne déduit aucun arrêt. Fonctions pures : sondées à part (scripts/test-arret.mjs).
 */

// Le départ relit les 90 derniers jours : au-delà de 28 jours sans courir, l'arrêt a le même palier (la reconstruction) ;
// plus loin, ou sans aucune course, rien n'est transmis.
export const JOURS_DERNIERE_COURSE = 90;

export type ActiviteLue = { date_start: string; sport?: string | null };

// La date (AAAA-MM-JJ) de la plus récente activité de course jusqu'à `au` compris ; null sans aucune.
export function derniereCourse(activites: readonly ActiviteLue[], sports: readonly string[], au: string): string | null {
  return activites.filter((a) => sports.includes(String(a.sport)) && typeof a.date_start === 'string')
    .map((a) => a.date_start.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= au).sort().pop() ?? null;
}

// « Rien de lu » pour l'écran du coach (« Ce qu'il a lu » : « Première semaine : rien n'est lu. ») : pas de retours, ou
// des retours qui ne portent que la dernière course (une première semaine sans réponse du samedi), ni réponse, ni
// semaine Nolio, ni séances lues. Les retours d'un passage du dimanche portent toujours la semaine Nolio.
export function rienDeLu(retours: { questionnaire?: unknown; nolio?: unknown; lues?: unknown } | null | undefined): boolean {
  if (retours === null) return true;
  if (retours === undefined) return false;
  return !retours.questionnaire && !retours.nolio && !retours.lues;
}
