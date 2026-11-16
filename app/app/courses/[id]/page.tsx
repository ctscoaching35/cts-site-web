import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AllerPlusLoin } from '@/components/app/AllerPlusLoin';
import { BoutonPartager, EffacerStrategie, SupprimerDossier } from '@/components/app/courses/ActionsDossier';
import DossierCourse from '@/components/app/courses/DossierCourse';
import EnTeteDesCourses from '@/components/app/courses/EnTeteDesCourses';
import { DossierVisiteur } from '@/components/app/courses/Visiteur';
import { Carte } from '@/components/app/Ui';
import { pageCourses, titreCourses } from '@/lib/app/accesCourses';
import { effacerStrategieDossier, supprimerDossier } from '@/lib/app/actionsCourses';
import { ID_VISITEUR, modeleCarte, parametresNutrition } from '@/lib/app/courseLibre';
import { dossierDuCompte } from '@/lib/app/dossiersGratuit';
import { fichesDeCourse } from '@/lib/app/fichesDeCourse';

export async function generateMetadata(): Promise<Metadata> {
  return titreCourses('Ton dossier de course');
}
export const dynamic = 'force-dynamic';

// Le dossier d'une course. « ici » : celui du visiteur, qui tient dans son onglet. Un identifiant : celui d'un dossier gardé par le
// compte, lisible (et supprimable) aussi pour qui est passé à l'app payante ; modifiable (sa stratégie) pour le compte gratuit seulement.
export default async function DossierDeCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acces, genre } = await pageCourses();
  const fiches = fichesDeCourse();
  if (id === ID_VISITEUR) {
    if (genre !== 'visiteur') redirect('/app/courses');
    return (
      <>
        <EnTeteDesCourses acces={acces} genre={genre} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6"><DossierVisiteur fiches={fiches} /></main>
      </>
    );
  }
  if (genre === 'visiteur') redirect('/app/courses');
  const dossier = await dossierDuCompte(acces.compteId ?? '', id);
  if (!dossier) notFound();
  const modifiable = genre === 'gratuit';
  const ultra = dossier.reponse.effort_jour_j.duree_h > 8;
  return (
    <>
      <EnTeteDesCourses acces={acces} genre={genre} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-3">
        <Link href="/app/courses" className="inline-flex items-center min-h-11 text-sm font-bold text-teal">‹ {genre === 'ancien' ? 'Tes dossiers de course' : 'Tes courses'}</Link>
        <DossierCourse dossier={dossier} fiches={fiches.filter((f) => ultra || f.slug !== 'ultra')} fiche={(slug) => `/app/bibliotheque/${slug}`}
          nutritionHref={modifiable ? `/app/courses/${id}/nutrition`
            : `/app/calculateurs/calculateur-nutrition?${new URLSearchParams(parametresNutrition(dossier.reponse, dossier.strategie, false)).toString()}`} profilHref={modifiable ? '/app/profil?test=1' : null}
          partager={<BoutonPartager modele={modeleCarte(dossier.reponse)} />}
          effacerStrategie={modifiable ? <EffacerStrategie action={effacerStrategieDossier.bind(null, id)} /> : null}
          pied={(
            <>
              {modifiable && <AllerPlusLoin />}
              {genre === 'ancien' && (
                <Carte>
                  <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Ce dossier vient de l’app gratuite : il reste lisible ici.</p>
                </Carte>
              )}
              <SupprimerDossier apres="/app/courses" action={supprimerDossier.bind(null, id)} />
            </>
          )} />
      </main>
    </>
  );
}
