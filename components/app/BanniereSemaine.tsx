import type { Semaine } from '@/lib/app/plan';
import { BANNIERE } from '@/lib/app/charte';

// La bannière de semaine, en carte claire (décision coach du 07/10/2026, « option A ») : la semaine et
// ses dates en surtitre, le type en titre, le bloc en pastille, le volume et les séances en grand, et
// la place de la semaine dans le plan. Le filet à gauche garde la couleur du type, celle du PDF.
export default function BanniereSemaine({ semaine }: { semaine: Semaine }) {
  // « semaine 15 / 24 » et « 5 séances », tels que le moteur les écrit : l'app ne fait que les ranger.
  const rang = /(\d+)\s*\/\s*(\d+)/.exec(semaine.progression);
  const [n, total] = rang ? [Number(rang[1]), Number(rang[2])] : [0, 0];
  const seances = /^(\d+)\s+(.+)$/.exec(semaine.seances);
  return (
    <div className="bg-white shadow-sm border-l-4 px-4 py-3" style={{ borderLeftColor: BANNIERE[semaine.type] ?? '#2F2D4E' }}>
      <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-indigo/55">
        {total ? `Semaine ${n} sur ${total}` : semaine.numero} · {semaine.dates}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="text-xl font-extrabold text-indigo">{semaine.type}</span>
        <span className="text-xs font-semibold text-indigo bg-[#E4E3EE] px-2.5 py-1 rounded-full">{semaine.bloc}</span>
      </div>
      <div className="flex gap-6 mt-2">
        <div>
          <div className="text-2xl font-extrabold text-indigo leading-tight">{semaine.volume}</div>
          <div className="text-xs text-indigo/55">de volume</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold text-indigo leading-tight">{seances ? seances[1] : semaine.seances}</div>
          {seances && <div className="text-xs text-indigo/55">{seances[2]}</div>}
        </div>
      </div>
      {total > 0 && (
        <div className="flex gap-0.5 mt-3" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="flex-1 h-1.5"
              style={{ backgroundColor: i + 1 < n ? '#B9BDCB' : i + 1 === n ? '#0C6E5F' : '#E6E8EE' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
