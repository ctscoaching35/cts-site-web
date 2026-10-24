import type { Metadata } from 'next';

// L'app « CTS Coach », à part de celle des athlètes (décision coach du 22/10/2026) : installée depuis l'espace coach, elle
// s'ouvre sur « Tableau de bord ». Sa portée reste /app, pour que la connexion (/app/connexion) se fasse dans l'app.
export const metadata: Metadata = {
  title: 'CTS Coach',
  manifest: '/pwa/coach.webmanifest',
  appleWebApp: { capable: true, title: 'CTS Coach', statusBarStyle: 'default' },
};

export default function MiseEnPageCoach({ children }: { children: React.ReactNode }) {
  return children;
}
