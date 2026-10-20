import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EnTetePlan from '@/components/plan/EnTetePlan';
import Questionnaire from '@/components/plan/Questionnaire';
import { planOuvert } from '@/lib/planAcces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ton plan d’entraînement trail — CTS Coaching',
  description: 'Un plan trail construit sur ta course, ton niveau, ton terrain et tes disponibilités, dans ton app.',
  robots: { index: false, follow: false },
};

export default async function PagePlan() {
  if (!(await planOuvert())) notFound();
  return (
    <div className="min-h-screen bg-sand">
      <EnTetePlan />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="mb-6 px-1">
          <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal mb-2">Plan d’entraînement trail</div>
          <h1 className="text-[1.75rem] sm:text-[2rem] font-extrabold text-indigo tracking-tight leading-tight mb-3">Ton plan, construit sur ta course</h1>
          <p className="text-[0.9375rem] text-[#4A4866] leading-relaxed">
            Sept rubriques sur ta course, ton niveau, ton terrain et tes disponibilités. Ton plan s’appuie sur les
            dernières données en sciences de l’entraînement : chaque semaine et chaque séance en découlent, jusqu’au
            jour J. Tes séances arrivent dans Nolio semaine après semaine, et ton app CTS te montre toute ta préparation.
          </p>
        </div>
        <Questionnaire />
      </main>
    </div>
  );
}
