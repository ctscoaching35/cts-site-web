/**
 * Les onglets de l'app (refonte de l'app payante, étape (a), décisions du coach du 16/11/2026) : une seule app, deux jeux
 * d'onglets. Visiteur et compte gratuit : Accueil, Courses, Profil, Bibliothèque. Acheteur et coaché : Accueil, Plan, Courses,
 * Profil, Bibliothèque. « Données » et « Compte » ne sont plus des onglets : « Tes données » est dans Plan, le compte s'ouvre par
 * les initiales de l'en-tête. Pur : ni Next ni lecture ; la barre (components/app/BarreOnglets.tsx) l'habille.
 */
export type CleOnglet = 'accueil' | 'plan' | 'courses' | 'profil' | 'bibliotheque';

export const ORDRE_GRATUIT: CleOnglet[] = ['accueil', 'courses', 'profil', 'bibliotheque'];
export const ORDRE_PAYANT: CleOnglet[] = ['accueil', 'plan', 'courses', 'profil', 'bibliotheque'];

export const CHEMIN_ONGLET: Record<CleOnglet, string> = {
  accueil: '/app', plan: '/app/plan', courses: '/app/courses', profil: '/app/profil', bibliotheque: '/app/bibliotheque',
};
export const TITRE_ONGLET: Record<CleOnglet, string> = {
  accueil: 'Accueil', plan: 'Plan', courses: 'Courses', profil: 'Profil', bibliotheque: 'Bibliothèque',
};

export const ordreDesOnglets = (gratuit: boolean) => (gratuit ? ORDRE_GRATUIT : ORDRE_PAYANT);

// Les deux écrans de l'onglet Plan : « Ta préparation » (/app/plan) et « Tes données » (/app/donnees).
export const estDansPlan = (chemin: string) => chemin === '/app/donnees' || chemin.startsWith('/app/donnees/')
  || (chemin.startsWith('/app/plan') && !estFicheDeCourse(chemin) && !estTests(chemin));
// La fiche de course d'un acheteur ou d'un coaché (/app/plan/course) : l'onglet Courses jusqu'à l'étape (c).
export const estFicheDeCourse = (chemin: string) => chemin === '/app/plan/course' || chemin.startsWith('/app/plan/course/');
// La page des tests (/app/plan/zones) s'ouvre depuis Profil.
export const estTests = (chemin: string) => chemin.startsWith('/app/plan/zones');

/**
 * L'onglet allumé. depuisUneFiche : un calculateur ouvert depuis une fiche de course (?garder=…) allume Accueil, depuis la
 * bibliothèque, Bibliothèque (C5, audits du 05/11/2026). L'onglet Plan est allumé sur ses deux adresses.
 */
export function ongletAllume(cle: CleOnglet, chemin: string, gratuit: boolean, depuisUneFiche = false): boolean {
  const calculateur = chemin.startsWith('/app/calculateurs');
  if (gratuit) return cle === 'accueil' ? chemin === '/app' : chemin.startsWith(CHEMIN_ONGLET[cle]);
  switch (cle) {
    case 'accueil': return chemin === '/app' || chemin.startsWith('/app/objectif') || (calculateur && depuisUneFiche);
    case 'plan': return estDansPlan(chemin);
    case 'courses': return chemin.startsWith('/app/courses') || estFicheDeCourse(chemin);
    case 'profil': return chemin.startsWith('/app/profil') || estTests(chemin);
    case 'bibliotheque': return chemin.startsWith('/app/bibliotheque') || (calculateur && !depuisUneFiche);
  }
}

/**
 * Où mène l'onglet Courses d'un acheteur ou d'un coaché, pour cette nuit (étape (c) à venir) : sa fiche de course s'il a un
 * objectif ; sans objectif, la liste de ses dossiers du gratuit s'il en a ; sinon l'accueil. Jamais une page vide.
 */
export function destinationCourses(o: { sansObjectif: boolean; dossiers: number }): '/app/plan/course' | 'liste' | '/app' {
  if (!o.sansObjectif) return '/app/plan/course';
  return o.dossiers > 0 ? 'liste' : '/app';
}
