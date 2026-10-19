import clsx from 'clsx';

// Les pièces de la refonte de l'app (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1 à AP4 ; maquettes validées
// par le coach le 19/10/2026) : une carte blanche aux coins arrondis, une carte sombre, un surtitre.

export function Carte({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={clsx('bg-white rounded-2xl border border-indigo/[0.08] p-[18px]', className)}>
      {children}
    </section>
  );
}

export function CarteSombre({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx('bg-indigo text-white rounded-[18px] p-5', className)}>{children}</section>;
}

export function Surtitre({ children, ton = 'teal', as: Balise = 'h2' }: {
  children: React.ReactNode; ton?: 'teal' | 'clair' | 'ocre' | 'gris'; as?: 'h2' | 'h3' | 'div';
}) {
  const couleur = { teal: 'text-teal', clair: 'text-[#8FD1C3]', ocre: 'text-[#8A5E10]', gris: 'text-indigo/60' }[ton];
  return <Balise className={clsx('text-[0.6875rem] font-bold tracking-[0.14em] uppercase', couleur)}>{children}</Balise>;
}

// Une pastille de date, « 22 / NOV. ».
export function PastilleDate({ iso, sombre = false }: { iso: string; sombre?: boolean }) {
  const d = new Date(`${iso}T12:00:00Z`);
  const mois = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase();
  return (
    <span className={clsx('w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0',
      sombre ? 'bg-white/[0.12] text-white' : 'bg-[#E1EFEA] text-teal-dark')}>
      <span className="text-[0.95rem] font-extrabold leading-none">{d.getUTCDate()}</span>
      <span className="text-[0.56rem] font-bold tracking-[0.06em]">{mois}.</span>
    </span>
  );
}
