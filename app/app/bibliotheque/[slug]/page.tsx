import type { Metadata } from 'next';
import CadreSite from '@/components/app/CadreSite';

export const metadata: Metadata = { title: 'Fiche' };
import { notFound } from 'next/navigation';
import { lireBibliotheque, ficheParSlug } from '@/lib/app/bibliotheque';
import { estGratuit, lireAcces } from '@/lib/app/acces';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// Une fiche ouverte dans l'app : la page du site elle-même (une seule source), dans un cadre,
// sous la barre d'onglets. Seules les fiches de l'index de la bibliothèque s'ouvrent ici.
export default async function Fiche({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Recherche;
}) {
  // L'app gratuite (lot A1) : la fiche s'ouvre pour le visiteur et le compte gratuit, sans plan à lire.
  const acces = await lireAcces();
  const gratuit = estGratuit(acces);
  const ctx = gratuit ? null : await contexte(searchParams, { sansObjectif: true });
  const { slug } = await params;
  const fiche = ficheParSlug(lireBibliotheque(), slug);
  if (!fiche) notFound();
  // Dans l'app jusqu'au bout (décision coach du 19/10/2026) : sans l'en-tête du site, ses liens restent dans l'app.
  return <CadreSite src={`/bibliotheque/${fiche.slug}`} titre={fiche.titre} retour={{ href: ctx ? lien('/app/bibliotheque', ctx) : '/app/bibliotheque', libelle: 'Retour' }} />;
}
