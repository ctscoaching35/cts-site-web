import Link from 'next/link';
import clsx from 'clsx';
import type { Semaine } from '@/lib/app/plan';
import { FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';

// Les sept jours d'une semaine, comme le tableau du PDF : date, séance, terrain, durée, RPE,
// à la couleur de leur famille. Chaque séance ouvre sa fiche ; le repos reste en retrait.
export default function JoursSemaine({ semaine, ctx }: { semaine: Semaine; ctx: Contexte }) {
  return (
    <ul className="bg-white divide-y divide-indigo/10 shadow-sm">
      {semaine.jours.map((j) => {
        const repos = j.famille === 'repos';
        const course = j.famille === 'course';
        const details = [j.terrain, j.duree, j.rpe !== '—' ? `RPE ${j.rpe}` : '']
          .filter((x) => x && x !== '—')
          .join(' · ');
        const contenu = (
          <div className={clsx('flex items-stretch', course && 'bg-teal text-white')}>
            <span aria-hidden className="w-1.5 shrink-0" style={{ backgroundColor: repos ? 'transparent' : FAMILLES[j.famille].filet }} />
            <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5">
              <span className={clsx('w-[4.6rem] shrink-0 text-xs', course ? 'text-white/80' : 'text-indigo/55')}>{j.date}</span>
              <span className="flex-1 min-w-0">
                <span className={clsx('block leading-snug', repos ? 'text-indigo/40' : 'font-semibold', !repos && !course && 'text-indigo')}>
                  {j.seance}
                </span>
                {!repos && details && (
                  <span className={clsx('block text-xs mt-0.5', course ? 'text-white/80' : 'text-indigo/55')}>{details}</span>
                )}
              </span>
              {!repos && <span aria-hidden className={course ? 'text-white/70' : 'text-indigo/30'}>›</span>}
            </div>
          </div>
        );
        return (
          <li key={j.id} className={clsx(j.date_iso === ctx.jour && 'ring-2 ring-inset ring-teal')}>
            {repos ? contenu : <Link href={lien(`/app/seance/${j.id}`, ctx)} className="block hover:bg-sand/60">{contenu}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
