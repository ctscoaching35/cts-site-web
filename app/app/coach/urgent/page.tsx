import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { Geste, Regle } from '@/components/app/PointsCoach';
import { equipeNolio } from '@/lib/app/espaceCoach';
import { espaceDuCoach } from '@/lib/app/mesAthletes';
import { dateLongue } from '@/lib/app/plan';
import { espaceCoachOuvert } from '@/lib/app/supabase';
import { exigerCoach } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « URGENT », LA SEULE VUE TRANSVERSALE (décision « 1A » du coach, 08/11/2026 ; maquette validée le 08/11/2026, Q8 « A ») :
// regardée chaque jour, à la place de « Cette semaine ». Une ligne par point, rangée en quatre groupes (« A besoin de toi »,
// « Ne court plus », « Semaine pas partie », « Objectif bloqué »), chacune avec son bouton et « Réglé » ; le nom ouvre la
// page de l'athlète. Ce qui arrive (« À venir », Q7) et ce que le moteur a réglé seul n'y vont jamais : ils sont sur la page
// de chaque athlète. Pour le téléphone d'abord (EC5).
export default async function Urgent() {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const { nolio } = await equipeNolio();
  const espace = await espaceDuCoach(coach.compteId, nolio ? new Set(nolio.map((x) => x.id)) : null);
  const ceSoir = espace.urgent.some((g) => g.lignes.some((l) => l.point.sansGeste));
  return (
    <CadreCoach actif="urgent" urgents={espace.urgents}>
      {/* Maquette validée par le coach le 08/11/2026 */}
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Urgent</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78] first-letter:uppercase">{dateLongue(espace.jour)} · ce qui ne peut pas attendre ta revue du dimanche</p>
      </div>

      {espace.urgent.length === 0 ? (
        <Carte className="!p-5"><p className="text-sm text-teal font-semibold">Rien d’urgent aujourd’hui.</p></Carte>
      ) : (
        <Carte className="!p-5 space-y-5">
          {espace.urgent.map((g) => (
            <section key={g.cle}>
              <h2 className="text-[0.8125rem] font-extrabold tracking-[0.1em] uppercase text-[#8A3326]">{g.titre} · {g.lignes.length}</h2>
              <ul className="mt-1">
                {g.lignes.map(({ athleteId, nom, point }) => (
                  <li key={point.cle} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 border-t first:border-t-0 border-indigo/[0.07]">
                    <p className="min-w-0 flex-[1_1_300px] text-sm text-[#4A4866] leading-snug">
                      <Link href={`/app/coach/athlete/${athleteId}`} className="font-bold text-indigo hover:underline">{nom}</Link>
                      {' · '}{point.texte.charAt(0).toUpperCase()}{point.texte.slice(1)}
                      {point.sous && <span className="block mt-0.5 text-xs text-[#5E5C78]">{point.sous}</span>}
                    </p>
                    {!point.sansGeste && (
                      <div className="flex items-center gap-2">
                        <Geste r={point} />
                        <Regle cles={[point.cle]} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Carte>
      )}

      {ceSoir && (
        <p className="text-[0.8125rem] text-[#5E5C78]">
          Ce qui n’est pas encore parti se refait aux reprises de 20 h et 22 h ; lundi, ce qui manque encore est dans « Urgent », avec « Réessayer ».
        </p>
      )}
      {!espace.signaux && (
        <p className="text-xs text-[#5E5C78]">
          Les signaux de la semaine (commentaires, sensations, Hooper, rien de remonté) ne sont pas encore gardés : la migration
          du 04/11/2026 est à passer dans Supabase.
        </p>
      )}
      <p className="text-sm text-[#4A4866]">Le reste (ce qui arrive, ce que le moteur a réglé seul) est sur la page de chaque athlète.</p>
    </CadreCoach>
  );
}
