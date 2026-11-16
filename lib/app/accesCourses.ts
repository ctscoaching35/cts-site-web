/**
 * Les pages des dossiers de course (app gratuite, lot B) : qui les voit, et comment.
 * - visiteur : sans compte, son dossier tient le temps de l'onglet ;
 * - gratuit : un compte gratuit, qui garde, lit, modifie et supprime ses dossiers ;
 * - ancien : un compte de l'app payante (acheteur, coaché) qui avait fait des dossiers avant : il les LIT et les supprime, il n'en crée
 *   pas (décision du coach du 16/11/2026). L'app payante d'avant reste telle quelle.
 * En mode « coupe », tout est introuvable, comme avant le lot B.
 */
import { notFound } from 'next/navigation';
import { lireAcces, type Acces } from './acces';

export type GenreCourses = 'visiteur' | 'gratuit' | 'ancien';

// Pur : le genre d'une visite, ou null (introuvable).
export function genreCourses(a: Pick<Acces, 'cas' | 'mode' | 'compteId'>): GenreCourses | null {
  if (a.mode === 'coupe') return null;
  if (a.cas === 'visiteur') return 'visiteur';
  if (a.cas === 'gratuit') return 'gratuit';
  if (a.cas === 'normal' && a.compteId) return 'ancien';
  return null;
}

export async function pageCourses(): Promise<{ acces: Acces; genre: GenreCourses }> {
  const acces = await lireAcces();
  const genre = genreCourses(acces);
  if (!genre) notFound();
  return { acces, genre };
}

// Le titre d'une de ces pages : seulement quand elle est ouverte pour cette visite (en mode « coupe », son titre ne transparaît pas).
export async function titreCourses(titre: string): Promise<{ title?: string }> {
  return genreCourses(await lireAcces()) ? { title: titre } : {};
}

// Le lien « Tes dossiers de course › » de l'accueil de l'app payante : seulement hors du mode « coupe », pour un compte qui en a.
export const AVEC_DOSSIERS = (mode: Acces['mode'], dossiers: number) => mode !== 'coupe' && dossiers > 0;
