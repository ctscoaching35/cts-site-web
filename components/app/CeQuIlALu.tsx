import { Surtitre } from './Ui';
import { dose, FAMILLE, reponsesDuSamedi } from '@/lib/app/journalEnClair';
import type { Questionnaire, Realise } from '@/lib/app/ecriture';
import type { SeanceLue } from '@/lib/app/continuite';
import { jourMois } from '@/lib/app/plan';
import { faiteSansRpe } from '@/lib/app/resumeSemaine';
import { enHeures } from '@/lib/app/tableau';

// « Ce qu'il a lu » (l'aperçu du dimanche, décisions coach du 04/11/2026) : sa réponse du samedi, la semaine écoulée et ses
// séances de qualité des 4 dernières semaines. Partagé par l'aperçu complet (calculé maintenant) et par « Sa semaine qui
// arrive » sur la page de l'athlète (calculé, ou gardé au passage du dimanche, Q4 du 08/11/2026) : les deux changent
// ensemble. La semaine écoulée se dit une fois, en charge tenue (la mesure de « Mes athlètes »).

// La semaine écoulée en une phrase : séances, charge tenue, séances clés, sortie longue. Des séances faites sans aucun RPE
// noté : « sans RPE » à la place de sa charge tenue (décision coach du 06/11/2026).
export function semaineEcoulee(r: Realise): string {
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  return [
    `${pluriel(r.seances_faites, 'séance')} faite${r.seances_faites > 1 ? 's' : ''} sur ${r.seances_prevues}`,
    // Validé par le coach le 06/11/2026
    faiteSansRpe(r) ? 'sans RPE'
      : r.charge_prevue ? `charge tenue : ${Math.round((100 * r.charge_tenue) / r.charge_prevue)} % de la prévue` : null,
    r.cles_prevues ? `${pluriel(r.cles_reussies, 'séance')} clé${r.cles_reussies > 1 ? 's' : ''} réussie${r.cles_reussies > 1 ? 's' : ''} au bon effort sur ${r.cles_prevues}` : null,
    r.sl_prevue_min ? `sortie longue ${r.sl_faite_min ? `de ${enHeures(r.sl_faite_min)}` : 'pas faite'} pour ${enHeures(r.sl_prevue_min)} prévue` : null,
  ].filter(Boolean).join(' ; ');
}

// sansRetours : rien de lu (« Première semaine : rien n'est lu. ») ; premiere : la première semaine d'une saison de fond,
// son questionnaire seul ; ancienne : sa réponse du samedi date de plus de 6 jours (celle d'une semaine d'avant).
export type Lu = { questionnaire?: Questionnaire; questionnaire_du?: string; lues?: SeanceLue[]; premiere?: boolean; sansRetours?: boolean };
export default function CeQuIlALu({ lu, realise, ancienne }: { lu: Lu; realise: Realise | null; ancienne: boolean }) {
  const lues = lu.lues;
  return (
    <details className="group bg-white rounded-2xl border border-indigo/[0.08] p-5">
      <summary className="cursor-pointer list-none min-h-8 flex items-center justify-between gap-3">
        <Surtitre as="div">Ce qu’il a lu</Surtitre>
        <span className="text-xs text-[#5E5C78]">Ouvrir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
      </summary>
      <div className="mt-3 space-y-2">
        {!lu.sansRetours && <p className="text-sm text-[#3B3957]">{reponsesDuSamedi(lu.questionnaire, lu.questionnaire_du, ancienne)}</p>}
        {realise && (
          <p className="text-sm text-[#3B3957]">
            {/* « sans RPE » dit déjà sa charge : la parenthèse reste pour une semaine sans séance faite. */}
            Semaine écoulée : {semaineEcoulee(realise)}{realise.rpe_lu || faiteSansRpe(realise) ? '' : ' (sans RPE lu : la charge compte le RPE prévu)'}.
          </p>
        )}
        {/* La première semaine d'une saison de fond (08/11/2026) : son questionnaire seul, dit plus haut ; rien d'autre. */}
        {lu.premiere ? null : lues === undefined ? (
          <p className="text-sm text-[#3B3957]">{lu.sansRetours ? 'Première semaine : rien n’est lu.' : 'Ses séances de qualité n’ont pas pu être lues : la marche suit le plan.'}</p>
        ) : lues.length === 0 ? (
          <p className="text-sm text-[#3B3957]">Aucune séance de qualité faite sur les 4 dernières semaines.</p>
        ) : (
          <>
            <p className="text-[0.8125rem] text-[#5E5C78]">Ses séances de qualité faites des 4 dernières semaines, classées par leur structure. La dernière de chaque famille, quand c’est la tienne, fixe la marche.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[0.72rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                    <th className="py-1.5 pr-3 font-bold">Date</th><th className="py-1.5 pr-3 font-bold">Famille</th>
                    <th className="py-1.5 pr-3 font-bold">Qualité</th><th className="py-1.5 pr-3 font-bold">RPE</th><th className="py-1.5 font-bold">Écrite par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo/10">
                  {[...lues].sort((x, y) => y.date.localeCompare(x.date)).map((l, i) => (
                    <tr key={`${l.date}-${i}`}>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{jourMois(l.date)}</td>
                      <td className="py-1.5 pr-3">{FAMILLE[l.famille]}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{dose(l)}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{l.rpe ?? '—'} pour {l.rpe_prevu ?? '—'}</td>
                      <td className="py-1.5">{l.moteur ? 'le moteur' : 'toi'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
