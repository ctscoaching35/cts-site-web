import Link from 'next/link';
import clsx from 'clsx';
import type { Semaine } from '@/lib/app/plan';
import { FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';

const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// La semaine en un coup d'œil : une pastille par jour, à la couleur de sa séance.
export default function PastillesSemaine({ semaine, ctx }: { semaine: Semaine; ctx: Contexte }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5 bg-white px-3 py-3 shadow-sm">
      {semaine.jours.map((j, i) => {
        const repos = j.famille === 'repos';
        const pastille = (
          <span className="flex flex-col items-center gap-1">
            <span className={clsx('text-[0.65rem] font-semibold', j.date_iso === ctx.jour ? 'text-teal' : 'text-indigo/50')}>
              {INITIALES[i]}
            </span>
            <span
              className={clsx(
                'w-7 h-7 rounded-full border-2 flex items-center justify-center text-[0.6rem] font-bold text-white',
                j.date_iso === ctx.jour && 'ring-2 ring-offset-2 ring-teal'
              )}
              style={{
                backgroundColor: repos ? 'transparent' : FAMILLES[j.famille].filet,
                borderColor: repos ? '#C5D5D2' : FAMILLES[j.famille].filet,
              }}
            >
              {/* La course se distingue de la sortie longue, de la même couleur. */}
              {j.famille === 'course' && 'J'}
            </span>
          </span>
        );
        return (
          <li key={j.id} title={j.seance}>
            {repos ? pastille : <Link href={lien(`/app/seance/${j.id}`, ctx)} aria-label={`${j.date} — ${j.seance}`}>{pastille}</Link>}
          </li>
        );
      })}
    </ol>
  );
}
