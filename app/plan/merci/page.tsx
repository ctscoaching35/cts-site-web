import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EnTetePlan from '@/components/plan/EnTetePlan';
import FinalisationAchat from '@/components/plan/FinalisationAchat';
import { supabaseConfigure } from '@/lib/app/supabase';
import { planOuvert } from '@/lib/planAcces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ton plan est prêt — CTS Coaching',
  robots: { index: false, follow: false },
};

// Avec les comptes (Supabase configuré), le plan se range dans le compte et l'app s'ouvre. Sans eux (une démonstration
// locale), rien ne se range : l'ancienne page du PDF, qui appelait le moteur depuis le navigateur, est retirée (A-44,
// audits du 05/11/2026).
export default async function PageMerci({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  if (!(await planOuvert())) notFound();
  const { session_id: sessionId = '' } = await searchParams;
  return (
    <div className="min-h-screen bg-sand">
      <EnTetePlan />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        {supabaseConfigure() ? (
          <FinalisationAchat sessionId={sessionId} />
        ) : (
          <p className="bg-white rounded-2xl border border-indigo/[0.08] p-6 text-indigo/80 leading-relaxed">
            Démonstration sans comptes : le plan ne se range pas ici.
          </p>
        )}
      </main>
    </div>
  );
}
