import CadreSite from '@/components/app/CadreSite';
import { notFound } from 'next/navigation';
import { lireCalculateurs, calculateurParSlug } from '@/lib/app/bibliotheque';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// Un calculateur ouvert dans l'app (décision coach du 11/10/2026) : la page du site elle-même, dans
// un cadre, sous la barre d'onglets, comme une fiche. Seuls les calculateurs de la page qui les
// présente (public/calculateurs.html) s'ouvrent ici.
export default async function CalculateurApp({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams);
  const { slug } = await params;
  const calculateur = calculateurParSlug(lireCalculateurs(), slug);
  if (!calculateur) notFound();
  // Ouvert depuis une fiche de course : la durée et le niveau passent au calculateur, qui les prérempli.
  const r = await searchParams;
  const prerempli = new URLSearchParams(['heures', 'minutes', 'niveau'].flatMap((k) => (typeof r[k] === 'string' ? [[k, r[k] as string]] : []))).toString();
  return <CadreSite src={`/${calculateur.slug}${prerempli ? `?${prerempli}` : ''}`} titre={calculateur.titre}
    retour={{ href: lien('/app/bibliotheque', ctx), libelle: 'Retour' }} />;
}
