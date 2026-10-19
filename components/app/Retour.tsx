'use client';

import { useRouter } from 'next/navigation';

// Le retour de l'app (décision coach du 20/10/2026 : des boutons retour partout où il en manque) : la page d'où l'on
// vient quand il y en a une dans l'app, sinon la page parente.
export default function Retour({ href, libelle }: { href: string; libelle: string }) {
  const router = useRouter();
  return (
    <button type="button" className="inline-flex items-center min-h-11 px-2 text-sm font-bold text-teal whitespace-nowrap"
      onClick={() => {
        // Les pages vues dans l'app pendant la session (BarreOnglets les compte) : plus d'une, on revient d'où l'on vient.
        let vues = 0;
        try {
          vues = Number(sessionStorage.getItem('cts-pages-vues') ?? 0);
        } catch {
          vues = 0;
        }
        if (vues > 1 && window.history.length > 1) router.back();
        else router.push(href);
      }}>
      ‹ {libelle}
    </button>
  );
}
