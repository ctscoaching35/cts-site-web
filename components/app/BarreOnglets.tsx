'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';

// Les quatre onglets (CTS_NOLIO_CADRAGE.md, T1, 18/10/2026 : les séances vivent dans Nolio, plus de calendrier) : en
// bas sur téléphone, comme une app. Hauteur fixe (h-16, plus la zone sûre de l'iPhone) : la fiche ouverte dans l'app
// s'accroche juste au-dessus.
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ONGLETS = [
  {
    chemin: '/app', titre: 'Tableau de bord',
    icone: <><path d="M4 18a8 8 0 1 1 16 0" {...trait} /><path d="M12 18l4-6" {...trait} /><circle cx="12" cy="18" r="1.2" {...trait} /></>,
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

// Pas d'onglets avant d'avoir un plan à lire.
const SANS_ONGLETS = ['/app/connexion', '/app/sans-plan', '/app/bienvenue'];

export default function BarreOnglets() {
  const chemin = usePathname();
  const params = useSearchParams();
  if (SANS_ONGLETS.includes(chemin)) return null;
  // Les onglets gardent le plan et le jour de la démonstration.
  const garde = new URLSearchParams();
  for (const cle of ['plan', 'jour', 'fc1', 'vc', 'fc2', 'retours']) {
    const valeur = params.get(cle);
    if (valeur) garde.set(cle, valeur);
  }
  const requete = garde.toString();
  const suite = requete ? `?${requete}` : '';
  // Un calculateur s'ouvre depuis la bibliothèque : c'est elle qui reste allumée.
  const actif = (c: string) =>
    c === '/app'
      ? chemin === '/app'
      : chemin.startsWith(c) || (c === '/app/bibliotheque' && chemin.startsWith('/app/calculateurs'));
  return (
    <nav
      aria-label="Navigation de l’app"
      className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-indigo/10 pb-[env(safe-area-inset-bottom)]"
      // Une marge sur les côtés : les coins arrondis de l'iPhone coupaient le « A » d'« Aujourd'hui »
      // (retour du coach du 07/10/2026).
      style={{ paddingLeft: 'max(10px, env(safe-area-inset-left))', paddingRight: 'max(10px, env(safe-area-inset-right))' }}
    >
      <ul className="mx-auto max-w-2xl grid grid-cols-4">
        {ONGLETS.map((o) => (
          <li key={o.chemin}>
            <Link
              href={`${o.chemin}${suite}`}
              aria-current={actif(o.chemin) ? 'page' : undefined}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 h-16 text-[0.625rem] tracking-tight whitespace-nowrap font-semibold',
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
