import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import BarreOnglets from '@/components/app/BarreOnglets';
import { demonstrationOuverte } from '@/lib/app/demonstration';

export const metadata: Metadata = {
  title: 'Ton plan — CTS Coaching',
  robots: { index: false, follow: false },
};

// L'app CTS coaching (cadrage de l'app, CTS_APP_CADRAGE.md dans le dépôt du moteur). Étape 1c :
// le calendrier sur des plans d'exemple, en développement seulement ; en production, /app
// répond 404 jusqu'aux comptes (étape 1b).
export default function MiseEnPageApp({ children }: { children: React.ReactNode }) {
  if (!demonstrationOuverte()) notFound();
  return (
    <div className="min-h-screen bg-sand pb-24">
      {children}
      <Suspense>
        <BarreOnglets />
      </Suspense>
    </div>
  );
}
