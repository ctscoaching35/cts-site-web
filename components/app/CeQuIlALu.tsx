import { Surtitre } from './Ui';
import { dose, FAMILLE, reponsesDuSamedi } from '@/lib/app/journalEnClair';
import type { Questionnaire, Realise } from '@/lib/app/ecriture';
import type { SeanceLue } from '@/lib/app/continuite';
import { jourMois } from '@/lib/app/plan';
import { faiteSansRpe } from '@/lib/app/resumeSemaine';
import { MOTS_DU_COACH, type MotsDuCoach } from '@/lib/app/motsDuCoach';
import { enHeures } from '@/lib/app/tableau';

// « Ce qu'il a lu » (l'aperçu du dimanche, décisions coach du 04/11/2026) : sa réponse du samedi, la semaine écoulée et ses
// séances de qualité des 4 dernières semaines. Partagé par l'aperçu complet (calculé maintenant) et par « Sa semaine qui
// arrive » sur la page de l'athlète (calculé, ou gardé au passage du dimanche, Q4 du 08/11/2026) : les deux changent
// ensemble. La semaine écoulée se dit une fois, en charge tenue (la mesure de « Mes athlètes »).

// La semaine écoulée en une phrase : séances, charge tenue, séances clés, sortie longue. Des séances faites sans aucun RPE
// noté : « sans RPE » à la place de sa charge tenue (décision coach du 06/11/2026).
// mots : ceux de la 9.x (« semaine tenue à 87 % du prévu », « effort non noté » ; lib/app/motsDuCoach.ts, décision 220 du coach, 24/11/2026) ; par défaut, ceux d'avant.
export function semaineEcoulee(r: Realise, mots: MotsDuCoach['lu'] = MOTS_DU_COACH.ancien.lu): string {
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  return [
    `${pluriel(r.seances_faites, 'séance')} faite${r.seances_faites > 1 ? 's' : ''} sur ${r.seances_prevues}`,
    // Validé par le coach le 06/11/2026
    faiteSansRpe(r) ? mots.sansEffort
      : r.charge_prevue ? mots.tenue(Math.round((100 * r.charge_tenue) / r.charge_prevue)) : null,
    r.cles_prevues ? `${pluriel(r.cles_reussies, 'séance')} clé${r.cles_reussies > 1 ? 's' : ''} réussie${r.cles_reussies > 1 ? 's' : ''} au bon effort sur ${r.cles_prevues}` : null,
    r.sl_prevue_min ? `sortie longue ${r.sl_faite_min ? `de ${enHeures(r.sl_faite_min)}` : 'pas faite'} pour ${enHeures(r.sl_prevue_min)} prévue` : null,
  ].filter(Boolean).join(' ; ');
}

// sansRetours : rien de lu (« Première semaine : rien n'est lu. ») ; premiere : la première semaine d'une saison de fond,
// son questionnaire seul ; ancienne : sa réponse du samedi date de plus de 6 jours (celle d'une semaine d'avant).
// Lot 0 du 16/11/2026 : l'état de la lecture (lue, partielle, absente, illisible, echec), sa cause et la question en cause, pour dire au coach
// pourquoi la réponse n'a pas servi ; tardive : arrivée après l'écriture (la passe du lundi l'a relue).
export type Lu = { questionnaire?: Questionnaire; questionnaire_du?: string; questionnaire_etat?: 'lue' | 'partielle' | 'absente' | 'illisible' | 'echec';
  reponse?: { cause?: 'ancienne' | 'non_envoyee'; illisibles?: string[]; erreur?: string }; tardive?: boolean;
  lues?: SeanceLue[]; premiere?: boolean; sansRetours?: boolean };
export default function CeQuIlALu({ lu, realise, ancienne, mots = MOTS_DU_COACH.ancien.lu }: { lu: Lu; realise: Realise | null; ancienne: boolean; mots?: MotsDuCoach['lu'] }) {
  const lues = lu.lues;
  const familles: Record<string, string> = { ...FAMILLE, ...mots.famille };
  return (
    <details className="group bg-white rounded-2xl border border-indigo/[0.08] p-5">
      <summary className="cursor-pointer list-none min-h-8 flex items-center justify-between gap-3">
        <Surtitre as="div">Ce qu’il a lu</Surtitre>
        <span className="text-xs text-[#5E5C78]">Ouvrir <span aria-hidden className="inline-block group-open:rotate-90">›</span></span>
      </summary>
      <div className="mt-3 space-y-2">
        {!lu.sansRetours && <p className="text-sm text-[#3B3957]">{reponsesDuSamedi(lu.questionnaire, lu.questionnaire_du, ancienne,
          { etat: lu.questionnaire_etat, ...lu.reponse, ...(lu.tardive ? { tardive: true } : {}) })}</p>}
        {realise && (
          <p className="text-sm text-[#3B3957]">
            {/* « sans RPE » dit déjà sa charge : la parenthèse reste pour une semaine sans séance faite. */}
            Semaine écoulée : {semaineEcoulee(realise, mots)}{realise.rpe_lu || faiteSansRpe(realise) ? '' : mots.sansEffortLu}.
          </p>
        )}
        {/* La première semaine d'une saison de fond (08/11/2026) : son questionnaire seul, dit plus haut ; rien d'autre. */}
        {lu.premiere ? null : lues === undefined ? (
          <p className="text-sm text-[#3B3957]">{lu.sansRetours ? 'Première semaine : rien n’est lu.' : mots.pasLues}</p>
        ) : lues.length === 0 ? (
          <p className="text-sm text-[#3B3957]">Aucune séance de qualité faite sur les 4 dernières semaines.</p>
        ) : (
          <>
            <p className="text-[0.8125rem] text-[#5E5C78]">{mots.explique}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[0.72rem] uppercase tracking-[0.08em] text-[#5E5C78]">
                    <th className="py-1.5 pr-3 font-bold">Date</th><th className="py-1.5 pr-3 font-bold">Famille</th>
                    <th className="py-1.5 pr-3 font-bold">Qualité</th><th className="py-1.5 pr-3 font-bold">{mots.colonneEffort}</th><th className="py-1.5 font-bold">Écrite par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo/10">
                  {[...lues].sort((x, y) => y.date.localeCompare(x.date)).map((l, i) => (
                    <tr key={`${l.date}-${i}`}>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{jourMois(l.date)}</td>
                      <td className="py-1.5 pr-3">{familles[l.famille]}</td>
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
