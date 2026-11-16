import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import EnTeteDesCourses from '@/components/app/courses/EnTeteDesCourses';
import FormulaireCourse from '@/components/app/courses/FormulaireCourse';
import { pageCourses, titreCourses } from '@/lib/app/accesCourses';
import { profilDuCompteGratuit } from '@/lib/app/donneesGratuit';

export async function generateMetadata(): Promise<Metadata> {
  return titreCourses('Une nouvelle course');
}
export const dynamic = 'force-dynamic';

// Une nouvelle course : le formulaire. Un compte de l'app payante n'en crée pas (ses dossiers d'avant restent lisibles).
export default async function NouvelleCourse() {
  const { acces, genre } = await pageCourses();
  if (genre === 'ancien') redirect('/app/courses');
  // Un compte gratuit : ses repères sont ceux de son profil, la FC seulement avec son accord. Un visiteur : ceux de son onglet.
  const garde = genre === 'gratuit' && acces.compteId ? await profilDuCompteGratuit(acces.compteId) : null;
  return (
    <>
      <EnTeteDesCourses acces={acces} genre={genre} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6">
        <FormulaireCourse compte={genre === 'gratuit'}
          profil={garde ? { experience: garde.experience, tests: garde.tests, avecFc: garde.consentementFc } : null} />
      </main>
    </>
  );
}
