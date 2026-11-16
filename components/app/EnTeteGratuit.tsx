import Image from 'next/image';
import Link from 'next/link';
import type { Acces } from '@/lib/app/acces';

// L'en-tête de l'app gratuite (maquette validée le 16/11/2026) : le logo, qui ramène à l'accueil, et à droite « Me
// connecter » pour un visiteur ; pour un compte gratuit, son initiale, qui ouvre son compte. fermer : l'écran « Me
// connecter » se ferme vers l'accueil.
export default function EnTeteGratuit({ acces, fermer = false }: { acces: Pick<Acces, 'cas' | 'email'>; fermer?: boolean }) {
  const lien = 'inline-flex items-center min-h-11 px-3 text-xs font-bold text-teal';
  return (
    <header className="bg-white border-b border-indigo/[0.08]">
      <div className="mx-auto max-w-2xl h-16 px-4 flex items-center justify-between gap-3">
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <Image src="/logo/cts-logo-rond-blanc.png" alt="" width={36} height={36} className="w-9 h-9 object-contain" />
          <span className="text-[0.8125rem] font-bold tracking-[0.12em] text-indigo">CITY TO SUMMIT</span>
        </Link>
        {fermer ? <Link href="/app" className={lien}>Fermer</Link>
          : acces.cas === 'gratuit' ? (
            <Link href="/app/compte" aria-label="Ton compte"
              className="w-9 h-9 rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-[0.8125rem] font-bold shrink-0">
              {(acces.email ?? '').trim().charAt(0).toUpperCase() || 'CTS'}
            </Link>
          ) : <Link href="/app/me-connecter" className={lien}>Me connecter</Link>}
      </div>
    </header>
  );
}
