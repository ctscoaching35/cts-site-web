import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AllerPlusLoin } from '@/components/app/AllerPlusLoin';
import EnTeteDesCourses from '@/components/app/courses/EnTeteDesCourses';
import { ListeVisiteur } from '@/components/app/courses/Visiteur';
import { BOUTON, Carte, PastilleDate, TITRE } from '@/components/app/Ui';
import { pageCourses, titreCourses } from '@/lib/app/accesCourses';
import { dossiersDuCompte } from '@/lib/app/dossiersGratuit';
import { CLASSE_COURTE } from '@/lib/app/carteStory';

// Le titre seulement quand la page est ouverte pour cette visite : en mode « coupe », elle est introuvable et son titre ne
// transparaît pas.
export async function generateMetadata(): Promise<Metadata> {
  return titreCourses('Courses');
}
export const dynamic = 'force-dynamic';

// Les courses (app gratuite, lot B) : un visiteur voit son dossier du moment (dans son onglet) ; un compte gratuit, ses dossiers
// gardés, qu'il ajoute ; un compte de l'app payante qui en avait fait avant d'acheter les lit (et les supprime), sans en créer.
export default async function Courses() {
  const { acces, genre } = await pageCourses();
  if (genre === 'visiteur') {
    return (
      <>
        <EnTeteDesCourses acces={acces} genre={genre} />
        <main className="mx-auto max-w-2xl px-4 pt-5 pb-6"><ListeVisiteur /></main>
      </>
    );
  }
  const dossiers = await dossiersDuCompte(acces.compteId ?? '');
  // Un compte de l'app payante sans dossier n'a rien à lire ici : son accueil.
  if (genre === 'ancien' && dossiers.length === 0) redirect('/app');
  return (
    <>
      <EnTeteDesCourses acces={acces} genre={genre} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <h1 className={TITRE}>{genre === 'ancien' ? 'Tes dossiers de course' : 'Tes courses'}</h1>
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
        {genre === 'gratuit' && (
          <>
            <Link href="/app/courses/nouvelle" className={`${BOUTON} w-full`}>{dossiers.length ? 'Ajouter une course' : 'Créer mon premier dossier'}</Link>
            <AllerPlusLoin />
          </>
        )}
      </main>
    </>
  );
}
