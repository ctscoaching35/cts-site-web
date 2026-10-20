import CadreSite from '@/components/app/CadreSite';
import { notFound } from 'next/navigation';
import { lireCalculateurs, calculateurParSlug } from '@/lib/app/bibliotheque';
import { garderStrategie } from '@/lib/app/actionsStrategie';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { cleCourse, CLES_ENTREES, COURSE_OBJECTIF } from '@/lib/app/strategie';

// Un calculateur ouvert dans l'app (décision coach du 11/10/2026) : la page du site elle-même, dans
// un cadre, sous la barre d'onglets, comme une fiche. Seuls les calculateurs de la page qui les
// présente (public/calculateurs.html) s'ouvrent ici.
export default async function CalculateurApp({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const { slug } = await params;
  const calculateur = calculateurParSlug(lireCalculateurs(), slug);
  if (!calculateur) notFound();
  // Ouvert depuis une fiche de course : la durée et le niveau passent au calculateur, qui les prérempli, ou les réponses
  // de sa stratégie gardée ; garder, la fiche de course où « Garder ma stratégie » la range (décision coach du
  // 20/10/2026), puis il y revient.
  const r = await searchParams;
  const garder = slug === 'calculateur-nutrition' ? cleCourse(r.garder) : null;
  const prerempli = new URLSearchParams([...CLES_ENTREES, 'garder'].flatMap((k) => (typeof r[k] === 'string' ? [[k, r[k] as string]] : []))).toString();
  const fiche = garder === COURSE_OBJECTIF ? lien('/app/plan/jour-j', ctx) : garder ? lien('/app/plan/course', ctx, { course: garder }) : null;
  return <CadreSite src={`/${calculateur.slug}${prerempli ? `?${prerempli}` : ''}`} titre={calculateur.titre}
    retour={{ href: fiche ?? lien('/app/bibliotheque', ctx), libelle: 'Retour' }}
    garder={garder ? garderStrategie.bind(null, ctx.cle, garder) : undefined} />;
}
