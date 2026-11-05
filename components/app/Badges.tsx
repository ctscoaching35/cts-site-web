import Link from 'next/link';
import clsx from 'clsx';
import { BADGES, FAMILLES, totaux, type Badge, type EtatBadges, type Famille } from '@/lib/app/badges';
import { dateLongue } from '@/lib/app/plan';
import { Carte, CarteSombre, Surtitre } from './Ui';

// Les badges du coureur (BG1 à BG3 ; maquette validée par le coach le 20/10/2026) : les 23, par famille, colorés une fois
// débloqués (avec le mois de la séance), gris avec un cadenas sinon ; un cumul gris dit où en est l'athlète.
const trait = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONES: Record<Famille | 'cadenas', React.ReactNode> = {
  distance: <path d="M6 21V4h11l-2 4 2 4H6" {...trait} />,
  duree: <><circle cx="12" cy="13" r="8" {...trait} /><path d="M12 9v4l3 2M10 3h4" {...trait} /></>,
  denivele: <path d="M3 20 9 9l4 6 3-4 5 9z" {...trait} />,
  cumul: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 13v4M9 20h6" {...trait} />,
  cadenas: <><rect x="6" y="11" width="12" height="9" rx="2" {...trait} /><path d="M9 11V8a3 3 0 0 1 6 0v3" {...trait} /></>,
};

const moisAnnee = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// Q6-f (décision coach du 05/11/2026 au soir, « A ») : sans accord de lecture, une phrase à la place des 23 badges
// verrouillés, qui ne peuvent pas se débloquer ; C18 : avec « Donner mon accord › » pour un acheteur (donnerAccord), la
// réponse au message de son coach pour un coaché. C3 : les badges verrouillés en gris foncé ; C6 : la date en lettres.
export function TesBadges({ etat, accord, aujourdhui, donnerAccord = null, coache = false }: {
  etat: EtatBadges | null; accord: boolean; aujourdhui: string; donnerAccord?: string | null; coache?: boolean;
}) {
  const debloques = etat?.debloques ?? {};
  const t = etat ? totaux(etat) : { km: 0, dplus: 0 };
  const semaine = new Date(`${aujourdhui}T12:00:00Z`);
  semaine.setUTCDate(semaine.getUTCDate() - 7);
  const recent = (d: string) => d > semaine.toISOString().slice(0, 10);
  const progression = (b: Badge) => b.mesure === 'km_total' ? `${t.km.toLocaleString('fr-FR')}\u00a0km`
    : b.mesure === 'dplus_total' ? `${t.dplus.toLocaleString('fr-FR')}\u00a0m` : 'à débloquer';
  return (
    <Carte id="badges" className="space-y-1 scroll-mt-20">
      <div className="flex items-baseline justify-between gap-3">
        <Surtitre>Tes badges</Surtitre>
        {accord && <span className="text-[0.8125rem] text-[#5E5C78]">{Object.keys(debloques).length} sur {BADGES.length}</span>}
      </div>
      {!accord ? (
        <div className="space-y-1">
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            {/* Validé par le coach le 05/11/2026 (1A ; la phrase du coaché). */}
            {coache ? 'Tes badges se débloquent tout seuls, d’après tes séances, avec ton accord : réponds « oui » au message de ton coach dans Nolio.'
              : 'Avec ton accord de lecture de Nolio, tes badges se débloquent tout seuls, d’après tes séances.'}
          </p>
          {donnerAccord && <Link href={donnerAccord} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">Donner mon accord ›</Link>}
        </div>
      ) : !etat && (
        <p className="text-xs text-[#5E5C78] leading-relaxed">Tes badges se calculent la nuit, d’après toutes tes séances de course et de trail dans Nolio.</p>
      )}
      {accord && FAMILLES.map(([famille, titre]) => (
        <section key={famille} className="pt-2.5">
          <h3 className="text-[0.656rem] font-bold tracking-[0.1em] uppercase text-[#5E5C78] mb-2">{titre}</h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
            {BADGES.filter((b) => b.famille === famille).map((b) => {
              const d = debloques[b.cle]?.date;
              return (
                <li key={b.cle} className={clsx('rounded-xl px-1.5 py-2.5 flex flex-col items-center gap-1 text-center',
                  d ? 'bg-[#E1EFEA] border border-[#9FD3C5]' : 'bg-sand border border-dashed border-indigo/20')}>
                  <span className={clsx('w-9 h-9 rounded-full flex items-center justify-center',
                    d ? 'bg-teal text-white' : 'bg-white text-[#5E5C78] border border-indigo/15')}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>{ICONES[d ? b.famille : 'cadenas']}</svg>
                  </span>
                  <span className={clsx('text-[0.78rem] leading-tight', d ? 'font-bold text-teal-dark' : 'font-semibold text-[#5E5C78]')}>{b.court}</span>
                  <span className={clsx('text-[0.656rem] leading-tight', d ? 'text-teal-dark' : 'text-[#5E5C78]')}>
                    {d ? (recent(d) ? 'nouveau' : moisAnnee(d)) : progression(b)}
                  </span>
                  <span className="sr-only">{d ? `débloqué le ${dateLongue(d, true)}` : 'à débloquer'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Carte>
  );
}

// La carte de l'accueil : le badge débloqué la semaine écoulée (le plus récent), et combien d'autres avec lui.
export function CarteNouveauBadge({ badges, href }: { badges: (Badge & { date: string })[]; href: string }) {
  const [premier, ...autres] = badges;
  if (!premier) return null;
  return (
    <Link href={href} className="block">
      <CarteSombre className="flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-full bg-teal text-white flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>{ICONES[premier.famille]}</svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#B9B8CC]">Nouveau badge</span>
          <span className="block font-bold">{premier.annonce}{autres.length ? ` et ${autres.length} autre${autres.length > 1 ? 's' : ''}` : ''}</span>
          <span className="block text-xs text-[#D6D5E6]">Voir tes badges ›</span>
        </span>
      </CarteSombre>
    </Link>
  );
}
