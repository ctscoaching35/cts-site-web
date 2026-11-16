'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PARAMETRES_DEMONSTRATION } from '@/lib/app/demonstrationPorte';
import { CHEMIN_ONGLET, ordreDesOnglets, ongletAllume, TITRE_ONGLET, type CleOnglet } from '@/lib/app/ongletsApp';

// Une seule app, deux jeux d'onglets (refonte de l'app payante, décisions du coach du 16/11/2026 ; lib/app/ongletsApp.ts) :
// visiteur et compte gratuit, Accueil, Courses, Profil, Bibliothèque ; acheteur et coaché, Accueil, Plan, Courses, Profil,
// Bibliothèque. « Données » (dans Plan) et « Compte » (les initiales de l'en-tête) ne sont plus des onglets. En bas sur
// téléphone, comme une app. Hauteur fixe (h-16, plus la zone sûre de l'iPhone) : la fiche ouverte dans l'app s'accroche juste
// au-dessus.
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONES: Record<CleOnglet, React.ReactNode> = {
  accueil: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...trait} />,
  plan: <><rect x="4" y="5" width="16" height="16" rx="2" {...trait} /><path d="M4 10h16M8 3v4M16 3v4" {...trait} /></>,
  courses: <path d="M3 20 9 9l4 6 3-4 5 9z" {...trait} />,
  profil: <><circle cx="12" cy="8" r="4" {...trait} /><path d="M4 21c1.6-4 4.6-6 8-6s6.4 2 8 6" {...trait} /></>,
  bibliotheque: <><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" {...trait} /><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" {...trait} /></>,
};

// Pas d'onglets avant d'avoir un plan à lire, ni dans l'espace coach.
const SANS_ONGLETS = ['/app/connexion', '/app/sans-plan', '/app/bienvenue'];

export default function BarreOnglets({ gratuit = false, coursesHref = null }: { gratuit?: boolean; coursesHref?: string | null }) {
  const chemin = usePathname();
  const params = useSearchParams();
  // Les pages vues dans l'app pendant la session : le bouton retour (Retour) revient d'où l'on vient s'il y en a une.
  useEffect(() => {
    try {
      sessionStorage.setItem('cts-pages-vues', String(Number(sessionStorage.getItem('cts-pages-vues') ?? 0) + 1));
    } catch {
      // Sans stockage (navigation privée stricte) : le retour mène à la page parente.
    }
  }, [chemin]);
  if (SANS_ONGLETS.includes(chemin) || chemin.startsWith('/app/coach')) return null;
  // Les onglets gardent le plan, le jour et les états de la démonstration (avant, ils perdaient « à la main », « sans
  // objectif » et les états ; audits du 05/11/2026) ; une adresse réelle n'en a aucun.
  const garde = new URLSearchParams();
  for (const cle of PARAMETRES_DEMONSTRATION) {
    const valeur = params.get(cle);
    if (valeur) garde.set(cle, valeur);
  }
  const requete = garde.toString();
  const suite = requete ? `?${requete}` : '';
  // C5 (audits du 05/11/2026) : un calculateur ouvert depuis une fiche de course (?garder=…) allume Accueil, depuis la
  // bibliothèque, Bibliothèque. L'onglet Plan est allumé sur « Ta préparation » comme sur « Tes données ».
  const depuisUneFiche = Boolean(params.get('garder'));
  const liste = ordreDesOnglets(gratuit);
  // L'onglet Courses d'un acheteur ou d'un coaché (étape (c) à venir) ; en démonstration, un coaché sans objectif (?sansobjectif=1)
  // n'a pas de fiche de course : son accueil.
  const destination = params.get('sansobjectif') === '1' ? '/app' : coursesHref ?? CHEMIN_ONGLET.courses;
  return (
    <nav
      aria-label="Navigation de l’app"
      className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-indigo/10 pb-[env(safe-area-inset-bottom)]"
      // Une marge sur les côtés : les coins arrondis de l'iPhone coupaient le « A » d'« Aujourd'hui »
      // (retour du coach du 07/10/2026).
      style={{ paddingLeft: 'max(4px, env(safe-area-inset-left))', paddingRight: 'max(4px, env(safe-area-inset-right))' }}
    >
      <ul className={clsx('mx-auto max-w-2xl grid', gratuit ? 'grid-cols-4' : 'grid-cols-5')}>
        {liste.map((cle) => (
          <li key={cle}>
            <Link
              href={`${cle === 'courses' && !gratuit ? destination : CHEMIN_ONGLET[cle]}${suite}`}
              aria-current={ongletAllume(cle, chemin, gratuit, depuisUneFiche) ? 'page' : undefined}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 h-16 text-[0.656rem] tracking-tight whitespace-nowrap',
                ongletAllume(cle, chemin, gratuit, depuisUneFiche) ? 'text-teal font-bold' : 'text-[#5E5C78] font-semibold hover:text-indigo'
              )}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
                {ICONES[cle]}
              </svg>
              {TITRE_ONGLET[cle]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
