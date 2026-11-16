import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import BarreOnglets from '@/components/app/BarreOnglets';
import HorsReseau from '@/components/app/HorsReseau';
import { demonstrationOuverte } from '@/lib/app/demonstration';
import { supabaseConfigure } from '@/lib/app/supabase';
import { estGratuit, lireAcces } from '@/lib/app/acces';
import { hrefOngletCourses } from '@/lib/app/ongletCourses';

// C6 (audits du 05/11/2026) : chaque écran a son titre, dans le navigateur et pour les lecteurs d'écran (« Accueil · CTS »),
// au lieu de « CTS Coaching » partout.
export const metadata: Metadata = {
  title: { default: 'CTS Coaching', template: '%s · CTS' },
  robots: { index: false, follow: false },
  // L'app s'installe sur l'écran d'accueil (cadrage, D1) : manifeste, icône, plein écran.
  manifest: '/pwa/manifest.webmanifest',
  icons: { icon: '/pwa/icone-192.png', apple: '/pwa/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'CTS', statusBarStyle: 'default' },
};

// C7 (audits du 05/11/2026) : la barre d'état d'Android blanche, comme l'en-tête de l'app (avant, l'indigo du site).
export const viewport: Viewport = { themeColor: '#FFFFFF' };

const CAPTURE_INSTALLATION = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();"
  + "window.__ctsInstallation=e;window.dispatchEvent(new Event('cts-installation'));});";

// L'app CTS coaching (cadrage de l'app, CTS_APP_CADRAGE.md dans le dépôt du moteur). Avec
// Supabase configuré, l'athlète se connecte et lit son plan (étape 1b) ; sans, la démonstration
// sur des plans d'exemple, en développement seulement — en production, /app répond alors 404.
export default async function MiseEnPageApp({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigure() && !demonstrationOuverte()) notFound();
  // L'app gratuite (lot A1) : ses quatre onglets pour un visiteur et un compte gratuit, cinq pour les autres ; en mode « coupe », rien n'est lu.
  const acces = await lireAcces();
  const gratuit = estGratuit(acces);
  // L'onglet Courses d'un acheteur ou d'un coaché mène à sa fiche de course, ou à ses dossiers du gratuit, ou à l'accueil.
  const coursesHref = gratuit ? null : await hrefOngletCourses(acces);
  return (
    <div className="min-h-screen bg-sand pb-24">
      {/* L'annonce d'installation de Chrome et Edge arrive tôt, parfois avant que l'app l'écoute : gardée dès le chargement,
          pour le bouton « Installer l'app » (components/app/Installation.tsx ; retour du coach du 20/10/2026). */}
      <script dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALLATION }} />
      {children}
      <HorsReseau rendu={new Date().toISOString()} />
      <Suspense>
        <BarreOnglets gratuit={gratuit} coursesHref={coursesHref} />
      </Suspense>
    </div>
  );
}
