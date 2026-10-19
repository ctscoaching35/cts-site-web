'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { usePathname, useSearchParams } from 'next/navigation';

// Les cinq onglets (CTS_NOLIO_CADRAGE.md, AP1, décision coach du 19/10/2026) : Accueil (le tableau de bord, et
// l'objectif qu'il ouvre), Données, Profil, Bibliothèque, Compte ; les mêmes pour un coaché et un acheteur. En bas sur
// téléphone, comme une app. Hauteur fixe (h-16, plus la zone sûre de l'iPhone) : la fiche ouverte dans l'app
// s'accroche juste au-dessus. « Accueil » : « Tableau de bord » ne tient pas à cinq onglets (maquette validée).
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ONGLETS = [
  {
    chemin: '/app', titre: 'Accueil',
    icone: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...trait} />,
  },
  {
    chemin: '/app/donnees', titre: 'Données',
    icone: <path d="M5 19V11M11 19V5M17 19v-6M3 21h18" {...trait} />,
  },
  {
    chemin: '/app/profil', titre: 'Profil',
    icone: <><circle cx="12" cy="8" r="4" {...trait} /><path d="M4 21c1.6-4 4.6-6 8-6s6.4 2 8 6" {...trait} /></>,
  },
  {
    chemin: '/app/bibliotheque', titre: 'Bibliothèque',
    icone: <><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" {...trait} /><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" {...trait} /></>,
  },
  {
    chemin: '/app/compte', titre: 'Compte',
    icone: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...trait} /><circle cx="15" cy="7" r="2" {...trait} /><circle cx="9" cy="17" r="2" {...trait} /></>,
  },
];

// Pas d'onglets avant d'avoir un plan à lire, ni dans l'espace coach.
const SANS_ONGLETS = ['/app/connexion', '/app/sans-plan', '/app/bienvenue'];

export default function BarreOnglets() {
  const chemin = usePathname();
  const params = useSearchParams();
  if (SANS_ONGLETS.includes(chemin) || chemin.startsWith('/app/coach')) return null;
  // Les onglets gardent le plan et le jour de la démonstration.
  const garde = new URLSearchParams();
  for (const cle of ['plan', 'jour', 'fc1', 'vc', 'fc2', 'v1', 'retours']) {
    const valeur = params.get(cle);
    if (valeur) garde.set(cle, valeur);
  }
  const requete = garde.toString();
  const suite = requete ? `?${requete}` : '';
  // L'objectif (/app/plan) s'ouvre depuis l'accueil : c'est lui qui reste allumé ; un calculateur, depuis la
  // bibliothèque.
  const actif = (c: string) =>
    c === '/app'
      ? chemin === '/app' || chemin.startsWith('/app/plan') || chemin.startsWith('/app/objectif')
      : chemin.startsWith(c) || (c === '/app/bibliotheque' && chemin.startsWith('/app/calculateurs'));
  return (
    <nav
      aria-label="Navigation de l’app"
      className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-indigo/10 pb-[env(safe-area-inset-bottom)]"
      // Une marge sur les côtés : les coins arrondis de l'iPhone coupaient le « A » d'« Aujourd'hui »
      // (retour du coach du 07/10/2026).
      style={{ paddingLeft: 'max(4px, env(safe-area-inset-left))', paddingRight: 'max(4px, env(safe-area-inset-right))' }}
    >
      <ul className="mx-auto max-w-2xl grid grid-cols-5">
        {ONGLETS.map((o) => (
          <li key={o.chemin}>
            <Link
              href={`${o.chemin}${suite}`}
              aria-current={actif(o.chemin) ? 'page' : undefined}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 h-16 text-[0.656rem] tracking-tight whitespace-nowrap',
                actif(o.chemin) ? 'text-teal font-bold' : 'text-[#5E5C78] font-semibold hover:text-indigo'
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
