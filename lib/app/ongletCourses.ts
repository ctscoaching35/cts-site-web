/**
 * Où mène l'onglet Courses d'un acheteur ou d'un coaché (refonte de l'app payante, étape (a) ; l'étape (c) le refera) : lu une
 * fois par la mise en page de l'app (lib/app/ongletsApp.ts, destinationCourses). Sans lecture possible, l'accueil : aucun onglet
 * ne mène à une page vide.
 */
import { plansDuCompte } from './contexte';
import { destinationCourses } from './ongletsApp';
import { nombreDeDossiers } from './dossiersGratuit';
import type { Acces } from './acces';

export async function hrefOngletCourses(acces: Pick<Acces, 'cas' | 'mode' | 'compteId'>): Promise<string> {
  // La démonstration (sans compte) : la fiche de course, dont la barre garde les paramètres.
  if (!acces.compteId) return '/app/plan/course';
  try {
    const aUnObjectif = (await plansDuCompte(acces.compteId)).length > 0;
    // Les dossiers du gratuit ne se lisent pas en mode « coupe » (AVEC_DOSSIERS, lib/app/accesCourses.ts).
    const dossiers = !aUnObjectif && acces.mode !== 'coupe' ? await nombreDeDossiers(acces.compteId) : 0;
    const d = destinationCourses({ sansObjectif: !aUnObjectif, dossiers });
    return d === 'liste' ? '/app/courses' : d;
  } catch {
    return '/app';
  }
}
