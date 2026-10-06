'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

// La frise des blocs (« Ton plan en un coup d'œil ») : elle défile à l'horizontale et s'ouvre
// centrée sur le bloc en cours, sans faire bouger la page.
export default function FriseBlocs({ blocs }: { blocs: { cle: string; titre: string; href: string; actif: boolean }[] }) {
  const frise = useRef<HTMLElement>(null);
  useEffect(() => {
    const conteneur = frise.current;
    const actif = conteneur?.querySelector<HTMLElement>('[aria-current="true"]');
    if (conteneur && actif) conteneur.scrollLeft = actif.offsetLeft - (conteneur.clientWidth - actif.clientWidth) / 2;
  }, [blocs]);
  return (
    <nav ref={frise} aria-label="Blocs du plan" className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
      {blocs.map((b) => (
        <Link
          key={b.cle}
          href={b.href}
          aria-current={b.actif ? 'true' : undefined}
          className={clsx(
            'shrink-0 px-3 py-1.5 text-xs border whitespace-nowrap',
            b.actif ? 'bg-teal text-white border-teal' : 'bg-white text-indigo/70 border-indigo/15'
          )}
        >
          <span className="font-bold">{b.cle}</span> · {b.titre}
        </Link>
      ))}
    </nav>
  );
}
