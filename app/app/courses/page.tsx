import type { Metadata } from 'next';
import EnTeteGratuit from '@/components/app/EnTeteGratuit';
import { Carte, TITRE } from '@/components/app/Ui';
import { pageGratuite } from '@/lib/app/accesGratuit';

export const metadata: Metadata = { title: 'Courses' };
export const dynamic = 'force-dynamic';

// Les courses de l'app gratuite : l'analyse d'une course (trace GPX, pentes, gestion de l'effort, nutrition) arrive au lot B.
// Pour l'instant, une phrase.
export default async function Courses() {
  const acces = await pageGratuite();
  return (
    <>
      <EnTeteGratuit acces={acces} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <h1 className={TITRE}>Courses</h1>
        <Carte className="space-y-1.5">
          <p className="text-sm font-bold text-indigo">L’analyse de ta course arrive bientôt.</p>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Tu importeras ta trace GPX : profil, pentes, gestion de l’effort, nutrition, carte à partager.</p>
        </Carte>
      </main>
    </>
  );
}
