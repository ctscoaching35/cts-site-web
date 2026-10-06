import type { Semaine } from '@/lib/app/plan';
import { BANNIERE } from '@/lib/app/charte';

// La bannière de semaine du PDF : numéro, type et bloc, volume et séances, dates.
export default function BanniereSemaine({ semaine }: { semaine: Semaine }) {
  return (
    <div className="text-white px-4 py-3" style={{ backgroundColor: BANNIERE[semaine.type] ?? '#2F2D4E' }}>
      <div className="flex items-center gap-4">
        <span className="text-2xl font-extrabold leading-none">{semaine.numero}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold leading-tight">{semaine.type}</div>
          <div className="text-xs text-white/75 truncate">{semaine.bloc}</div>
        </div>
        <div className="text-right">
          <div className="font-bold leading-tight">{semaine.volume}</div>
          <div className="text-xs text-white/75">{semaine.seances}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-white/75">
        {semaine.dates} · {semaine.progression}
      </div>
    </div>
  );
}
