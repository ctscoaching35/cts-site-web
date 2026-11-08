import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EnTetePlan from '@/components/plan/EnTetePlan';
import Questionnaire from '@/components/plan/Questionnaire';
import { coachConnecte } from '@/lib/app/nolio';
import { planOuvert } from '@/lib/planAcces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ton plan d’entraînement trail — CTS Coaching',
  description: 'Un plan trail construit sur ta course, ton niveau, ton terrain et tes disponibilités, dans ton app.',
  robots: { index: false, follow: false },
};

export default async function PagePlan() {
  if (!(await planOuvert())) notFound();
  // Le coach connecté peut simuler l'achat, sans paiement (décision coach du 24/10/2026).
  const simulation = Boolean(await coachConnecte().catch(() => null));
  return (
    <div className="min-h-screen bg-sand">
      <EnTetePlan />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="mb-6 px-1">
          <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-teal mb-2">Plan d’entraînement trail</div>
          <h1 className="text-[1.75rem] sm:text-[2rem] font-extrabold text-indigo tracking-tight leading-tight mb-3">Ton plan, construit sur ta course</h1>
          {/* P1 (décision coach du 07/11/2026, « A ») : la durée d'abord, puis ce qu'il reçoit. */}
          <p className="text-[0.9375rem] text-[#4A4866] leading-relaxed">
            Environ 5 minutes, sept rubriques : ta course, ton niveau, ton terrain et ta semaine. Ton plan s’appuie sur les
            dernières données en sciences de l’entraînement. Tes séances arrivent dans Nolio chaque semaine, ajustées à ce
            que tu as fait, et ton app CTS te montre toute ta préparation.
          </p>
        </div>
        <Questionnaire simulation={simulation} />
        {/* A-41 (audits du 05/11/2026) : les liens légaux sur le parcours d'achat, comme sur la page des plans. */}
        <nav aria-label="Informations légales" className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-indigo/60">
          <a href="/mentions-legales" className="underline underline-offset-4">Mentions légales</a>
          <a href="/cgv" className="underline underline-offset-4">Conditions générales de vente</a>
          <a href="/confidentialite" className="underline underline-offset-4">Confidentialité</a>
        </nav>
      </main>
    </div>
  );
}
