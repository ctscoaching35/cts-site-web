import Link from 'next/link';

const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// « Aller plus loin » : pour l'instant, la page de vente des plans existante.
export function AllerPlusLoin({ titre = 'Pour t’entraîner : le plan adaptatif, ou le coaching humain.',
  texte = 'Un plan de 3, 4 ou 6 mois qui s’adapte chaque semaine à ce que tu cours. Ou un coach qui te suit, à 89 € par mois.',
  lienTexte = 'Voir les deux offres' }: { titre?: string; texte?: string; lienTexte?: string }) {
  return (
    <Link href="/plans" className="flex flex-col gap-2 bg-indigo text-white rounded-2xl px-4 py-[18px] min-h-11">
      <span className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-sand-dark">Aller plus loin</span>
      <span className="text-[1.0625rem] font-extrabold leading-snug">{titre}</span>
      {texte && <span className="text-[0.78rem] leading-snug text-sand-dark">{texte}</span>}
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-bold mt-1">
        {lienTexte}
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden><path d="M9 6l6 6-6 6" {...trait} strokeWidth={2} /></svg>
      </span>
    </Link>
  );
}
