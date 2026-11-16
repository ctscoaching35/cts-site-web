import Image from 'next/image';
import Link from 'next/link';

// L'en-tête unique de toute l'app (refonte de l'app payante, étape (a), décisions du coach du 16/11/2026) : le logo et
// « CITY TO SUMMIT », qui ramènent à l'accueil, et à droite ce que la page y met (les initiales qui ouvrent le compte, « Me
// connecter », « Fermer »). Les trois en-têtes d'avant (gratuit, athlète, simple) l'habillent ; « CTS COACHING » n'est plus
// dans l'app de l'athlète.
export default function EnTeteMarque({ accueil = '/app', droite = null }: { accueil?: string; droite?: React.ReactNode }) {
  return (
    <header className="bg-white border-b border-indigo/[0.08]">
      <div className="mx-auto max-w-2xl h-16 px-4 flex items-center justify-between gap-3">
        {/* C6 (audits du 05/11/2026) : le logo n'est plus lu deux fois (le texte le dit). */}
        <Link href={accueil} className="flex items-center gap-2.5 min-w-0">
          <Image src="/logo/cts-logo-rond-blanc.png" alt="" width={36} height={36} className="w-9 h-9 object-contain" />
          <span className="text-[0.8125rem] font-bold tracking-[0.12em] text-indigo">CITY TO SUMMIT</span>
        </Link>
        {droite}
      </div>
    </header>
  );
}

// Les initiales de l'athlète, qui ouvrent son compte (maquette « Compte » de l'app payante).
export function PastilleCompte({ href, initiales }: { href: string; initiales: string }) {
  return (
    <Link href={href} aria-label="Ton compte"
      className="w-9 h-9 rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-[0.8125rem] font-bold shrink-0">
      {initiales}
    </Link>
  );
}
