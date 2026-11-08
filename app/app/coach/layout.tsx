import type { Metadata, Viewport } from 'next';

// L'app « CTS Coach », à part de celle des athlètes (décision coach du 22/10/2026) : installée depuis l'espace coach, elle
// s'ouvre sur « Mes athlètes » (l'accueil depuis l'espace par athlète, 08/11/2026). Sa portée reste /app, pour que la connexion (/app/connexion) se fasse dans l'app.
// Son titre tel quel (le gabarit « … · CTS » de l'app des athlètes ne s'y applique pas) et sa barre d'état indigo, comme
// avant le 05/11/2026 (C6 et C7 ne valent que pour l'app des athlètes).
export const viewport: Viewport = { themeColor: '#2F2D4E' };
export const metadata: Metadata = {
  title: { absolute: 'CTS Coach' },
  manifest: '/pwa/coach.webmanifest',
  appleWebApp: { capable: true, title: 'CTS Coach', statusBarStyle: 'default' },
};

export default function MiseEnPageCoach({ children }: { children: React.ReactNode }) {
  return children;
}
