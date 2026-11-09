import { jMoins, type Semaine } from '@/lib/app/plan';
import { BANNIERE } from '@/lib/app/charte';
import { typeCoteCoach } from '@/lib/app/nomsSeances';

// La bannière de semaine, en carte claire (décision coach du 07/10/2026, « option A ») : la semaine et
// ses dates en surtitre, le type en titre, le bloc en pastille, le volume et les séances en grand, et
// la place de la semaine dans le plan. Le filet à gauche garde la couleur du type, celle du PDF. course : la date de
// l'objectif d'un coaché, dont la semaine se dit en J- et non « semaine 8 sur 16 » (décision coach du 19/10/2026).
// vers : le nom de la course du J-, quand ce n'est pas l'objectif de la semaine (une saison de fond, qui n'a pas de course,
// compte vers le prochain objectif : retour coach du 01/11/2026).
// volume, seances : ceux de la semaine telle qu'elle est dans Nolio (décision 11 du coach du 09/11/2026, « Sa semaine qui
// arrive »), à la place de ceux que le moteur a écrits.
export default function BanniereSemaine({ semaine, course, vers, volume, seances: seancesNolio }: {
  semaine: Semaine; course?: string; vers?: string; volume?: string; seances?: string;
}) {
  // « semaine 15 / 24 » et « 5 séances », tels que le moteur les écrit : l'app ne fait que les ranger.
  const rang = /(\d+)\s*\/\s*(\d+)/.exec(semaine.progression);
  const [n, total] = rang ? [Number(rang[1]), Number(rang[2])] : [0, 0];
  const texteSeances = seancesNolio ?? semaine.seances;
  const seances = /^(\d+)\s+(.+)$/.exec(texteSeances);
  return (
    <div className="bg-white shadow-sm border-l-4 px-4 py-3" style={{ borderLeftColor: BANNIERE[semaine.type] ?? '#2F2D4E' }}>
      <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-indigo/55">
        {course && semaine.lundi ? `${jMoins(semaine.lundi, course)}${vers ? ` avant ${vers}` : ''}` : total ? `Semaine ${n} sur ${total}` : semaine.numero} · {semaine.dates}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {/* Le type en mots (décisions coach du 08/11/2026) : « Semaine allégée », « Semaine de reprise » (la semaine écrite). */}
        <span className="text-xl font-extrabold text-indigo">{typeCoteCoach(semaine.type, Boolean(semaine.reprise_apres_course))}</span>
        <span className="text-xs font-semibold text-indigo bg-[#E4E3EE] px-2.5 py-1 rounded-full">
          {semaine.theme ? `Saison de fond · Bloc ${semaine.theme}` : semaine.bloc}
        </span>
      </div>
      <div className="flex gap-6 mt-2">
        <div>
          <div className="text-2xl font-extrabold text-indigo leading-tight">{volume ?? semaine.volume}</div>
          <div className="text-xs text-indigo/55">de volume</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold text-indigo leading-tight">{seances ? seances[1] : texteSeances}</div>
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
