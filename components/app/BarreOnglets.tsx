'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';

// Les cinq onglets du cadrage (section 3) : en bas sur téléphone, comme une app. Hauteur fixe
// (h-16, plus la zone sûre de l'iPhone) : la fiche ouverte dans l'app s'accroche juste au-dessus.
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ONGLETS = [
  {
    chemin: '/app', titre: 'Aujourd’hui',
    icone: <><circle cx="12" cy="12" r="4" {...trait} /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...trait} /></>,
  },
  {
    chemin: '/app/calendrier', titre: 'Calendrier',
    icone: <><rect x="3" y="5" width="18" height="16" rx="1.5" {...trait} /><path d="M3 10h18M8 3v4M16 3v4" {...trait} /></>,
  },
  {
    chemin: '/app/plan', titre: 'Mon plan',
    icone: <path d="M3 20l5-12 4 7 3-5 6 10z" {...trait} />,
  },
  {
    chemin: '/app/bibliotheque', titre: 'Bibliothèque',
    icone: <><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" {...trait} /><path d="M4 19a2 2 0 0 0 2 2h13" {...trait} /></>,
  },
  {
    chemin: '/app/compte', titre: 'Compte',
    icone: <><circle cx="12" cy="8" r="4" {...trait} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...trait} /></>,
  },
];

export default function BarreOnglets() {
  const chemin = usePathname();
  const params = useSearchParams();
  // Les onglets gardent le plan et le jour de la démonstration.
  const garde = new URLSearchParams();
  for (const cle of ['plan', 'jour']) {
    const valeur = params.get(cle);
    if (valeur) garde.set(cle, valeur);
  }
  const requete = garde.toString();
  const suite = requete ? `?${requete}` : '';
  // Une fiche séance s'ouvre depuis le calendrier : c'est lui qui reste allumé.
  const actif = (c: string) =>
    c === '/app' ? chemin === '/app' : chemin.startsWith(c) || (c === '/app/calendrier' && chemin.startsWith('/app/seance'));
  return (
    <nav
      aria-label="Navigation de l’app"
      className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-indigo/10 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto max-w-2xl grid grid-cols-5">
        {ONGLETS.map((o) => (
          <li key={o.chemin}>
            <Link
              href={`${o.chemin}${suite}`}
              aria-current={actif(o.chemin) ? 'page' : undefined}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 h-16 text-[0.65rem] font-semibold',
                actif(o.chemin) ? 'text-teal' : 'text-indigo/50 hover:text-indigo'
              )}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                {o.icone}
              </svg>
              {o.titre}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
