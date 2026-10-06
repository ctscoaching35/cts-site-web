import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import BarreOnglets from '@/components/app/BarreOnglets';
import { demonstrationOuverte } from '@/lib/app/demonstration';
import { supabaseConfigure } from '@/lib/app/supabase';

export const metadata: Metadata = {
  title: 'Ton plan — CTS Coaching',
  robots: { index: false, follow: false },
};

// L'app CTS coaching (cadrage de l'app, CTS_APP_CADRAGE.md dans le dépôt du moteur). Avec
// Supabase configuré, l'athlète se connecte et lit son plan (étape 1b) ; sans, la démonstration
// sur des plans d'exemple, en développement seulement — en production, /app répond alors 404.
export default function MiseEnPageApp({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigure() && !demonstrationOuverte()) notFound();
  return (
    <div className="min-h-screen bg-sand pb-24">
      {children}
      <Suspense>
        <BarreOnglets />
      </Suspense>
    </div>
  );
}
