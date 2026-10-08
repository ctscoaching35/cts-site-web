import Link from 'next/link';
import clsx from 'clsx';
import type { Semaine } from '@/lib/app/plan';
import { FAMILLES } from '@/lib/app/charte';
import { lien, type Contexte } from '@/lib/app/contexte';
import { texteReperes } from '@/lib/app/zones';
import { marque } from '@/lib/app/journal';
import { mentionDeplacee } from '@/lib/app/deplacement';

// Les sept jours d'une semaine, comme le tableau du PDF : date, séance, terrain, durée, RPE,
// à la couleur de leur famille. Chaque séance ouvre sa fiche ; le repos reste en retrait.
export default function JoursSemaine({ semaine, ctx }: { semaine: Semaine; ctx: Contexte }) {
  return (
    <ul className="bg-white divide-y divide-indigo/10 shadow-sm">
      {semaine.jours.map((j) => {
        const repos = j.famille === 'repos';
        const course = j.famille === 'course';
        // Les repères de « Tes zones » suivent le RPE : le RPE d'abord, il décide.
        const details = [j.terrain, j.duree, j.rpe !== '—' ? `RPE ${j.rpe}` : '', texteReperes(j.reperes, ctx.profil) ?? '']
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
                {/* Une séance que l'athlète a déplacée (§7.2, E5). */}
                {j.prevu && <span className="block text-xs mt-0.5 text-indigo/55 italic">{mentionDeplacee(j)}</span>}
              </span>
              {/* Le fait (J5) : ✓ faite, ½ raccourcie, – pas faite ; rien sans retour. */}
              {marque(ctx.retours[j.id]) && (
                <span className={clsx('text-sm font-bold w-4 text-center', ctx.retours[j.id]?.statut === 'pas_faite' ? 'text-indigo/35' : 'text-teal')}
                  aria-label={ctx.retours[j.id]?.statut === 'pas_faite' ? 'pas faite' : ctx.retours[j.id]?.statut}>
                  {marque(ctx.retours[j.id])}
                </span>
              )}
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
