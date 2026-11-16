/**
 * Les fiches « À lire avant ta course » du dossier de course (lot B) : les mêmes que celles de la fiche de course des acheteurs
 * (components/app/StrategieCourse.tsx), de la check-list à la récupération ; titres et résumés lus dans l'index de la
 * bibliothèque, jamais recopiés. Côté serveur (lecture du fichier). `ultra` : la fiche des courses de plus de 8 h d'effort, que
 * l'écran retire pour les autres.
 */
import { ficheParSlug, lireBibliotheque } from './bibliotheque';

export const FICHES_DE_COURSE = ['checklist', 'nutrition-avant-course', 'nutrition', 'ultra', 'recuperation'];

export function fichesDeCourse(): { slug: string; titre: string; texte: string }[] {
  const familles = lireBibliotheque();
  return FICHES_DE_COURSE.flatMap((slug) => {
    const f = ficheParSlug(familles, slug);
    return f ? [{ slug, titre: f.titre, texte: f.texte }] : [];
  });
}
