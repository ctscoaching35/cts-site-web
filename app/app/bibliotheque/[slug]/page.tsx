import CadreSite from '@/components/app/CadreSite';
import { notFound } from 'next/navigation';
import { lireBibliotheque, ficheParSlug } from '@/lib/app/bibliotheque';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// Une fiche ouverte dans l'app : la page du site elle-même (une seule source), dans un cadre,
// sous la barre d'onglets. Seules les fiches de l'index de la bibliothèque s'ouvrent ici.
export default async function Fiche({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams);
  const { slug } = await params;
  const fiche = ficheParSlug(lireBibliotheque(), slug);
  if (!fiche) notFound();
  // Dans l'app jusqu'au bout (décision coach du 19/10/2026) : sans l'en-tête du site, ses liens restent dans l'app.
  return <CadreSite src={`/bibliotheque/${fiche.slug}`} titre={fiche.titre} retour={{ href: lien('/app/bibliotheque', ctx), libelle: 'Retour' }} />;
}
