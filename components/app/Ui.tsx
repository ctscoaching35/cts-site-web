import clsx from 'clsx';
import { ECRIRE_A_CTS } from '@/lib/app/contact';

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

// Q4 (décision coach du 05/11/2026 au soir, « A ») : un seul bouton principal dans l'app, le rectangle vert arrondi, sans
// majuscules (avant, trois : le bouton carré du site en capitales, ce rectangle, la pilule blanche) ; un bouton
// secondaire bordé ; un champ arrondi. Toutes les cibles font 44 px de haut au moins (C1).
export const BOUTON = 'inline-flex items-center justify-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold text-center disabled:opacity-50';
export const BOUTON_SECONDAIRE = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-indigo/25 bg-white text-indigo text-sm font-bold text-center disabled:opacity-50';
// Un geste qui efface ou retire (supprimer son compte, retirer son accord, effacer sa stratégie ou ses repères).
export const BOUTON_DANGER = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-[#9A3B2C]/45 bg-white text-[#9A3B2C] text-sm font-bold text-center disabled:opacity-50';
export const CHAMP = 'w-full min-h-11 rounded-[10px] border border-indigo/20 bg-white px-3 text-sm text-indigo outline-none focus:border-teal';
// Un lien d'une ligne, « Donner mon accord › » : 44 px de haut.
export const LIEN = 'inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal';
// Le titre d'une page de l'app.
export const TITRE = 'text-[1.625rem] font-extrabold text-indigo tracking-tight leading-tight';

// Le lien vers CTS (Q5, lib/app/contact.ts), « Écris-nous › », 44 px de haut.
export function EcrisNous({ texte = 'Écris-nous ›' }: { texte?: string }) {
  return <a href={ECRIRE_A_CTS} className={LIEN}>{texte}</a>;
}
