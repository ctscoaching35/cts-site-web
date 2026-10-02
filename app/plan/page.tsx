import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EnTetePlan from '@/components/plan/EnTetePlan';
import Questionnaire from '@/components/plan/Questionnaire';
import { planOuvert } from '@/lib/planAcces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ton plan d’entraînement trail — CTS Coaching',
  description: 'Un plan trail construit sur ta course, ton niveau, ton terrain et tes disponibilités, livré en PDF.',
  robots: { index: false, follow: false },
};

export default function PagePlan() {
  if (!planOuvert()) notFound();
  return (
    <div className="min-h-screen bg-sand">
      <EnTetePlan />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-10 px-2">
          <div className="eyebrow text-teal mb-3">Plan d’entraînement trail</div>
          <h1 className="text-3xl sm:text-5xl text-indigo leading-tight mb-4">Ton plan, construit sur ta course</h1>
          <p className="text-indigo/70 text-lg leading-relaxed">
            Sept rubriques sur ta course, ton niveau, ton terrain et tes disponibilités. Ton plan s’appuie sur les
            dernières données en sciences de l’entraînement : chaque semaine et chaque séance en découlent, jusqu’au
            jour J. Tu le reçois en PDF.
          </p>
        </div>
        <Questionnaire />
      </main>
    </div>
  );
}
