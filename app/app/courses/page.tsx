import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AllerPlusLoin } from '@/components/app/AllerPlusLoin';
import CoursesPayant from '@/components/app/courses/CoursesPayant';
import EnTeteApp from '@/components/app/EnTeteApp';
import EnTeteDesCourses from '@/components/app/courses/EnTeteDesCourses';
import { ListeVisiteur } from '@/components/app/courses/Visiteur';
import { BOUTON, Carte, PastilleDate, TITRE } from '@/components/app/Ui';
import { comptePayant, genreCourses, titreCourses } from '@/lib/app/accesCourses';
import { lireAcces } from '@/lib/app/acces';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { datesDesFiches } from '@/lib/app/demonstration';
import { dossiersDuCompte } from '@/lib/app/dossiersGratuit';
import { donneesTableau, fichesDePreparation } from '@/lib/app/tableauDuPlan';
import { CLASSE_COURTE } from '@/lib/app/carteStory';

// Le titre seulement quand la page est ouverte pour cette visite : en mode « coupe », elle est introuvable et son titre ne
// transparaît pas.
export async function generateMetadata(): Promise<Metadata> {
  return titreCourses('Courses');
}
export const dynamic = 'force-dynamic';

// Les courses (app gratuite, lot B ; l'onglet des acheteurs et des coaché·es, refonte de l'app payante, étape (c)) : un visiteur voit
// son dossier du moment (dans son onglet) ; un compte gratuit, ses dossiers gardés, qu'il ajoute ; un acheteur ou un coaché, son
// objectif (qui ouvre son dossier), ses courses de préparation et, hors du mode « coupe », les dossiers qu'il avait faits dans l'app
// gratuite (lisibles, supprimables). L'app payante est en ligne même quand l'app gratuite est cachée : sa page marche en mode « coupe ».
export default async function Courses({ searchParams }: { searchParams: Recherche }) {
  const acces = await lireAcces();
  const genre = genreCourses(acces);
  if (genre !== 'visiteur' && genre !== 'gratuit') {
    // Qui n'a ni plan ni fiche de coaché : introuvable (un compte payant sans rien à lire va à son accueil, comme avant).
    if (!(await comptePayant(acces))) {
      if (genre === 'ancien') redirect('/app');
      notFound();
    }
    const ctx = await contexte(searchParams, { sansObjectif: true });
    const d = await donneesTableau(ctx);
    const prochaines = d.courses.filter((c) => c.date >= ctx.jour);
    const avecFiche = ctx.sansObjectif ? new Set<string>() : ctx.demonstration ? await datesDesFiches(ctx) : await fichesDePreparation(ctx.cle);
    // Les dossiers du gratuit dépendent du mode : en mode « coupe », rien de l'app gratuite ne se lit (AVEC_DOSSIERS).
    const dossiers = acces.mode !== 'coupe' && acces.compteId ? await dossiersDuCompte(acces.compteId) : [];
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <CoursesPayant ctx={ctx} preparation={ctx.plan.fond ? [] : prochaines} avecFiche={avecFiche} dossiers={dossiers} />
      </>
    );
  }
  if (genre === 'visiteur') {
    return (
      <>
        <EnTeteDesCourses acces={acces} genre={genre} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6"><ListeVisiteur /></main>
      </>
    );
  }
  const dossiers = await dossiersDuCompte(acces.compteId ?? '');
  return (
    <>
      <EnTeteDesCourses acces={acces} genre={genre} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <h1 className={TITRE}>Tes courses</h1>
        {dossiers.length === 0 ? (
          <Carte className="space-y-1.5">
            <p className="text-sm font-bold text-indigo">Prépare ta course sans plan.</p>
            <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
              Sa trace GPX fait tout le dossier : profil, pentes, type de course, effort du jour J, zones, nutrition, carte à partager.
            </p>
          </Carte>
        ) : (
          <Carte className="!py-1">
            {dossiers.map((d) => (
              <Link key={d.id} href={`/app/courses/${d.id}`} className="flex items-center gap-3 min-h-[60px] py-2 border-b last:border-b-0 border-indigo/[0.06]">
                {d.date ? <PastilleDate iso={d.date} /> : null}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-indigo truncate">{d.nom}</span>
                  <span className="block text-xs text-[#5E5C78]">
                    {d.distance_km != null ? `${String(d.distance_km).replace('.', ',')} km` : ''}{d.dplus_m != null ? ` · ${d.dplus_m} m D+` : ''}
                    {d.classe ? ` · course ${CLASSE_COURTE[d.classe]}` : ''}
                  </span>
                </span>
                <span aria-hidden className="text-[#5E5C78]">›</span>
              </Link>
            ))}
          </Carte>
        )}
        <Link href="/app/courses/nouvelle" className={`${BOUTON} w-full`}>{dossiers.length ? 'Ajouter une course' : 'Créer mon premier dossier'}</Link>
        <AllerPlusLoin />
      </main>
    </>
  );
}
