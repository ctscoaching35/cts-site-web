import { Carte, Surtitre } from '@/components/app/Ui';
import type { Pourquoi } from '@/lib/app/ecriture';

// Le pourquoi de la semaine proposée (moteur, cts_pourquoi ; demande du coach du 31/10/2026 : « que tu me justifies ce
// que tu proposes la semaine prochaine […] son niveau, son terrain, son objectif, ce que l'on a fait avant, ce qu'il a fait
// la semaine dernière ») : à confronter avec ce que le coach proposerait. Écrit par le moteur, sans IA.
export default function PourquoiSemaine({ pourquoi }: { pourquoi: Pourquoi }) {
  return (
    <Carte className="!p-5 space-y-3">
      <Surtitre>Pourquoi cette semaine</Surtitre>
      <ul className="space-y-1 text-sm leading-relaxed text-[#3B3957]">
        {pourquoi.profil.map((l) => <li key={l}>{l}</li>)}
        {pourquoi.ou && <li>{pourquoi.ou}</li>}
      </ul>
      {pourquoi.semaine_passee && (
        <p className="text-sm leading-relaxed text-[#3B3957]"><span className="font-bold">La semaine passée :</span> {pourquoi.semaine_passee}</p>
      )}
      <ul className="divide-y divide-indigo/10 text-sm">
        {pourquoi.seances.map((s, i) => (
          <li key={`${s.jour}-${i}`} className="py-2">
            <span className="font-bold text-indigo">{s.jour} · {s.seance}</span>
            <span className="block text-[#3B3957] leading-relaxed">{s.pourquoi}</span>
          </li>
        ))}
      </ul>
      <p className="text-[0.8125rem] leading-relaxed text-[#5E5C78]"><span className="font-bold">Placement :</span> {pourquoi.placement}</p>
    </Carte>
  );
}
