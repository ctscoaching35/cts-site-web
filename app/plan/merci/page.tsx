import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import EnTetePlan from '@/components/plan/EnTetePlan';
import FinalisationAchat from '@/components/plan/FinalisationAchat';
import Merci from '@/components/plan/Merci';
import { supabaseConfigure } from '@/lib/app/supabase';
import { planOuvert } from '@/lib/planAcces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ton plan est prêt — CTS Coaching',
  robots: { index: false, follow: false },
};

// Avec les comptes (Supabase configuré), le plan se range dans le compte et l'app s'ouvre ; sans
// eux, l'ancienne page : le PDF à télécharger.
export default async function PageMerci({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  if (!(await planOuvert())) notFound();
  const { session_id: sessionId = '' } = await searchParams;
  return (
    <div className="min-h-screen bg-sand">
      <EnTetePlan />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        {supabaseConfigure() ? (
          <FinalisationAchat sessionId={sessionId} />
        ) : (
          <Suspense fallback={null}>
            <Merci />
          </Suspense>
        )}
      </main>
    </div>
  );
}
