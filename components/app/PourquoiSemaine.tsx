import { Surtitre } from '@/components/app/Ui';
import type { Pourquoi } from '@/lib/app/ecriture';

// Le pourquoi de la semaine proposée (moteur, cts_pourquoi ; demande du coach du 31/10/2026 : « que tu me justifies ce
// que tu proposes la semaine prochaine […] son niveau, son terrain, son objectif, ce que l'on a fait avant, ce qu'il a fait
// la semaine dernière ») : à confronter avec ce que le coach proposerait. Écrit par le moteur, sans IA. Replié, à ouvrir
// (décision coach du 04/11/2026) ; la semaine passée est dans « Ce qu'il a lu », en une seule mesure de charge : le
// moteur la dit en charge faite, le site en charge tenue (51 % et 42 % pour la même semaine, 04/11/2026).
export default function PourquoiSemaine({ pourquoi }: { pourquoi: Pourquoi }) {
  return (
    <details className="group bg-white rounded-2xl border border-indigo/[0.08] p-5">
      <summary className="cursor-pointer list-none min-h-8 flex items-center justify-between gap-3">
        <Surtitre as="div">Pourquoi cette semaine</Surtitre>
        <span className="text-xs text-[#5E5C78]">Ouvrir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
      </summary>
      <div className="mt-3 space-y-3">
        <ul className="space-y-1 text-sm leading-relaxed text-[#3B3957]">
          {pourquoi.profil.map((l) => <li key={l}>{l}</li>)}
          {pourquoi.ou && <li>{pourquoi.ou}</li>}
        </ul>
        <ul className="divide-y divide-indigo/10 text-sm">
          {pourquoi.seances.map((s, i) => (
            <li key={`${s.jour}-${i}`} className="py-2">
              <span className="font-bold text-indigo">{s.jour} · {s.seance}</span>
              <span className="block text-[#3B3957] leading-relaxed">{s.pourquoi}</span>
            </li>
          ))}
        </ul>
        <p className="text-[0.8125rem] leading-relaxed text-[#5E5C78]"><span className="font-bold">Placement :</span> {pourquoi.placement}</p>
      </div>
    </details>
  );
}
