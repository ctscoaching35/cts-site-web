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
import { plansDuCompte } from './contexte';
import { ficheDuCompte } from './demandes';
import { demonstrationOuverte } from './demonstrationPorte';
import { clientServeur, supabaseConfigure } from './supabase';

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

/**
 * La page Courses d'un acheteur ou d'un coaché (refonte de l'app payante, étape (c)) : l'app payante est EN LIGNE même quand l'app
 * gratuite est cachée (mode « coupe »), alors qu'elle y est « normale » (aucune lecture de compte, lib/app/acces.ts) : le compte
 * se lit donc ici. Vrai pour un compte qui a un plan ou une fiche de coaché (et, en développement sans base, la démonstration) ;
 * faux pour un visiteur, un compte gratuit en mode « coupe », le compte coach sans plan : introuvable, comme avant. Seule la
 * partie « dossiers du gratuit » de la page dépend du mode (AVEC_DOSSIERS).
 */
export async function comptePayant(a: Pick<Acces, 'cas' | 'compteId'>): Promise<boolean> {
  if (a.cas !== 'normal') return false;
  if (!supabaseConfigure()) return demonstrationOuverte();
  let id = a.compteId;
  if (!id) {
    const { data } = await (await clientServeur()).auth.getClaims();
    id = data?.claims?.sub ? String(data.claims.sub) : undefined;
  }
  if (!id) return false;
  return (await plansDuCompte(id)).length > 0 || Boolean(await ficheDuCompte(id));
}
