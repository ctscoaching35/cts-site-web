import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import EnTetePlan from '@/components/plan/EnTetePlan';
import Merci from '@/components/plan/Merci';
import { planOuvert } from '@/lib/planAcces';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ton plan est prêt — CTS Coaching',
  robots: { index: false, follow: false },
};

export default function PageMerci() {
  if (!planOuvert()) notFound();
  return (
    <div className="min-h-screen bg-sand">
      <EnTetePlan />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <Suspense fallback={null}>
          <Merci />
        </Suspense>
      </main>
    </div>
  );
}
