import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CadreSite from '@/components/app/CadreSite';
import { NutritionVisiteur } from '@/components/app/courses/Visiteur';
import { pageCourses, titreCourses } from '@/lib/app/accesCourses';
import { garderStrategieDossier } from '@/lib/app/actionsCourses';
import { calculateurParSlug, lireCalculateurs } from '@/lib/app/bibliotheque';
import { ID_VISITEUR, parametresNutrition } from '@/lib/app/courseLibre';
import { dossierDuCompte } from '@/lib/app/dossiersGratuit';

export async function generateMetadata(): Promise<Metadata> {
  return titreCourses('Calculateur');
}
export const dynamic = 'force-dynamic';

// Le calculateur de nutrition ouvert depuis un dossier de course : la durée visée et le niveau de l'expérience du profil
// préremplis ; « Garder ma stratégie » la range dans le dossier (celui du compte, ou celui de l'onglet pour un visiteur), puis revient
// au dossier. Un compte de l'app payante n'y modifie rien : la page n'est pas pour lui.
export default async function NutritionDuDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acces, genre } = await pageCourses();
  const calculateur = calculateurParSlug(lireCalculateurs(), 'calculateur-nutrition');
  if (!calculateur) notFound();
  if (id === ID_VISITEUR) {
    if (genre !== 'visiteur') redirect('/app/courses');
    return <NutritionVisiteur titre={calculateur.titre} />;
  }
  if (genre !== 'gratuit') redirect('/app/courses');
  const dossier = await dossierDuCompte(acces.compteId ?? '', id);
  if (!dossier) notFound();
  const params2 = new URLSearchParams(parametresNutrition(dossier.reponse, dossier.strategie)).toString();
  return (
    <CadreSite src={`/${calculateur.slug}${params2 ? `?${params2}` : ''}`} titre={calculateur.titre}
      retour={{ href: `/app/courses/${id}`, libelle: 'Retour' }}
      garder={garderStrategieDossier.bind(null, id)} masquer=".titre .surtitre" />
  );
}
