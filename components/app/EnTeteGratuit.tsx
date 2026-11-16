import Link from 'next/link';
import type { Acces } from '@/lib/app/acces';
import EnTeteMarque, { PastilleCompte } from './EnTeteMarque';

// L'en-tête de l'app gratuite (maquette validée le 16/11/2026) : l'en-tête unique, et à droite « Me connecter » pour un
// visiteur ; pour un compte gratuit, son initiale, qui ouvre son compte. fermer : l'écran « Me connecter » se ferme vers
// l'accueil.
export default function EnTeteGratuit({ acces, fermer = false }: { acces: Pick<Acces, 'cas' | 'email'>; fermer?: boolean }) {
  const lien = 'inline-flex items-center min-h-11 px-3 text-xs font-bold text-teal';
  return (
    <EnTeteMarque droite={fermer ? <Link href="/app" className={lien}>Fermer</Link>
      : acces.cas === 'gratuit' ? <PastilleCompte href="/app/compte" initiales={(acces.email ?? '').trim().charAt(0).toUpperCase() || 'CTS'} />
      : <Link href="/app/me-connecter" className={lien}>Me connecter</Link>} />
  );
}
