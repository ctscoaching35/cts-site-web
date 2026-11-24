import Link from 'next/link';
import clsx from 'clsx';
import { Carte } from './Ui';
import { BOUTON_POINT, Geste, Regle } from './PointsCoach';
import type { Point } from '@/lib/app/espaceParAthlete';
import { TEXTES_PAGE_ATHLETE, type LigneAFaire } from '@/lib/app/pageAthleteSimple';
import { motsDuCoach } from '@/lib/app/motsDuCoach';

// « À FAIRE POUR LUI » (les points d'un athlète), EN HAUT DE LA PAGE D'UN ATHLÈTE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : la page de l'athlète est courte, ses alertes et ce qui est à
// faire pour lui d'abord ; lib/app/pageAthleteSimple.ts, aFairePourLui). Les mêmes points que « À faire » de « Mes athlètes » (components/app/AFaire.tsx : le même geste, le même
// « Réglé » de PointsCoach.tsx, une ligne par point), puis les étapes de « Son entrée » que le coach fait lui-même (son compte Nolio à associer, son accord à cocher, son objectif
// à démarrer) : elles n'ont pas de « Réglé », elles se cochent d'elles-mêmes. Pas de pastille de couleur par ligne : tout ce qui est ici est à faire. Sous la 8.x, la page garde son bloc
// d'avant. accordRecu : « Accord reçu », le geste de l'accord de lecture, quand son compte Nolio est associé.
// Les phrases des étapes de l'entrée (le rappel du départ) se lisent en mots du coach, sans « Hooper » (lib/app/motsDuCoach.ts, décision 220 du coach, 24/11/2026) : ce composant est celui de la 9.x.
export default function PointsPourLui({ lignes, accordRecu }: { lignes: LigneAFaire[]; accordRecu?: () => Promise<void> }) {
  const t = TEXTES_PAGE_ATHLETE;
  const enMots = motsDuCoach(true).enMots;
  const n = lignes.length;
  const ligne = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 border-t first:border-t-0 border-indigo/[0.07] scroll-mt-6';
  const geste = `${BOUTON_POINT} bg-white text-indigo border border-indigo/20 hover:bg-sand`;
  return (
    <Carte id="a-faire" className="!p-5 scroll-mt-6">
      <h2 className={clsx('text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase', n > 0 ? 'text-[#8A3326]' : 'text-teal')}>{t.aFaire}{n > 0 ? ` · ${n}` : ''}</h2>
      {n === 0 ? <p className="mt-2 text-sm text-teal font-semibold">{t.rienAFaire}</p> : (
        <ul className="mt-1">
          {lignes.map((l) => (l.type === 'point' ? (
            <li key={l.point.cle} className={ligne}>
              <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug">
                <span className="font-semibold text-indigo">{l.point.texte.charAt(0).toUpperCase()}{l.point.texte.slice(1)}</span>
                {l.point.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{l.point.sous}</span>}
              </p>
              {!l.point.sansGeste && (
                <div className="flex items-center gap-2">
                  <Geste r={l.point} />
                  <Regle cles={[l.point.cle]} />
                </div>
              )}
            </li>
          ) : (
            // « son-entree » : l'adresse que « Mes athlètes » donne à « Accord reçu ».
            <li key={`entree:${l.ligne.cle}`} id={l.ligne.cle === 'accord' ? 'son-entree' : undefined} className={ligne}>
              <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug">
                <span className="font-semibold text-indigo">{l.ligne.texte}</span>
                {l.ligne.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{enMots(l.ligne.sous)}</span>}
              </p>
              {l.ligne.bouton === 'accord' && accordRecu && (
                <form action={accordRecu}>
                  <button type="submit" className={geste}>{t.boutonAccord}</button>
                </form>
              )}
              {l.ligne.action && <Link href={l.ligne.action.href} className={geste}>{l.ligne.action.texte}</Link>}
            </li>
          )))}
        </ul>
      )}
    </Carte>
  );
}

// « À venir pour lui », dans « Réglages » (9.x) : ce qui arrive (niveau « À venir » : une course A dans Nolio, rien après l'objectif…) a quitté le haut de la
// page. Les mêmes points, le même geste, le même « Réglé » (PointsCoach.tsx) que dans « À faire pour lui » ; rien du tout s'il n'y en a pas.
export function PointsAVenir({ points }: { points: Point[] }) {
  if (points.length === 0) return null;
  return (
    <section id="a-venir" className="py-4 space-y-1">
      <h3 className="text-sm font-bold">{TEXTES_PAGE_ATHLETE.aVenir}</h3>
      <ul>
        {points.map((p) => (
          <li key={p.cle} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 border-t first:border-t-0 border-indigo/[0.07]">
            <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug">
              {p.texte.charAt(0).toUpperCase()}{p.texte.slice(1)}
              {p.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{p.sous}</span>}
            </p>
            {!p.sansGeste && (
              <div className="flex items-center gap-2">
                <Geste r={p} />
                <Regle cles={[p.cle]} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
