import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { site } from '@/lib/content';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: 'CTS Coaching — Coaching Trail Scientifique | Rennes',
  description:
    'Coaching trail running personnalisé par des kinésithérapeutes du sport. Juliette & Romain, kinés officiels UTMB Mont-Blanc. 80€/mois sans engagement.',
  keywords: [
    'coaching trail',
    'coach trail Rennes',
    'kinésithérapeute du sport',
    'préparation UTMB',
    'trail running',
    'CTS Coaching',
    'Juliette Vinot',
    'Romain Leterme',
  ],
  authors: [{ name: 'CTS Coaching' }],
  creator: 'CTS Coaching',
  publisher: 'CTS Coaching',
  alternates: { canonical: site.url },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: site.url,
    siteName: 'CTS Coaching',
    title: 'CTS Coaching — Du bitume au sommet',
    description:
      'Coaching trail scientifique pour traileurs citadins. Par des kinés officiels UTMB Mont-Blanc.',
    images: [
      {
        url: '/photos/DSC_8334.jpg',
        width: 1200,
        height: 630,
        alt: 'CTS Coaching — Coaching trail scientifique',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CTS Coaching — Du bitume au sommet',
    description:
      'Coaching trail scientifique pour traileurs citadins. Par des kinés officiels UTMB Mont-Blanc.',
    images: ['/photos/DSC_8334.jpg'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/logo/cts-logo.png', apple: '/logo/cts-logo.png' },
};

export const viewport: Viewport = {
  themeColor: '#2F2D4E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
